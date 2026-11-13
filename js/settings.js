// App settings, persisted in IndexedDB ("settings" store) and cached in memory.
// theme and lang are mirrored to localStorage for flash-free startup (see boot.js).

import * as db from './db.js';

const DEFAULTS = {
  tmdbKey: '',
  lang: 'fr',          // 'fr' | 'en'
  theme: 'dark',       // 'auto' | 'light' | 'dark'
  listView: 'grid',    // 'grid' | 'list'
  lastExportAt: null,  // ISO-8601
  persistAsked: false,
};

const MIRRORED = ['theme', 'lang'];

let cache = { ...DEFAULTS };
const listeners = new Set();

export async function loadSettings() {
  const stored = await db.entries('settings');
  cache = { ...DEFAULTS, ...stored };
  MIRRORED.forEach(mirror);
  return cache;
}

export function getSetting(key) {
  return cache[key];
}

export async function setSetting(key, value) {
  if (!(key in DEFAULTS)) throw new Error(`Unknown setting: ${key}`);
  cache[key] = value;
  if (MIRRORED.includes(key)) mirror(key);
  await db.put('settings', value, key);
  listeners.forEach((fn) => fn(key, value));
}

/** Subscribe to setting changes. Returns an unsubscribe function. */
export function onSettingChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function mirror(key) {
  try {
    localStorage.setItem(`cinedex.${key}`, cache[key]);
  } catch { /* storage blocked: startup falls back to defaults */ }
}
