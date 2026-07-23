# AniList Episode Ratings

Browser extension (Manifest V3) that adds an episode list with per-episode **IMDb ratings** to [AniList](https://anilist.co) anime pages. Falls back to TMDB when no IMDb mapping exists.

![](https://img.shields.io/badge/manifest-v3-blue)

## What it does

On any `anilist.co/anime/*` page, a panel appears at the top of the Overview column: episode number, title, rating (color-coded), vote count in the tooltip. Each row links to the episode page on IMDb/TMDB.

## How it works

1. Anime ID is taken from the URL, entry data (start date, episode count) from the AniList GraphQL API.
2. [ARM](https://arm.haglund.dev) maps the AniList ID to IMDb / TMDB IDs.
3. The background service worker fetches the IMDb episodes page and parses the embedded `__NEXT_DATA__` JSON (IMDb has no official API).
4. Season detection: first season whose episode dates reach the AniList entry's start date; merged seasons with continuous numbering (common for anime on IMDb/TMDB) are sliced by start date and episode count.
5. No IMDb data → TMDB API fallback (the panel header shows the source).

## Install

1. Clone this repo.
2. `chrome://extensions` → enable Developer mode → Load unpacked → select the folder.

Works in Chrome, Brave, Edge and other Chromium browsers.

## Test

```
node test.mjs
```

Smoke-tests the data chain (TMDB path + merged-season slicing) against live APIs.

## Notes

- The TMDB API key in `content.js` is a free-tier key; replace with your own from [themoviedb.org](https://www.themoviedb.org/settings/api) if needed.
- Episode titles are English (`language=en-US` in `content.js`).
