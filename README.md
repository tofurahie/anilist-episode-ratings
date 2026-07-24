# AniList Ratings

Browser extension (Manifest V3) that adds ratings to [AniList](https://anilist.co): a per-episode **IMDb ratings** grid on anime pages, and **average score badges** on posters.

![](https://img.shields.io/badge/manifest-v3-blue)

## What it does

**Episode ratings** (`episodes.js`) — on any `anilist.co/anime/*` page a panel appears at the top of the Overview column: a grid of episode tiles with color-coded IMDb ratings and vote counts; episode titles show in a hover tooltip. Each tile links to the episode's IMDb page.

**Score badges** (`badges.js`) — every anime/manga poster across the site gets AniList's own `averageScore` in its top-right corner, color-coded (green ≥ 7.5, orange ≥ 6.0, red below).

Both can be toggled independently in the extension options (`chrome://extensions` → Details → Extension options). Reload the AniList tab to apply.

## How it works

Score badges: poster links are collected from the DOM and batched (50 ids per request) against the AniList GraphQL API.

Episode ratings:

1. Anime ID is taken from the URL, entry data (start date, episode count) from the AniList GraphQL API.
2. [ARM](https://arm.haglund.dev) maps the AniList ID to an IMDb ID.
3. The background service worker queries IMDb's GraphQL endpoint (`caching.graphql.imdb.com`) — the same backend that powers imdb.com itself. No API keys, no cookies, no scraping.
4. Season detection: the season whose first episode starts closest to the AniList entry's start date; merged seasons with continuous numbering (common for anime on IMDb) are sliced by start date and episode count.
5. No IMDb mapping or no data → no panel (no low-quality fallbacks).

No configuration needed — there are no API keys anywhere in the extension. All requests go directly from your browser.

## Install

1. Clone this repo.
2. `chrome://extensions` → enable Developer mode → Load unpacked → select the folder.

Works in Chrome, Brave, Edge and other Chromium browsers.

## Test

```
node test.mjs
```

Smoke-tests the settings gate plus the full data chain (AniList → ARM → IMDb GraphQL → season slicing) against live APIs.

## Notes

- Episode titles come from IMDb's primary title field — for anime that's usually romaji.
- IMDb's API terms allow limited non-commercial use only; this extension is free, unmonetized, and every user queries IMDb directly from their own browser.
