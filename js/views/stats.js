// "Stats & Watchlist" tab. Charts are plain HTML/CSS bars (no library).

import { t, lang } from '../i18n.js';
import { getAllItems, markWatched, updateItem } from '../items.js';
import { posterUrls } from '../posters.js';
import { h, segmented, toast } from '../ui.js';
import { formatRating } from '../components.js';

const state = { section: 'watchlist' };

export async function render() {
  const body = h('div');
  const show = async (section) => {
    state.section = section;
    // Reload on every switch: marking a title as watched changes both sections.
    const [items, posters] = await Promise.all([getAllItems(), posterUrls()]);
    const watchlist = items.filter((i) => i.status === 'watchlist')
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    const watched = items.filter((i) => i.status === 'watched');
    const label = document.querySelector('input[name="stats-section"][value="watchlist"] + span');
    if (label) label.textContent = `${t('stats.watchlist')} (${watchlist.length})`;
    body.replaceChildren(section === 'watchlist' ? watchlistSection(watchlist, posters, show) : statsSection(watched));
    return watchlist.length;
  };
  const count = await show(state.section);

  return h('section', { class: 'page' },
    h('h1', { class: 'page-title', text: t('stats.title') }),
    h('div', { class: 'section-switch' }, segmented('stats-section', [
      { value: 'watchlist', label: `${t('stats.watchlist')} (${count})` },
      { value: 'stats', label: t('stats.stats') },
    ], state.section, show)),
    body,
  );
}

// ---------- Watchlist ----------

function watchlistSection(list, posters, rerender) {
  if (!list.length) {
    return h('div', { class: 'empty' },
      h('p', { text: t('stats.watchlistEmpty') }),
      h('a', { class: 'btn primary', href: '#/add', text: t('nav.add') }));
  }
  return h('div', {},
    h('p', { class: 'muted small hint', text: t('stats.checkHint') }),
    h('ul', { class: 'results' }, list.map((item) => watchlistRow(item, posters, rerender))));
}

/** Row with a round checkbox: tick it to mark the title as watched (with undo). */
function watchlistRow(item, posters, rerender) {
  const label = t('stats.markWatchedFor', { title: item.title });
  const check = h('button', {
    type: 'button', class: 'check', role: 'checkbox', 'aria-checked': 'false', 'aria-label': label, title: label,
    html: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M7.5 12.5l3 3 6-6.5"/></svg>',
  });
  const row = h('li', { class: 'row-item' },
    check,
    h('a', { class: 'result', href: `#/item/${encodeURIComponent(item.id)}` },
      h('span', { class: 'thumb' }, posters.get(item.id)
        ? h('img', { src: posters.get(item.id), alt: '', loading: 'lazy' })
        : h('span', { class: 'thumb-empty' })),
      h('span', { class: 'result-text' },
        h('span', { class: 'result-title', text: item.title }),
        h('span', { class: 'result-meta' },
          h('span', { class: `badge ${item.type}`, text: t(`type.${item.type}`) }),
          item.year && h('span', { text: item.year })),
      )),
  );
  check.addEventListener('click', async () => {
    check.disabled = true;
    check.setAttribute('aria-checked', 'true');
    row.classList.add('done'); // tick + fade, then the list re-renders
    const before = { status: item.status, watches: item.watches, seriesStatus: item.seriesStatus };
    await Promise.all([markWatched(item), new Promise((r) => setTimeout(r, 450))]);
    rerender('watchlist');
    toast(t('stats.markedWatched', { title: item.title }), {
      duration: 6000,
      actions: [
        { label: t('stats.undo'), onClick: async () => { await updateItem(item.id, before); rerender('watchlist'); } },
        { label: t('stats.rate'), onClick: () => { location.hash = `#/item/${encodeURIComponent(item.id)}`; } },
      ],
    });
  });
  return row;
}

// ---------- Stats ----------

function statsSection(watched) {
  if (!watched.length) return h('div', { class: 'empty' }, h('p', { text: t('stats.empty') }));

  const movies = watched.filter((i) => i.type === 'movie');
  const shows = watched.filter((i) => i.type === 'tv');
  // Rewatches count: each watch date adds the runtime again.
  const minutes = movies.reduce((sum, m) => sum + (m.runtime || 0) * Math.max(1, m.watches?.length || 0), 0);
  const rated = watched.filter((i) => i.rating != null);
  const avg = rated.length ? rated.reduce((s, i) => s + i.rating, 0) / rated.length : null;
  const views = watched.reduce((n, i) => n + (i.watches?.length || 0), 0);

  const nf = new Intl.NumberFormat(lang());
  const tiles = h('div', { class: 'tiles' },
    tile(nf.format(movies.length), t('stats.movies')),
    tile(nf.format(shows.length), t('stats.shows')),
    tile(`${nf.format(Math.round(minutes / 60))} h`, t('stats.hours')),
    tile(avg == null ? '—' : formatRating(Math.round(avg * 10) / 10), t('stats.avgRating')),
  );

  // Rating distribution: 0.5 → 5.
  const steps = Array.from({ length: 10 }, (_, i) => (i + 1) / 2);
  const ratingBars = steps.map((r) => ({
    label: Number.isInteger(r) ? String(r) : '',
    value: rated.filter((i) => i.rating === r).length,
    title: formatRating(r),
  }));

  // Top genres.
  const genreCounts = countBy(watched.flatMap((i) => i.genres || []));
  const topGenres = [...genreCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  // Views per year (every year between first and last, so gaps show).
  const dates = watched.flatMap((i) => i.watches || []);
  const byYear = countBy(dates.map((d) => d.slice(0, 4)));
  const years = [...byYear.keys()].map(Number);
  const yearBars = [];
  if (years.length) {
    const [first, last] = [Math.min(...years), Math.max(...years)];
    const crowded = last - first + 1 > 8;
    for (let y = first; y <= last; y++) {
      // Many years: label only round years to keep the axis readable.
      yearBars.push({ label: !crowded || y % 5 === 0 ? String(y) : '', value: byYear.get(String(y)) || 0, title: String(y) });
    }
  }

  // Last 12 months.
  const byMonth = countBy(dates.map((d) => d.slice(0, 7)));
  const monthFmt = new Intl.DateTimeFormat(lang(), { month: 'narrow' });
  const monthLong = new Intl.DateTimeFormat(lang(), { month: 'long', year: 'numeric' });
  const now = new Date();
  const monthBars = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return { label: monthFmt.format(d), value: byMonth.get(key) || 0, title: monthLong.format(d) };
  });

  return h('div', { class: 'stats' },
    tiles,
    h('p', { class: 'muted small center', text: t('stats.views', { n: nf.format(views) }) }),
    chartCard(t('stats.ratingDist'), rated.length ? columns(ratingBars) : emptyChart()),
    chartCard(t('stats.topGenres'), topGenres.length ? hbars(topGenres) : emptyChart()),
    chartCard(t('stats.last12'), columns(monthBars)),
    yearBars.length > 1 && chartCard(t('stats.perYear'), columns(yearBars, { thin: yearBars.length > 12 })),
  );
}

function tile(value, label) {
  return h('div', { class: 'tile' }, h('span', { class: 'tile-value', text: value }), h('span', { class: 'tile-label', text: label }));
}

function chartCard(title, chart) {
  return h('section', { class: 'card chart-card' }, h('h2', { text: title }), chart);
}

function emptyChart() {
  return h('p', { class: 'muted small', text: t('stats.noData') });
}

/** Vertical bars. data: [{ label, value, title }]. */
function columns(data, { thin = false } = {}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return h('div', { class: `columns${thin ? ' thin' : ''}`, role: 'list' }, data.map((d) => {
    const bar = h('span', { class: 'col-bar' });
    bar.style.height = `${(d.value / max) * 100}%`;
    return h('div', { class: 'col', role: 'listitem', title: `${d.title} : ${d.value}`, 'aria-label': `${d.title} : ${d.value}` },
      h('span', { class: 'col-value', text: d.value || '' }),
      h('span', { class: 'col-track' }, bar),
      h('span', { class: 'col-label', text: d.label }),
    );
  }));
}

/** Horizontal bars. entries: [[label, value]]. */
function hbars(entries) {
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return h('ul', { class: 'hbars' }, entries.map(([label, value]) => {
    const bar = h('span', { class: 'hbar' });
    bar.style.width = `${(value / max) * 100}%`;
    return h('li', {},
      h('span', { class: 'hbar-label', text: label }),
      h('span', { class: 'hbar-track' }, bar),
      h('span', { class: 'hbar-value', text: value }),
    );
  }));
}

function countBy(values) {
  const m = new Map();
  for (const v of values) m.set(v, (m.get(v) || 0) + 1);
  return m;
}
