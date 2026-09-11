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
  assert.strictEqual(Sim.canAdvance(byPower), false, '只把战力堆满不是机缘，不能进准帝');
  byPower.quasiFate = true;
  assert.strictEqual(Sim.canAdvance(byPower), true, '大圣之后接住机缘才能进准帝');

  var byRes = mortalSage({ traits: ['o21', 'o25'], cult: 80000 });
  assert.strictEqual(byRes.resonance, 'imperial', '双金帝路应共鸣');
  assert.strictEqual(Sim.canAdvance(byRes), true, '帝路共鸣应能越过凡体墙');

  var byGold = mortalSage({ traits: ['o21', 'o06'], cult: 80000 });
  assert.ok(byGold.resonance !== 'imperial', '单张帝路金卡不应算共鸣');
  assert.strictEqual(Sim.canAdvance(byGold), true, '有帝路金卡也应能越过凡体墙');

  var early = mortalSage();
  early.lvl = 80;
  assert.strictEqual(Sim.markQuasiFate(early, { tag: 'allin', tier: 3 }), false, '大圣之前接机缘还不能开准帝门');
  early.lvl = 85;
  assert.ok(Sim.markQuasiFate(early, { tag: 'allin', tier: 3 }), '大圣之后梭哈应记下准帝机缘');
  early.lvl = 90;
  assert.strictEqual(Sim.canAdvance(early), true, '记下的机缘应能送进准帝');
  assert.strictEqual(Sim.markQuasiFate(early, { id: 'th_stuck_sheng', tag: 'insight' }), false,
    '枯坐事件不能当准帝机缘');
  early.quasiFate = false;
  assert.strictEqual(Sim.markQuasiFate(early, { tag: 'create', tier: 2 }), false,
    '创法是立法，不是踏进准帝的机缘');
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
  assert.ok(!fresh.pendingChoice, '圣人前不再按境保送作业，额度要留给梭哈');
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
  assert.strictEqual(dungeonHits, 0, '秘境已经出过时，不应再保送秘境');
  assert.ok(Object.keys(titles).length === 0, '四极不再按境塞一张作业：' + Object.keys(titles).join('、'));
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
  var stele = byId('dao_create_stele_first');
  var rain = byId('dao_create_rain_first');
  assert.ok(guard && typeof guard.choice === 'function' && typeof guard.resolve === 'function',
    '道宫入口创法必须是抉择，不能再自动写完');
  assert.ok(stele && rain && typeof stele.choice === 'function' && typeof rain.choice === 'function',
    '第一次落笔至少要有残碑、雨夜两条别的入口，不能局局都是师兄之死');

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

  var firstIds = {}, i, seenFirst = 0;
  for (i = 0; i < 36; i++) {
    var roll = Sim.createGame(0, [], { tier: 10, name: Sim.daoGiftName(10), initialDaoyun: 1000 });
    roll.lvl = 25;
    roll.age = 80;
    roll.artGlimpse = true;
    Sim.ensureArtChoice(roll, []);
    var evId = roll.pendingChoice && roll.pendingChoice.evId;
    if (evId) {
      firstIds[evId] = (firstIds[evId] || 0) + 1;
      seenFirst++;
    }
  }
  assert.ok(Object.keys(firstIds).length >= 2, '第一次创法入口不能锁死一条，实际 ' + JSON.stringify(firstIds));
  assert.ok(!firstIds.dao_create_guard_first || firstIds.dao_create_guard_first <= seenFirst * 0.7,
    '死中求生之法不应占满第一次落笔，实际 ' + JSON.stringify(firstIds));
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
  assert.ok(!g.pendingChoice, '村井不再进梭哈额度，也不停屏');

  if (rain) {
    g.lvl = 45;
    g.age = 80;
    var rainSpec = rain.choice(g, {});
    assert.strictEqual(Sim.choiceWorthAsking(rain, rainSpec), false, 'T3 人生岔路也不再停屏，额度留给梭哈');
  }

  var duel = byId('tianjiao');
  assert.ok(duel.maxCount <= 1, '同辈争锋一生最多一次，实际 ' + duel.maxCount);
  assert.strictEqual(Sim.isStakeEvent(duel), false, '同辈争锋不是梭哈，不应占额度');
  g.lvl = 20;
  g.age = 30;
  Sim.fireEvent(g, log, duel);
  assert.ok(!g.pendingChoice, 'T2 争锋不应再停屏');

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
  var lowMi = byId('rd_mi_low_delve');
  var lowG = Sim.createGame(0, []);
  Sim.setPhysique(lowG, D.physiqueById('mortal'));
  lowG.lvl = 30;
  lowG.age = 50;
  assert.strictEqual(Sim.choiceWorthAsking(lowMi, lowMi.choice(lowG, Sim.U)), false,
    '低阶秘境自行落幕，不要停下来做选择题');
  var stele = byId('th_xian_stele');
  var steleG = Sim.createGame(0, []);
  Sim.setPhysique(steleG, D.physiqueById('mortal'));
  steleG.lvl = 45;
  steleG.age = 180;
  steleG.cult = 8000;
  assert.strictEqual(Sim.choiceWorthAsking(stele, stele.choice(steleG, Sim.U)), false,
    '仙台古碑三档叉自行落幕，不是作业卷');
  var dixue = byId('phy_dixue_cuiti');
  assert.ok(dixue, '帝血淬体应在库里');
  assert.strictEqual(Sim.choiceWorthAsking(dixue, dixue.choice(lowG, Sim.U)), false,
    '帝血淬体是传说作业，自行落幕，不要停下来问敢不敢');
  var tale = byId('rd_gamble_tale');
  var tinker = byId('dao_tinker_old_art');
  assert.ok(tale && tinker, 'T1 杂事应在库里');
  assert.strictEqual(Sim.isStakeEvent(tale), false, '赌命者的故事是路边听闻，不占梭哈');
  assert.strictEqual(Sim.isStakeEvent(tinker), false, '拆解旧法是日常，不占梭哈');
  assert.strictEqual(Sim.choiceWorthAsking(tale, { options: [{ id: 'x', safe: true }] }), false,
    'T1 一律不弹窗');
  var firstCreate = byId('dao_create_guard_first');
  var cg = Sim.createGame(0, []);
  Sim.setPhysique(cg, D.physiqueById('mortal'));
  cg.lvl = 25;
  cg.age = 40;
  cg.cult = 3000;
  cg.artGlimpse = true;
  assert.strictEqual(Sim.choiceWorthAsking(firstCreate, firstCreate.choice(cg, Sim.U)), true,
    '第一次落笔是逆天改命，必须停');
})();

/* ---------- 圣人前额度硬顶 2，且只能是梭哈 ---------- */
(function () {
  assert.strictEqual(typeof Sim.isStakeEvent, 'function', '应导出 isStakeEvent');
  assert.ok(Sim.isStakeEvent(byId('rd_dibing_seize')), '帝兵是梭哈');
  assert.ok(Sim.isStakeEvent(byId('rd_road_depart')), '古路是梭哈');
  assert.ok(Sim.isStakeEvent(byId('dao_create_guard_first')), '创法是梭哈');
  assert.ok(Sim.isStakeEvent(byId('dao_create_swallowing')), '自创吞天是梭哈');
  assert.ok(!Sim.isStakeEvent(byId('lf_village_well')), '村井不是梭哈');

  var i, over = 0, pops = 0, bad = 0, n = 10;
  for (i = 0; i < n; i++) {
    var g = Sim.createGame(0, [], { tier: 5 });
    Sim.setPhysique(g, D.physiqueById('mortal'));
    var y = 0;
    while (!g.dead && !g.ascended && (g.lvl || 1) < 71 && y < 20000) {
      y++;
      Sim.rollYear(g);
      if (g.pendingChoice) {
        pops++;
        var ev = byId(g.pendingChoice.evId);
        if (ev && !Sim.isStakeEvent(ev)) bad++;
        if (ev && (ev.tier || 1) < 2) bad++;
        Sim.resolveChoice(g, Sim.defaultChoiceOption(g.pendingChoice), []);
      }
    }
    var drew = (g.eventDrawsBySpan && g.eventDrawsBySpan.pre) || g.eventDraws || 0;
    if (drew > 3) over++;
  }
  assert.strictEqual(over, 0, '普通凡体圣人前不得超过 3 次事件');
  assert.strictEqual(bad, 0, '弹窗必须是创法/古路/秘境/帝兵这类梭哈');
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
  var saint = Sim.eventYearInterval({ lvl: 80, physiqueId: 'mortal', aptitude: 1, lifespan: 5500, age: 600 });
  assert.ok(saint <= 220, '圣人到大圣必须按本档年摊，不能摊空，实际 ' + saint);
  assert.strictEqual(typeof Sim.eventSpanBudget, 'function', '应导出 eventSpanBudget');
  assert.strictEqual(Sim.eventSpanBudget({ lvl: 20 }), 2, '未标明体质时圣人前仍是 2');
  assert.strictEqual(Sim.eventSpanBudget({ lvl: 20, innate: 1, daoGift: 5 }), 3,
    '普通凡体圣人前应有 3 窗');
  assert.strictEqual(Sim.eventSpanBudget({ lvl: 20, innate: 1, daoGift: 10 }), 2,
    '高悟凡体圣人前仍是 2');
  assert.strictEqual(Sim.eventSpanBudget({ lvl: 80 }), 3, '圣人到大圣最多 3 次');
  assert.ok(Sim.eventSpanBudget({ lvl: 94 }) >= 5 && Sim.eventSpanBudget({ lvl: 94 }) <= 6,
    '准帝应有 5~6 次额度');
  assert.strictEqual(Sim.earlyEventBudget({ physiqueId: 'mortal', lvl: 8 }), 2);
  assert.strictEqual(Sim.earlyEventBudget({ physiqueId: 'chaos', lvl: 8 }), 2);

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
  var road = byId('rd_road_depart');
  Sim.fireEvent(g, [], road);
  assert.ok(g.pendingChoice, '前置：准帝古路应弹窗');
  var rnd = Math.random;
  Math.random = function () { return 0; };
  Sim.resolveChoice(g, 'steady', []);
  Math.random = rnd;
  var gain = g.cult - before;
  assert.ok(gain / before >= 0.12, '准帝接古路应至少抬当前战力一成二，实际 +' + gain + ' / ' + before);
})();

/* ---------- 高悟性更该撞上创法 / 吞天 ---------- */
(function () {
  var create = byId('dao_create_guard_first');
  var swallow = byId('dao_create_swallowing');
  function gAt(gift, lvl) {
    var g = Sim.createGame(0, [], { tier: gift, name: '颖悟', initialDaoyun: 400 });
    Sim.setPhysique(g, D.physiqueById('mortal'));
    g.lvl = lvl;
    g.daoGift = gift;
    g.daoyun = gift >= 8 ? 900 : 200;
    g.cult = lvl >= 71 ? 120000 : 8000;
    return g;
  }
  var low = Sim.eventDrawWeight(gAt(5, 40), create);
  var high = Sim.eventDrawWeight(gAt(10, 40), create);
  assert.ok(high > low * 1.6, '悟性极高应更容易撞上创法：低 ' + low + ' 高 ' + high);
  var swLow = Sim.eventDrawWeight(gAt(5, 75), swallow);
  var swHigh = Sim.eventDrawWeight(gAt(10, 75), swallow);
  assert.ok(swHigh > swLow * 1.5, '高悟凡体更该看见自创吞天：低 ' + swLow + ' 高 ' + swHigh);
})();

/* ---------- 圣人到大圣不能再被寿元摊空 ---------- */
(function () {
  var i, sum = 0, over = 0, hit = 0, reached = 0, n = 24;
  for (i = 0; i < n; i++) {
    var g = Sim.createGame(60, [], { tier: 10, name: '万古道心', initialDaoyun: 400 });
    Sim.setPhysique(g, D.physiqueById('mortal'));
    var y = 0;
    while (!g.dead && !g.ascended && (g.lvl || 1) < 91 && y < 40000) {
      y++;
      Sim.rollYear(g);
      while (g.pendingChoice) Sim.resolveChoice(g, Sim.defaultChoiceOption(g.pendingChoice), []);
    }
    var mid = (g.eventDrawsBySpan && g.eventDrawsBySpan.mid) || 0;
    if (mid > 3) over++;
    if ((g.lvl || 1) < 71) continue;
    reached++;
    sum += mid;
    if (mid >= 1) hit++;
  }
  assert.strictEqual(over, 0, '圣~大圣不得超过 3');
  assert.ok(reached >= 2, '悟性10凡体过了斩道后，24 局里应有人入圣，实际 ' + reached + '/' + n);
  assert.ok(hit >= Math.min(2, reached), '入圣之后圣~大圣不该被摊空，实际 ' + hit + '/' + reached);
  if (reached) assert.ok(sum / reached >= 0.7, '到了圣~大圣，额度就该花出来，实际 ' + (sum / reached).toFixed(2));
})();

/* ---------- 额度用尽后仍有路边事；仙台不再只剩低阶秘境 ---------- */
(function () {
  assert.strictEqual(typeof Sim.eventFlavorInterval, 'function', '应导出 eventFlavorInterval');
  var g = Sim.createGame(0, []);
  Sim.setPhysique(g, D.physiqueById('mortal'));
  g.lvl = 45;
  g.age = 200;
  g.eventDrawsBySpan = { pre: 3 };
  var gap = Sim.eventYearInterval(g);
  assert.ok(gap <= 90, '梭哈额度用尽后不能把间隔拉成十万年，实际 ' + gap);
  assert.strictEqual(typeof Sim.imperialGateMayAsk, 'function', '应导出 imperialGateMayAsk');

  assert.ok(byId('th_xian_stele') && byId('th_xian_pill') && byId('th_quasi_private'),
    '分境界梭哈包应有仙台古碑、夺丹和准帝私斗');
  assert.ok(Sim.isStakeEvent(byId('th_xian_stele')), '仙台古碑应占梭哈额度');
  assert.ok(Sim.isStakeEvent(byId('th_wang_mine')), '血色矿脉应是梭哈');
  var thrill = E.filter(function (e) { return e.id && e.id.indexOf('th_') === 0; });
  assert.ok(thrill.length >= 17, '分境界梭哈包事件太少：' + thrill.length);
  var stuck = byId('th_stuck_fourpole');
  assert.ok(stuck && !Sim.isStakeEvent(stuck), '四极夜关应走路边池，不占梭哈');
  var stuckG = Sim.createGame(0, []);
  Sim.setPhysique(stuckG, D.physiqueById('mortal'));
  stuckG.innate = 1;
  stuckG.aptitude = 1;
  stuckG.lvl = 25;
  stuckG.age = 80;
  var before = stuckG.lvl;
  stuck.ok(stuckG, Sim.U);
  assert.ok(stuckG.lvl > before, '四极夜关成功应推一层，实际 ' + stuckG.lvl);
  var vajraG = Sim.createGame(0, []);
  Sim.setPhysique(vajraG, D.physiqueById('vajra'));
  vajraG.lvl = 25;
  vajraG.age = 90;
  assert.ok(stuck.available(vajraG), '金刚不坏体也应能坐下破境');
  var kingG = Sim.createGame(0, []);
  Sim.setPhysique(kingG, D.physiqueById('human_king'));
  kingG.lvl = 25;
  kingG.age = 90;
  assert.ok(!stuck.available(kingG), '人王体不该再吃凡体卡关');
  var xianStuck = byId('th_stuck_xian');
  var xianG = Sim.createGame(0, []);
  Sim.setPhysique(xianG, D.physiqueById('mortal'));
  xianG.innate = 1;
  xianG.aptitude = 1;
  xianG.daoGift = 5;
  xianG.lvl = 50;
  xianG.daoyun = 4;
  xianG.daoyunCap = 200;
  var xianBefore = xianG.lvl;
  xianStuck.ok(xianG, Sim.U);
  assert.ok(xianG.lvl > xianBefore, '仙台枯坐在道蕴不够时也应推一层，实际 ' + xianG.lvl);
  var sheng = byId('th_stuck_sheng');
  assert.ok(sheng && !Sim.isStakeEvent(sheng), '圣位枯坐应走路边池，不占梭哈');
  var shengG = Sim.createGame(0, []);
  Sim.setPhysique(shengG, D.physiqueById('mortal'));
  shengG.innate = 1;
  shengG.aptitude = 1;
  shengG.daoGift = 5;
  shengG.lvl = 90;
  shengG.daoyun = 400;
  shengG.daoyunCap = 800;
  shengG.cult = 80000;
  var shengBefore = shengG.lvl;
  sheng.ok(shengG, Sim.U);
  assert.strictEqual(shengG.lvl, shengBefore, '枯坐不能送进准帝，实际 ' + shengG.lvl);
  assert.ok(!shengG.quasiFate, '枯坐不是进准帝的机缘');
  var cutSit = Sim.createGame(0, []);
  Sim.setPhysique(cutSit, D.physiqueById('mortal'));
  cutSit.innate = 1;
  cutSit.aptitude = 1;
  cutSit.lvl = 60;
  cutSit.daoyun = 200;
  cutSit.daoyunCap = 400;
  var neng = byId('th_stuck_neng');
  neng.ok(cutSit, Sim.U);
  assert.strictEqual(cutSit.lvl, 60, '枯坐不能坐过斩道');
  assert.ok(neng.available(cutSit), '斩道门口应能坐下堆战力');
  var saintSit = Sim.createGame(0, []);
  Sim.setPhysique(saintSit, D.physiqueById('mortal'));
  saintSit.innate = 1;
  saintSit.aptitude = 1;
  saintSit.lvl = 70;
  saintSit.age = 800;
  saintSit.daoyun = 400;
  saintSit.daoyunCap = 800;
  var shengAtKing = byId('th_stuck_sheng');
  assert.ok(shengAtKing.available(saintSit), '入圣门口应能坐下堆战力');
  shengAtKing.ok(saintSit, Sim.U);
  assert.strictEqual(saintSit.lvl, 70, '枯坐不能坐过入圣');
  var n, sawStuck = 0;
  for (n = 0; n < 40; n++) {
    var bias = Sim.createGame(0, []);
    Sim.setPhysique(bias, D.physiqueById('mortal'));
    bias.innate = 1;
    bias.aptitude = 1;
    bias.lvl = 25;
    bias.age = 90;
    bias.eventDrawsBySpan = { pre: 3 };
    Sim.rollEvent(bias, []);
    if (bias.maxCount && bias.maxCount.th_stuck_fourpole != null && bias.maxCount.th_stuck_fourpole < 3) {
      sawStuck++;
      break;
    }
  }
  assert.ok(sawStuck, '凡体卡在四极时，路边事宜优先抽到卡关破境');
  var beforeStake = Sim.createGame(0, []);
  Sim.setPhysique(beforeStake, D.physiqueById('mortal'));
  beforeStake.innate = 1;
  beforeStake.aptitude = 1;
  beforeStake.lvl = 25;
  beforeStake.age = 90;
  beforeStake.eventDrawsBySpan = { pre: 0 };
  var preRnd = Math.random;
  Math.random = function () { return 0.1; };
  Sim.rollEvent(beforeStake, []);
  Math.random = preRnd;
  assert.ok(beforeStake.maxCount && beforeStake.maxCount.th_stuck_fourpole != null &&
    beforeStake.maxCount.th_stuck_fourpole < 3, '梭哈额度没用完，四极夜关也该能坐下');
  var seaStake = Sim.createGame(0, []);
  Sim.setPhysique(seaStake, D.physiqueById('mortal'));
  seaStake.innate = 1;
  seaStake.aptitude = 1;
  seaStake.lvl = 12;
  seaStake.age = 20;
  seaStake.eventDrawsBySpan = { pre: 0 };
  var seaRnd = Math.random;
  Math.random = function () { return 0.1; };
  Sim.rollEvent(seaStake, []);
  Math.random = seaRnd;
  assert.ok(seaStake.maxCount && seaStake.maxCount.th_stuck_sea != null &&
    seaStake.maxCount.th_stuck_sea < 3, '轮海道宫额度没用完也应能坐下续命');
  var seaEve = byId('th_stuck_sea');
  assert.ok(seaEve && !Sim.isStakeEvent(seaEve), '苦海夜坐应走路边池');
  var seaBefore = seaStake.lvl;
  seaEve.ok(seaStake, Sim.U);
  assert.ok(seaStake.lifespan > 0, '苦海夜坐应能续上寿元');
  var sacredSea = Sim.createGame(0, []);
  Sim.setPhysique(sacredSea, D.physiqueById('sacred'));
  sacredSea.lvl = 12;
  sacredSea.age = 20;
  assert.ok(!seaEve.available(sacredSea), '圣体不吃苦海夜坐');
  var nengStake = Sim.createGame(0, []);
  Sim.setPhysique(nengStake, D.physiqueById('mortal'));
  nengStake.innate = 1;
  nengStake.aptitude = 1;
  nengStake.lvl = 56;
  nengStake.age = 400;
  nengStake.eventDrawsBySpan = { pre: 0 };
  var nengRnd = Math.random;
  Math.random = function () { return 0.1; };
  Sim.rollEvent(nengStake, []);
  Math.random = nengRnd;
  assert.ok(nengStake.maxCount && nengStake.maxCount.th_stuck_neng != null &&
    nengStake.maxCount.th_stuck_neng < 3, '梭哈额度没用完，大能内层也该能坐下');
  var doorStake = Sim.createGame(0, []);
  Sim.setPhysique(doorStake, D.physiqueById('mortal'));
  doorStake.innate = 1;
  doorStake.aptitude = 1;
  doorStake.lvl = 60;
  doorStake.age = 500;
  doorStake.eventDrawsBySpan = { pre: 0 };
  var doorRnd = Math.random;
  Math.random = function () { return 0.1; };
  Sim.rollEvent(doorStake, []);
  Math.random = doorRnd;
  assert.ok(doorStake.maxCount && doorStake.maxCount.th_stuck_cut != null &&
    doorStake.maxCount.th_stuck_cut < 2, '斩道门口应先看见前夜，而不是被调息挤掉');
  assert.strictEqual(doorStake.lvl, 60, '门口坐下不能坐进王者');
  var doorSpent = Sim.createGame(0, []);
  Sim.setPhysique(doorSpent, D.physiqueById('mortal'));
  doorSpent.innate = 1;
  doorSpent.aptitude = 1;
  doorSpent.lvl = 60;
  doorSpent.age = 500;
  doorSpent.eventDrawsBySpan = { pre: 3 };
  var spentRnd = Math.random;
  Math.random = function () { return 0.9; };
  Sim.rollEvent(doorSpent, []);
  Math.random = spentRnd;
  assert.ok(doorSpent.maxCount && doorSpent.maxCount.th_stuck_cut != null &&
    doorSpent.maxCount.th_stuck_cut < 2, '额度用尽、骰子再大，斩道门口仍该看见前夜');
  var cutEve = byId('th_stuck_cut');
  assert.ok(cutEve && !Sim.isStakeEvent(cutEve), '斩道前夜应走路边池，不占梭哈');
  var kingDoor = Sim.createGame(0, []);
  Sim.setPhysique(kingDoor, D.physiqueById('human_king'));
  kingDoor.lvl = 60;
  kingDoor.age = 500;
  assert.ok(cutEve.available(kingDoor), '人王在斩道门口应能看见前夜');
  kingDoor.cutDaoTried = true;
  assert.ok(!cutEve.available(kingDoor), '斩过之后不该再抽前夜');
  kingDoor.cutDaoTried = false;
  var sacredDoor = Sim.createGame(0, []);
  Sim.setPhysique(sacredDoor, D.physiqueById('sacred'));
  sacredDoor.lvl = 60;
  sacredDoor.age = 500;
  assert.ok(!cutEve.available(sacredDoor), '圣体不该再吃斩道前夜');
  var yibianDoor = Sim.createGame(0, []);
  Sim.setPhysique(yibianDoor, D.physiqueById('mortal'));
  yibianDoor.innate = 7;
  yibianDoor.lvl = 60;
  yibianDoor.age = 500;
  assert.ok(cutEve.available(yibianDoor), '凡体异变到 7 品仍该看见斩道前夜');
  yibianDoor.lvl = 70;
  assert.ok(byId('th_stuck_sheng').available(yibianDoor), '凡体异变到 7 品入圣前仍该能枯坐');
  var afterCut = byId('th_after_cut');
  assert.ok(afterCut && !Sim.isStakeEvent(afterCut), '斩道余生应走路边池');
  var restDoor = Sim.createGame(0, []);
  Sim.setPhysique(restDoor, D.physiqueById('human_king'));
  restDoor.lvl = 60;
  restDoor.age = 800;
  restDoor.cutDaoTried = true;
  restDoor.cutDaoPassed = false;
  assert.ok(afterCut.available(restDoor), '斩道失败后应能看见余生');
  assert.ok(!cutEve.available(restDoor), '失败后前夜必须关掉');
  var restLvl = restDoor.lvl;
  afterCut.ok(restDoor, Sim.U);
  assert.strictEqual(restDoor.lvl, restLvl, '余生不能把人送进王者');
  var sacredRest = Sim.createGame(0, []);
  Sim.setPhysique(sacredRest, D.physiqueById('sacred'));
  sacredRest.lvl = 60;
  sacredRest.cutDaoTried = true;
  sacredRest.cutDaoPassed = false;
  assert.ok(afterCut.available(sacredRest), '谁斩败了都该看见余生，圣体也不例外');
  var afterFail = Sim.createGame(0, []);
  Sim.setPhysique(afterFail, D.physiqueById('mortal'));
  afterFail.innate = 1;
  afterFail.aptitude = 1;
  afterFail.lvl = 60;
  afterFail.age = 900;
  afterFail.cutDaoTried = true;
  afterFail.cutDaoPassed = false;
  afterFail.eventDrawsBySpan = { pre: 0 };
  var restRnd = Math.random;
  Math.random = function () { return 0.1; };
  Sim.rollEvent(afterFail, []);
  Math.random = restRnd;
  assert.ok(afterFail.maxCount && afterFail.maxCount.th_after_cut != null &&
    afterFail.maxCount.th_after_cut < 2, '斩道失败后门口应先看见余生');
  assert.ok(!afterFail.maxCount.th_stuck_cut || afterFail.maxCount.th_stuck_cut === 2,
    '失败后不该再抽前夜');
  var near = Sim.createGame(0, []);
  Sim.setPhysique(near, D.physiqueById('mortal'));
  near.innate = 1;
  near.aptitude = 1;
  near.lvl = 60;
  near.age = 500;
  near.daoyun = Math.max(near.daoyun || 0, 800);
  near.cult = 24000;
  var failRnd = Math.random;
  Math.random = function () { return 0.99; };
  Sim.ensureCutDao(near, []);
  Sim.ensureCutDao(near, []);
  Math.random = failRnd;
  assert.ok(near.cutDaoTried && !near.cutDaoPassed, '高战力仍可能斩败');
  assert.ok(near.cutNearMiss, '差一点时应记下刀意未散');
  var rekindle = byId('th_cut_rekindle');
  assert.ok(rekindle && !Sim.isStakeEvent(rekindle), '刀意回潮应走路边池');
  assert.ok(rekindle.available(near), '只差一线后应能回潮');
  var sacredNear = Sim.createGame(0, []);
  Sim.setPhysique(sacredNear, D.physiqueById('sacred'));
  sacredNear.lvl = 60;
  sacredNear.cutNearMiss = true;
  sacredNear.cutDaoTried = true;
  assert.ok(!rekindle.available(sacredNear), '圣体不吃刀意回潮，避免抬证道');
  var relog = [];
  var okRnd = Math.random;
  Math.random = function () { return 0.01; };
  assert.ok(Sim.rekindleCutDao(near, relog), '回潮应能再斩一次');
  Math.random = okRnd;
  assert.ok(near.cutDaoPassed && near.lvl >= 61, '回潮成功应进王者');
  var nearDoor = Sim.createGame(0, []);
  Sim.setPhysique(nearDoor, D.physiqueById('mortal'));
  nearDoor.innate = 1;
  nearDoor.aptitude = 1;
  nearDoor.lvl = 60;
  nearDoor.age = 900;
  nearDoor.cutDaoTried = true;
  nearDoor.cutDaoPassed = false;
  nearDoor.cutNearMiss = true;
  nearDoor.eventDrawsBySpan = { pre: 0 };
  var rkRnd = Math.random;
  Math.random = function () { return 0.1; };
  Sim.rollEvent(nearDoor, []);
  Math.random = rkRnd;
  assert.ok(nearDoor.maxCount && nearDoor.maxCount.th_cut_rekindle != null &&
    nearDoor.maxCount.th_cut_rekindle < 1, '只差一线后门口应先抽刀意回潮');
  var cutBefore = kingDoor.lvl;
  cutEve.ok(kingDoor, Sim.U);
  assert.strictEqual(kingDoor.lvl, cutBefore, '斩道前夜不能把人送进王者');
  var saintStake = Sim.createGame(0, []);
  Sim.setPhysique(saintStake, D.physiqueById('mortal'));
  saintStake.innate = 1;
  saintStake.aptitude = 1;
  saintStake.lvl = 70;
  saintStake.age = 800;
  saintStake.eventDrawsBySpan = { pre: 0 };
  var saintRnd = Math.random;
  Math.random = function () { return 0.1; };
  Sim.rollEvent(saintStake, []);
  Math.random = saintRnd;
  assert.ok(saintStake.maxCount && saintStake.maxCount.th_stuck_sheng != null &&
    saintStake.maxCount.th_stuck_sheng < 3, '入圣门口额度没用完也应能坐下堆战力');
  assert.strictEqual(saintStake.lvl, 70, '门口坐下不能坐进圣人');
  var afterSaint = byId('th_after_saint');
  assert.ok(afterSaint && !Sim.isStakeEvent(afterSaint), '圣位余生应走路边池');
  var saintRest = Sim.createGame(0, []);
  Sim.setPhysique(saintRest, D.physiqueById('mortal'));
  saintRest.lvl = 70;
  saintRest.age = 1200;
  saintRest.saintTried = true;
  saintRest.saintPassed = false;
  assert.ok(afterSaint.available(saintRest), '入圣失败后应能看见余生');
  assert.ok(!byId('th_stuck_sheng').available(saintRest), '失败后圣位枯坐必须关掉');
  var fs = require('fs');
  var gameSrc = fs.readFileSync(require('path').join(__dirname, '../game.js'), 'utf8');
  assert.ok(gameSrc.indexOf('斩道止步') >= 0 && gameSrc.indexOf('止步圣位') >= 0,
    '结算应写出斩道/入圣止步，而不是一律与世长辞');
  var tagged = Sim.createGame(0, []);
  Sim.setPhysique(tagged, D.physiqueById('mortal'));
  tagged.innate = 1;
  tagged.aptitude = 1;
  tagged.lvl = 25;
  tagged.age = 90;
  tagged.eventDrawsBySpan = { pre: 3 };
  tagged.recentEvents = [{ id: 'dao_sit', tag: 'insight' }];
  tagged.realmSeenTags = { insight: 1 };
  tagged.realmSeenIds = { dao_sit: 1 };
  tagged.realmSeenBand = 3;
  var stuckRnd = Math.random;
  Math.random = function () { return 0.1; };
  Sim.rollEvent(tagged, []);
  Math.random = stuckRnd;
  assert.ok(tagged.maxCount && tagged.maxCount.th_stuck_fourpole != null &&
    tagged.maxCount.th_stuck_fourpole < 3, '刚抽过悟道，四极夜关仍该能坐下');

  var xian = Sim.createGame(0, []);
  Sim.setPhysique(xian, D.physiqueById('mortal'));
  xian.lvl = 45;
  xian.age = 180;
  xian.cult = 8000;
  var pool = Sim.collectAvailableEvents(xian, true).filter(function (e) { return Sim.isStakeEvent(e); });
  var names = {};
  pool.forEach(function (e) { names[e.id] = 1; });
  assert.ok(names.th_xian_stele || names.th_xian_well || names.th_xian_pill,
    '仙台凡人梭哈池里应能看见新包，实际 ' + Object.keys(names).join(','));
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
  Sim.fireEvent(g, [], ev, { forceAsk: true });
  assert.ok(g.pendingChoice, '前置：强行打开争锋以测寿元');
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

/* ---------- 斩道 / 入圣：不弹窗，看当下道蕴和战力，一生一刀 ---------- */
(function () {
  function mortalAt(lvl, opt) {
    opt = opt || {};
    var g = Sim.createGame(0, []);
    Sim.setPhysique(g, D.physiqueById('mortal'));
    g.innate = 1;
    g.aptitude = 1;
    g.daoGift = opt.gift != null ? opt.gift : 5;
    g.lvl = lvl;
    g.age = opt.age || 400;
    g.daoyunCap = Math.max(g.daoyunCap || 0, 800);
    g.daoyun = opt.daoyun != null ? opt.daoyun : Sim.effectiveDaoyunNeed(g, lvl);
    g.cult = opt.cult != null ? opt.cult : 4000;
    g.swallowingArt = !!opt.swallow;
    return g;
  }

  var door = mortalAt(60, { daoyun: 90, cult: 4000 });
  assert.strictEqual(Sim.canAdvance(door), false, '没过斩道不能进王者');
  assert.ok(Sim.cutDaoChance(door) < 0.16, '凡体弱战力斩道应很低，实际 ' + Sim.cutDaoChance(door));

  var strong = mortalAt(60, { daoyun: 220, cult: 24000 });
  assert.ok(Sim.cutDaoChance(strong) > Sim.cutDaoChance(door), '道蕴和战力更高，斩道把握应更大');

  var weakSwallow = mortalAt(60, { daoyun: 40, cult: 3000, swallow: true, gift: 10 });
  weakSwallow.innate = 1;
  weakSwallow.aptitude = 1;
  assert.ok(Sim.isReverseCutPath(weakSwallow), '吞天凡体是逆斩路');
  assert.ok(Sim.cutDaoChance(weakSwallow) < 0.22, '道和力不够，不能因为吞天就当逆斩成功');

  var yeFan = mortalAt(60, { daoyun: 240, cult: 22000, swallow: true, gift: 10 });
  yeFan.innate = 1;
  yeFan.aptitude = 1;
  assert.ok(Sim.cutDaoChance(yeFan) > Sim.cutDaoChance(strong), '道和力够的逆斩应高于普通人斩一刀');
  assert.ok(Sim.cutDaoChance(yeFan) < 0.92, '逆斩也不是必过');

  var highGift = mortalAt(60, { daoyun: 220, cult: 24000, gift: 10 });
  highGift.innate = 1;
  highGift.aptitude = 1;
  assert.ok(Sim.cutDaoChance(highGift) > Sim.cutDaoChance(strong) + 0.08,
    '高悟性在门口应明显好斩，实际 ' + Sim.cutDaoChance(highGift) + ' / ' + Sim.cutDaoChance(strong));

  var chaos = Sim.createGame(0, []);
  Sim.setPhysique(chaos, D.physiqueById('chaos'));
  chaos.lvl = 60;
  chaos.daoyun = 200;
  chaos.cult = 40000;
  assert.ok(Sim.noRealmBottleneck(chaos), '混沌体没有境界瓶颈');
  assert.strictEqual(Sim.cutDaoChance(chaos), 1, '混沌斩道不应掷骰');
  assert.strictEqual(Sim.enterSaintChance(chaos), 1, '混沌入圣不应掷骰');
  assert.strictEqual(Sim.canAdvance(chaos), true, '混沌体不该卡在斩道门口');
  assert.ok(Sim.quasiUnlocked(chaos), '混沌体进准帝也不该再卡机缘门');

  var daoEmb = Sim.createGame(0, []);
  Sim.setPhysique(daoEmb, D.physiqueById('innate_sacred_dao'));
  daoEmb.lvl = 70;
  assert.ok(Sim.noRealmBottleneck(daoEmb), '先天圣体道胎没有境界瓶颈');
  assert.strictEqual(Sim.enterSaintChance(daoEmb), 1, '道胎入圣不应掷骰');
  assert.strictEqual(Sim.canAdvance(daoEmb), true, '道胎不该卡在圣位');

  var sacredDoor = Sim.createGame(0, []);
  Sim.setPhysique(sacredDoor, D.physiqueById('sacred'));
  sacredDoor.lvl = 70;
  sacredDoor.daoGift = 5;
  sacredDoor.daoyun = 400;
  sacredDoor.cult = 40000;
  assert.ok(Sim.enterSaintChance(sacredDoor) > 0.72, '荒古圣体入圣应很难卡住，实际 ' + Sim.enterSaintChance(sacredDoor));
  assert.ok(!Sim.noRealmBottleneck(sacredDoor), '荒古圣体仍有证道之难，只是圣位不该当凡人砍');

  var p1 = mortalAt(60, { daoyun: 200, cult: 18000, gift: 5 });
  var p2 = mortalAt(60, { daoyun: 200, cult: 18000, gift: 5 });
  p2.innate = 5; p2.aptitude = 5;
  var p3 = mortalAt(60, { daoyun: 200, cult: 18000, gift: 8 });
  var p4 = mortalAt(60, { daoyun: 200, cult: 28000, gift: 5 });
  assert.ok(Sim.cutDaoChance(p2) > Sim.cutDaoChance(p1), '同一套尺：体质升高，斩道把握应升高');
  assert.ok(Sim.cutDaoChance(p3) > Sim.cutDaoChance(p1), '同一套尺：悟性升高，斩道把握应升高');
  assert.ok(Sim.cutDaoChance(p4) > Sim.cutDaoChance(p1), '同一套尺：战力升高，斩道把握应升高');
  var w = 0.32 + 0.20 + 0.32 + 0.16;
  assert.ok(Math.abs(w - 1) < 1e-9, '斩道四柱权重应合计 1');

  var log = [];
  Sim.ensureCutDao(door, log);
  assert.ok(door.cutEveOffered, '凡人该先看见斩道前夜');
  assert.ok(!door.cutDaoTried, '前夜那年不应落刀');
  Sim.ensureCutDao(door, log);
  assert.ok(door.cutDaoTried, '前夜过后，道蕴够了就斩一刀');
  assert.ok(!door.pendingChoice, '斩道不是选择题');
  assert.ok(log.length, '斩道应写下旁白');
  var again = door.cutDaoPassed;
  Sim.ensureCutDao(door, []);
  assert.strictEqual(door.cutDaoPassed, again, '斩道一生只判一次');

  var king = mortalAt(70, { daoyun: 200, cult: 8000 });
  assert.strictEqual(Sim.canAdvance(king), false, '没过入圣不能进圣人');
  assert.ok(Sim.enterSaintChance(king) < 0.22, '凡体弱战力入圣应很低，实际 ' + Sim.enterSaintChance(king));
  var kingLog = [];
  Sim.ensureEnterSaint(king, kingLog);
  assert.ok(king.saintEveOffered, '凡人入圣前该先看见圣位枯坐');
  assert.ok(!king.saintTried, '枯坐那年不应判入圣');
  Sim.ensureEnterSaint(king, kingLog);
  assert.ok(king.saintTried, '枯坐过后，道蕴够了就判入圣');
  assert.ok(!king.pendingChoice, '入圣不是选择题');

  var passed = 0, n;
  for (n = 0; n < 80; n++) {
    var roll = mortalAt(60, { daoyun: 90, cult: 5000 });
    Sim.ensureCutDao(roll, []);
    Sim.ensureCutDao(roll, []);
    if (roll.cutDaoPassed) passed++;
  }
  assert.ok(passed <= 22, '大部分凡人过不了斩道，80 次过了 ' + passed);
})();

/* ---------- 事件先后：前事留下钩子，后事才能出现 ---------- */
(function () {
  var g = Sim.createGame(0, []);
  Sim.setPhysique(g, D.physiqueById('mortal'));
  g.innate = 1;
  g.lvl = 55;
  g.age = 400;
  assert.ok(!Sim.hasStory(g, 'omen_grudge'), '开局不该带着天象余恨');
  var echo = byId('th_echo_omen');
  assert.ok(echo, '应有教主余恨');
  assert.ok(!Sim.isStakeEvent(echo), '余波不占梭哈额度');
  assert.ok(!echo.choice, '余波不是选择题');
  assert.ok(!Sim.eventAvailable(g, echo), '没争过天象，教主不该上门');
  Sim.markStory(g, 'omen_grudge');
  assert.ok(Sim.hasStory(g, 'omen_grudge'), '天象失败应记下余恨');
  assert.ok(Sim.eventAvailable(g, echo), '记下余恨后，教主余恨应能抽到');

  var herb = byId('th_echo_herb');
  assert.ok(herb, '应有药气泄露');
  g.lvl = 30;
  g.age = 80;
  assert.ok(!Sim.eventAvailable(g, herb), '没吃过圣药，不该有人闻香而来');
  Sim.markStory(g, 'herb_scent');
  assert.ok(Sim.eventAvailable(g, herb), '吃过圣药后，药气泄露应能抽到');

  var tide = byId('th_echo_tide');
  g.lvl = 65;
  g.age = 200;
  assert.ok(!Sim.eventAvailable(g, tide), '没迎过王者潮，不该有潮退旧债');
  Sim.markStory(g, 'tide_debt');
  assert.ok(Sim.eventAvailable(g, tide), '迎过潮后，旧债应能找上门');

  var omen = byId('heavenly_omen');
  var lost = Sim.createGame(0, []);
  Sim.setPhysique(lost, D.physiqueById('mortal'));
  lost.lvl = 55;
  lost.age = 400;
  omen.fail(lost, Sim.U);
  assert.ok(Sim.hasStory(lost, 'omen_grudge'), '天象争夺失败应留下教主余恨');

  var yaog = Sim.createGame(0, []);
  Sim.setPhysique(yaog, D.physiqueById('mortal'));
  yaog.lvl = 30;
  yaog.age = 80;
  byId('shengyao').ok(yaog, Sim.U, []);
  assert.ok(Sim.hasStory(yaog, 'herb_scent'), '服下圣药应留下药气');

  var hook = Sim.createGame(0, []);
  Sim.setPhysique(hook, D.physiqueById('mortal'));
  hook.innate = 1;
  hook.lvl = 55;
  hook.age = 400;
  hook.eventDrawsBySpan = { pre: 3 };
  Sim.markStory(hook, 'omen_grudge');
  var rnd = Math.random;
  Math.random = function () { return 0.1; };
  Sim.rollEvent(hook, []);
  Math.random = rnd;
  assert.ok(hook.maxCount && hook.maxCount.th_echo_omen != null && hook.maxCount.th_echo_omen < 1,
    '有余恨时，下一次抽事应先出教主余恨');
  assert.ok(!Sim.hasStory(hook, 'omen_grudge'), '余波出过之后，钩子应摘掉');

  var remnant = byId('th_echo_script');
  assert.ok(remnant, '应有残篇故人');
  g.lvl = 20;
  g.age = 40;
  assert.ok(!Sim.eventAvailable(g, remnant), '没补过残篇，故人不该找来');
  Sim.markStory(g, 'remnant_owner');
  assert.ok(Sim.eventAvailable(g, remnant), '补过残篇后，故人应能找来');
  var taught = Sim.createGame(0, []);
  Sim.setPhysique(taught, D.physiqueById('mortal'));
  taught.lvl = 20;
  taught.age = 40;
  taught.daoGift = 8;
  byId('dao_mortal_untaught').ok(taught, Sim.U);
  assert.ok(Sim.hasStory(taught, 'remnant_owner'), '补出残篇应留下故人钩子');

  var market = byId('th_echo_market');
  assert.ok(market, '应有髓香追来');
  g.lvl = 65;
  g.age = 200;
  Sim.clearStory(g, 'remnant_owner');
  assert.ok(!Sim.eventAvailable(g, market), '没走过暗市，不该有人追髓');
  Sim.markStory(g, 'dark_buy');
  assert.ok(Sim.eventAvailable(g, market), '暗市得手后，髓香追来应能抽到');
  var buy = Sim.createGame(0, []);
  Sim.setPhysique(buy, D.physiqueById('mortal'));
  buy.lvl = 65;
  buy.age = 200;
  byId('star_sea_auction').ok(buy, Sim.U);
  assert.ok(Sim.hasStory(buy, 'dark_buy'), '暗市得手应留下髓香');
})();

console.log('midgame-rhythm: ok');
