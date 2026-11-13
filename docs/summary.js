// 八字白話總結：把命盤的重點整理成幾段話。語氣是認識自己的參考，不做吉凶斷語。
(function(g){
const ELEM_MANY = {
  木: '木的力量明顯，你重視成長與規劃，做事有往上發展的企圖心',
  火: '火的力量明顯，你熱情、有行動力，情緒和想法都很容易表現出來',
  土: '土的力量明顯，你穩重、重信用，習慣替身邊的人撐住局面',
  金: '金的力量明顯，你做事果斷、講原則，對是非對錯很有自己的標準',
  水: '水的力量明顯，你聰明、靈活，想法多，也很能感受別人的情緒',
};
const ELEM_LACK = {
  木: '多接近大自然、替自己訂學習或成長的計畫',
  火: '多參加讓自己有熱情的活動，也練習把感受說出來',
  土: '替生活建立固定的作息與習慣，讓自己有穩定的根',
  金: '練習果斷做決定，也替自己設下清楚的界線',
  水: '多閱讀、多交流，讓自己保持彈性與流動',
};
// 十神的關鍵詞與提醒
const GOD_KEY = {
  比肩: ['自主與同輩的力量', '很有主見，也重視朋友'],
  劫財: ['行動力與合作', '敢衝，也懂得和夥伴一起前進'],
  食神: ['才華與享受生活', '溫和、有創意，懂得讓自己過得舒服'],
  傷官: ['表達與創新', '聰明、有想法，常想突破既有的框架'],
  偏財: ['機會與人際手腕', '反應快，懂得把握機會'],
  正財: ['務實與責任', '踏實可靠，願意為生活穩穩付出'],
  七殺: ['魄力與挑戰', '面對壓力反而有鬥志'],
  正官: ['規範與名譽', '有分寸、守規矩，重視別人的信任'],
  偏印: ['獨特的思考與專業', '直覺敏銳，喜歡鑽研自己有興趣的領域'],
  正印: ['學習與照顧', '溫和、好學，也容易得到長輩的照顧'],
};
const GOD_TIP = {
  比肩: '多聽聽不同的意見，主見會更有份量',
  劫財: '留意資源的分配，衝之前先想一下',
  食神: '享受之餘，也替自己訂一點目標',
  傷官: '表達時多一分溫和，想法更容易被接受',
  偏財: '機會多的時候，記得穩健理財',
  正財: '別把自己逼得太緊，也留時間休息',
  七殺: '壓力大的時候，記得適時放鬆',
  正官: '別讓規矩綁住自己，偶爾給自己一點彈性',
  偏印: '把想法和別人分享，會有更多交流',
  正印: '接受照顧之餘，也練習自己做決定',
};

function summarize(c, T, DMG, thisYear){
  const out = [];
  const [nick, text] = T.DAY_MASTER[c.dayStem];
  out.push(['你是什麼樣的人', '你的日主是' + c.dayStem + c.dayEl + '，意象是「' + nick + '」。' + text]);

  // 五行
  const counts = Object.entries(c.count), max = Math.max(...counts.map(x => x[1]));
  const many = counts.filter(x => x[1] === max && max >= 3).map(x => x[0]);
  const lack = counts.filter(x => x[1] === 0).map(x => x[0]);
  let el = '';
  if (many.length) el += many.map(e => ELEM_MANY[e]).join('；') + '。';
  else el += '八字裡五行分布得比較平均，各方面的特質都有一些。';
  if (lack.length) el += '八字中沒有' + lack.join('、') + '，可以' + lack.map(e => ELEM_LACK[e]).join('；也可以') + '。';
  out.push(['五行的樣子', el]);

  // 十神
  const gods = {};
  for (const k of ['year', 'month', 'day', 'hour']) {
    const p = c.pillars[k];
    if (k !== 'day') gods[p.god] = (gods[p.god] || 0) + 1;
    for (const h of p.hidden) gods[h.god] = (gods[h.god] || 0) + 1;
  }
  const order = Object.keys(GOD_KEY);
  const top = Object.entries(gods).sort((a, b) => b[1] - a[1] || order.indexOf(a[0]) - order.indexOf(b[0])).slice(0, 2).map(x => x[0]);
  out.push(['你的優勢', '命盤中最明顯的是' + top.map(x => x + '（' + GOD_KEY[x][0] + '）').join('和') + '，代表你' + top.map(x => GOD_KEY[x][1]).join('；同時') + '。' +
    (DMG && DMG[c.dayStem] && DMG[c.dayStem][top[0]] ? '以你的日主來看，' + DMG[c.dayStem][top[0]][1] : '')]);

  // 提醒：十神提醒加上合沖
  const kinds = new Set(c.relations.map(r => r.kind));
  let tip = top.map(x => GOD_TIP[x]).join('；') + '。';
  if (kinds.has('chong')) tip += '命盤中有沖，生活中變動的機會比較多，變動也是調整的機會。';
  if (kinds.has('xing') || kinds.has('hai')) tip += '命盤中有刑或害，人際上容易有需要磨合的地方，多一點耐心與溝通就好。';
  if (!kinds.has('chong') && kinds.has('he')) tip += '命盤中以合為主，你重視關係與合作，也留意別因為顧慮別人而委屈自己。';
  if (!c.relations.length) tip += '四柱之間的關係單純，比較能照自己的步調前進。';
  out.push(['可以留意的地方', tip]);

  // 現在這個階段
  const dc = c.luck.decades.find(d => thisYear >= d.fromYear && thisYear <= d.toYear);
  const fy = g.Sishi ? g.Sishi.flowYear(c, thisYear) : (typeof require !== 'undefined' ? require('./engine.js').flowYear(c, thisYear) : null);
  let now = '';
  if (dc) now += '你目前走' + dc.text + '大運（' + dc.fromYear + '–' + dc.toYear + '），大運天干是' + dc.god + '，這十年的主題偏向' + GOD_KEY[dc.god][0] + '。';
  else if (thisYear < c.luck.decades[0].fromYear) now += '你還沒交第一步大運，目前以本命的特質為主。';
  if (fy) {
    now += thisYear + ' 年是' + fy.text + '年，流年天干是你的' + fy.god + '，今年比較明顯的主題是' + GOD_KEY[fy.god][0] + '。';
    const fk = ['he', 'chong', 'xing', 'hai'].filter(k => fy.relations.some(r => r.kind === k)).map(k => ({he: '合', chong: '沖', xing: '刑', hai: '害'})[k]);
    now += fk.length ? '今年和命盤之間有' + fk.join('、') + '，可以到下方流年看是和哪一柱。' : '今年和命盤之間沒有明顯的合沖刑害，步調比較平穩。';
  }
  if (now) out.push(['現在這個階段', now]);
  return out;
}
const api = {summarize, ELEM_MANY, ELEM_LACK, GOD_KEY, GOD_TIP};
if (typeof module !== 'undefined') module.exports = api; else g.SishiSummary = api;
})(this);
