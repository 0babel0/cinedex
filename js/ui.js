// Small DOM helpers shared by views.

/**
 * Creates an element. attrs: plain attributes, plus
 *   class, text, html (trusted strings only), on{Event} handlers, dataset object.
 * Children: nodes, strings, or falsy (skipped).
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  return append(el, ...children);
}

/** Appends children like h() does: arrays flattened, null/undefined/false skipped. */
export function append(parent, ...children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    parent.append(c instanceof Node ? c : String(c));
  }
  return parent;
}

/** Shows a transient message. action: { label, onClick } (optional). */
export function toast(message, { action, duration = 3500 } = {}) {
  const host = document.getElementById('toasts');
  const el = h('div', { class: 'toast', role: 'status' }, h('span', { text: message }));
  if (action) {
    el.append(h('button', {
      class: 'toast-action', type: 'button', text: action.label,
      onClick: () => { action.onClick(); el.remove(); },
    }));
  }
  host.append(el);
  if (duration) setTimeout(() => el.classList.add('out'), duration);
  el.addEventListener('transitionend', () => el.classList.contains('out') && el.remove());
  return el;
}

/** Segmented control (radio group). options: [{ value, label }]. */
export function segmented(name, options, current, onChange) {
  return h('div', { class: 'segmented', role: 'radiogroup' },
    options.map((o) => h('label', {},
      h('input', {
        type: 'radio', name, value: o.value, checked: o.value === current,
        onChange: () => onChange(o.value),
      }),
      h('span', { text: o.label }),
    )));
}

export function formatBytes(n) {
  if (!Number.isFinite(n)) return '?';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
}

/** True when running as an installed app (home screen / app drawer), not in a browser tab. */
export function isStandalone() {
  return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

/** Modal confirmation built on <dialog>. Resolves to true when confirmed. */
export function confirmDialog(message, { confirmLabel = 'OK', cancelLabel = 'Cancel', danger = false } = {}) {
  return new Promise((resolve) => {
    const dialog = h('dialog', { class: 'dialog' },
      h('form', { method: 'dialog' },
        h('p', { text: message }),
        h('div', { class: 'row end' },
          h('button', { class: 'btn ghost', value: 'cancel', text: cancelLabel }),
          h('button', { class: `btn ${danger ? 'danger' : 'primary'}`, value: 'ok', text: confirmLabel }),
        ),
      ));
    dialog.addEventListener('close', () => {
      resolve(dialog.returnValue === 'ok');
      dialog.remove();
    });
    document.body.append(dialog);
    dialog.showModal();
  });
}
