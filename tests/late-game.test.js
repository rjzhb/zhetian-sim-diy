const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Sim = require('../sim.js');
const DATA = require('../data.js');
const oldRandom = Math.random;

assert.strictEqual(DATA.DAO_ABSOLUTE_MAX, 3000);
assert.strictEqual(Sim.baseDaoyunCap(1), 500);
assert.strictEqual(Sim.baseDaoyunCap(10), 1500);

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
assert.strictEqual(Sim.reverseLifeChance(reverseFixture(1500, 1500, 2)), 1, 'absolute and personal Dao fullness should guarantee reversal');
assert.ok(Sim.reverseLifeChance(reverseFixture(900, 1500, 3)) >
  Sim.reverseLifeChance(reverseFixture(900, 1500, 2)), 'later mastered techniques should be easier than the third-life bottleneck');

assert.strictEqual(typeof Sim.tryReverseLife, 'function');
const reverseGame = reverseFixture(1500, 1500, 2);
reverseGame.redDustPath = 'reverse';
const reverseDaoBefore = reverseGame.daoyun;
const reverseCapBefore = reverseGame.daoyunCap;
assert.strictEqual(Sim.tryReverseLife(reverseGame, []), true);
assert.ok(reverseGame.daoyunCap > reverseCapBefore, 'successful reversal should raise Dao cap');
assert.strictEqual(reverseGame.daoyun, reverseDaoBefore, 'successful reversal must not refill Dao');
assert.strictEqual(reverseGame.redDustRoutes.length, 1);

assert.strictEqual(typeof Sim.quasiLayerMultiplier, 'function');
assert.strictEqual(Sim.quasiLayerMultiplier({ physiqueId: 'mortal' }, 91), 1);
assert.strictEqual(Sim.quasiLayerMultiplier({ physiqueId: 'mortal' }, 98), 7);
assert.strictEqual(Sim.quasiLayerMultiplier({ physiqueId: 'chaos' }, 98), 2.8);
assert.strictEqual(Sim.quasiLayerMultiplier({ physiqueId: 'mortal' }, 90), 1);

assert.strictEqual(typeof Sim.daoyunNeed, 'function');
assert.strictEqual(Sim.daoyunNeed(91), 110);
assert.strictEqual(Sim.daoyunNeed(94), 125);
assert.strictEqual(Sim.daoyunNeed(98), 145);

assert.strictEqual(typeof Sim.forbiddenSleepRange, 'function');
assert.deepStrictEqual(Sim.forbiddenSleepRange({ sealingMaterial: '太初命石' }), [80000, 220000]);
assert.deepStrictEqual(Sim.forbiddenSleepRange({ sealingMaterial: '仙源' }), [150000, 400000]);
assert.deepStrictEqual(Sim.forbiddenSleepRange({ sealingMaterial: '仙源与太初命石' }), [250000, 600000]);

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
const calendarGame = Sim.createGame(0, []);
calendarGame.worldYear = 0;
calendarGame.worldEmperor = null;
calendarGame.playerEmperorActive = false;
calendarGame.nextWorldEmperorYear = 10;
try {
  Math.random = function () { return 0.5; };
  Sim.advanceWorldCalendar(calendarGame, 10, []);
} finally {
  Math.random = oldRandom;
}
assert.ok(calendarGame.worldEmperor, 'an independent emperor should arise on the world calendar');
assert.strictEqual(calendarGame.daoSuppressed, true);

const suppressedGame = Sim.createGame(0, []);
suppressedGame.lvl = 99;
suppressedGame.cult = DATA.OVERWHELM_DAO_CULT - 1;
suppressedGame.gotDiBing = true;
suppressedGame.deathless = true;
suppressedGame.resonanceState.overflowDao = 200;
suppressedGame.worldEmperor = { name: '测试大帝', start: 0, end: 10000, cult: 1500000 };
Sim.tryZhengdao(suppressedGame, []);
assert.strictEqual(suppressedGame.deadCause, 'world_emperor_suppression');

const overwhelmGame = Sim.createGame(0, []);
overwhelmGame.lvl = 99;
overwhelmGame.cult = 1500000;
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

console.log('late-game: ok');
