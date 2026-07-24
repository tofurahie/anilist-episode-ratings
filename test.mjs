// Smoke-тест всей цепочки (episodes.js + bg.js) на живых API: node test.mjs
import { readFileSync } from 'fs';
import assert from 'assert';

let intervals = 0, observed = 0;
globalThis.setInterval = () => ++intervals; // глушим UI-цикл и считаем запуски
globalThis.MutationObserver = class { observe() { ++observed; } };
let onMsg;
globalThis.chrome = {
  runtime: {
    onMessage: { addListener: f => { onMsg = f; } },
    sendMessage: msg => new Promise(res => onMsg(msg, null, res))
  },
  // оба модуля выключены — гейт настроек не должен ничего запускать
  storage: { sync: { get: async d => ({ ...d, episodes: false, badges: false }) } }
};
(0, eval)(readFileSync(new URL('./bg.js', import.meta.url), 'utf8'));
(0, eval)(readFileSync(new URL('./episodes.js', import.meta.url), 'utf8'));
(0, eval)(readFileSync(new URL('./badges.js', import.meta.url), 'utf8'));

await new Promise(r => globalThis.queueMicrotask(r));
await new Promise(r => setTimeout(r, 0));
assert.equal(intervals, 0, 'гейт: episodes:false не запускает поллинг');
assert.equal(observed, 0, 'гейт: badges:false не вешает MutationObserver');

const frieren = await load('154587');
assert.equal(frieren.source, 'IMDb S1', 'Frieren: сезон 1');
assert.equal(frieren.eps.length, 28, 'Frieren: 28 серий');
assert.ok(frieren.eps[0].score > 0 && frieren.eps[0].votes > 1000, 'Frieren: живые оценки');

const jjk2 = await load('145064'); // AniList «JJK Season 2» → отдельная запись, свой сезон IMDb
assert.equal(jjk2.eps.length, 23, 'JJK S2: 23 серии');

const ks2 = await load('21699'); // KonoSuba 2 — в хвосте IMDb S1 лежит OVA 2019 года, не должна сбивать выбор
assert.equal(ks2.source, 'IMDb S2', 'KonoSuba 2: сезон 2');
assert.equal(ks2.eps.length, 10, 'KonoSuba 2: 10 серий');
assert.equal(ks2.eps[0].n, 1, 'KonoSuba 2: нумерация с 1');

const movie = await load('102976'); // KonoSuba: Legend of Crimson — фильм, одна плитка с рейтингом тайтла
assert.equal(movie.source, 'IMDb', 'фильм: источник IMDb');
assert.equal(movie.eps.length, 1, 'фильм: одна плитка');
assert.ok(movie.eps[0].score > 0 && movie.eps[0].votes > 1000, 'фильм: живой рейтинг');

console.log('OK:',
  `Frieren [${frieren.source}] ep1 "${frieren.eps[0].name}" ${frieren.eps[0].score.toFixed(1)} (${frieren.eps[0].votes} votes);`,
  `JJK2 [${jjk2.source}] ep${jjk2.eps[0].n} "${jjk2.eps[0].name}" ${jjk2.eps[0].score.toFixed(1)};`,
  `KonoSuba2 [${ks2.source}] ${ks2.eps.length} eps;`,
  `Movie "${movie.eps[0].name}" ${movie.eps[0].score.toFixed(1)} (${movie.eps[0].votes} votes)`);
