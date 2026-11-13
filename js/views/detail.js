// Detail sheet (#/add/{type}/{id}): TMDB metadata + the user's input, then "Watched" or "Watchlist".

import { t, tmdbLang, lang, errorText } from '../i18n.js';
import { getDetails, fetchPoster } from '../tmdb.js';
import { getItem, allTags, saveFromTmdb, today, SERIES_STATUSES } from '../items.js';
import * as db from '../db.js';
import { h, segmented, toast } from '../ui.js';
import { ratingInput, tagInput } from '../components.js';

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

function header(meta, posterSrc) {
  const showOriginal = meta.originalTitle && meta.originalTitle !== meta.title;
  const facts = [
    meta.year,
    meta.type === 'movie' ? formatRuntime(meta.runtime) : formatSeasons(meta.seasons),
    t(`type.${meta.type}`),
  ].filter(Boolean);

  const backdrop = h('div', { class: 'detail-backdrop', 'aria-hidden': 'true' });
  if (posterSrc) backdrop.style.backgroundImage = `url("${posterSrc}")`;

  return h('div', { class: 'detail-head' },
    backdrop,
    h('div', { class: 'detail-hero' },
      posterSrc
        ? h('img', { class: 'poster', src: posterSrc, alt: '', width: 342, height: 513 })
        : h('div', { class: 'poster poster-empty', 'aria-hidden': 'true' }),
      h('div', { class: 'detail-titles' },
        h('h1', { class: 'detail-title', text: meta.title }),
        showOriginal && h('p', { class: 'detail-original', text: meta.originalTitle }),
        h('p', { class: 'detail-facts', text: facts.join(' · ') }),
        meta.genres.length > 0 && h('div', { class: 'chips' }, meta.genres.map((g) => h('span', { class: 'chip', text: g }))),
      ),
    ),
    meta.directors.length > 0 && h('p', { class: 'credit' },
      h('span', { class: 'muted', text: `${t(meta.type === 'movie' ? 'detail.director' : 'detail.creators', { n: meta.directors.length })} ` }),
      meta.directors.join(', ')),
    meta.cast.length > 0 && h('p', { class: 'credit' },
      h('span', { class: 'muted', text: `${t('detail.cast')} ` }), meta.cast.join(', ')),
    h('p', { class: `overview${meta.overview ? '' : ' muted'}`, text: meta.overview || t('detail.noOverview') }),
  );
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

  let seriesStatus = existing?.seriesStatus || 'watching';
  const lastSeason = h('input', {
    class: 'field season', type: 'number', id: 'last-season', inputmode: 'numeric',
    min: 1, max: meta.seasons || undefined, step: 1,
  });
  lastSeason.value = existing?.lastSeason ?? '';

  const seriesFields = isTv && [
    field(t('form.seriesStatus'), segmented('series-status',
      SERIES_STATUSES.map((s) => ({ value: s, label: t(`series.${s}`) })),
      seriesStatus,
      (v) => {
        seriesStatus = v;
        if (v === 'finished' && meta.seasons) lastSeason.value = meta.seasons;
      })),
    field(t('form.lastSeason'), h('div', { class: 'row' },
      lastSeason,
      meta.seasons && h('span', { class: 'muted', text: t('form.ofSeasons', { n: meta.seasons }) }))),
  ];

  const collect = (status) => {
    const season = parseInt(lastSeason.value, 10);
    return {
      status,
      rating: rating.value,
      notes: notes.value.trim(),
      tags: tags.value,
      watchDate: date.value || today(),
      seriesStatus: isTv ? seriesStatus : null,
      lastSeason: isTv && Number.isFinite(season) && season > 0 ? season : null,
    };
  };

  const save = async (status, button) => {
    if (status === 'watched' && !date.checkValidity()) { date.reportValidity(); return; }
    button.disabled = true;
    try {
      const { created } = await saveFromTmdb(meta, collect(status), posterIsNew ? poster : null);
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
      seriesFields,
      field(t('form.notes'), notes, 'notes'),
      field(t('form.tags'), tags.el),
    ),
    h('div', { class: 'actions' }, watchlistBtn, watchedBtn),
  );
}

function field(label, control, forId) {
  return h('div', { class: 'form-field' },
    forId ? h('label', { for: forId, text: label }) : h('span', { class: 'label', text: label }),
    control);
}

function existingText(item) {
  if (item.status === 'watchlist') return t('detail.alreadyWatchlist');
  const last = item.watches.at(-1);
  return t('detail.alreadyWatched', { n: item.watches.length, date: last ? formatDate(last) : '?' });
}

function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(lang() === 'fr' ? 'fr-FR' : 'en-US',
    { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatRuntime(min) {
  if (!min) return null;
  const hh = Math.floor(min / 60);
  const mm = String(min % 60).padStart(2, '0');
  if (!hh) return `${min} min`;
  return lang() === 'fr' ? `${hh} h ${mm}` : `${hh}h ${mm}m`;
}

function formatSeasons(n) {
  return n ? t(n > 1 ? 'detail.seasons' : 'detail.season', { n }) : null;
}

function skeleton() {
  return h('div', { class: 'detail-hero skeleton', 'aria-busy': 'true' },
    h('div', { class: 'poster poster-empty' }),
    h('div', { class: 'detail-titles' },
      h('div', { class: 'sk-line w70' }), h('div', { class: 'sk-line w40' }), h('div', { class: 'sk-line w55' })),
  );
}
