// App entry: loads settings, wires the hash router, registers the service worker.

import { openDB } from './db.js';
import { loadSettings, getSetting, setSetting, onSettingChange } from './settings.js';
import { applyI18n, t, errorText } from './i18n.js';
import { consumeShare } from './share.js';
import { fetchMissingPosters } from './posters.js';
import { toast, isStandalone } from './ui.js';
import * as addView from './views/add.js';
import { setSearchQuery } from './views/add.js';
import * as listView from './views/list.js';
import * as statsView from './views/stats.js';
import * as settingsView from './views/settings.js';
import * as itemView from './views/item.js';

const TABS = { add: addView, list: listView, stats: statsView };
const ROUTES = { ...TABS, settings: settingsView, item: itemView };

const viewEl = document.getElementById('view');
let lastTab = 'add';
let currentPath = null;
// Scroll position per path, so going back to a long list lands where you left it.
const scrollMemory = new Map();
let renderToken = 0;

/** "#/add/movie/603" → { route: 'add', params: ['movie', '603'], path: 'add/movie/603' } */
function parseRoute() {
  const path = location.hash.replace(/^#\/?/, '').split('?')[0];
  const [name, ...params] = path.split('/').filter(Boolean).map(decodeURIComponent);
  const route = ROUTES[name] ? name : 'add';
  return { route, params: ROUTES[name] ? params : [], path: [route, ...params].join('/') };
}

async function renderRoute({ force = false } = {}) {
  const { route, params, path } = parseRoute();
  if (path === currentPath && !force) return;
  const changed = path !== currentPath;
  if (currentPath) scrollMemory.set(currentPath, window.scrollY);
  currentPath = path;
  if (TABS[route]) lastTab = route;

  const token = ++renderToken;
  const node = await ROUTES[route].render({ back: lastTab, params });
  if (token !== renderToken) return; // a newer navigation won the race
  viewEl.replaceChildren(node);
  document.body.dataset.route = route;
  if (changed) {
    viewEl.classList.remove('enter');
    void viewEl.offsetWidth; // restart the enter animation
    viewEl.classList.add('enter');
    // Tabs restore their scroll position; sheets always open at the top.
    window.scrollTo(0, TABS[route] && !params.length ? scrollMemory.get(path) || 0 : 0);
  }

  document.querySelectorAll('.tabbar a').forEach((a) => {
    if (a.dataset.route === lastTab) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  document.title = TABS[route] || route === 'settings' ? `${t(`nav.${route}`)} · Cinedex` : 'Cinedex';
}

function applyTheme() {
  const theme = getSetting('theme');
  document.documentElement.dataset.theme = theme;
  // Keep the browser chrome in sync with the effective background.
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]').content = bg || '#0f0d13';
}

function watchConnectivity() {
  const pill = document.getElementById('offline-pill');
  const update = () => { pill.hidden = navigator.onLine; };
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

/**
 * Ask for persistent storage so the browser doesn't evict the diary.
 * Chrome grants it silently from heuristics (installed app, engagement), so a refusal
 * in the browser tab is common: retry on each launch of the installed app and right
 * after installation. In a plain tab, ask only once (Firefox shows a prompt).
 */
async function requestPersistence() {
  if (!navigator.storage?.persist) return;
  try {
    if (await navigator.storage.persisted()) return;
    if (getSetting('persistAsked') && !isStandalone()) return;
    await navigator.storage.persist();
  } catch (err) {
    console.warn('storage.persist failed', err);
  } finally {
    if (!getSetting('persistAsked')) await setSetting('persistAsked', true);
  }
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    const offerUpdate = (worker) => {
      toast(t('app.updateReady'), {
        duration: 0,
        action: { label: t('app.reload'), onClick: () => worker.postMessage('SKIP_WAITING') },
      });
    };
    if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker?.addEventListener('statechange', () => {
        // Only an *update* if a previous worker already controls the page.
        if (worker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(worker);
      });
    });
  }).catch((err) => console.warn('SW registration failed', err));

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
}

async function start() {
  try {
    await openDB();
    await loadSettings();
  } catch (err) {
    console.error(err);
    toast(t('app.dbError'), { duration: 0 });
  }
  applyTheme();
  applyI18n();

  onSettingChange((key) => {
    if (key === 'theme') applyTheme();
    if (key === 'lang') { applyI18n(); renderRoute({ force: true }); }
  });
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', applyTheme);

  window.addEventListener('hashchange', () => renderRoute());
  const share = await consumeShare().catch(() => null);
  if (share?.hash) history.replaceState(null, '', share.hash);
  else if (share?.error) {
    if (share.query) setSearchQuery(share.query);
    history.replaceState(null, '', '#/add');
  }
  await renderRoute({ force: true });
  if (share?.error) toast(shareErrorText(share.error), { duration: 5000 });

  watchConnectivity();
  requestPersistence();
  window.addEventListener('appinstalled', () => setTimeout(requestPersistence, 1000));
  registerServiceWorker();
  // Posters missing locally (after an import, or a failed download): fetch them quietly.
  setTimeout(() => fetchMissingPosters(), 3000);
  window.addEventListener('online', () => fetchMissingPosters());
}

function shareErrorText(error) {
  if (error === 'unrecognized') return t('share.unrecognized');
  if (error === 'notfound') return t('share.notFound');
  return errorText(error);
}

start();
