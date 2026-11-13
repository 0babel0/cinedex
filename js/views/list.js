// "My list" tab: watched titles as a poster grid or a list, with search, sort and filters.

import { t, lang } from '../i18n.js';
import { getSetting, setSetting } from '../settings.js';
import { getAllItems, lastWatch } from '../items.js';
import { posterUrls } from '../posters.js';
import { h, append } from '../ui.js';
import { formatRating } from '../components.js';
import { formatDate } from './sheet.js';
import { exportReminder } from './reminder.js';

const SORTS = ['watched', 'rating', 'title', 'year'];
const DEFAULT_FILTERS = { type: 'all', genre: '', tag: '', minRating: 0 };

// Kept across renders (coming back from an entry restores the same view).
const state = { q: '', sort: 'watched', desc: true, ...DEFAULT_FILTERS, filtersOpen: false };

const ICONS = {
  grid: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="9" rx="1.5"/><rect x="3" y="15" width="7" height="6" rx="1.5"/><rect x="14" y="15" width="7" height="6" rx="1.5"/></svg>',
  list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
  filter: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18M6 12h12M10 19h4"/></svg>',
  sortDesc: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16M6 14l6 6 6-6"/></svg>',
  sortAsc: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20V4M6 10l6-6 6 6"/></svg>',
};

export async function render() {
  const [all, posters] = await Promise.all([getAllItems(), posterUrls()]);
  const items = all.filter((i) => i.status === 'watched');

  const page = h('section', { class: 'page list-page' },
    h('h1', { class: 'page-title', text: t('list.title') }));
  const reminder = exportReminder(all);
  if (reminder) page.append(reminder);

  if (!items.length) {
    page.append(h('div', { class: 'empty' },
      h('p', { text: t('list.empty') }),
      h('a', { class: 'btn primary', href: '#/add', text: t('nav.add') })));
    return page;
  }

  const genres = uniqueSorted(items.flatMap((i) => i.genres || []));
  const tags = uniqueSorted(items.flatMap((i) => i.tags || []));
  if (state.genre && !genres.includes(state.genre)) state.genre = '';
  if (state.tag && !tags.includes(state.tag)) state.tag = '';

  const results = h('div');
  const count = h('p', { class: 'muted small count' });

  const update = () => {
    const shown = sortItems(filterItems(items));
    const mode = getSetting('listView');
    count.textContent = t('list.count', { n: shown.length, total: items.length });
    results.replaceChildren(shown.length
      ? (mode === 'list' ? listRows(shown, posters) : grid(shown, posters))
      : h('p', { class: 'muted center empty-filter', text: t('list.noMatch') }));
    filterBtn.classList.toggle('active', filtersActive());
    reset.hidden = !filtersActive() && !state.q;
  };

  // --- Toolbar ---
  const search = h('input', {
    class: 'field', type: 'search', placeholder: t('list.searchPlaceholder'),
    'aria-label': t('list.searchPlaceholder'), enterkeyhint: 'search',
  });
  search.value = state.q;
  let timer;
  search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.q = search.value; update(); }, 120);
  });
  search.addEventListener('keydown', (e) => { if (e.key === 'Enter') search.blur(); });

  const viewBtn = h('button', { type: 'button', class: 'icon-btn' });
  const syncViewBtn = () => {
    const mode = getSetting('listView');
    viewBtn.innerHTML = mode === 'list' ? ICONS.grid : ICONS.list;
    const label = t(mode === 'list' ? 'list.showGrid' : 'list.showList');
    viewBtn.setAttribute('aria-label', label);
    viewBtn.title = label;
  };
  viewBtn.addEventListener('click', async () => {
    await setSetting('listView', getSetting('listView') === 'list' ? 'grid' : 'list');
    syncViewBtn();
    update();
  });
  syncViewBtn();

  const filterBtn = h('button', {
    type: 'button', class: 'icon-btn filter-btn', html: ICONS.filter,
    'aria-label': t('list.filters'), title: t('list.filters'), 'aria-expanded': String(state.filtersOpen),
  });

  // --- Filters panel ---
  const sortSelect = select(SORTS.map((s) => [s, t(`list.sort.${s}`)]), state.sort, (v) => {
    state.sort = v;
    state.desc = v !== 'title'; // sensible default direction per criterion
    syncDir();
    update();
  });
  const dirBtn = h('button', { type: 'button', class: 'icon-btn' });
  const syncDir = () => {
    dirBtn.innerHTML = state.desc ? ICONS.sortDesc : ICONS.sortAsc;
    const label = t(state.desc ? 'list.desc' : 'list.asc');
    dirBtn.setAttribute('aria-label', label);
    dirBtn.title = label;
  };
  dirBtn.addEventListener('click', () => { state.desc = !state.desc; syncDir(); update(); });
  syncDir();

  const typeSelect = select([['all', t('list.allTypes')], ['movie', t('list.movies')], ['tv', t('list.shows')]],
    state.type, (v) => { state.type = v; update(); });
  const genreSelect = select([['', t('list.allGenres')], ...genres.map((g) => [g, g])],
    state.genre, (v) => { state.genre = v; update(); });
  const tagSelect = select([['', t('list.allTags')], ...tags.map((g) => [g, g])],
    state.tag, (v) => { state.tag = v; update(); });
  const ratingSelect = select([[0, t('list.anyRating')],
    ...[1, 2, 3, 3.5, 4, 4.5, 5].map((r) => [r, `≥ ${formatRating(r)}`])],
    state.minRating, (v) => { state.minRating = Number(v); update(); });

  const reset = h('button', { type: 'button', class: 'btn ghost small', text: t('list.reset') });
  reset.addEventListener('click', () => {
    Object.assign(state, DEFAULT_FILTERS, { q: '' });
    search.value = '';
    typeSelect.value = 'all'; genreSelect.value = ''; tagSelect.value = ''; ratingSelect.value = 0;
    update();
  });

  const panel = h('div', { class: 'filters' },
    labeled(t('list.sortBy'), h('div', { class: 'row tight' }, sortSelect, dirBtn)),
    labeled(t('list.type'), typeSelect),
    labeled(t('list.genre'), genreSelect),
    tags.length > 0 && labeled(t('list.tag'), tagSelect),
    labeled(t('list.minRating'), ratingSelect),
  );
  panel.hidden = !state.filtersOpen;
  filterBtn.addEventListener('click', () => {
    state.filtersOpen = !state.filtersOpen;
    panel.hidden = !state.filtersOpen;
    filterBtn.setAttribute('aria-expanded', String(state.filtersOpen));
  });

  append(page,
    h('div', { class: 'toolbar' }, search, filterBtn, viewBtn),
    panel,
    h('div', { class: 'row spread' }, count, reset),
    results,
  );
  update();
  return page;
}

function filtersActive() {
  return state.type !== 'all' || state.genre || state.tag || state.minRating > 0;
}

/** Lowercase, accents stripped: "Amélie" matches "amelie". */
export function fold(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function filterItems(items) {
  const q = fold(state.q.trim());
  return items.filter((i) =>
    (state.type === 'all' || i.type === state.type)
    && (!state.genre || i.genres?.includes(state.genre))
    && (!state.tag || i.tags?.includes(state.tag))
    && (!state.minRating || (i.rating ?? 0) >= state.minRating)
    && (!q || fold(`${i.title}\n${i.originalTitle}\n${i.notes}`).includes(q)));
}

function sortItems(items) {
  const collator = new Intl.Collator(lang(), { sensitivity: 'base', numeric: true });
  const byTitle = (a, b) => collator.compare(a.title, b.title);
  const key = {
    watched: (i) => lastWatch(i) || i.createdAt || '',
    rating: (i) => i.rating ?? -1,
    year: (i) => i.year ?? -1,
  }[state.sort];
  const dir = state.desc ? -1 : 1;
  return items.slice().sort((a, b) => {
    if (!key) return dir * byTitle(a, b);
    const ka = key(a);
    const kb = key(b);
    if (ka < kb) return -dir;
    if (ka > kb) return dir;
    return byTitle(a, b);
  });
}

function grid(items, posters) {
  return h('ul', { class: 'poster-grid' }, items.map((i) => h('li', {},
    h('a', { class: 'poster-card', href: `#/item/${encodeURIComponent(i.id)}` },
      h('span', { class: 'poster-frame' },
        posters.get(i.id)
          ? h('img', { src: posters.get(i.id), alt: '', loading: 'lazy', decoding: 'async' })
          : h('span', { class: 'poster-fallback', text: i.title }),
        i.rating != null && h('span', { class: 'poster-rating', text: `★ ${formatRating(i.rating).replace(' / 5', '')}` }),
        i.type === 'tv' && h('span', { class: 'poster-type', text: t('type.tv') }),
      ),
      h('span', { class: 'poster-title', text: i.title }),
      h('span', { class: 'poster-year', text: i.year ?? '' }),
    ))));
}

function listRows(items, posters) {
  return h('ul', { class: 'results' }, items.map((i) => {
    const last = lastWatch(i);
    return h('li', {},
      h('a', { class: 'result', href: `#/item/${encodeURIComponent(i.id)}` },
        h('span', { class: 'thumb' }, posters.get(i.id)
          ? h('img', { src: posters.get(i.id), alt: '', loading: 'lazy' })
          : h('span', { class: 'thumb-empty' })),
        h('span', { class: 'result-text' },
          h('span', { class: 'result-title', text: i.title }),
          h('span', { class: 'result-meta' },
            h('span', { class: `badge ${i.type}`, text: t(`type.${i.type}`) }),
            i.year && h('span', { text: i.year }),
            i.rating != null && h('span', { class: 'rating-inline', text: `★ ${formatRating(i.rating)}` }),
          ),
          h('span', { class: 'result-sub' },
            last ? t(i.watches.length > 1 ? 'list.watchedTimes' : 'list.watchedOn',
              { date: formatDate(last), n: i.watches.length }) : '',
            i.tags?.length ? ` · ${i.tags.join(', ')}` : ''),
        ),
      ));
  }));
}

function select(options, value, onChange) {
  const el = h('select', { class: 'field' },
    options.map(([v, label]) => h('option', { value: v, text: label })));
  el.value = value;
  el.addEventListener('change', () => onChange(el.value));
  return el;
}

function labeled(label, control) {
  return h('label', { class: 'filter' }, h('span', { text: label }), control);
}

function uniqueSorted(values) {
  const collator = new Intl.Collator(lang(), { sensitivity: 'base' });
  return [...new Set(values)].sort(collator.compare);
}
