# Cinedex — contexte projet

## Objectif
Petite PWA pour archiver les films et séries que j'ai vus. Partagée à des amis via GitHub :
ils ouvrent l'URL GitHub Pages, installent la PWA, collent leur propre clé TMDB, c'est tout.
Philosophie : petit utilitaire, très agréable à utiliser, privacy-first, pas overkill.

## Contraintes techniques (non négociables)
- **Pas de backend.** Site 100 % statique, déployé sur GitHub Pages (workflow GitHub Actions).
- **Local-first** : toutes les données dans IndexedDB sur l'appareil. Appeler
  `navigator.storage.persist()` au premier lancement.
- **Zéro tracker, zéro CDN tiers** : pas de Google Fonts, pas d'analytics, pas de lib chargée
  depuis un CDN. Polices système ou police auto-hébergée dans le repo.
- **Dépendances minimales.** Vanilla JS (ES modules) de préférence, sans étape de build.
  Si un outil de build se justifie vraiment, Vite uniquement, et me demander avant.
- Les seules requêtes réseau sortantes : API TMDB (`api.themoviedb.org`) et images
  (`image.tmdb.org`), directement depuis l'appareil.
- **Clé TMDB** : saisie par l'utilisateur dans les paramètres (accepter la clé v3 `api_key`
  ET le jeton v4 « Read Access Token » en Bearer). Jamais de clé dans le repo.
- PWA installable : `manifest.webmanifest` (display `standalone`, icônes 192/512 + maskable),
  service worker avec cache de l'app shell → l'app fonctionne hors ligne (consultation ;
  seul l'ajout nécessite le réseau).
- Mobile-first (usage principal sur téléphone Android), mais propre sur desktop.
- Repo, code et commentaires en anglais. UI bilingue FR/EN (paramètre), FR par défaut.

## Fonctionnalités
### Onglet 1 — Ajouter
- Recherche avec autocomplétion (debounce), endpoint `search/multi` (films + séries, ignorer les personnes).
- Fiche détaillée : affiche, titre localisé + titre original, année, durée / nb de saisons,
  genres, réalisateur (film) ou créateurs (série), 5–8 acteurs principaux, synopsis.
  Utiliser `append_to_response=credits` pour limiter les requêtes.
- Langue via `language=fr-FR` / `en-US` selon le paramètre. **Repli** : si le synopsis
  localisé est vide, refaire la requête en `en-US` pour le synopsis uniquement.
- Saisie utilisateur : note sur 5 par **demi-points** (0.5 → 5), notes libres (textarea),
  tags libres (avec autocomplétion des tags existants), date de visionnage (défaut : aujourd'hui).
- Deux boutons : « Vu » ou « À voir » (watchlist).
- Séries, version légère : statut (en cours / terminée / abandonnée) + dernière saison vue.
  PAS de suivi épisode par épisode.

### Onglet 2 — Ma liste
- Vue grille d'affiches + vue liste (toggle mémorisé).
- Recherche texte (titre local + original + notes), tri (date de visionnage, note, titre,
  année de sortie), filtres (film/série, genre, tag, note min).
- Ouvrir une fiche → éditer note, notes, tags, **ajouter un revisionnage** (plusieurs dates),
  supprimer (avec confirmation).

### Onglet 3 — Stats & À voir
- Watchlist : liste des « À voir », bouton pour basculer en « Vu ».
- Stats sobres : nb films / séries vus, heures cumulées (films), note moyenne, distribution
  des notes, top genres, visionnages par année/mois. Graphiques en SVG maison ou CSS, pas de lib.

### Paramètres (icône engrenage, pas un onglet)
- Clé TMDB (avec mini-guide pour l'obtenir), langue FR/EN, thème (auto/clair/sombre).
- **Export** : JSON complet + CSV simplifié. Utiliser Web Share API (`navigator.share` avec
  fichiers) quand dispo pour envoyer directement vers Drive/Nextcloud/mail, sinon téléchargement.
- **Import** JSON (fusion : par `id`, la version avec le `updatedAt` le plus récent gagne).
  Les affiches ne sont pas dans l'export : les retélécharger à l'import.
- Rappel discret « Dernier export il y a N jours » si N > 30.

### Share target (Android)
- Déclarer `share_target` dans le manifest : partager un lien TMDB ou IMDb vers Cinedex
  ouvre directement la fiche d'ajout (IMDb → `find/{imdb_id}?external_source=imdb_id`).

## Affiches
- Télécharger en `w342` lors de l'ajout, stocker en Blob dans IndexedDB. L'affichage de la
  liste ne fait AUCUNE requête réseau.

## Modèle de données (export JSON)
```json
{
  "app": "cinedex",
  "schemaVersion": 1,
  "exportedAt": "ISO-8601",
  "items": [{
    "id": "movie:603",
    "tmdbId": 603, "type": "movie | tv", "imdbId": "tt0133093",
    "title": "Matrix", "originalTitle": "The Matrix", "year": 1999,
    "runtime": 136, "seasons": null,
    "genres": ["Action", "Science-Fiction"],
    "directors": ["Lana Wachowski", "Lilly Wachowski"],
    "cast": ["Keanu Reeves", "Laurence Fishburne"],
    "overview": "…", "posterPath": "/abc.jpg", "metaLang": "fr-FR",
    "status": "watched | watchlist",
    "rating": 4.5, "notes": "…", "tags": ["ciné"],
    "watches": ["2026-11-13"],
    "seriesStatus": null, "lastSeason": null,
    "createdAt": "ISO-8601", "updatedAt": "ISO-8601"
  }]
}
```
Garder ce format stable, lisible (indentation 2) et versionné.

## Design & identité
- Nom : **Cinedex**. Créer un logo SVG simple et sympa (idée : bobine ou cadre de pellicule
  stylisé formant un « C », ou ticket de ciné), décliné en icônes PWA (dont maskable) et favicon.
- **Splash au démarrage** (cold start uniquement) : logo + « Cinedex » en gros au centre,
  fade-in, puis glisse et disparaît vers la gauche. Durée totale ≈ 1–1,2 s, jamais bloquant
  (l'app charge derrière). Respecter `prefers-reduced-motion` (simple fondu court).
- UI soignée, sombre par défaut ambiance ciné, transitions discrètes, cibles tactiles ≥ 44 px,
  barre d'onglets en bas.

## Obligations TMDB
- Logo TMDB + mention dans les paramètres/à propos et le README :
  « This product uses the TMDB API but is not endorsed or certified by TMDB. »

## Livrables
- Code de l'app, `README.md` en anglais (captures, comment obtenir une clé TMDB, comment
  installer la PWA, format d'export), licence MIT, workflow GitHub Pages.

## Méthode de travail
- Avancer par étapes et s'arrêter à chaque étape pour que je teste :
  1. squelette PWA + navigation + paramètres + clé TMDB ;
  2. recherche + fiche + ajout ;
  3. liste + édition ;
  4. stats + watchlist ;
  5. export/import + share target ;
  6. logo, splash, finitions.
- Commits atomiques avec messages clairs.
- Me demander avant toute nouvelle dépendance ou tout changement du modèle de données.