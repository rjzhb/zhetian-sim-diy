/* 可玩性研究探针：事件乏味度 + 成帝便利度。跑完打印一版数字，不当验收红线。 */
var Sim = require('../sim.js');
var D = require('../data.js');
var E = require('../events.js');

function byId(id) {
  for (var i = 0; i < E.length; i++) if (E[i].id === id) return E[i];
  return null;
}
function phys(id) {
  var list = D.PHYSIQUES || [];
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return list[0];
}
function pickOption(choice, style) {
  if (!choice || !choice.options) return null;
  if (style === 'allin') {
    var i, best = null;
    for (i = 0; i < choice.options.length; i++) {
      var o = choice.options[i];
      if (o && o.risk === 'deadly' && (o.chance == null || o.chance >= 0.22)) best = o;
    }
    if (best) return best.id;
  }
  return Sim.defaultChoiceOption(choice);
}
function spanOf(lvl) {
  if (lvl < 71) return 'pre';
  if (lvl < 91) return 'mid';
  return 'late';
}

/* 爽感分：看过多少事 + 改命闸门合度 + 高光 − 帝关刷屏 − 重复作业。
 * 停屏只留给改命闸门。短命目标 1–3 窗，活到圣人 3–6 窗；超过 8 一律不及格。 */
function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
function popFit(pops, saint) {
  var lo = saint ? 3 : 1, hi = saint ? 6 : 3;
  if (pops > 8) return 0;
  if (pops < lo) return lo ? pops / lo : 0;
  if (pops <= hi) return 1;
  return clamp01(1 - (pops - hi) / hi);
}
function thrillScore(row) {
  var pops = row.pops || 0;
  var unique = row.unique || 0;
  var repeats = row.repeats || 0;
  var gate = row.gate || 0;
  var t3 = row.t3 || 0;
  var spot = row.spot || 0;
  var flavor = row.flavor || 0;
  var stories = (row.pre || 0) + (row.mid || 0) + (row.late || 0) + flavor;
  var variety = unique / Math.max(1, pops);
  var gateShare = gate / Math.max(1, pops);
  var repeatShare = repeats / Math.max(1, pops);
  var raw = 100 * (
    0.16 * popFit(pops, row.saint) +
    0.14 * clamp01(variety) +
    0.16 * clamp01(t3 / 2) +
    0.16 * clamp01(spot / 2) +
    0.14 * clamp01(unique / 3) +
    0.24 * clamp01(stories / 10)
  ) - 25 * Math.max(0, gateShare - 0.25) - 15 * Math.max(0, repeatShare - 0.20);
  return Math.round(clamp01(raw / 100) * 1000) / 10;
}

function runOne(physId, gift, style) {
  var g = Sim.createGame(60, [], { tier: gift });
  Sim.setPhysique(g, phys(physId));
  var y = 0, pops = [], seen = {}, repeats = 0;
  var lastId = null, lastGap = 0, gaps = [];
  while (!g.dead && !g.ascended && !g.becameEmperor && y < 80000) {
    y++;
    Sim.rollYear(g);
    var guard = 0;
    while (g.pendingChoice && guard < 8) {
      guard++;
      var id = g.pendingChoice.evId || g.pendingChoice.id || g.pendingChoice.title;
      var ev = byId(g.pendingChoice.evId);
      pops.push({
        id: id,
        tier: ev ? ev.tier : 0,
        tag: ev ? ev.tag : '',
        span: spanOf(g.lvl || 1),
        lvl: g.lvl,
        age: g.age
      });
      if (seen[id]) repeats++;
      seen[id] = (seen[id] || 0) + 1;
      if (lastId) gaps.push(g.age - lastGap);
      lastId = id;
      lastGap = g.age;
      Sim.resolveChoice(g, pickOption(g.pendingChoice, style), []);
    }
  }
  var unique = Object.keys(seen).length;
  var firstCreate = '';
  for (var fi = 0; fi < pops.length; fi++) {
    if (pops[fi].tag === 'create') { firstCreate = pops[fi].id; break; }
  }
  return {
    phys: physId, gift: gift, style: style,
    emperor: !!(g.becameEmperor || g.emperor),
    ascended: !!g.ascended,
    dead: !!g.dead,
    cause: g.deadCause || (g.becameEmperor ? 'emperor' : ''),
    lvl: g.lvl || 1,
    age: g.age || 0,
    quasi: (g.lvl || 1) >= 91,
    saint: (g.lvl || 1) >= 71,
    pops: pops.length,
    unique: unique,
    repeats: repeats,
    pre: (g.eventDrawsBySpan && g.eventDrawsBySpan.pre) || 0,
    mid: (g.eventDrawsBySpan && g.eventDrawsBySpan.mid) || 0,
    late: (g.eventDrawsBySpan && g.eventDrawsBySpan.late) || 0,
    t4: pops.filter(function (p) { return p.tier >= 4; }).length,
    t3: pops.filter(function (p) { return p.tier >= 3; }).length,
    create: pops.filter(function (p) { return p.tag === 'create'; }).length,
    gate: pops.filter(function (p) { return p.id === 'imperial_gate'; }).length,
    spot: g.spotlightCount || 0,
    flavor: Math.max(0, (g.eventDraws || 0) - ((g.eventDrawsBySpan && ((g.eventDrawsBySpan.pre || 0) + (g.eventDrawsBySpan.mid || 0) + (g.eventDrawsBySpan.late || 0))) || 0)),
    firstCreate: firstCreate,
    ids: seen
  };
}

function summarize(rows) {
  function avg(key) {
    var s = 0, i;
    for (i = 0; i < rows.length; i++) s += rows[i][key] || 0;
    return s / rows.length;
  }
  function rate(fn) {
    var s = 0, i;
    for (i = 0; i < rows.length; i++) if (fn(rows[i])) s++;
    return s / rows.length;
  }
  var causes = {}, tops = {}, firsts = {}, i, k;
  for (i = 0; i < rows.length; i++) {
    causes[rows[i].cause || 'live'] = (causes[rows[i].cause || 'live'] || 0) + 1;
    if (rows[i].firstCreate) firsts[rows[i].firstCreate] = (firsts[rows[i].firstCreate] || 0) + 1;
    for (k in rows[i].ids) tops[k] = (tops[k] || 0) + rows[i].ids[k];
  }
  var topList = Object.keys(tops).sort(function (a, b) { return tops[b] - tops[a]; }).slice(0, 8);
  var feel = 0;
  for (i = 0; i < rows.length; i++) feel += thrillScore(rows[i]);
  return {
    n: rows.length,
    emperor: rate(function (r) { return r.emperor; }),
    quasi: rate(function (r) { return r.quasi; }),
    saint: rate(function (r) { return r.saint; }),
    lvl: avg('lvl'),
    age: avg('age'),
    pops: avg('pops'),
    unique: avg('unique'),
    repeats: avg('repeats'),
    pre: avg('pre'),
    mid: avg('mid'),
    late: avg('late'),
    t4: avg('t4'),
    t3: avg('t3'),
    create: avg('create'),
    gate: avg('gate'),
    spot: avg('spot'),
    flavor: avg('flavor'),
    thrill: Math.round(feel / rows.length * 10) / 10,
    causes: causes,
    firstCreate: Object.keys(firsts).sort(function (a, b) { return firsts[b] - firsts[a]; })
      .map(function (id) { return id + ':' + firsts[id]; }),
    top: topList.map(function (id) { return id + ':' + tops[id]; })
  };
}

function batch(physId, gift, style, n) {
  var rows = [], i;
  for (i = 0; i < n; i++) rows.push(runOne(physId, gift, style));
  return summarize(rows);
}

var N = 40;
var report = {
  mortal5_safe: batch('mortal', 5, 'safe', N),
  mortal10_safe: batch('mortal', 10, 'safe', N),
  mortal10_allin: batch('mortal', 10, 'allin', N),
  sacred8_safe: batch('sacred', 8, 'safe', N),
  chaos10_safe: batch('chaos', 10, 'safe', N)
};
console.log(JSON.stringify(report, null, 2));
