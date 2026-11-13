// Reusable form widgets: half-star rating and tag input.

import { h } from './ui.js';
import { t, lang } from './i18n.js';
import { normalizeTag } from './items.js';

const STAR = '<path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.3L12 17.1l-5.7 3.1 1.2-6.3-4.7-4.4 6.4-.8z"/>';
const starsSvg = (cls) => h('span', {
  class: cls, 'aria-hidden': 'true',
  html: Array.from({ length: 5 }, () => `<svg viewBox="0 0 24 24">${STAR}</svg>`).join(''),
});

export function formatRating(value) {
  if (value === null || value === undefined) return '—';
  return (lang() === 'fr' ? String(value).replace('.', ',') : String(value)) + ' / 5';
}

/**
 * Half-star rating (0.5 → 5, or null). Tap/drag on the stars; arrow keys ±0.5;
 * tapping the current value or pressing Delete clears it.
 * Returns { el, get value(), set value(v) }.
 */
export function ratingInput(initial = null, onChange = () => {}) {
  let value = initial;
  const fill = starsSvg('stars-fill');
  const stars = h('div', {
    class: 'stars', role: 'slider', tabindex: '0',
    'aria-label': t('form.rating'), 'aria-valuemin': '0', 'aria-valuemax': '5',
  }, starsSvg('stars-base'), fill);
  const label = h('span', { class: 'rating-value' });
  const clear = h('button', { type: 'button', class: 'btn ghost small', text: t('form.clear') });

  const set = (v, notify = true) => {
    value = v === null ? null : Math.min(5, Math.max(0.5, Math.round(v * 2) / 2));
    // Half-star steps sit exactly on star halves: each star is 20% of the width.
    fill.style.width = `${(value || 0) * 20}%`;
    stars.setAttribute('aria-valuenow', value ?? 0);
    stars.setAttribute('aria-valuetext', formatRating(value));
    label.textContent = formatRating(value);
    clear.hidden = value === null;
    if (notify) onChange(value);
  };

  const valueAt = (clientX) => {
    const r = stars.getBoundingClientRect();
    const ratio = (clientX - r.left) / r.width;
    return Math.min(5, Math.max(0.5, Math.ceil(ratio * 10) / 2));
  };

  let dragging = false;
  let startValue = null;
  stars.addEventListener('pointerdown', (e) => {
    dragging = true;
    startValue = value;
    stars.setPointerCapture(e.pointerId);
    set(valueAt(e.clientX));
  });
  stars.addEventListener('pointermove', (e) => { if (dragging) set(valueAt(e.clientX)); });
  stars.addEventListener('pointerup', (e) => {
    if (!dragging) return;
    dragging = false;
    // A plain tap on the value already selected clears the rating.
    if (startValue !== null && valueAt(e.clientX) === startValue) set(null);
  });
  stars.addEventListener('pointercancel', () => { dragging = false; });
  stars.addEventListener('keydown', (e) => {
    const step = { ArrowRight: 0.5, ArrowUp: 0.5, ArrowLeft: -0.5, ArrowDown: -0.5 }[e.key];
    if (step) { e.preventDefault(); set((value || 0) + step <= 0 ? null : (value || 0) + step); }
    else if (e.key === 'Home') { e.preventDefault(); set(0.5); }
    else if (e.key === 'End') { e.preventDefault(); set(5); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); set(null); }
  });
  clear.addEventListener('click', () => set(null));

  set(initial, false);
  const el = h('div', { class: 'rating' }, stars, label, clear);
  return { el, get value() { return value; }, set value(v) { set(v, false); } };
}

/**
 * Free tags as chips. Enter / comma adds, Backspace on empty input removes the last one.
 * Suggestions come from `known` (existing tags), shown as tappable chips while typing.
 */
export function tagInput(initial = [], known = []) {
  let tags = [...initial];
  const list = h('div', { class: 'chips' });
  const input = h('input', {
    class: 'tag-entry', type: 'text', enterkeyhint: 'done', autocomplete: 'off',
    placeholder: t('form.tagsPlaceholder'), 'aria-label': t('form.tags'),
  });
  const suggestions = h('div', { class: 'chips suggestions' });

  // Tapping a chip must not blur the input first (blur would commit the half-typed text).
  const keepFocus = (e) => e.preventDefault();

  const renderChips = () => {
    list.replaceChildren(...tags.map((tag) => h('button', {
      type: 'button', class: 'chip removable', 'aria-label': `${t('form.removeTag')} ${tag}`,
      onPointerdown: keepFocus,
      onClick: () => { tags = tags.filter((x) => x !== tag); renderChips(); input.focus(); },
    }, tag, h('span', { 'aria-hidden': 'true', text: '×' }))), input);
    renderSuggestions();
  };

  const renderSuggestions = () => {
    const q = input.value.trim().toLowerCase();
    const taken = new Set(tags.map((x) => x.toLowerCase()));
    const matches = known
      .filter((k) => !taken.has(k.toLowerCase()) && (!q || k.toLowerCase().includes(q)))
      .slice(0, 8);
    suggestions.replaceChildren(...matches.map((k) => h('button', {
      type: 'button', class: 'chip suggestion', text: `+ ${k}`,
      onPointerdown: keepFocus,
      onClick: () => { add(k); input.focus(); },
    })));
    suggestions.hidden = !matches.length;
  };

  const add = (raw) => {
    const tag = normalizeTag(raw, known);
    if (tag && !tags.some((x) => x.toLowerCase() === tag.toLowerCase())) tags.push(tag);
    input.value = '';
    renderChips();
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (input.value.trim()) add(input.value);
    } else if (e.key === 'Backspace' && !input.value && tags.length) {
      tags.pop();
      renderChips();
    }
  });
  // Android keyboards often don't send a usable keydown for ",": catch it on input too.
  input.addEventListener('input', () => {
    if (input.value.includes(',')) input.value.split(',').forEach((p) => p.trim() && add(p));
    else renderSuggestions();
  });
  // Commit a half-typed tag when leaving the field.
  input.addEventListener('blur', () => { if (input.value.trim()) add(input.value); });

  const box = h('div', { class: 'tag-box', onClick: (e) => { if (e.target === e.currentTarget) input.focus(); } }, list);
  renderChips();
  const el = h('div', { class: 'tags-field' }, box, suggestions);
  return {
    el,
    get value() {
      if (input.value.trim()) add(input.value);
      return [...tags];
    },
  };
}
