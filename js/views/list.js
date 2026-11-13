import { t } from '../i18n.js';
import { h } from '../ui.js';

export function render() {
  return h('section', { class: 'page' },
    h('h1', { class: 'page-title', text: t('list.title') }),
    h('div', { class: 'empty' }, h('p', { text: t('list.empty') })),
  );
}
