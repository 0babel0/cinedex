// Item data layer: builds, reads and saves diary entries (see the data model in README/CLAUDE.md).

import * as db from './db.js';

export const SERIES_STATUSES = ['watching', 'finished', 'dropped'];

export function getItem(id) {
  return db.get('items', id);
}

export function getAllItems() {
  return db.getAll('items');
}

export async function itemIds() {
  return new Set(await db.keys('items'));
}

/** All tags in use, most frequent first. */
export async function allTags() {
  const counts = new Map();
  for (const item of await getAllItems()) {
    for (const tag of item.tags || []) counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
}

/**
 * Creates or updates an entry from TMDB metadata + user input.
 * - meta: normalized TMDB details (tmdb.getDetails)
 * - input: { status, rating, notes, tags, watchDate, seriesStatus, lastSeason }
 * - poster: Blob or null (only written when provided)
 * An existing entry keeps its createdAt and previous watch dates; a new watch date is appended.
 */
export async function saveFromTmdb(meta, input, poster) {
  const now = new Date().toISOString();
  const existing = await getItem(meta.id);
  const watched = input.status === 'watched';

  const watches = [...(existing?.watches || [])];
  if (watched && input.watchDate && !watches.includes(input.watchDate)) watches.push(input.watchDate);
  watches.sort();

  const isTv = meta.type === 'tv';
  const item = {
    id: meta.id,
    tmdbId: meta.tmdbId,
    type: meta.type,
    imdbId: meta.imdbId,
    title: meta.title,
    originalTitle: meta.originalTitle,
    year: meta.year,
    runtime: meta.runtime,
    seasons: meta.seasons,
    genres: meta.genres,
    directors: meta.directors,
    cast: meta.cast,
    overview: meta.overview,
    posterPath: meta.posterPath,
    metaLang: meta.metaLang,
    status: input.status,
    rating: watched ? input.rating ?? null : existing?.rating ?? null,
    notes: input.notes ?? '',
    tags: input.tags ?? [],
    watches,
    seriesStatus: isTv && watched ? input.seriesStatus ?? null : existing?.seriesStatus ?? null,
    lastSeason: isTv && watched ? input.lastSeason ?? null : existing?.lastSeason ?? null,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  const ops = [{ store: 'items', value: item }];
  if (poster) ops.push({ store: 'posters', value: poster, key: item.id });
  await db.putMany(ops);
  return { item, created: !existing };
}

/** Today's date as YYYY-MM-DD in local time (not UTC). */
export function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Case-insensitive tag cleanup; reuses the casing of an existing tag when it matches. */
export function normalizeTag(raw, known = []) {
  const tag = raw.trim().replace(/\s+/g, ' ').replace(/^#/, '');
  if (!tag) return '';
  return known.find((k) => k.toLowerCase() === tag.toLowerCase()) || tag;
}
