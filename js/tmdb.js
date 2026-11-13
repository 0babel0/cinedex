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

export async function tmdbFetch(path, params = {}, key = getSetting('tmdbKey')) {
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
    res = await fetch(url, { headers, referrerPolicy: 'no-referrer', credentials: 'omit' });
  } catch {
    throw new TmdbError('offline');
  }
  if (res.status === 401) throw new TmdbError('badkey', 401);
  if (res.status === 404) throw new TmdbError('notfound', 404);
  if (!res.ok) throw new TmdbError('http', res.status, `TMDB HTTP ${res.status}`);
  return res.json();
}

/** Checks a key against TMDB. Resolves to its type ('v3' | 'v4'), rejects with TmdbError. */
export async function testKey(key) {
  const data = await tmdbFetch('/authentication', {}, key);
  if (!data || data.success === false) throw new TmdbError('badkey');
  return keyType(key);
}
