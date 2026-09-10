const assert = require('assert');
const fs = require('fs');
const path = require('path');
const DATA = require('../data.js');

function count(items, predicate) {
  return items.filter(predicate).length;
}

assert.ok(DATA.TRAIT_PATHS, 'TRAIT_PATHS should be exported');

const paths = Object.keys(DATA.TRAIT_PATHS).sort();
const legacyTypes = ['cult', 'brk', 'cgt'];
assert.deepStrictEqual(paths, ['body', 'dao', 'fortune', 'imperial', 'tianxin']);
assert.strictEqual(DATA.TRAITS.length, 100, 'trait pool should contain 100 cards');

['w', 'b', 'p', 'o'].forEach(function (color) {
  assert.strictEqual(count(DATA.TRAITS, function (trait) {
    return trait.color === color;
  }), 25, color + ' should contain 25 cards');

  paths.forEach(function (traitPath) {
    assert.strictEqual(count(DATA.TRAITS, function (trait) {
      return trait.color === color && trait.path === traitPath;
    }), 5, color + '/' + traitPath + ' should contain five cards');
  });
});

DATA.TRAITS.forEach(function (trait) {
  assert.ok(DATA.TRAIT_PATHS[trait.path], trait.id + ' should have a valid path');
  trait.fx.forEach(function (effect) {
    assert.strictEqual(legacyTypes.indexOf(effect[0]), -1, trait.id + ' contains legacy effect ' + effect[0]);
  });
  assert.ok(!/修行速度|修炼速度|实力成长|初始实力/.test(DATA.traitDesc(trait)), trait.id + ' exposes legacy copy');
});

function impactScore(trait) {
  var grantsRetry = trait.fx.some(function (effect) { return effect[0] === 'retry'; });
  return trait.fx.reduce(function (score, effect) {
    var type = effect[0], value = effect[1], impact = 0;
    if (type === 'life') impact = value / 6;
    else if (type === 'floor') impact = value - 1;
    else if (type === 'dao') impact = value / 5;
    else if (type === 'daog') impact = (value - 1) / 0.08;
    else if (type === 'daocap') impact = value / 40;
    else if (type === 'evf') impact = (value - 1) / 0.08;
    else if (type === 'evt') impact = (value - 1) / 0.20;
    else if (type === 'ward') impact = value / 2;
    else if (type === 'era') impact = (value - 1) / 0.30;
    else if (type === 'xin') impact = (value - 1) / 0.05;
    else if (type === 'xinPity') impact = value / 0.000005;
    else if (type === 'dlm') impact = value / 2;
    else if (type === 'zhx') impact = value / 0.004;
    else if (type === 'retryKeep') impact = grantsRetry ? value / 0.06 : 0;
    else if (type === 'bodyChance') impact = value / 0.03;
    else if (type === 'bodyDao') impact = value / 8;
    else if (type === 'overflow') impact = value / 0.12;
    else if (type === 'upgradeEvent') impact = 1.5;
    else if (type === 'ignoreSuppression') impact = value / 0.08;
    else if (type === 'retry' || type === 'swallow') impact = 3;
    return score + impact;
  }, 0);
}

var minimumImpact = { w: 1, b: 1.8, p: 3.5, o: 6 };
DATA.TRAITS.forEach(function (trait) {
  assert.ok(impactScore(trait) + 1e-9 >= minimumImpact[trait.color],
    trait.id + ' is below its rarity effectiveness floor: ' + impactScore(trait).toFixed(2));
});

const percentageMinimums = {
  xin: { w: 1.10, b: 1.25, p: 1.50, o: 1.80 },
  xinPity: { w: 0.000004, b: 0.000008, p: 0.000018, o: 0.00005 },
  dlm: { w: 5, b: 10, p: 20, o: 30 },
  zhx: { w: 0.01, b: 0.02, p: 0.04, o: 0.06 },
  daog: { w: 1.08, b: 1.18, p: 1.30, o: 1.50 },
  evf: { w: 1.08, b: 1.10, p: 1.20, o: 1.40 },
  evt: { w: 1.15, b: 1.30, p: 1.80, o: 2.20 },
  era: { w: 1.15, b: 1.50, p: 2.20, o: 3 },
  ward: { w: 1, b: 3, p: 6, o: 12 },
  bodyChance: { w: 0.08, b: 0.12, p: 0.25, o: 0.40 },
  overflow: { w: 0.15, b: 0.25, p: 0.40, o: 0.60 },
  retryKeep: { w: 0.15, b: 0.25, p: 0.40, o: 0.50 },
  ignoreSuppression: { w: 0, b: 0.08, p: 0.20, o: 0.50 }
};
DATA.TRAITS.forEach(function (trait) {
  trait.fx.forEach(function (effect) {
    const floor = percentageMinimums[effect[0]];
    if (!floor) return;
    assert.ok(effect[1] + 1e-12 >= floor[trait.color],
      trait.id + '/' + effect[0] + ' is below the perceptible ' + trait.color + ' floor');
  });
});
Object.keys(percentageMinimums).forEach(function (effectType) {
  const ranges = {};
  ['w', 'b', 'p', 'o'].forEach(function (color) {
    ranges[color] = DATA.TRAITS.filter(function (trait) { return trait.color === color; })
      .flatMap(function (trait) { return trait.fx; })
      .filter(function (effect) { return effect[0] === effectType; })
      .map(function (effect) { return effect[1]; });
  });
  [['w', 'b'], ['b', 'p'], ['p', 'o']].forEach(function (pair) {
    if (!ranges[pair[0]].length || !ranges[pair[1]].length) return;
    assert.ok(Math.min.apply(null, ranges[pair[1]]) > Math.max.apply(null, ranges[pair[0]]),
      effectType + ' must strictly improve from ' + pair[0] + ' to ' + pair[1]);
  });
});

const SIM = require('../sim.js');
const initialRandom = Math.random;
try {
  Math.random = function () { return 0; };
  const floorAndDao = SIM.createGame(0, ['o01', 'o07']);
  assert.strictEqual(floorAndDao.innate, 7);
  assert.strictEqual(floorAndDao.daoyun, 55, 'floor base and initial Dao bonus should both apply');
  assert.strictEqual(floorAndDao.daoyunCap, 1220, 'floor base and Dao cap bonus should both apply');
} finally {
  Math.random = initialRandom;
}

const samePath = SIM.createGame(0, ['w01', 'b01']);
assert.strictEqual(samePath.resonance, 'body', 'matching paths should resonate');
const mixedPath = SIM.createGame(0, ['w01', 'w06']);
assert.strictEqual(mixedPath.resonance, null, 'mixed paths should not resonate');
assert.ok(!Object.prototype.hasOwnProperty.call(samePath.tm, 'brk'), 'traits should not carry cultivation speed');
assert.ok(!Object.prototype.hasOwnProperty.call(samePath.tm, 'cgt'), 'traits should not carry combat growth');

assert.strictEqual(typeof SIM.tryBodyEvolution, 'function', 'body evolution helper should be exported');
const bodyGame = SIM.createGame(0, ['w01', 'b01']);
SIM.setPhysique(bodyGame, DATA.physiquesAtTier(2)[0]);
bodyGame.lvl = 71;
bodyGame.daoyun = bodyGame.daoyunCap;
const savedRandom = Math.random;
try {
  Math.random = function () { return 0; };
  assert.strictEqual(SIM.tryBodyEvolution(bodyGame, []), true, 'body resonance should evolve once');
  assert.strictEqual(bodyGame.innate, 3);
  assert.strictEqual(SIM.tryBodyEvolution(bodyGame, []), false, 'body evolution should not repeat');
} finally {
  Math.random = savedRandom;
}

assert.strictEqual(typeof SIM.eventDaoyunTier, 'function', 'fortune reward helper should be exported');
const fortuneGame = SIM.createGame(0, ['w11', 'b11']);
assert.strictEqual(SIM.eventDaoyunTier(fortuneGame, 1), 2, 'fortune resonance should upgrade first low event');
assert.strictEqual(SIM.eventDaoyunTier(fortuneGame, 1), 1, 'fortune resonance should only upgrade once');

assert.strictEqual(typeof SIM.gainDaoyun, 'function', 'daoyun helper should be exported');
const daoGame = SIM.createGame(0, ['w06', 'b06']);
daoGame.daoyun = daoGame.daoyunCap - 1;
SIM.gainDaoyun(daoGame, 100);
assert.ok(daoGame.resonanceState.overflowDao > 0, 'dao resonance should retain overflow');

assert.strictEqual(typeof SIM.tianxinChance, 'function', 'Tianxin chance helper should be exported');
assert.strictEqual(typeof SIM.tianxinPityGain, 'function', 'Tianxin multiplier should also accelerate pity');
const tianxinGame = SIM.createGame(0, ['w16', 'b16']);
tianxinGame.lvl = 91;
const firstTianxinChance = SIM.tianxinChance(tianxinGame);
tianxinGame.resonanceState.tianxinPity += tianxinGame.tm.xinPity;
assert.ok(SIM.tianxinChance(tianxinGame) > firstTianxinChance, 'Tianxin pity should increase its chance');
const multiplierOnlyTianxin = SIM.createGame(0, ['o20']);
assert.ok(SIM.tianxinPityGain(multiplierOnlyTianxin) >= 0.000016,
  'a gold Tianxin multiplier must create a perceptible cumulative guarantee');
const doubleGoldTianxin = SIM.createGame(0, ['o16', 'o17']);
doubleGoldTianxin.lvl = 91;
doubleGoldTianxin.worldEmperor = null;
doubleGoldTianxin.nextWorldEmperorYear = 999999;
const pityBeforeRoll = doubleGoldTianxin.resonanceState.tianxinPity;
try {
  Math.random = function () { return 1; };
  SIM.rollYear(doubleGoldTianxin);
} finally {
  Math.random = savedRandom;
}
assert.ok(doubleGoldTianxin.resonanceState.tianxinPity > pityBeforeRoll,
  'rollYear should apply the cumulative Tianxin guarantee after a failed perception');

const imperialGame = SIM.createGame(0, ['w21', 'b21']);
assert.strictEqual(imperialGame.resonance, 'imperial');
assert.strictEqual(imperialGame.tm.retry, 1, 'imperial resonance should grant one retry');
assert.strictEqual(typeof SIM.spendImperialRetry, 'function');
const doubleGoldRetry = SIM.createGame(0, ['o21', 'o22']);
doubleGoldRetry.cult = 1000;
doubleGoldRetry.daoyun = 100;
doubleGoldRetry.age = 100;
doubleGoldRetry.lifeBase = 1000;
doubleGoldRetry.lifespan = 1000;
const retryLog = [];
assert.strictEqual(SIM.spendImperialRetry(doubleGoldRetry, retryLog), true);
assert.strictEqual(doubleGoldRetry.cult, 1000, 'two gold survival cards should fully prevent combat-power loss');
assert.strictEqual(doubleGoldRetry.daoyun, 90, 'retry still costs Dao and lifespan, so it is not a free emperor guarantee');
assert.ok(retryLog[0].text.indexOf('实力受损') < 0, 'full retry retention must not claim combat-power loss');

const gameSource = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
assert.ok(gameSource.indexOf('TRAIT_PATHS') >= 0, 'game UI should render trait path metadata');
assert.ok(gameSource.indexOf('trait.path') >= 0, 'game UI should inspect each trait path');
assert.ok(gameSource.indexOf('resonance') >= 0, 'game UI should preview resonance');

console.log('trait-system: ok');
