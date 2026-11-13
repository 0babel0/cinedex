# Cinedex

A small, private, offline-first PWA to log the movies and TV shows you've watched.
No backend, no account, no trackers: your diary lives in your browser's IndexedDB,
and the only network calls go to the TMDB API, straight from your device.

> Work in progress. Full documentation (screenshots, install guide, export format) comes with the final step.

## Run locally

Any static file server works, for example:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>. You need your own TMDB API key (v3 API key or v4 Read Access Token),
entered in the app settings.

## Credits

<img src="assets/tmdb.svg" alt="TMDB" width="160">

This product uses the TMDB API but is not endorsed or certified by TMDB.

## License

[MIT](LICENSE)
