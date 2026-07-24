// Smoke-тест всей цепочки (content.js + bg.js) на живых API: node test.mjs
import { readFileSync } from 'fs';
import assert from 'assert';

globalThis.setInterval = () => 0; // глушим UI-цикл
let onMsg;
globalThis.chrome = { runtime: {
  onMessage: { addListener: f => { onMsg = f; } },
  sendMessage: msg => new Promise(res => onMsg(msg, null, res))
} };
(0, eval)(readFileSync(new URL('./bg.js', import.meta.url), 'utf8'));
(0, eval)(readFileSync(new URL('./content.js', import.meta.url), 'utf8'));

const frieren = await load('154587');
assert.equal(frieren.source, 'IMDb S1', 'Frieren: сезон 1');
assert.equal(frieren.eps.length, 28, 'Frieren: 28 серий');
assert.ok(frieren.eps[0].score > 0 && frieren.eps[0].votes > 1000, 'Frieren: живые оценки');

const jjk2 = await load('145064'); // AniList «JJK Season 2» → отдельная запись, свой сезон IMDb
assert.equal(jjk2.eps.length, 23, 'JJK S2: 23 серии');

const movie = await load('21519'); // Kimi no Na wa — фильм, панель не нужна
assert.equal(movie, null, 'фильм → null');

console.log('OK:',
  `Frieren [${frieren.source}] ep1 "${frieren.eps[0].name}" ${frieren.eps[0].score.toFixed(1)} (${frieren.eps[0].votes} votes);`,
  `JJK2 [${jjk2.source}] ep${jjk2.eps[0].n} "${jjk2.eps[0].name}" ${jjk2.eps[0].score.toFixed(1)}`);
