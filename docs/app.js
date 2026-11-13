'use strict';
const $ = s => document.querySelector(s);
const E = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const {REL_INFO, PILLAR_AREA, SHENSHA_INFO, DAY_MASTER, TEN_GOD, ELEMENT_INFO, TERMS} = window.SishiTexts;
const DM_GODS = window.SishiDmGods || {};
const ZODIAC = '鼠牛虎兔龍蛇馬羊猴雞狗豬';
const p2 = n => String(n).padStart(2, '0');
let current = null, selDecade = null, selYear = null;

// 出生地經度（縣市政府所在地附近）
const PLACES = [['基隆',121.74],['臺北',121.56],['新北',121.46],['桃園',121.30],['新竹',120.97],['苗栗',120.82],['臺中',120.68],['彰化',120.54],['南投',120.68],['雲林',120.54],['嘉義',120.45],['臺南',120.21],['高雄',120.31],['屏東',120.49],['宜蘭',121.75],['花蓮',121.60],['臺東',121.14],['澎湖',119.57],['金門',118.32],['馬祖',119.94]];

// ---------- 本機儲存（隱私：只存在這個瀏覽器） ----------
const store = {
  get(k, fallback){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
};
let saved = store.get('sishi.saved', []);
if (!Array.isArray(saved)) saved = [];

function toast(msg){ const t = $('#status'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200); }

// ---------- 台灣歷史時區（夏令時間、日治時期）換算為 UTC+8 標準時間 ----------
function taiwanExtraMinutes(y, m, d, hh, mm){
  try {
    const f = new Intl.DateTimeFormat('en-US', {timeZone: 'Asia/Taipei', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric'});
    const wall = Date.UTC(y, m - 1, d, hh, mm);
    let extra = 0;
    for (let i = 0; i < 2; i++) {
      const p = Object.fromEntries(f.formatToParts(new Date(wall - (480 + extra) * 60000)).map(x => [x.type, x.value]));
      const shown = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute);
      extra = Math.round((shown - (wall - (480 + extra) * 60000)) / 60000) - 480;
    }
    return extra;
  } catch (e) { return 0; }
}

function readForm(){
  const date = $('#date').value, time = $('#time').value;
  const gender = (document.querySelector('input[name=gender]:checked') || {}).value;
  if (!date) throw Error('請選擇國曆生日');
  if (!time) throw Error('請填寫出生時間');
  if (!gender) throw Error('請選擇性別');
  const [y, m, d] = date.split('-').map(Number), [hour, minute] = time.split(':').map(Number);
  let solar = null;
  if ($('#solar').checked) {
    const place = $('#place').value;
    const lon = place === 'custom' ? parseFloat($('#lon').value) : PLACES.find(p => p[0] === place)[1];
    if (!(lon >= -180 && lon <= 180)) throw Error('請填寫出生地的東經度數');
    solar = {place, lon};
  }
  return {name: $('#name').value.trim(), y, m, d, hour, minute, gender, taiwan: $('#taiwan').checked, solar,
    lateZi: document.querySelector('input[name=lateZi]:checked').value};
}
function fillForm(v){
  $('#name').value = v.name || '';
  $('#date').value = v.y + '-' + p2(v.m) + '-' + p2(v.d);
  $('#time').value = p2(v.hour) + ':' + p2(v.minute);
  for (const [n, val] of [['gender', v.gender], ['lateZi', v.lateZi || 'next']]) {
    const el = document.querySelector('input[name=' + n + '][value=' + val + ']'); if (el) el.checked = true;
  }
  $('#taiwan').checked = v.taiwan !== false;
  $('#solar').checked = !!v.solar;
  if (v.solar) { $('#place').value = v.solar.place; if (v.solar.place === 'custom') $('#lon').value = v.solar.lon; document.querySelector('.adv').open = true; }
  syncSolar();
}

// 依設定換算標準時間後排盤
function compute(v){
  let {y, m, d, hour, minute} = v;
  const notes = [];
  if (v.taiwan) {
    const extra = taiwanExtraMinutes(y, m, d, hour, minute), jst = Date.UTC(y, m - 1, d) < Date.UTC(1945, 8, 21);
    if (extra) {
      const t = new Date(Date.UTC(y, m - 1, d, hour, minute) - extra * 60000);
      y = t.getUTCFullYear(); m = t.getUTCMonth() + 1; d = t.getUTCDate(); hour = t.getUTCHours(); minute = t.getUTCMinutes();
      notes.push('這個日期台灣使用' + (jst ? '日治時期的時間（比現在快 1 小時）' : '夏令時間') + '，已換算為標準時間 ' + y + '/' + m + '/' + d + ' ' + p2(hour) + ':' + p2(minute) + '。');
    }
  }
  let solar = null;
  if (v.solar) {
    const sgn = n => (n >= 0 ? '+' : '−') + Math.abs(n);
    solar = Sishi.trueSolar({y, m, d, hour, minute}, v.solar.lon);
    const before = Sishi.hourBranch(hour), after = Sishi.hourBranch(solar.hour);
    notes.push('真太陽時：出生地' + (v.solar.place === 'custom' ? '' : v.solar.place) + '東經 ' + v.solar.lon + ' 度，經度差 ' + sgn(solar.lonMin) + ' 分、均時差 ' + sgn(solar.eot) + ' 分，日柱與時柱以 ' +
      solar.y + '/' + solar.m + '/' + solar.d + ' ' + p2(solar.hour) + ':' + p2(solar.minute) + ' 排定' +
      (before !== after ? '，時辰從' + Sishi.BRANCHES[before] + '時變成' + Sishi.BRANCHES[after] + '時' : '') + '。');
  }
  const c = Sishi.chart({y, m, d, hour, minute, gender: v.gender, lateZi: v.lateZi, solar});
  if (c.lateShift) notes.push('23:00 以後出生，依設定日柱算作隔天。');
  return {c, notes, v};
}

// ---------- 畫面 ----------
const PN = {year: '年', month: '月', day: '日', hour: '時'};
const KIND = {he: '合', chong: '沖', xing: '刑', hai: '害'};
const COLS = [['year', '年柱'], ['month', '月柱'], ['day', '日柱'], ['hour', '時柱']];
const elSpan = (ch, el) => '<span class="' + el + '">' + ch + '</span>';

function dmBox(c, g){
  const r = (DM_GODS[c.dayStem] || {})[g];
  if (!r) return '';
  const el = Sishi.ELEMENTS[Math.floor(Sishi.STEMS.indexOf(r[0]) / 2)];
  return '<p class="dmg"><b>' + c.dayStem + c.dayEl + '日主的' + g + '：<span class="' + el + '">' + r[0] + el + '</span></b>' + r[1] + '</p>';
}

function render(){
  const {c, notes, v} = current;
  $('#result').hidden = false;
  $('#result-title').textContent = v.name ? v.name + '的八字' : '八字';
  $('#adjust-note').hidden = !notes.length;
  $('#adjust-note').textContent = notes.join(' ');
  $('#summary').textContent = '國曆 ' + v.y + '/' + v.m + '/' + v.d + ' ' + p2(v.hour) + ':' + p2(v.minute) + '・' + (v.gender === 'M' ? '男' : '女') +
    '・生肖' + ZODIAC[Sishi.BRANCHES.indexOf(c.pillars.year.branch)] + '・出生在' + c.jie.name + '之後';

  const P = COLS.map(([k]) => c.pillars[k]);
  const td = (i, html) => '<td' + (i === 2 ? ' class="day"' : '') + '>' + html + '</td>';
  $('#pillars').innerHTML = '<caption class="sr">四柱八字</caption><thead><tr><th scope="col"><span class="sr">項目</span></th>' + COLS.map(([, n], i) => '<th scope="col"' + (i === 2 ? ' class="day"' : '') + '>' + n + '</th>').join('') + '</tr></thead><tbody>' +
    '<tr><th scope="row">十神</th>' + P.map((p, i) => td(i, '<span class="god">' + (i === 2 ? (v.gender === 'M' ? '元男' : '元女') : p.god) + '</span>')).join('') + '</tr>' +
    '<tr><th scope="row">天干</th>' + P.map((p, i) => td(i, '<span class="big ' + p.stemEl + '" aria-label="' + p.stem + '，' + p.stemEl + '">' + p.stem + '</span>')).join('') + '</tr>' +
    '<tr><th scope="row">地支</th>' + P.map((p, i) => td(i, '<span class="big ' + p.branchEl + '" aria-label="' + p.branch + '，' + p.branchEl + (c.kong.includes(p.branch) && i !== 2 ? '，空亡' : '') + '">' + p.branch + '</span>' + (c.kong.includes(p.branch) && i !== 2 ? '<span class="kong" aria-hidden="true">空</span>' : ''))).join('') + '</tr>' +
    '<tr><th scope="row">藏干</th>' + P.map((p, i) => td(i, p.hidden.map(h => '<span class="hid">' + elSpan(h.stem, h.el) + '<small>' + h.god + '</small></span>').join(''))).join('') + '</tr>' +
    '<tr><th scope="row">納音</th>' + P.map((p, i) => td(i, '<span class="ny">' + p.nayin + '</span>')).join('') + '</tr>' +
    '<tr><th scope="row">神煞</th>' + COLS.map(([k], i) => td(i, c.shensha.filter(x => x.pillar === k).map(x => '<span class="ss ss-' + SHENSHA_INFO[x.name][0] + '">' + x.name.replace(/貴人$/, '') + '</span>').join('') || '<span class="ny">—</span>')).join('') + '</tr></tbody>';

  $('#rels').innerHTML = '<h3>合沖刑害</h3>' + (c.relations.length ? '<ul class="gods">' + c.relations.map(r =>
    '<li><span class="rk rk-' + r.kind + '">' + KIND[r.kind] + '</span><b>' + r.text + '</b><small>' + r.type + '・' + r.pillars.map(k => PN[k] + '柱').join('、') + '</small><p>' + REL_INFO[r.type] + '</p></li>').join('') + '</ul>'
    : '<p class="muted">四柱之間沒有明顯的合、沖、刑、害，彼此的關係比較單純。</p>') +
    '<p class="muted">' + COLS.map(([k]) => PILLAR_AREA[k]).join('；') + '。</p>';

  const byName = {};
  for (const x of c.shensha) (byName[x.name] = byName[x.name] || []).push(x);
  const sOrder = Object.keys(SHENSHA_INFO);
  $('#stars').innerHTML = '<h3>神煞</h3>' + (c.shensha.length ? '<ul class="gods">' + Object.keys(byName).sort((x, y) => sOrder.indexOf(x) - sOrder.indexOf(y)).map(n =>
    '<li><b>' + n + '</b><small>在' + [...new Set(byName[n].map(x => PN[x.pillar] + '柱'))].join('、') + '・依' + [...new Set(byName[n].map(x => x.by))].join('、') + '</small><p>' + SHENSHA_INFO[n][1] + '</p></li>').join('') + '</ul>'
    : '<p class="muted">這張命盤沒有出現這裡列出的十五種神煞。</p>') +
    '<p class="muted">各派採用的神煞與算法不完全相同，當作參考就好。</p>';

  const [nick, text] = DAY_MASTER[c.dayStem];
  $('#dm').innerHTML = '<h3>日主</h3><div class="dm-head"><span class="dm-char ' + c.dayEl + '">' + c.dayStem + '</span><span>' + (Sishi.STEMS.indexOf(c.dayStem) % 2 ? '陰' : '陽') + c.dayEl + '・' + nick + '</span></div>' +
    '<p>' + text + '</p><p class="muted">日柱空亡：' + c.kong.join('、') + '。</p>';

  const max = Math.max(...Object.values(c.count), 1);
  $('#elements').innerHTML = '<h3>五行</h3><div class="elbars">' + Sishi.ELEMENTS.map(el => '<div class="elrow"><b class="' + el + '">' + el + '</b><span class="elbar ' + el + '" role="img" aria-label="' + el + ' ' + c.count[el] + ' 個"><span style="width:' + (c.count[el] / max * 100) + '%"></span></span><span class="n">' + c.count[el] + '</span></div>').join('') + '</div>' +
    '<p class="muted">統計四柱八個字（不含藏干）。日主屬' + c.dayEl + '：' + ELEMENT_INFO[c.dayEl] + '數量多寡只是參考，不代表好壞。</p>' +
    (Sishi.ELEMENTS.filter(el => !c.count[el]).length ? '<p class="muted">八字中沒有出現：' + Sishi.ELEMENTS.filter(el => !c.count[el]).join('、') + '。可以留意這個面向，在生活中多培養。</p>' : '');

  // 命盤中出現的十神（天干與藏干），依出現次數排列
  const gods = {};
  for (const [k] of COLS) {
    const p = c.pillars[k];
    if (k !== 'day') gods[p.god] = (gods[p.god] || 0) + 1;
    for (const h of p.hidden) gods[h.god] = (gods[h.god] || 0) + 1;
  }
  const order = Object.keys(TEN_GOD);
  $('#gods').innerHTML = '<h3>命盤中的十神</h3><ul class="gods">' + Object.entries(gods).sort((a, b) => b[1] - a[1] || order.indexOf(a[0]) - order.indexOf(b[0]))
    .map(([g, n]) => '<li><b>' + g + '</b><small>出現 ' + n + ' 次（含藏干）</small><p>' + TEN_GOD[g] + '</p>' + dmBox(c, g) + '</li>').join('') + '</ul>';

  const L = c.luck;
  $('#luck-start').textContent = (c.forward ? '順推' : '逆推') + '。出生後 ' + L.years + ' 年' + (L.months ? ' ' + L.months + ' 個月' : '') + '起運，約在 ' + L.start.y + ' 年 ' + L.start.m + ' 月交第一步大運。下方年齡為虛歲，點選大運可以看這十年的流年。';
  if (selDecade == null) {
    const now = new Date().getFullYear();
    selDecade = Math.max(0, L.decades.findIndex(dc => now >= dc.fromYear && now <= dc.toYear));
  }
  $('#luck').innerHTML = L.decades.map((dc, i) => '<button type="button" data-d="' + i + '" aria-pressed="' + (i === selDecade) + '" aria-label="' + dc.fromYear + ' 年起，虛歲 ' + dc.fromAge + ' 歲，' + dc.text + '大運，' + dc.god + '"><span class="age">' + dc.fromAge + ' 歲</span><span class="gz">' + elSpan(dc.stem, dc.stemEl) + elSpan(dc.branch, dc.branchEl) + '</span><span class="g">' + dc.god + '</span><span class="age">' + dc.fromYear + '</span></button>').join('');
  renderFlow();
}

function renderFlow(){
  const {c} = current, dc = c.luck.decades[selDecade], now = new Date().getFullYear();
  $('#flow-title').textContent = '流年（' + dc.text + '大運，' + dc.fromYear + '–' + dc.toYear + '）';
  $('#flow').innerHTML = Array.from({length: 10}, (_, k) => {
    const f = Sishi.flowYear(c, dc.fromYear + k);
    return '<button type="button" data-y="' + f.year + '" class="' + (f.year === now ? 'now' : '') + '" aria-pressed="' + (f.year === selYear) + '" aria-label="' + f.year + ' 年，' + f.text + '，虛歲 ' + f.age + '，' + f.god + (f.year === now ? '，今年' : '') + (f.relations.length ? '，與命盤有' + ['he', 'chong', 'xing', 'hai'].filter(k => f.relations.some(r => r.kind === k)).map(k => KIND[k]).join('、') : '') + '"><span class="age">' + f.year + '</span><span class="gz">' + elSpan(f.stem, f.stemEl) + elSpan(f.branch, f.branchEl) + '</span><span class="g">' + f.god + '</span><span class="fk" aria-hidden="true">' + ['he', 'chong', 'xing', 'hai'].filter(k => f.relations.some(r => r.kind === k)).map(k => '<i class="rk-' + k + '">' + KIND[k] + '</i>').join('') + '</span></button>';
  }).join('');
  showYear(selYear != null && selYear >= dc.fromYear && selYear <= dc.toYear ? selYear : null);
}

function showYear(Y){
  selYear = Y;
  document.querySelectorAll('#flow button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.y === Y)));
  if (Y == null) { $('#flow-detail').innerHTML = ''; return; }
  const c = current.c, f = Sishi.flowYear(c, Y);
  const hid = f.hidden.map(h => h.stem + '（' + h.god + '）').join('、');
  const dm = (DM_GODS[c.dayStem] || {})[f.god];
  const WITH = {year: '和年柱', month: '和月柱', day: '和日柱', hour: '和時柱', decade: '和大運', chart: '和命盤'};
  const AREA = {year: '祖上、長輩', month: '父母、手足', day: '自己與伴侶', hour: '子女、晚輩', decade: '這十年的大環境', chart: ''};
  const rels = f.relations.map(r => '<li><span class="rk rk-' + r.kind + '">' + KIND[r.kind] + '</span><b>' + r.text + '</b><small>' + WITH[r.with] + (r.with === 'decade' ? f.decade.text : r.with === 'chart' ? '' : c.pillars[r.with].text) + '・' + r.type + (AREA[r.with] ? '・' + AREA[r.with] : '') + '</small></li>').join('');
  const kinds = [...new Set(f.relations.map(r => r.type))];
  $('#flow-detail').innerHTML = '<p>' + Y + ' ' + f.text + '年（虛歲 ' + f.age + '）：流年天干「' + f.stem + '」是你的' + f.god + '，' + TEN_GOD[f.god] + (dm ? dm[1] : '') + '地支「' + f.branch + '」藏 ' + hid + '。</p>' +
    '<h4>這一年和命盤的合沖刑害</h4>' + (rels ? '<ul class="frel">' + rels + '</ul>' + kinds.map(k => '<p class="muted"><b>' + k + '</b>：' + REL_INFO[k] + '</p>').join('')
      : '<p class="muted">這一年的干支和四柱、大運之間，沒有明顯的合、沖、刑、害。</p>');
}

function renderSaved(){
  $('#saved-box').hidden = !saved.length;
  $('#saved').innerHTML = saved.map((v, k) => '<li><span>' + E(v.name || '未命名') + '　' + v.y + '/' + v.m + '/' + v.d + '</span><button type="button" data-open="' + k + '">開啟</button><button type="button" data-del="' + k + '" aria-label="刪除' + E(v.name || '未命名') + '的命盤">刪除</button></li>').join('');
}

$('#terms').innerHTML = Object.entries(TERMS).map(([k, v]) => '<dt>' + k + '</dt><dd>' + v + '</dd>').join('');
$('#place').innerHTML = PLACES.map(([n, lon]) => '<option value="' + n + '">' + n + '（東經 ' + lon.toFixed(2) + '）</option>').join('') + '<option value="custom">其他地點，自己填經度</option>';
$('#place').value = '臺北';
function syncSolar(){ $('#solar-opts').hidden = !$('#solar').checked; $('#lon-box').hidden = $('#place').value !== 'custom'; }
$('#solar').addEventListener('change', syncSolar);
$('#place').addEventListener('change', syncSolar);

function openChart(v){
  current = compute(v); selDecade = null; selYear = null;
  render(); useCount();
  $('#result-title').scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'});
  $('#result-title').setAttribute('tabindex', '-1'); $('#result-title').focus({preventScroll: true});
}
$('#form').addEventListener('submit', e => {
  e.preventDefault();
  $('#form-error').textContent = '';
  try { const v = readForm(); openChart(v); store.set('sishi.last', v); }
  catch (err) { $('#form-error').textContent = err.message; }
});
$('#luck').addEventListener('click', e => { const b = e.target.closest('[data-d]'); if (b) { selDecade = +b.dataset.d; document.querySelectorAll('#luck button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); renderFlow(); } });
$('#flow').addEventListener('click', e => { const b = e.target.closest('[data-y]'); if (b) showYear(+b.dataset.y); });
$('#save').addEventListener('click', () => {
  if (!current) return;
  const v = {...current.v};
  if (!v.name) { const n = prompt('幫這張命盤取個名字（選填）', ''); if (n === null) return; v.name = n.trim().slice(0, 20); current.v.name = v.name; render(); }
  saved = [v, ...saved.filter(s => !(s.name === v.name && s.y === v.y && s.m === v.m && s.d === v.d && s.hour === v.hour && s.minute === v.minute && s.gender === v.gender && JSON.stringify(s.solar || null) === JSON.stringify(v.solar || null)))].slice(0, 30);
  toast(store.set('sishi.saved', saved) ? '已儲存' : '這個瀏覽器無法儲存');
  renderSaved();
});
$('#saved').addEventListener('click', e => {
  const o = e.target.closest('[data-open]'), d = e.target.closest('[data-del]');
  if (o) { const v = saved[+o.dataset.open]; fillForm(v); try { openChart(v); } catch (err) { toast(err.message); } }
  if (d) { const v = saved[+d.dataset.del]; if (confirm('確定要刪除「' + (v.name || '未命名') + '」的命盤嗎？')) { saved.splice(+d.dataset.del, 1); store.set('sishi.saved', saved); renderSaved(); toast('已刪除'); } }
});

const last = store.get('sishi.last', null);
if (last && last.y) fillForm(last);
renderSaved();

// 使用次數：每次排盤記一筆到 GoatCounter，並在頁尾顯示累計次數（只記次數，不送出任何生日資料）。
const usagePath = 'sishi-chart';
function useCount(){ try { const gc = window.goatcounter; if (gc && gc.count) gc.count({path: usagePath, title: '四時排盤', event: true, no_session: true}); } catch (e) {} }
fetch('https://imqingstone.goatcounter.com/counter/' + usagePath + '.json').then(r => r.ok ? r.json() : null)
  .then(d => { const el = document.getElementById('usage'); if (el && d && d.count) { el.textContent = '已排過 ' + d.count + ' 張八字'; el.hidden = false; } }).catch(() => {});
