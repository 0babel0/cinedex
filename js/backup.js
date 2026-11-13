// Export (JSON + simplified CSV) and import (JSON merge) of the diary.
// Posters are not exported: they are downloaded again after an import.

import * as db from './db.js';
import { getAllItems, today } from './items.js';
import { setSetting } from './settings.js';
import { setPoster } from './posters.js';

export const SCHEMA_VERSION = 1;

/** Field order of an exported item (keeps the JSON stable and readable). */
const FIELDS = [
  'id', 'tmdbId', 'type', 'imdbId', 'title', 'originalTitle', 'year', 'runtime', 'seasons',
  'genres', 'directors', 'cast', 'overview', 'posterPath', 'metaLang',
  'status', 'rating', 'notes', 'tags', 'watches', 'seriesStatus', 'lastSeason',
  'createdAt', 'updatedAt',
];

function ordered(item) {
  return Object.fromEntries(FIELDS.map((f) => [f, item[f] ?? null]));
}

function byId(a, b) {
  return a.id.localeCompare(b.id, 'en', { numeric: true });
}

export async function exportJson() {
  const items = (await getAllItems()).sort(byId).map(ordered);
  const data = { app: 'cinedex', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), items };
  return new File([JSON.stringify(data, null, 2) + '\n'], `cinedex-${today()}.json`, { type: 'application/json' });
}

export async function exportCsv() {
  const cols = ['type', 'title', 'originalTitle', 'year', 'status', 'rating', 'watches', 'tags', 'notes',
    'genres', 'directors', 'seriesStatus', 'lastSeason', 'tmdbId', 'imdbId'];
  const cell = (v) => {
    const s = Array.isArray(v) ? v.join('; ') : v == null ? '' : String(v);
    return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = (await getAllItems()).sort(byId).map((i) => cols.map((c) => cell(i[c])).join(','));
  // BOM so spreadsheet apps read UTF-8 accents correctly.
  return new File(['﻿' + [cols.join(','), ...rows].join('\r\n') + '\r\n'], `cinedex-${today()}.csv`, { type: 'text/csv' });
}

/**
 * Hands a file to the OS share sheet (Drive, Nextcloud, mail…) when supported, else downloads it.
 * Resolves to 'shared' | 'downloaded' | 'cancelled'.
 */
export async function shareOrDownload(file) {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return 'shared';
    } catch (err) {
      if (err.name === 'AbortError') return 'cancelled';
      // Some browsers expose share() but refuse files at call time: fall back to a download.
    }
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'downloaded';
}

export async function markExported() {
  await setSetting('lastExportAt', new Date().toISOString());
}

export class ImportError extends Error {
  constructor(kind) { super(kind); this.kind = kind; } // 'format' | 'newer'
}

/**
 * Merges an export into the local diary: per id, the entry with the most recent updatedAt wins.
 * Resolves to { added, updated, skipped, invalid }.
 */
export async function importJson(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new ImportError('format');
  }
  if (data?.app !== 'cinedex' || !Array.isArray(data.items)) throw new ImportError('format');
  if (typeof data.schemaVersion !== 'number' || data.schemaVersion > SCHEMA_VERSION) throw new ImportError('newer');

  const local = new Map((await getAllItems()).map((i) => [i.id, i]));
  const result = { added: 0, updated: 0, skipped: 0, invalid: 0 };
  const ops = [];
  const stale = [];
  for (const raw of data.items) {
    const item = sanitize(raw);
    if (!item) { result.invalid++; continue; }
    const mine = local.get(item.id);
    if (!mine) result.added++;
    else if (Date.parse(item.updatedAt) > Date.parse(mine.updatedAt || 0)) result.updated++;
    else { result.skipped++; continue; }
    ops.push({ store: 'items', value: item });
    // Different poster: drop the stored one, it gets downloaded again.
    if (mine && mine.posterPath !== item.posterPath) stale.push(item.id);
  }
  if (ops.length) await db.putMany(ops);
  if (stale.length) {
    await db.delMany(stale.map((key) => ({ store: 'posters', key })));
    stale.forEach((id) => setPoster(id, null));
  }
  return result;
}

const str = (v) => (typeof v === 'string' ? v : '');
const strOrNull = (v) => (typeof v === 'string' && v ? v : null);
const int = (v) => (Number.isInteger(v) ? v : null);
const strings = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : []);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Validates and normalizes one imported entry; returns null when unusable. */
function sanitize(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const m = /^(movie|tv):(\d+)$/.exec(raw.id);
  if (!m || !str(raw.title)) return null;
  const type = m[1];
  const status = raw.status === 'watchlist' ? 'watchlist' : 'watched';
  const rating = typeof raw.rating === 'number' && raw.rating >= 0.5 && raw.rating <= 5
    ? Math.round(raw.rating * 2) / 2 : null;
  const now = new Date().toISOString();
  const iso = (v) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null);
  return ordered({
    id: raw.id,
    tmdbId: Number(m[2]),
    type,
    imdbId: strOrNull(raw.imdbId),
    title: raw.title,
    originalTitle: str(raw.originalTitle),
    year: int(raw.year),
    runtime: int(raw.runtime),
    seasons: int(raw.seasons),
    genres: strings(raw.genres),
    directors: strings(raw.directors),
    cast: strings(raw.cast),
    overview: str(raw.overview),
    posterPath: typeof raw.posterPath === 'string' && raw.posterPath.startsWith('/') ? raw.posterPath : null,
    metaLang: strOrNull(raw.metaLang),
    status,
    rating,
    notes: str(raw.notes),
    tags: [...new Set(strings(raw.tags))],
    watches: [...new Set(strings(raw.watches).filter((d) => DATE.test(d)))].sort(),
    seriesStatus: type === 'tv' && ['watching', 'finished', 'dropped'].includes(raw.seriesStatus) ? raw.seriesStatus : null,
    lastSeason: type === 'tv' ? int(raw.lastSeason) : null,
    createdAt: iso(raw.createdAt) || now,
    updatedAt: iso(raw.updatedAt) || iso(raw.createdAt) || now,
  });
}
