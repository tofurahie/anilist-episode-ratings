// AniList Score Badge: averageScore в углу постеров на anilist.co
const SCORE = new Map();   // mediaId -> averageScore | null
const QUEUE = new Map();   // mediaId -> Element[]
let flushTimer = null;
let scanTimer = null;

const idOf = a => {
  const m = a.getAttribute('href').match(/^\/(?:anime|manga)\/(\d+)/);
  return m ? +m[1] : null;
};

// постер = вертикальная картинка-ссылка; текстовые ссылки на тайтл отсеиваются
const isPoster = a => a.offsetWidth >= 40 && a.offsetHeight >= a.offsetWidth * 1.2;

function paint(a, score) {
  if (score == null || a.querySelector('.asb')) return;
  if (getComputedStyle(a).position === 'static') a.style.position = 'relative';
  const b = document.createElement('div');
  b.className = 'asb';
  b.textContent = (score / 10).toFixed(1);
  b.style.background = score >= 75 ? '#7bd555' : score >= 60 ? '#f7be5e' : '#e85d75';
  a.append(b);
}

async function flush() {
  flushTimer = null;
  const ids = [...QUEUE.keys()].slice(0, 50);
  if (!ids.length) return;
  const batch = ids.map(id => [id, QUEUE.get(id)]);
  ids.forEach(id => QUEUE.delete(id));
  try {
    const r = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'query($ids:[Int]){Page(perPage:50){media(id_in:$ids){id averageScore}}}',
        variables: { ids }
      })
    });
    if (!r.ok) throw new Error(r.status);           // 429 и т.п. — просто пропускаем пачку
    for (const m of (await r.json()).data.Page.media) SCORE.set(m.id, m.averageScore);
    for (const [id, els] of batch) els.forEach(a => paint(a, SCORE.get(id) ?? null));
  } catch (e) {
    console.warn('[asb]', e);
  }
  if (QUEUE.size) flushTimer = setTimeout(flush, 700);
}

function scan() {
  scanTimer = null;
  for (const a of document.querySelectorAll('a[href^="/anime/"],a[href^="/manga/"]')) {
    if (a.dataset.asb || !isPoster(a)) continue;
    const id = idOf(a);
    if (!id) continue;
    a.dataset.asb = '1';
    if (SCORE.has(id)) { paint(a, SCORE.get(id)); continue; }
    QUEUE.has(id) ? QUEUE.get(id).push(a) : QUEUE.set(id, [a]);
    flushTimer ??= setTimeout(flush, 200);
  }
}

function startBadges() {
  document.head.append(Object.assign(document.createElement('style'), {
    textContent: `.asb{position:absolute;top:4px;right:4px;z-index:5;
      font:700 12px/1 Overpass,-apple-system,sans-serif;color:#0b1622;
      padding:3px 5px;border-radius:4px;pointer-events:none;
      box-shadow:0 1px 4px rgba(0,0,0,.6)}`
  }));
  new MutationObserver(() => { scanTimer ??= setTimeout(scan, 150); })
    .observe(document.body, { childList: true, subtree: true });
  scan();
}

globalThis.chrome?.storage?.sync.get({ badges: true }).then(s => s.badges && startBadges());
