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
import * as watchlistView from './views/watchlist.js';
import * as settingsView from './views/settings.js';
import * as itemView from './views/item.js';
import * as personView from './views/person.js';
import { trackHistory } from './nav.js';

const TABS = { add: addView, list: listView, watchlist: watchlistView, stats: statsView };
const ROUTES = { ...TABS, settings: settingsView, item: itemView, person: personView };
const HOME = 'list';
const TAB_ORDER = ['add', 'list', 'watchlist', 'stats']; // same order as the tab bar

const viewEl = document.getElementById('view');
let lastTab = HOME;
let currentPath = null;
// Scroll position per path, so going back to a long list lands where you left it.
const scrollMemory = new Map();
let renderToken = 0;

/**
 * "#/add/movie/603?t=Matrix" →
 * { route: 'add', params: ['movie', '603'], query: URLSearchParams, path: 'add/movie/603' }
 */
function parseRoute() {
  const [rawPath, rawQuery = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const [name, ...params] = rawPath.split('/').filter(Boolean).map(decodeURIComponent);
  const route = ROUTES[name] ? name : HOME;
  return {
    route,
    params: ROUTES[name] ? params : [],
    query: new URLSearchParams(rawQuery),
    path: [route, ...(ROUTES[name] ? params : [])].join('/'),
  };
}

async function renderRoute({ force = false } = {}) {
  trackHistory();
  const { route, params, query, path } = parseRoute();
  if (path === currentPath && !force) return;
  const changed = path !== currentPath;
  // Tab to tab (tap or swipe): slide in from the side of the new tab.
  const prevTab = currentPath ? TAB_ORDER.indexOf(currentPath) : -1;
  const nextTab = TAB_ORDER.indexOf(path);
  const slide = prevTab >= 0 && nextTab >= 0 && prevTab !== nextTab ? (nextTab > prevTab ? 'enter-right' : 'enter-left') : 'enter';
  if (currentPath) scrollMemory.set(currentPath, window.scrollY);
  currentPath = path;
  if (TABS[route]) lastTab = route;

  const token = ++renderToken;
  const node = await ROUTES[route].render({ back: lastTab, params, query });
  if (token !== renderToken) return; // a newer navigation won the race
  viewEl.replaceChildren(node);
  viewEl.style.cssText = ''; // end of a swipe: drop the drag offset now that the new page is in
  document.body.dataset.route = route;
  if (changed) {
    viewEl.classList.remove('enter', 'enter-left', 'enter-right');
    void viewEl.offsetWidth; // restart the enter animation
    viewEl.classList.add(slide);
    // Tabs restore their scroll position; sheets always open at the top.
    window.scrollTo(0, TABS[route] && !params.length ? scrollMemory.get(path) || 0 : 0);
  }

  document.querySelectorAll('.tabbar a').forEach((a) => {
    if (a.dataset.route === lastTab) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  document.title = TABS[route] || route === 'settings' ? `${t(`nav.${route}`)} · Cinedex` : 'Cinedex';
}

/**
 * Swipe between tabs. The page follows the finger (with resistance on the first and last tab),
 * then either slides out and the neighbouring tab slides in, or snaps back.
 * Only on tabs (not sheets or settings), not from the screen edges (Android back gesture), not on
 * controls that need horizontal moves, and only once the gesture is clearly horizontal: vertical
 * scrolling stays native (`touch-action: pan-y` on the view).
 */
function enableTabSwipe() {
  const EDGE = 24;
  let s = null;
  const tabIndex = () => TAB_ORDER.indexOf(currentPath);
  const setStyle = (transform, opacity = '', transition = '') => {
    Object.assign(viewEl.style, { transform, opacity, transition });
  };

  document.addEventListener('touchstart', (e) => {
    const p = e.touches[0];
    s = e.touches.length === 1 && tabIndex() >= 0
      && p.clientX > EDGE && p.clientX < window.innerWidth - EDGE
      && !e.target.closest('input, textarea, select, .stars, .filters, dialog, .toasts')
      ? { x: p.clientX, y: p.clientY, t: Date.now(), lock: null, dx: 0 } : null;
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!s) return;
    const p = e.touches[0];
    const dx = p.clientX - s.x;
    const dy = p.clientY - s.y;
    if (!s.lock) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      s.lock = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'h' : 'v';
      if (s.lock === 'v') { s = null; return; }
      viewEl.classList.remove('enter', 'enter-left', 'enter-right');
      viewEl.classList.add('dragging');
    }
    const i = tabIndex();
    const hasNeighbour = dx < 0 ? i < TAB_ORDER.length - 1 : i > 0;
    s.dx = hasNeighbour ? dx : dx / 4; // rubber band at the ends
    setStyle(`translateX(${s.dx}px)`);
  }, { passive: true });

  const finish = (cancelled) => {
    if (!s) return;
    const { dx, t } = s;
    s = null;
    viewEl.classList.remove('dragging');
    const next = TAB_ORDER[tabIndex() + (dx < 0 ? 1 : -1)];
    const speed = Math.abs(dx) / Math.max(1, Date.now() - t); // px/ms
    const go = !cancelled && next && (Math.abs(dx) > window.innerWidth * 0.3 || (speed > 0.45 && Math.abs(dx) > 40));
    if (go) {
      setStyle(`translateX(${dx < 0 ? -40 : 40}%)`, '0', 'transform .16s ease-in, opacity .16s ease-in');
      setTimeout(() => { location.hash = `#/${next}`; }, 160); // renderRoute clears the inline styles
    } else {
      setStyle('', '', 'transform .2s ease-out');
      setTimeout(() => { if (!viewEl.classList.contains('dragging')) viewEl.style.transition = ''; }, 200);
    }
  };
  document.addEventListener('touchend', () => finish(false), { passive: true });
  document.addEventListener('touchcancel', () => finish(true), { passive: true });
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

function dismissSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;
  const remove = () => splash.remove();
  splash.addEventListener('animationend', (e) => { if (e.target === splash) remove(); });
  setTimeout(remove, 2000); // safety net (e.g. animations disabled)
}

async function start() {
  dismissSplash();
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
  enableTabSwipe();
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
