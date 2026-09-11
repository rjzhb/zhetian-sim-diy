/* 中期节奏：站稳再问、开局按族限流、战力够进准帝、圣人创法窗口 */
var assert = require('assert');
var Sim = require('../sim.js');
var E = require('../events.js');
var D = require('../data.js');

function byId(id) {
  for (var i = 0; i < E.length; i++) if (E[i].id === id) return E[i];
  return null;
}

function mortalSage(opt) {
  opt = opt || {};
  var g = Sim.createGame(0, opt.traits || []);
  Sim.setPhysique(g, D.physiqueById('mortal'));
  g.innate = 1;
  g.aptitude = 1;
  g.daoGift = opt.gift != null ? opt.gift : 5;
  g.lvl = 90;
  g.daoyunCap = Math.max(g.daoyunCap || 0, 2000);
  g.daoyun = opt.daoyun != null ? opt.daoyun : Sim.effectiveDaoyunNeed(g, 90);
  g.cult = opt.cult != null ? opt.cult : 80000;
  g.swallowingArt = false;
  return g;
}

/* ---------- 凡体墙：三条可过，空修仍过不去 ---------- */
(function () {
  var blocked = mortalSage({ cult: 80000, gift: 5 });
  assert.ok(blocked.daoyun >= Sim.effectiveDaoyunNeed(blocked, 90), '测试前置：道蕴已够');
  assert.strictEqual(Sim.canAdvance(blocked), false, '凡体大圣无帝路、战力不够，墙还在');

  var byPower = mortalSage({ cult: 280000 });
  assert.strictEqual(Sim.canAdvance(byPower), true, '战力顶到大圣天花板附近应能进准帝');

  var byRes = mortalSage({ traits: ['o21', 'o25'], cult: 80000 });
  assert.strictEqual(byRes.resonance, 'imperial', '双金帝路应共鸣');
  assert.strictEqual(Sim.canAdvance(byRes), true, '帝路共鸣应能越过凡体墙');

  var byGold = mortalSage({ traits: ['o21', 'o06'], cult: 80000 });
  assert.ok(byGold.resonance !== 'imperial', '单张帝路金卡不应算共鸣');
  assert.strictEqual(Sim.canAdvance(byGold), true, '有帝路金卡也应能越过凡体墙');
})();

/* ---------- 低阶秘境降权 ---------- */
(function () {
  var ev = byId('rd_mi_low_delve');
  assert.ok(ev, '低阶秘境事件应存在');
  assert.ok(ev.weight <= 1.25, '低阶秘境权重应降到约 1.2，实际 ' + ev.weight);
  assert.ok(ev.maxCount <= 2, '低阶秘境 maxCount 应收至 2，实际 ' + ev.maxCount);
})();

/* ---------- 近 6 次同一 tag 硬限 ---------- */
(function () {
  assert.strictEqual(typeof Sim.collectAvailableEvents, 'function', '应导出 collectAvailableEvents');
  assert.strictEqual(typeof Sim.eventTagBlocked, 'function', '应导出 eventTagBlocked');
  var g = Sim.createGame(0, []);
  g.lvl = 25;
  g.age = 40;
  g.recentEvents = [
    { id: 'rd_mi_low_delve', tag: 'dungeon' },
    { id: 'a', tag: 'sect' },
    { id: 'b', tag: 'insight' },
    { id: 'c', tag: 'refine' },
    { id: 'd', tag: 'era' },
    { id: 'e', tag: 'nemesis' }
  ];
  assert.strictEqual(Sim.eventTagBlocked(g, { id: 'rd_mi_low_outer', tag: 'dungeon' }), true,
    '近 6 次已有 dungeon，同族应被硬挡');
  var pool = Sim.collectAvailableEvents(g, false);
  var dungeon = pool.filter(function (e) { return e.tag === 'dungeon'; });
  assert.strictEqual(dungeon.length, 0, '近 6 次已有 dungeon 时奖池不应再出秘境');
})();

/* ---------- 保底抉择：站稳再问，不发死局作业 ---------- */
(function () {
  assert.strictEqual(typeof Sim.ensureRealmChoice, 'function', '应导出 ensureRealmChoice');

  var fresh = Sim.createGame(0, []);
  Sim.setPhysique(fresh, D.physiqueById('mortal'));
  fresh.lvl = 15;
  fresh.age = 16;
  fresh.realmEnterAge = { 2: 16 };
  fresh.choiceByRealm = {};
  fresh.recentEvents = [];
  Sim.ensureRealmChoice(fresh, []);
  assert.ok(!fresh.pendingChoice, '本境未满 12 年不应弹保底抉择');

  var sea = Sim.createGame(0, []);
  Sim.setPhysique(sea, D.physiqueById('mortal'));
  sea.lvl = 6;
  sea.age = 20;
  sea.realmEnterAge = { 1: 6 };
  sea.choiceByRealm = {};
  Sim.ensureRealmChoice(sea, []);
  if (sea.pendingChoice) {
    var seaEv = byId(sea.pendingChoice.evId);
    assert.ok(Sim.isThrillEvent(seaEv), '轮海若弹窗必须是争锋一类，不能是村井琐事');
  }

  fresh.age = 28;
  Sim.ensureRealmChoice(fresh, []);
  assert.ok(fresh.pendingChoice, '本境待满 12 年应弹一次保底抉择');
  assert.notStrictEqual(fresh.pendingChoice.evId, 'phy_dixue_cuiti', '保底作业不应是帝血淬体');
  assert.notStrictEqual(fresh.pendingChoice.evId, 'phy_hundunqi_cuiti', '保底作业不应是混沌气淬体');
})();

(function () {
  var i, titles = {}, dungeonHits = 0;
  for (i = 0; i < 24; i++) {
    var g = Sim.createGame(0, []);
    Sim.setPhysique(g, D.physiqueById('mortal'));
    g.lvl = 25;
    g.age = 40;
    g.realmEnterAge = { 3: 20 };
    g.choiceByRealm = {};
    g.choiceTags = { dungeon: 1 };
    g.recentEvents = [{ id: 'rd_mi_low_delve', tag: 'dungeon' }];
    g.realmSeenIds = { rd_mi_low_delve: 1 };
    g.realmSeenTags = { dungeon: 1 };
    g.realmSeenBand = 3;
    Sim.ensureRealmChoice(g, []);
    if (!g.pendingChoice) continue;
    var ev = byId(g.pendingChoice.evId);
    if (ev && ev.tag === 'dungeon') dungeonHits++;
    titles[g.pendingChoice.title || g.pendingChoice.evId] = 1;
  }
  assert.strictEqual(dungeonHits, 0, '秘境已经出过时，道宫保底不应再发秘境');
  assert.ok(Object.keys(titles).length >= 3, '保底应按故事族轮转，不能总是同一张：' + Object.keys(titles).join('、'));
})();

(function () {
  var i, dungeonHits = 0, deadlyHits = 0;
  for (i = 0; i < 40; i++) {
    var g = Sim.createGame(0, []);
    Sim.setPhysique(g, D.physiqueById('mortal'));
    g.lvl = 42;
    g.age = 80;
    g.cult = 20000;
    g.daoyun = 200;
    g.realmEnterAge = { 5: 60 };
    g.choiceByRealm = {};
    g.recentEvents = [];
    Sim.ensureRealmChoice(g, []);
    if (!g.pendingChoice) continue;
    var id = g.pendingChoice.evId;
    var ev = byId(id);
    if (ev && ev.tag === 'dungeon') dungeonHits++;
    if (id === 'phy_dixue_cuiti' || id === 'phy_hundunqi_cuiti') deadlyHits++;
    if (ev && ev.tier >= 4) deadlyHits++;
  }
  assert.strictEqual(deadlyHits, 0, '化龙之后保底作业不应发传说死局，实际 ' + deadlyHits);
  assert.strictEqual(dungeonHits, 0, '化龙之后不应再保送秘境作业，实际 ' + dungeonHits);
})();

/* ---------- 创法窗口：圣人后填充 0.18 强制可见 ---------- */
(function () {
  assert.strictEqual(typeof Sim.maybeArtGlimpse, 'function', '应导出 maybeArtGlimpse');
  assert.strictEqual(typeof Sim.daoFill, 'function', '应导出 daoFill');

  var early = Sim.createGame(0, []);
  early.lvl = 25;
  early.daoyunCap = 1000;
  early.daoyun = 190;
  assert.ok(Sim.daoFill(early) >= 0.18 && Sim.daoFill(early) < 0.20, '前置：填充在 0.18~0.20');
  Sim.maybeArtGlimpse(early, []);
  assert.strictEqual(early.artGlimpse, false, '道宫期填充不到 0.20 不应提前立法窗口');

  var saint = Sim.createGame(0, []);
  saint.lvl = 71;
  saint.daoyunCap = 1000;
  saint.daoyun = 180;
  var log = [];
  Sim.maybeArtGlimpse(saint, log);
  assert.strictEqual(saint.artGlimpse, true, '圣人后填充 ≥ 0.18 应强制给一次创法窗口');
  assert.ok(log.length > 0, '创法窗口必须写进日志，玩家看得见');
})();

/* ---------- 悟性卡保底：见过窗口后必须弹出创法抉择 ---------- */
(function () {
  assert.strictEqual(typeof Sim.ensureArtChoice, 'function', '应导出 ensureArtChoice');
  assert.strictEqual(typeof Sim.daoArtGuarantee, 'function', '应导出 daoArtGuarantee');

  var gold = Sim.createGame(0, ['o06', 'o07'], { tier: 5, name: '颖悟', initialDaoyun: 70 });
  assert.ok(Sim.daoArtGuarantee(gold), '金悟道应认定为本局有创法保底');
  gold.lvl = 25;
  gold.age = 80;
  gold.artGlimpse = true;
  Sim.ensureArtChoice(gold, []);
  assert.ok(gold.pendingChoice, '金悟道见过立法窗口后应保底弹出创法抉择');
  assert.ok(gold.pendingChoice.options.some(function (o) { return o.id && o.id.indexOf('art_') === 0; }),
    '保底创法弹窗必须带落笔选项');
  assert.strictEqual(gold.artHomework, true, '创法保底每生只发一次');
  var firstId = gold.pendingChoice.evId;
  gold.pendingChoice = null;
  Sim.ensureArtChoice(gold, []);
  assert.ok(!gold.pendingChoice, '同一生不应连发两次创法保底，实际又弹出了 ' + (gold.pendingChoice && gold.pendingChoice.evId));
  assert.ok(firstId, '保底事件应有 id');

  var guard = byId('dao_create_guard_first');
  assert.ok(guard && typeof guard.choice === 'function' && typeof guard.resolve === 'function',
    '道宫入口创法必须是抉择，不能再自动写完');

  var plain = Sim.createGame(0, [], { tier: 5, name: '颖悟', initialDaoyun: 70 });
  assert.ok(!Sim.daoArtGuarantee(plain), '无悟性卡的悟性5不应保送创法');
  plain.lvl = 25;
  plain.age = 80;
  plain.artGlimpse = true;
  plain.daoyun = 400;
  plain.daoyunCap = 1000;
  Sim.ensureArtChoice(plain, []);
  assert.ok(!plain.pendingChoice, '普通悟性5见窗口也不该保送创法抉择');

  var born = Sim.createGame(0, [], { tier: 10, name: Sim.daoGiftName(10), initialDaoyun: 1000 });
  assert.ok(Sim.daoArtGuarantee(born), '出生悟性 10 即使没选悟性卡也应有创法保底');
  born.lvl = 25;
  born.age = 80;
  born.artGlimpse = true;
  Sim.ensureArtChoice(born, []);
  assert.ok(born.pendingChoice, '天生满悟在道宫见窗口后也应弹出创法抉择');
})();

/* ---------- 谋划红利：会选的人把选择题兑成成帝资本 ---------- */
(function () {
  assert.strictEqual(typeof Sim.judgePlanPick, 'function', '应导出 judgePlanPick');
  assert.strictEqual(typeof Sim.applyPlanDividend, 'function', '应导出 applyPlanDividend');

  var g = Sim.createGame(0, [], { tier: 5, name: '颖悟', initialDaoyun: 70 });
  g.lvl = 25;
  var createChoice = {
    id: 'dao_seclusion',
    options: [
      { id: 'art_guard', label: '推演护道法', chance: 0.62 },
      { id: 'wait', label: '暂缓', safe: true }
    ]
  };
  assert.strictEqual(Sim.judgePlanPick(g, createChoice, createChoice.options[0]), 'good',
    '创法把握过半应当落笔');
  assert.strictEqual(Sim.judgePlanPick(g, createChoice, createChoice.options[1]), 'bad',
    '创法把握过半还退避，是不会看数');

  var early = Sim.createGame(0, [], { tier: 5, name: '颖悟', initialDaoyun: 70 });
  early.lvl = 8;
  var trap = {
    options: [
      { id: 'allin', risk: 'deadly', chance: 0.24, deathChance: 0.40 },
      { id: 'leave', safe: true }
    ]
  };
  assert.strictEqual(Sim.judgePlanPick(early, trap, trap.options[1]), 'good',
    '轮海里低把握高致死的梭哈，退避才是谋划');
  assert.strictEqual(Sim.judgePlanPick(early, trap, trap.options[0]), 'bad',
    '轮海里拿命去填 24% 的梭哈，不是谋划');

  var mid = Sim.createGame(0, [], { tier: 5, name: '颖悟', initialDaoyun: 70 });
  mid.lvl = 45;
  mid.cult = 8000;
  var allinChoice = {
    options: [
      { id: 'watch', safe: true },
      { id: 'allin', risk: 'deadly', chance: 0.48, deathChance: 0.12 }
    ]
  };
  assert.strictEqual(Sim.judgePlanPick(mid, allinChoice, allinChoice.options[1]), 'good',
    '四极后把握近半、致死不高的梭哈，该拿来换战力');

  var gateLow = {
    id: 'imperial_gate',
    options: [
      { id: 'strike', risk: 'deadly', chance: 0.22 },
      { id: 'wait', safe: true }
    ]
  };
  var waiter = Sim.createGame(0, [], { tier: 5, name: '颖悟', initialDaoyun: 70 });
  waiter.lvl = 99;
  waiter.lifespan = 9000;
  waiter.age = 2000;
  assert.strictEqual(Sim.judgePlanPick(waiter, gateLow, gateLow.options[1]), 'good',
    '帝关把握两成且余寿还长，再压才是谋划');
  assert.strictEqual(Sim.judgePlanPick(waiter, gateLow, gateLow.options[0]), 'bad',
    '把握两成就硬叩，是把布局交回给运气');

  var planner = Sim.createGame(0, [], { tier: 5, name: '颖悟', initialDaoyun: 70 });
  Sim.setPhysique(planner, D.physiqueById('mortal'));
  planner.lvl = 99;
  planner.cult = 350000;
  planner.daoyun = 2000;
  planner.daoyunCap = 2000;
  planner.worldEmperor = null;
  planner.daoTraceUntil = null;
  var odds0 = Sim.imperialGateInfo(planner).odds;
  var log = [];
  Sim.applyPlanDividend(planner, 'good', log);
  Sim.applyPlanDividend(planner, 'good', log);
  var cultBefore = planner.cult;
  Sim.applyPlanDividend(planner, 'good', log);
  assert.strictEqual(planner.planScore, 3, '三次谋划应记满');
  assert.ok(planner.planEdge > 0, '谋划应留下证道红利');
  assert.ok(planner.cult > cultBefore, '每三次谋划应兑现战力，不能只改隐藏数');
  assert.ok(log.some(function (x) { return x.text && x.text.indexOf('布局') >= 0; }),
    '兑现必须写进日志，玩家看得见自己在规划');
  var odds1 = Sim.imperialGateInfo(planner).odds;
  assert.ok(odds1 > odds0, '谋划红利必须抬高帝关把握：' + odds0 + ' → ' + odds1);
})();

/* ---------- 突破旁白与同称号连破：不能刷同一句 ---------- */
(function () {
  var g = Sim.createGame(0, [], { tier: 10, name: Sim.daoGiftName(10), initialDaoyun: 1000 });
  g.daoyun = 1200;
  g.daoyunCap = 1500;
  Sim.addCreatedArt(g, 'scripture', { name: '轮回古卷' });
  assert.ok(Sim.isHighDaoyun(g), '前置：高道蕴');
  var prev = '', i, s, artHits = 0;
  for (i = 0; i < 14; i++) {
    s = Sim.insightPrefix(g);
    assert.ok(/悟道/.test(s), '高道蕴破境仍须是悟道：' + s);
    assert.notStrictEqual(s, prev, '悟道旁白不应连着两句一字不差');
    if (/轮回古卷/.test(s)) artHits++;
    prev = s;
  }
  assert.ok(artHits <= 1, '同一门自创法写进旁白最多一次，实际 ' + artHits);

  var brk = Sim.createGame(0, [], { tier: 5, name: '颖悟', initialDaoyun: 70 });
  brk.lvl = 60;
  var log = [];
  Sim.levelUp(brk, log);
  Sim.levelUp(brk, log);
  Sim.levelUp(brk, log);
  var brks = log.filter(function (x) { return x.cls === 'brk'; });
  assert.strictEqual(brks.length, 1, '王者初期连破三层应并成一条，实际 ' + brks.length + '：' +
    log.map(function (x) { return x.text; }).join(' | '));
  assert.ok(/王者初期/.test(brks[0].text), '合并后仍要写出到达的境界');
  assert.ok(/连破/.test(brks[0].text), '合并后应写明是连破，而不是再抄一遍同一句悟道');
})();

/* ---------- 道宫之后 T1 灌水降权 ---------- */
(function () {
  assert.strictEqual(typeof Sim.eventDrawWeight, 'function', '应导出 eventDrawWeight');
  var g = Sim.createGame(0, []);
  g.lvl = 25;
  var t1 = byId('jingxiu');
  var t3 = byId('dao_seclusion_deduce') || byId('jiangdao');
  assert.ok(t1 && t3, '应能取到 T1 与 T3 对照事件');
  var w1 = Sim.eventDrawWeight(g, t1);
  var w3 = Sim.eventDrawWeight(g, t3);
  assert.ok(w1 < w3, '道宫之后静坐一类 T1 不应再压过稀有事件：T1=' + w1 + ' T3=' + w3);
})();

/* ---------- 小事件自行落幕；古路/帝兵/争锋才打断 ---------- */
(function () {
  assert.strictEqual(typeof Sim.choiceWorthAsking, 'function', '应导出 choiceWorthAsking');
  assert.strictEqual(typeof Sim.fireEvent, 'function', '应导出 fireEvent');
  var well = byId('lf_village_well');
  var rain = byId('lf_scripture_rain') || byId('lf_river_reverse');
  var g = Sim.createGame(0, []);
  Sim.setPhysique(g, D.physiqueById('mortal'));
  g.lvl = 8;
  g.age = 16;
  g.cult = 400;
  var wellSpec = well.choice(g, {});
  assert.strictEqual(Sim.choiceWorthAsking(well, wellSpec), false, '村井是池子里的小岔路，不该次次打断');
  var log = [];
  Sim.fireEvent(g, log, well);
  assert.ok(!g.pendingChoice, 'T2 人生琐事应自行落幕');
  assert.ok((g.eventDraws || 0) >= 1, '自行落幕也要占四极前额度');

  if (rain) {
    g.lvl = 45;
    g.age = 80;
    var rainSpec = rain.choice(g, {});
    assert.strictEqual(Sim.choiceWorthAsking(rain, rainSpec), true, 'T3 人生岔路仍该停下来问');
  }

  var duel = byId('tianjiao');
  assert.ok(duel.maxCount <= 1, '同辈争锋一生最多一次，实际 ' + duel.maxCount);
  g.lvl = 20;
  g.age = 30;
  Sim.fireEvent(g, log, duel);
  assert.ok(g.pendingChoice, '同辈争锋应停下来问');
  g.pendingChoice = null;

  var road = byId('rd_road_depart');
  var bing = byId('rd_dibing_seize');
  assert.ok(road && bing, '古路与帝兵事件必须在库里');
  var saint = Sim.createGame(0, []);
  Sim.setPhysique(saint, D.physiqueById('mortal'));
  saint.lvl = 75;
  saint.age = 400;
  saint.cult = 80000;
  var roadSpec = road.choice(saint, Sim.U);
  var bingSpec = bing.choice(saint, Sim.U);
  assert.strictEqual(Sim.choiceWorthAsking(road, roadSpec), true, '踏上星空古路必须弹窗');
  assert.strictEqual(Sim.choiceWorthAsking(bing, bingSpec), true, '帝兵出世必须弹窗');
})();

/* ---------- 前期小事从池子里挑，不能局局同一件 ---------- */
(function () {
  var seen = {}, i, y, n = 18;
  for (i = 0; i < n; i++) {
    var g = Sim.createGame(0, [], { tier: 5 });
    Sim.setPhysique(g, D.physiqueById('mortal'));
    y = 0;
    while (!g.dead && !g.ascended && (g.lvl || 1) < 21 && y < 4000) {
      y++;
      Sim.rollYear(g);
      if (g.pendingChoice) Sim.resolveChoice(g, Sim.defaultChoiceOption(g.pendingChoice), []);
    }
    (g.recentEvents || []).forEach(function (e) { if (e && e.id) seen[e.id] = 1; });
  }
  var ids = Object.keys(seen);
  assert.ok(ids.length >= 4, '凡体四极前从小事件池里至少要抽出 4 种，实际 ' + ids.join(',') );
})();

/* ---------- 前期事件稀、后期密；弹窗奖惩跟当前战力走 ---------- */
(function () {
  assert.strictEqual(typeof Sim.eventYearInterval, 'function', '应导出 eventYearInterval');
  assert.strictEqual(typeof Sim.choiceStakeShare, 'function', '应导出 choiceStakeShare');
  assert.strictEqual(typeof Sim.earlyEventBudget, 'function', '应导出 earlyEventBudget');
  var early = Sim.eventYearInterval({ lvl: 8, physiqueId: 'mortal', aptitude: 1, lifespan: 120, age: 16 });
  var mid = Sim.eventYearInterval({ lvl: 45, physiqueId: 'mortal', aptitude: 1, lifespan: 1400, age: 200 });
  var late = Sim.eventYearInterval({ lvl: 94, physiqueId: 'mortal', aptitude: 1, lifespan: 9000, age: 2000 });
  assert.ok(late > mid && mid > early, '间隔应按寿元摊，准帝应远长于轮海：轮海' + early + ' 仙台' + mid + ' 准帝' + late);
  assert.ok(late >= 400, '准帝剩余寿元近万年，不能二十年一件，实际 ' + late);
  var mortalCap = Sim.earlyEventBudget({ physiqueId: 'mortal', aptitude: 1 });
  var chaosCap = Sim.earlyEventBudget({ physiqueId: 'chaos', aptitude: 10 });
  var sacredCap = Sim.earlyEventBudget({ physiqueId: 'sacred', aptitude: 9 });
  assert.ok(mortalCap <= 2, '小事件要少，凡体四极前也不该堆满，实际 ' + mortalCap);
  assert.ok(chaosCap <= 1 && sacredCap <= 1, '圣体混沌前期最多一件');
  assert.ok(mortalCap >= chaosCap, '凡体只比顶级体质略多');
  assert.ok(mortalCap - chaosCap <= 1, '体质弱只多一点，不要 4 对 0');

  var sea = Sim.choiceStakeShare({ lvl: 8 });
  var peak = Sim.choiceStakeShare({ lvl: 94 });
  assert.ok(peak > sea * 1.8, '准帝奖惩份额应明显高于轮海：' + sea + ' → ' + peak);
  assert.ok(peak >= 0.18, '准帝冒险项至少能动当前战力近两成，实际 ' + peak);

  var g = Sim.createGame(0, []);
  Sim.setPhysique(g, D.physiqueById('mortal'));
  g.lvl = 94;
  g.age = 2000;
  g.lifespan = 9000;
  g.cult = 200000;
  var before = g.cult;
  var duel = byId('tianjiao');
  Sim.fireEvent(g, [], duel);
  assert.ok(g.pendingChoice, '前置：准帝争锋应弹窗');
  var rnd = Math.random;
  Math.random = function () { return 0; };
  Sim.resolveChoice(g, 'fight', []);
  Math.random = rnd;
  var gain = g.cult - before;
  assert.ok(gain / before >= 0.12, '准帝接战应至少抬当前战力一成二，实际 +' + gain + ' / ' + before);
})();

/* ---------- 四极前额度看体质：凡体多、混沌少 ---------- */
(function () {
  function countEarly(physId, n) {
    var i, sum = 0, over = 0, cap = Sim.earlyEventBudget({ physiqueId: physId });
    for (i = 0; i < n; i++) {
      var g = Sim.createGame(0, []);
      Sim.setPhysique(g, D.physiqueById(physId));
      var y = 0;
      while (!g.dead && !g.ascended && (g.lvl || 1) < 21 && y < 8000) {
        y++;
        Sim.rollYear(g);
        while (g.pendingChoice) Sim.resolveChoice(g, Sim.defaultChoiceOption(g.pendingChoice), []);
      }
      var drew = g.eventDraws || 0;
      sum += drew;
      if (drew > cap) over++;
    }
    return { avg: sum / n, over: over, cap: cap };
  }
  var mortal = countEarly('mortal', 12);
  var chaos = countEarly('chaos', 12);
  assert.strictEqual(mortal.over, 0, '凡体四极前不应超过自身额度 ' + mortal.cap);
  assert.strictEqual(chaos.over, 0, '混沌体四极前不应超过自身额度 ' + chaos.cap);
  assert.ok(mortal.avg >= chaos.avg, '凡体前期机缘应略多于混沌体：凡' + mortal.avg.toFixed(2) + ' 混' + chaos.avg.toFixed(2));
  assert.ok(chaos.avg <= 1.2, '混沌体前期仍该埋头修，实际 ' + chaos.avg.toFixed(2));
})();

/* ---------- 古路/帝兵进奖池要看属性，不是人人一样 ---------- */
(function () {
  var road = byId('rd_road_depart');
  var fake = byId('xingkong_gulu');
  assert.ok(road, '应有踏上星空古路');
  function saint(opt) {
    var g = Sim.createGame(0, opt.traits || []);
    Sim.setPhysique(g, D.physiqueById(opt.phys || 'mortal'));
    g.lvl = 75;
    g.age = 500;
    g.cult = opt.cult;
    g.daoGift = opt.gift;
    g.roadSegment = 0;
    return g;
  }
  var weak = saint({ phys: 'mortal', cult: 12000, gift: 3 });
  var strong = saint({ phys: 'chaos', cult: 220000, gift: 10 });
  var wWeak = Sim.eventDrawWeight(weak, road);
  var wStrong = Sim.eventDrawWeight(strong, road);
  assert.ok(wStrong > wWeak * 1.6, '战力高、体质强、悟性高的人更该撞上古路：弱 ' + wWeak + ' 强 ' + wStrong);
  assert.ok(road.available(weak, Sim.U) && road.available(strong, Sim.U), '圣人未登路都应有资格看见古路');
  if (fake) {
    assert.ok(!fake.available(weak, Sim.U), '没登路时不应再抽一条只会加战力的假古路');
    weak.roadSegment = 1;
    assert.ok(fake.available(weak, Sim.U), '真正登路之后，古路风物才可以再写一笔');
  }
})();

/* ---------- 道蕴只跟事件属性走：路边事不加，悟道/创法才加，且不按上限抽成 ---------- */
(function () {
  assert.strictEqual(typeof Sim.eventPaysDao, 'function', '应导出 eventPaysDao');
  assert.strictEqual(Sim.eventPaysDao(byId('guyao')), false, '古药园是采药，不该发道蕴');
  assert.strictEqual(Sim.eventPaysDao(byId('tianjiao')), false, '同辈争锋是夺气运，不该发道蕴');
  assert.strictEqual(Sim.eventPaysDao(byId('lf_village_well')), false, '村井异响不是悟道');
  assert.ok(Sim.eventPaysDao(byId('dao_battle_insight')), '以战悟道应按悟道发');
  assert.ok(Sim.eventPaysDao(byId('dao_create_guard_first')), '创法应按立法发');

  var herb = Sim.createGame(0, [], { tier: 10, name: '万古道心', initialDaoyun: 400 });
  Sim.setPhysique(herb, D.physiqueById('mortal'));
  herb.lvl = 30;
  herb.daoyunCap = 2000;
  herb.daoyun = 400;
  var herbBefore = herb.daoyun;
  Sim.fireEvent(herb, [], byId('guyao'));
  assert.strictEqual(herb.daoyun, herbBefore, '采药成功不应再按上限抽成发道蕴，实际 +' + (herb.daoyun - herbBefore));

  var insight = Sim.createGame(0, [], { tier: 10, name: '万古道心', initialDaoyun: 400 });
  Sim.setPhysique(insight, D.physiqueById('mortal'));
  insight.lvl = 30;
  insight.daoyunCap = 2000;
  insight.daoyun = 400;
  var rnd = Math.random;
  Math.random = function () { return 0; };
  Sim.fireEvent(insight, [], byId('dao_battle_insight'));
  Math.random = rnd;
  var insightGain = insight.daoyun - 400;
  assert.ok(insightGain > 0 && insightGain <= 6, 'T2 悟道最多 6 点，实际 +' + insightGain);

  var ev = byId('dao_create_guard_first');
  var g = Sim.createGame(0, ['o06', 'o07'], { tier: 10, name: '万古道心', initialDaoyun: 800 });
  Sim.setPhysique(g, D.physiqueById('mortal'));
  g.lvl = 25;
  g.age = 80;
  g.daoyunCap = 2000;
  g.daoyun = 600;
  var before = g.daoyun;
  Sim.fireEvent(g, [], ev);
  assert.ok(g.pendingChoice, '创法应弹窗');
  var art = null, i, spec = g.pendingChoice;
  for (i = 0; i < spec.options.length; i++) {
    if (spec.options[i].id && String(spec.options[i].id).indexOf('art_') === 0) art = spec.options[i];
  }
  assert.ok(art, '创法抉择应有落笔选项');
  Math.random = function () { return 0; };
  Sim.resolveChoice(g, art.id, []);
  Math.random = rnd;
  var gain = g.daoyun - before;
  assert.ok(gain >= 18 && gain <= 90, '立一门法应有可见沉淀，但不得按上限抽成，实际 +' + gain);
  assert.ok(gain / 2000 < 0.08, '创法也不得一次灌进上限一成，实际 ' + (gain / 2000).toFixed(3));
})();

/* ---------- 寿元惩罚看事件轻重：路边失手不是准帝一成二，传说重创才切命限 ---------- */
(function () {
  assert.strictEqual(typeof Sim.lifeHurtShare, 'function', '应导出 lifeHurtShare');
  assert.ok(Sim.lifeHurtShare({ lvl: 94 }, 'light') < Sim.lifeHurtShare({ lvl: 94 }, 'medium'));
  assert.ok(Sim.lifeHurtShare({ lvl: 94 }, 'medium') < Sim.lifeHurtShare({ lvl: 94 }, 'heavy'));
  assert.ok(Sim.lifeHurtShare({ lvl: 94 }, 'heavy') < Sim.lifeHurtShare({ lvl: 94 }, 'grave'));
  assert.ok(Sim.lifeHurtShare({ lvl: 94 }, 'light') >= 0.055 && Sim.lifeHurtShare({ lvl: 94 }, 'light') < 0.09,
    '准帝轻伤也要切到余寿半成以上，但不能到一成：' + Sim.lifeHurtShare({ lvl: 94 }, 'light'));
  assert.ok(Sim.lifeHurtShare({ lvl: 94 }, 'grave') >= 0.16, '准帝致命失手应切到一成六以上余寿');

  var ev = byId('tianjiao');
  var g = Sim.createGame(0, []);
  Sim.setPhysique(g, D.physiqueById('mortal'));
  g.lvl = 94;
  g.age = 2000;
  g.lifeBase = 9000;
  g.lifeBonus = 0;
  g.lifespan = 9000;
  g.cult = 200000;
  var room = g.lifespan - g.age;
  Sim.fireEvent(g, [], ev);
  assert.ok(g.pendingChoice, '前置：争锋应弹窗');
  var rnd = Math.random;
  Math.random = function () { return 0.999; };
  Sim.resolveChoice(g, 'fight', []);
  Math.random = rnd;
  var lost = room - (g.lifespan - g.age);
  assert.ok(!g.dead, '同辈争锋失手不该死');
  assert.ok(lost / room >= 0.04 && lost / room < 0.12,
    'T2 争锋失手应明显掉寿，但不到一成二，实际掉 ' + lost + ' / ' + room);

  assert.strictEqual(typeof Sim.applyLifeHurt, 'function', '应导出 applyLifeHurt');
  var grave = Sim.createGame(0, []);
  Sim.setPhysique(grave, D.physiqueById('mortal'));
  grave.lvl = 94;
  grave.age = 2000;
  grave.lifeBase = 9000;
  grave.lifeBonus = 0;
  grave.lifespan = 9000;
  var graveRoom = grave.lifespan - grave.age;
  Math.random = function () { return 0.999; };
  var hit = Sim.applyLifeHurt(grave, 200, 500, { severity: 'grave', noExempt: true });
  Math.random = rnd;
  assert.ok(hit.loss / graveRoom >= 0.12, '传说级重创应按命限切，实际掉 ' + hit.loss + ' / ' + graveRoom);
})();

/* ---------- 高悟性 → 高道蕴 → 多创法 → 反哺道蕴 → 准帝破境/证帝/成仙 ---------- */
(function () {
  function mortal(opt) {
    var g = Sim.createGame(0, [], { tier: opt.gift != null ? opt.gift : 8 });
    Sim.setPhysique(g, D.physiqueById('mortal'));
    g.innate = 1;
    g.aptitude = 1;
    g.daoGift = opt.gift != null ? opt.gift : 8;
    g.lvl = opt.lvl != null ? opt.lvl : 94;
    g.cult = opt.cult != null ? opt.cult : 180000;
    g.daoyunCap = opt.cap != null ? opt.cap : 2000;
    g.daoyun = opt.dao != null ? opt.dao : 800;
    g.xintian = false;
    g.worldEmperor = null;
    var n = opt.arts || 0, i;
    for (i = 0; i < n; i++) Sim.addCreatedArt(g, i % 2 ? 'secret' : 'scripture');
    return g;
  }

  var lowGift = mortal({ gift: 5, dao: 400, arts: 0, lvl: 40 });
  var highGift = mortal({ gift: 10, dao: 400, arts: 0, lvl: 40 });
  assert.ok(Sim.createArtChance(highGift, 'scripture') > Sim.createArtChance(lowGift, 'scripture') * 1.15,
    '高悟性应更容易立法');

  var thinDao = mortal({ gift: 8, dao: 200, cap: 2000, arts: 0, lvl: 40 });
  var thickDao = mortal({ gift: 8, dao: 1400, cap: 2000, arts: 0, lvl: 40 });
  assert.ok(Sim.createArtChance(thickDao, 'scripture') > Sim.createArtChance(thinDao, 'scripture') * 1.25,
    '高道蕴应更容易立法');

  var feed = mortal({ gift: 10, dao: 600, cap: 2000, arts: 0, lvl: 40 });
  var beforeDao = feed.daoyun;
  var beforeMult = Sim.artDaoMult(feed);
  Sim.grantCreateDao(feed, 2);
  Sim.addCreatedArt(feed, 'scripture');
  assert.ok(feed.daoyun > beforeDao, '立法应立刻反哺道蕴');
  assert.ok(Sim.artDaoMult(feed) > beforeMult, '立下的法应继续滋养道蕴');

  assert.strictEqual(typeof Sim.daoBreakFactor, 'function');
  assert.strictEqual(typeof Sim.quasiLayerMultiplier, 'function');
  var poorBreak = mortal({ gift: 8, dao: 720, arts: 0, lvl: 94 });
  var richBreak = mortal({ gift: 10, dao: 1600, arts: 4, lvl: 94 });
  var poorRate = Sim.daoBreakFactor(poorBreak) / Sim.quasiLayerMultiplier(poorBreak, 94);
  var richRate = Sim.daoBreakFactor(richBreak) / Sim.quasiLayerMultiplier(richBreak, 94);
  assert.ok(richRate > poorRate * 1.35, '准帝后高悟性+创法应明显加快破境：' +
    poorRate.toFixed(3) + ' → ' + richRate.toFixed(3));

  var poorGate = mortal({ gift: 8, dao: 720, arts: 0, lvl: 99, cult: 180000 });
  var richGate = mortal({ gift: 8, dao: 1600, arts: 4, lvl: 99, cult: 180000 });
  var poorOdds = Sim.imperialGateInfo(poorGate).odds;
  var richOdds = Sim.imperialGateInfo(richGate).odds;
  assert.ok(richOdds > poorOdds + 0.10, '同战力下，道蕴与创法应抬高证帝把握：' +
    poorOdds.toFixed(3) + ' → ' + richOdds.toFixed(3));

  var chaosGate = mortal({ gift: 10, dao: 1600, arts: 4, lvl: 99, cult: 180000 });
  Sim.setPhysique(chaosGate, D.physiqueById('chaos'));
  chaosGate.innate = 10;
  var chaosBare = mortal({ gift: 10, dao: 400, arts: 0, lvl: 99, cult: 180000 });
  Sim.setPhysique(chaosBare, D.physiqueById('chaos'));
  chaosBare.innate = 10;
  assert.ok(Sim.imperialGateInfo(chaosGate).odds - Sim.imperialGateInfo(chaosBare).odds < 0.08,
    '混沌体本就无瓶颈，创法线不该再把它叠成必成');

  var poorXian = Sim.createGame(0, []);
  Sim.becomeDi(poorXian, [], 'force');
  poorXian.daoyun = 800;
  poorXian.daoyunCap = 1500;
  var richXian = Sim.createGame(0, []);
  Sim.becomeDi(richXian, [], 'force');
  richXian.daoyun = 800;
  richXian.daoyunCap = 1500;
  Sim.addCreatedArt(richXian, 'scripture');
  Sim.addCreatedArt(richXian, 'soul');
  Sim.addCreatedArt(richXian, 'longevity');
  assert.ok(Sim.reverseLifeChance(richXian) > Sim.reverseLifeChance(poorXian),
    '成帝后，创法应抬高逆活把握');
  poorXian.inStrangeWorld = true;
  poorXian.strangeWorldInsight = 100;
  richXian.inStrangeWorld = true;
  richXian.strangeWorldInsight = 100;
  assert.ok(Sim.strangeWorldImmortalityChance(richXian) > Sim.strangeWorldImmortalityChance(poorXian),
    '成帝后，创法应抬高奇异世界成仙把握');
  assert.ok(Sim.immortalRoadChance(richXian) > Sim.immortalRoadChance(poorXian),
    '成帝后，创法应抬高成仙路把握');
})();

console.log('midgame-rhythm: ok');
