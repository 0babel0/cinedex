// Poster Blobs (IndexedDB) exposed as object URLs, so lists never touch the network.

import * as db from './db.js';
import { fetchPoster } from './tmdb.js';

const urls = new Map();
let loaded = null;

/** Loads all stored posters once; resolves to Map<id, objectURL>. */
export function posterUrls() {
  loaded ??= db.entries('posters').then((all) => {
    for (const [id, blob] of Object.entries(all)) {
      if (blob instanceof Blob && !urls.has(id)) urls.set(id, URL.createObjectURL(blob));
    }
    return urls;
  });
  return loaded;
}

export async function posterUrl(id) {
  return (await posterUrls()).get(id) || null;
}

/** Call after a poster was written or deleted. */
export function setPoster(id, blob) {
  if (urls.has(id)) URL.revokeObjectURL(urls.get(id));
  if (blob) urls.set(id, URL.createObjectURL(blob));
  else urls.delete(id);
}

/**
 * Downloads posters missing from IndexedDB (e.g. after an import). Runs a few at a time.
 * onProgress(done, total). Resolves to the number of posters fetched.
 */
export async function fetchMissingPosters(onProgress = () => {}) {
  if (!navigator.onLine) return 0;
  const [items, have] = await Promise.all([db.getAll('items'), db.keys('posters')]);
  const haveSet = new Set(have);
  const todo = items.filter((i) => i.posterPath && !haveSet.has(i.id));
  if (!todo.length) return 0;

  const total = todo.length;
  let done = 0;
  let fetched = 0;
  const worker = async () => {
    while (todo.length) {
      const item = todo.shift();
      try {
        const blob = await fetchPoster(item.posterPath);
        if (blob) {
          await db.put('posters', blob, item.id);
          setPoster(item.id, blob);
          fetched++;
        }
      } catch { /* offline or missing image: retried on a later launch */ }
      onProgress(++done, total);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return fetched;
}
