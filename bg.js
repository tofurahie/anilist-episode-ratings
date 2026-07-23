// Тянет страницу эпизодов IMDb (content script не может из-за CORS) и парсит __NEXT_DATA__
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'imdbSeason') return;
  fetch(`https://www.imdb.com/title/${msg.imdbId}/episodes/?season=${msg.season}`, {
    headers: { 'Accept-Language': 'en-US,en' }
  })
    .then(r => r.text())
    .then(html => {
      const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
      const sec = m && JSON.parse(m[1])?.props?.pageProps?.contentData?.section;
      if (!sec?.episodes?.items?.length) return sendResponse(null);
      sendResponse({
        season: msg.season,
        seasons: (sec.seasons || []).map(s => s.value),
        episodes: sec.episodes.items.map(e => ({
          id: e.id,
          episode: +e.episode,
          name: e.titleText || '',
          rating: e.aggregateRating || 0,
          votes: e.voteCount || 0,
          ts: e.releaseDate?.year
            ? Date.UTC(e.releaseDate.year, (e.releaseDate.month || 1) - 1, e.releaseDate.day || 1)
            : null
        }))
      });
    })
    .catch(() => sendResponse(null));
  return true;
});
