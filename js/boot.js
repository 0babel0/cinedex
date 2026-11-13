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
  // The splash is for cold starts only: sessionStorage survives reloads, not a fresh launch.
  try {
    if (sessionStorage.getItem('cinedex.started')) document.documentElement.classList.add('no-splash');
    sessionStorage.setItem('cinedex.started', '1');
  } catch (e) { /* storage blocked: splash every time */ }
  document.documentElement.dataset.theme = theme;
  document.documentElement.lang = lang;
})();
