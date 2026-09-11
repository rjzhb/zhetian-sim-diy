const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Sim = require('../sim.js');
const DATA = require('../data.js');
const oldRandom = Math.random;

assert.strictEqual(DATA.DAO_ABSOLUTE_MAX, 3000);
assert.strictEqual(Sim.baseDaoyunCap(1), 500);
assert.strictEqual(Sim.baseDaoyunCap(10), 1500);
assert.ok(DATA.REALM_LIFE[10][0] >= 8000 && DATA.REALM_LIFE[10][1] >= 9000,
  'a quasi-emperor life must be able to reach about 9000 years');
assert.ok(DATA.EMPEROR_PATH_CLOSE_AGE >= 9000,
  'the imperial road must stay open through a full quasi-emperor lifespan');
const livingSacredAfterOldPathLimit = Sim.createGame(0, []);
Sim.setPhysique(livingSacredAfterOldPathLimit, DATA.physiqueById('sacred'));
livingSacredAfterOldPathLimit.lvl = 90;
livingSacredAfterOldPathLimit.age = DATA.EMPEROR_PATH_CLOSE_AGE;
livingSacredAfterOldPathLimit.lifeBase = DATA.EMPEROR_PATH_CLOSE_AGE + 5000;
livingSacredAfterOldPathLimit.lifeBonus = 0;
livingSacredAfterOldPathLimit.lifespan = DATA.EMPEROR_PATH_CLOSE_AGE + 5000;
let sacredPathLimitLog;
try {
  Math.random = function () { return 0.999999; };
  sacredPathLimitLog = Sim.rollYear(livingSacredAfterOldPathLimit);
} finally {
  Math.random = oldRandom;
}
assert.strictEqual(livingSacredAfterOldPathLimit.dead, false,
  'a sacred body with remaining lifespan must not die merely because the old emperor-path age limit passed');
assert.ok(livingSacredAfterOldPathLimit.age < livingSacredAfterOldPathLimit.lifespan);
assert.ok(!sacredPathLimitLog.some(function (entry) {
  return entry.text.indexOf('帝路彻底闭合') >= 0 || entry.text.indexOf('最终坐化') >= 0;
}), 'passing an arbitrary path age must not falsely narrate death');
assert.strictEqual(typeof Sim.drawDaoGift, 'function');
assert.strictEqual(typeof Sim.daoGiftName, 'function');
assert.strictEqual(Sim.daoGiftName(9), '绝世天才');
try {
  Math.random = function () { return 0; };
  assert.strictEqual(Sim.drawDaoGift().tier, 1, 'the lowest roll must be an ordinary Dao gift');
} finally {
  Math.random = oldRandom;
}
const mortalGenius = Sim.createGame(0, []);
Sim.setPhysique(mortalGenius, DATA.physiqueById('mortal'));
mortalGenius.daoGift = 9;
mortalGenius.daoGiftName = Sim.daoGiftName(9);
mortalGenius.daoyun = 55;
mortalGenius.daoyunCap = 1600;
mortalGenius.lvl = 70;
assert.ok(Sim.effectiveDaoyunNeed(mortalGenius, 70) < Sim.effectiveDaoyunNeed({
  physiqueId: 'mortal', innate: 1, daoGift: 2
}, 70), 'a mortal peerless Dao genius must break bottlenecks more easily than a dull mortal');
assert.ok(Sim.effectiveDaoyunNeed(mortalGenius, 70) <= 50,
  'peerless Dao talent should let an ordinary body create methods and advance');

assert.strictEqual(typeof Sim.emperorLifeSpanRange, 'function');
const emperorLifeRanges = [
  [8000, 12000], [15000, 25000], [30000, 45000], [50000, 70000],
  [70000, 95000], [90000, 120000], [110000, 145000], [130000, 170000]
];
let eightLifeMin = 0, eightLifeMax = 0;
emperorLifeRanges.forEach(function (range, index) {
  assert.deepStrictEqual(Sim.emperorLifeSpanRange(index + 1), range);
  eightLifeMin += range[0];
  eightLifeMax += range[1];
});
assert.ok(eightLifeMin >= 500000 && eightLifeMax >= 650000);
assert.deepStrictEqual(Sim.emperorLifeSpanRange(1, { physiqueId: 'sacred' }), [20000, 26000]);
assert.deepStrictEqual(Sim.emperorLifeSpanRange(1, { physiqueId: 'origin_sacred' }), [20000, 26000]);
assert.deepStrictEqual(Sim.emperorLifeSpanRange(1, { physiqueId: 'innate_sacred_dao' }), [20000, 26000]);
assert.deepStrictEqual(Sim.emperorLifeSpanRange(1, { physiqueId: 'chaos' }), [8000, 12000]);
assert.deepStrictEqual(Sim.emperorLifeSpanRange(2, { physiqueId: 'sacred' }), [15000, 25000],
  'later sacred-body lives keep the ordinary reverse-life spans');
['sacred', 'origin_sacred', 'innate_sacred_dao'].forEach(function (id) {
  const g = Sim.createGame(0, []);
  Sim.setPhysique(g, DATA.physiqueById(id));
  Sim.becomeDi(g, [], 'force');
  const span = g.emperorLifeEnd - g.emperorLifeStart;
  assert.ok(span >= 20000 && span <= 26000, id + ' first emperor life must last more than 20,000 years');
});
const chaosLife = Sim.createGame(0, []);
Sim.setPhysique(chaosLife, DATA.physiqueById('chaos'));
Sim.becomeDi(chaosLife, [], 'force');
assert.ok(chaosLife.emperorLifeEnd - chaosLife.emperorLifeStart <= 12000,
  'chaos first emperor life stays on the ordinary span');

assert.strictEqual(typeof Sim.emperorDaoyunGainPerYear, 'function');
const longLifeDao = Sim.createGame(0, []);
longLifeDao.innate = 10;
longLifeDao.emperorLifeStart = 0;
longLifeDao.emperorLifeEnd = 100000;
assert.ok(Sim.emperorDaoyunGainPerYear(longLifeDao) * 100000 <= 810,
  'a long emperor life must not generate unlimited Dao merely from elapsed years');
function emperorDaoBudget(lifeNo) {
  const g = Sim.createGame(0, []);
  g.innate = 10;
  g.lifeNo = lifeNo;
  g.emperorLifeStart = 0;
  g.emperorLifeEnd = 20000;
  return Sim.emperorDaoyunGainPerYear(g) * 20000;
}
assert.ok(emperorDaoBudget(2) < emperorDaoBudget(1) * 0.2,
  'the second life must gain far less Dao from waiting than the first');
assert.ok(emperorDaoBudget(3) < emperorDaoBudget(2),
  'each extra life through the fifth must slow passive Dao further');
assert.ok(emperorDaoBudget(5) < emperorDaoBudget(3),
  'the fifth life must be slower still than the third');
assert.ok(emperorDaoBudget(6) <= emperorDaoBudget(5) * 1.05,
  'from the sixth life onward passive Dao stays low; stability comes from reversal mastery');

assert.strictEqual(typeof Sim.reversePathChance, 'function');
function chaosAfterFirstEmperorLife(traitIds) {
  const g = Sim.createGame(0, traitIds, {
    tier: 7, name: Sim.daoGiftName(7), initialDaoyun: 160
  });
  Sim.setPhysique(g, DATA.physiqueById('chaos'));
  g.daoGift = 7;
  g.era = { id: 'normal', name: '平常时代', daog: 0.75, evt: 1, evf: 1 };
  Sim.gainDaoyun(g, 0.125 * (0.2 + g.innate * 0.5) * 400);
  Sim.becomeDi(g, [], 'force');
  g.redDustRoots = { body: 2, soul: 2, dao: 2 };
  g.cult = Math.max(g.cult, 800000);
  const span = Math.max(1, g.emperorLifeEnd - g.emperorLifeStart);
  Sim.gainDaoyun(g, Sim.emperorDaoyunGainPerYear(g) * span);
  return g;
}
const bareChaosFirstLife = chaosAfterFirstEmperorLife([]);
assert.ok(bareChaosFirstLife.daoyun / bareChaosFirstLife.daoyunCap < 0.85,
  'chaos without Dao-growth cards must not fill the personal cap in one ordinary emperor life');
assert.strictEqual(Sim.reversePathChance(bareChaosFirstLife), 0,
  'an unfilled Dao sea must not reveal the reverse-life path');
const goldDaoChaosFirstLife = chaosAfterFirstEmperorLife(['o08']);
assert.ok(goldDaoChaosFirstLife.daoyun / goldDaoChaosFirstLife.daoyunCap >= 0.85,
  'chaos with a gold Dao-growth card should fill the personal cap in one ordinary emperor life');
assert.ok(Sim.reversePathChance(goldDaoChaosFirstLife) >= 0.7,
  'a filled Dao sea with balanced roots and sufficient power should almost always reveal reverse-life');

const batchedEmperor = Sim.createGame(0, []);
Sim.becomeDi(batchedEmperor, [], 'force');
batchedEmperor.lifeNo = 8;
batchedEmperor.emperorLifeStart = batchedEmperor.age;
batchedEmperor.emperorLifeEnd = batchedEmperor.age + 150000;
batchedEmperor.lifeBase = batchedEmperor.emperorLifeEnd;
batchedEmperor.knowsStrangeWorld = false;
const ageBeforeEmperorTick = batchedEmperor.age;
try {
  Math.random = function () { return 0.5; };
  Sim.rollYear(batchedEmperor);
} finally {
  Math.random = oldRandom;
}
assert.ok(batchedEmperor.age - ageBeforeEmperorTick >= 500,
  'long emperor lives must advance in playable multi-century ticks');

assert.strictEqual(typeof Sim.reverseLifeChance, 'function');
function reverseFixture(dao, cap, lifeNo) {
  const g = Sim.createGame(0, ['w06', 'w11']);
  Sim.setPhysique(g, DATA.physiqueById('mortal'));
  Sim.becomeDi(g, [], 'force');
  g.daoyun = dao;
  g.daoyunCap = cap;
  g.lifeNo = lifeNo;
  g.redDustRoots = { body: 2, soul: 2, dao: 2 };
  return g;
}
const lowDaoReverse = Sim.reverseLifeChance(reverseFixture(300, 1500, 2));
const highDaoReverse = Sim.reverseLifeChance(reverseFixture(900, 1500, 2));
assert.ok(highDaoReverse > lowDaoReverse, 'higher absolute Dao should improve reversal');
assert.strictEqual(Sim.reverseLifeChance(reverseFixture(100, 100, 2)) < 0.25, true, 'a tiny full cap must not guarantee reversal');
assert.strictEqual(typeof Sim.reverseMethodReady, 'function');
function readyReverseFixture(dao, cap, lifeNo) {
  const g = reverseFixture(dao, cap, lifeNo);
  g.redDustPath = 'reverse';
  g.reverseMethodReadyFor = lifeNo + 1;
  return g;
}
const fullSeaRates = [];
for (let lifeNo = 1; lifeNo <= 8; lifeNo++) {
  const full = readyReverseFixture(2000, 2000, lifeNo);
  fullSeaRates.push(Sim.reverseLifeChance(full));
  assert.ok(Sim.reverseLifeChance(full) >= 0.98,
    'full Dao plus the new method should almost guarantee life ' + (lifeNo + 1));
}
const fullSeaChain = fullSeaRates.reduce(function (prod, chance) { return prod * chance; }, 1);
assert.ok(fullSeaChain >= 0.85,
  'keeping the Dao sea full and learning every new method should make the complete chain highly likely');
const noThirdLifeMethod = reverseFixture(2000, 2000, 2);
noThirdLifeMethod.redDustPath = 'reverse';
assert.strictEqual(Sim.reverseMethodReady(noThirdLifeMethod), false);
assert.ok(Sim.reverseLifeChance(noThirdLifeMethod) <= 0.08,
  'a full Dao sea cannot replace learning the next distinct longevity method');
const almostFullWithMethod = readyReverseFixture(1800, 2000, 2);
assert.ok(Sim.reverseLifeChance(almostFullWithMethod) < Sim.reverseLifeChance(readyReverseFixture(2000, 2000, 2)),
  'the hard part after each reversal must be refilling the newly enlarged Dao sea');
const secondLifeByForce = reverseFixture(800, 1500, 1);
secondLifeByForce.deathless = false;
secondLifeByForce.deathlessUsed = false;
assert.ok(Sim.reverseLifeChance(secondLifeByForce) <= 0.45,
  'without immortal medicine, brute-forcing the second life must remain unlikely');
secondLifeByForce.deathless = true;
assert.ok(Sim.reverseLifeChance(secondLifeByForce) < 1,
  'merely owning immortal medicine must not silently consume it or overwrite the displayed natural chance');

assert.strictEqual(typeof Sim.grantEmperorDeathless, 'function');
assert.strictEqual(typeof Sim.openDeathlessChoice, 'function');
assert.strictEqual(typeof Sim.chooseDeathless, 'function');
const medicineGranted = Sim.createGame(0, []);
try {
  Math.random = function () { return 0.399; };
  assert.strictEqual(Sim.grantEmperorDeathless(medicineGranted, []), true);
} finally {
  Math.random = oldRandom;
}
assert.strictEqual(medicineGranted.deathless, true,
  'roughly forty percent of emperors should possess immortal medicine');
const medicineMissed = Sim.createGame(0, []);
try {
  Math.random = function () { return 0.401; };
  assert.strictEqual(Sim.grantEmperorDeathless(medicineMissed, []), false);
} finally {
  Math.random = oldRandom;
}
assert.strictEqual(medicineMissed.deathless, false);

const medicineChoice = reverseFixture(900, 1500, 1);
medicineChoice.deathless = true;
medicineChoice.deathlessUsed = false;
medicineChoice.redDustPath = null;
assert.strictEqual(Sim.openDeathlessChoice(medicineChoice, []), true);
assert.strictEqual(medicineChoice.awaitingDeathlessChoice, true);
assert.strictEqual(medicineChoice.lifeNo, 1, 'opening the choice must pause before resolving the first emperor life');
assert.strictEqual(Sim.chooseDeathless(medicineChoice, true, []), true);
assert.strictEqual(medicineChoice.awaitingDeathlessChoice, false);
assert.strictEqual(medicineChoice.deathlessUsed, true);
assert.strictEqual(medicineChoice.reverseMedicineUsed, true);
assert.strictEqual(medicineChoice.redDustPath, 'reverse');
assert.strictEqual(medicineChoice.lifeNo, 2,
  'accepting the choice must consume the medicine and guarantee the second life');

const medicineDeclined = reverseFixture(1500, 1500, 1);
medicineDeclined.deathless = true;
medicineDeclined.deathlessUsed = false;
medicineDeclined.redDustPath = 'reverse';
Sim.openDeathlessChoice(medicineDeclined, []);
try {
  Math.random = function () { return 0; };
  assert.strictEqual(Sim.chooseDeathless(medicineDeclined, false, []), true);
} finally {
  Math.random = oldRandom;
}
assert.strictEqual(medicineDeclined.deathlessUsed, false,
  'declining must preserve the medicine and use the natural reverse-life resolution');
assert.strictEqual(medicineDeclined.lifeNo, 2);

const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
assert.ok(htmlSource.indexOf('deathless-mask') >= 0 &&
  htmlSource.indexOf('btn-deathless-use') >= 0 &&
  htmlSource.indexOf('btn-deathless-decline') >= 0,
  'the first emperor-life ending must expose a visible immortal-medicine choice');
assert.ok(htmlSource.indexOf('ui-version-switch') >= 0 &&
  htmlSource.indexOf('beta-map-shell') >= 0 &&
  (htmlSource.match(/data-star-node=/g) || []).length >= 6,
  'the dormant Beta build must retain its multi-node star map for later development');
assert.ok(/class="ui-version-switch"[^>]*hidden/.test(htmlSource) &&
  /id="btn-game-version"[^>]*hidden/.test(htmlSource),
  'the unfinished Beta map entry points must remain hidden from players');
const betaGameSource = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
assert.ok(betaGameSource.indexOf('BETA_MAP_ENABLED = false') >= 0 &&
  betaGameSource.indexOf("KEY_UI_VERSION = 'zt_ui_version'") >= 0 &&
  betaGameSource.indexOf('function renderBetaMap(') >= 0,
  'the Beta implementation must remain feature-gated while its code is retained');
const styleSource = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
assert.ok(styleSource.indexOf('.beta-star-map') >= 0 &&
  styleSource.indexOf('body.ui-beta') >= 0,
  'the Beta map must have a dedicated responsive visual layer');

const sacredDaoBurst = Sim.createGame(0, []);
Sim.setPhysique(sacredDaoBurst, DATA.physiqueById('sacred'));
Sim.becomeDi(sacredDaoBurst, [], 'force');
sacredDaoBurst.deathless = false;
assert.ok(sacredDaoBurst.daoyun >= 2400, 'sacred-body emperor Dao must still erupt');
assert.ok(Sim.reverseLifeChance(sacredDaoBurst) < 0.98,
  'the sacred Dao eruption helps greatly but is not a full sea by itself');

assert.strictEqual(typeof Sim.tryReverseLife, 'function');
function longChaosFirstLife(traitIds) {
  const g = Sim.createGame(0, traitIds, {
    tier: 7, name: Sim.daoGiftName(7), initialDaoyun: 160
  });
  Sim.setPhysique(g, DATA.physiqueById('chaos'));
  g.daoGift = 7;
  g.era = { id: 'normal', name: '平常时代', daog: 0.75, evt: 1, evf: 1 };
  g.lvl = 91;
  Sim.gainDaoyun(g, 0.125 * (0.2 + g.innate * 0.5) * 2200);
  Sim.becomeDi(g, [], 'force');
  g.redDustRoots = { body: 2, soul: 2, dao: 2 };
  g.cult = Math.max(g.cult, 800000);
  const span = Math.max(1, g.emperorLifeEnd - g.emperorLifeStart);
  Sim.gainDaoyun(g, Sim.emperorDaoyunGainPerYear(g) * span);
  for (let i = 0; i < 24; i++) {
    const id = Sim.pickEmperorBeat(g);
    if (id) Sim.runEmperorExperience(g, id, []);
  }
  return g;
}
const longBareChaos = longChaosFirstLife([]);
assert.ok(longBareChaos.daoyun / longBareChaos.daoyunCap < 0.85,
  'chaos sitting through quasi-emperor and one emperor life still must not fill Dao without gold growth');
assert.strictEqual(Sim.reversePathChance(longBareChaos), 0);
const longGoldChaos = longChaosFirstLife(['o08']);
assert.ok(longGoldChaos.daoyun / longGoldChaos.daoyunCap >= 0.85,
  'gold Dao-growth should still let chaos fill the sea across a long first life');

function goldChaosLaterLifeWait(lifeNo, dao, cap) {
  const g = Sim.createGame(0, ['o08']);
  Sim.setPhysique(g, DATA.physiqueById('chaos'));
  g.era = { id: 'normal', name: '平常时代', daog: 0.75, evt: 1, evf: 1 };
  Sim.becomeDi(g, [], 'force');
  g.lifeNo = lifeNo;
  g.daoyun = dao;
  g.daoyunCap = cap;
  g.emperorLifeStart = g.age;
  g.emperorLifeEnd = g.age + 20000;
  Sim.gainDaoyun(g, Sim.emperorDaoyunGainPerYear(g) * 20000);
  return g;
}
const goldChaosSecondWait = goldChaosLaterLifeWait(2, 1500, 1680);
assert.ok(goldChaosSecondWait.daoyun / goldChaosSecondWait.daoyunCap < 0.995,
  'later lives must not refill the raised cap by waiting alone');
const laterEvent = Sim.createGame(0, ['o08']);
Sim.setPhysique(laterEvent, DATA.physiqueById('chaos'));
laterEvent.era = { id: 'normal', name: '平常时代', daog: 0.75, evt: 1, evf: 1 };
Sim.becomeDi(laterEvent, [], 'force');
laterEvent.lifeNo = 4;
laterEvent.daoyun = 1600;
laterEvent.daoyunCap = 1980;
const daoBeforeEvent = laterEvent.daoyun;
Sim.runEmperorExperience(laterEvent, 'time_scar', []);
assert.ok(laterEvent.daoyun > daoBeforeEvent,
  'later lives must still gain Dao from insights and opportunities');

const reverseGame = reverseFixture(1500, 1500, 2);
reverseGame.redDustPath = 'reverse';
const reverseDaoBefore = reverseGame.daoyun;
const reverseCapBefore = reverseGame.daoyunCap;
assert.strictEqual(Sim.tryReverseLife(reverseGame, [], true), true);
assert.ok(reverseGame.daoyunCap > reverseCapBefore, 'successful reversal should raise Dao cap');
assert.strictEqual(reverseGame.daoyun, reverseDaoBefore, 'successful reversal must not refill Dao');
assert.strictEqual(reverseGame.redDustRoutes.length, 1);

assert.strictEqual(typeof Sim.quasiLayerMultiplier, 'function');
assert.ok(Sim.quasiLayerMultiplier({ physiqueId: 'mortal' }, 91) >= 2,
  'the first quasi-emperor layer must already be slower than Great Sage');
assert.ok(Sim.quasiLayerMultiplier({ physiqueId: 'mortal' }, 98) >
  Sim.quasiLayerMultiplier({ physiqueId: 'mortal' }, 91),
  'later quasi-emperor layers must keep getting harder');
assert.ok(Sim.quasiLayerMultiplier({ physiqueId: 'chaos' }, 98) <
  Sim.quasiLayerMultiplier({ physiqueId: 'mortal' }, 98),
  'chaos may shorten quasi-emperor waits but still cannot skip the climb');
assert.strictEqual(Sim.quasiLayerMultiplier({ physiqueId: 'innate_sacred_dao' }, 98),
  Sim.quasiLayerMultiplier({ physiqueId: 'chaos' }, 98),
  'the two peak physiques should climb quasi-emperor at the same pace');
assert.strictEqual(Sim.quasiLayerMultiplier({ physiqueId: 'mortal' }, 90), 1);

assert.strictEqual(typeof Sim.daoyunNeed, 'function');
assert.ok(Sim.daoyunNeed(60) > Sim.daoyunNeed(59), 'Great Power to King must be a Dao gate');
assert.ok(Sim.daoyunNeed(70) > Sim.daoyunNeed(69), 'King to Saint must be a Dao gate');
assert.ok(Sim.daoyunNeed(80) > Sim.daoyunNeed(79), 'Saint to Great Sage must be a Dao gate');
assert.ok(Sim.daoyunNeed(90) > Sim.daoyunNeed(89), 'Great Sage to quasi-emperor must be a Dao gate');
assert.ok(Sim.daoyunNeed(96) > Sim.daoyunNeed(95) + 20, 'late quasi-emperor must jump again');
assert.ok(Sim.daoyunNeed(99) > Sim.daoyunNeed(98), 'ninth-layer perfection must demand more Dao than the eighth');
assert.ok(Sim.daoyunNeed(90) > Sim.daoyunNeed(80), 'entering quasi-emperor must need more Dao than Great Sage');
assert.ok(Sim.daoyunNeed(94) > Sim.daoyunNeed(91), 'Dao need must rise through quasi-emperor layers');
assert.ok(Sim.daoyunNeed(98) > Sim.daoyunNeed(94));
assert.ok(Sim.daoyunNeed(70) >= 160, 'King to Saint must be a real wall for ordinary physiques');
assert.ok(Sim.daoyunNeed(90) >= Sim.daoyunNeed(80) * 1.4, 'most Great Sages should stall before quasi-emperor');

assert.strictEqual(typeof Sim.effectiveDaoyunNeed, 'function');
assert.strictEqual(typeof Sim.canAdvance, 'function');
const mortalKing = Sim.createGame(0, []);
Sim.setPhysique(mortalKing, DATA.physiqueById('mortal'));
mortalKing.lvl = 70;
mortalKing.daoyun = 0;
assert.strictEqual(Sim.canAdvance(mortalKing), false, 'a mortal at King peak cannot enter Saint with empty Dao');
const chaosKing = Sim.createGame(0, []);
Sim.setPhysique(chaosKing, DATA.physiqueById('chaos'));
chaosKing.lvl = 70;
chaosKing.daoyun = 0;
assert.strictEqual(Sim.effectiveDaoyunNeed(chaosKing, 70), 0, 'chaos has no Dao bottleneck');
assert.strictEqual(Sim.canAdvance(chaosKing), true, 'chaos can break King to Saint without Dao');
const daoChaos = Sim.createGame(0, []);
Sim.setPhysique(daoChaos, DATA.physiqueById('chaos'));
daoChaos.daoyun = 100;
daoChaos.era = { daog: 1 };
const daoSacred = Sim.createGame(0, []);
Sim.setPhysique(daoSacred, DATA.physiqueById('innate_sacred_dao'));
daoSacred.daoyun = 100;
daoSacred.era = { daog: 1 };
const chaosGain = Sim.gainDaoyun(daoChaos, 20);
const sacredGain = Sim.gainDaoyun(daoSacred, 20);
assert.ok(sacredGain > chaosGain, 'Innate Sacred Dao Fetus must accumulate Dao faster than Chaos');
assert.strictEqual(typeof Sim.pickAcquiredPhysique, 'function');
for (let i = 0; i < 40; i++) {
  const acquired = Sim.pickAcquiredPhysique(10);
  assert.ok(acquired && acquired.id !== 'innate_sacred_dao',
    'acquired physique draws must never produce Innate Sacred Dao Fetus');
}
const yibianGame = Sim.createGame(0, []);
yibianGame.year = 3;
for (let i = 0; i < 40; i++) {
  const roll = Sim.createGame(0, []);
  roll.year = 3;
  Sim.drawHighTalent(roll);
  assert.notStrictEqual(roll.physiqueId, 'innate_sacred_dao',
    'physique mutation must not awaken Innate Sacred Dao Fetus');
}
const refuseLate = Sim.createGame(0, []);
Sim.setPhysique(refuseLate, DATA.physiqueById('mortal'));
refuseLate.year = 8;
Sim.setPhysique(refuseLate, DATA.physiqueById('innate_sacred_dao'));
assert.strictEqual(refuseLate.physiqueId, 'mortal',
  'a mid-life physique change must not become Innate Sacred Dao Fetus');
const fetusKing = Sim.createGame(0, []);
Sim.setPhysique(fetusKing, DATA.physiqueById('innate_sacred_dao'));
fetusKing.lvl = 90;
fetusKing.daoyun = 0;
assert.strictEqual(Sim.effectiveDaoyunNeed(fetusKing, 90), 0, 'innate sacred-dao fetus has no Dao bottleneck');
const sacredNeed = Sim.effectiveDaoyunNeed({ physiqueId: 'sacred', innate: 9 }, 70);
const divineNeed = Sim.effectiveDaoyunNeed({ physiqueId: 'divine_king', innate: 6 }, 70);
const mortalNeed = Sim.effectiveDaoyunNeed({ physiqueId: 'mortal', innate: 1 }, 70);
assert.ok(mortalNeed > divineNeed && divineNeed > sacredNeed && sacredNeed > 0,
  'stronger physiques must need less Dao, but only the two peak bodies ignore it');

assert.strictEqual(typeof Sim.daoBreakFactor, 'function');
const daoPace = Sim.createGame(0, []);
Sim.setPhysique(daoPace, DATA.physiqueById('divine_king'));
daoPace.lvl = 91;
daoPace.daoyun = Sim.effectiveDaoyunNeed(daoPace, 91);
const justMet = Sim.daoBreakFactor(daoPace);
daoPace.daoyun = Sim.effectiveDaoyunNeed(daoPace, 91) * 2;
assert.ok(Sim.daoBreakFactor(daoPace) > justMet, 'surplus Dao should speed late-realm breakthroughs');

const sageYears = 1 / Sim.breakChance(10, 85);
const quasiYears = 1 / Sim.breakChance(10, 91) * Sim.quasiLayerMultiplier({ physiqueId: 'chaos' }, 91);
assert.ok(quasiYears > sageYears * 2.5,
  'even a chaos body must spend far longer on the first quasi-emperor layer than on Great Sage');

assert.strictEqual(typeof Sim.forbiddenSleepRange, 'function');
assert.deepStrictEqual(Sim.forbiddenSleepRange({ sealingMaterial: '太初命石' }), [80000, 220000]);
assert.deepStrictEqual(Sim.forbiddenSleepRange({ sealingMaterial: '仙源' }), [150000, 400000]);
assert.deepStrictEqual(Sim.forbiddenSleepRange({ sealingMaterial: '仙源与太初命石' }), [250000, 600000]);

function sealedLord() {
  const g = Sim.createGame(0, []);
  Sim.becomeDi(g, [], 'force');
  g.xianSource = true;
  g.primordialStone = true;
  g.awaitingSelfSlash = true;
  Sim.chooseSelfSlash(g, true, []);
  return g;
}
Sim.setFast(false);
const firstSleep = sealedLord();
const firstSleepLog = Sim.rollYear(firstSleep) || [];
assert.ok((firstSleep.forbiddenSleepLeft || 0) > 0, 'self-slash must begin a long sleep instead of skipping it');
assert.strictEqual(firstSleep.awaitingDarkTurmoil, false,
  'the first year after sealing must not jump to a dark-turmoil prompt');
assert.ok(firstSleepLog.some(function (row) { return /沉/.test(row.text); }),
  'the player should see that the forbidden sleep has started');
let sleepTicks = 0;
while (firstSleep.forbiddenSleepLeft > 0 && sleepTicks++ < 80) Sim.rollYear(firstSleep);
assert.ok(sleepTicks >= 3, 'forbidden sleep must take several visible years to finish');
assert.ok(firstSleep.forbiddenSleepLeft === 0, 'the sleep should eventually end');
const afterTurmoil = sealedLord();
afterTurmoil.forbiddenSleepLeft = 0;
afterTurmoil.forbiddenSleepTotal = 0;
afterTurmoil.awaitingDarkTurmoil = true;
Sim.chooseDarkTurmoil(afterTurmoil, true, []);
Sim.rollYear(afterTurmoil);
assert.ok((afterTurmoil.forbiddenSleepLeft || 0) > 0,
  'after a dark turmoil the lord must fall asleep again instead of instantly seeing the next prompt');
assert.strictEqual(afterTurmoil.awaitingDarkTurmoil, false);
Sim.setFast(true);
const fastSleep = sealedLord();
Sim.rollYear(fastSleep);
assert.ok(!fastSleep.forbiddenSleepLeft,
  'fast calibration may still resolve a forbidden sleep in one step');
Sim.setFast(false);

assert.strictEqual(typeof Sim.undeadEmperorForRoll, 'function');
assert.deepStrictEqual(Sim.undeadEmperorForRoll(0), { lives: 2, cult: 1650000 });
assert.deepStrictEqual(Sim.undeadEmperorForRoll(0.1), { lives: 3, cult: 2100000 });
assert.deepStrictEqual(Sim.undeadEmperorForRoll(0.25), { lives: 4, cult: 2550000 });
assert.deepStrictEqual(Sim.undeadEmperorForRoll(0.5), { lives: 5, cult: 3000000 });
assert.deepStrictEqual(Sim.undeadEmperorForRoll(0.75), { lives: 6, cult: 3600000 });
assert.deepStrictEqual(Sim.undeadEmperorForRoll(0.9), { lives: 7, cult: 4300000 });
assert.deepStrictEqual(Sim.undeadEmperorForRoll(0.97), { lives: 8, cult: 5200000 });
assert.deepStrictEqual(Sim.undeadEmperorForRoll(0.995), { lives: 9, cult: 8000000, immortal: true });
assert.ok(Sim.undeadEmperorForRoll(0.5, 2000000).lives >
  Sim.undeadEmperorForRoll(0.5, 0).lives, 'later world years should shift the enemy toward later lives');

assert.strictEqual(typeof Sim.strangeWorldSituationForRoll, 'function');
assert.strictEqual(Sim.strangeWorldSituationForRoll(0.05), 'quiet');
assert.strictEqual(Sim.strangeWorldSituationForRoll(0.10), 'undead');
assert.strictEqual(Sim.strangeWorldSituationForRoll(0.79), 'undead');
assert.strictEqual(Sim.strangeWorldSituationForRoll(0.80), 'standoff');
assert.strictEqual(Sim.strangeWorldSituationForRoll(0.99), 'standoff');

assert.strictEqual(typeof Sim.strangeWorldAmbushChance, 'function');
const weakAmbush = Sim.createGame(0, []);
weakAmbush.undeadCult = 2000000;
weakAmbush.pm = {};
weakAmbush.tm.ward = 0;
weakAmbush.cult = 800000;
assert.ok(Sim.strangeWorldAmbushChance(weakAmbush) <= 0.12,
  'an unsupported challenger far below the emperor should rarely escape');
weakAmbush.cult = 1800000;
const nearPeerEscape = Sim.strangeWorldAmbushChance(weakAmbush);
assert.ok(nearPeerEscape >= 0.45 && nearPeerEscape <= 0.70,
  'a smaller power gap must make escape much more likely');
weakAmbush.cult = 2000000;
assert.ok(Sim.strangeWorldAmbushChance(weakAmbush) > nearPeerEscape,
  'closing the remaining gap should keep improving survival');

assert.strictEqual(typeof Sim.applyStrangeAmbushWound, 'function');
const woundedAmbush = Sim.createGame(0, []);
woundedAmbush.cult = 1000000;
woundedAmbush.daoyun = 1000;
woundedAmbush.daoyunCap = 1500;
woundedAmbush.strangeWorldInsight = 80;
woundedAmbush.redDustRoots = { body: 2, soul: 2, dao: 2 };
try {
  Math.random = function () { return 0.5; };
  Sim.applyStrangeAmbushWound(woundedAmbush);
} finally {
  Math.random = oldRandom;
}
assert.strictEqual(woundedAmbush.cult, 660000);
assert.strictEqual(woundedAmbush.daoyun, 800);
assert.strictEqual(woundedAmbush.daoyunCap, 1380);
assert.deepStrictEqual(woundedAmbush.redDustRoots, { body: 1, soul: 1, dao: 1 });

assert.strictEqual(typeof Sim.resolveUndeadHunt, 'function');
assert.strictEqual(typeof Sim.resolveUndeadHide, 'function');
const huntGame = Sim.createGame(0, []);
Sim.becomeDi(huntGame, [], 'force');
huntGame.inStrangeWorld = true;
huntGame.strangeWorldSituation = 'undead';
huntGame.undeadHunting = true;
huntGame.undeadCult = 3000000;
huntGame.cult = 2900000;
huntGame.strangeWorldInsight = 40;
const hideLog = [];
const cultBeforeHide = huntGame.cult;
assert.strictEqual(Sim.resolveUndeadHide(huntGame, hideLog, 8000), true);
assert.ok(huntGame.cult > cultBeforeHide, 'hiding must let the survivor grow stronger');
assert.ok(huntGame.strangeWorldInsight > 40, 'hiding must accumulate longevity insight');
assert.strictEqual(huntGame.defeatedUndead, false);
assert.strictEqual(huntGame.undeadHunting, true);
assert.ok(hideLog.some(function (row) { return /隐匿|藏|蛰伏/.test(row.text); }));

const killHunt = Sim.createGame(0, []);
Sim.becomeDi(killHunt, [], 'force');
killHunt.inStrangeWorld = true;
killHunt.strangeWorldSituation = 'undead';
killHunt.undeadHunting = true;
killHunt.undeadCult = 2000000;
killHunt.cult = 3200000;
killHunt.redDustRoots = { body: 2, soul: 2, dao: 2 };
try {
  Math.random = function () { return 0.01; };
  assert.strictEqual(Sim.resolveUndeadHunt(killHunt, []), true);
} finally {
  Math.random = oldRandom;
}
assert.strictEqual(killHunt.defeatedUndead, true, 'a stronger escapee should be able to slay the hunter');
assert.strictEqual(killHunt.undeadHunting, false);
assert.strictEqual(killHunt.dead, false);

const escapeHunt = Sim.createGame(0, []);
Sim.becomeDi(escapeHunt, [], 'force');
escapeHunt.inStrangeWorld = true;
escapeHunt.strangeWorldSituation = 'undead';
escapeHunt.undeadHunting = true;
escapeHunt.undeadCult = 4000000;
escapeHunt.cult = 3900000;
escapeHunt.redDustRoots = { body: 1, soul: 1, dao: 1 };
try {
  var huntRolls = [0.20, 0.99];
  var huntIdx = 0;
  Math.random = function () { return huntRolls[Math.min(huntIdx++, huntRolls.length - 1)]; };
  Sim.resolveUndeadHunt(escapeHunt, []);
} finally {
  Math.random = oldRandom;
}
assert.strictEqual(escapeHunt.dead, false, 'a close gap should let the player escape the chase');
assert.strictEqual(escapeHunt.defeatedUndead, false, 'escape without a kill must keep the hunt going');
assert.strictEqual(escapeHunt.undeadHunting, true);

assert.strictEqual(typeof Sim.forbiddenPurgeChance, 'function');
assert.strictEqual(Sim.forbiddenPurgeChance(0, true), 0.16);
assert.strictEqual(Sim.forbiddenPurgeChance(1, true), 0.25);
assert.strictEqual(Sim.forbiddenPurgeChance(2, true), 0.35);
assert.strictEqual(Sim.forbiddenPurgeChance(3, true), 0.48);
assert.strictEqual(Sim.forbiddenPurgeChance(4, true), 0.65);
assert.strictEqual(Sim.forbiddenPurgeChance(99, true), 0.65);
assert.strictEqual(Sim.forbiddenPurgeChance(99, false), 0, 'there is no emperor to perform a purge');

assert.strictEqual(typeof Sim.initWorldCalendar, 'function');
assert.strictEqual(typeof Sim.advanceWorldCalendar, 'function');
const freshCalendar = Sim.createGame(0, []);
Sim.initWorldCalendar(freshCalendar);
assert.strictEqual(freshCalendar.worldEmperor, null, 'a new life should not start under another emperor');
assert.ok(freshCalendar.nextWorldEmperorYear == null || freshCalendar.nextWorldEmperorYear >= 6000,
  'rival emperors must not be scheduled before the 6000-year fade');

const earlyCalendar = Sim.createGame(0, []);
earlyCalendar.worldYear = 0;
earlyCalendar.worldEmperor = null;
earlyCalendar.becameEmperor = false;
earlyCalendar.playerEmperorActive = false;
earlyCalendar.nextWorldEmperorYear = 10;
try {
  Math.random = function () { return 0.5; };
  Sim.advanceWorldCalendar(earlyCalendar, 500, []);
} finally {
  Math.random = oldRandom;
}
assert.strictEqual(earlyCalendar.worldEmperor, null, 'a 500-year prodigy must not be scooped by a background emperor');

const lateCalendar = Sim.createGame(0, []);
lateCalendar.worldYear = 0;
lateCalendar.worldEmperor = null;
lateCalendar.becameEmperor = false;
lateCalendar.playerEmperorActive = false;
lateCalendar.nextWorldEmperorYear = 6000;
try {
  Math.random = function () { return 0.5; };
  Sim.advanceWorldCalendar(lateCalendar, 6000, []);
} finally {
  Math.random = oldRandom;
}
assert.ok(lateCalendar.worldEmperor, 'after 6000 years without the player taking the throne, a rival may arise');
assert.strictEqual(lateCalendar.daoSuppressed, true);

const lateChanceCalendar = Sim.createGame(0, []);
lateChanceCalendar.worldYear = 5999;
lateChanceCalendar.worldEmperor = null;
lateChanceCalendar.becameEmperor = false;
lateChanceCalendar.playerEmperorActive = false;
lateChanceCalendar.nextWorldEmperorYear = null;
lateChanceCalendar.daoTraceUntil = null;
try {
  Math.random = function () { return 0; };
  Sim.advanceWorldCalendar(lateChanceCalendar, 1, []);
} finally {
  Math.random = oldRandom;
}
assert.ok(lateChanceCalendar.worldEmperor, 'after 6000 years a rival emperor should have a real chance to appear');

const traceCalendar = Sim.createGame(0, []);
traceCalendar.worldYear = 0;
traceCalendar.becameEmperor = false;
traceCalendar.playerEmperorActive = false;
traceCalendar.worldEmperor = { name: '测试大帝', start: 0, end: 10000, cult: 1500000 };
traceCalendar.nextWorldEmperorYear = null;
traceCalendar.daoTraceUntil = null;
Sim.advanceWorldCalendar(traceCalendar, 10000, []);
assert.strictEqual(traceCalendar.worldEmperor, null, 'an NPC emperor should sit in transformation at the end of their life');
assert.strictEqual(traceCalendar.daoSuppressed, true, 'dao traces must keep suppressing the cosmos after the emperor dies');
assert.ok(traceCalendar.daoTraceUntil >= 19000 && traceCalendar.daoTraceUntil <= 22000,
  'dao traces should linger about ten thousand years after death');
traceCalendar.lvl = 99;
traceCalendar.cult = 800000;
try {
  Math.random = function () { return 0; };
  Sim.tryZhengdao(traceCalendar, []);
} finally {
  Math.random = oldRandom;
}
assert.strictEqual(traceCalendar.becameEmperor, false, 'nobody can become emperor while lingering dao traces remain');
assert.strictEqual(traceCalendar.dead, false, 'waiting for traces to fade must not kill the challenger');

const tianxinFallback = Sim.createGame(0, []);
Sim.setPhysique(tianxinFallback, DATA.physiqueById('chaos'));
tianxinFallback.lvl = 99;
tianxinFallback.cult = 180000;
tianxinFallback.daoyun = Sim.effectiveDaoyunNeed(tianxinFallback, 99);
tianxinFallback.xintian = true;
tianxinFallback.worldEmperor = null;

const ninthLayerLowDao = Sim.createGame(0, []);
Sim.setPhysique(ninthLayerLowDao, DATA.physiqueById('divine_king'));
ninthLayerLowDao.lvl = 99;
ninthLayerLowDao.cult = 500000;
ninthLayerLowDao.daoyun = Math.max(0, Sim.effectiveDaoyunNeed(ninthLayerLowDao, 99) - 80);
ninthLayerLowDao.worldEmperor = null;
try {
  Math.random = function () { return 0; };
  Sim.tryZhengdao(ninthLayerLowDao, []);
} finally {
  Math.random = oldRandom;
}
assert.strictEqual(ninthLayerLowDao.becameEmperor, false, 'ninth-layer quasi-emperors without enough Dao cannot force the gate');
assert.strictEqual(ninthLayerLowDao.dead, false, 'waiting on Dao at the emperor gate must not kill the challenger');
try {
  Math.random = function () { return 0.5; };
  Sim.tryZhengdao(tianxinFallback, []);
} finally {
  Math.random = oldRandom;
}
assert.strictEqual(tianxinFallback.dead, false, 'ninth-layer Tianxin below the fusion line must not use the 15% early-fusion death');
assert.ok(tianxinFallback.becameEmperor, 'ninth-layer Tianxin below the fusion line should fall back to force proof');

const sacredEighth = Sim.createGame(0, []);
Sim.setPhysique(sacredEighth, DATA.physiqueById('sacred'));
sacredEighth.lvl = 98;
sacredEighth.cult = 180000;
sacredEighth.worldEmperor = null;
assert.strictEqual(sacredEighth.sacredPeakAwakened, false);
const ninthLog = [];
Sim.levelUp(sacredEighth, ninthLog);
assert.strictEqual(sacredEighth.lvl, 99);
assert.strictEqual(sacredEighth.sacredPeakAwakened, true,
  'a sacred body at the ninth quasi-emperor heaven is already a completed sacred body');
assert.ok(sacredEighth.cult >= DATA.SACRED_JIDAO_CULT,
  'a completed sacred body in a world without an emperor is already the universe’s first extreme-dao supreme');
assert.ok(ninthLog.some(function (line) { return /大成|极道至尊|宇宙第一/.test(line.text); }),
  'reaching the ninth heaven must announce 大成, not wait for another opportunity');

const sacredContested = Sim.createGame(0, []);
Sim.setPhysique(sacredContested, DATA.physiqueById('sacred'));
sacredContested.lvl = 99;
sacredContested.cult = 180000;
sacredContested.worldEmperor = { name: '当世大帝' };
Sim.completeSacredBody(sacredContested, []);
assert.ok(sacredContested.cult >= DATA.OVERWHELM_DAO_CULT,
  '大成 in an occupied heaven must still reach the 90万 line');
assert.ok(sacredContested.cult < DATA.SACRED_JIDAO_CULT,
  'a living emperor still denies the sacred body uncontested supremacy');

const sacredHeavenly = Sim.createGame(0, []);
Sim.setPhysique(sacredHeavenly, DATA.physiqueById('sacred'));
sacredHeavenly.lvl = 99;
sacredHeavenly.cult = 180000;
sacredHeavenly.daoyun = Sim.effectiveDaoyunNeed(sacredHeavenly, 99);
sacredHeavenly.worldEmperor = null;
try {
  Math.random = function () { return 0; };
  Sim.tryZhengdao(sacredHeavenly, []);
} finally {
  Math.random = oldRandom;
}
assert.ok(sacredHeavenly.sacredPeakAwakened, 'knocking on the emperor gate at the ninth heaven completes the sacred body');
assert.ok(sacredHeavenly.becameEmperor, 'a completed sacred body may still force the once-in-an-era emperor gate');
assert.ok(sacredHeavenly.cult >= DATA.HEAVENLY_EMPEROR_CULT, 'a sacred-body emperor must start at heavenly-emperor power');
assert.ok(sacredHeavenly.daoyun >= 2400 && sacredHeavenly.daoyunCap >= 2800,
  'a sacred-body emperor must still receive the promised Dao eruption');
assert.ok(sacredHeavenly.daoyun / sacredHeavenly.daoyunCap >= 0.88,
  'sacred-body success should fill the Dao sea almost to the brim');
assert.ok(Sim.reverseLifeChance(sacredHeavenly) >= 0.50 &&
  Sim.reverseLifeChance(sacredHeavenly) < 0.98,
  'the sacred Dao eruption should help greatly without counting as a completely full sea');

assert.strictEqual(typeof Sim.sacredEmperorChance, 'function');
assert.strictEqual(typeof Sim.completeSacredBody, 'function');
const sacredBare = Sim.createGame(0, []);
Sim.setPhysique(sacredBare, DATA.physiqueById('sacred'));
sacredBare.lvl = 99;
sacredBare.daoyun = 400;
sacredBare.daoGift = 5;
const sacredGold = Sim.createGame(0, ['o01', 'o04', 'o25']);
Sim.setPhysique(sacredGold, DATA.physiqueById('sacred'));
sacredGold.lvl = 99;
sacredGold.daoyun = 400;
sacredGold.daoGift = 5;
assert.ok(Sim.sacredEmperorChance(sacredGold) > Sim.sacredEmperorChance(sacredBare) * 1.35,
  'matching gold cards must raise the sacred emperor rate');
assert.ok(Sim.sacredEmperorChance(sacredBare) < 0.05,
  'a bare completed sacred body almost never becomes emperor');
assert.ok(Sim.sacredEmperorChance(sacredGold) >= 0.25 && Sim.sacredEmperorChance(sacredGold) <= 0.32,
  'matching gold cards should lift a completed sacred body to about a 30% emperor chance');
const sacredTianxin = Sim.createGame(0, []);
Sim.setPhysique(sacredTianxin, DATA.physiqueById('sacred'));
sacredTianxin.lvl = 99;
sacredTianxin.cult = DATA.OVERWHELM_DAO_CULT;
sacredTianxin.daoyun = Sim.effectiveDaoyunNeed(sacredTianxin, 99);
sacredTianxin.xintian = true;
sacredTianxin.worldEmperor = null;
try {
  Math.random = function () { return 0.5; };
  Sim.tryZhengdao(sacredTianxin, []);
} finally {
  Math.random = oldRandom;
}
assert.strictEqual(sacredTianxin.becameEmperor, false,
  'Tianxin must not let a sacred body skip the once-in-an-era emperor gate');

const suppressedGame = Sim.createGame(0, []);
Sim.setPhysique(suppressedGame, DATA.physiqueById('mortal'));
suppressedGame.lvl = 99;
suppressedGame.cult = DATA.OVERWHELM_DAO_CULT - 1;
suppressedGame.daoyun = Sim.effectiveDaoyunNeed(suppressedGame, 99);
suppressedGame.gotDiBing = true;
suppressedGame.deathless = true;
suppressedGame.resonanceState.overflowDao = 200;
suppressedGame.worldEmperor = { name: '测试大帝', start: 0, end: 10000, cult: 1500000 };
Sim.tryZhengdao(suppressedGame, []);
assert.strictEqual(suppressedGame.deadCause, 'world_emperor_suppression');

const overwhelmGame = Sim.createGame(0, []);
overwhelmGame.lvl = 99;
overwhelmGame.cult = 1500000;
overwhelmGame.daoyun = Sim.effectiveDaoyunNeed(overwhelmGame, 99);
overwhelmGame.worldEmperor = { name: '测试大帝', start: 0, end: 10000, cult: 1500000 };
try {
  Math.random = function () { return 0; };
  Sim.tryZhengdao(overwhelmGame, []);
} finally {
  Math.random = oldRandom;
}
assert.strictEqual(overwhelmGame.ascendMode, 'overwhelm');
assert.ok(overwhelmGame.cult >= DATA.HEAVENLY_EMPEROR_CULT);

const suppressedTianxin = Sim.createGame(0, []);
suppressedTianxin.lvl = 91;
suppressedTianxin.worldEmperor = { name: '测试大帝', start: 0, end: 10000, cult: 1500000 };
try {
  Math.random = function () { return 0; };
  Sim.rollYear(suppressedTianxin);
} finally {
  Math.random = oldRandom;
}
assert.strictEqual(suppressedTianxin.xintian, false, 'Tianxin cannot be acquired while another emperor owns it');

const suppressionTraitGame = Sim.createGame(0, ['o18']);
suppressionTraitGame.lvl = 99;
suppressionTraitGame.cult = DATA.OVERWHELM_DAO_CULT;
suppressionTraitGame.daoyun = Sim.effectiveDaoyunNeed(suppressionTraitGame, 99);
suppressionTraitGame.worldEmperor = { name: '测试大帝', start: 0, end: 10000, cult: 1500000 };
try {
  Math.random = function () { return 0.4; };
  Sim.tryZhengdao(suppressionTraitGame, []);
} finally {
  Math.random = oldRandom;
}
assert.strictEqual(suppressionTraitGame.ascendMode, 'overwhelm', 'suppression traits should improve the reachable overwhelm branch');

assert.strictEqual(typeof Sim.tryStrangeWorldImmortality, 'function');
assert.strictEqual(typeof Sim.strangeWorldImmortalityChance, 'function');
const limitedAttempts = Sim.createGame(0, []);
Sim.becomeDi(limitedAttempts, [], 'force');
limitedAttempts.inStrangeWorld = true;
limitedAttempts.strangeWorldInsight = 100;
limitedAttempts.strangeWorldEvents = 18;
limitedAttempts.daoyun = 900;
limitedAttempts.daoyunCap = 1500;
limitedAttempts.innate = 10;
const calibratedImmortalChance = Sim.strangeWorldImmortalityChance(limitedAttempts);
assert.ok(calibratedImmortalChance >= 0.28 && calibratedImmortalChance <= 0.30);
try {
  Math.random = function () { return 0.999; };
  Sim.tryStrangeWorldImmortality(limitedAttempts, []);
  assert.strictEqual(limitedAttempts.dead, false);
  Sim.tryStrangeWorldImmortality(limitedAttempts, []);
} finally {
  Math.random = oldRandom;
}
assert.strictEqual(limitedAttempts.strangeWorldImmortalAttempts, 2);
assert.strictEqual(limitedAttempts.dead, true, 'the second failed immortal transformation should be fatal');

const entryGame = Sim.createGame(0, ['w06', 'w11']);
Sim.becomeDi(entryGame, [], 'force');
entryGame.awaitingImmortalPath = true;
entryGame.knowsStrangeWorld = true;
entryGame.cult = 2000000;
try {
  Math.random = function () { return 0.9; };
  assert.strictEqual(Sim.chooseImmortalPath(entryGame, 'strange', []), true);
} finally {
  Math.random = oldRandom;
}
assert.strictEqual(entryGame.inStrangeWorld, true);
assert.strictEqual(entryGame.strangeWorldSituation, 'standoff');
assert.strictEqual(entryGame.undeadLives, 7);
assert.strictEqual(entryGame.undeadImmortal, false);
assert.strictEqual(entryGame.dead, false);
assert.strictEqual(entryGame.ascended, false);

entryGame.awaitingStrangeWorldChoice = true;
assert.strictEqual(typeof Sim.chooseStrangeWorldAlliance, 'function');
assert.strictEqual(Sim.chooseStrangeWorldAlliance(entryGame, 'wushi', []), true);
assert.strictEqual(entryGame.strangeWorldAlliance, 'wushi');
assert.strictEqual(entryGame.awaitingStrangeWorldChoice, false);

assert.strictEqual(typeof Sim.finishStrangeWorldBattle, 'function');
const defeatedImmortal = Sim.createGame(0, ['w06', 'w11']);
Sim.becomeDi(defeatedImmortal, [], 'force');
defeatedImmortal.redDustImmortal = true;
defeatedImmortal.immortalMode = 'strange_world';
defeatedImmortal.undeadCult = 3000000;
defeatedImmortal.cult = 1;
try {
  Math.random = function () { return 0.999; };
  assert.strictEqual(Sim.finishStrangeWorldBattle(defeatedImmortal, [], false), false);
} finally {
  Math.random = oldRandom;
}
assert.strictEqual(defeatedImmortal.dead, true);
assert.strictEqual(defeatedImmortal.redDustImmortal, false, 'a slain contender must not retain immortal rewards');
assert.strictEqual(defeatedImmortal.immortalMode, null);

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const choice = html.slice(html.indexOf('id="immortalpath-mask"'), html.indexOf('</div>', html.indexOf('id="btn-immortalpath-wait"')) + 6);
assert.ok(choice.indexOf('不死天皇') < 0, 'entry choice must not reveal the hidden opponent');
assert.ok(choice.indexOf('三世天帝') < 0, 'entry choice must not reveal enemy lives');

const gameSource = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
const openChoiceStart = gameSource.indexOf('function openImmortalPathChoice()');
const openChoiceEnd = gameSource.indexOf('function resolveImmortalPath', openChoiceStart);
const openChoiceSource = gameSource.slice(openChoiceStart, openChoiceEnd);
assert.ok(openChoiceSource.indexOf('UNDEAD_EMPEROR') < 0);
assert.ok(openChoiceSource.indexOf('不死天皇') < 0);

assert.ok(DATA.IMMORTAL_ROAD_MIN_YEAR >= 3000000, 'the immortal road must wait nearly an epoch');
assert.strictEqual(typeof Sim.canOpenImmortalRoad, 'function');
assert.strictEqual(typeof Sim.immortalRoadChance, 'function');
const roadWait = Sim.createGame(0, []);
Sim.becomeDi(roadWait, [], 'force');
roadWait.waitingImmortalRoad = true;
roadWait.worldYear = 200000;
assert.strictEqual(Sim.canOpenImmortalRoad(roadWait), false,
  'an emperor life must not see the immortal road before an epoch has passed');
assert.strictEqual(Sim.immortalRoadAppearChance(roadWait), 0);
const earlyLog = [];
assert.strictEqual(Sim.tryImmortalRoad(roadWait, earlyLog), false);
assert.strictEqual(roadWait.redDustImmortal, false);
assert.strictEqual(roadWait.dead, false);
roadWait.worldYear = DATA.IMMORTAL_ROAD_MIN_YEAR;
assert.strictEqual(Sim.canOpenImmortalRoad(roadWait), true);
roadWait.cult = 2000000;
roadWait.daoyun = 900;
roadWait.daoyunCap = 1500;
assert.ok(Sim.immortalRoadChance(roadWait) < 0.08, 'crossing the immortal road must stay unlikely for an ordinary emperor');
roadWait.cult = 8000000;
roadWait.daoyun = 1500;
Sim.setPhysique(roadWait, DATA.physiqueById('chaos'));
assert.ok(Sim.immortalRoadChance(roadWait) <= 0.10, 'even a peak emperor must find the crossing extremely hard');
roadWait.forbiddenLord = true;
assert.ok(Math.abs(Sim.immortalRoadAppearChance(roadWait) - 0.10) < 1e-9,
  'a forbidden lord who has waited nearly an epoch still only rarely sees the road');
assert.ok(choice.indexOf('近一纪元') >= 0 || html.indexOf('数百万年') >= 0,
  'the wait option must tell the player the road takes nearly an epoch');

assert.ok(/id="gold-random-toggle"/.test(html));
assert.ok(/id="gold-free-toggle"/.test(html));
assert.ok(/id="force-xianti-toggle"/.test(html));
assert.ok(!/id="gold-random-toggle"[^>]*checked/.test(html), 'gold-random cheat must default off');
assert.ok(!/id="gold-free-toggle"[^>]*checked/.test(html), 'gold-free cheat must default off');
assert.ok(!/id="force-xianti-toggle"[^>]*checked/.test(html), 'force-chaos cheat must default off');
assert.ok(html.indexOf('强制混沌体 / 先天圣体道胎') >= 0, 'the peak-physique lock must name both bodies');
assert.ok(gameSource.indexOf("peakId = Math.random() < 0.5 ? 'chaos' : 'innate_sacred_dao'") >= 0,
  'the peak-physique lock must roll either Chaos or Innate Sacred Dao Fetus');
assert.ok(gameSource.indexOf('localStorage.setItem(KEY_GOLD_MODE') < 0, 'gold cheat mode must not persist across downloads or reloads');
assert.ok(gameSource.indexOf('localStorage.setItem(KEY_FORCE_XIANTI') < 0, 'force-chaos cheat must not persist across downloads or reloads');
assert.ok(gameSource.indexOf('localStorage.getItem(KEY_GOLD_MODE') < 0, 'gold cheat mode must not reload a saved on-state');
assert.ok(gameSource.indexOf('localStorage.getItem(KEY_FORCE_XIANTI') < 0, 'force-chaos cheat must not reload a saved on-state');

assert.strictEqual(typeof Sim.learnStrangeWorld, 'function');
const mortalClue = Sim.createGame(0, []);
assert.strictEqual(Sim.learnStrangeWorld(mortalClue, []), false);
assert.strictEqual(mortalClue.knowsStrangeWorld, false, 'pre-emperor lives must not learn Strange World coordinates');
const clueEvent = (Sim.EVENTS || []).filter(function (ev) { return ev.id === 'qiyishijie'; })[0];
assert.ok(clueEvent, 'the old pre-emperor strange-world event should still exist so it can be gated');
clueEvent.ok(mortalClue, Sim.U, []);
assert.strictEqual(mortalClue.knowsStrangeWorld, false, 'pre-emperor chance events must not write Strange World coordinates');
assert.strictEqual(mortalClue.xianSource, false);
assert.strictEqual(mortalClue.primordialStone, false);
const emperorClue = Sim.createGame(0, []);
Sim.becomeDi(emperorClue, [], 'force');
assert.strictEqual(Sim.learnStrangeWorld(emperorClue, []), true);
assert.strictEqual(emperorClue.knowsStrangeWorld, true);
assert.ok(gameSource.indexOf('becameEmperor && G.knowsStrangeWorld') >= 0,
  'settlement must not advertise Strange World coordinates before becoming emperor');

const eventsSource = fs.readFileSync(path.join(__dirname, '..', 'events.js'), 'utf8');
assert.ok(!/T3_HERB = \[[^\]]*太初命石/.test(eventsSource), 'primordial stone must not appear as a pre-emperor herb drop');

const experienceEvents = {};
(Sim.EVENTS || []).forEach(function (ev) { experienceEvents[ev.id] = ev; });
['xingkong_gulu', 'dilu_zhengfeng', 'quasi_heavenly_tribulation', 'forbidden_gaze'].forEach(function (id) {
  assert.ok(experienceEvents[id], 'missing pre-emperor experience event: ' + id);
  assert.strictEqual(typeof experienceEvents[id].available, 'function',
    'stage-specific events must declare when they can enter the event pool: ' + id);
});
[
  'dao_epiphany', 'dao_create_scripture', 'dao_create_nine_secret', 'dao_create_swallowing',
  'mythic_battlefield', 'chaos_thunder_pool', 'imperial_tomb_open', 'ancient_road_ambush',
  'forbidden_fragment', 'star_sea_auction', 'dao_companion_debate', 'heavenly_omen'
].forEach(function (id) {
  assert.ok(experienceEvents[id], 'missing new opportunity event: ' + id);
});

assert.strictEqual(typeof Sim.isHighDaoyun, 'function');
const insightBreak = Sim.createGame(0, []);
insightBreak.lvl = 20;
insightBreak.daoyun = 900;
insightBreak.daoyunCap = 1000;
const insightBreakLog = [];
Sim.levelUp(insightBreak, insightBreakLog);
assert.ok(insightBreakLog.some(function (line) { return /悟道/.test(line.text); }),
  'every breakthrough by a high-Dao cultivator must be narrated as enlightenment');

const selfCreator = Sim.createGame(0, []);
Sim.setPhysique(selfCreator, DATA.physiqueById('mortal'));
selfCreator.lvl = 71;
selfCreator.daoyun = 1200;
selfCreator.daoyunCap = 1500;
assert.strictEqual(Sim.eventAvailable(selfCreator, experienceEvents.dao_create_scripture), true);
assert.strictEqual(Sim.eventAvailable(selfCreator, experienceEvents.dao_create_swallowing), true);
experienceEvents.dao_create_nine_secret.ok(selfCreator, Sim.U, []);
assert.ok(selfCreator.createdNineSecrets >= 1,
  'a high-Dao cultivator must be able to create a Nine-Secrets-grade art');
experienceEvents.dao_create_swallowing.ok(selfCreator, Sim.U, []);
assert.strictEqual(selfCreator.swallowingArt, true,
  'only the explicit self-created swallowing route should enable its extra mortality');

const ordinaryInjury = Sim.createGame(0, []);
Sim.setPhysique(ordinaryInjury, DATA.physiqueById('mortal'));
ordinaryInjury.age = 99;
ordinaryInjury.lifeBase = 100;
ordinaryInjury.lifeBonus = 0;
ordinaryInjury.lifespan = 100;
try {
  Math.random = function () { return 0.99; };
  Sim.U.hurt(ordinaryInjury, 20, 20);
} finally {
  Math.random = oldRandom;
}
assert.ok(ordinaryInjury.lifespan > ordinaryInjury.age,
  'ordinary injuries must not make a non-swallowing mortal die more often merely because its lifespan is short');

const swallowingInjury = Sim.createGame(0, ['o03']);
Sim.setPhysique(swallowingInjury, DATA.physiqueById('mortal'));
swallowingInjury.age = 99;
swallowingInjury.lifeBase = 100;
swallowingInjury.lifeBonus = 0;
swallowingInjury.lifespan = 100;
try {
  Math.random = function () { return 0.99; };
  Sim.U.hurt(swallowingInjury, 20, 20);
} finally {
  Math.random = oldRandom;
}
assert.ok(swallowingInjury.lifespan <= swallowingInjury.age,
  'the swallowing route may retain extra lethal risk');

assert.strictEqual(typeof Sim.eventAvailable, 'function');
const eventBoundary = Sim.createGame(0, []);
eventBoundary.lvl = 70;
assert.strictEqual(Sim.eventAvailable(eventBoundary, experienceEvents.xingkong_gulu), false,
  'the ancient star road must not enter the pool before Saint');
assert.strictEqual(experienceEvents.xingkong_gulu.cond(eventBoundary, Sim.U), false);
eventBoundary.lvl = 71;
assert.strictEqual(Sim.eventAvailable(eventBoundary, experienceEvents.xingkong_gulu), true);
assert.strictEqual(experienceEvents.xingkong_gulu.cond(eventBoundary, Sim.U), true,
  'the ancient star road should open from Saint onward');
eventBoundary.lvl = 90;
assert.strictEqual(experienceEvents.quasi_heavenly_tribulation.cond(eventBoundary, Sim.U), false);
eventBoundary.lvl = 91;
assert.strictEqual(experienceEvents.quasi_heavenly_tribulation.cond(eventBoundary, Sim.U), true,
  'quasi-emperor tribulations must stay inside the quasi-emperor phase');
const daoBeforeTribulation = eventBoundary.daoyun;
try {
  Math.random = function () { return 0; };
  experienceEvents.quasi_heavenly_tribulation.ok(eventBoundary, Sim.U, []);
} finally {
  Math.random = oldRandom;
}
assert.ok(eventBoundary.daoyun > daoBeforeTribulation,
  'surviving a quasi-emperor tribulation should deepen Dao comprehension');

assert.strictEqual(typeof Sim.runEmperorExperience, 'function');
assert.strictEqual(typeof Sim.emperorBeatIds, 'function');
assert.strictEqual(typeof Sim.pickEmperorBeat, 'function');
assert.ok(Sim.emperorBeatIds().length >= 24,
  'the emperor life must have a large enough beat pool to survive nine lives without looping four sentences');
['lecture_beings', 'establish_heaven', 'star_voyage', 'predecessor_trace',
  'faith_incense', 'imperial_god', 'disciple_rise', 'time_scar', 'reverse_deduction'].forEach(function (id) {
  assert.ok(Sim.emperorBeatIds().indexOf(id) >= 0, 'missing emperor beat: ' + id);
});
const emperorExperience = Sim.createGame(0, []);
Sim.becomeDi(emperorExperience, [], 'force');
const originalRoots = Object.assign({}, emperorExperience.redDustRoots);
assert.strictEqual(Sim.runEmperorExperience(emperorExperience, 'world_order', []), true);
assert.ok(emperorExperience.redDustRoots.dao > originalRoots.dao,
  'reordering the cosmos should strengthen the emperor Dao root');
assert.strictEqual(Sim.runEmperorExperience(emperorExperience, 'mortal_farewell', []), true);
assert.ok(emperorExperience.redDustRoots.soul > originalRoots.soul,
  'outliving old companions should strengthen the emperor soul root');
assert.strictEqual(Sim.runEmperorExperience(emperorExperience, 'suppress_forbidden', []), true);
assert.ok(emperorExperience.emperorLegacy.forbiddenSuppressed >= 1,
  'suppressing forbidden zones should persist as an emperor legacy');

const nextLifeMethod = Sim.createGame(0, ['o08']);
Sim.becomeDi(nextLifeMethod, [], 'force');
nextLifeMethod.redDustPath = 'reverse';
nextLifeMethod.lifeNo = 2;
nextLifeMethod.daoyun = 900;
nextLifeMethod.daoyunCap = 1680;
const methodDaoBefore = nextLifeMethod.daoyun;
assert.strictEqual(Sim.reverseMethodReady(nextLifeMethod), false);
assert.strictEqual(Sim.runEmperorExperience(nextLifeMethod, 'reverse_deduction', []), true);
assert.strictEqual(nextLifeMethod.reverseMethodReadyFor, 3,
  'a life-specific opportunity must reveal how to reverse into the next life');
assert.ok(nextLifeMethod.daoyun > methodDaoBefore,
  'learning the new longevity method must also provide a major Dao opportunity');
assert.strictEqual(Sim.reverseMethodReady(nextLifeMethod), true);
assert.strictEqual(Sim.runEmperorExperience(emperorExperience, 'late_ambush', []), true);
assert.ok(emperorExperience.emperorLegacy.lateAmbushes >= 1,
  'late-life assaults should be recorded instead of becoming generic flavor text');
assert.strictEqual(Sim.runEmperorExperience(emperorExperience, 'lecture_beings', []), true);
assert.strictEqual(Sim.runEmperorExperience(emperorExperience, 'star_voyage', []), true);

let seekSource = 0, seekStone = 0, seekStoneOnly = 0, seekBoth = 0;
const seekN = 240;
for (let i = 0; i < seekN; i++) {
  const seekGame = Sim.createGame(0, []);
  Sim.becomeDi(seekGame, [], 'force');
  Sim.runEmperorExperience(seekGame, 'seek_longevity', []);
  if (seekGame.xianSource) seekSource++;
  if (seekGame.primordialStone) seekStone++;
  if (seekGame.primordialStone && !seekGame.xianSource) seekStoneOnly++;
  if (seekGame.xianSource && seekGame.primordialStone) seekBoth++;
}
assert.ok(seekSource / seekN >= 0.45, 'an emperor seeking longevity should often find immortal source');
assert.ok(seekStone / seekN >= 0.40, 'an emperor seeking longevity should often find a primordial stone');
assert.ok(seekStoneOnly > 0, 'primordial stone must not wait behind immortal source');
assert.ok(seekBoth > 0, 'a single search may yield both sealing materials');

assert.strictEqual(typeof Sim.strangeWorldLearnChance, 'function');
const rumorEmperor = Sim.createGame(0, []);
Sim.becomeDi(rumorEmperor, [], 'force');
const rumorEarly = Sim.strangeWorldLearnChance(rumorEmperor);
rumorEmperor.age = rumorEmperor.emperorLifeEnd - 50;
const rumorLate = Sim.strangeWorldLearnChance(rumorEmperor);
assert.ok(rumorEarly >= 0.028 && rumorEarly <= 0.05,
  'an ordinary emperor year must not treat Strange World as common knowledge');
assert.ok(rumorLate > rumorEarly, 'late in an emperor life the rumor should be easier to confirm');
assert.ok(rumorLate <= 0.08, 'even a late emperor year must not make the coordinates nearly guaranteed');
const rumorLord = Sim.createGame(0, []);
Sim.becomeDi(rumorLord, [], 'force');
rumorLord.forbiddenLord = true;
rumorLord.worldYear = 0;
const rumorLordYoung = Sim.strangeWorldLearnChance(rumorLord);
rumorLord.worldYear = 1800000;
const rumorLordOld = Sim.strangeWorldLearnChance(rumorLord);
assert.ok(rumorLordYoung >= 0.25, 'a newly sealed forbidden lord already has more time than a mortal emperor year');
assert.ok(rumorLordOld > rumorLordYoung + 0.25,
  'a forbidden lord who has slept across eras must be much likelier to learn the coordinates');
assert.ok(rumorLordOld <= 0.92, 'even an ancient forbidden lord should not automatically know the far shore');
let rumorHits = 0;
const rumorN = 80;
for (let i = 0; i < rumorN; i++) {
  const life = Sim.createGame(0, []);
  Sim.becomeDi(life, [], 'force');
  life.redDustRoots = { body: 0, soul: 0, dao: 0 };
  for (let n = 0; n < 24 && !life.knowsStrangeWorld; n++) {
    life.age = life.emperorLifeStart + Math.floor((life.emperorLifeEnd - life.emperorLifeStart) * n / 24);
    Sim.emperorEvent(life, []);
  }
  if (life.knowsStrangeWorld) rumorHits++;
}
assert.ok(rumorHits / rumorN >= 0.48 && rumorHits / rumorN <= 0.82,
  'one emperor life should often, but not almost always, confirm Strange World coordinates');

const varietyLog = [];
const varietyGame = Sim.createGame(0, []);
Sim.becomeDi(varietyGame, [], 'force');
const forcedIds = Sim.emperorBeatIds().slice(0, 16);
forcedIds.forEach(function (id) { Sim.runEmperorExperience(varietyGame, id, varietyLog); });
const uniqueLines = {};
varietyLog.forEach(function (row) {
  const stem = String(row.text || '').replace(/^帝历\d+年，/, '').replace(/\d+/g, '#');
  uniqueLines[stem] = true;
});
assert.ok(Object.keys(uniqueLines).length >= 12,
  'sixteen emperor beats must not collapse into a handful of repeated sentences');

const pickGame = Sim.createGame(0, []);
Sim.becomeDi(pickGame, [], 'force');
pickGame.emperorLegacy.lastBeat = 'world_order';
const nextBeat = Sim.pickEmperorBeat(pickGame);
assert.ok(nextBeat && nextBeat !== 'world_order',
  'the next emperor beat should not immediately repeat the last one');

function sawBeat(g, id, rolls) {
  for (let i = 0; i < rolls; i++) {
    if (Sim.pickEmperorBeat(g) === id) return true;
  }
  return false;
}

const onceHeaven = Sim.createGame(0, []);
Sim.becomeDi(onceHeaven, [], 'force');
assert.strictEqual(Sim.runEmperorExperience(onceHeaven, 'establish_heaven', []), true);
assert.strictEqual(Sim.runEmperorExperience(onceHeaven, 'imperial_god', []), true);
onceHeaven.emperorLegacy.usedThisLife = {};
onceHeaven.emperorLegacy.lastBeat = null;
onceHeaven.lifeNo = 2;
assert.strictEqual(sawBeat(onceHeaven, 'establish_heaven', 80), false,
  'founding the heavenly court is a once-in-an-era event');
assert.strictEqual(sawBeat(onceHeaven, 'imperial_god', 80), false,
  'an imperial weapon-god can only awaken once');
assert.ok(sawBeat(onceHeaven, 'body_refine', 80),
  'daily emperor cultivation must remain available after unique beats are spent');

const secretCap = Sim.createGame(0, []);
Sim.becomeDi(secretCap, [], 'force');
for (let i = 0; i < 3; i++) Sim.runEmperorExperience(secretCap, 'nine_secret', []);
assert.strictEqual(sawBeat(secretCap, 'nine_secret', 80), false,
  'nine-secret fragments must dry up after a few insights');

const perLifeMethod = Sim.createGame(0, []);
Sim.becomeDi(perLifeMethod, [], 'force');
perLifeMethod.lifeNo = 3;
assert.strictEqual(Sim.runEmperorExperience(perLifeMethod, 'self_method', []), true);
assert.strictEqual(sawBeat(perLifeMethod, 'self_method', 80), false,
  'a life should not invent the same longevity method twice');
perLifeMethod.emperorLegacy.usedThisLife = {};
perLifeMethod.emperorLegacy.lastBeat = null;
perLifeMethod.lifeNo = 4;
assert.ok(sawBeat(perLifeMethod, 'self_method', 500),
  'each later life may still open a different longevity method');

console.log('late-game: ok');
