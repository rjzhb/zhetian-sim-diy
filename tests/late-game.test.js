const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Sim = require('../sim.js');
const DATA = require('../data.js');
const oldRandom = Math.random;

assert.strictEqual(DATA.DAO_ABSOLUTE_MAX, 3000);
assert.strictEqual(Sim.baseDaoyunCap(1), 500);
assert.strictEqual(Sim.baseDaoyunCap(10), 1500);

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

assert.strictEqual(typeof Sim.reversePathChance, 'function');
function chaosAfterFirstEmperorLife(traitIds) {
  const g = Sim.createGame(0, traitIds);
  Sim.setPhysique(g, DATA.physiqueById('chaos'));
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
assert.strictEqual(Sim.reverseLifeChance(reverseFixture(1500, 1500, 2)), 1,
  'absolute and personal Dao fullness should guarantee reversal');
assert.ok(Sim.reverseLifeChance(reverseFixture(900, 1500, 3)) >
  Sim.reverseLifeChance(reverseFixture(900, 1500, 2)), 'later mastered techniques should be easier than the third-life bottleneck');
const secondLifeByForce = reverseFixture(800, 1500, 1);
secondLifeByForce.deathless = false;
secondLifeByForce.deathlessUsed = false;
assert.ok(Sim.reverseLifeChance(secondLifeByForce) <= 0.35,
  'without immortal medicine, brute-forcing the second life must remain unlikely');
secondLifeByForce.deathless = true;
assert.strictEqual(Sim.reverseLifeChance(secondLifeByForce), 1,
  'an unused immortal medicine should still guarantee the second life');

assert.strictEqual(typeof Sim.tryReverseLife, 'function');
function longChaosFirstLife(traitIds) {
  const g = Sim.createGame(0, traitIds);
  Sim.setPhysique(g, DATA.physiqueById('chaos'));
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

const reverseGame = reverseFixture(1500, 1500, 2);
reverseGame.redDustPath = 'reverse';
const reverseDaoBefore = reverseGame.daoyun;
const reverseCapBefore = reverseGame.daoyunCap;
assert.strictEqual(Sim.tryReverseLife(reverseGame, []), true);
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
assert.ok(Sim.strangeWorldAmbushChance(weakAmbush) <= 0.03,
  'an unsupported challenger below half the emperor strength should almost certainly die');
weakAmbush.cult = 1800000;
assert.ok(Sim.strangeWorldAmbushChance(weakAmbush) <= 0.18,
  'even a near-peer below the emperor strength should have low survival odds');
weakAmbush.cult = 2000000;
assert.ok(Sim.strangeWorldAmbushChance(weakAmbush) >= 0.35,
  'matching the emperor strength should restore a meaningful survival chance');

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

const sacredBlocked = Sim.createGame(0, []);
Sim.setPhysique(sacredBlocked, DATA.physiqueById('sacred'));
sacredBlocked.lvl = 99;
sacredBlocked.cult = 400000;
sacredBlocked.daoyun = Sim.effectiveDaoyunNeed(sacredBlocked, 99);
sacredBlocked.worldEmperor = null;
try {
  Math.random = function () { return 0; };
  Sim.tryZhengdao(sacredBlocked, []);
} finally {
  Math.random = oldRandom;
}
assert.strictEqual(sacredBlocked.becameEmperor, false, 'a sacred body below the overwhelm line cannot become emperor');
assert.strictEqual(sacredBlocked.dead, false, 'a sacred body should keep tempering instead of dying at a normal emperor gate');

const sacredHeavenly = Sim.createGame(0, []);
Sim.setPhysique(sacredHeavenly, DATA.physiqueById('sacred'));
sacredHeavenly.lvl = 99;
sacredHeavenly.cult = DATA.OVERWHELM_DAO_CULT;
sacredHeavenly.daoyun = Sim.effectiveDaoyunNeed(sacredHeavenly, 99);
sacredHeavenly.worldEmperor = null;
try {
  Math.random = function () { return 0; };
  Sim.tryZhengdao(sacredHeavenly, []);
} finally {
  Math.random = oldRandom;
}
assert.ok(sacredHeavenly.becameEmperor, 'a sacred body that can overwhelm the myriad daos may become emperor');
assert.ok(sacredHeavenly.cult >= DATA.HEAVENLY_EMPEROR_CULT, 'a sacred-body emperor must start at heavenly-emperor power');

const suppressedGame = Sim.createGame(0, []);
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
  'faith_incense', 'imperial_god', 'disciple_rise', 'time_scar'].forEach(function (id) {
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
assert.ok(sawBeat(perLifeMethod, 'self_method', 80),
  'each later life may still open a different longevity method');

console.log('late-game: ok');
