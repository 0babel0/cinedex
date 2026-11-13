// Detail sheet (#/add/{type}/{id}): TMDB metadata + the user's input, then "Watched" or "Watchlist".
// A title already in the diary opens its entry editor instead.
// Shared links carry ?t=title&y=year&p=posterPath so a visitor without a TMDB key still gets a preview.

import { t, tmdbLang, errorText } from '../i18n.js';
import { getSetting } from '../settings.js';
import { getDetails, fetchPoster, posterUrl } from '../tmdb.js';
import { getItem, allTags, saveFromTmdb, today } from '../items.js';
import { setPoster } from '../posters.js';
import { h, toast } from '../ui.js';
import { goBack } from '../nav.js';
import { ratingInput, tagInput } from '../components.js';
import { header, field, skeleton, seriesInputs, sheetHead } from './sheet.js';

let posterObjectUrl = null;

export async function render({ params, query }) {
  const [type, rawId] = params;
  const tmdbId = Number(rawId);
  const id = `${type}:${tmdbId}`;

  if (await getItem(id)) {
    location.replace(`#/item/${encodeURIComponent(id)}`);
    return h('div');
  }

  const page = h('section', { class: 'page detail' });
  if (!getSetting('tmdbKey')) {
    page.append(...preview(type, tmdbId, query));
    return page;
  }

  const head = sheetHead('#/add');
  const body = h('div', { class: 'detail-body' }, skeleton());
  page.append(head, body);

  const run = () => load(type, tmdbId, page, body).catch((err) => {
    console.error(err);
    body.replaceChildren(h('div', { class: 'empty' },
      h('p', { text: errorText(err) }),
      h('button', { type: 'button', class: 'btn', text: t('detail.retry'), onClick: () => {
        body.replaceChildren(skeleton());
        run();
      } }),
    ));
  });
  run();
  return page;
}

async function load(type, tmdbId, page, body) {
  const [meta, knownTags] = await Promise.all([
    getDetails(type, tmdbId, { language: tmdbLang() }),
    allTags(),
  ]);

  // Download the poster once and keep the Blob for saving.
  let poster = null;
  if (meta.posterPath) {
    try { poster = await fetchPoster(meta.posterPath); } catch { poster = null; }
  }
  if (posterObjectUrl) URL.revokeObjectURL(posterObjectUrl);
  posterObjectUrl = poster ? URL.createObjectURL(poster) : null;

  page.querySelector('.page-head').replaceWith(sheetHead('#/add', meta));
  body.replaceChildren(header(meta, posterObjectUrl || posterUrl(meta.posterPath)), form(meta, knownTags, poster));
}

/** Card for a shared link opened without a TMDB key: what the link carries, plus how to get Cinedex. */
function preview(type, tmdbId, query) {
  const p = query.get('p') || '';
  const meta = {
    type, tmdbId,
    title: query.get('t') || t('share.unknownTitle'),
    year: Number(query.get('y')) || null,
    posterPath: /^\/[\w.-]+$/.test(p) ? p : null,
  };
  return [
    sheetHead('#/list', meta),
    header({ ...meta, overview: undefined }, posterUrl(meta.posterPath)),
    h('section', { class: 'card' },
      h('h2', { text: t('share.previewTitle') }),
      h('p', { class: 'muted', text: t('share.previewText') }),
      h('div', { class: 'row wrap' },
        h('a', { class: 'btn primary', href: '#/settings', text: t('add.goSettings') }),
        h('a', {
          class: 'btn', href: `https://www.themoviedb.org/${type}/${tmdbId}`,
          target: '_blank', rel: 'noopener noreferrer', text: t('share.openTmdb'),
        })),
    ),
  ];
}

function form(meta, knownTags, poster) {
  const isTv = meta.type === 'tv';

  const rating = ratingInput(null);
  const date = h('input', { class: 'field', type: 'date', id: 'watch-date', max: today(), required: true });
  date.value = today();
  const notes = h('textarea', { class: 'field', id: 'notes', rows: 3, placeholder: t('form.notesPlaceholder') });
  const tags = tagInput([], knownTags);
  const series = isTv ? seriesInputs(meta.seasons, null) : null;

  const collect = (status) => ({
    status,
    rating: rating.value,
    notes: notes.value.trim(),
    tags: tags.value,
    watchDate: date.value || today(),
    seriesStatus: series?.status ?? null,
    lastSeason: series?.lastSeason ?? null,
  });

  const save = async (status, button) => {
    if (status === 'watched' && !date.checkValidity()) { date.reportValidity(); return; }
    button.disabled = true;
    try {
      await saveFromTmdb(meta, collect(status), poster);
      if (poster) setPoster(meta.id, poster);
      toast(t(status === 'watchlist' ? 'detail.savedWatchlist' : 'detail.savedWatched', { title: meta.title }));
      goBack('#/add');
    } catch (err) {
      console.error(err);
      toast(t('detail.saveError'));
      button.disabled = false;
    }
  };

  const watchedBtn = h('button', { type: 'button', class: 'btn primary', text: t('detail.watched') });
  watchedBtn.addEventListener('click', () => save('watched', watchedBtn));
  const watchlistBtn = h('button', { type: 'button', class: 'btn', text: t('detail.watchlist') });
  watchlistBtn.addEventListener('click', () => save('watchlist', watchlistBtn));

  // Rating, watch date and series progress are only kept for "Watched".
  return h('div', { class: 'detail-form' },
    h('section', { class: 'card' },
      h('h2', { text: t('form.yourTake') }),
      field(t('form.rating'), rating.el),
      field(t('form.watchDate'), date, 'watch-date'),
      series?.nodes,
      field(t('form.notes'), notes, 'notes'),
      field(t('form.tags'), tags.el),
    ),
    h('div', { class: 'actions' }, watchlistBtn, watchedBtn),
  );
}
