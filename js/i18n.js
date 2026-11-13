// UI strings (FR default, EN). Keys are flat "section.name" strings.
// Static markup uses data-i18n (textContent) and data-i18n-aria (aria-label + title).

import { getSetting } from './settings.js';

const STRINGS = {
  fr: {
    'app.offline': 'Hors ligne',
    'app.updateReady': 'Nouvelle version disponible.',
    'app.reload': 'Recharger',
    'app.dbError': 'Stockage local indisponible. Navigation privée ?',

    'nav.add': 'Ajouter',
    'nav.list': 'Ma liste',
    'nav.stats': 'Stats',
    'nav.settings': 'Paramètres',
    'nav.back': 'Retour',

    'add.title': 'Ajouter',
    'add.needKey': 'Pour rechercher des films et séries, ajoute d’abord ta clé TMDB.',
    'add.goSettings': 'Configurer la clé',
    'add.searchPlaceholder': 'Rechercher un film, une série…',
    'add.hint': 'Tape au moins 2 lettres : titre français ou original.',
    'add.noResults': 'Aucun film ni série trouvé.',
    'add.inList': 'Dans ta liste',

    'type.movie': 'Film',
    'type.tv': 'Série',

    'detail.director': 'Réalisation :',
    'detail.creators': 'Création :',
    'detail.cast': 'Avec :',
    'detail.noOverview': 'Pas de synopsis disponible.',
    'detail.season': '{n} saison',
    'detail.seasons': '{n} saisons',
    'detail.watched': 'Vu',
    'detail.watchlist': 'À voir',
    'detail.retry': 'Réessayer',
    'detail.alreadyWatched': 'Déjà dans ta liste : vu {n} fois, dernière fois le {date}. « Vu » ajoute un revisionnage.',
    'detail.alreadyWatchlist': 'Déjà dans ta liste « À voir ».',
    'detail.savedWatched': '« {title} » ajouté à ta liste.',
    'detail.savedWatchlist': '« {title} » ajouté à « À voir ».',
    'detail.updated': '« {title} » mis à jour.',
    'detail.saveError': 'Échec de l’enregistrement.',

    'form.yourTake': 'Ton avis',
    'form.rating': 'Note',
    'form.clear': 'Effacer',
    'form.watchDate': 'Vu le',
    'form.rewatchDate': 'Revu le',
    'form.notes': 'Notes',
    'form.notesPlaceholder': 'Ce que tu en as pensé, avec qui, où…',
    'form.tags': 'Tags',
    'form.tagsPlaceholder': 'Ajouter un tag…',
    'form.removeTag': 'Retirer',
    'form.seriesStatus': 'Statut',
    'form.lastSeason': 'Dernière saison vue',
    'form.ofSeasons': 'sur {n}',

    'series.watching': 'En cours',
    'series.finished': 'Terminée',
    'series.dropped': 'Abandonnée',

    'err.offline': 'Pas de connexion. La recherche nécessite le réseau.',
    'err.badkey': 'Clé TMDB refusée. Vérifie-la dans les paramètres.',
    'err.notfound': 'Introuvable sur TMDB.',
    'err.http': 'Erreur TMDB ({status}). Réessaie plus tard.',

    'list.title': 'Ma liste',
    'list.empty': 'Rien ici pour l’instant. Ajoute ton premier film !',

    'stats.title': 'Stats & À voir',
    'stats.empty': 'Les statistiques apparaîtront après tes premiers ajouts.',

    'settings.title': 'Paramètres',
    'settings.tmdb': 'Clé TMDB',
    'settings.tmdbHelp': 'Colle ta clé API (v3) ou ton jeton d’accès en lecture (v4). Elle reste sur cet appareil.',
    'settings.keyPlaceholder': 'Clé API ou jeton d’accès',
    'settings.show': 'Afficher',
    'settings.hide': 'Masquer',
    'settings.saveTest': 'Enregistrer et tester',
    'settings.remove': 'Supprimer',
    'settings.testing': 'Vérification…',
    'settings.keyOk': 'Clé valide ({type}).',
    'settings.keySavedOffline': 'Clé enregistrée, mais impossible de la vérifier hors ligne.',
    'settings.keyBad': 'Clé refusée par TMDB.',
    'settings.keyFormat': 'Format non reconnu : attendu 32 caractères hexadécimaux (v3) ou un jeton commençant par « eyJ » (v4).',
    'settings.keyHttp': 'Erreur TMDB ({status}). Réessaie plus tard.',
    'settings.keyRemoved': 'Clé supprimée.',
    'settings.keyStored': 'Clé enregistrée ({type}).',
    'settings.keyNone': 'Aucune clé enregistrée.',
    'settings.guideTitle': 'Comment obtenir une clé ?',
    'settings.guide1': 'Crée un compte gratuit sur themoviedb.org.',
    'settings.guide2': 'Ouvre Paramètres du compte → API, puis demande une clé (usage « Developer », personnel).',
    'settings.guide3': 'Copie le « Jeton d’accès en lecture à l’API » (recommandé) ou la « Clé d’API ».',
    'settings.guide4': 'Colle-le ici puis « Enregistrer et tester ».',
    'settings.guideLink': 'Ouvrir la page API de TMDB',
    'settings.language': 'Langue',
    'settings.theme': 'Thème',
    'settings.themeAuto': 'Auto',
    'settings.themeLight': 'Clair',
    'settings.themeDark': 'Sombre',
    'settings.storage': 'Stockage',
    'settings.persisted': 'Stockage persistant accordé : le navigateur ne supprimera pas tes données.',
    'settings.notPersisted': 'Stockage non persistant : le navigateur pourrait effacer les données si l’espace manque. Installer l’app aide souvent.',
    'settings.storageUnknown': 'Statut du stockage inconnu sur ce navigateur.',
    'settings.usage': '{used} utilisés',
    'settings.about': 'À propos',
    'settings.aboutText': 'Cinedex est un carnet de films et séries privé : tout reste sur ton appareil. Aucun compte, aucun traceur.',
    'settings.version': 'Version {v}',
  },
  en: {
    'app.offline': 'Offline',
    'app.updateReady': 'A new version is available.',
    'app.reload': 'Reload',
    'app.dbError': 'Local storage unavailable. Private browsing?',

    'nav.add': 'Add',
    'nav.list': 'My list',
    'nav.stats': 'Stats',
    'nav.settings': 'Settings',
    'nav.back': 'Back',

    'add.title': 'Add',
    'add.needKey': 'To search movies and TV shows, first add your TMDB key.',
    'add.goSettings': 'Set up key',
    'add.searchPlaceholder': 'Search a movie, a TV show…',
    'add.hint': 'Type at least 2 letters: local or original title.',
    'add.noResults': 'No movie or TV show found.',
    'add.inList': 'In your list',

    'type.movie': 'Movie',
    'type.tv': 'TV show',

    'detail.director': 'Directed by',
    'detail.creators': 'Created by',
    'detail.cast': 'Starring',
    'detail.noOverview': 'No synopsis available.',
    'detail.season': '{n} season',
    'detail.seasons': '{n} seasons',
    'detail.watched': 'Watched',
    'detail.watchlist': 'Watchlist',
    'detail.retry': 'Retry',
    'detail.alreadyWatched': 'Already in your list: watched {n}×, last on {date}. “Watched” adds a rewatch.',
    'detail.alreadyWatchlist': 'Already in your watchlist.',
    'detail.savedWatched': '“{title}” added to your list.',
    'detail.savedWatchlist': '“{title}” added to your watchlist.',
    'detail.updated': '“{title}” updated.',
    'detail.saveError': 'Saving failed.',

    'form.yourTake': 'Your take',
    'form.rating': 'Rating',
    'form.clear': 'Clear',
    'form.watchDate': 'Watched on',
    'form.rewatchDate': 'Rewatched on',
    'form.notes': 'Notes',
    'form.notesPlaceholder': 'What you thought, who with, where…',
    'form.tags': 'Tags',
    'form.tagsPlaceholder': 'Add a tag…',
    'form.removeTag': 'Remove',
    'form.seriesStatus': 'Status',
    'form.lastSeason': 'Last season watched',
    'form.ofSeasons': 'of {n}',

    'series.watching': 'Watching',
    'series.finished': 'Finished',
    'series.dropped': 'Dropped',

    'err.offline': 'No connection. Search needs the network.',
    'err.badkey': 'TMDB key rejected. Check it in settings.',
    'err.notfound': 'Not found on TMDB.',
    'err.http': 'TMDB error ({status}). Try again later.',

    'list.title': 'My list',
    'list.empty': 'Nothing here yet. Add your first movie!',

    'stats.title': 'Stats & Watchlist',
    'stats.empty': 'Stats will show up after your first entries.',

    'settings.title': 'Settings',
    'settings.tmdb': 'TMDB key',
    'settings.tmdbHelp': 'Paste your API key (v3) or your API Read Access Token (v4). It stays on this device.',
    'settings.keyPlaceholder': 'API key or access token',
    'settings.show': 'Show',
    'settings.hide': 'Hide',
    'settings.saveTest': 'Save & test',
    'settings.remove': 'Remove',
    'settings.testing': 'Checking…',
    'settings.keyOk': 'Valid key ({type}).',
    'settings.keySavedOffline': 'Key saved, but it can’t be checked while offline.',
    'settings.keyBad': 'Key rejected by TMDB.',
    'settings.keyFormat': 'Unrecognized format: expected 32 hex characters (v3) or a token starting with “eyJ” (v4).',
    'settings.keyHttp': 'TMDB error ({status}). Try again later.',
    'settings.keyRemoved': 'Key removed.',
    'settings.keyStored': 'Key saved ({type}).',
    'settings.keyNone': 'No key saved.',
    'settings.guideTitle': 'How do I get a key?',
    'settings.guide1': 'Create a free account on themoviedb.org.',
    'settings.guide2': 'Open Account settings → API and request a key (“Developer”, personal use).',
    'settings.guide3': 'Copy the “API Read Access Token” (recommended) or the “API Key”.',
    'settings.guide4': 'Paste it here, then “Save & test”.',
    'settings.guideLink': 'Open TMDB API page',
    'settings.language': 'Language',
    'settings.theme': 'Theme',
    'settings.themeAuto': 'Auto',
    'settings.themeLight': 'Light',
    'settings.themeDark': 'Dark',
    'settings.storage': 'Storage',
    'settings.persisted': 'Persistent storage granted: the browser won’t evict your data.',
    'settings.notPersisted': 'Storage not persistent: the browser may clear data when space runs low. Installing the app often helps.',
    'settings.storageUnknown': 'Storage status unknown on this browser.',
    'settings.usage': '{used} used',
    'settings.about': 'About',
    'settings.aboutText': 'Cinedex is a private movie & TV diary: everything stays on your device. No account, no trackers.',
    'settings.version': 'Version {v}',
  },
};

export const LANGS = ['fr', 'en'];

export function lang() {
  return LANGS.includes(getSetting('lang')) ? getSetting('lang') : 'fr';
}

/** TMDB language code for the current UI language. */
export function tmdbLang() {
  return lang() === 'en' ? 'en-US' : 'fr-FR';
}

export function t(key, params) {
  let s = STRINGS[lang()][key] ?? STRINGS.fr[key] ?? key;
  if (params) s = s.replace(/\{(\w+)\}/g, (_, p) => params[p] ?? '');
  return s;
}

/** Fills data-i18n / data-i18n-aria / data-i18n-placeholder attributes under root. */
export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    const s = t(el.dataset.i18nAria);
    el.setAttribute('aria-label', s);
    el.title = s;
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.documentElement.lang = lang();
}

/** User-facing message for a TmdbError. */
export function errorText(err) {
  switch (err?.kind) {
    case 'offline': return t('err.offline');
    case 'badkey': return t('err.badkey');
    case 'nokey': return t('add.needKey');
    case 'notfound': return t('err.notfound');
    default: return t('err.http', { status: err?.status ?? '?' });
  }
}
