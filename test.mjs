// Smoke-тест логики content.js на живых API (TMDB-путь; IMDb требует браузера): node test.mjs
import { readFileSync } from 'fs';
import assert from 'assert';
globalThis.setInterval = () => 0; // глушим UI-цикл
globalThis.chrome = { runtime: { sendMessage: async () => null } }; // IMDb-путь → фолбэк TMDB
(0, eval)(readFileSync(new URL('./content.js', import.meta.url), 'utf8'));

const frieren = await load('154587');
assert.equal(frieren.eps.length, 28, 'Frieren: 28 серий');
assert.ok(frieren.eps[0].score > 0, 'Frieren: есть оценка');

const jjk2 = await load('145064'); // AniList «JJK Season 2» → мердж-сезон TMDB, срез
assert.equal(jjk2.eps.length, 23, 'JJK S2: 23 серии');
assert.equal(jjk2.eps[0].n, 25, 'JJK S2: сквозная нумерация с 25-й');

const movie = await load('21519'); // Kimi no Na wa — фильм, панель не нужна
assert.equal(movie, null, 'фильм → null');

console.log('OK:',
  `Frieren [${frieren.source}] ep1 "${frieren.eps[0].name}" ${frieren.eps[0].score.toFixed(1)};`,
  `JJK2 [${jjk2.source}] ep${jjk2.eps[0].n} "${jjk2.eps[0].name}" ${jjk2.eps[0].score.toFixed(1)}`);
