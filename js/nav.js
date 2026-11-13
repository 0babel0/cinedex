// In-app history: lets "back" buttons go back in history when there is somewhere to go back to
// (e.g. title → person → title), and fall back to a tab when the page was opened directly
// (shared link, app launch).

import { h } from './ui.js';
import { t } from './i18n.js';

let lastIdx = -1;

/** Called on every route render: numbers history entries through history.state. */
export function trackHistory() {
  let idx = history.state?.idx;
  if (typeof idx !== 'number') {
    idx = lastIdx + 1;
    history.replaceState({ ...history.state, idx }, '');
  }
  lastIdx = idx;
}

export function canGoBack() {
  return (history.state?.idx ?? 0) > 0;
}

export function goBack(fallbackHash) {
  if (canGoBack()) history.back();
  else location.replace(fallbackHash);
}

const BACK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';

export function backLink(fallbackHash) {
  return h('a', {
    class: 'icon-btn', href: fallbackHash, 'aria-label': t('nav.back'), title: t('nav.back'), html: BACK_ICON,
    onClick: (e) => { e.preventDefault(); goBack(fallbackHash); },
  });
}
