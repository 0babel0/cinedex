// Thin TMDB API client. Supports both credential types:
//   - v3 "API Key"            → sent as ?api_key=…
//   - v4 "Read Access Token"  → sent as Authorization: Bearer …
// The key comes from settings and never leaves the device except to api.themoviedb.org.

import { getSetting } from './settings.js';

const API = 'https://api.themoviedb.org/3';
export const IMG = 'https://image.tmdb.org/t/p';

export class TmdbError extends Error {
  constructor(kind, status, message) {
    super(message || kind);
    this.kind = kind;     // 'nokey' | 'badkey' | 'offline' | 'http' | 'notfound'
    this.status = status;
  }
}

/** Returns 'v3', 'v4' or null for an unrecognized format. */
export function keyType(key) {
  const k = (key || '').trim();
  if (/^[a-f0-9]{32}$/i.test(k)) return 'v3';
  if (/^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(k)) return 'v4';
  return null;
}

export async function tmdbFetch(path, params = {}, { key = getSetting('tmdbKey'), signal } = {}) {
  key = (key || '').trim();
  const type = keyType(key);
  if (!key) throw new TmdbError('nokey');
  if (!type) throw new TmdbError('badkey');

  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  }
  const headers = { Accept: 'application/json' };
  if (type === 'v3') url.searchParams.set('api_key', key);
  else headers.Authorization = `Bearer ${key}`;

  let res;
  try {
    res = await fetch(url, { headers, signal, referrerPolicy: 'no-referrer', credentials: 'omit' });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new TmdbError('offline');
  }
  if (res.status === 401) throw new TmdbError('badkey', 401);
  if (res.status === 404) throw new TmdbError('notfound', 404);
  if (!res.ok) throw new TmdbError('http', res.status, `TMDB HTTP ${res.status}`);
  return res.json();
}

/** Checks a key against TMDB. Resolves to its type ('v3' | 'v4'), rejects with TmdbError. */
export async function testKey(key) {
  const data = await tmdbFetch('/authentication', {}, { key });
  if (!data || data.success === false) throw new TmdbError('badkey');
  return keyType(key);
}

// ---------- Search & details ----------

/** Movies and TV shows matching query (people are dropped). */
export async function searchMulti(query, { language, signal } = {}) {
  const data = await tmdbFetch('/search/multi', { query, language, include_adult: 'false' }, { signal });
  return (data.results || [])
    .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
    .map((r) => ({
      type: r.media_type,
      tmdbId: r.id,
      title: r.title ?? r.name ?? '',
      originalTitle: r.original_title ?? r.original_name ?? '',
      year: yearOf(r.release_date ?? r.first_air_date),
      posterPath: r.poster_path || null,
      overview: r.overview || '',
    }));
}

/**
 * Full details for one title, normalized to Cinedex fields (without user fields).
 * One request (credits + external ids appended); a second one only when the
 * localized synopsis is empty, to fall back to the English one.
 */
export async function getDetails(type, tmdbId, { language, signal } = {}) {
  if (type !== 'movie' && type !== 'tv') throw new TmdbError('notfound', 404);
  const d = await tmdbFetch(`/${type}/${tmdbId}`,
    { language, append_to_response: 'credits,external_ids' }, { signal });

  let overview = (d.overview || '').trim();
  if (!overview && language !== 'en-US') {
    try {
      const en = await tmdbFetch(`/${type}/${tmdbId}`, { language: 'en-US' }, { signal });
      overview = (en.overview || '').trim();
    } catch (err) {
      if (err.name === 'AbortError') throw err; // otherwise: keep the empty synopsis
    }
  }

  const movie = type === 'movie';
  return {
    id: `${type}:${d.id}`,
    tmdbId: d.id,
    type,
    imdbId: (movie ? d.imdb_id : d.external_ids?.imdb_id) || null,
    title: (movie ? d.title : d.name) || '',
    originalTitle: (movie ? d.original_title : d.original_name) || '',
    year: yearOf(movie ? d.release_date : d.first_air_date),
    runtime: movie ? (d.runtime || null) : null,
    seasons: movie ? null : (d.number_of_seasons || null),
    genres: (d.genres || []).map((g) => g.name),
    directors: movie
      ? (d.credits?.crew || []).filter((c) => c.job === 'Director').map((c) => c.name)
      : (d.created_by || []).map((c) => c.name),
    cast: (d.credits?.cast || [])
      .slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .slice(0, 8).map((c) => c.name),
    overview,
    posterPath: d.poster_path || null,
    metaLang: language || 'fr-FR',
  };
}

export function posterUrl(path, size = 'w342') {
  return path ? `${IMG}/${size}${path}` : null;
}

/** Downloads a poster as a Blob (stored in IndexedDB so lists never hit the network). */
export async function fetchPoster(path, { size = 'w342', signal } = {}) {
  if (!path) return null;
  const res = await fetch(posterUrl(path, size), { signal, referrerPolicy: 'no-referrer', credentials: 'omit' });
  if (!res.ok) throw new TmdbError('http', res.status);
  return res.blob();
}

function yearOf(date) {
  const y = parseInt((date || '').slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}
