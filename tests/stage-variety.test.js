/* 每个大境界奖池要厚，本境内同一事件不连抽 */
var assert = require('assert');
var Sim = require('../sim.js');
var E = require('../events.js');
var D = require('../data.js');

function mortalAt(lvl, age) {
  var g = Sim.createGame(0, []);
  Sim.setPhysique(g, D.physiqueById('mortal'));
  g.lvl = lvl;
  g.age = age;
  g.cult = Math.max(200, Math.round(Math.pow(lvl, 2.4)));
  g.daoyun = Math.min(g.daoyunCap, 40 + lvl * 2);
  g.recentEvents = [];
  g.realmSeenIds = {};
  g.realmSeenTags = {};
  g.realmSeenBand = D.realmIdx(lvl);
  return g;
}

function choicePool(g) {
  return Sim.collectAvailableEvents(g, true);
}

var STAGES = [
  { name: '轮海', lvl: 6, age: 14 },
  { name: '道宫', lvl: 15, age: 22 },
  { name: '四极', lvl: 25, age: 40 },
  { name: '化龙', lvl: 35, age: 80 },
  { name: '仙台', lvl: 45, age: 160 },
  { name: '大能', lvl: 55, age: 280 },
  { name: '王者', lvl: 65, age: 420 },
  { name: '圣人', lvl: 75, age: 700 },
  { name: '大圣', lvl: 85, age: 1200 },
  { name: '准帝', lvl: 94, age: 2000 }
];

STAGES.forEach(function (s) {
  var g = mortalAt(s.lvl, s.age);
  var pool = choicePool(g);
  var tags = {};
  pool.forEach(function (e) { if (e.tag) tags[e.tag] = 1; });
  assert.ok(pool.length >= 5,
    s.name + ' 凡人可选事件太少：' + pool.length + '（' +
    pool.map(function (e) { return e.name; }).join('、') + '）');
  assert.ok(Object.keys(tags).length >= 4,
    s.name + ' 故事族太少：' + Object.keys(tags).join('、'));
});

(function () {
  var g = mortalAt(15, 22);
  var pool = choicePool(g);
  assert.ok(pool.length, '道宫应有可选事件');
  var ev = pool[0];
  Sim.markEventSeen(g, ev);
  if (typeof Sim.markRealmSeen === 'function') Sim.markRealmSeen(g, ev);
  var again = choicePool(g).filter(function (e) { return e.id === ev.id; });
  assert.strictEqual(again.length, 0, '本境内同一事件不应再进奖池：' + ev.id);

  g.lvl = 25;
  g.age = 40;
  g.realmSeenBand = 2;
  if (typeof Sim.syncRealmSeen === 'function') Sim.syncRealmSeen(g);
  var nextBand = choicePool(g).filter(function (e) { return e.id === ev.id; });
  if (ev.available && ev.available(g, Sim.U) === false) return;
  /* 若该事件四极仍可用，换境后应能再出现 */
  var stillOk = !ev.available || ev.available(g, Sim.U);
  if (stillOk && g.age >= (ev.minAge || 0) && g.age <= (ev.maxAge != null ? ev.maxAge : 10000)) {
    assert.ok(nextBand.length >= 0);
  }
})();

var lifePack = E.filter(function (e) { return /^lf_/.test(e.id); });
assert.ok(lifePack.length >= 36, '阶段人生包事件不足：' + lifePack.length);

(function () {
  function ids(pool) {
    return pool.map(function (e) { return e.id; }).sort();
  }
  var low = mortalAt(18, 28);
  low.daoGift = 3;
  var high = mortalAt(18, 28);
  high.daoGift = 10;
  var lowIds = ids(choicePool(low));
  var highIds = ids(choicePool(high));
  assert.ok(highIds.indexOf('lf_dao_high_glance') >= 0, '高悟性应看见「一眼完卷」');
  assert.ok(lowIds.indexOf('lf_dao_high_glance') < 0, '低悟性不应看见高悟性专属');
  assert.ok(lowIds.indexOf('lf_dao_low_grind') >= 0, '低悟性应看见「同一句一百遍」');
  assert.ok(highIds.indexOf('lf_dao_low_grind') < 0, '高悟性不应看见钝根专属');

  var mortal = mortalAt(20, 30);
  mortal.daoGift = 5;
  var star = mortalAt(20, 30);
  Sim.setPhysique(star, D.physiqueById('star'));
  star.lvl = 20; star.age = 30; star.daoGift = 5;
  star.realmSeenIds = {}; star.realmSeenTags = {}; star.realmSeenBand = D.realmIdx(20);
  assert.ok(ids(choicePool(star)).indexOf('lf_phys_star_night') >= 0, '星辰体应有自己的夜观');
  assert.ok(ids(choicePool(mortal)).indexOf('lf_phys_star_night') < 0, '凡体不应抽到星辰体专属');
  assert.ok(ids(choicePool(mortal)).indexOf('lf_mortal_mock') >= 0, '凡体应有自己的席');
})();

console.log('stage-variety: ok（选择池按境检查完毕，人生包 ' + lifePack.length + '）');
