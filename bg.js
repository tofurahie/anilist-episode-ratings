// Оценки серий через GraphQL-бэкенд IMDb (caching.graphql.imdb.com) — им кормится их же
// фронтенд, работает без кук и AWS WAF-челленджей, в отличие от HTML-страниц www.imdb.com.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'imdbSeason') return;
  loadSeason(msg.imdbId, msg.season).then(sendResponse).catch(() => sendResponse(null));
  return true; // ответ асинхронный
});

const QUERY = `query($id: ID!, $season: String!, $after: ID) {
  title(id: $id) { episodes {
    displayableSeasons(first: 100) { edges { node { season } } }
    episodes(first: 250, filter: { includeSeasons: [$season] }, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges { node {
        id
        titleText { text }
        series { episodeNumber { episodeNumber } }
        ratingsSummary { aggregateRating voteCount }
        releaseDate { year month day }
      } }
    }
  } }
}`;

async function gql(variables) {
  const r = await fetch('https://caching.graphql.imdb.com/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: QUERY, variables })
  });
  if (!r.ok) throw new Error(`IMDb GraphQL ${r.status}`);
  return (await r.json()).data;
}

async function loadSeason(imdbId, season) {
  let after = null, seasons = [];
  const episodes = [];
  do {
    const ep = (await gql({ id: imdbId, season, after }))?.title?.episodes;
    if (!ep) return null;
    seasons = ep.displayableSeasons.edges.map(e => e.node.season);
    for (const { node: n } of ep.episodes.edges) {
      episodes.push({
        id: n.id,
        episode: n.series?.episodeNumber?.episodeNumber ?? episodes.length + 1,
        name: n.titleText?.text || '',
        rating: n.ratingsSummary?.aggregateRating || 0,
        votes: n.ratingsSummary?.voteCount || 0,
        ts: n.releaseDate?.year
          ? Date.UTC(n.releaseDate.year, (n.releaseDate.month || 1) - 1, n.releaseDate.day || 1)
          : null
      });
    }
    after = ep.episodes.pageInfo.hasNextPage ? ep.episodes.pageInfo.endCursor : null;
  } while (after);
  return episodes.length ? { season, seasons, episodes } : null;
}
