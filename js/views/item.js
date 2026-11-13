// Diary entry editor (#/item/{id}). Every change is saved automatically (no "Save" button):
// rating, notes, tags, watch dates (rewatches), series progress. Delete asks for confirmation.

import { t, errorText } from '../i18n.js';
import { getSetting } from '../settings.js';
import { getItem, allTags, updateItem, deleteItem, today } from '../items.js';
import { getDetails } from '../tmdb.js';
import { posterUrl, setPoster } from '../posters.js';
import { h, append, toast, confirmDialog } from '../ui.js';
import { goBack } from '../nav.js';
import { ratingInput, tagInput } from '../components.js';
import { header, field, formatDate, seriesInputs, sheetHead } from './sheet.js';

export async function render({ params, back }) {
  const id = params[0];
  const fallback = `#/${back}`;
  const [item, knownTags, poster] = await Promise.all([getItem(id), allTags(), posterUrl(id)]);

  const page = h('section', { class: 'page detail' });
  if (!item) {
    page.append(sheetHead(fallback), h('div', { class: 'empty' }, h('p', { text: t('item.notFound') })));
    return page;
  }

  const saver = autoSaver(id);
  const isTv = item.type === 'tv';
  let watches = [...item.watches];

  const rating = ratingInput(item.rating, (rating) => saver.queue({ rating }, 300));
  const notes = h('textarea', { class: 'field', id: 'notes', rows: 4, placeholder: t('form.notesPlaceholder') });
  notes.value = item.notes || '';
  notes.addEventListener('input', () => saver.queue({ notes: notes.value.trim() }, 700));
  notes.addEventListener('blur', () => saver.flush());
  const tags = tagInput(item.tags || [], knownTags, (tags) => saver.queue({ tags }));
  const series = isTv ? seriesInputs(item.seasons, item, (patch) => saver.queue(patch)) : null;

  // --- Watch dates ---
  const watchList = h('ul', { class: 'watches' });
  const setWatches = (next) => {
    watches = [...new Set(next)].sort();
    renderWatches();
    saver.queue({ watches });
  };
  const renderWatches = () => {
    watchList.replaceChildren(...watches.slice().reverse().map((d) => h('li', {},
      h('span', { text: formatDate(d) }),
      h('button', {
        type: 'button', class: 'icon-btn small', 'aria-label': `${t('item.removeWatch')} ${formatDate(d)}`,
        title: t('item.removeWatch'), html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
        onClick: () => setWatches(watches.filter((x) => x !== d)),
      }))));
    if (!watches.length) watchList.append(h('li', { class: 'muted', text: t('item.noWatches') }));
  };
  renderWatches();
  const newDate = h('input', { class: 'field', type: 'date', max: today(), id: 'new-watch', 'aria-label': t('item.addWatch') });
  newDate.value = today();
  const addWatch = h('button', { type: 'button', class: 'btn small', text: t('item.addWatch') });
  addWatch.addEventListener('click', () => {
    if (!newDate.value || !newDate.checkValidity()) { newDate.reportValidity(); return; }
    setWatches([...watches, newDate.value]);
  });

  // --- Watchlist → watched ---
  const watchedSection = h('div', { class: 'form-group' });
  const promote = h('div', { class: 'notice row spread' },
    h('span', { text: t('item.inWatchlist') }),
    h('button', { type: 'button', class: 'btn primary small', text: t('item.markWatched'), onClick: () => {
      if (!watches.length) watches = [today()];
      renderWatches();
      saver.queue({
        status: 'watched', watches,
        seriesStatus: isTv ? series.status : null,
        lastSeason: isTv ? series.lastSeason : null,
      });
      promote.remove();
      watchedSection.hidden = false;
    } }));
  watchedSection.hidden = item.status !== 'watched';
  append(watchedSection,
    field(t('form.rating'), rating.el),
    series?.nodes,
    field(t('item.watches'), h('div', { class: 'watch-field' },
      watchList, h('div', { class: 'row' }, newDate, addWatch))),
  );

  // --- Delete ---
  const del = h('button', { type: 'button', class: 'btn ghost danger-text', text: t('item.delete') });
  del.addEventListener('click', async () => {
    const ok = await confirmDialog(t('item.confirmDelete', { title: item.title }), {
      confirmLabel: t('item.delete'), cancelLabel: t('item.cancel'), danger: true,
    });
    if (!ok) return;
    saver.cancel();
    await deleteItem(id);
    setPoster(id, null);
    toast(t('item.deleted', { title: item.title }));
    goBack(fallback);
  });

  const head = sheetHead(fallback, item);
  head.insertBefore(saver.indicator, head.querySelector('button')); // before the share button
  const sheetTop = header(item, poster);
  append(page,
    head,
    sheetTop,
    item.status === 'watchlist' && promote,
    h('section', { class: 'card' },
      h('h2', { text: t('form.yourTake') }),
      watchedSection,
      field(t('form.notes'), notes, 'notes'),
      field(t('form.tags'), tags.el),
    ),
    h('p', { class: 'muted small center', text: t('item.addedOn', { date: formatDate(localDate(item.createdAt)) }) }),
    h('div', { class: 'center' }, del),
  );

  enrichHeader(item, poster, sheetTop);
  return page;
}

/**
 * Stored entries keep names only. When online, fetch the title once more to make names
 * clickable (TMDB person ids) and show the community score. Silent on failure.
 */
async function enrichHeader(item, poster, node) {
  if (!getSetting('tmdbKey') || !navigator.onLine) return;
  try {
    const fresh = await getDetails(item.type, item.tmdbId, { language: item.metaLang || undefined, overviewFallback: false });
    if (!node.isConnected) return;
    node.replaceWith(header({ ...item, people: fresh.people, vote: fresh.vote }, poster));
  } catch (err) {
    console.info('Header enrichment skipped:', errorText(err));
  }
}

/**
 * Debounced, ordered saves. queue(patch, delay) merges patches; flush() writes now.
 * Pending changes are also written when leaving the page or hiding the app.
 */
function autoSaver(id) {
  let pending = {};
  let timer = null;
  let chain = Promise.resolve();
  const indicator = h('span', { class: 'save-state', role: 'status', 'aria-live': 'polite' });
  let hideTimer = null;

  const show = (key, kind) => {
    clearTimeout(hideTimer);
    indicator.textContent = t(key);
    indicator.dataset.kind = kind;
    indicator.classList.add('visible');
    if (kind === 'ok') hideTimer = setTimeout(() => indicator.classList.remove('visible'), 1500);
  };

  const flush = () => {
    clearTimeout(timer);
    if (!Object.keys(pending).length) return chain;
    const patch = pending;
    pending = {};
    show('item.saving', 'busy');
    chain = chain
      .then(() => updateItem(id, patch))
      .then(() => show('item.saved', 'ok'))
      .catch((err) => {
        console.error(err);
        show('detail.saveError', 'error');
        toast(t('detail.saveError'));
      });
    return chain;
  };

  const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', onHide);
  // Leaving the editor: write what's pending and stop listening.
  window.addEventListener('hashchange', () => {
    flush();
    window.removeEventListener('pagehide', flush);
    document.removeEventListener('visibilitychange', onHide);
  }, { once: true });

  return {
    indicator,
    queue(patch, delay = 0) {
      Object.assign(pending, patch);
      clearTimeout(timer);
      timer = setTimeout(flush, delay);
    },
    flush,
    cancel() { clearTimeout(timer); pending = {}; },
  };
}

/** ISO timestamp → local YYYY-MM-DD. */
function localDate(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
