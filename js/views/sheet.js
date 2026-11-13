// Shared building blocks for title sheets (TMDB detail sheet and diary entry editor).

import { t, lang } from '../i18n.js';
import { h, segmented } from '../ui.js';
import { SERIES_STATUSES } from '../items.js';

export function header(meta, posterSrc) {
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

export function field(label, control, forId) {
  return h('div', { class: 'form-field' },
    forId ? h('label', { for: forId, text: label }) : h('span', { class: 'label', text: label }),
    control);
}

export function skeleton() {
  return h('div', { class: 'detail-hero skeleton', 'aria-busy': 'true' },
    h('div', { class: 'poster poster-empty' }),
    h('div', { class: 'detail-titles' },
      h('div', { class: 'sk-line w70' }), h('div', { class: 'sk-line w40' }), h('div', { class: 'sk-line w55' })),
  );
}

export function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(lang() === 'fr' ? 'fr-FR' : 'en-US',
    { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatRuntime(min) {
  if (!min) return null;
  const hh = Math.floor(min / 60);
  const mm = String(min % 60).padStart(2, '0');
  if (!hh) return `${min} min`;
  return lang() === 'fr' ? `${hh} h ${mm}` : `${hh}h ${mm}m`;
}

export function formatSeasons(n) {
  return n ? t(n > 1 ? 'detail.seasons' : 'detail.season', { n }) : null;
}

/** TV progress inputs: status + last season watched. Returns { nodes, status, lastSeason }. */
export function seriesInputs(seasons, initial) {
  let status = initial?.seriesStatus || 'watching';
  const lastSeason = h('input', {
    class: 'field season', type: 'number', id: 'last-season', inputmode: 'numeric',
    min: 1, max: seasons || undefined, step: 1,
  });
  lastSeason.value = initial?.lastSeason ?? '';

  const nodes = [
    field(t('form.seriesStatus'), segmented('series-status',
      SERIES_STATUSES.map((s) => ({ value: s, label: t(`series.${s}`) })),
      status,
      (v) => {
        status = v;
        if (v === 'finished' && seasons) lastSeason.value = seasons;
      })),
    field(t('form.lastSeason'), h('div', { class: 'row' },
      lastSeason,
      seasons && h('span', { class: 'muted', text: t('form.ofSeasons', { n: seasons }) })), 'last-season'),
  ];
  return {
    nodes,
    get status() { return status; },
    get lastSeason() {
      const n = parseInt(lastSeason.value, 10);
      return Number.isFinite(n) && n > 0 ? n : null;
    },
  };
}
