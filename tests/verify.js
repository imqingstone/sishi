// 執行：node tests/verify.js
const assert = require('assert');
const S = require('../docs/engine.js');
const T = require('../docs/terms.js');
const texts = require('../docs/texts.js');

// 節氣：與中央氣象署公布的時刻相差不超過 1 分鐘
const at = (y, name) => { const d = new Date(T.data[y - 1900][T.names.indexOf(name)] * 60000); return d.toISOString().slice(0, 16).replace('T', ' '); };
const near = (got, want) => Math.abs(Date.parse(got.replace(' ', 'T') + 'Z') - Date.parse(want.replace(' ', 'T') + 'Z')) <= 60000;
for (const [y, n, w] of [[2024, '立春', '2024-02-04 16:27'], [2025, '立春', '2025-02-03 22:10'], [2026, '立春', '2026-02-04 04:02'],
  [2024, '冬至', '2024-12-21 17:21'], [2025, '冬至', '2025-12-21 23:03'], [2024, '春分', '2024-03-20 11:06'], [2025, '夏至', '2025-06-21 10:42'], [2023, '立春', '2023-02-04 10:43']])
  assert.ok(near(at(y, n), w), y + n + ' ' + at(y, n) + ' vs ' + w);
// 每兩個節氣間隔 14–16.5 天
for (const r of T.data) for (let i = 1; i < 24; i++) { const g = r[i] - r[i - 1]; assert.ok(g > 14 * 1440 && g < 16.5 * 1440); }

const four = c => ['year', 'month', 'day', 'hour'].map(k => c.pillars[k].text).join(' ');
// 已知命盤
assert.strictEqual(four(S.chart({y: 1949, m: 10, d: 1, hour: 15, minute: 0, gender: 'M'})), '己丑 癸酉 甲子 壬申');
assert.strictEqual(four(S.chart({y: 2000, m: 1, d: 1, hour: 0, minute: 0, gender: 'F'})), '己卯 丙子 戊午 壬子');
assert.strictEqual(four(S.chart({y: 1990, m: 6, d: 15, hour: 12, minute: 0, gender: 'F'})), '庚午 壬午 辛亥 甲午');
// 立春前後一分鐘換年、換月
assert.strictEqual(four(S.chart({y: 2024, m: 2, d: 4, hour: 16, minute: 26, gender: 'M'})).slice(0, 5), '癸卯 乙丑');
assert.strictEqual(four(S.chart({y: 2024, m: 2, d: 4, hour: 16, minute: 28, gender: 'M'})).slice(0, 5), '甲辰 丙寅');
// 晚子時
assert.strictEqual(four(S.chart({y: 2000, m: 1, d: 1, hour: 23, minute: 30, gender: 'M'})), '己卯 丙子 己未 甲子');
assert.strictEqual(four(S.chart({y: 2000, m: 1, d: 1, hour: 23, minute: 30, gender: 'M', lateZi: 'same'})), '己卯 丙子 戊午 甲子');

// 十神
assert.strictEqual(S.tenGod(0, 0), '比肩'); assert.strictEqual(S.tenGod(0, 1), '劫財');
assert.strictEqual(S.tenGod(0, 2), '食神'); assert.strictEqual(S.tenGod(0, 3), '傷官');
assert.strictEqual(S.tenGod(0, 4), '偏財'); assert.strictEqual(S.tenGod(0, 5), '正財');
assert.strictEqual(S.tenGod(0, 6), '七殺'); assert.strictEqual(S.tenGod(0, 7), '正官');
assert.strictEqual(S.tenGod(0, 8), '偏印'); assert.strictEqual(S.tenGod(0, 9), '正印');
assert.strictEqual(S.tenGod(7, 2), '正官');   // 辛見丙

// 1949/10/1 甲子日：空亡戌亥；己年陰男逆推，從寒露前的白露算起運
const c49 = S.chart({y: 1949, m: 10, d: 1, hour: 15, minute: 0, gender: 'M'});
assert.deepStrictEqual(c49.kong, ['戌', '亥']);
assert.strictEqual(c49.forward, false); assert.strictEqual(c49.luck.target, '白露');
assert.deepStrictEqual(c49.luck.decades.slice(0, 3).map(d => d.text), ['壬申', '辛未', '庚午']);
assert.strictEqual(c49.pillars.year.nayin, '霹靂火'); assert.strictEqual(c49.pillars.day.nayin, '海中金');
assert.deepStrictEqual(c49.pillars.month.hidden.map(h => h.stem + h.god), ['辛正官']);
// 2000/1/1 女命：己年陰女順推，到小寒約 5.6 天，約 1 年 10 個月起運
const c00 = S.chart({y: 2000, m: 1, d: 1, hour: 0, minute: 0, gender: 'F'});
assert.strictEqual(c00.forward, true); assert.strictEqual(c00.luck.target, '小寒');
assert.ok(c00.luck.years === 1 && c00.luck.months >= 9 && c00.luck.months <= 10);
assert.strictEqual(c00.luck.decades[0].text, '丁丑');
// 流年
const f26 = S.flowYear(S.chart({y: 1990, m: 6, d: 15, hour: 12, minute: 0, gender: 'F'}), 2026);
assert.strictEqual(f26.text, '丙午'); assert.strictEqual(f26.god, '正官'); assert.strictEqual(f26.age, 37);

// 合沖刑害
const rel = c => c.relations.map(r => r.type + r.text + '@' + r.pillars.join('-'));
assert.deepStrictEqual(rel(c49).sort(), ['六合子丑合土@year-day', '半合丑酉半合金局@year-month', '半合子申半合水局@day-hour', '天干五合甲己合土@year-day'].sort());
assert.ok(rel(c00).includes('六沖子午沖@month-day') && rel(c00).includes('相刑卯子刑@year-month') && rel(c00).includes('天干相沖丙壬沖@month-hour'));
const R = (st, br) => S.relations(st, br).map(r => r.type + r.text);
assert.ok(R([0, 2, 4, 6], [8, 0, 4, 6]).includes('三合申子辰三合水局'));           // 申子辰
assert.ok(!R([0, 2, 4, 6], [8, 0, 4, 6]).some(x => x.startsWith('半合')));
assert.ok(R([0, 2, 4, 6], [2, 3, 4, 6]).includes('三會寅卯辰三會木方'));
assert.ok(R([0, 2, 4, 6], [2, 5, 8, 0]).filter(x => x.startsWith('相刑')).length === 3);   // 寅巳申
assert.ok(R([0, 2, 4, 6], [2, 5, 0, 1]).includes('六害寅巳害'));
assert.ok(R([0, 2, 4, 6], [4, 4, 0, 1]).includes('自刑辰辰自刑'));
assert.ok(!R([0, 2, 4, 6], [8, 4, 0, 1]).some(x => x.includes('申辰')));   // 沒有旺支不算半合
// 神煞
const sha = c => c.shensha.map(x => x.name + '@' + x.pillar);
const c90 = S.chart({y: 1990, m: 6, d: 15, hour: 12, minute: 0, gender: 'F'});   // 庚午 壬午 辛亥 甲午
assert.deepStrictEqual(sha(c90).sort(), ['天乙貴人@year', '天乙貴人@month', '天乙貴人@hour', '將星@month', '將星@hour', '天德貴人@day'].sort());
assert.ok(sha(c49).includes('天乙貴人@year') && sha(c49).includes('桃花@month') && sha(c49).includes('天喜@hour'));
assert.ok(sha(c00).includes('羊刃@day') && sha(c00).includes('月德貴人@hour') && sha(c00).includes('紅鸞@month'));
const SH = (st, br) => S.shensha(st, br).map(x => x.name + '@' + x.pillar);
assert.ok(SH([0, 0, 6, 0], [0, 0, 4, 2]).includes('魁罡@day'));                       // 庚辰日
assert.ok(SH([0, 0, 0, 0], [8, 0, 0, 2]).includes('驛馬@hour'));                      // 申年見寅
assert.ok(SH([0, 0, 0, 0], [8, 0, 0, 4]).includes('華蓋@hour'));
assert.ok(SH([0, 0, 0, 0], [0, 6, 6, 2]).includes('孤辰@hour') && SH([0, 0, 0, 0], [0, 6, 6, 10]).includes('寡宿@hour'));
assert.ok(SH([0, 0, 0, 0], [0, 6, 6, 5]).includes('文昌貴人@hour') && SH([0, 0, 0, 0], [0, 6, 6, 2]).includes('祿神@hour'));
for (const r of ['天干五合','天干相沖','六合','三合','半合','三會','六沖','相刑','自刑','六害']) assert.ok(texts.REL_INFO[r]);
for (const n of ['天乙貴人','天德貴人','月德貴人','文昌貴人','祿神','將星','紅鸞','天喜','桃花','驛馬','華蓋','羊刃','魁罡','孤辰','寡宿']) assert.ok(texts.SHENSHA_INFO[n]);

// 隨機命盤：四柱合法、日柱依日數循環、五行共八個、大運連續
let n = 0;
for (let k = 0; k < 5000; k++) {
  const y = 1901 + (k * 37) % 199, m = 1 + k % 12, d = 1 + (k * 7) % 28, hour = k % 24, minute = (k * 13) % 60;
  const c = S.chart({y, m, d, hour, minute, gender: k % 2 ? 'M' : 'F'});
  const days = Math.round(Date.UTC(y, m - 1, d) / 86400000) + (hour >= 23 ? 1 : 0);
  assert.strictEqual(c.pillars.day.index, ((17 + days) % 60 + 60) % 60);
  assert.strictEqual(Object.values(c.count).reduce((a, b) => a + b), 8);
  for (const [a, b] of c.luck.decades.slice(1).map((dc, i) => [c.luck.decades[i], dc])) assert.strictEqual((b.index - a.index + 60) % 60, c.forward ? 1 : 59);
  assert.ok(c.luck.years >= 0 && c.luck.years <= 10);
  for (const r of c.relations) assert.ok(texts.REL_INFO[r.type]);
  for (const x of c.shensha) assert.ok(texts.SHENSHA_INFO[x.name]);
  n++;
}
assert.throws(() => S.chart({y: 1900, m: 1, d: 15, hour: 8, minute: 0, gender: 'M'}));

// 真太陽時
const ts = S.trueSolar({y: 2026, m: 11, d: 12, hour: 12, minute: 0}, 121.56);
assert.strictEqual(ts.lonMin, 6); assert.strictEqual(ts.minute, 22);

// 說明文字齊全
for (const s of S.STEMS) assert.ok(texts.DAY_MASTER[s]);
for (const g of ['比肩','劫財','食神','傷官','偏財','正財','七殺','正官','偏印','正印']) assert.ok(texts.TEN_GOD[g]);
for (const e of S.ELEMENTS) assert.ok(texts.ELEMENT_INFO[e]);

console.log('PASS: solar terms vs published times; known charts; 立春 boundary; late 子; ten gods; luck pillars; flow years; ' + n + ' random charts; true solar time; 合沖刑害; 神煞; texts.');
