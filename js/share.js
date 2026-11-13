// Android share target: a TMDB or IMDb link shared to Cinedex opens the matching detail sheet.
// The manifest sends shares to index.html?title=…&text=…&url=… (GET), handled at startup.

import { findByImdb } from './tmdb.js';
import { t } from './i18n.js';
import { toast } from './ui.js';

/** Extracts a title reference from shared text. Returns { type, tmdbId } | { imdbId } | null. */
export function parseSharedLink(text) {
  const tmdb = /themoviedb\.org\/(movie|tv)\/(\d+)/i.exec(text);
  if (tmdb) return { type: tmdb[1].toLowerCase(), tmdbId: Number(tmdb[2]) };
  const imdb = /imdb\.com\/(?:[a-z]{2}\/)?title\/(tt\d+)/i.exec(text);
  if (imdb) return { imdbId: imdb[1] };
  return null;
}

/**
 * Reads share parameters from the URL (if any) and clears them.
 * Resolves to null when the launch is not a share, otherwise to
 * { hash } (route to open) or { error: 'unrecognized' | 'notfound' | TmdbError, query }.
 */
export async function consumeShare() {
  const params = new URLSearchParams(location.search);
  if (!['title', 'text', 'url'].some((k) => params.has(k))) return null;
  const shared = ['url', 'text', 'title'].map((k) => params.get(k) || '').join(' ').trim();
  // Drop the query so a reload doesn't replay the share.
  history.replaceState(null, '', location.pathname + location.hash);

  const ref = parseSharedLink(shared);
  if (!ref) return { error: 'unrecognized', query: params.get('title') || '' };
  if (ref.tmdbId) return { hash: `#/add/${ref.type}/${ref.tmdbId}` };
  try {
    const found = await findByImdb(ref.imdbId);
    return found ? { hash: `#/add/${found.type}/${found.tmdbId}` } : { error: 'notfound' };
  } catch (err) {
    return { error: err };
  }
}

// ---------- Sharing a title with someone ----------

/**
 * Link to a title sheet on this Cinedex site. It carries title, year and poster so that a
 * recipient without a TMDB key still sees a preview card.
 */
export function titleLink(meta) {
  const base = location.origin + location.pathname.replace(/index\.html$/, '');
  const q = new URLSearchParams();
  if (meta.title) q.set('t', meta.title);
  if (meta.year) q.set('y', meta.year);
  if (meta.posterPath) q.set('p', meta.posterPath);
  return `${base}#/add/${meta.type}/${meta.tmdbId}?${q}`;
}

/** Opens the OS share sheet with the title link; falls back to copying it. */
export async function shareTitle(meta) {
  const url = titleLink(meta);
  const text = meta.year ? `${meta.title} (${meta.year})` : meta.title;
  if (navigator.share) {
    try {
      await navigator.share({ title: text, text, url });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast(t('share.copied'));
  } catch {
    toast(url, { duration: 10000 });
  }
}
