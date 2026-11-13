// Service worker: precaches the app shell so Cinedex opens offline.
// TMDB requests (api/image) are never cached here: posters live in IndexedDB.
// Bump CACHE_VERSION (and APP_VERSION in js/version.js) whenever a shell file changes.

const CACHE_VERSION = 'v0.2.0';
const CACHE = `cinedex-shell-${CACHE_VERSION}`;

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/boot.js',
  './js/app.js',
  './js/db.js',
  './js/components.js',
  './js/i18n.js',
  './js/items.js',
  './js/settings.js',
  './js/tmdb.js',
  './js/ui.js',
  './js/version.js',
  './js/views/add.js',
  './js/views/detail.js',
  './js/views/list.js',
  './js/views/stats.js',
  './js/views/settings.js',
  './assets/tmdb.svg',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  // cache: 'reload' bypasses the HTTP cache so a new version gets fresh files.
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((k) => k.startsWith('cinedex-shell-') && k !== CACHE)
      .map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// The page asks the waiting worker to take over when the user accepts the update.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // TMDB: straight to network

  if (request.mode === 'navigate') {
    // Single-page app: any navigation inside the scope gets the shell.
    event.respondWith(
      caches.match('./index.html', { cacheName: CACHE })
        .then((cached) => cached || fetch(request)),
    );
    return;
  }

  event.respondWith(
    caches.match(request, { cacheName: CACHE, ignoreSearch: true })
      .then((cached) => cached || fetch(request)),
  );
});
