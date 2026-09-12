/* 事件库结构与平衡红线测试 */
var assert = require('assert');
var Sim = require('../sim.js');
var E = require('../events.js');
var D = require('../data.js');
var POOLS = require('../events-pools.js');

/* ---------- 规模与唯一性 ---------- */
assert.ok(E.length >= 220 - 49, '成帝前事件数不足：' + E.length);

var ids = {};
E.forEach(function (e) {
  assert.ok(e.id, '事件缺少 id');
  assert.ok(!ids[e.id], '事件 id 重复：' + e.id);
  ids[e.id] = e;
});

var totalWithEmperor = E.length + Sim.emperorBeatIds().length;
assert.ok(totalWithEmperor >= 220,
  '事件总数（成帝前 + 帝者片段）应达到 220，实际 ' + totalWithEmperor);

/* ---------- 字段合法性 ---------- */
E.forEach(function (e) {
  assert.ok([1, 2, 3, 4].indexOf(e.tier) >= 0, e.id + ' tier 非法：' + e.tier);
  assert.ok(typeof e.name === 'string' && e.name, e.id + ' 缺少 name');
  /* 纯抉择事件由 choice + resolve 承担结算，可以没有 ok */
  assert.ok(typeof e.ok === 'function' || (typeof e.choice === 'function' && typeof e.resolve === 'function'),
    e.id + ' 既没有 ok，也不是完整的 choice + resolve 事件');
  assert.ok(e.weight == null || e.weight > 0, e.id + ' weight 非法');
  assert.ok(e.maxCount == null || e.maxCount > 0, e.id + ' maxCount 非法');
  if (e.minAge != null && e.maxAge != null) {
    assert.ok(e.minAge <= e.maxAge, e.id + ' minAge > maxAge');
  }
  ['available', 'cond', 'fail', 'choice', 'resolve'].forEach(function (k) {
    assert.ok(e[k] == null || typeof e[k] === 'function', e.id + '.' + k + ' 必须是函数');
  });
  if (e.choice) assert.ok(typeof e.resolve === 'function', e.id + ' 有 choice 却没有 resolve');
});

/* ---------- 纪元口径：乱古是《完美世界》的纪元，不能当出生时代 ---------- */
assert.ok(POOLS.AGES.indexOf('乱古纪元') < 0 && POOLS.AGES.indexOf('乱古时代') < 0,
  'AGES 不应包含乱古（那是《完美世界》的纪元）');
assert.ok(POOLS.AGES.indexOf('上古时代') < 0, 'AGES 不应包含上古（原著记载的是中古）');
['神话时代', '太古时代', '中古时代', '荒古时代', '后荒古时代'].forEach(function (a) {
  assert.ok(POOLS.AGES.indexOf(a) >= 0, 'AGES 缺少 ' + a);
});
for (var ep = 0; ep < 200; ep++) {
  var pair = POOLS.eraPair();
  assert.notStrictEqual(pair.from, pair.to, 'eraPair 不应返回同一个纪元');
  assert.ok(POOLS.AGES.indexOf(pair.from) < POOLS.AGES.indexOf(pair.to),
    'eraPair 必须按纪元先后返回：' + pair.from + ' → ' + pair.to);
}

/* ---------- 选择型事件：恰好一个退避项，且 resolve 覆盖所有 optionId ---------- */
function probeGame(opt) {
  opt = opt || {};
  var g = Sim.createGame(60, [], { tier: opt.gift || 8 });
  var list = D.PHYSIQUES || [];
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === (opt.phys || 'mortal')) { Sim.setPhysique(g, list[i]); break; }
  }
  g.lvl = opt.lvl || 60;
  g.age = opt.age || 300;
  g.daoyun = opt.daoyun != null ? opt.daoyun : 900;
  /* 高境界事件普遍还卡战力门槛，让 cult 跟着境界走，否则探不到它们 */
  g.cult = opt.cult != null ? opt.cult : Math.round(Math.pow(g.lvl, 3.1));
  /* 创法类事件要求机缘余温（近期撞过高阶机缘）。探测态默认给满，
   * 否则九个创法事件在矩阵里全部不可达，「事件永远触发不到」这条就查不出真问题。
   * 余温本身的稀有性由 tmp 平衡脚本按实跑频次验证，不归这里管。 */
  g.fortuneHeat = opt.heat != null ? opt.heat : 12;
  return g;
}

/* 探测状态矩阵。事件的 available 会卡体质、境界、自创法、宿敌链、吞噬流、
 * 星空古路分段等等，矩阵必须把这些维度都铺到，否则「事件永远不可用」查不出来。 */
var PROBES = [];
[['mortal', 3], ['mortal', 8], ['mortal', 10], ['chaos', 10], ['sacred', 5],
  ['innate_sacred_dao', 8], ['star', 6], ['solar', 7], ['lunar', 7]].forEach(function (c) {
  [10, 15, 25, 35, 45, 55, 70, 75, 88, 97].forEach(function (lvl) {
    [0, 1, 3].forEach(function (arts) {
      PROBES.push({ phys: c[0], gift: c[1], lvl: lvl, arts: arts });
      PROBES.push({ phys: c[0], gift: c[1], lvl: lvl, arts: arts, swallow: true });
      PROBES.push({ phys: c[0], gift: c[1], lvl: lvl, arts: arts, worldEmperor: true });
      /* 星空古路分段既要探到「还能再推一段」也要探到「已在尽头」 */
      [1, 3].forEach(function (road) {
        PROBES.push({ phys: c[0], gift: c[1], lvl: lvl, arts: arts, chain: true, road: road });
      });
    });
  });
});
/* 宿敌链中段事件按恩怨值分档触发，逐档铺开 */
[1, 2, 3, 4, 5].forEach(function (grudge) {
  ['treasure', 'protect', 'clan', 'dao'].forEach(function (cause) {
    PROBES.push({ phys: 'mortal', gift: 8, lvl: 60, arts: 1, chain: true, grudge: grudge, cause: cause });
  });
});
/* 后天体质各有专属事件，把体质表整个扫一遍 */
(D.PHYSIQUES || []).forEach(function (p) {
  [10, 45, 88].forEach(function (lvl) {
    PROBES.push({ phys: p.id, gift: 8, lvl: lvl, arts: 1, chain: true });
  });
});
/* 招婿后续只在婚约旗标下出现 */
[30, 50, 78].forEach(function (lvl) {
  PROBES.push({ phys: 'mortal', gift: 8, lvl: lvl, arts: 1, married: '摇光圣地' });
  PROBES.push({ phys: 'mortal', gift: 8, lvl: lvl, arts: 1, refusedMarriage: true });
});
/* 斩道/入圣失败后的余生只在门口旗标下出现 */
PROBES.push({ phys: 'mortal', gift: 5, lvl: 60, arts: 1, cutFailed: true });
PROBES.push({ phys: 'mortal', gift: 5, lvl: 70, arts: 1, saintFailed: true });

function makeProbe(p) {
  var g = probeGame(p);
  g.innate = p.phys === 'mortal' ? 2 : 9;
  g.aptitude = g.innate;
  g.daoGift = p.gift;
  for (var i = 0; i < (p.arts || 0); i++) Sim.addCreatedArt(g, i % 2 ? 'guard' : 'scripture');
  if (p.swallow) {
    g.swallowingArt = true;
    /* 吞噬流事件按「已吞下几具体质」分档，直接把前两个目标标记为已取 */
    var targets = Sim.swallowTargets();
    Sim.swallowProgress(g);
    g.swallowState = g.swallowState || { taken: {} };
    for (var s = 0; s < Math.min(2, targets.length); s++) g.swallowState.taken[targets[s].id] = true;
  }
  if (p.worldEmperor) {
    /* 「有帝之世」的事件要求天地间确有当世大帝 */
    g.worldEmperorSeq = 1;
    g.worldEmperor = { name: '当世第1位大帝', start: 0, end: 900000, cult: 1800000 };
  }
  if (p.chain) {
    /* 链式事件的收尾环节要求前置状态已经攒够，这里直接把链推到末端 */
    g.nemesis = {
      name: '摇光圣地的圣子', title: '圣子', sect: '摇光圣地',
      cause: p.cause || 'treasure', ratio: 1.1,
      power: Math.round(g.cult * 1.1), grudge: p.grudge != null ? p.grudge : 6
    };
    g.forbiddenKarma = 6;
    g.sectId = '太玄门';
    g.sectFavor = 8;
    g.roadSegment = p.road != null ? p.road : 3;
  }
  if (p.married) {
    g.sectMarriage = p.married;
    g.sectPatron = p.married;
  }
  if (p.refusedMarriage) g.sectMarriage = 'refused';
  if (p.cutFailed) { g.cutDaoTried = true; g.cutDaoPassed = false; g.cutNearMiss = true; }
  if (p.saintFailed) { g.saintTried = true; g.saintPassed = false; g.saintNearMiss = true; }
  return g;
}

var choiceEvents = E.filter(function (e) { return e.choice; });
assert.ok(choiceEvents.length >= 30, '选择型事件太少：' + choiceEvents.length);

choiceEvents.forEach(function (e) {
  var got = false;
  PROBES.forEach(function (c) {
    (function () {
      var g = makeProbe(c);
      /* choice 只在事件可用时才会被引擎调用，测试遵守同一前提 */
      if (e.available && !e.available(g, Sim.U)) return;
      var spec = e.choice(g, Sim.U);
      if (!spec || !spec.options || !spec.options.length) return;
      got = true;
      var safes = spec.options.filter(function (o) { return o.safe; });
      assert.strictEqual(safes.length, 1,
        e.id + ' 必须恰好有一个退避（safe）选项，实际 ' + safes.length);
      assert.ok(spec.options.length >= 2 && spec.options.length <= 4,
        e.id + ' 选项数应在 2~4，实际 ' + spec.options.length);
      var seenOpt = {};
      spec.options.forEach(function (o) {
        assert.ok(o.id, e.id + ' 选项缺少 id');
        assert.ok(!seenOpt[o.id], e.id + ' 选项 id 重复：' + o.id);
        seenOpt[o.id] = 1;
        if (o.chance != null) {
          assert.ok(o.chance >= 0 && o.chance <= 1, e.id + '/' + o.id + ' chance 越界：' + o.chance);
        }
        if (o.safe) assert.notStrictEqual(o.risk, 'deadly', e.id + ' 退避项不应是 deadly');
        /* 每个选项都必须能被 resolve 消化，不能有落空的分支 */
        var g2 = makeProbe(c);
        var lines = [];
        try { e.resolve(g2, Sim.U, o.id, lines); }
        catch (err) {
          throw new Error(e.id + '.resolve(' + o.id + ') 在 ' + JSON.stringify(c) + ' 下抛错：' + err.message);
        }
      });
    })();
  });
  assert.ok(got, e.id + ' 在任何探测状态下都给不出选项');
});

/* ---------- 只有玩家主动选的 deadly 选项才允许致死 ---------- */
choiceEvents.forEach(function (e) {
  PROBES.forEach(function (c) {
    var g = makeProbe(c);
    if (e.available && !e.available(g, Sim.U)) return;
    var spec = e.choice(g, Sim.U);
    if (!spec || !spec.options) return;
    spec.options.forEach(function (o) {
      if (o.risk !== 'deadly') return;
      assert.ok(o.chance != null,
        e.id + '/' + o.id + ' 是梭哈选项，必须明示成功率');
    });
  });
});

/* ---------- 创法成功率：随道蕴单调上升，且被上下限夹住 ---------- */
(function () {
  var prev = -1;
  [0, 300, 800, 1500, 2200, 3000].forEach(function (dy) {
    var g = probeGame({ lvl: 60, daoyun: dy });
    g.daoyun = dy;
    var p = Sim.createArtChance(g, 'scripture');
    assert.ok(p > prev, '创法成功率应随道蕴单调上升：道蕴 ' + dy + ' 时 ' + p + ' 未高于 ' + prev);
    assert.ok(p >= 0.03 && p <= 0.93, '创法成功率越界：' + p);
    prev = p;
  });
  /* 禁术更难，且封顶更低 */
  var gm = probeGame({ lvl: 90, daoyun: 3000 });
  gm.daoyun = 3000;
  assert.ok(Sim.createArtChance(gm, 'forbidden') < Sim.createArtChance(gm, 'scripture'),
    '禁术成功率应低于经文');
  assert.ok(Sim.createArtChance(gm, 'forbidden') <= 0.60, '禁术成功率应封顶 60%');
})();

/* ---------- 自创法增益递减，且有硬上限 ---------- */
(function () {
  /* 单门法的强度本身带随机，逐步比较会抖动；这里比较前半段与后半段的平均边际 */
  var early = 0, late = 0, trials = 300;
  for (var t = 0; t < trials; t++) {
    var g = probeGame({ lvl: 80 });
    var prev = Sim.artCultMult(g);
    assert.strictEqual(prev, 1, '未创法时不应有增益');
    for (var i = 0; i < 12; i++) {
      Sim.addCreatedArt(g, 'killing');
      var m = Sim.artCultMult(g);
      if (i < 6) early += m - prev; else late += m - prev;
      prev = m;
    }
    assert.ok(Sim.artCultMult(g) <= 1.45 + 1e-9,
      '自创法修炼增益应封顶 +45%，实际 ' + Sim.artCultMult(g));
  }
  assert.ok(late < early * 0.6,
    '自创法应有明显边际递减：后六门合计 ' + (late / trials).toFixed(3) +
    ' 未显著低于前六门 ' + (early / trials).toFixed(3));

  /* 其余三项增益同样要被夹住 */
  var gg = probeGame({ lvl: 90 });
  for (var k = 0; k < 40; k++) {
    Sim.addCreatedArt(gg, ['scripture', 'guard', 'secret', 'soul'][k % 4]);
  }
  assert.ok(Sim.artBreakMult(gg) <= 1.28 + 1e-9, '突破增益应封顶 +28%');
  assert.ok(Sim.artDaoMult(gg) <= 1.30 + 1e-9, '道蕴增益应封顶 +30%');
  assert.ok(Sim.artWard(gg) <= 12 + 1e-9, '护道值应封顶 12');
})();

/* ---------- 凡体走纯悟道路线不应被额外惩罚致死 ---------- */
(function () {
  var g = probeGame({ phys: 'mortal', gift: 10, lvl: 80 });
  g.innate = 2; g.aptitude = 2; g.daoGift = 10; g.swallowingArt = false;
  assert.strictEqual(Sim.swallowSiegeDeathChance(g), 0,
    '凡体不吞噬时不应承担围攻致死概率');
})();

/* ---------- 圣地招婿：应下/婉拒都要有后面的账 ---------- */
(function () {
  function ev(id) {
    for (var i = 0; i < E.length; i++) if (E[i].id === id) return E[i];
    return null;
  }
  var marry = ev('wld_sect_marriage');
  var tribute = ev('wld_marriage_tribute');
  var levy = ev('wld_marriage_levy');
  var kin = ev('wld_marriage_kin');
  var ask = ev('wld_marriage_ask');
  var cold = ev('wld_marriage_cold');
  assert.ok(marry && tribute && levy && kin && ask && cold, '招婿及其后续事件必须齐');

  var g = probeGame({ lvl: 40 });
  g.lvl = 40; g.age = 80;
  assert.ok(marry.available(g, Sim.U), '四极后应能遇到招婿');
  marry.resolve(g, Sim.U, 'accept', []);
  assert.ok(g.sectMarriage && g.sectMarriage !== 'refused', '应婚必须记下圣地名');
  assert.ok(tribute.available(g, Sim.U), '应婚后应有岁岁供养');
  assert.ok(levy.available(g, Sim.U), '应婚后圣地会征召');
  assert.ok(!cold.available(g, Sim.U), '应婚不应走拒婚余波');

  var late = probeGame({ lvl: 78 });
  late.lvl = 78; late.age = 500;
  late.sectMarriage = g.sectMarriage;
  late.sectPatron = g.sectMarriage;
  assert.ok(ask.available(late, Sim.U), '大圣前后岳家应反过来求你');
  assert.ok(kin.available(late, Sim.U), '婚约在身应能撞上姻亲有难');

  levy.resolve(g, Sim.U, 'ill', []);
  assert.ok((g.marriageDebt || 0) >= 1, '称病不出应记下一笔姻亲账');

  var abandoned = probeGame({ lvl: 55 });
  abandoned.lvl = 55; abandoned.age = 220;
  abandoned.sectMarriage = '摇光圣地';
  abandoned.sectPatron = '摇光圣地';
  kin.resolve(abandoned, Sim.U, 'stay', []);
  assert.ok(abandoned.marriageBroken, '袖手旁观应撕破婚约');
  assert.ok(!tribute.available(abandoned, Sim.U), '婚约已破不应再吃岁供');

  var g2 = probeGame({ lvl: 40 });
  g2.lvl = 40; g2.age = 80;
  marry.resolve(g2, Sim.U, 'refuse', []);
  assert.strictEqual(g2.sectMarriage, 'refused');
  assert.ok(cold.available(g2, Sim.U), '拒婚日后要被堵路');
  assert.ok(!tribute.available(g2, Sim.U), '拒婚不应有岁供');

  var none = probeGame({ lvl: 40 });
  none.lvl = 40; none.age = 80;
  assert.ok(!tribute.available(none, Sim.U));
  assert.ok(!levy.available(none, Sim.U));
  assert.ok(!ask.available(none, Sim.U));
  assert.ok(!cold.available(none, Sim.U));

  var fell = probeGame({ lvl: 55 });
  fell.lvl = 55; fell.age = 220;
  fell.sectMarriage = '摇光圣地';
  fell.sectPatron = '摇光圣地';
  var massacre = ev('wld_sect_massacre');
  massacre.fail(fell, Sim.U);
  assert.ok(fell.marriageBroken, '姻亲圣地覆灭应算婚约已尽');
})();

/* ---------- 不死天皇：世数分布与无法单杀 ---------- */
(function () {
  function share(worldYear, lifeNo, targets) {
    var hit = 0, n = 4000;
    for (var i = 0; i < n; i++) {
      var r = Sim.undeadEmperorForRoll((i + 0.5) / n, worldYear, { lifeNo: lifeNo });
      if (targets.indexOf(r.lives) >= 0) hit++;
    }
    return hit / n;
  }
  assert.ok(share(0, 1, [3, 4, 5]) >= 0.75, '第一世入界应以 3~5 世天皇为主');
  assert.ok(share(0, 1, [8, 9]) <= 0.01, '第一世入界几乎不该撞上 8~9 世天皇');

  var g = probeGame({ lvl: 101 });
  g.becameEmperor = true;
  g.strangeWorldAlliance = null;
  assert.strictEqual(Sim.canSlayUndead(g), false, '未与无始联手时不可击杀不死天皇');
  g.strangeWorldAlliance = 'wushi';
  assert.strictEqual(Sim.canSlayUndead(g), true, '与无始联手后方可击杀不死天皇');
})();

/* ---------- 全事件可执行：逐个驱动 ok/fail，不得抛错 ---------- */
(function () {
  var unreached = [];
  E.forEach(function (e) {
    var ran = 0;
    PROBES.forEach(function (c) {
      var gate = makeProbe(c);
      /* ok/fail 同样只在事件可用时才会被引擎调用 */
      if (e.available && !e.available(gate, Sim.U)) return;
      ran++;
      ['ok', 'fail'].forEach(function (fn) {
        if (typeof e[fn] !== 'function') return;
        var g = makeProbe(c);
        var lines = [];
        try { e[fn](g, Sim.U, lines); }
        catch (err) {
          throw new Error(e.id + '.' + fn + ' 在 ' + JSON.stringify(c) + ' 下抛错：' + err.message);
        }
      });
    });
    if (!ran) unreached.push(e.id);
  });
  assert.strictEqual(unreached.length, 0,
    '以下事件在整个探测矩阵下都不可用，准入条件可能写死了：' + unreached.join(', '));
})();

console.log('events: ok（事件 ' + E.length + ' + 帝者片段 ' +
  Sim.emperorBeatIds().length + ' = ' + totalWithEmperor + '，选择型 ' + choiceEvents.length + '）');
