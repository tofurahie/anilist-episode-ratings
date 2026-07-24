// Тянет страницу эпизодов IMDb (content script не может из-за CORS) и парсит __NEXT_DATA__.
// IMDb за AWS WAF: кукилес-запрос ловит 202-челлендж. Быстрый путь — fetch с кукой aws-waf-token;
// если она протухла (напр. за ночь) — открываем страницу в свёрнутом окне, браузер сам решает
// челлендж, читаем __NEXT_DATA__ из DOM и заодно освежаем куку для остальных запросов.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'imdbSeason') return;
  handle(msg.imdbId, msg.season).then(sendResponse).catch(() => sendResponse(null));
  return true; // ответ асинхронный
});

const epUrl = (imdbId, season) => `https://www.imdb.com/title/${imdbId}/episodes/?season=${season}`;

async function handle(imdbId, season) {
  const url = epUrl(imdbId, season);
  let next = parseNext(await fetchText(url)); // быстрый путь: кука ещё валидна
  if (!next) next = await viaWindow(url);     // WAF срезал — решаем челлендж в реальном окне
  return toSeason(next, season);
}

async function fetchText(url) {
  try {
    const r = await fetch(url, { credentials: 'include', headers: { 'Accept-Language': 'en-US,en' } });
    return await r.text();
  } catch { return ''; }
}

function parseNext(html) {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
  try { return m ? JSON.parse(m[1]) : null; } catch { return null; }
}

function toSeason(next, season) {
  const sec = next?.props?.pageProps?.contentData?.section;
  if (!sec?.episodes?.items?.length) return null;
  return {
    season,
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
  };
}

// Открывает URL в свёрнутом фоновом окне, ждёт пока WAF-челлендж решится и отрисуется реальная
// страница (появится __NEXT_DATA__), возвращает распарсенный объект. Окно закрывается всегда.
async function viaWindow(url) {
  const win = await chrome.windows.create({ url, focused: false, state: 'minimized', type: 'popup', width: 480, height: 360 });
  const tabId = win.tabs[0].id;
  try {
    for (let i = 0; i < 25; i++) { // ~10 c: челлендж + reload на реальную страницу
      await sleep(400);
      const [res] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => document.getElementById('__NEXT_DATA__')?.textContent || null
      }).catch(() => [{ result: null }]);
      const next = res?.result && (() => { try { return JSON.parse(res.result); } catch { return null; } })();
      if (next?.props?.pageProps?.contentData?.section?.episodes?.items?.length) return next;
    }
    return null;
  } finally {
    chrome.windows.remove(win.id).catch(() => {});
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
