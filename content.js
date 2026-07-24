// AniList Episode Ratings: пооэпизодные оценки IMDb на anilist.co/anime/*
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
  if (!ids?.imdb) return null;
  const d = await loadImdb(ids.imdb, media).catch(e => (console.warn('[ep-ratings] imdb', e), null));
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
  const q = `query($id:Int){Media(id:$id){format episodes startDate{year month day}}}`;
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

const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtVotes = v => !v ? '' : v >= 1000 ? (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(v);

function render(d) {
  if (!location.pathname.startsWith(`/anime/${d.anilistId}`)) return;
  if (document.getElementById('ep-ratings')) return;
  const host = document.querySelector('.overview');
  if (!host) return; // страница ещё не отрисована — интервал попробует снова

  const tiles = d.eps.map(e => {
    const score = e.score ? e.score.toFixed(1) : '—';
    const col = !e.score ? 'rgb(var(--color-text-light))'
      : e.score >= 8 ? 'rgb(var(--color-green))'
      : e.score >= 6.5 ? 'rgb(var(--color-orange))'
      : 'rgb(var(--color-red))';
    return `<a class="epr-tile" href="${e.url}" target="_blank" rel="noreferrer" data-name="${esc(e.name || '')}">
      <span class="epr-num">${e.n}</span>
      <span class="epr-score" style="color:${col}">${score}</span>
      <span class="epr-votes">${fmtVotes(e.votes)}</span>
    </a>`;
  }).join('');

  const wrap = document.createElement('div');
  wrap.id = 'ep-ratings';
  wrap.dataset.anilist = d.anilistId;
  wrap.innerHTML = `
    <style>
      #ep-ratings { margin-bottom: 30px; }
      #ep-ratings h2 { font-size: 1.4rem; font-weight: 500; color: rgb(var(--color-text-lighter)); margin-bottom: 10px; }
      #ep-ratings .epr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(56px, 1fr)); gap: 8px; max-height: 420px; overflow-y: auto; }
      #ep-ratings .epr-tile { display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 8px 4px 7px;
        background: rgb(var(--color-foreground)); border-radius: 4px; text-decoration: none; transition: transform .12s; }
      #ep-ratings .epr-tile:hover { transform: translateY(-2px); }
      #ep-ratings .epr-num { font-size: 1.1rem; color: rgb(var(--color-text-light)); }
      #ep-ratings .epr-score { font-size: 1.5rem; font-weight: 700; }
      #ep-ratings .epr-votes { font-size: 1rem; color: rgb(var(--color-text-light)); min-height: 1.2rem; }
      #ep-ratings .epr-tip { position: fixed; z-index: 999; pointer-events: none; padding: 6px 10px; border-radius: 4px;
        background: rgb(var(--color-foreground)); color: rgb(var(--color-text)); font-size: 1.2rem;
        box-shadow: 0 2px 8px rgba(0,0,0,.35); max-width: 280px; width: max-content; }
    </style>
    <h2>Episodes · ${esc(d.source)}</h2>
    <div class="epr-grid">${tiles}</div>
    <div class="epr-tip" hidden></div>`;

  const tip = wrap.querySelector('.epr-tip');
  const grid = wrap.querySelector('.epr-grid');
  grid.addEventListener('mouseover', ev => {
    const t = ev.target.closest('.epr-tile');
    if (!t?.dataset.name) { tip.hidden = true; return; }
    tip.textContent = `${t.querySelector('.epr-num').textContent}. ${t.dataset.name}`;
    tip.hidden = false;
    const r = t.getBoundingClientRect();
    tip.style.left = Math.min(Math.max(r.left + r.width / 2 - 60, 8), innerWidth - 288) + 'px';
    if (r.top > 60) { tip.style.top = ''; tip.style.bottom = innerHeight - r.top + 6 + 'px'; }
    else { tip.style.bottom = ''; tip.style.top = r.bottom + 6 + 'px'; }
  });
  grid.addEventListener('mouseleave', () => { tip.hidden = true; });
  host.prepend(wrap);
}
