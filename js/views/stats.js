// "Stats" tab. Charts are plain HTML/CSS bars (no library).

import { t, lang } from '../i18n.js';
import { getAllItems } from '../items.js';
import { h } from '../ui.js';
import { formatRating } from '../components.js';

export async function render() {
  const watched = (await getAllItems()).filter((i) => i.status === 'watched');
  return h('section', { class: 'page' },
    h('h1', { class: 'page-title', text: t('stats.title') }),
    statsSection(watched),
  );
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
