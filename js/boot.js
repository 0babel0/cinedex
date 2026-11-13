// Runs synchronously in <head>, before first paint.
// Theme and language are mirrored to localStorage so the right theme shows instantly;
// IndexedDB remains the source of truth (see settings.js).
(function () {
  var theme = 'dark';
  var lang = 'fr';
  try {
    theme = localStorage.getItem('cinedex.theme') || theme;
    lang = localStorage.getItem('cinedex.lang') || lang;
  } catch (e) { /* storage blocked: keep defaults */ }
  document.documentElement.dataset.theme = theme;
  document.documentElement.lang = lang;
})();
