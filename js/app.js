// App entry: loads settings, wires the hash router, registers the service worker.

import { openDB } from './db.js';
import { loadSettings, getSetting, setSetting, onSettingChange } from './settings.js';
import { applyI18n, t } from './i18n.js';
import { toast } from './ui.js';
import * as addView from './views/add.js';
import * as listView from './views/list.js';
import * as statsView from './views/stats.js';
import * as settingsView from './views/settings.js';

const TABS = { add: addView, list: listView, stats: statsView };
const ROUTES = { ...TABS, settings: settingsView };

const viewEl = document.getElementById('view');
let lastTab = 'add';
let currentPath = null;

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
  currentPath = path;
  if (TABS[route]) lastTab = route;

  const node = await ROUTES[route].render({ back: lastTab, params });
  viewEl.replaceChildren(node);
  document.body.dataset.route = route;
  if (changed) {
    viewEl.classList.remove('enter');
    void viewEl.offsetWidth; // restart the enter animation
    viewEl.classList.add('enter');
    window.scrollTo(0, 0);
  }

  document.querySelectorAll('.tabbar a').forEach((a) => {
    if (a.dataset.route === lastTab) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  document.title = route === 'add' ? 'Cinedex' : `${t(`nav.${route}`)} · Cinedex`;
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

/** Ask once for persistent storage so the browser doesn't evict the diary. */
async function requestPersistence() {
  if (getSetting('persistAsked') || !navigator.storage?.persist) return;
  try {
    await navigator.storage.persist();
  } finally {
    await setSetting('persistAsked', true);
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
  await renderRoute({ force: true });

  watchConnectivity();
  requestPersistence();
  registerServiceWorker();
}

start();
