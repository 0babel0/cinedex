// Diary entry editor (#/item/{id}): rating, notes, tags, watch dates (rewatches), series progress, delete.

import { t } from '../i18n.js';
import { getItem, allTags, updateItem, deleteItem, today } from '../items.js';
import { posterUrl, setPoster } from '../posters.js';
import { h, append, toast, confirmDialog } from '../ui.js';
import { ratingInput, tagInput } from '../components.js';
import { header, field, formatDate, seriesInputs } from './sheet.js';

export async function render({ params, back }) {
  const id = params[0];
  const backHref = `#/${back}`;
  const [item, knownTags, poster] = await Promise.all([getItem(id), allTags(), posterUrl(id)]);

  const page = h('section', { class: 'page detail' },
    h('div', { class: 'page-head' },
      h('a', {
        class: 'icon-btn', href: backHref, 'aria-label': t('nav.back'), title: t('nav.back'),
        html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
      })));

  if (!item) {
    page.append(h('div', { class: 'empty' }, h('p', { text: t('item.notFound') })));
    return page;
  }

  let status = item.status;
  let watches = [...item.watches];
  const isTv = item.type === 'tv';

  const rating = ratingInput(item.rating);
  const notes = h('textarea', { class: 'field', id: 'notes', rows: 4, placeholder: t('form.notesPlaceholder') });
  notes.value = item.notes || '';
  const tags = tagInput(item.tags || [], knownTags);
  const series = isTv ? seriesInputs(item.seasons, item) : null;

  // --- Watch dates ---
  const watchList = h('ul', { class: 'watches' });
  const renderWatches = () => {
    watchList.replaceChildren(...watches.slice().reverse().map((d) => h('li', {},
      h('span', { text: formatDate(d) }),
      h('button', {
        type: 'button', class: 'icon-btn small', 'aria-label': `${t('item.removeWatch')} ${formatDate(d)}`,
        title: t('item.removeWatch'), html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
        onClick: () => { watches = watches.filter((x) => x !== d); renderWatches(); },
      }))));
    if (!watches.length) watchList.append(h('li', { class: 'muted', text: t('item.noWatches') }));
  };
  renderWatches();
  const newDate = h('input', { class: 'field', type: 'date', max: today(), id: 'new-watch', 'aria-label': t('item.addWatch') });
  newDate.value = today();
  const addWatch = h('button', { type: 'button', class: 'btn small', text: t('item.addWatch') });
  addWatch.addEventListener('click', () => {
    if (!newDate.value || !newDate.checkValidity()) { newDate.reportValidity(); return; }
    if (!watches.includes(newDate.value)) watches = [...watches, newDate.value].sort();
    renderWatches();
  });

  // --- Watchlist → watched ---
  const watchedSection = h('div', { class: 'form-group' });
  const promote = h('div', { class: 'notice row spread' },
    h('span', { text: t('item.inWatchlist') }),
    h('button', { type: 'button', class: 'btn primary small', text: t('item.markWatched'), onClick: () => {
      status = 'watched';
      if (!watches.length) watches = [today()];
      renderWatches();
      promote.remove();
      watchedSection.hidden = false;
    } }));
  watchedSection.hidden = status !== 'watched';
  append(watchedSection,
    field(t('form.rating'), rating.el),
    series?.nodes,
    field(t('item.watches'), h('div', { class: 'watch-field' },
      watchList, h('div', { class: 'row' }, newDate, addWatch))),
  );

  // --- Actions ---
  const save = h('button', { type: 'button', class: 'btn primary', text: t('item.save') });
  save.addEventListener('click', async () => {
    save.disabled = true;
    try {
      const watched = status === 'watched';
      await updateItem(id, {
        status,
        rating: watched ? rating.value : null,
        notes: notes.value.trim(),
        tags: tags.value,
        watches,
        seriesStatus: watched && series ? series.status : item.seriesStatus,
        lastSeason: watched && series ? series.lastSeason : item.lastSeason,
      });
      toast(t('item.saved'));
      location.hash = backHref;
    } catch (err) {
      console.error(err);
      toast(t('detail.saveError'));
      save.disabled = false;
    }
  });

  const del = h('button', { type: 'button', class: 'btn ghost danger-text', text: t('item.delete') });
  del.addEventListener('click', async () => {
    const ok = await confirmDialog(t('item.confirmDelete', { title: item.title }), {
      confirmLabel: t('item.delete'), cancelLabel: t('item.cancel'), danger: true,
    });
    if (!ok) return;
    await deleteItem(id);
    setPoster(id, null);
    toast(t('item.deleted', { title: item.title }));
    location.hash = backHref;
  });

  append(page,
    header(item, poster),
    status === 'watchlist' && promote,
    h('section', { class: 'card' },
      h('h2', { text: t('form.yourTake') }),
      watchedSection,
      field(t('form.notes'), notes, 'notes'),
      field(t('form.tags'), tags.el),
    ),
    h('p', { class: 'muted small center', text: t('item.addedOn', { date: formatDate(item.createdAt.slice(0, 10)) }) }),
    h('div', { class: 'actions' }, del, save),
  );
  return page;
}
