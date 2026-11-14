// "Add" tab: TMDB search with debounced autocompletion. #/add/{type}/{id} opens the detail sheet.

import { t, tmdbLang, errorText } from '../i18n.js';
import { getSetting } from '../settings.js';
import { searchMulti, posterUrl } from '../tmdb.js';
import { itemIds } from '../items.js';
import { h } from '../ui.js';
import * as detail from './detail.js';

const DEBOUNCE_MS = 300;
const MIN_CHARS = 2;

// Kept across renders so coming back from a detail sheet restores the search.
const state = { query: '', results: null, lang: null };

/** Prefills the search (e.g. from a shared text that isn't a TMDB/IMDb link). */
export function setSearchQuery(query) {
  Object.assign(state, { query, results: null, lang: null });
}

export function render(ctx) {
  if (ctx.params.length >= 2) return detail.render(ctx);
  if (!getSetting('tmdbKey')) {
    return h('section', { class: 'page' },
      h('h1', { class: 'page-title', text: t('add.title') }),
      h('div', { class: 'empty' },
        h('p', { text: t('add.needKey') }),
        h('a', { class: 'btn primary', href: '#/settings', text: t('add.goSettings') }),
      ),
    );
  }

  const input = h('input', {
    class: 'field search', type: 'search', enterkeyhint: 'search', autocomplete: 'off',
    placeholder: t('add.searchPlaceholder'), 'aria-label': t('add.searchPlaceholder'),
  });
  input.value = state.query;
  const results = h('ul', { class: 'results', 'aria-live': 'polite' });
  const message = h('p', { class: 'muted center search-msg' });

  let timer = null;
  let controller = null;
  let known = new Set();
  itemIds().then((ids) => { known = ids; if (state.results) showResults(state.results); });

  const showMessage = (text) => {
    message.textContent = text;
    message.hidden = !text;
  };

  const showResults = (list) => {
    results.replaceChildren(...list.map((r) => resultRow(r, known.has(`${r.type}:${r.tmdbId}`))));
    showMessage(list.length ? '' : t('add.noResults'));
  };

  const search = async (query) => {
    controller?.abort();
    if (query.length < MIN_CHARS) {
      state.results = null;
      results.replaceChildren();
      showMessage(query ? '' : t('add.hint'));
      return;
    }
    controller = new AbortController();
    const signal = controller.signal;
    results.classList.add('loading');
    try {
      const list = await searchMulti(query, { language: tmdbLang(), signal });
      Object.assign(state, { results: list, lang: tmdbLang() });
      showResults(list);
    } catch (err) {
      if (err.name === 'AbortError') return;
      results.replaceChildren();
      showMessage(errorText(err));
    } finally {
      if (!signal.aborted) results.classList.remove('loading');
    }
  };

  input.addEventListener('input', () => {
    state.query = input.value;
    clearTimeout(timer);
    timer = setTimeout(() => search(input.value.trim()), DEBOUNCE_MS);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { clearTimeout(timer); search(input.value.trim()); input.blur(); }
  });

  // Restore the previous search; refetch only if the UI language changed meanwhile.
  if (state.results && state.lang === tmdbLang()) showResults(state.results);
  else search(state.query.trim());

  const page = h('section', { class: 'page' },
    h('h1', { class: 'page-title', text: t('add.title') }),
    input, message, results,
  );
  // Focus once the view is attached (opens the keyboard: that's why you came here).
  // Not when pre-rendered beside the current tab during a swipe (it would pop the keyboard).
  requestAnimationFrame(() => { if (!state.query && page.closest('#view')) input.focus(); });
  return page;
}

function resultRow(r, inList) {
  const thumb = r.posterPath
    ? h('img', { src: posterUrl(r.posterPath, 'w92'), crossorigin: 'anonymous', alt: '', loading: 'lazy', width: 46, height: 69 })
    : h('span', { class: 'thumb-empty', 'aria-hidden': 'true' });
  const showOriginal = r.originalTitle && r.originalTitle !== r.title;
  return h('li', {},
    h('a', { class: 'result', href: `#/add/${r.type}/${r.tmdbId}` },
      h('span', { class: 'thumb' }, thumb),
      h('span', { class: 'result-text' },
        h('span', { class: 'result-title', text: r.title }),
        showOriginal && h('span', { class: 'result-sub', text: r.originalTitle }),
        h('span', { class: 'result-meta' },
          h('span', { class: `badge ${r.type}`, text: t(`type.${r.type}`) }),
          r.year && h('span', { text: r.year }),
          inList && h('span', { class: 'badge inlist', text: t('add.inList') }),
        ),
      ),
    ),
  );
}
