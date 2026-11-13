// 四時・八字排盤規則。可在瀏覽器與 Node 中執行。
(function(g){
'use strict';
const TERMS = typeof module !== 'undefined' ? require('./terms.js') : g.SISHI_TERMS;
const STEMS = '甲乙丙丁戊己庚辛壬癸'.split('');
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥'.split('');
const ELEMENTS = ['木', '火', '土', '金', '水'];
const STEM_EL = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4];
const BRANCH_EL = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4];
// 地支藏干：第一個為本氣
const HIDDEN = ['癸', '己癸辛', '甲丙戊', '乙', '戊乙癸', '丙戊庚', '丁己', '己丁乙', '庚壬戊', '辛', '戊辛丁', '壬甲'].map(s => s.split('').map(c => STEMS.indexOf(c)));
const NAYIN = ['海中金','爐中火','大林木','路旁土','劍鋒金','山頭火','澗下水','城頭土','白蠟金','楊柳木','泉中水','屋上土','霹靂火','松柏木','長流水','沙中金','山下火','平地木','壁上土','金箔金','覆燈火','天河水','大驛土','釵釧金','桑柘木','大溪水','沙中土','天上火','石榴木','大海水'];
const mod = (n, m) => ((n % m) + m) % m;
const DAY = 1440;   // 一天的分鐘數
const gz = i => STEMS[i % 10] + BRANCHES[i % 12];
const ganzhiIndex = (s, b) => mod(6 * s - 5 * b, 60);
const hourBranch = hour => Math.floor((hour + 1) / 2) % 12;
const minutesOf = (y, m, d, hh, mm) => Date.UTC(y, m - 1, d, hh, mm) / 60000;
const fromMinutes = t => { const d = new Date(t * 60000); return {y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), hour: d.getUTCHours(), minute: d.getUTCMinutes()}; };

// 十神：其他天干相對於日主
function tenGod(day, other){
  const a = STEM_EL[day], b = STEM_EL[other], same = day % 2 === other % 2;
  const rel = mod(b - a, 5);   // 0 同我、1 我生、2 我剋、3 剋我、4 生我
  return [['比肩', '劫財'], ['食神', '傷官'], ['偏財', '正財'], ['七殺', '正官'], ['偏印', '正印']][rel][same ? 0 : 1];
}

// 節：每月的起點。回傳 [{t, branch, name}]，依時間排序。
function jieList(fromYear, toYear){
  const out = [];
  for (let y = fromYear; y <= toYear; y++) {
    const row = TERMS.data[y - TERMS.start];
    if (!row) continue;
    for (let i = 0; i < 24; i += 2) out.push({t: row[i], branch: (i / 2 + 1) % 12, name: TERMS.names[i]});
  }
  return out;
}
const FIRST = TERMS.data[0][2];   // 1900 年立春
const LAST = minutesOf(2100, 12, 31, 23, 59);

// 真太陽時：經度差（每度 4 分鐘）加均時差（NOAA 近似公式，誤差約半分鐘）。
function equationOfTime(y, m, d, hour, minute){
  const doy = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000);
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const gam = 2 * Math.PI / (leap ? 366 : 365) * (doy + (hour - 8 + minute / 60 - 12) / 24);
  return 229.18 * (0.000075 + 0.001868 * Math.cos(gam) - 0.032077 * Math.sin(gam) - 0.014615 * Math.cos(2 * gam) - 0.040849 * Math.sin(2 * gam));
}
function trueSolar(t, lon){
  const lonMin = (lon - 120) * 4, eot = equationOfTime(t.y, t.m, t.d, t.hour, t.minute);
  const shift = Math.round(lonMin + eot);
  return {...fromMinutes(minutesOf(t.y, t.m, t.d, t.hour, t.minute) + shift), lonMin: Math.round(lonMin), eot: Math.round(eot), shift};
}

function pillar(i, dayStem, isDay){
  const s = i % 10, b = i % 12;
  return {
    index: i, text: gz(i), stem: STEMS[s], branch: BRANCHES[b], stemIndex: s, branchIndex: b,
    stemEl: ELEMENTS[STEM_EL[s]], branchEl: ELEMENTS[BRANCH_EL[b]],
    god: isDay ? '日主' : tenGod(dayStem, s),
    hidden: HIDDEN[b].map(h => ({stem: STEMS[h], el: ELEMENTS[STEM_EL[h]], god: tenGod(dayStem, h)})),
    nayin: NAYIN[Math.floor(i / 2)],
  };
}

/**
 * input: {y, m, d, hour, minute, gender:'M'|'F', lateZi:'next'|'same', solar?: {y,m,d,hour,minute}}
 * y/m/d/hour/minute 為 UTC+8 標準時間，用來判斷節氣（換年、換月與起運）。
 * solar 是當地的真太陽時（選用），用來定日柱與時柱；沒有時用標準時間。
 */
function chart(input){
  const {y, m, d, hour, minute, gender} = input;
  const lateZi = input.lateZi === 'same' ? 'same' : 'next';
  if (gender !== 'M' && gender !== 'F') throw Error('請選擇性別');
  const t = minutesOf(y, m, d, hour, minute);
  if (!(t >= FIRST && t <= LAST)) throw Error('目前支援 1900 年立春到 2100 年底出生的命盤');
  const local = input.solar || {y, m, d, hour, minute};

  // 年柱：以立春換年
  const lichun = TERMS.data[y - TERMS.start][2];
  const year = t >= lichun ? y : y - 1;
  const yearIdx = mod(year - 4, 60), yearStem = yearIdx % 10;

  // 月柱：以節換月，五虎遁定月干
  const jie = jieList(y - 1, y + 1);
  let k = jie.length - 1;
  while (jie[k].t > t) k--;
  const monthBranch = jie[k].branch;
  const monthStem = mod((yearStem % 5) * 2 + 2 + mod(monthBranch - 2, 12), 10);
  const monthIdx = ganzhiIndex(monthStem, monthBranch);

  // 日柱：1970/1/1 為辛巳日；晚子時（23:00 以後）可設定算作隔天
  const dayNum = Math.round(Date.UTC(local.y, local.m - 1, local.d) / 86400000);
  const late = local.hour >= 23;
  const dayIdx = mod(17 + dayNum + (late && lateZi === 'next' ? 1 : 0), 60);
  // 時柱：五鼠遁。晚子時的時干一律依隔天的日干推算。
  const hb = hourBranch(local.hour);
  const stemForHour = mod(17 + dayNum + (late ? 1 : 0), 60) % 10;
  const hourIdx = ganzhiIndex(mod((stemForHour % 5) * 2 + hb, 10), hb);

  const dayStem = dayIdx % 10;
  const pillars = {
    year: pillar(yearIdx, dayStem), month: pillar(monthIdx, dayStem),
    day: pillar(dayIdx, dayStem, true), hour: pillar(hourIdx, dayStem),
  };

  // 空亡：日柱所在旬沒有配到的兩個地支
  const xunStart = dayIdx - dayIdx % 10;
  const kong = [mod(xunStart + 10, 12), mod(xunStart + 11, 12)];

  // 五行：四柱八個字（天干與地支本身，不含藏干）
  const count = {木: 0, 火: 0, 土: 0, 金: 0, 水: 0};
  for (const p of Object.values(pillars)) { count[p.stemEl]++; count[p.branchEl]++; }

  // 大運：陽男陰女順行、陰男陽女逆行；出生到下一個（或上一個）節的時間，三天折合一年
  const yang = yearStem % 2 === 0;
  const forward = (yang && gender === 'M') || (!yang && gender === 'F');
  const target = forward ? jie.find(j => j.t > t) : jie[k];
  const span = Math.abs(target.t - t);
  const startT = t + span * 120;
  const start = fromMinutes(startT);
  const totalMonths = Math.round(span * 120 / (DAY * 365.2422 / 12));
  const decades = Array.from({length: 10}, (_, n) => {
    const idx = mod(monthIdx + (forward ? n + 1 : -(n + 1)), 60);
    const fromYear = start.y + n * 10;
    return {...pillar(idx, dayStem), fromYear, toYear: fromYear + 9, fromAge: fromYear - year + 1};
  });

  return {
    input: {...input, lateZi},
    year, yang, forward, gender, pillars, dayStem: STEMS[dayStem], dayEl: ELEMENTS[STEM_EL[dayStem]],
    kong: kong.map(b => BRANCHES[b]), count,
    jie: {name: jie[k].name, t: jie[k].t},
    luck: {start, years: Math.floor(totalMonths / 12), months: totalMonths % 12, target: target.name, decades},
    lateShift: late && lateZi === 'next',
  };
}

// 某一年的流年干支與十神
function flowYear(c, Y){
  const i = mod(Y - 4, 60), ds = STEMS.indexOf(c.dayStem);
  const decade = c.luck.decades.find(dc => Y >= dc.fromYear && Y <= dc.toYear) || null;
  return {...pillar(i, ds), year: Y, age: Y - c.year + 1, decade};
}

const api = {STEMS, BRANCHES, ELEMENTS, HIDDEN, NAYIN, tenGod, chart, flowYear, trueSolar, equationOfTime, hourBranch, gz, FIRST, LAST, jieList};
if (typeof module !== 'undefined') module.exports = api; else g.Sishi = api;
})(this);
