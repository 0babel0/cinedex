import { t, LANGS } from '../i18n.js';
import { getSetting, setSetting } from '../settings.js';
import { keyType, testKey } from '../tmdb.js';
import { h, segmented, toast, formatBytes, isStandalone } from '../ui.js';
import { APP_VERSION } from '../version.js';

export function render({ back = 'add' } = {}) {
  return h('section', { class: 'page settings' },
    h('div', { class: 'page-head' },
      h('a', { class: 'icon-btn', href: `#/${back}`, 'aria-label': t('nav.back'), title: t('nav.back'),
        html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>' }),
      h('h1', { class: 'page-title', text: t('settings.title') }),
    ),
    keySection(),
    h('section', { class: 'card' },
      h('h2', { text: t('settings.language') }),
      segmented('lang', LANGS.map((l) => ({ value: l, label: l === 'fr' ? 'Français' : 'English' })),
        getSetting('lang'), (v) => setSetting('lang', v)),
      h('h2', { text: t('settings.theme') }),
      segmented('theme', [
        { value: 'auto', label: t('settings.themeAuto') },
        { value: 'light', label: t('settings.themeLight') },
        { value: 'dark', label: t('settings.themeDark') },
      ], getSetting('theme'), (v) => setSetting('theme', v)),
    ),
    storageSection(),
    aboutSection(),
  );
}

function keySection() {
  const input = h('input', {
    class: 'field mono', type: 'password', id: 'tmdb-key', autocomplete: 'off',
    autocapitalize: 'off', spellcheck: 'false', placeholder: t('settings.keyPlaceholder'),
  });
  input.value = getSetting('tmdbKey');

  const toggle = h('button', { type: 'button', class: 'btn ghost small', text: t('settings.show') });
  toggle.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    toggle.textContent = show ? t('settings.hide') : t('settings.show');
  });

  const status = h('p', { class: 'status', role: 'status' });
  const setStatus = (text, kind = '') => { status.textContent = text; status.dataset.kind = kind; };
  const current = getSetting('tmdbKey');
  setStatus(current ? t('settings.keyStored', { type: keyType(current) || '?' }) : t('settings.keyNone'));

  const save = h('button', { type: 'submit', class: 'btn primary', text: t('settings.saveTest') });
  const remove = h('button', { type: 'button', class: 'btn ghost', text: t('settings.remove') });
  remove.hidden = !current;

  remove.addEventListener('click', async () => {
    await setSetting('tmdbKey', '');
    input.value = '';
    remove.hidden = true;
    setStatus(t('settings.keyRemoved'));
  });

  const form = h('form', { class: 'key-form', onSubmit: async (e) => {
    e.preventDefault();
    const key = input.value.trim();
    if (!key) return remove.click();
    const type = keyType(key);
    if (!type) return setStatus(t('settings.keyFormat'), 'error');

    save.disabled = true;
    setStatus(t('settings.testing'));
    try {
      await testKey(key);
      await setSetting('tmdbKey', key);
      setStatus(t('settings.keyOk', { type }), 'ok');
      toast(t('settings.keyOk', { type }));
    } catch (err) {
      if (err.kind === 'offline') {
        await setSetting('tmdbKey', key);
        setStatus(t('settings.keySavedOffline'), 'warn');
      } else if (err.kind === 'badkey') {
        setStatus(t('settings.keyBad'), 'error');
      } else {
        setStatus(t('settings.keyHttp', { status: err.status ?? '?' }), 'error');
      }
    } finally {
      save.disabled = false;
      remove.hidden = !getSetting('tmdbKey');
    }
  } },
    h('label', { class: 'sr-only', for: 'tmdb-key', text: t('settings.tmdb') }),
    h('div', { class: 'row' }, input, toggle),
    h('div', { class: 'row' }, save, remove),
    status,
  );

  return h('section', { class: 'card' },
    h('h2', { text: t('settings.tmdb') }),
    h('p', { class: 'muted', text: t('settings.tmdbHelp') }),
    form,
    h('details', { class: 'guide' },
      h('summary', { text: t('settings.guideTitle') }),
      h('ol', {}, ['guide1', 'guide2', 'guide3', 'guide4'].map((k) => h('li', { text: t(`settings.${k}`) }))),
      h('a', {
        href: 'https://www.themoviedb.org/settings/api', target: '_blank', rel: 'noopener noreferrer',
        text: t('settings.guideLink'),
      }),
    ),
  );
}

function storageSection() {
  const mode = h('p', { class: 'small', text: t(isStandalone() ? 'settings.modeApp' : 'settings.modeBrowser') });
  const text = h('p', { class: 'muted', text: t('settings.storageUnknown') });
  const usage = h('p', { class: 'muted small' });
  const ask = h('button', { type: 'button', class: 'btn small', text: t('settings.persistAsk'), hidden: true });

  const show = (persisted) => {
    text.textContent = persisted ? t('settings.persisted') : t('settings.notPersisted');
    ask.hidden = persisted || !navigator.storage?.persist;
  };
  ask.addEventListener('click', async () => {
    ask.disabled = true;
    const granted = await navigator.storage.persist().catch(() => false);
    show(granted);
    if (!granted) toast(t('settings.persistDenied'), { duration: 6000 });
    ask.disabled = false;
  });

  if (navigator.storage?.persisted) navigator.storage.persisted().then(show);
  if (navigator.storage?.estimate) {
    navigator.storage.estimate().then(({ usage: u }) => {
      usage.textContent = t('settings.usage', { used: formatBytes(u) });
    });
  }
  return h('section', { class: 'card' }, h('h2', { text: t('settings.storage') }), mode, text, ask, usage);
}

function aboutSection() {
  return h('section', { class: 'card about' },
    h('h2', { text: t('settings.about') }),
    h('p', { class: 'muted', text: t('settings.aboutText') }),
    h('a', { class: 'tmdb-logo', href: 'https://www.themoviedb.org/', target: '_blank', rel: 'noopener noreferrer' },
      h('img', { src: 'assets/tmdb.svg', alt: 'TMDB', width: 160, height: 21 })),
    h('p', { class: 'small', text: 'This product uses the TMDB API but is not endorsed or certified by TMDB.' }),
    h('p', { class: 'muted small', text: t('settings.version', { v: APP_VERSION }) }),
  );
}
