// "Watchlist" tab: titles to watch, as a checklist (tick = watched, with undo).

import { t } from '../i18n.js';
import { getAllItems, markWatched, updateItem } from '../items.js';
import { posterUrls } from '../posters.js';
import { h, toast } from '../ui.js';

export async function render() {
  const page = h('section', { class: 'page' }, h('h1', { class: 'page-title', text: t('nav.watchlist') }));
  const body = h('div');
  const show = async () => {
    const [items, posters] = await Promise.all([getAllItems(), posterUrls()]);
    const list = items.filter((i) => i.status === 'watchlist')
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    body.replaceChildren(watchlistSection(list, posters, show));
  };
  await show();
  page.append(body);
  return page;
}

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
    rerender();
    toast(t('stats.markedWatched', { title: item.title }), {
      duration: 6000,
      actions: [
        { label: t('stats.undo'), onClick: async () => { await updateItem(item.id, before); rerender(); } },
        { label: t('stats.rate'), onClick: () => { location.hash = `#/item/${encodeURIComponent(item.id)}`; } },
      ],
    });
  });
  return row;
}
