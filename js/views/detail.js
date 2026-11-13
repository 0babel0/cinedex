// Detail sheet (#/add/{type}/{id}): TMDB metadata + the user's input, then "Watched" or "Watchlist".

import { t, tmdbLang, errorText } from '../i18n.js';
import { getDetails, fetchPoster } from '../tmdb.js';
import { getItem, allTags, saveFromTmdb, today } from '../items.js';
import * as db from '../db.js';
import { setPoster } from '../posters.js';
import { h, toast } from '../ui.js';
import { ratingInput, tagInput } from '../components.js';
import { header, field, skeleton, formatDate, seriesInputs } from './sheet.js';

let posterObjectUrl = null;

export function render({ params }) {
  const [type, rawId] = params;
  const tmdbId = Number(rawId);

  const body = h('div', { class: 'detail-body' }, skeleton());
  const page = h('section', { class: 'page detail' },
    h('div', { class: 'page-head' },
      h('a', {
        class: 'icon-btn', href: '#/add', 'aria-label': t('nav.back'), title: t('nav.back'),
        html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
      }),
    ),
    body,
  );

  load(type, tmdbId, body).catch((err) => {
    console.error(err);
    body.replaceChildren(h('div', { class: 'empty' },
      h('p', { text: errorText(err) }),
      h('button', { type: 'button', class: 'btn', text: t('detail.retry'), onClick: () => {
        body.replaceChildren(skeleton());
        load(type, tmdbId, body).catch(() => toast(errorText(err)));
      } }),
    ));
  });
  return page;
}

async function load(type, tmdbId, body) {
  const id = `${type}:${tmdbId}`;
  const [meta, existing, knownTags, storedPoster] = await Promise.all([
    getDetails(type, tmdbId, { language: tmdbLang() }),
    getItem(id),
    allTags(),
    db.get('posters', id),
  ]);

  // Reuse the stored poster when there is one; otherwise download it once and keep the Blob for saving.
  let poster = storedPoster || null;
  let posterIsNew = false;
  if (!poster && meta.posterPath) {
    try {
      poster = await fetchPoster(meta.posterPath);
      posterIsNew = true;
    } catch { poster = null; }
  }
  if (posterObjectUrl) URL.revokeObjectURL(posterObjectUrl);
  posterObjectUrl = poster ? URL.createObjectURL(poster) : null;

  body.replaceChildren(header(meta, posterObjectUrl), form(meta, existing, knownTags, poster, posterIsNew));
}

function form(meta, existing, knownTags, poster, posterIsNew) {
  const isTv = meta.type === 'tv';
  const wasWatched = existing?.status === 'watched';

  const rating = ratingInput(existing?.rating ?? null);
  const date = h('input', { class: 'field', type: 'date', id: 'watch-date', max: today(), required: true });
  date.value = today();
  const notes = h('textarea', { class: 'field', id: 'notes', rows: 3, placeholder: t('form.notesPlaceholder') });
  notes.value = existing?.notes || '';
  const tags = tagInput(existing?.tags || [], knownTags);

  const series = isTv ? seriesInputs(meta.seasons, existing) : null;

  const collect = (status) => {
    return {
      status,
      rating: rating.value,
      notes: notes.value.trim(),
      tags: tags.value,
      watchDate: date.value || today(),
      seriesStatus: series?.status ?? null,
      lastSeason: series?.lastSeason ?? null,
    };
  };

  const save = async (status, button) => {
    if (status === 'watched' && !date.checkValidity()) { date.reportValidity(); return; }
    button.disabled = true;
    try {
      const { created } = await saveFromTmdb(meta, collect(status), posterIsNew ? poster : null);
      if (posterIsNew && poster) setPoster(meta.id, poster);
      const key = status === 'watchlist' ? 'detail.savedWatchlist' : created ? 'detail.savedWatched' : 'detail.updated';
      toast(t(key, { title: meta.title }));
      location.hash = '#/add';
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

  // A title already watched can't go back to the watchlist; "Watched" then adds a rewatch date.
  watchlistBtn.hidden = wasWatched;

  // Rating, watch date and series progress are only kept for "Watched".
  return h('div', { class: 'detail-form' },
    existing && h('p', { class: 'notice', text: existingText(existing) }),
    h('section', { class: 'card' },
      h('h2', { text: t('form.yourTake') }),
      field(t('form.rating'), rating.el),
      field(t(wasWatched ? 'form.rewatchDate' : 'form.watchDate'), date, 'watch-date'),
      series?.nodes,
      field(t('form.notes'), notes, 'notes'),
      field(t('form.tags'), tags.el),
    ),
    h('div', { class: 'actions' }, watchlistBtn, watchedBtn),
  );
}

function existingText(item) {
  if (item.status === 'watchlist') return t('detail.alreadyWatchlist');
  const last = item.watches.at(-1);
  return t('detail.alreadyWatched', { n: item.watches.length, date: last ? formatDate(last) : '?' });
}
