import { t } from '../i18n.js';
import { getSetting } from '../settings.js';
import { h } from '../ui.js';

export function render() {
  const hasKey = Boolean(getSetting('tmdbKey'));
  return h('section', { class: 'page' },
    h('h1', { class: 'page-title', text: t('add.title') }),
    hasKey
      ? [
          h('input', {
            class: 'field search', type: 'search', disabled: true,
            placeholder: t('add.searchPlaceholder'), 'aria-label': t('add.searchPlaceholder'),
          }),
          h('p', { class: 'muted center', text: t('add.soon') }),
        ]
      : h('div', { class: 'empty' },
          h('p', { text: t('add.needKey') }),
          h('a', { class: 'btn primary', href: '#/settings', text: t('add.goSettings') }),
        ),
  );
}
