// AniList Episode Ratings: серии с оценками IMDb (фолбэк — TMDB) на anilist.co/anime/*
const TMDB_KEY = '7ad6930931183f17fc6baa761a88b5d2';
const TMDB = 'https://api.themoviedb.org/3';

const cache = {};         // anilistId -> данные для рендера
const failed = new Set(); // anilistId, для которых данных нет — не долбим API
let busy = false;

// ponytail: поллинг вместо перехвата SPA-роутера — скучно и работает
setInterval(() => {
  const m = location.pathname.match(/^\/anime\/(\d+)/);
  const id = m && m[1];
  const panel = document.getElementById('ep-ratings');
  if (panel && panel.dataset.anilist !== id) panel.remove();
  if (!id || busy || failed.has(id) || document.getElementById('ep-ratings')) return;
  if (cache[id]) { render(cache[id]); return; }
  busy = true;
  load(id)
    .then(d => d ? (cache[id] = d, render(d)) : failed.add(id))
    .catch(e => { console.warn('[ep-ratings]', e); failed.add(id); })
    .finally(() => { busy = false; });
}, 800);

async function load(anilistId) {
  const media = await anilist(anilistId);
  if (!media || media.format === 'MOVIE') return null;
  const ids = await armIds(anilistId);
  let d = null;
  if (ids?.imdb) d = await loadImdb(ids.imdb, media).catch(e => (console.warn('[ep-ratings] imdb', e), null));
  if (!d) d = await loadTmdb(ids, media).catch(e => (console.warn('[ep-ratings] tmdb', e), null));
  if (!d?.eps?.length) return null;
  return { anilistId, ...d };
}

// --- IMDb (запрос через background: CORS) ---
const imdbSeason = (imdbId, season) => chrome.runtime.sendMessage({ type: 'imdbSeason', imdbId, season });

async function loadImdb(imdbId, media) {
  const first = await imdbSeason(imdbId, '1');
  if (!first?.episodes?.length) return null;
  const seasons = first.seasons?.length ? first.seasons : ['1'];
  const start = startTs(media);
  let pick = null;
  for (const s of seasons) {
    const d = s === seasons[0] ? first : await imdbSeason(imdbId, s);
    if (!d?.episodes?.length) continue;
    pick ??= d;
    // первый сезон, доживающий до старта записи AniList, и есть её сезон
    if (start == null || d.episodes.some(e => e.ts != null && e.ts >= start)) { pick = d; break; }
  }
  const eps = sliceToEntry(pick.episodes, media).map(e => ({
    n: e.episode, name: e.name, score: e.rating, votes: e.votes,
    url: `https://www.imdb.com/title/${e.id}/`
  }));
  return { source: `IMDb S${pick.season}`, eps };
}

// --- TMDB (фолбэк, когда IMDb-маппинга нет или страница не распарсилась) ---
async function loadTmdb(ids, media) {
  const tmdbId = ids?.themoviedb || await searchTmdb(media);
  if (!tmdbId) return null;
  const show = await tmdb(`/tv/${tmdbId}`);
  const seasons = (show.seasons || []).filter(s => s.season_number > 0 && s.episode_count > 0);
  if (!seasons.length) return null;
  const season = seasons.find(s => s.season_number === ids?.['themoviedb-season'])
    || guessSeason(seasons, media);
  const s = await tmdb(`/tv/${tmdbId}/season/${season.season_number}`);
  const eps = sliceToEntry((s.episodes || []).map(e => ({
    n: e.episode_number, name: e.name, score: e.vote_average,
    ts: e.air_date ? Date.parse(e.air_date) : null,
    url: `https://www.themoviedb.org/tv/${tmdbId}/season/${season.season_number}/episode/${e.episode_number}`
  })), media);
  return { source: `TMDB S${season.season_number}`, eps };
}

// ponytail: сезон = ближайший по дате старта
function guessSeason(seasons, media) {
  if (seasons.length === 1 || !media.startDate?.year) return seasons[0];
  const start = startTs(media);
  let best = seasons[0], bestD = Infinity;
  for (const s of seasons) {
    const d = s.air_date ? Math.abs(new Date(s.air_date) - start) : Infinity;
    if (d < bestD) { best = s; bestD = d; }
  }
  return best;
}

// Сезоны со сквозной нумерацией (мердж) — режем по дате старта записи AniList и её числу серий
function sliceToEntry(eps, media) {
  const start = startTs(media);
  if (start == null) return eps;
  let out = eps.filter(e => e.ts != null && e.ts >= start - 10 * 864e5);
  if (!out.length) out = eps;
  if (media.episodes && out.length > media.episodes) out = out.slice(0, media.episodes);
  return out;
}

function startTs(media) {
  const { year, month, day } = media.startDate || {};
  return year ? Date.UTC(year, (month || 1) - 1, day || 1) : null;
}

async function anilist(id) {
  const q = `query($id:Int){Media(id:$id){format episodes startDate{year month day} title{romaji english}}}`;
  const r = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q, variables: { id: +id } })
  });
  return (await r.json()).data?.Media;
}

async function armIds(anilistId) {
  try {
    const r = await fetch(`https://arm.haglund.dev/api/v2/ids?source=anilist&id=${anilistId}`);
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

async function searchTmdb(media) {
  for (const t of [media.title.english, media.title.romaji].filter(Boolean)) {
    const clean = t.replace(/\s*[:\-]?\s*(season\s*\d+|\d+(st|nd|rd|th)\s+season|part\s*\d+|cour\s*\d+).*$/i, '').trim();
    const j = await tmdb(`/search/tv?query=${encodeURIComponent(clean)}`);
    if (j.results?.length) return j.results[0].id;
  }
  return null;
}

async function tmdb(path) {
  const sep = path.includes('?') ? '&' : '?';
  const r = await fetch(`${TMDB}${path}${sep}api_key=${TMDB_KEY}&language=en-US`);
  if (!r.ok) throw new Error(`TMDB ${r.status} ${path}`);
  return r.json();
}

const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function render(d) {
  if (!location.pathname.startsWith(`/anime/${d.anilistId}`)) return;
  if (document.getElementById('ep-ratings')) return;
  const host = document.querySelector('.overview');
  if (!host) return; // страница ещё не отрисована — интервал попробует снова

  const rows = d.eps.map(e => {
    const score = e.score ? e.score.toFixed(1) : '—';
    const col = !e.score ? 'rgb(var(--color-text-light))'
      : e.score >= 8 ? 'rgb(var(--color-green))'
      : e.score >= 6.5 ? 'rgb(var(--color-orange))'
      : 'rgb(var(--color-red))';
    const votes = e.votes ? ` title="${e.votes} votes"` : '';
    return `<a class="epr-row" href="${e.url}" target="_blank" rel="noreferrer"${votes}>
      <span class="epr-num">${e.n}</span>
      <span class="epr-name">${esc(e.name || '')}</span>
      <span class="epr-score" style="color:${col}">${score}</span>
    </a>`;
  }).join('');

  const wrap = document.createElement('div');
  wrap.id = 'ep-ratings';
  wrap.dataset.anilist = d.anilistId;
  wrap.innerHTML = `
    <style>
      #ep-ratings { margin-bottom: 30px; }
      #ep-ratings h2 { font-size: 1.4rem; font-weight: 500; color: rgb(var(--color-text-lighter)); margin-bottom: 10px; }
      #ep-ratings .epr-list { background: rgb(var(--color-foreground)); border-radius: 4px; padding: 6px 0; max-height: 416px; overflow-y: auto; }
      #ep-ratings .epr-row { display: grid; grid-template-columns: 34px 1fr 44px; gap: 10px; padding: 7px 16px; font-size: 1.3rem; color: rgb(var(--color-text)); text-decoration: none; }
      #ep-ratings .epr-row:hover { background: rgb(var(--color-background)); }
      #ep-ratings .epr-num { color: rgb(var(--color-text-light)); text-align: right; }
      #ep-ratings .epr-score { text-align: right; font-weight: 600; }
    </style>
    <h2>Episodes · ${esc(d.source)}</h2>
    <div class="epr-list">${rows}</div>`;
  host.prepend(wrap);
}
