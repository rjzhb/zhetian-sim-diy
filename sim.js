/* ============================================================
 * 遮天模拟器 · 模拟引擎（纯逻辑，浏览器 + Node 通用，UMD）
 * 逐年修炼 · 境界寿元上限 · 随机事件 · 天心/以力证道/合道花 证道成帝
 * 体质/境界/词条：data.js  随机事件：events.js（创作者可扩展）
 * ============================================================ */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports)
    module.exports = factory(require('./data.js'), require('./events.js'));
  else root.Sim = factory(root.DATA, root.EVENTS);
})(typeof self !== 'undefined' ? self : this, function (D, E) {

  function rand(a, b) { return a + Math.random() * (b - a); }
  function irand(a, b) { return Math.floor(rand(a, b + 1)); }
  function round(x) { return Math.round(x); }
  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }

  /* ---------- 高阶体质增益（百分点）：点赞+0.2 收藏+0.3 投币+0.5 关注+1.5 ---------- */
  var _followBonus = 0;
  function setFollowBonus(pct) { _followBonus = pct || 0; }
  /* 成就加成（百分点） */
  var _achBonus = 0;
  function setAchBonus(pct) { _achBonus = pct || 0; }

  function pickPhysique(tier, acquiredOnly) {
    var pool = D.physiquesAtTier ? D.physiquesAtTier(tier) : [];
    if (acquiredOnly) {
      var filtered = [], fi;
      for (fi = 0; fi < pool.length; fi++) {
        if (pool[fi].id !== 'innate_sacred_dao') filtered.push(pool[fi]);
      }
      pool = filtered;
    }
    if (!pool.length) return D.physiqueById ? D.physiqueById(acquiredOnly ? 'chaos' : 'mortal') : null;
    var total = 0, i;
    for (i = 0; i < pool.length; i++) total += pool[i].weight || 1;
    var r = Math.random() * total, acc = 0;
    for (i = 0; i < pool.length; i++) { acc += pool[i].weight || 1; if (r < acc) return pool[i]; }
    return pool[pool.length - 1];
  }
  function pickAcquiredPhysique(tier) {
    return pickPhysique(tier, true);
  }
  function pval(g, key, fallback) {
    return g.pm && g.pm[key] != null ? g.pm[key] : fallback;
  }
  function drawEra(mult) {
    var pool = D.ERAS || [], total = 0, i;
    mult = mult || 1;
    for (i = 0; i < pool.length; i++) {
      var w = pool[i].weight || 1;
      if (pool[i].id !== 'normal') w *= mult;
      total += w;
    }
    var r = Math.random() * total, acc = 0;
    for (i = 0; i < pool.length; i++) {
      var wi = pool[i].weight || 1;
      if (pool[i].id !== 'normal') wi *= mult;
      acc += wi; if (r < acc) return pool[i];
    }
    return pool[0] || { id: 'normal', name: '平常时代', daog: 1, evt: 1, evf: 1 };
  }
  function daoyunNeed(lvl) {
    if (lvl >= 99) return 650; /* 准帝九重圆满 → 帝关 */
    if (lvl >= 96) return 520 + (lvl - 96) * 40; /* 准帝后期 */
    if (lvl >= 91) return 420 + (lvl - 91) * 18; /* 准帝前中期 */
    if (lvl >= 90) return 420; /* 大圣巅峰 → 准帝：多数大圣止步 */
    if (lvl >= 80) return 280; /* 圣人巅峰 → 大圣 */
    if (lvl >= 70) return 190; /* 王者巅峰 → 圣人：多数人到此为止 */
    if (lvl >= 60) return 85;  /* 大能巅峰 → 王者 */
    if (lvl >= 50) return 25;  /* 入仙台 */
    return 0;
  }
  /* 体质/悟性共用一张尺：档越高，破境需求越低、门槛把握越高。
   * 1 档是凡人底，10 档是封号顶。混沌/道胎走无瓶颈，不进这张表。 */
  var BODY_DAO_MULT = [0, 1.15, 1.05, 1, 0.9, 0.8, 0.65, 0.5, 0.35, 0.22, 0.12];
  var GIFT_DAO_MULT = [0, 1.18, 1.08, 1.00, 0.90, 0.80, 0.66, 0.52, 0.38, 0.22, 0.10];
  function attrScoreFromMult(mult, lo, hi) {
    if (!(hi < lo)) return 0;
    return clamp((lo - mult) / (lo - hi), 0, 1);
  }
  function bodyAttrScore(g) {
    var i = Math.min(10, Math.max(1, (g && g.innate) || 1));
    return attrScoreFromMult(BODY_DAO_MULT[i], BODY_DAO_MULT[1], BODY_DAO_MULT[10]);
  }
  function giftAttrScore(g) {
    var i = Math.min(10, Math.max(1, (g && g.daoGift) != null ? g.daoGift : 5));
    return attrScoreFromMult(GIFT_DAO_MULT[i], GIFT_DAO_MULT[1], GIFT_DAO_MULT[10]);
  }
  function daoNeedMult(g) {
    if (!g) return 1;
    if (g.physiqueId === 'chaos' || g.physiqueId === 'innate_sacred_dao') return 0;
    var i = Math.min(10, Math.max(1, g.innate || 1));
    var j = Math.min(10, Math.max(1, g.daoGift != null ? g.daoGift : 5));
    return Math.min(BODY_DAO_MULT[i], GIFT_DAO_MULT[j] * 1.05);
  }
  function effectiveDaoyunNeed(g, lvl) {
    return Math.round(daoyunNeed(lvl != null ? lvl : (g && g.lvl)) * daoNeedMult(g));
  }
  /* 悟性不会抹平体质的前期差距，但在准圣以上可以转化为创法/破关效率。
   * 绝世悟性凡体因此有一条极难、却真实可走的纯悟道路线。 */
  function breakAptitude(g, lvl) {
    var base = Math.max(1, g && g.aptitude || 1);
    if (!g || (lvl || g.lvl || 1) < 11) return base;
    var gift = Math.max(1, g.daoGift || 1);
    /* 从道宫后逐步显现，避免悟性直接抹平轮海/道宫的体质差距。 */
    var stage = clamp(((lvl || g.lvl || 1) + 10) / 40, 0, 1);
    var daoBonus = Math.floor(Math.max(0, gift - 6) * 2.0 * stage);
    return Math.min(10, base + daoBonus);
  }
  function pureDaoPath(g) {
    return !!(g && g.daoGift >= 9 && g.daoyun >= Math.max(120, effectiveDaoyunNeed(g, g.lvl)));
  }
  function daoBreakFactor(g, lvl) {
    var at = lvl != null ? lvl : (g && g.lvl);
    var need = effectiveDaoyunNeed(g, at);
    if (!need) return 1;
    var ratio = g.daoyunCap > 0 ? g.daoyun / need : 0;
    if (ratio < 1) return 0;
    var f = clamp(0.35 + (ratio - 1) * 0.45, 0.35, 1.25);
    if ((at || 1) >= 91) {
      var arts = Math.min(4, ((g.createdArts || []).length));
      var gift = Math.max(0, (g.daoGift || 5) - 6);
      f *= 1 + arts * 0.08 + gift * 0.05;
      f = clamp(f, 0.35, 2.4);
    }
    return f;
  }
  function quasiDaoRelief(g) {
    var arts = Math.min(4, ((g && g.createdArts) || []).length);
    var gift = Math.max(0, ((g && g.daoGift) || 5) - 6);
    var fill = g && g.daoyunCap > 0 ? clamp(g.daoyun / g.daoyunCap, 0, 1) : 0;
    var raw = arts * 0.08 + gift * 0.045 + Math.max(0, fill - 0.35) * 0.18;
    if (g && isPeakPhysique(g.physiqueId)) raw *= 0.35;
    return clamp(raw, 0, 0.50);
  }
  function daoZhengdaoBonus(g) {
    if (!g || isHuangguSacred(g)) return 0;
    var zhx = ((g.tm && g.tm.zhx) || 0) + pval(g, 'zhx', 0);
    var room = Math.max(0, 0.30 - zhx);
    var arts = Math.min(5, (g.createdArts || []).length);
    var abs = clamp((g.daoyun || 0) / D.DAO_ABSOLUTE_MAX, 0, 1);
    var gift = Math.max(0, (g.daoGift || 5) - 6);
    return Math.min(room, arts * 0.045 + abs * 0.14 + gift * 0.02);
  }
  function createdArtN(g) {
    return ((g && g.createdArts) || []).length;
  }
  /* 凡体墙只挡「既没走上道路、也没把战力顶满」的人。
   * 帝路金卡 / 帝路共鸣是这条路上的人；战力到大圣天花板附近说明梭哈已经把货币攒够了。 */
  var MORTAL_POWER_GATE = 280000;
  function hasImperialRoad(g) {
    if (!g) return false;
    if (g.resonance === 'imperial') return true;
    var i, paths = g.traitPaths || [];
    for (i = 0; i < paths.length; i++) if (paths[i] === 'imperial') return true;
    var ids = g.traits || [];
    for (i = 0; i < ids.length; i++) {
      var t = D.traitById(ids[i]);
      if (t && t.path === 'imperial') return true;
    }
    return false;
  }
  function isQuasiFateEvent(ev) {
    if (!ev) return false;
    if ((ev.id || '') === 'imperial_gate') return false;
    if (ev.id && String(ev.id).indexOf('th_stuck_') === 0) return false;
    var tag = ev.tag || '';
    if (tag === 'allin' || tag === 'quasi') return true;
    if (tag === 'starroad' && (ev.tier || 1) >= 3) return true;
    if ((ev.tier || 1) >= 4) return true;
    return false;
  }
  function markQuasiFate(g, ev) {
    if (!g || (g.lvl || 1) < 71) return false;
    if (!isQuasiFateEvent(ev)) return false;
    g.quasiFate = true;
    return true;
  }
  /* 进准帝看机缘，不看枯坐、不看把战力堆满。帝路命格也算开局就押上的机缘。 */
  function noRealmBottleneck(g) {
    var id = g && g.physiqueId;
    return id === 'chaos' || id === 'innate_sacred_dao';
  }
  function quasiUnlocked(g) {
    if (!g) return false;
    if (noRealmBottleneck(g)) return true;
    if (g.quasiFate) return true;
    if (hasImperialRoad(g)) return true;
    return false;
  }
  function mortalWallBypass(g) {
    if (quasiUnlocked(g)) return true;
    if (pureDaoPath(g)) return true;
    if ((g.cult || 0) >= MORTAL_POWER_GATE) return true;
    return false;
  }
  /* 斩道 / 入圣：不弹窗。成不成看当下道蕴和战力，一生一刀。
   * 逆斩不是选项，是吞天或绝世悟性凡体在道和力都够时才会撞上的路。 */
  var CUT_DAO_DAO_REF = 85;
  var CUT_DAO_POWER_REF = 14000;
  var ENTER_SAINT_DAO_REF = 190;
  var ENTER_SAINT_POWER_REF = 22000;
  function isReverseCutPath(g) {
    if (!g) return false;
    if (g.swallowingArt) return true;
    return (g.innate || 1) <= 2 && (g.daoGift || 5) >= 9;
  }
  function thresholdDaoFit(g, daoRef) {
    var personal = effectiveDaoyunNeed(g, g.lvl);
    if (!personal) return Math.max(1, clamp((g.daoyun || 0) / Math.max(1, daoRef), 0, 2.4));
    return clamp((g.daoyun || 0) / personal, 0, 2.4);
  }
  function thresholdPowerFit(g, powerRef) {
    return clamp(currentCombatPower(g) / Math.max(1, powerRef), 0, 2.4);
  }
  function thresholdFit(g, daoRef, powerRef) {
    return Math.sqrt(thresholdDaoFit(g, daoRef) * thresholdPowerFit(g, powerRef));
  }
  function reverseCutReady(g, fit) {
    return isReverseCutPath(g) && fit >= 1.15 &&
      thresholdDaoFit(g, CUT_DAO_DAO_REF) >= 1 &&
      currentCombatPower(g) >= CUT_DAO_POWER_REF * 0.9;
  }
  /* 斩道/入圣共用四柱：体质、悟性、战力、道蕴。
   * 体质/悟性是 0–1 档位分，战力/道蕴是对照参照的比值（可超过 1）。
   * 四柱加权成一条分，再用同一条曲线映到把握；缺哪根就少哪一段，不再各自加 bonus。 */
  function breakthroughPillars(g, powerRef, daoRef) {
    var need = effectiveDaoyunNeed(g, g && g.lvl);
    var daoAbs = Math.max(need || 0, daoRef || 0);
    return {
      body: noRealmBottleneck(g) ? 1 : bodyAttrScore(g),
      gift: giftAttrScore(g),
      power: clamp(currentCombatPower(g) / Math.max(1, powerRef || 1), 0, 2.4),
      dao: daoAbs ? clamp((g.daoyun || 0) / daoAbs, 0, 2.4) : 1
    };
  }
  function breakthroughScore(p, w) {
    return (w.body || 0) * p.body + (w.gift || 0) * p.gift +
      (w.power || 0) * p.power + (w.dao || 0) * p.dao;
  }
  function breakthroughCap(p) {
    return 0.78 + 0.18 * Math.max(p.body, Math.min(1, p.gift) * 0.9);
  }
  function breakthroughChance(g, spec) {
    spec = spec || {};
    if (noRealmBottleneck(g)) return 1;
    var p = breakthroughPillars(g, spec.powerRef, spec.daoRef);
    var score = breakthroughScore(p, spec);
    var cap = breakthroughCap(p);
    var floor = spec.floor != null ? spec.floor : 0.02;
    var mid = spec.mid != null ? spec.mid : 0.88;
    var k = spec.k != null ? spec.k : 3.1;
    var chance = floor + (cap - floor) / (1 + Math.exp(-k * (score - mid)));
    if (spec.extra) chance += spec.extra(g, p) || 0;
    return clamp(chance, floor, cap);
  }
  var CUT_BREAK_W = { body: 0.32, gift: 0.20, power: 0.32, dao: 0.16 };
  var SAINT_BREAK_W = { body: 0.30, gift: 0.24, power: 0.26, dao: 0.20 };
  function cutDaoChance(g) {
    return breakthroughChance(g, {
      powerRef: CUT_DAO_POWER_REF,
      daoRef: CUT_DAO_DAO_REF,
      floor: 0.02,
      body: CUT_BREAK_W.body, gift: CUT_BREAK_W.gift, power: CUT_BREAK_W.power, dao: CUT_BREAK_W.dao,
      extra: function (gg, p) {
        var fit = thresholdFit(gg, CUT_DAO_DAO_REF, CUT_DAO_POWER_REF);
        if (reverseCutReady(gg, fit)) return 0.10 * clamp(p.power / 1.4, 0.4, 1);
        if (isReverseCutPath(gg) && p.power >= 0.9 && p.dao >= 0.9) return 0.03;
        return 0;
      }
    });
  }
  function enterSaintChance(g) {
    return breakthroughChance(g, {
      powerRef: ENTER_SAINT_POWER_REF,
      daoRef: ENTER_SAINT_DAO_REF,
      floor: 0.03,
      body: SAINT_BREAK_W.body, gift: SAINT_BREAK_W.gift, power: SAINT_BREAK_W.power, dao: SAINT_BREAK_W.dao,
      extra: function (gg, p) {
        if (gg.swallowingArt && p.power >= 1 && p.dao >= 0.85) return 0.04;
        return 0;
      }
    });
  }
  function thresholdDaoReady(g) {
    var need = effectiveDaoyunNeed(g, g.lvl);
    return !need || (g.daoyun || 0) >= need;
  }
  function thresholdShouldAttempt(g, powerRef) {
    if (!thresholdDaoReady(g)) return false;
    if (currentCombatPower(g) >= powerRef * 0.85) return true;
    if ((g.lifespan || 0) - (g.age || 0) <= 120) return true;
    g.thresholdWait = (g.thresholdWait || 0) + 1;
    return g.thresholdWait >= 120;
  }
  function passRealmGate(g, log) {
    var need = effectiveDaoyunNeed(g, g.lvl);
    if (need && (g.daoyun || 0) < need) g.daoyun = need;
    return gainLevels(g, 1, log);
  }
  function cutWasClose(g, fit, chance) {
    return (chance || 0) >= 0.16 || (fit || 0) >= 0.95;
  }
  function resolveCutDao(g, log, opt) {
    opt = opt || {};
    var rekindle = !!opt.rekindle;
    if (!rekindle) g.cutDaoTried = true;
    var fit = thresholdFit(g, CUT_DAO_DAO_REF, CUT_DAO_POWER_REF);
    var reverse = reverseCutReady(g, fit);
    var chance = cutDaoChance(g);
    var free = noRealmBottleneck(g);
    var ok = free || Math.random() < chance;
    var text;
    if (ok) {
      g.cutDaoPassed = true;
      g.cutNearMiss = false;
      if (rekindle) {
        text = '你以为那一刀止住了。多年后刀意自己回来，把王者境从门口撕开';
      } else if (free) {
        text = (g.physiqueId === 'innate_sacred_dao')
          ? '圣体道胎走到这里，王者境的门自己让开。此身没有这一坎'
          : '此身无瓶颈，王者境自己开了';
      } else if (reverse) {
        text = '你逆斩大道，少年大帝联手压来。你硬接这一围，把王者境从他们手里撕开';
      } else {
        text = '大能巅峰，你按自己的道斩了一刀。这一刀过了，王者境的门在你面前开了';
      }
      push(log, { cls: 'rainbow', text: '第' + g.age + '岁，' + text });
      highlightLast(g, log, {
        title: rekindle ? '刀意回潮' : (reverse ? '逆斩大道' : '斩道'),
        kind: 'threshold',
        note: rekindle ? '翻盘进了王者' : (reverse ? '少年大帝围攻' : '王者境开门')
      });
      passRealmGate(g, log);
      return true;
    }
    if (rekindle) {
      text = '刀意回了一回，还是差那一线。这一世真的止步了';
    } else if (reverse) {
      text = '你要逆斩大道，少年大帝围了上来。这一围你没接住，斩道止步';
    } else if (isReverseCutPath(g)) {
      text = '你想逆斩大道，可道和力都还没聚起。这一刀连少年大帝的围攻都换不来，你止步大能巅峰';
    } else if (cutWasClose(g, fit, chance)) {
      g.cutNearMiss = true;
      text = '大能巅峰，这一刀只差一线。刀意还在骨头里，没散干净';
    } else {
      text = '大能巅峰，你斩不下去。这一刀缺的不是决心，是道蕴和战力都还不够。你止步于此';
    }
    if (!rekindle && !g.cutNearMiss && cutWasClose(g, fit, chance)) g.cutNearMiss = true;
    push(log, { cls: 'ev3', text: '第' + g.age + '岁，' + text });
    if (g.cutNearMiss && !rekindle) {
      highlightLast(g, log, { title: '斩道只差一线', kind: 'threshold', note: '刀意未散' });
    }
    return false;
  }
  function rekindleCutDao(g, log) {
    if (!g || g.cutDaoPassed || g.cutDaoRekindled || !g.cutNearMiss) return false;
    if ((g.innate || 1) >= 8) return false;
    g.cutDaoRekindled = true;
    return resolveCutDao(g, log, { rekindle: true });
  }
  function resolveEnterSaint(g, log, opt) {
    opt = opt || {};
    var rekindle = !!opt.rekindle;
    if (!rekindle) g.saintTried = true;
    var fit = thresholdFit(g, ENTER_SAINT_DAO_REF, ENTER_SAINT_POWER_REF);
    var chance = enterSaintChance(g);
    var free = noRealmBottleneck(g);
    var ok = free || Math.random() < chance;
    var text;
    if (ok) {
      g.saintPassed = true;
      g.saintNearMiss = false;
      if (rekindle) {
        text = '你以为圣位那一坎止住了。多年后那口气自己回来，把圣人境从门口撕开';
      } else if (free) {
        text = (g.physiqueId === 'innate_sacred_dao')
          ? '圣体道胎踏进圣位。寿元、气血、神识换了一重，门上没有坎'
          : '此身无瓶颈，圣位自己开了。从此不是同一种生命';
      } else {
        text = '王者巅峰，你踏进圣位。从此寿元、气血、神识都不再是同一种生命';
      }
      push(log, { cls: 'rainbow', text: '第' + g.age + '岁，' + text });
      highlightLast(g, log, {
        title: rekindle ? '圣位回潮' : '踏入圣位',
        kind: 'threshold',
        note: rekindle ? '翻盘进了圣人' : '生命都不一样了'
      });
      passRealmGate(g, log);
      return true;
    }
    if (rekindle) {
      text = '那口气回了一回，还是差那一线。这一世真的止步圣位';
    } else if (cutWasClose(g, fit, chance)) {
      g.saintNearMiss = true;
      text = '王者巅峰，圣位那一坎只差一线。那口气还在胸口，没散干净';
    } else {
      text = '王者巅峰，圣位那一坎你没过去。过了斩道的人，也大多止步于此';
    }
    if (!rekindle && !g.saintNearMiss && cutWasClose(g, fit, chance)) g.saintNearMiss = true;
    push(log, { cls: 'ev3', text: '第' + g.age + '岁，' + text });
    if (g.saintNearMiss && !rekindle) {
      highlightLast(g, log, { title: '入圣只差一线', kind: 'threshold', note: '圣位未散' });
    }
    return false;
  }
  function rekindleEnterSaint(g, log) {
    if (!g || g.saintPassed || g.saintRekindled || !g.saintNearMiss) return false;
    if ((g.innate || 1) >= 8) return false;
    g.saintRekindled = true;
    return resolveEnterSaint(g, log, { rekindle: true });
  }
  function eventById(id) {
    var i;
    for (i = 0; i < E.length; i++) if (E[i].id === id) return E[i];
    return null;
  }
  function offerDoorStory(g, log, id) {
    var ev = eventById(id);
    if (!ev || !eventAvailable(g, ev)) return false;
    var mc = g.maxCount || {};
    var maxN = ev.maxCount != null ? ev.maxCount : 3;
    if ((mc[ev.id] != null ? mc[ev.id] : maxN) <= 0) return false;
    fireEvent(g, log, ev);
    return true;
  }
  function ensureCutDao(g, log) {
    if (!g || g.dead || g.becameEmperor || g.pendingChoice) return;
    if ((g.lvl || 1) !== 60 || g.cutDaoTried || g.cutDaoPassed) return;
    if (noRealmBottleneck(g)) {
      if (!thresholdDaoReady(g)) return;
      g.thresholdWait = 0;
      resolveCutDao(g, log);
      return;
    }
    /* 凡人先把前夜坐完，再落刀。坐一次就斩，战力还是门口那一刀。 */
    if (!thresholdDaoReady(g)) return;
    if ((g.innate || 1) < 8 && offerDoorStory(g, log, 'th_stuck_cut')) {
      g.cutEveOffered = true;
      return;
    }
    if (!thresholdShouldAttempt(g, CUT_DAO_POWER_REF)) return;
    g.thresholdWait = 0;
    resolveCutDao(g, log);
  }
  function ensureEnterSaint(g, log) {
    if (!g || g.dead || g.becameEmperor || g.pendingChoice) return;
    if ((g.lvl || 1) !== 70 || g.saintTried || g.saintPassed) return;
    if (noRealmBottleneck(g)) {
      if (!thresholdDaoReady(g)) return;
      g.thresholdWait = 0;
      resolveEnterSaint(g, log);
      return;
    }
    if (!thresholdDaoReady(g)) return;
    if ((g.innate || 1) < 8 && offerDoorStory(g, log, 'th_stuck_sheng')) {
      g.saintEveOffered = true;
      return;
    }
    if (!thresholdShouldAttempt(g, ENTER_SAINT_POWER_REF)) return;
    g.thresholdWait = 0;
    resolveEnterSaint(g, log);
  }

  function canAdvance(g) {
    var need = effectiveDaoyunNeed(g, g.lvl);
    if (need && g.daoyun < need) return false;
    if ((g.lvl || 1) === 60 && !g.cutDaoPassed && !noRealmBottleneck(g)) return false;
    if ((g.lvl || 1) === 70 && !g.saintPassed && !noRealmBottleneck(g)) return false;
    if ((g.lvl || 1) >= 90 && !quasiUnlocked(g)) return false;
    return true;
  }
  function daoByCap(g, share, floor) {
    var cap = Math.max(80, (g && g.daoyunCap) || 80);
    return Math.max(floor || 1, Math.round(cap * share));
  }
  function gainDaoyun(g, amount, capAdd) {
    if (!g || amount <= 0) return 0;
    if (capAdd) g.daoyunCap = Math.min(D.DAO_ABSOLUTE_MAX, g.daoyunCap + capAdd);
    var old = g.daoyun;
    var raw = amount * g.tm.daog * pval(g, 'daog', 1) * ((g.era && g.era.daog) || 1);
    var next = g.daoyun + raw;
    if (next > g.daoyunCap && g.resonanceState) {
      var keep = Math.max(g.tm.overflow || 0, g.resonance === 'dao' ? 0.25 : 0);
      var room = Math.max(0, g.daoyunCap * 0.2 - g.resonanceState.overflowDao);
      g.resonanceState.overflowDao += Math.min(room, (next - g.daoyunCap) * keep);
    }
    /* 没有金色道蕴成长时，个人上限填不满：空等、帝者一世和事件都不能把海灌满。
     * 已因圣体证道等机缘超过该线的，不再被逐年回扣。 */
    var fillCap = g.daoyunCap;
    if (!hasGoldDaoGrowth(g) && g.reverseDaoBreakthroughLife !== g.lifeNo) {
      fillCap = Math.max(Math.floor(g.daoyunCap * 0.78), g.daoyun || 0);
    }
    g.daoyun = Math.min(fillCap, next);
    return round((g.daoyun - old) * 10) / 10;
  }
  function isHighDaoyun(g) {
    if (!g) return false;
    var dao = g.daoyun || 0;
    var cap = Math.max(1, g.daoyunCap || 1);
    return dao >= 800 || (dao >= 400 && dao / cap >= 0.75);
  }

  /* ============================================================
   * 创法系统
   * 道蕴决定“能不能想明白”，玩家决定“要不要走这条路”。
   * 每门自创法门长期生效，但同类越多收益越低，防止靠反复创法滚雪球。
   * ============================================================ */
  var ART_TYPES = [
    { id: 'scripture', name: '经文', minLvl: 31, diff: 1.00, deadly: false,
      desc: '重写己身修行体系，长期加快实力与道蕴积累', fx: { cult: 0.055, dao: 0.05 } },
    { id: 'guard', name: '护道法', minLvl: 21, diff: 0.90, deadly: false,
      desc: '身法与护身法门，遇险时更容易全身而退', fx: { ward: 2.6 } },
    { id: 'array', name: '阵法', minLvl: 41, diff: 1.00, deadly: false,
      desc: '以阵纹布局攻守，兼有护身与压制之效', fx: { ward: 1.5, cult: 0.025 } },
    { id: 'secret', name: '秘术', minLvl: 41, diff: 1.08, deadly: false,
      desc: '凝练突破法门，破境更快', fx: { brk: 0.07 } },
    { id: 'soul', name: '元神法', minLvl: 51, diff: 1.18, deadly: false,
      desc: '温养元神，为帝者根基与逆活铺路', fx: { soul: 1, dao: 0.045 } },
    { id: 'killing', name: '杀伐法', minLvl: 61, diff: 1.22, deadly: false,
      desc: '一法定胜负，同境战力显著提升', fx: { cult: 0.095 } },
    { id: 'longevity', name: '长生法雏形', minLvl: 71, diff: 1.40, deadly: false,
      desc: '推演驻世之法，延寿并稳固晚年血气', fx: { life: 1, soul: 1 } },
    { id: 'forbidden', name: '禁术', minLvl: 81, diff: 1.70, deadly: true,
      desc: '踏在大道禁忌边缘，威力极强，推演失败可能当场道消', fx: { cult: 0.14, brk: 0.045 } }
  ];
  var ART_PREFIX = ['苦海', '命泉', '神桥', '彼岸', '道宫', '四极', '化龙', '仙台', '轮回',
    '星海', '太初', '万道', '无量', '长生', '寂灭', '混元', '九天', '大荒', '太虚', '玄黄',
    '紫微', '幽冥', '不朽', '天心', '遮天', '斩道', '归墟', '烛照'];
  var ART_SUFFIX = {
    scripture: ['经', '真经', '古卷', '真解', '道书', '篇'],
    guard: ['护道诀', '不坏功', '身法', '避劫术', '守一诀'],
    array: ['阵图', '大阵', '杀阵', '阵纹', '锁天阵'],
    secret: ['秘术', '真诀', '妙法', '印', '玄术'],
    soul: ['元神篇', '神念法', '魂经', '照神诀'],
    killing: ['拳', '剑诀', '杀法', '指', '掌'],
    longevity: ['长生诀', '驻世法', '涅槃篇', '续命术'],
    forbidden: ['禁术', '魔功', '绝法', '逆天诀']
  };
  function artType(id) {
    for (var i = 0; i < ART_TYPES.length; i++) if (ART_TYPES[i].id === id) return ART_TYPES[i];
    return null;
  }
  function artTypeIds() {
    var out = [], i;
    for (i = 0; i < ART_TYPES.length; i++) out.push(ART_TYPES[i].id);
    return out;
  }
  function createdArts(g) {
    if (!g.createdArts) g.createdArts = [];
    return g.createdArts;
  }
  function artCount(g, typeId) {
    var arts = createdArts(g), n = 0, i;
    for (i = 0; i < arts.length; i++) if (!typeId || arts[i].type === typeId) n++;
    return n;
  }
  /* 可创法门：境界达标即出现在选项里，成功率另算 */
  function availableArtTypes(g) {
    var out = [], i;
    /* 逆天档（长生法雏形、禁术）增益远大于常规法，所以门槛也远高：
     * 除了境界，还要求创法共鸣达到 0.62，实际只有顶级档位偶尔摸得到。 */
    var defiantOk = artDefiantResonance(g);
    for (i = 0; i < ART_TYPES.length; i++) {
      var t = ART_TYPES[i];
      if ((g.lvl || 1) < t.minLvl) continue;
      if (artCount(g, t.id) >= 4) continue;
      if (isDefiantArt(t.id) && !defiantOk) continue;
      out.push(t);
    }
    return out;
  }
  function createArtChance(g, typeId) {
    var t = artType(typeId);
    if (!t || !g) return 0;
    var cap = Math.max(1, g.daoyunCap || 1);
    var abs = clamp((g.daoyun || 0) / D.DAO_ABSOLUTE_MAX, 0, 1);
    var fill = clamp((g.daoyun || 0) / cap, 0, 1);
    var gift = clamp(((g.daoGift || 5) - 3) / 7, 0, 1);
    var lvlBonus = clamp(((g.lvl || 1) - t.minLvl) / 60, 0, 1) * 0.12;
    var p = 0.08 + abs * 0.44 + fill * 0.20 + gift * 0.14 + lvlBonus;
    p /= t.diff;
    p -= artCount(g, typeId) * 0.09;
    p += Math.min(0.06, Math.max(0, ((g.tm && g.tm.daog) || 1) - 1) * 0.08);
    return clamp(round(p * 1000) / 1000, 0.03, t.deadly ? 0.60 : 0.93);
  }
  /* 推演失败的致命概率：只有禁术这类明示高危法门才可能当场道消 */
  function createArtDeathChance(g, typeId) {
    var t = artType(typeId);
    if (!t || !t.deadly) return 0;
    var relief = Math.min(0.10, (((g.tm && g.tm.ward) || 0) + pval(g, 'ward', 0)) / 200);
    return clamp(0.22 - clamp((g.daoyun || 0) / D.DAO_ABSOLUTE_MAX, 0, 1) * 0.10 - relief, 0.05, 0.22);
  }
  function artName(g, typeId) {
    var suffix = ART_SUFFIX[typeId] || ART_SUFFIX.scripture;
    var used = {}, arts = createdArts(g), i;
    for (i = 0; i < arts.length; i++) used[arts[i].name] = true;
    for (i = 0; i < 40; i++) {
      var name = ART_PREFIX[irand(0, ART_PREFIX.length - 1)] + suffix[irand(0, suffix.length - 1)];
      if (!used[name]) return name;
    }
    return ART_PREFIX[irand(0, ART_PREFIX.length - 1)] + suffix[irand(0, suffix.length - 1)] + '·其' + (arts.length + 1);
  }
  /* 成法：记录法门并立即结算一次性收益 */
  function addCreatedArt(g, typeId, opts) {
    var t = artType(typeId);
    if (!t) return null;
    opts = opts || {};
    var power = opts.power != null ? opts.power : rand(0.75, 1.35);
    /* 道蕴越深，法门品阶越高 */
    power *= 0.75 + clamp((g.daoyun || 0) / D.DAO_ABSOLUTE_MAX, 0, 1) * 0.55;
    var art = {
      type: typeId, typeName: t.name,
      name: opts.name || artName(g, typeId),
      power: round(power * 100) / 100,
      age: g.age, lvl: g.lvl
    };
    createdArts(g).push(art);
    g.createdMethods = (g.createdMethods || 0) + 1;
    if (t.fx.life) {
      var lifeAdd = Math.round(t.fx.life * art.power * irand(120, 260));
      g.lifeBonus += lifeAdd;
      art.lifeAdd = lifeAdd;
      syncLife(g);
    }
    if (t.fx.soul && g.redDustRoots) g.redDustRoots.soul += 1;
    return art;
  }
  function softCap(x, max) {
    if (x <= 0) return 0;
    return max * (1 - Math.exp(-x / max));
  }

  /* ---------- 创法机缘共鸣 ----------
   * 自创一门法不该是「活得够久就一定轮得到」的固定产出，而是道蕴、境界、机缘
   * 三者同时到位才撞出来的一瞬。g.fortuneHeat 记录近期高阶机缘的余温，逐年衰减；
   * 只有余温未散、且道蕴已经吃透当前这一层境界时，创法事件才进奖池。 */
  var FORTUNE_HEAT_MAX = 12, ART_FILL_MIN = 0.30;
  /* 逆天档（长生法雏形、禁术）要求更高的共鸣与境界，产出刻意压到接近零 */
  var ART_RESONANCE_MIN = 0.30, ART_DEFIANT_RESONANCE = 0.62, ART_DEFIANT_LVL = 71;
  function addFortuneHeat(g, tier) {
    if (!g || tier < 3) return;
    g.fortuneHeat = Math.min(FORTUNE_HEAT_MAX, (g.fortuneHeat || 0) + (tier >= 4 ? 5 : 2.5));
  }
  /* 降温按「抽中一次事件」计，不按年计。事件间隔在不同档位上差两个数量级
   * （凡体/悟性5 约 91 年一次，混沌体/悟性10 约 16368 年一次），
   * 任何按年衰减的写法都会在强档位上把余温清零，创法窗口永远打不开。 */
  var FORTUNE_HEAT_DECAY = 1.2;
  function decayFortuneHeat(g) {
    if (!g || !g.fortuneHeat) return;
    g.fortuneHeat = Math.max(0, g.fortuneHeat - FORTUNE_HEAT_DECAY);
  }
  /* 道蕴填满度：这一层境界你悟透了几成 */
  function daoFill(g) {
    if (!g) return 0;
    return clamp((g.daoyun || 0) / Math.max(1, g.daoyunCap || 1), 0, 1);
  }
  /* 0~1 的共鸣强度，判定与界面展示共用 */
  function artResonanceLevel(g) {
    if (!g || g.becameEmperor) return 0;
    if ((g.lvl || 1) < 21) return 0;
    var fill = daoFill(g);
    /* 阈值 0.30 是按实测标定的：悟性越高 daoyunCap 涨得越快，填充度实际上很难越过 0.5
     * （凡体/悟性10 均值 0.421，混沌体/悟性10 均值 0.369），
     * 写 0.55 会让创法永远触发不了。0.30 恰好挡住凡体/悟性5（0.220）和荒古圣体/悟性8（0.213）。 */
    if (fill < ART_FILL_MIN) return 0;              /* 道蕴没吃透这一层，谈不上立法 */
    var heat = clamp((g.fortuneHeat || 0) / 6, 0, 1);
    if (heat <= 0) return 0;                        /* 近期没撞过高阶机缘，没有由头 */
    var depth = clamp(((g.lvl || 1) - 20) / 70, 0, 1);
    var fillNorm = clamp((fill - ART_FILL_MIN) / 0.25, 0, 1);
    return clamp(fillNorm * 0.5 + heat * 0.34 + depth * 0.16, 0, 1);
  }
  function artResonance(g) { return artResonanceLevel(g) >= ART_RESONANCE_MIN; }
  /* 逆天法：增益大就必须稀有 */
  function artDefiantResonance(g) {
    return (g && (g.lvl || 1) >= ART_DEFIANT_LVL) && artResonanceLevel(g) >= ART_DEFIANT_RESONANCE;
  }
  function isDefiantArt(typeId) { return typeId === 'forbidden' || typeId === 'longevity'; }
  function artFxSum(g, key) {
    var arts = (g && g.createdArts) || [], sum = 0, i;
    for (i = 0; i < arts.length; i++) {
      var t = artType(arts[i].type);
      if (t && t.fx[key]) sum += t.fx[key] * (arts[i].power || 1);
    }
    return sum;
  }
  function artCultMult(g) { return 1 + softCap(artFxSum(g, 'cult'), 0.45); }
  function artBreakMult(g) { return 1 + softCap(artFxSum(g, 'brk'), 0.28); }
  function artDaoMult(g) {
    return 1 + softCap(artFxSum(g, 'dao') + Math.min(5, createdArtN(g)) * 0.03, 0.30);
  }
  function artWard(g) { return softCap(artFxSum(g, 'ward'), 12); }
  function artSummary(g) {
    var arts = (g && g.createdArts) || [], out = [], i;
    for (i = 0; i < arts.length; i++) out.push('《' + arts[i].name + '》');
    return out.join('、');
  }
  function latestArt(g) {
    var arts = (g && g.createdArts) || [];
    return arts.length ? arts[arts.length - 1] : null;
  }

  /* ---------- 突破旁白：高道蕴者每次破境都是悟道，但说法不能千篇一律 ---------- */
  var INSIGHT_LINES = [
    '你静坐观心，万道脉络自行铺开，就此悟道，',
    '旧日疑窦一念尽解，你于无声处悟道，',
    '你推翻前人经义另起炉灶，悟道之后，',
    '天地元气随心念归位，你借此悟道，',
    '大道在耳畔低语，你听懂了半句便已悟道，',
    '生死边缘回望来路，你豁然悟道，',
    '苦海之上异象垂落，你迎着异象悟道，',
    '你把所学尽数忘去，只留自己的道，悟道之后，',
    '彻夜论道之后道心通明，你顺势悟道，',
    '你在旧伤处看见新的法理，因伤悟道，',
    '一片落叶入水，涟漪之中你悟道，',
    '你重走幼时旧路，在故地悟道，'
  ];
  function insightPrefix(g) {
    if (!isHighDaoyun(g)) return '';
    var last = g.lastInsight || '';
    var art = latestArt(g);
    if (art && g.insightArtTold !== art.name) {
      var artLine = '你以自创《' + art.name + '》悟道，推演己身，';
      g.insightArtTold = art.name;
      g.lastInsight = artLine;
      return artLine;
    }
    var used = g.insightUsed || (g.insightUsed = {});
    var i, line, bag = [];
    for (i = 0; i < INSIGHT_LINES.length; i++) {
      if (INSIGHT_LINES[i] !== last && !used[INSIGHT_LINES[i]]) bag.push(INSIGHT_LINES[i]);
    }
    if (!bag.length) {
      g.insightUsed = {};
      used = g.insightUsed;
      for (i = 0; i < INSIGHT_LINES.length; i++) {
        if (INSIGHT_LINES[i] !== last) bag.push(INSIGHT_LINES[i]);
      }
    }
    line = bag.length ? bag[irand(0, bag.length - 1)] : INSIGHT_LINES[0];
    used[line] = 1;
    g.lastInsight = line;
    return line;
  }

  /* ============================================================
   * 通用选择框架
   * 事件把选项写进 g.pendingChoice，UI 读取后调用 resolveChoice；
   * 快速模式与批量模拟按 safe 选项自动决策，不弹窗。
   * ============================================================ */
  var _autoChoice = false;
  function setAutoChoice(v) { _autoChoice = !!v; }
  function isAutoChoice() { return _autoChoice; }
  var CHOICE_HANDLERS = {};
  function registerChoiceHandler(id, fn) { CHOICE_HANDLERS[id] = fn; }
  function defaultChoiceOption(choice) {
    if (!choice || !choice.options || !choice.options.length) return null;
    var i;
    for (i = 0; i < choice.options.length; i++) if (choice.options[i].auto) return choice.options[i].id;
    for (i = 0; i < choice.options.length; i++) if (choice.options[i].safe) return choice.options[i].id;
    return choice.options[0].id;
  }
  /* 不弹窗的路边事：能赌且不是致命，就替玩家走一遭，别全缩成「没听见」。 */
  function quietChoiceOption(choice) {
    if (!choice || !choice.options || !choice.options.length) return null;
    var i, o, mid = null;
    for (i = 0; i < choice.options.length; i++) {
      o = choice.options[i];
      if (!o || o.safe || o.risk === 'deadly') continue;
      if (o.chance != null && o.chance < 0.5) continue;
      if (!mid || (o.chance || 1) > (mid.chance || 1)) mid = o;
    }
    return mid ? mid.id : defaultChoiceOption(choice);
  }
  function openChoice(g, log, choice) {
    if (!g || !choice || !choice.options || !choice.options.length) return false;
    if (_fast || _autoChoice) {
      applyChoice(g, choice, defaultChoiceOption(choice), log);
      return false;
    }
    g.pendingChoice = choice;
    if (choice.prompt) push(log, { cls: choice.cls || 'rainbow', text: choice.prompt });
    return true;
  }
  function applyChoice(g, choice, optionId, log) {
    var chosen = null, i;
    for (i = 0; i < choice.options.length; i++) if (choice.options[i].id === optionId) chosen = choice.options[i];
    if (!chosen) chosen = choice.options[0];
    if (choice.source === 'event') {
      var ev = null;
      for (i = 0; i < E.length; i++) if (E[i].id === choice.evId) ev = E[i];
      if (!ev || !ev.resolve) return false;
      markQuasiFate(g, ev);
      var prevCur = _curEv;
      _curEv = { ev: ev, g: g, log: log, printed: false };
      ev.resolve(g, choice.stakes ? choiceStakeU(g, chosen) : U, chosen.id, log);
      _curEv = prevCur;
      grantEventDaoyun(g, ev, log);
      return true;
    }
    var handler = CHOICE_HANDLERS[choice.id];
    if (!handler) return false;
    handler(g, chosen.id, log);
    return true;
  }
  function resolveChoice(g, optionId, log) {
    if (!g || !g.pendingChoice) return false;
    var choice = g.pendingChoice;
    var picked = optionOf(choice, optionId);
    var verdict = judgePlanPick(g, choice, picked);
    g.pendingChoice = null;
    var ok = applyChoice(g, choice, optionId, log);
    if (ok && !g.dead) applyPlanDividend(g, verdict, log);
    return ok;
  }
  function optionOf(choice, optionOrId) {
    if (!choice || !choice.options || !choice.options.length) return null;
    if (optionOrId && typeof optionOrId === 'object') return optionOrId;
    var i;
    for (i = 0; i < choice.options.length; i++) {
      if (choice.options[i].id === optionOrId) return choice.options[i];
    }
    return choice.options[0];
  }
  function bestPlanOption(list, scoreFn) {
    var best = null, i, s, top = -Infinity;
    for (i = 0; i < list.length; i++) {
      s = scoreFn(list[i]);
      if (s > top) { top = s; best = list[i]; }
    }
    return best;
  }
  /* 谋划看的是弹窗上的数，不是事后掷骰。会规划的人：把握够了就立法/梭哈，
   * 轮海里低把握高致死就退避，帝关两成且余寿还长就再压。选对了兑战力和证道，
   * 不另开一局运气。 */
  function judgePlanPick(g, choice, optionOrId) {
    if (!g || !choice || !choice.options || !choice.options.length) return 'neutral';
    var picked = optionOf(choice, optionOrId);
    if (!picked) return 'neutral';
    var opts = choice.options, i, arts = [], deadly = [], mids = [];
    for (i = 0; i < opts.length; i++) {
      if (opts[i].id && String(opts[i].id).indexOf('art_') === 0) arts.push(opts[i]);
      else if (opts[i].risk === 'deadly') deadly.push(opts[i]);
      else if (!opts[i].safe) mids.push(opts[i]);
    }
    var bestArt = bestPlanOption(arts, function (o) { return o.chance || 0; });
    var bestDeadly = bestPlanOption(deadly, function (o) {
      return (o.chance || 0) - (o.deathChance || 0) * 0.7;
    });
    var bestMid = bestPlanOption(mids, function (o) { return o.chance || 0; });
    var lvl = g.lvl || 1;

    if (choice.id === 'imperial_gate') {
      var strike = null;
      for (i = 0; i < opts.length; i++) if (opts[i].id === 'strike') strike = opts[i];
      var odds = strike ? (strike.chance || 0) : 0;
      var room = (g.lifespan || 0) - (g.age || 0);
      if (odds >= 0.55 && picked.id === 'strike') return 'good';
      if (odds < 0.32 && room > 800 && picked.id === 'wait') return 'good';
      if (odds >= 0.55 && picked.id === 'wait') return 'bad';
      if (odds < 0.28 && room > 1500 && picked.id === 'strike') return 'bad';
      return 'neutral';
    }

    if (bestArt && (bestArt.chance || 0) >= 0.36) {
      if (picked.id === bestArt.id) return 'good';
      if (picked.safe && (bestArt.chance || 0) >= 0.55) return 'bad';
    }
    if (lvl < 21 && bestDeadly && (bestDeadly.deathChance || 0) >= 0.28) {
      if (picked.safe) return 'good';
      if (picked.risk === 'deadly') return 'bad';
    }
    if (bestDeadly && (bestDeadly.chance || 0) >= 0.40) {
      var death = bestDeadly.deathChance || 0;
      var ev = (bestDeadly.chance || 0) - death * 0.7;
      if (ev >= 0.22 && death <= 0.20 && lvl >= 41 && picked.id === bestDeadly.id) return 'good';
    }
    if (bestDeadly && ((bestDeadly.chance || 0) < 0.26 || (bestDeadly.deathChance || 0) >= 0.42)) {
      if (picked.safe) return 'good';
      if (picked.risk === 'deadly') return 'bad';
    }
    if (bestMid && (bestMid.chance || 0) >= 0.48 &&
        (!bestDeadly || (bestDeadly.chance || 0) < 0.30) &&
        picked.id === bestMid.id) {
      return 'good';
    }
    return 'neutral';
  }
  function applyPlanDividend(g, verdict, log) {
    if (!g || verdict !== 'good') return;
    g.planScore = (g.planScore || 0) + 1;
    g.planEdge = Math.min(0.18, (g.planEdge || 0) + 0.015);
    if (g.planScore % 3 !== 0) return;
    var add = Math.max(220, Math.round((g.cult || 0) * 0.05));
    g.cult = (g.cult || 0) + add;
    settleOverflowCult(g, log);
    push(log, { cls: 'rare', text: '第' + (g.age || 0) + '岁，此前几次取舍都踩在该踩的点上，布局兑现。' +
      '不是天赐机缘，是你自己把路走顺了，实力+' + add });
  }
  function pendingChoice(g) { return (g && g.pendingChoice) || null; }
  /* 供 UI 使用：把概率写成百分比文本 */
  function pctText(p) { return Math.round(clamp(p, 0, 1) * 1000) / 10 + '%'; }

  /* ---------- 梭哈的三档结局 ----------
   * 早期梭哈是「成功 or 陨落」，失败即死，八成的死亡率让它在任何局面下都不值得点，
   * 主动权形同虚设。现在失败再分两档：多数是重伤生还（掉寿元/境界），少数才真的陨落。
   * deathShare 就是「失败里有多大比例是致命的」，由事件按危险程度自己定。
   * 展示与判定都走这两个函数，保证弹窗上写的数字就是实际掷骰的数字。 */
  var DEFAULT_DEATH_SHARE = 0.34;
  function allInDeathOdds(successChance, deathShare) {
    var s = deathShare != null ? deathShare : DEFAULT_DEATH_SHARE;
    return clamp((1 - allInFloor(successChance)) * clamp(s, 0, 1), 0, 1);
  }
  function allInOutcome(successChance, deathShare) {
    var win = allInFloor(successChance);
    var die = allInDeathOdds(win, deathShare);
    var r = Math.random();
    if (r < win) return 'win';
    if (r < win + die) return 'dead';
    return 'hurt';
  }

  /* ---------- 梭哈的凸收益 ----------
   * 赌命要赌得值：收益不能只是跟着风险线性长，得长得比风险更快，
   * 这样低成功率的那一把一旦成了，回报是压倒性的，而不是「勉强回本」。
   * 以五成把握为基准 1 倍，指数 1.15 使期望收益随风险单调上升：
   * 推导见 docs/superpowers/specs/2026-09-10-thrill-economy-design.md。
   *
   * 成功率夹在 [0.22, 0.90]。
   *
   * 地板 0.22 是硬算出来的：死亡的代价是整局剩余期望归零，成功率低于 0.22 时，
   * 「胜率 × 收益增量 ≥ 死亡率 × 成帝率」要求收益增量大于 1，而它是个概率——
   * 也就是说赢了直接保送成帝都还是亏的。那样的梭哈是纯陷阱。
   *
   * 上限给到 0.90 而不是 0.55：战力必须能换来安全感，否则「梭哈变强 → 梭哈更安全」
   * 的正反馈滚不起来，玩家感受不到自己在成长。强者该有强者的待遇。
   *
   * 倍率以 0.55 为枢轴，成功率高于它就不再加成（低风险本来就该低回报）：
   *   90% → 1.00 倍      55% → 1.00 倍
   *   40% → 1.54 倍      30% → 2.27 倍      22% → 3.45 倍 */
  var ALLIN_PIVOT = 0.55, ALLIN_EXP = 1.35, ALLIN_MAX = 4;
  var ALLIN_MIN_CHANCE = 0.22, ALLIN_MAX_CHANCE = 0.90;
  function allInFloor(successChance, g, powerRef) {
    var c = clamp(successChance, ALLIN_MIN_CHANCE, ALLIN_MAX_CHANCE);
    if (g && powerRef > 0) {
      var ratio = currentCombatPower(g) / powerRef;
      if (ratio >= 3) return ALLIN_MAX_CHANCE;
      if (ratio >= 2) return Math.max(c, 0.85);
    }
    return c;
  }

  /* ---------- 梭哈赢下来的战力暴涨 ----------
   * cultPct 是「按当前战力的百分比追加」，给到 100% 也只能翻倍，
   * 而实测要改变结局需要 ×10 以上的量级（Δ成帝率(pp) ≈ 0.95 × 战力倍数）。
   * 所以赢下梭哈必须直接乘战力，而不是加一个百分比。
   *   倍率 1.00（稳赢局面）→ 战力 ×3
   *   倍率 3.45（赌命局面）→ 战力 ×18
   * 这就是「梭哈成功很爽」的物质基础，也是正反馈的燃料。 */
  function allInPowerSurge(payoffMult) {
    return clamp(3 + 6 * (clamp(payoffMult, 1, ALLIN_MAX) - 1), 3, 24);
  }
  /* 有些档位（典型是荒古圣体）百分百能站到帝关前，卡的是证道那一掷，
   * 战力根本不进那个公式。对他们来说战力暴涨是废货币，必须另给一份
   * 直接作用于证道成功率的收益，否则梭哈对这类体质永远负期望。 */
  function grantZhengdaoEdge(g, payoffMult) {
    if (!g || !g.tm) return 0;
    var add = clamp(0.012 * clamp(payoffMult, 1, ALLIN_MAX), 0, 0.05);
    g.tm.zhx += add;
    return add;
  }
  function powerSurge(g, mult, log) {
    if (!g || !(mult > 1)) return 0;
    var before = g.cult || 0;
    g.cult = round(before * mult);
    settleOverflowCult(g, log);
    return g.cult - before;
  }

  /* 本境战力天花板。梭哈只乘战力不推境界时，大圣可以比天帝还高——
   * 玩家会觉得自己无敌，然后死在淬体上。超过天花板先把境界撑上去，
   * 还是装不下就裁到上限。大圣最高 45 万，远低于天帝 150 万。 */
  var REALM_CULT_CAP = [0, 800, 4000, 15000, 40000, 80000, 140000, 220000, 320000, 450000, 900000];
  function realmCultCap(lvl) {
    var r = D.realmIdx(lvl);
    return REALM_CULT_CAP[r] || 900000;
  }
  function markRealmEnter(g) {
    if (!g) return;
    var band = D.realmIdx(g.lvl);
    if (!g.realmEnterAge) g.realmEnterAge = {};
    if (g.realmEnterAge[band] == null) g.realmEnterAge[band] = g.age || 0;
  }
  function settleOverflowCult(g, log) {
    if (!g || g.becameEmperor) return 0;
    var start = g.lvl || 1, pushed = 0;
    var cap = realmCultCap(g.lvl);
    while (g.cult > cap && g.lvl < 99 && canAdvance(g) && pushed < 30) {
      g.lvl++;
      pushed++;
      markRealmEnter(g);
      if (g.lvl % 10 === 1) realmLifeRefill(g);
      if (isHuangguSacred(g) && g.lvl >= 99) completeSacredBody(g, log);
      cap = realmCultCap(g.lvl);
    }
    if (g.cult > cap) g.cult = Math.round(Math.min(g.cult, cap * 1.12));
    if (pushed && log) {
      push(log, { cls: 'rainbow', text: '第' + (g.age || 0) + '岁，这一身战力已经装不下原先的境界，硬生生把你从' +
        D.titleOf(start) + '撑到了' + D.titleOf(g.lvl) });
    }
    return pushed;
  }

  /* 梭哈赢下来之后的叙述。不要写成「战力翻了 X 倍」这种结算单，
   * 要和回顾一生的行文一个调子，所以按涨幅分档各给一组说法，随机取用。 */
  var SURGE_LINES_BIG = [
    '那一瞬你像是被谁从头到脚重铸了一遍。旧日的自己隔着岁月看过来，竟已认不出如今这具身躯里翻涌的东西',
    '血从耳中流下来，你却笑出了声。这一搏赌的是命，赢回来的是一整条路',
    '道则在你体内炸开又重聚。再睁眼时，昨日那些让你绕道走的存在，如今不过是路边的石头',
    '你听见自己骨骼里有什么东西彻底碎了，又有什么东西从碎处长了出来，比原先粗壮了不知多少'
  ];
  var SURGE_LINES_MID = [
    '气血翻涌了整整三日才平息。等你重新站起来时，已经不是走进来的那个人了',
    '这一注押得值。道基被生生撑开一圈，往后许多年都不必再为境界发愁',
    '你把那份机缘一点点炼进骨血里，像是往干涸多年的河床里放了一场洪水'
  ];
  var SURGE_LINES_SMALL = [
    '收获谈不上惊天动地，但确实比出发时厚实了一截',
    '你稳稳地把它收进袖中。没有惊险，也没有意外，这大概就是实力带来的从容'
  ];
  function surgeLine(surge, edge) {
    var pool = surge >= 12 ? SURGE_LINES_BIG : (surge >= 6 ? SURGE_LINES_MID : SURGE_LINES_SMALL);
    var s = pool[Math.floor(Math.random() * pool.length)];
    if (edge > 0) {
      s += '。更要紧的是，这份机缘已烙进道基，他日叩帝关时会替你多争一分';
    }
    return s;
  }

  /* 致死比例同样随战力下降：强者失手更容易全身而退。
   * 战力比 2.0 时只剩四成，配合高成功率，陨落率可以低到 2% 出头。 */
  function allInDeathShare(g, base, powerRef) {
    var s = base != null ? base : DEFAULT_DEATH_SHARE;
    if (!g || !powerRef) return s;
    var ratio = currentCombatPower(g) / powerRef;
    if (ratio >= 2) return 0;   /* 强出一个档，不能再被这档机缘抹掉 */
    return clamp(s * (1 - 0.60 * clamp(ratio - 1, 0, 1)), 0, 1);
  }
  function allInPayoff(successChance) {
    var c = allInFloor(successChance);
    if (c >= ALLIN_PIVOT) return 1;
    return clamp(Math.pow(ALLIN_PIVOT / c, ALLIN_EXP), 1, ALLIN_MAX);
  }

  /* 把 U 包一层，让事件原有的奖励写法自动吃到梭哈倍率，
   * 免得每个梭哈事件都要手写一遍「成功时额外乘多少」。 */
  function boostedU(mult) {
    if (!(mult > 1)) return U;
    var B = {}, k;
    for (k in U) B[k] = U[k];
    B.cultPct = function (g, lo, hi, floor) {
      return U.cultPct(g, lo * mult, hi * mult, round((floor || 0) * mult));
    };
    B.gainDao = function (g, amount, capAdd) {
      /* 道蕴上限是长期资源，涨幅收敛一些，避免一把梭哈就顶到天花板 */
      return U.gainDao(g, round(amount * mult), capAdd ? round(capAdd * Math.min(mult, 2.2)) : capAdd);
    };
    B.gainLife = function (g, lo, hi) {
      return U.gainLife(g, round(lo * mult), round(hi * mult));
    };
    B.up = function (g, n, log) {
      return U.up(g, Math.max(n, Math.round(n * Math.min(mult, 3))), log);
    };
    B.payoffMult = mult;
    return B;
  }
  /* 帝者晚年：道行不会消失，但帝躯、血气和当前战力会随寿元衰败。
   * 记录的 g.cult 仍是历史道行，真正出手时使用 currentCombatPower。 */
  function currentCombatPower(g) {
    if (!g || !g.emperor || g.redDustImmortal || g.inStrangeWorld || g.forbiddenLord) return g ? g.cult : 0;
    var span = Math.max(1, (g.emperorLifeEnd || g.age + 1) - (g.emperorLifeStart || g.age));
    var progress = clamp(((g.age || 0) - (g.emperorLifeStart || 0)) / span, 0, 1);
    if (progress <= 0.55) return g.cult;
    var decline = (progress - 0.55) / 0.45;
    var resilience = Math.min(0.22, (g.tm && g.tm.latePower) || 0);
    return round(g.cult * (1 - decline * (0.32 - resilience)));
  }
  function setPhysique(g, p) {
    if (!p) return;
    if (p.id === 'innate_sacred_dao' && g.physiqueId && g.physiqueId !== 'innate_sacred_dao' &&
        ((g.year || 0) > 0 || g.gotYibian)) {
      return;
    }
    g.physiqueId = p.id; g.physiqueName = p.name; g.pm = p.fx || {};
    g.innate = p.tier; g.aptitude = Math.max(g.aptitude || 1, p.tier);
    if (g.daoyunCap != null) {
      g.daoyunCap = Math.max(g.daoyunCap, baseDaoyunCap(p.tier));
      g.daoyun = Math.max(g.daoyun || 0, baseDaoyun(p.tier));
    }
    if (g.swallowingArt && !isPeakPhysique(p.id)) {
      initSwallowState(g);
      g.swallowState.taken[p.id] = true;
    }
    syncLife(g);
  }

  function isPeakPhysique(id) {
    return id === 'chaos' || id === 'innate_sacred_dao';
  }

  function swallowTargets() {
    var out = [], i;
    for (i = 0; i < D.PHYSIQUES.length; i++) {
      var p = D.PHYSIQUES[i];
      if (!isPeakPhysique(p.id)) out.push(p);
    }
    return out;
  }

  function swallowTierCap(lvl) {
    if (lvl < 21) return 2;
    if (lvl < 31) return 4;
    if (lvl < 41) return 5;
    if (lvl < 51) return 6;
    if (lvl < 71) return 7;
    if (lvl < 81) return 8;
    return 9;
  }

  function initSwallowState(g) {
    if (!g.swallowState) g.swallowState = { taken: {} };
    if (!g.swallowState.taken) g.swallowState.taken = {};
    if (g.physiqueId && !isPeakPhysique(g.physiqueId)) {
      g.swallowState.taken[g.physiqueId] = true;
    }
    return g.swallowState;
  }

  function swallowProgress(g) {
    if (!g) return { have: 0, need: 0 };
    if (g.swallowingArt) initSwallowState(g);
    var need = swallowTargets().length, have = 0, taken = (g.swallowState && g.swallowState.taken) || {}, i;
    var list = swallowTargets();
    for (i = 0; i < list.length; i++) if (taken[list[i].id]) have++;
    return { have: have, need: need };
  }

  function nextSwallowTarget(g) {
    if (!g || !g.swallowingArt || isPeakPhysique(g.physiqueId)) return null;
    initSwallowState(g);
    var cap = swallowTierCap(g.lvl || 1);
    var taken = g.swallowState.taken;
    var list = swallowTargets(), i, minTier = 99, pool = [];
    for (i = 0; i < list.length; i++) {
      if (taken[list[i].id] || list[i].tier > cap) continue;
      if (list[i].tier < minTier) minTier = list[i].tier;
    }
    for (i = 0; i < list.length; i++) {
      if (!taken[list[i].id] && list[i].tier === minTier && list[i].tier <= cap) pool.push(list[i]);
    }
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function swallowNarrate(g, log, text, cls) {
    if (_curEv && _curEv.log) {
      printlog(text);
      return;
    }
    push(log, { cls: cls || 'rainbow', text: '第' + g.age + '岁，遇到异体天骄，' + text });
  }

  function applySwallowGrowth(g, target) {
    var cultGain = round(Math.max(80, g.cult * (0.014 + target.tier * 0.006)) * pval(g, 'cgt', 1));
    g.cult += cultGain;
    var upgraded = false;
    if (target.tier > (g.innate || 1)) {
      setPhysique(g, target);
      upgraded = true;
    }
    return { cultGain: cultGain, upgraded: upgraded };
  }

  function swallowStepChance(g, target) {
    var base = g.gotRuthless ? 0.28 : 0.16;
    if (target.tier >= 9) return base * 0.55;
    if (target.tier >= 8) return base * 0.75;
    return base;
  }

  function swallowSiegeRealmScale(g) {
    var band = D.realmIdx((g && g.lvl) || 1);
    if ((g && g.lvl) >= 91) return 0.02;
    if (band >= 9) return 0.08;
    if (band >= 8) return 0.28;
    if (band >= 7) return 0.50;
    if (band >= 6) return 0.68;
    if (band >= 5) return 0.82;
    return 1;
  }
  function swallowSiegeDeathChance(g) {
    if (!g || !g.swallowingArt) return 0;
    var n = swallowProgress(g).have || 0;
    if (n < 2) return 0;
    var chance = 0.06 + (n - 2) * 0.018;
    if (g.physiqueId === 'chaos' || g.swallowReady) chance += 0.08;
    chance -= Math.min(0.08, ((g.tm && g.tm.ward) || 0) / 200 + pval(g, 'ward', 0) / 200);
    chance = clamp(chance, 0.05, 0.48) * swallowSiegeRealmScale(g);
    if ((g.lvl || 1) >= 91) return clamp(chance, 0, 0.012);
    if ((g.lvl || 1) >= 81) return clamp(chance, 0, 0.035);
    return chance;
  }
  function swallowSiegeSurviveChance(g) {
    var dead = swallowSiegeDeathChance(g);
    var cap = (g && g.lvl >= 91) ? 0.98 : ((g && g.lvl >= 81) ? 0.94 : 0.78);
    return clamp(1 - dead * 1.6, 0.18, cap);
  }
  function resolveSwallowSiege(g, log, died) {
    if (!g) return false;
    if (died) {
      g.dead = true;
      g.deadCause = 'swallow_siege';
      swallowNarrate(g, log, '举世皆敌！圣地、古族与仇家联手围攻，你吞尽血债却未能杀出重围，身死道消', 'dead');
      return true;
    }
    g.cult = round(g.cult * rand(0.86, 0.95));
    swallowNarrate(g, log, '举世皆敌，诸强围攻；你杀出重围，实力跌至' + g.cult, 'dead');
    return false;
  }
  function trySwallowPhysique(g, log) {
    if (!g || !g.swallowingArt || isPeakPhysique(g.physiqueId)) return false;
    var target = nextSwallowTarget(g);
    if (!target || isPeakPhysique(target.id)) return false;
    g.swallowState.taken[target.id] = true;
    var growth = applySwallowGrowth(g, target);
    var prog = swallowProgress(g);
    var text = '你以吞天魔功炼化『' + target.name + '』本源（' + prog.have + '/' + prog.need + '），实力+' + growth.cultGain;
    if (growth.upgraded) text += '，体质蜕变为『' + g.physiqueName + '』';
    swallowNarrate(g, log, text);
    if (prog.have >= prog.need) {
      g.swallowReady = true;
      if (!becomeChaosFromSwallow(g, log) && (g.lvl < 71 || g.daoyun < 85)) {
        swallowNarrate(g, log, '诸般体质本源已入炉，只待圣人境熔炼万法、化作混沌', 'rare');
      }
    }
    if (!g.dead && Math.random() < swallowSiegeDeathChance(g) * 0.22) {
      resolveSwallowSiege(g, log, true);
    }
    return true;
  }

  function becomeChaosFromSwallow(g, log) {
    if (!g || !g.swallowingArt || g.physiqueId === 'chaos') return false;
    var prog = swallowProgress(g);
    if (prog.have < prog.need) return false;
    if (g.lvl < 71 || g.daoyun < 85) return false;
    setPhysique(g, D.physiqueById('chaos'));
    g.daoyunCap = Math.max(g.daoyunCap, 1500);
    swallowNarrate(g, log, '万法归炉，你熔炼所吞诸般体质本源，褪去旧躯，蜕变为混沌体！');
    return true;
  }

  function stepSwallowPath(g, log) {
    if (!g.swallowingArt || g.physiqueId === 'chaos') return false;
    var prog = swallowProgress(g);
    if (prog.have >= prog.need) return becomeChaosFromSwallow(g, log);
    var target = nextSwallowTarget(g);
    if (!target || g.lvl < 21) return false;
    if (Math.random() >= swallowStepChance(g, target)) return false;
    return trySwallowPhysique(g, log);
  }
  /* 道蕴是后天成果而非另一种先天体质：起点差距小，体质主要决定积累速度与可望见的天花板。 */
  function baseDaoyun(tier) { return [0, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16][tier] || 4; }
  function baseDaoyunCap(tier) { return [0, 500, 560, 620, 700, 780, 880, 1000, 1150, 1300, 1500][tier] || 500; }

  function recordWorldEvent(g, year, text) {
    g.worldHistory = g.worldHistory || [];
    g.worldHistory.push({ year: Math.round(year), text: text });
    if (g.worldHistory.length > 40) g.worldHistory.shift();
  }
  function daoTraceSpan() { return irand(D.DAO_TRACE_MIN, D.DAO_TRACE_MAX); }
  function markDaoTraces(g, fromYear) {
    g.daoTraceUntil = (fromYear || 0) + daoTraceSpan();
    if (g.nextWorldEmperorYear == null || g.nextWorldEmperorYear < g.daoTraceUntil) {
      g.nextWorldEmperorYear = g.daoTraceUntil;
    }
  }
  function rivalEmperorEarliestYear(g) {
    var min = g.becameEmperor ? 0 : D.WORLD_RIVAL_EMPEROR_MIN_YEAR;
    if (g.daoTraceUntil != null) min = Math.max(min, g.daoTraceUntil);
    return min;
  }
  function refreshDaoSuppression(g) {
    if (g.playerEmperorActive) { g.daoSuppressed = false; return; }
    g.daoSuppressed = !!(g.worldEmperor || (g.daoTraceUntil != null && (g.worldYear || 0) < g.daoTraceUntil));
  }
  function tracesStillActive(g) {
    return !!(g.daoTraceUntil != null && (g.worldYear || 0) < g.daoTraceUntil);
  }
  function createWorldEmperor(g, startYear) {
    g.worldEmperorSeq = (g.worldEmperorSeq || 0) + 1;
    var duration = irand(D.WORLD_EMPEROR_LIFE_MIN, D.WORLD_EMPEROR_LIFE_MAX);
    g.worldEmperor = {
      name: '当世第' + g.worldEmperorSeq + '位大帝',
      start: startYear,
      end: startYear + duration,
      cult: irand(D.WORLD_EMPEROR_CULT_MIN, D.WORLD_EMPEROR_CULT_MAX)
    };
    g.daoTraceUntil = null;
    recordWorldEvent(g, startYear, g.worldEmperor.name + '证道，天心有主');
  }
  function initWorldCalendar(g) {
    g.worldYear = 0; g.worldHistory = []; g.worldEmperorSeq = 0;
    g.playerEmperorActive = false; g.worldEmperor = null;
    g.nextWorldEmperorYear = null; g.daoTraceUntil = null; g.daoSuppressed = false;
  }
  function advanceWorldCalendar(g, years, log) {
    if (!g || years <= 0) return;
    var target = (g.worldYear || 0) + years;
    if (g.playerEmperorActive) {
      g.worldYear = target; g.daoSuppressed = false; return;
    }
    var guard = 0;
    while (guard++ < 500) {
      if (g.worldEmperor) {
        if (g.worldEmperor.end > target) break;
        var ended = g.worldEmperor;
        recordWorldEvent(g, ended.end, ended.name + '坐化，帝道烙印仍镇压万道');
        if (log) push(log, { cls: 'rare', text: '万古历' + ended.end + '年，' + ended.name + '坐化；帝痕未散，万道仍被压制' });
        g.worldEmperor = null;
        markDaoTraces(g, ended.end);
      } else {
        var earliest = rivalEmperorEarliestYear(g);
        if (g.nextWorldEmperorYear != null && g.nextWorldEmperorYear < earliest) g.nextWorldEmperorYear = earliest;
        if (g.nextWorldEmperorYear == null && !g.becameEmperor && target >= earliest) {
          var from = Math.max((g.worldYear || 0) + 1, earliest);
          var span = target - from + 1;
          if (span > 0 && Math.random() < 1 - Math.pow(1 - (D.WORLD_RIVAL_EMPEROR_YEARLY || 0), span)) {
            g.nextWorldEmperorYear = span <= 1 ? from : from + irand(0, span - 1);
          }
        }
        if (g.nextWorldEmperorYear == null || g.nextWorldEmperorYear > target) break;
        var start = g.nextWorldEmperorYear;
        createWorldEmperor(g, start);
        g.nextWorldEmperorYear = null;
        if (log) push(log, { cls: 'ev4', text: '万古历' + start + '年，宇宙中另一位修士证道成帝，天心自此有主' });
      }
    }
    g.worldYear = target;
    refreshDaoSuppression(g);
  }

  /* 抽取体质：玩家等级 lv 奖励：高阶体质（6-10）整体概率 +lv×0.1 个百分点 */
  function drawTalent(playerLv) {
    var lv = Math.max(0, playerLv || 0);
    var base = D.INNATE_WEIGHTS;
    var s15 = 0, s610 = 0, i;
    for (i = 1; i <= 5; i++) s15 += base[i];
    for (i = 6; i <= 10; i++) s610 += base[i];
    var pOld = s610 / (s15 + s610);
    var pNew = pOld + lv * 0.001 + _followBonus / 100 + _achBonus / 100;
    var x610 = (s15 * pNew) / (1 - pNew);
    var w = base.slice();
    for (i = 6; i <= 10; i++) w[i] = base[i] * (x610 / s610);
    var total = 0; for (i = 1; i <= 10; i++) total += w[i];
    var r = Math.random() * total, acc = 0, innate = 1;
    for (i = 1; i <= 10; i++) { acc += w[i]; if (r < acc) { innate = i; break; } }
    var physique = pickPhysique(innate);
    return { innate: innate, talent: physique ? physique.name : D.talentOf(innate), physique: physique };
  }

  function daoGiftName(tier) {
    return (D.DAO_GIFT_NAMES && D.DAO_GIFT_NAMES[tier]) || '寻常';
  }
  function daoGiftDaoyun(tier) {
    /* 悟性是独立出生属性：档位只是概率与保底，实际道蕴仍会再随机。
     * 极少数天纵异数出生便有千级道蕴，万古唯一者甚至可能直接触及大道极限。 */
    return [0, 8, 16, 28, 45, 70, 105, 160, 240, 360, 1000][tier] || 16;
  }
  function daoGiftCap(tier) {
    return [0, 480, 560, 680, 820, 1000, 1250, 1550, 1900, 2350, 3000][tier] || 560;
  }
  function daoGiftInitialDaoyun(tier) {
    var base = daoGiftDaoyun(tier);
    if (tier >= 10) {
      if (Math.random() < 0.04) return D.DAO_ABSOLUTE_MAX;
      return irand(1000, 2200);
    }
    if (tier >= 9 && Math.random() < 0.08) return irand(1000, 1800);
    return base;
  }
  function drawDaoGift() {
    var w = D.DAO_GIFT_WEIGHTS || D.INNATE_WEIGHTS;
    var total = 0, i;
    for (i = 1; i <= 10; i++) total += w[i] || 0;
    var r = Math.random() * total, acc = 0, tier = 2;
    for (i = 1; i <= 10; i++) { acc += w[i] || 0; if (r < acc) { tier = i; break; } }
    return { tier: tier, name: daoGiftName(tier), initialDaoyun: daoGiftInitialDaoyun(tier) };
  }

  /* ---------- 突破年数表 ---------- */
  function breakChance(aptitude, lvl) {
    var seg;
    if (lvl >= 99) seg = 11;
    else if (lvl >= 96) seg = 10;
    else if (lvl >= 91) seg = 9;
    else if (lvl >= 81) seg = 8;
    else if (lvl >= 71) seg = 7;
    else if (lvl >= 61) seg = 6;
    else if (lvl >= 51) seg = 5;
    else if (lvl >= 41) seg = 4;
    else if (lvl >= 31) seg = 3;
    else if (lvl >= 21) seg = 2;
    else if (lvl >= 11) seg = 1;
    else seg = 0;
    var years = D.BREAK_CHANCE[aptitude - 1][seg];
    return 1 / years;
  }
  function breakAgeCoef(g) {
    if (g.age <= 12) return 1.2;
    if (g.age <= 18) return 1.1;
    if (g.age > g.lifespan * 0.8) return 0.9;
    return 1.0;
  }
  function quasiLayerMultiplier(g, lvl) {
    if (lvl < 91 || lvl > 98) return 1;
    var table = g && isPeakPhysique(g.physiqueId) ? D.QUASI_CHAOS_MULT : D.QUASI_LAYER_MULT;
    var m = table[lvl - 91] || 1;
    return Math.max(1, m * (1 - quasiDaoRelief(g)));
  }
  function attemptBreak(g) {
    if (g.lvl >= 100) return 0;
    if (!canAdvance(g)) return 0;
    var coef = breakAgeCoef(g) * artBreakMult(g);
    var base = breakChance(breakAptitude(g, g.lvl), g.lvl) * coef * pval(g, 'brk', 1) *
      daoBreakFactor(g) / quasiLayerMultiplier(g, g.lvl);
    if (base <= 0.25 + 1e-9) {
      return Math.random() < base ? 1 : 0;
    }
    var gained = 0, step = 0;
    while (true) {
      var lvl = g.lvl + gained;
      if (lvl >= 100) break;
      var b = breakChance(breakAptitude(g, lvl), lvl) * coef * pval(g, 'brk', 1) *
        daoBreakFactor(g, lvl) / quasiLayerMultiplier(g, lvl);
      if (b <= 0.25 + 1e-9) break;
      var p = b * Math.pow(0.6, step);
      if (p <= 0.25 + 1e-9) break;
      if (Math.random() < p) { gained++; step++; }
      else break;
    }
    return gained;
  }

  /* ---------- 突破实力收益 ----------
   * 旧式两个乘子量级完全不对等：体质跨度 ×22（CULT_COEF 1→22），悟性跨度只有 ×1.17，
   * 体质的影响力是悟性的 18.8 倍，而且这个比例从轮海到准帝恒定不变。
   * 后果是实测出来的悟性越高战力反而越低——高悟性破境快、活得短、撞的机缘少，
   * 而 cultGain 按次结算，速度优势直接变成了战力劣势，悟道流成了全游戏最弱。
   *
   * 改成两条随境界此消彼长的曲线：
   *   体质——前期就是一切，后期只剩底子（衰减到两成二）。血脉再强也压不住万古道理。
   *   悟性——前期几乎无感，后期指数放大（指数 0.3 爬到 3.0）。悟道者靠的是把道吃透。
   * 交叉点大约在准帝前后，正好是「体质越到后期越薄弱」该发生的地方。 */
  var PHYS_FADE_END = 0.18;   /* 准帝九重时体质系数还剩多少 */
  var DAO_EXP_MIN = 0.3, DAO_EXP_MAX = 3.4;
  function physFactor(aptitude, lvl) {
    var t = clamp(((lvl || 1) - 1) / 98, 0, 1);
    var fade = 1 - (1 - PHYS_FADE_END) * t;
    return 1 + ((D.CULT_COEF[aptitude] || 1) - 1) * fade;
  }
  function daoFactor(gift, lvl) {
    var t = clamp(((lvl || 1) - 1) / 98, 0, 1);
    return Math.pow((gift || 5) / 5, DAO_EXP_MIN + (DAO_EXP_MAX - DAO_EXP_MIN) * t);
  }
  function cultGain(aptitude, newLvl, g) {
    var gift = g && g.daoGift ? g.daoGift : 5;
    var c = physFactor(aptitude, newLvl) * daoFactor(gift, newLvl);
    c *= artCultMult(g);
    if (newLvl >= 100) return round(c * (newLvl * 1.2 + rand(-200, 200) + 200));
    if (newLvl >= 91 && newLvl <= 99) return round(c * (newLvl * 0.6 + rand(-newLvl * 0.4, newLvl * 0.4) + 20));
    return round(c * (newLvl * 0.6 + rand(-newLvl * 0.4, newLvl * 0.4) + 6));
  }
  /* 当前境界寿元上限带（含出生凡人无境界段） */
  function realmBand(lvl) {
    if (lvl < 1) lvl = 1;
    var r = D.realmIdx(lvl);
    return r >= 1 && r <= 10 ? D.REALM_LIFE[r] : null;
  }
  /* 事件加寿元：不可越过本境上限带（词条额外寿元 lifeBonus 不计入上限） */
  function gainLife(g, lo, hi) {
    var band = realmBand(g.lvl);
    if (!band) return 0;
    var want = irand(lo, hi);
    if (g.lifeBase >= band[1]) return 0;
    var add = Math.min(want, band[1] - g.lifeBase);
    g.lifeBase += add;
    syncLife(g);
    return add;
  }
  /* 直接减少寿元（惩罚；词条额外寿元不扣） */
  function subLife(g, n) {
    if (n <= 0) return 0;
    var take = Math.min(g.lifeBase, Math.round(n));
    g.lifeBase -= take;
    if (g.lifeBase < 1) g.lifeBase = 1;
    syncLife(g);
    return take;
  }
  function syncLife(g) { g.lifespan = g.lifeBase + g.lifeBonus + pval(g, 'life', 0); }

  /* 境界寿元补足：跨入大境界时 base 补至 rand(带下限,带上限)；寿元若已高于该值则不补 */
  function realmLifeRefill(g) {
    var band = realmBand(g.lvl);
    if (!band) return 0;
    var target = irand(band[0], band[1]);
    if (g.lifeBase < target) { g.lifeBase = target; syncLife(g); }
    return g.lifespan;
  }

  /* ---------- 升级：升 1 层；跨大境界补足寿元上限；准帝巅峰后参悟己身大道，实力+10000×成长倍率 ---------- */
  function levelUp(g, log) {
    if (g.lvl >= 100) {
      var a2 = round(10000 * pval(g, 'cgt', 1) * artCultMult(g));
      g.cult += a2;
      if (log) log.push({ cls: 'brk', text: '准帝巅峰圆满，' +
        (isHighDaoyun(g) ? insightPrefix(g) : '参悟己身大道，') + '实力+' + a2 });
      return;
    }
    var nl = g.lvl + 1;
    var cg = round(cultGain(g.aptitude, nl, g) * pval(g, 'cgt', 1));
    g.lvl = nl; g.cult += cg;
    markRealmEnter(g);
    var title = D.titleOf(nl);
    var lifeTail = '';
    if (nl > 1 && nl % 10 === 1) {
      var newLife = realmLifeRefill(g);
      lifeTail = '，寿元焕发，命限延展至' + newLife + '岁';
    }
    if (log && log.length) {
      var last = log[log.length - 1];
      if (last && last.cls === 'brk' && last.brkTitle === title) {
        last.brkCult = (last.brkCult || 0) + cg;
        last.brkLvls = (last.brkLvls || 1) + 1;
        if (lifeTail) last.brkLife = lifeTail;
        last.text = '连破数关，突破至' + title + '！实力+' + last.brkCult + (last.brkLife || '');
        if (isHuangguSacred(g) && nl >= 99) completeSacredBody(g, log);
        return;
      }
    }
    var daoLine = insightPrefix(g);
    if (log) {
      log.push({
        cls: 'brk', brkTitle: title, brkCult: cg, brkLvls: 1, brkLife: lifeTail,
        text: daoLine + '突破至' + title + '！实力+' + cg + lifeTail
      });
    }
    if (isHuangguSacred(g) && nl >= 99) completeSacredBody(g, log);
  }
  /* 事件连升 n 层（逐层一行） */
  function gainLevels(g, n, log) {
    var up = 0;
    for (var k = 0; k < n; k++) {
      if (!canAdvance(g)) break;
      levelUp(g, log); up++;
    }
    return up;
  }

  function remainingLife(g) {
    return Math.max(1, ((g && g.lifespan) || 0) - ((g && g.age) || 0));
  }
  /* 伤势看事件轻重。路边轻伤跟事件写的岁数走，传说/致命才按余寿切。 */
  var DAO_PAY_TAGS = {
    dao: 1, create: 1, insight: 1, daomark: 1, daoheart: 1, mortal_dao: 1, scripture: 1
  };
  function eventPaysDao(ev) {
    if (!ev) return false;
    if (ev.dao === false) return false;
    if (ev.dao === true) return true;
    if (typeof ev.dao === 'number' && ev.dao > 0) return true;
    if (DAO_PAY_TAGS[ev.tag]) return true;
    if (ev.id && String(ev.id).indexOf('dao_') === 0) return true;
    return false;
  }
  function clampEventDao(ev, amount, capAdd) {
    var tier = (ev && ev.tier) || 1;
    var amt = Math.max(0, Math.round(amount || 0));
    var cap = Math.max(0, Math.round(capAdd || 0));
    if (ev && typeof ev.dao === 'number' && ev.dao > 0) amt = Math.min(amt, ev.dao);
    if (tier <= 1) return { amount: 0, capAdd: 0 };
    if (tier === 2) return { amount: Math.min(amt, 6), capAdd: 0 };
    if (tier === 3) return { amount: Math.min(amt, 40), capAdd: 0 };
    return { amount: Math.min(amt, 70), capAdd: Math.min(cap, 32) };
  }
  function grantCreateDao(g, tier) {
    var amt, cap;
    if (tier >= 4) { amt = irand(48, 80); cap = irand(16, 28); }
    else if (tier === 3) { amt = irand(32, 56); cap = irand(8, 16); }
    else { amt = irand(18, 36); cap = 0; }
    return gainDaoyun(g, amt, cap);
  }
  function payEventDao(g, amount, capAdd) {
    var ev = _curEv && _curEv.ev;
    if (!ev) return gainDaoyun(g, amount, capAdd);
    if (!eventPaysDao(ev)) return 0;
    var c = clampEventDao(ev, amount, capAdd);
    if (!(c.amount > 0)) return 0;
    return gainDaoyun(g, c.amount, c.capAdd);
  }
  function eventHurtSeverity(ev, chosen) {
    if (chosen && chosen.risk === 'deadly') return 'grave';
    if (ev && ev.hurt) return ev.hurt;
    var tier = (ev && ev.tier) || 1;
    if (tier >= 4) return 'heavy';
    if (tier >= 3) return 'medium';
    return 'light';
  }
  function lifeHurtShare(g, severity) {
    var band = D.realmIdx((g && g.lvl) || 1);
    if (band < 1) band = 1;
    if (band > 10) band = 10;
    /* 按剩余命限切。准帝轻伤约 6.5%，中等约 10%，传说约 14%，致命约 18%。 */
    if (severity === 'grave') return 0.055 + band * 0.013;
    if (severity === 'heavy') return 0.040 + band * 0.010;
    if (severity === 'medium') return 0.028 + band * 0.007;
    return 0.018 + band * 0.0045;
  }
  function applyLifeHurt(g, lo, hi, opt) {
    opt = opt || {};
    var ward = rand(0.10, 0.30) + (g.tm.ward + pval(g, 'ward', 0) + artWard(g)) / 100;
    if (opt.noExempt) ward = 0.06;
    if (Math.random() < ward) return { exempt: true, loss: 0 };
    var ev = (_curEv && _curEv.ev) || null;
    var sev = opt.severity || eventHurtSeverity(ev, null);
    var room = remainingLife(g);
    var share = opt.share != null ? opt.share : lifeHurtShare(g, sev);
    var byShare = Math.max(1, Math.round(room * share));
    var band = D.realmIdx((g && g.lvl) || 1);
    if (band < 1) band = 1;
    var scale = 1 + Math.max(0, band - 2) * 0.12;
    var loN = Math.max(0, lo || 0);
    var hiN = Math.max(loN, hi || loN);
    var writeLo = Math.max(1, Math.round((loN || 8) * scale));
    var writeHi = Math.max(writeLo, Math.round((hiN || 24) * scale));
    var floor = Math.round(byShare * (sev === 'light' ? 0.70 : 0.75));
    var wanted = irand(Math.max(floor, writeLo), Math.max(byShare, writeHi));
    wanted = Math.max(wanted, writeLo);
    if (sev === 'light' || sev === 'medium') wanted = Math.min(wanted, Math.max(byShare, writeHi));
    if (!g.swallowingArt) wanted = Math.min(wanted, Math.max(0, room - 1));
    var loss = subLife(g, wanted);
    return { exempt: false, loss: loss };
  }

  /* 事件工具对象（注入给 events.js） */
  var U = {
    rand: rand, irand: irand, round: round, clamp: clamp,
    data: D, DATA: D,
    cultGain: cultGain, breakChance: breakChance,
    apt: function (g, n) {
      if (g.aptitude >= 10) return 0;
      var inc = Math.min(n, 10 - g.aptitude);
      g.aptitude += inc; return inc;
    },
    gainLife: function (g, lo, hi) { return gainLife(g, lo, hi); },
    gainDao: function (g, amount, capAdd) { return payEventDao(g, amount, capAdd); },
    effectiveDaoyunNeed: effectiveDaoyunNeed,
    grantCreateDao: grantCreateDao,
    daoByCap: daoByCap,
    eventPaysDao: eventPaysDao,
    isHighDaoyun: isHighDaoyun,
    hurt: function (g, lo, hi) {
      return applyLifeHurt(g, lo, hi, null);
    },
    kill: function (g, text) { g.dead = true; g.deadCause = 'event'; if (text) printlog(text); },
    up: function (g, n, log) { return gainLevels(g, n, log); },
    cultPct: function (g, minPct, maxPct, floor) {
      var v = g.cult * rand(minPct, maxPct);
      if (v < (floor || 0)) v = floor || 0;
      v = round(v * pval(g, 'cgt', 1) * artCultMult(g));
      g.cult += v;
      return v;
    },
    drawHighTalent: drawHighTalent,
    sacredEmperorChance: sacredEmperorChance,
    completeSacredBody: completeSacredBody,
    printlog: printlog,
    /* 创法 */
    artTypes: function () { return ART_TYPES; },
    artType: artType,
    availableArtTypes: availableArtTypes,
    createArtChance: createArtChance,
    createArtDeathChance: createArtDeathChance,
    addCreatedArt: addCreatedArt,
    artCount: artCount,
    artSummary: artSummary,
    latestArt: latestArt,
    artName: artName,
    /* 梭哈三档与凸收益 */
    deathOdds: allInDeathOdds,
    allIn: allInOutcome,
    payoff: allInPayoff,
    allInFloor: allInFloor,
    deathShare: allInDeathShare,
    powerSurge: function (g, mult, log) { return powerSurge(g, mult, log); },
    realmCultCap: realmCultCap,
    surgeOf: allInPowerSurge,
    surgeLine: surgeLine,
    zhengdaoEdge: function (g, mult) { return grantZhengdaoEdge(g, mult); },
    /* 重伤档只准扣寿元：寿元对结局几乎没有影响（实测 +3000 无效），
     * 用它当代价既有痛感又不毁局；而重伤占 40%~60% 的概率权重，
     * 一旦让它吃掉战力或道蕴，整个梭哈的期望会被这一档拖到水下。 */
    woundOnly: function (g, lo, hi) { return U.hurt(g, lo, hi); },
    boost: boostedU,
    /* 创法共鸣 */
    artResonance: artResonance,
    artResonanceLevel: artResonanceLevel,
    daoFill: daoFill,
    artDefiantResonance: artDefiantResonance,
    isDefiantArt: isDefiantArt,
    /* 停屏高光 */
    spotlight: spotlight,
    highlight: function (g, log, opt) { return highlightLast(g, log, opt); },
    /* 选择与展示 */
    pct: pctText,
    currentCombatPower: function (g) { return currentCombatPower(g); },
    push: function (log, obj) { push(log, obj); },
    trySwallowPhysique: trySwallowPhysique,
    nextSwallowTarget: nextSwallowTarget,
    swallowProgress: swallowProgress,
    swallowSiegeDeathChance: swallowSiegeDeathChance,
    swallowSiegeSurviveChance: swallowSiegeSurviveChance,
    isReverseCutPath: isReverseCutPath,
    noRealmBottleneck: noRealmBottleneck,
    cutDaoChance: cutDaoChance,
    enterSaintChance: enterSaintChance,
    rekindleCutDao: rekindleCutDao,
    rekindleEnterSaint: rekindleEnterSaint,
    cutWasClose: cutWasClose,
    markStory: markStory,
    hasStory: hasStory,
    clearStory: clearStory
  };
  /* 体质异变：按体质 7-10 权重抽取，替换先天体质/资质 */
  function drawHighTalent(g) {
    var wsum = 0, i;
    for (i = 7; i <= 10; i++) wsum += D.INNATE_WEIGHTS[i];
    var r = Math.random() * wsum, acc = 0, ni = 7;
    for (i = 7; i <= 10; i++) { acc += D.INNATE_WEIGHTS[i]; if (r < acc) { ni = i; break; } }
    var physique = pickAcquiredPhysique(ni);
    setPhysique(g, physique);
    g.gotYibian = true;
    return { innate: ni, talent: physique ? physique.name : D.talentOf(ni) };
  }

  var _curEv = null;
  function printlog(text) {
    if (!_curEv || !_curEv.log) return;
    var prefix = '第' + _curEv.g.age + '岁，遇到' + _curEv.ev.name + '，';
    var log = _curEv.log;
    if (_curEv.printed && log.length) {
      var last = log[log.length - 1];
      if (last && last.text && last.text.indexOf(prefix) === 0) {
        last.text += '；' + text;
        return;
      }
    }
    _curEv.printed = true;
    log.push({ cls: 'ev' + _curEv.ev.tier, text: prefix + text });
  }

  /* ---------- 高光时刻 ----------
   * 大机缘刷过去就没了，玩家根本来不及看清自己爽在哪。带 spotlight 的日志
   * 会让界面停下来单独弹一张卡，必须由玩家点掉才继续往下走年份。
   * 只给真正的转折用：梭哈成功、传说机缘、自创法、证道成帝这一类。 */
  function spotlight(text, opt) {
    if (!_curEv || !_curEv.log) return;
    opt = opt || {};
    printlog(text);
    highlightLast(_curEv.g, _curEv.log, opt);
  }

  /* 把日志里最后一条升格为停屏高光。预算按事件数的比例算而不是绝对次数：
   * 混沌体一局只有约 10 次事件，给绝对次数会被弹窗淹没；
   * 凡体/悟性5 一局近 39 次事件，给绝对次数又太吝啬。 */
  var SPOTLIGHT_RATE = 0.12, SPOTLIGHT_MIN = 2;
  function spotlightBudget(g) {
    return Math.max(SPOTLIGHT_MIN, Math.ceil((g.eventDraws || 0) * SPOTLIGHT_RATE));
  }
  function canSpotlight(g) {
    if (!g || _fast || _autoChoice) return false;   /* 快速模式与批量模拟一律不停屏 */
    return (g.spotlightCount || 0) < spotlightBudget(g);
  }
  function highlightLast(g, log, opt) {
    if (!log || !log.length) return false;
    var last = log[log.length - 1];
    last.cls = opt.cls || 'rainbow';
    if (!canSpotlight(g)) return false;             /* 超预算就只保留高亮，不再打断 */
    g.spotlightCount = (g.spotlightCount || 0) + 1;
    last.spotlight = {
      title: opt.title || (_curEv && _curEv.ev && _curEv.ev.name) || '机缘',
      kind: opt.kind || 'fortune',
      note: opt.note || null
    };
    return true;
  }

  /* ---------- 词条聚合：createGame 时把选中的词条效果合并到 g.tm ---------- */
  function resolveTraitResonance(g) {
    var paths = [];
    for (var i = 0; i < g.traits.length; i++) {
      var trait = D.traitById(g.traits[i]);
      if (trait && trait.path) paths.push(trait.path);
    }
    g.traitPaths = paths;
    g.resonance = paths.length === 2 && paths[0] === paths[1] ? paths[0] : null;
    if (g.resonance === 'imperial') g.tm.retry = Math.max(1, g.tm.retry);
    return g.resonance;
  }

  function applyTraits(g, ids) {
    g.traits = ids || [];
    g.tm = {
      evf: 1, evt: 1, xin: 1, ward: 0, zhx: 0, dlm: 0, daog: 1, era: 1, retry: 0, latePower: 0,
      retryKeep: 0, bodyChance: 0, bodyDao: 0, overflow: 0, upgradeEvent: 0,
      xinPity: 0, ignoreSuppression: 0
    };
    var floorMax = 0, daoAdd = 0, daoCapAdd = 0;
    for (var i = 0; i < g.traits.length; i++) {
      var t = D.traitById(g.traits[i]);
      if (!t) continue;
      for (var j = 0; j < t.fx.length; j++) {
        var ty = t.fx[j][0], v = t.fx[j][1];
        if (ty === 'life') {
          g.lifeBonus += v;
          g.longevityTraitBonus = (g.longevityTraitBonus || 0) + v;
          /* 高寿元命格同时意味着晚年血气更稳；按放大后的“年”数值缩放，避免一张白卡直接吃满上限。 */
          g.tm.latePower = Math.min(0.22, g.tm.latePower + v / 20000);
        }
        else if (ty === 'floor') { if (v > floorMax) floorMax = v; }
        else if (ty === 'evf') g.tm.evf *= v;
        else if (ty === 'evt') g.tm.evt *= v;
        else if (ty === 'xin') g.tm.xin *= v;
        else if (ty === 'ward') g.tm.ward += v;
        else if (ty === 'zhx') g.tm.zhx += v;
        else if (ty === 'dlm') g.tm.dlm += v;
        else if (ty === 'dao') daoAdd += v;
        else if (ty === 'daog') g.tm.daog *= v;
        else if (ty === 'daocap') daoCapAdd += v;
        else if (ty === 'era') g.tm.era *= v;
        else if (ty === 'swallow') g.swallowingArt = true;
        else if (ty === 'retry') g.tm.retry = Math.min(1, g.tm.retry + v);
        else if (ty === 'retryKeep') g.tm.retryKeep = Math.min(1, g.tm.retryKeep + v);
        else if (ty === 'bodyChance') g.tm.bodyChance += v;
        else if (ty === 'bodyDao') g.tm.bodyDao += v;
        else if (ty === 'overflow') g.tm.overflow = Math.max(g.tm.overflow, v);
        else if (ty === 'upgradeEvent') g.tm.upgradeEvent = 1;
        else if (ty === 'xinPity') g.tm.xinPity += v;
        else if (ty === 'ignoreSuppression') g.tm.ignoreSuppression = Math.min(1, g.tm.ignoreSuppression + v);
      }
    }
    resolveTraitResonance(g);
    /* 体质保底只抬升先天品阶，不再根据命格稀有度附送隐藏体质。 */
    var oldInnate = g.innate;
    var targetInnate = Math.max(g.innate, floorMax);
    if (targetInnate > oldInnate) setPhysique(g, pickAcquiredPhysique(targetInnate));
    g.innate = targetInnate;
    g.aptitude = Math.max(g.aptitude, targetInnate);
    g.daoyunCap = Math.min(D.DAO_ABSOLUTE_MAX, g.daoyunCap + daoCapAdd);
    g.daoyun += daoAdd;
    g.daoyun = Math.min(g.daoyun, g.daoyunCap);
    /* 悟性卡必须真的抬悟性档，不能只堆道蕴数字。金+3 / 紫+2 / 蓝+1，白卡只铺垫不改档。 */
    var giftAdd = 0;
    for (i = 0; i < g.traits.length; i++) {
      t = D.traitById(g.traits[i]);
      if (!t || t.path !== 'dao') continue;
      if (t.color === 'o') giftAdd += 3;
      else if (t.color === 'p') giftAdd += 2;
      else if (t.color === 'b') giftAdd += 1;
    }
    if (giftAdd) {
      g.daoGift = clamp((g.daoGift || 5) + giftAdd, 1, 10);
      g.daoGiftName = daoGiftName(g.daoGift);
    }
    if (g.swallowingArt) initSwallowState(g);
    syncLife(g);
  }

  /* 随机抽取词条：先按 data.js 的颜色权重抽颜色（白/蓝/紫/金，默认 70/25/4/1），再在该色池随机抽一张；
   * 抽到重复则在该色池继续抽，保证同一局不重复 */
  var COLOR_ORDER = ['w', 'b', 'p', 'o'];
  function drawTraits(count) {
    count = count || 5;
    var W = D.TRAIT_WEIGHT || { w: 70, b: 25, p: 4, o: 1 };
    var total = 0, ci;
    for (ci = 0; ci < COLOR_ORDER.length; ci++) total += (W[COLOR_ORDER[ci]] || 0);
    var used = {}, out = [], guard = 0;
    while (out.length < count && guard++ < 500) {
      var r = Math.random() * total, acc = 0, color = 'w';
      for (ci = 0; ci < COLOR_ORDER.length; ci++) { acc += (W[COLOR_ORDER[ci]] || 0); if (r < acc) { color = COLOR_ORDER[ci]; break; } }
      var pool = [];
      for (var i = 0; i < D.TRAITS.length; i++) {
        var t = D.TRAITS[i];
        if (t.color === color && !used[t.id]) pool.push(t);
      }
      if (!pool.length) continue;   /* 该色已抽空则换下一张（防死循环） */
      var pw = 0, pi;
      for (pi = 0; pi < pool.length; pi++) {
        pw += pool[pi].path === 'dao' ? 2.6 : (pool[pi].path === 'body' ? 1.2 : 1);
      }
      var pr = Math.random() * pw, pacc = 0, it = pool[0];
      for (pi = 0; pi < pool.length; pi++) {
        pacc += pool[pi].path === 'dao' ? 2.6 : (pool[pi].path === 'body' ? 1.2 : 1);
        if (pr < pacc) { it = pool[pi]; break; }
      }
      used[it.id] = 1; out.push(it);
    }
    var hasDao = false;
    for (ci = 0; ci < out.length; ci++) if (out[ci].path === 'dao') { hasDao = true; break; }
    if (!hasDao && out.length) {
      var daoPool = [];
      for (i = 0; i < D.TRAITS.length; i++) {
        if (D.TRAITS[i].path === 'dao' && !used[D.TRAITS[i].id]) daoPool.push(D.TRAITS[i]);
      }
      if (daoPool.length) out[out.length - 1] = daoPool[Math.floor(Math.random() * daoPool.length)];
    }
    return out;
  }

  function tryBodyEvolution(g, log) {
    if (!g.resonanceState || g.resonanceState.bodyUsed || g.lvl < 71 || g.innate >= 9) return false;
    var need = Math.max(60, 130 - (g.tm.bodyDao || 0));
    if (g.daoyun < need) return false;
    g.resonanceState.bodyUsed = true;
    var chance = Math.min(1, (g.tm.bodyChance || 0) + (g.resonance === 'body' ? 0.08 : 0));
    if (Math.random() >= chance) return false;
    var before = g.physiqueName;
    setPhysique(g, pickAcquiredPhysique(Math.min(9, g.innate + 1)));
    push(log, { cls: 'rainbow', text: '第' + g.age + '岁，百炼凡躯终破先天桎梏，『' + before + '』蜕变为『' + g.physiqueName + '』！' });
    return true;
  }

  function eventDaoyunTier(g, tier) {
    if (!g.resonanceState || g.resonanceState.eventUpgraded || tier < 1 || tier > 2) return tier;
    if (g.resonance !== 'fortune' && !g.tm.upgradeEvent) return tier;
    g.resonanceState.eventUpgraded = true;
    return tier + 1;
  }

  function tianxinChance(g) {
    var talent = (D.XINTIAN_TALENT_MULT && D.XINTIAN_TALENT_MULT[g.innate]) || 1;
    return D.XINTIAN_CHANCE * g.tm.xin * pval(g, 'xin', 1) * talent +
      ((g.resonanceState && g.resonanceState.tianxinPity) || 0);
  }
  function tianxinPityGain(g) {
    return (g.tm.xinPity || 0) + Math.max(0, (g.tm.xin || 1) - 1) * 0.00002;
  }

  function physiqueFamily(g) {
    var id = g && g.physiqueId;
    if (id === 'chaos' || id === 'innate_sacred_dao') return 'peak';
    if (id === 'sacred' || id === 'origin_sacred') return 'sacred';
    if (id === 'overlord') return 'overlord';
    if (id === 'solar' || id === 'lunar' || id === 'jiuyou') return 'celestial';
    if (id === 'mortal') return 'mortal';
    if (g && (g.innate || 1) <= 5) return 'common';
    return 'rare';
  }
  function eventFits(g, ev) {
    if (!g || !ev) return true;
    if (ev.needPhys) {
      var list = ev.needPhys;
      if (typeof list === 'string') list = [list];
      var hit = false, i;
      for (i = 0; i < list.length; i++) if (list[i] === g.physiqueId) hit = true;
      if (!hit) return false;
    }
    if (ev.needFamily && physiqueFamily(g) !== ev.needFamily) return false;
    var dao = g.daoGift != null ? g.daoGift : 5;
    var inn = g.innate != null ? g.innate : 1;
    if (ev.daoMin != null && dao < ev.daoMin) return false;
    if (ev.daoMax != null && dao > ev.daoMax) return false;
    if (ev.innateMin != null && inn < ev.innateMin) return false;
    if (ev.innateMax != null && inn > ev.innateMax) return false;
    return true;
  }
  function eventExclusive(ev) {
    return !!(ev && (ev.needPhys || ev.needFamily || ev.daoMin != null ||
      ev.daoMax != null || ev.innateMin != null || ev.innateMax != null));
  }
  function markStory(g, key) {
    if (!g || !key) return false;
    g.eventChains = g.eventChains || {};
    g.eventChains[key] = true;
    return true;
  }
  function hasStory(g, key) {
    return !!(g && g.eventChains && key && g.eventChains[key]);
  }
  function clearStory(g, key) {
    if (!g || !g.eventChains || !key) return false;
    if (!g.eventChains[key]) return false;
    delete g.eventChains[key];
    return true;
  }
  function eventAvailable(g, ev) {
    if (!ev) return true;
    if (ev.needStory && !hasStory(g, ev.needStory)) return false;
    if (ev.available && !ev.available(g, U)) return false;
    return eventFits(g, ev);
  }

  /* ---------- 去重复：最近出现过的事件与同标签事件临时降权 ---------- */
  var RECENT_KEEP = 12;
  function eventRecent(g) {
    if (!g.recentEvents) g.recentEvents = [];
    return g.recentEvents;
  }
  function markEventSeen(g, ev) {
    var recent = eventRecent(g);
    recent.push({ id: ev.id, tag: ev.tag || null });
    while (recent.length > RECENT_KEEP) recent.shift();
    markRealmSeen(g, ev);
  }
  function syncRealmSeen(g) {
    if (!g) return;
    var band = D.realmIdx(g.lvl);
    if (g.realmSeenBand !== band) {
      g.realmSeenBand = band;
      g.realmSeenIds = {};
      g.realmSeenTags = {};
    }
    if (!g.realmSeenIds) g.realmSeenIds = {};
    if (!g.realmSeenTags) g.realmSeenTags = {};
  }
  function markRealmSeen(g, ev) {
    if (!g || !ev) return;
    syncRealmSeen(g);
    g.realmSeenIds[ev.id] = 1;
    if (ev.tag) g.realmSeenTags[ev.tag] = 1;
  }
  function eventFreshness(g, ev) {
    var recent = eventRecent(g), i, f = 1;
    for (i = 0; i < recent.length; i++) {
      var age = recent.length - i;           /* 1 = 最近一次 */
      if (recent[i].id === ev.id) f *= clamp(0.12 + age * 0.075, 0.12, 1);
      else if (ev.tag && recent[i].tag === ev.tag) f *= clamp(0.45 + age * 0.05, 0.45, 1);
    }
    return f;
  }

  /* 近 6 次同一故事族最多 1 次。软降权挡不住低阶秘境和招婿把开局吃满。 */
  var TAG_HARD_WINDOW = 6;
  function eventTagBlocked(g, ev) {
    if (!g || !ev) return false;
    var recent = eventRecent(g);
    var start = Math.max(0, recent.length - TAG_HARD_WINDOW);
    var i;
    for (i = start; i < recent.length; i++) {
      if (ev.tag && recent[i].tag === ev.tag) return true;
      if (!ev.tag && recent[i].id === ev.id) return true;
    }
    return false;
  }

  /* 抉择事件不再整体抬权：人生包几乎全是选择题，再乘 3 会把一辈子变成点作业。
   * 路边琐事自行落幕，只有值得停的才弹窗。 */
  var CHOICE_EVENT_WEIGHT = 1.15;
  var T1_AFTER_DAOGONG = 0.15;

  function eventDrawWeight(g, ev) {
    var w = (ev.weight != null ? ev.weight : 1);
    if (ev.tier >= 3) w *= g.tm.evt * pval(g, 'evt', 1) * ((g.era && g.era.evt) || 1);
    if (ev.choice) w *= CHOICE_EVENT_WEIGHT;
    w *= eventFreshness(g, ev);
    /* 道宫之后采药/切磋/静坐不再当主菜，把位置让给真正的故事族 */
    if (ev.tier <= 1 && (g.lvl || 1) >= 21) w *= T1_AFTER_DAOGONG;
    /* 四极前把猎杀/静坐压下去，把位置让给人生包，否则前期抽中的全是同一套修炼琐事 */
    if ((g.lvl || 1) < 21 && ev.tier <= 1 && !ev.choice) w *= 0.28;
    if ((g.lvl || 1) < 41 && ev.id && String(ev.id).indexOf('lf_') === 0) {
      w *= ev.tier >= 3 ? 1.15 : 0.55;
    }
    if (isSmallEvent(ev)) w *= smallEventPhysiqueScale(g);
    if (isStakeEvent(ev)) w *= 1.55;
    w *= eventAttrWeight(g, ev);
    /* 悟性极高：创法、自创吞天进奖池的机会明显更大 */
    if (ev.tag === 'create' || ev.id === 'dao_create_swallowing') {
      var gift = (g && g.daoGift) || 5;
      if (gift >= 8) w *= 2.4 + Math.min(1.6, (gift - 8) * 0.4);
      if (ev.id === 'dao_create_swallowing') w *= gift >= 8 ? 2.2 : 0.55;
    }
    if ((g.lvl || 1) >= 91 && ev.tier >= 4) w *= 2.4;
    /* 对得上体质/悟性的专属事件抬权，让两局人生岔开，而不是所有人抽同一套 */
    if (eventExclusive(ev)) w *= 2.4;
    if (ev.needStory && hasStory(g, ev.needStory)) w *= 3.6;
    return w;
  }

  /* ---------- 抽 1 个随机事件执行 ---------- */
  function collectAvailableEvents(g, choiceOnly) {
    var raw = [], i, mc = g.maxCount || (g.maxCount = {});
    syncRealmSeen(g);
    for (i = 0; i < E.length; i++) {
      var evi = E[i];
      if (choiceOnly && !evi.choice) continue;
      var maxN = evi.maxCount != null ? evi.maxCount : 100;
      var left = mc[evi.id] != null ? mc[evi.id] : maxN;
      if (left <= 0) continue;
      if (!eventAvailable(g, evi)) continue;
      var minA = evi.minAge != null ? evi.minAge : 0;
      var maxA = evi.maxAge != null ? evi.maxAge : 10000;
      if (g.age >= minA && g.age <= maxA) raw.push(evi);
    }
    var fresh = [];
    for (i = 0; i < raw.length; i++) {
      if (g.realmSeenIds && g.realmSeenIds[raw[i].id]) continue;
      fresh.push(raw[i]);
    }
    var use = fresh.length ? fresh : raw;
    var tagged = [];
    for (i = 0; i < use.length; i++) {
      if (eventTagBlocked(g, use[i])) continue;
      if (fresh.length && use[i].tag && g.realmSeenTags && g.realmSeenTags[use[i].tag]) continue;
      tagged.push(use[i]);
    }
    if (tagged.length) return tagged;
    var soft = [];
    for (i = 0; i < use.length; i++) {
      if (eventTagBlocked(g, use[i])) continue;
      soft.push(use[i]);
    }
    return soft.length ? soft : use;
  }
  function choiceHasFork(spec) {
    if (!spec || !spec.options || spec.options.length < 2) return false;
    var i, o;
    for (i = 0; i < spec.options.length; i++) {
      o = spec.options[i];
      if (o && !o.safe) return true;
    }
    return spec.options.length >= 2;
  }
  function isUniqueLifeBeat(ev) {
    if (!ev) return false;
    if (ev.ask === false) return false;
    if (ev.maxCount === 1) return true;
    if (ev.id && String(ev.id).indexOf('lf_') === 0) return true;
    return false;
  }
  function isSmallEvent(ev) {
    if (!ev || isThrillEvent(ev)) return false;
    return (ev.tier || 1) <= 2;
  }
  function smallEventPhysiqueScale(g) {
    var t = physiqueTierOf(g);
    if (t >= 9) return 0.78;
    if (t >= 7) return 0.88;
    if (t >= 4) return 0.96;
    return 1.12;
  }
  function isStakeEvent(ev) {
    if (!ev || ev.ask === false) return false;
    if ((ev.tier || 1) < 2) return false;
    if (ev.tier >= 4) return true;
    var tag = ev.tag || '';
    if (tag === 'allin' || tag === 'create' || tag === 'starroad') return true;
    if (tag === 'dungeon' && ev.choice && (ev.tier || 1) >= 2) return true;
    if (tag === 'quasi' && ev.choice) return true;
    var id = ev.id || '';
    if (id === 'dao_create_swallowing' || id.indexOf('rd_road') === 0 || id.indexOf('dibing') >= 0) return true;
    return false;
  }
  function isThrillEvent(ev, spec) {
    if (isStakeEvent(ev)) return true;
    if (spec && spec.options) {
      var i, o;
      for (i = 0; i < spec.options.length; i++) {
        o = spec.options[i];
        if (o && o.risk === 'deadly') return true;
        if (o && o.id && String(o.id).indexOf('art_') === 0) return true;
      }
    }
    return false;
  }
  function choiceThrillRank(ev) {
    if (!ev) return 0;
    if (ev.tier >= 4 || ev.tag === 'allin' || ev.tag === 'starroad') return 3;
    if (isThrillEvent(ev)) return 2;
    if (ev.tier >= 3) return 1;
    if (ev.tag === 'sect' && ev.choice && (ev.tier || 1) >= 2) return 1;
    return 0;
  }
  function needsAttrWeight(ev) {
    if (!ev) return false;
    if (ev.tier >= 4) return true;
    var tag = ev.tag || '';
    if (tag === 'allin' || tag === 'starroad' || tag === 'forbidden') return true;
    var id = ev.id || '';
    return id === 'xingkong_gulu' || id === 'dilu_zhengfeng' ||
      id.indexOf('rd_road') === 0 || id.indexOf('dibing') >= 0;
  }
  function eventAttrWeight(g, ev) {
    if (!needsAttrWeight(ev)) return 1;
    var gift = g && g.daoGift != null ? g.daoGift : 5;
    var body = physiqueTierOf(g);
    var cult = currentCombatPower(g) || 1;
    var expect = Math.max(1, realmCultCap((g && g.lvl) || 1) * 0.35);
    var ratio = cult / expect;
    var w = 0.55;
    w += clamp((gift - 5) * 0.10, -0.30, 0.50);
    w += clamp((body - 5) * 0.05, -0.20, 0.25);
    w += clamp((ratio - 1) * 0.40, -0.28, 0.70);
    if (g && (g.resonance === 'imperial' || g.resonance === 'dao')) w += 0.22;
    if (hasImperialRoad(g)) w += 0.18;
    return clamp(w, 0.15, 2.8);
  }
  /* 停屏只留给能逆天改命的闸门。T1 杂事、T2 秘境/人生岔路自行落幕。 */
  function choiceWorthAsking(ev, spec) {
    if (!ev || !spec || !spec.options || !spec.options.length) return false;
    if (ev.ask === false) return false;
    if ((ev.tier || 1) < 2) return false;
    var id = ev.id || '';
    var tag = ev.tag || '';
    if (id === 'phy_dixue_cuiti' || id === 'phy_hundunqi_cuiti') return false;
    if (id === 'imperial_gate') return true;
    if (tag === 'create') return true;
    if ((ev.tier || 1) >= 4) return true;
    if (tag === 'allin') return true;
    if (tag === 'starroad' && (ev.tier || 1) >= 3) return true;
    if (tag === 'quasi') return true;
    return false;
  }
  /* 奖惩跟眼前这份战力走，不跟事件里写死的小数走。
   * 轮海约 8%，准帝约 22%。后期差一点机缘也要能动当前格局。 */
  function choiceStakeShare(g) {
    var band = D.realmIdx((g && g.lvl) || 1);
    if (band < 1) band = 1;
    if (band > 10) band = 10;
    return 0.06 + band * 0.016;
  }
  function choiceStakeU(g, chosen) {
    if (!chosen || chosen.safe || chosen.risk === 'deadly') return U;
    var share = choiceStakeShare(g);
    var B = {}, k;
    for (k in U) B[k] = U[k];
    B.cultPct = function (gg, lo, hi, floor) {
      var lo2 = Math.max(lo || 0, share * 0.75);
      var hi2 = Math.max(hi || 0, share);
      var floor2 = Math.max(floor || 0, Math.round((gg.cult || 0) * share * 0.55));
      return U.cultPct(gg, lo2, hi2, floor2);
    };
    B.gainDao = function (gg, amount, capAdd) {
      return U.gainDao(gg, amount, capAdd);
    };
    B.hurt = function (gg, lo, hi) {
      var ev = _curEv && _curEv.ev;
      return applyLifeHurt(gg, lo, hi, {
        noExempt: !!(chosen && chosen.risk === 'deadly'),
        severity: eventHurtSeverity(ev, chosen)
      });
    };
    return B;
  }
  function fireEvent(g, log, ev, opt) {
    if (!g || !ev) return;
    opt = opt || {};
    if (isStakeEvent(ev) && eventSpanRoom(g) <= 0) return;
    var mc = g.maxCount || (g.maxCount = {});
    var maxN2 = ev.maxCount != null ? ev.maxCount : 100;
    mc[ev.id] = (mc[ev.id] != null ? mc[ev.id] : maxN2) - 1;
    markEventSeen(g, ev);
    if (ev.choice) {
      g.choiceTags = g.choiceTags || {};
      g.choiceTags[ev.tag || ev.id] = 1;
    }
    g.eventDraws = (g.eventDraws || 0) + 1;
    if (isStakeEvent(ev)) {
      var spanKey = eventSpanKey((g.lvl || 1));
      g.eventDrawsBySpan = g.eventDrawsBySpan || {};
      g.eventDrawsBySpan[spanKey] = (g.eventDrawsBySpan[spanKey] || 0) + 1;
    }
    decayFortuneHeat(g);
    var prevCur = _curEv;
    _curEv = { ev: ev, g: g, log: log, printed: false };
    if (ev.choice) {
      var spec = ev.choice(g, U);
      if (spec && spec.options && spec.options.length) {
        spec.source = 'event';
        spec.evId = ev.id;
        spec.id = spec.id || ev.id;
        spec.title = spec.title || ev.name;
        spec.prompt = spec.prompt || ('第' + g.age + '岁，' + (spec.lead || ev.desc || ev.name));
        spec.cls = spec.cls || ('ev' + ev.tier);
        var ask = choiceWorthAsking(ev, spec);
        if (!ask && opt.forceAsk && (ev.tier || 1) >= 2) ask = true;
        if (ask) {
          spec.stakes = true;
          spec.fateGate = true;
          var band = D.realmIdx(g.lvl);
          if (band >= 2) {
            g.choiceByRealm = g.choiceByRealm || {};
            g.choiceByRealm[band] = 1;
          }
          _curEv = prevCur;
          openChoice(g, log, spec);
          return;
        }
        _curEv = prevCur;
        applyChoice(g, spec, quietChoiceOption(spec), log);
        return;
      }
    }
    if (!ev.cond || ev.cond(g, U)) {
      markQuasiFate(g, ev);
      if (ev.ok) ev.ok(g, U, log);
      grantEventDaoyun(g, ev, log);
    } else {
      if (isDoorStory(ev)) mc[ev.id] = (mc[ev.id] != null ? mc[ev.id] : 0) + 1;
      if (ev.fail) ev.fail(g, U, log);
    }
    _curEv = prevCur;
  }
  function rollEvent(g, log) {
    var raw = collectAvailableEvents(g, false);
    var stake = [], flavor = [], i;
    for (i = 0; i < raw.length; i++) {
      if (isStakeEvent(raw[i])) stake.push(raw[i]);
      else flavor.push(raw[i]);
    }
    var echoes = collectEchoEvents(g);
    if (echoes.length) {
      fireEvent(g, log, echoes[Math.floor(Math.random() * echoes.length)]);
      return;
    }
    var afterCut = g.lvl === 60 && g.cutDaoTried && !g.cutDaoPassed;
    var afterSaint = g.lvl === 70 && g.saintTried && !g.saintPassed;
    if (afterCut || afterSaint) {
      var restPool = collectStuckEvents(g);
      if (restPool.length) {
        fireEvent(g, log, pickDoorStuck(g, restPool));
        return;
      }
    }
    if (eventSpanRoom(g) > 0 && stake.length) {
      /* 凡体卡在四极到入圣门口时，额度没花完也先坐下。两道门槛只堆战力，坐不穿。
       * 斩道/入圣门口不再先掷骰，否则前夜会被梭哈额度吃掉。 */
      if ((g.innate || 1) <= 4 && (g.lvl || 1) >= 6 && (g.lvl || 1) <= 70 &&
          ((wantClimbSit(g) && !justSatDoor(g)) || Math.random() < 0.40)) {
        var earlyStuck = collectStuckEvents(g);
        if (earlyStuck.length) {
          fireEvent(g, log, pickDoorStuck(g, earlyStuck));
          return;
        }
      }
      /* 刚夜坐过把年让出来时，走会留钩子的路边事，别再抽一张梭哈。 */
      if (justSatDoor(g) && flavor.length) {
        fireEvent(g, log, pickStuckBreak(g, flavor) || pickWeighted(g, flavor));
        return;
      }
      fireEvent(g, log, pickWeighted(g, stake));
      return;
    }
    if (flavor.length) fireEvent(g, log, pickStuckBreak(g, flavor) || pickWeighted(g, flavor));
  }
  function wantClimbSit(g) {
    var lvl = (g && g.lvl) || 1;
    if (!g || (g.innate || 1) > 4) return false;
    if (lvl >= 21 && lvl <= 59) return true;
    if (lvl >= 61 && lvl <= 69) return true;
    if (lvl === 60 && !g.cutDaoTried) return true;
    if (lvl === 70 && !g.saintTried) return true;
    return false;
  }
  function justSatDoor(g) {
    var rec = g && g.recentEvents;
    if (!rec || !rec.length) return false;
    return isDoorStory(rec[rec.length - 1]);
  }
  function collectEchoEvents(g) {
    var out = [], i, ev, mc = (g && g.maxCount) || {};
    for (i = 0; i < E.length; i++) {
      ev = E[i];
      if (!ev || !ev.needStory || !hasStory(g, ev.needStory)) continue;
      var maxN = ev.maxCount != null ? ev.maxCount : 1;
      var left = mc[ev.id] != null ? mc[ev.id] : maxN;
      if (left <= 0) continue;
      if (g.age < (ev.minAge != null ? ev.minAge : 0)) continue;
      if (g.age > (ev.maxAge != null ? ev.maxAge : 100000)) continue;
      if (!eventAvailable(g, ev)) continue;
      out.push(ev);
    }
    return out;
  }
  function isDoorStory(ev) {
    var id = ev && ev.id || '';
    return id.indexOf('th_stuck_') === 0 || id === 'th_after_cut' ||
      id === 'th_after_saint' || id === 'th_cut_rekindle' || id === 'th_saint_rekindle';
  }
  /* 凡体卡关不看路边池标签。刚抽过悟道，也该能坐下把这一层坐穿。 */
  function collectStuckEvents(g) {
    var out = [], i, ev, mc = (g && g.maxCount) || {};
    for (i = 0; i < E.length; i++) {
      ev = E[i];
      if (!isDoorStory(ev)) continue;
      var maxN = ev.maxCount != null ? ev.maxCount : 3;
      var left = mc[ev.id] != null ? mc[ev.id] : maxN;
      if (left <= 0) continue;
      if (g.age < (ev.minAge != null ? ev.minAge : 0)) continue;
      if (g.age > (ev.maxAge != null ? ev.maxAge : 100000)) continue;
      if (!eventAvailable(g, ev)) continue;
      out.push(ev);
    }
    return out;
  }
  function pickStuckBreak(g, flavor) {
    var innate = (g && g.innate) || 1;
    var afterCut = g && g.lvl === 60 && g.cutDaoTried && !g.cutDaoPassed;
    var afterSaint = g && g.lvl === 70 && g.saintTried && !g.saintPassed;
    if (!g || (innate > 4 && !afterCut && !afterSaint)) return null;
    if ((g.lvl || 1) < 6 || (g.lvl || 1) > 90) return null;
    /* 门槛失败后余生必须能看见。化龙到仙台、斩道/入圣门口也不再先掷骰。 */
    if (!afterCut && !afterSaint && !(wantClimbSit(g) && !justSatDoor(g)) && Math.random() > 0.62) return null;
    var found = collectStuckEvents(g);
    if (!found.length && flavor && flavor.length) {
      var i, ev;
      for (i = 0; i < flavor.length; i++) {
        ev = flavor[i];
        if (isDoorStory(ev)) found.push(ev);
      }
    }
    if (!found.length) return null;
    return pickDoorStuck(g, found);
  }
  /* 斩道/入圣门口优先抽前夜或门口枯坐，别被大能调息把能看的事挤掉。 */
  function pickDoorStuck(g, pool) {
    var i, ev, lvl = (g && g.lvl) || 1;
    if (lvl === 60) {
      var cutId = 'th_stuck_cut';
      var afterLeft = ((g && g.maxCount) || {}).th_after_cut;
      var satAfter = afterLeft != null && afterLeft <= 0;
      if (g && g.cutNearMiss && !g.cutDaoPassed && !g.cutDaoRekindled && satAfter) {
        cutId = 'th_cut_rekindle';
      } else if (g && g.cutDaoTried && !g.cutDaoPassed) {
        cutId = 'th_after_cut';
      }
      for (i = 0; i < pool.length; i++) {
        ev = pool[i];
        if (ev && ev.id === cutId) return ev;
      }
    }
    if (lvl === 70) {
      var saintId = (g && g.saintTried && !g.saintPassed) ? 'th_after_saint' : 'th_stuck_sheng';
      var afterSaintLeft = ((g && g.maxCount) || {}).th_after_saint;
      var satSaint = afterSaintLeft != null && afterSaintLeft <= 0;
      if (g && g.saintNearMiss && !g.saintPassed && !g.saintRekindled && satSaint) {
        saintId = 'th_saint_rekindle';
      }
      for (i = 0; i < pool.length; i++) {
        ev = pool[i];
        if (ev && ev.id === saintId) return ev;
      }
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }
  var REALM_CHOICE_WAIT = 12;
  var HOMEWORK_BAN = { phy_dixue_cuiti: 1, phy_hundunqi_cuiti: 1 };
  function isHomeworkBanned(ev) {
    if (!ev) return true;
    if (HOMEWORK_BAN[ev.id]) return true;
    if (ev.tier >= 4) return true;
    if (ev.tag === 'allin') return true;
    return false;
  }
  function pickWeighted(g, pool) {
    var weights = [], total = 0, i;
    for (i = 0; i < pool.length; i++) {
      var w = eventDrawWeight(g, pool[i]);
      weights.push(w); total += w;
    }
    if (!(total > 0)) return pool[Math.floor(Math.random() * pool.length)];
    var r = Math.random() * total, acc = 0, ev = pool[pool.length - 1];
    for (i = 0; i < pool.length; i++) {
      acc += weights[i]; if (r < acc) { ev = pool[i]; break; }
    }
    return ev;
  }
  /* 不再按境保送作业。额度按圣人前 / 圣人~大圣 / 准帝三段卡死，只出梭哈。 */
  function ensureRealmChoice(g, log) {
    return;
  }
  /* 悟性卡 / 天生高悟：见过立法窗口后，本生至少弹一次创法抉择。
   * 不走本境标签硬挡，否则 create 族被人生包占掉就永远落不了笔。 */
  function daoArtGuarantee(g) {
    if (!g) return false;
    if ((g.daoGift || 5) >= 8) return true;
    if (g.resonance === 'dao') return true;
    var i, t;
    for (i = 0; i < (g.traits || []).length; i++) {
      t = D.traitById(g.traits[i]);
      if (t && t.path === 'dao' && (t.color === 'p' || t.color === 'o')) return true;
    }
    return false;
  }
  function collectCreateChoices(g) {
    var out = [], i, ev, mc = g.maxCount || {};
    for (i = 0; i < E.length; i++) {
      ev = E[i];
      if (!ev.choice || ev.tag !== 'create') continue;
      var maxN = ev.maxCount != null ? ev.maxCount : 100;
      if ((mc[ev.id] != null ? mc[ev.id] : maxN) <= 0) continue;
      if (!eventAvailable(g, ev)) continue;
      if (g.age < (ev.minAge != null ? ev.minAge : 0)) continue;
      if (g.age > (ev.maxAge != null ? ev.maxAge : 10000)) continue;
      out.push(ev);
    }
    return out;
  }
  function ensureArtChoice(g, log) {
    if (!g || g.dead || g.becameEmperor || g.pendingChoice) return;
    if (eventSpanRoom(g) <= 0) return;
    if ((g.cutDaoTried && !g.cutDaoPassed) || (g.saintTried && !g.saintPassed)) return;
    if (g.artHomework) return;
    if (!daoArtGuarantee(g)) return;
    if ((g.lvl || 1) < 21) return;
    if (!g.artGlimpse && daoFill(g) < 0.18) return;
    var pool = collectCreateChoices(g);
    if (!pool.length) return;
    g.artHomework = true;
    fireEvent(g, log, pickWeighted(g, pool), { forceAsk: true });
  }
  function physiqueTierOf(g) {
    if (g && g.physiqueId && D.physiqueById) {
      var p = D.physiqueById(g.physiqueId);
      if (p && p.tier) return p.tier;
    }
    return (g && (g.aptitude || g.innate)) || 1;
  }
  function eventSpanKey(lvl) {
    if ((lvl || 1) < 71) return 'pre';
    if ((lvl || 1) < 91) return 'mid';
    return 'late';
  }
  function eventSpanBudget(g) {
    var k = eventSpanKey((g && g.lvl) || 1);
    if (k === 'pre') {
      /* 普通凡体半生停在圣人前，2 窗爽感分只有 40。多一窗，高悟不给。 */
      if (g && g.innate != null && g.innate <= 3 && (g.daoGift || 5) <= 6) return 3;
      return 2;
    }
    if (k === 'mid') return 3;
    return 6;
  }
  function eventSpanDraws(g) {
    var k = eventSpanKey((g && g.lvl) || 1);
    return (g && g.eventDrawsBySpan && g.eventDrawsBySpan[k]) || 0;
  }
  function eventSpanRoom(g) {
    return Math.max(0, eventSpanBudget(g) - eventSpanDraws(g));
  }
  /* 兼容旧名：圣人前额度就是 2。 */
  function earlyEventBudget(g) {
    return eventSpanBudget({ lvl: (g && g.lvl) || 1 });
  }
  function typicalLifeRef(g) {
    var band = D.realmIdx((g && g.lvl) || 1);
    var row = D.REALM_LIFE && D.REALM_LIFE[band];
    if (row) return Math.round((row[0] + row[1]) / 2);
    return 120;
  }
  function eventWantedInSpan(g) {
    return eventSpanRoom(g);
  }
  function eventSpanPaceYears(g) {
    var k = eventSpanKey((g && g.lvl) || 1);
    var age = (g && g.age) || 0;
    var life = Math.max(typicalLifeRef(g), (g && g.lifespan) || 0);
    if (k === 'pre') {
      return Math.max(60, Math.min(life - age, Math.round(typicalLifeRef(g) * 0.7)));
    }
    /* 圣人到准帝，高悟往往三五百年就跨过去。按整段寿元摊会变成 0 次。 */
    if (k === 'mid') return 540;
    return Math.max(360, Math.round((life - age) * 0.5));
  }
  function eventFlavorInterval(g) {
    /* 梭哈额度用尽后仍要有路边事，否则半生日志是空白。 */
    var k = eventSpanKey((g && g.lvl) || 1);
    if (k === 'pre') return 64;
    if (k === 'mid') return 110;
    return 220;
  }
  function eventYearInterval(g) {
    if ((g.lvl === 60 && g.cutDaoTried && !g.cutDaoPassed) ||
      (g.lvl === 70 && g.saintTried && !g.saintPassed)) {
      return eventFlavorInterval(g);
    }
    var wanted = eventWantedInSpan(g);
    if (wanted <= 0) return eventFlavorInterval(g);
    var spanYears = eventSpanPaceYears(g);
    var floor = eventSpanKey((g && g.lvl) || 1) === 'mid' ? 90 : 24;
    return Math.max(floor, Math.round(spanYears / wanted));
  }
  function eventYearChance(g) {
    return (1 / eventYearInterval(g)) * (g.tm.evf || 1) * pval(g, 'evf', 1) * ((g.era && g.era.evf) || 1);
  }
  function maybeArtGlimpse(g, log) {
    if (!g || g.artGlimpse || g.becameEmperor || g.dead) return;
    var fill = daoFill(g);
    var saint = (g.lvl || 1) >= 71;
    if (saint && fill >= 0.18) {
      /* 圣人后普通号也该看见一次立法窗口，不必活一万年去赌填充 */
    } else if ((g.lvl || 1) >= 21 && fill >= 0.20) {
      /* 道宫起、填充够，仍给一次可见窗口 */
    } else {
      return;
    }
    g.artGlimpse = true;
    addFortuneHeat(g, 3);
    push(log, { cls: 'rare', text: '第' + g.age + '岁，你忽然觉得自己也能立下一法。' +
      '差的不是念头，是再撞上一场真正够格的机缘——那时落笔，才叫创法' });
  }

  /* 事件只留机缘余温。道蕴必须事件自己够格（悟道/创法/显式 dao），不能见事就抽成。 */
  function grantEventDaoyun(g, evOrTier, log) {
    var tier = (evOrTier && evOrTier.tier) || evOrTier || 1;
    addFortuneHeat(g, tier);
  }

  /* 事件日志推进（仅 log 存在时收集） */
  function push(log, obj) { if (log) log.push(obj); }

  /* ---------- 以力证道成功率 ----------
   * 五成点定在 35 万，也就是顶级体质配顶级悟性能摸到的准帝九重上限——
   * 走到帝关前的人，恰好是一半一半。陡度 3 钉住另外两个锚点：
   * 大成荒古圣体的 70 万 ≈ 89%、无缺大帝级的 100 万 ≈ 97%。
   * 旧式是阶梯：45 万一过就 100% 必成。那条线在整套刻度里偏低（比破灭万道门槛还低一半），
   * 且过线之后战力的边际收益直接归零，梭哈攒出来的战力到后期会突然作废。
   * 换成渐近曲线后战力永远还有收益，同时永不到 100%，帝关始终留一分不确定。 */
  var ZHENGDAO_REF = 350000;
  var ZHENGDAO_K = 3;
  function zhengdaoChance(cult) {
    if (!(cult > 0)) return 0.02;
    return clamp(1 / (1 + Math.pow(ZHENGDAO_REF / cult, ZHENGDAO_K)), 0.02, 0.99);
  }

  /* 证道成帝后的实力 = (证道之基 + 原实力) × 倍率。
   * 基数 55 万配上准帝九重的三十来万，新晋大帝落在 85~95 万，
   * 即「另类成道者接近无缺大帝（85~105 万）而不及」。 */
  var ZHENGDAO_BASE_CULT = 550000;
  function xianCult(cult, rate) {
    if (rate == null) rate = 1;
    return round((ZHENGDAO_BASE_CULT + cult) * rate);
  }

  function isSacredBody(g) {
    var id = g && g.physiqueId;
    return id === 'sacred' || id === 'origin_sacred' || id === 'innate_sacred_dao';
  }

  function isHuangguSacred(g) {
    return !!(g && g.physiqueId === 'sacred');
  }

  /* 大成之后叩帝关：荒古圣体成帝是万古难遇，原著仅叶凡做到。
   * 光秃约 2%；合适金卡加上大成战力可抬到约 45%，仍远不到保送。 */
  var SACRED_POWER_WEIGHT = 0.14;
  function sacredEmperorChance(g) {
    if (!isHuangguSacred(g)) return 0;
    var body = (g.tm && g.tm.bodyChance) || 0;
    var extra = ((g.tm && g.tm.zhx) || 0) + pval(g, 'zhx', 0) + (g.planEdge || 0);
    var dao = (g.daoyun || 0) / D.DAO_ABSOLUTE_MAX;
    var gift = Math.max(0, (g.daoGift || 5) - 8) * 0.012;
    /* 战力必须进入这条公式。否则圣体 100% 都能站到帝关前、86% 死在那一掷，
     * 而战力对它完全无效——一切战力奖励对圣体都成了废货币，玩家的积累毫无反馈。
     * 从以力证道曲线的半数点之半起算，到大成圣体的 70 万吃满，
     * 保证它是一条真正的梯度而不是又一个台阶。 */
    var powFloor = ZHENGDAO_REF / 2;
    var power = clamp((zhengdaoEff(g) - powFloor) / (D.SACRED_JIDAO_CULT - powFloor), 0, 1) * SACRED_POWER_WEIGHT;
    var chance = 0.018 + Math.min(0.18, body * 0.22) + Math.min(0.09, extra * 0.9) +
      Math.min(0.08, dao * 0.08 + createdArtN(g) * 0.012) + gift + power;
    if (g.gotDiBing) chance += 0.012;
    if (g.deathless) chance += 0.008;
    if (g.worldEmperor) chance *= 0.40;
    /* 上限从 0.32 提到 0.45：保留「比谁都难」，但不再是锁死的天花板 */
    return clamp(chance, 0.012, 0.45);
  }

  /* 准帝九重天的荒古圣体即为大成圣体，无需再走额外大成机缘。 */
  function completeSacredBody(g, log) {
    if (!g || !isHuangguSacred(g) || (g.lvl || 0) < 99 || g.sacredPeakAwakened) return g;
    g.sacredPeakAwakened = true;
    /* 大成圣体远超准帝九重（约 2 倍），但只有无缺大帝的六七成：
     * 能叫板，正面打必死。无帝之世略高一线，因为没有帝压着它。 */
    var target = g.worldEmperor ? irand(560000, 640000) :
      irand(D.SACRED_JIDAO_CULT, Math.round(D.SACRED_JIDAO_CULT * 1.09));
    g.cult = Math.max(g.cult || 0, target);
    if (log) {
      push(log, { cls: 'rainbow', text: '第' + (g.age || 0) + '岁，准帝九重天成，荒古圣体至此大成！' +
        '一身血气里多了一丝皇道法则，战力' + Math.round(g.cult / 10000) + '万，' +
        (g.worldEmperor ?
          '足以叫板当世大帝，正面硬撼却仍是送死' :
          '此世无帝，已是人间极道至尊，但仍在无缺大帝之下') });
    }
    return g;
  }

  function emperorLifeSpanRange(lifeNo, g) {
    if ((lifeNo || 1) === 1 && isSacredBody(g)) return [20000, 26000];
    var ranges = [
      [8000, 12000], [15000, 25000], [30000, 45000], [50000, 70000],
      [70000, 95000], [90000, 120000], [110000, 145000], [130000, 170000]
    ];
    return ranges[Math.min(7, Math.max(0, (lifeNo || 1) - 1))].slice();
  }

  function emperorDaoyunLifePace(lifeNo) {
    var n = lifeNo || 1;
    if (n <= 1) return 1;
    if (n === 2) return 0.07;
    if (n === 3) return 0.045;
    if (n === 4) return 0.035;
    if (n === 5) return 0.028;
    /* 六世以后主要靠新的蜕变法，单纯等待几乎不再灌满道海。 */
    return 0.020;
  }
  function emperorDaoyunGainPerYear(g) {
    var span = Math.max(1, g.emperorLifeEnd - g.emperorLifeStart);
    var perLifeBudget = 270 * (0.4 + (g.daoGift || 5) * 0.12 + (g.innate || 1) * 0.14) *
      emperorDaoyunLifePace(g.lifeNo);
    return perLifeBudget / span;
  }
  /* 成帝以后长力跟道海填充走，不再吃体质成长。海空几乎不长，坐满才慢慢沉。 */
  function emperorCultGainPerYear(g) {
    if (!g || !(g.emperor || g.becameEmperor) || g.redDustImmortal) return 0;
    var fill = g.daoyunCap > 0 ? clamp((g.daoyun || 0) / g.daoyunCap, 0, 1) : 0;
    return Math.max(0, (g.cult || 0) * (0.00002 + fill * 0.00008));
  }

  function resetEmperorLife(g) {
    var range = emperorLifeSpanRange(g.lifeNo, g);
    /* 寿元命格会转化为帝者路线的可规划余量，而不是在成帝时被清零。
     * 词条数值按“年”直接计入帝者寿元；旧版 ×4 再封顶 1200 会让高阶寿元卡失去意义。 */
    var span = irand(range[0], range[1]) + Math.min(8000, Math.round(g.longevityTraitBonus || 0));
    g.emperorLifeStart = g.age;
    g.emperorLifeEnd = g.age + span;
    g.lifeBase = g.emperorLifeEnd;
    g.lifeBonus = 0;
    g.redDustRoots = { body: 0, soul: 0, dao: 0 };
    emperorLegacy(g);
    g.emperorLegacy.usedThisLife = {};
    g.emperorLegacy.lastBeat = null;
    syncLife(g);
  }

  function grantEmperorDeathless(g, log) {
    if (!g) return false;
    if (g.deathless && !g.deathlessUsed) return true;
    if (Math.random() >= 0.40) return false;
    g.deathless = true;
    g.deathlessUsed = false;
    g.reverseMedicineUsed = false;
    g.emperorDeathlessGranted = true;
    push(log, { cls: 'rainbow', text: '你证道后巡行宇宙，一株不死神药主动来投，被你封存于帝宫，可在第一世帝命结束时续出第二世' });
    return true;
  }

  /* ---------- 证道成帝：进入帝者篇，不再立刻结算 ---------- */
  function becomeDi(g, log, mode) {
    var displacedEmperor = g.worldEmperor;
    g.emperor = true; g.becameEmperor = true; g.ascendMode = mode; g.lvl = 101;
    g.emperorAge = g.age; g.lifeNo = 1; g.redDustMarks = 0;
    g.redDustPath = null; g.immortalMode = null; g.inStrangeWorld = false; g.strangeWorldYears = 0;
    g.strangeWorldInsight = 0; g.strangeWorldEvents = 0; g.strangeWorldSituation = null;
    g.strangeWorldAlliance = null; g.awaitingStrangeWorldChoice = false;
      g.strangeWorldThreatKnown = false; g.undeadHunting = false; g.undeadLives = 0; g.undeadCult = 0; g.undeadImmortal = false; g.defeatedUndead = false;
    g.redDustRoutes = [];
    g.worldEmperor = null; g.nextWorldEmperorYear = null; g.playerEmperorActive = true; g.daoSuppressed = false;
    recordWorldEvent(g, g.worldYear || 0, displacedEmperor ?
      '你破灭当世万道，压过' + displacedEmperor.name + '证道' : '你证道成帝，君临此世');
    var rate;
    if (mode === 'jidao' || mode === 'hedao') rate = D.CHENGDI_BONUS_JIDAO;
    else rate = D.CHENGDI_BONUS_MIN + Math.random() * (D.CHENGDI_BONUS_MAX - D.CHENGDI_BONUS_MIN);
    g.cult = xianCult(g.cult, rate);
    if (g.physiqueId === 'sacred') {
      /* 荒古圣体一旦证道，道果极厚：战力直达天帝、道蕴暴涨，但逆活仍须独闯死关。 */
      g.cult = Math.max(g.cult, D.HEAVENLY_EMPEROR_CULT);
      g.daoyunCap = Math.min(D.DAO_ABSOLUTE_MAX, Math.max(g.daoyunCap, D.SACRED_EMPEROR_DAO_CAP || 2800));
      g.daoyun = Math.max(g.daoyun, Math.min(g.daoyunCap, Math.max(2400, Math.floor(g.daoyunCap * 0.92))));
    }
    grantEmperorDeathless(g, log);
    resetEmperorLife(g);
    return g.cult;
  }

  function learnStrangeWorld(g, log, text) {
    if (!g || !(g.emperor || g.becameEmperor || g.forbiddenLord)) return false;
    if (g.knowsStrangeWorld) return false;
    g.knowsStrangeWorld = true;
    if (text) push(log, { cls: 'rainbow', text: text });
    return true;
  }

  function emperorLegacy(g) {
    if (!g.emperorLegacy) {
      g.emperorLegacy = {
        order: 0, forbiddenSuppressed: 0, lateAmbushes: 0, farewells: 0,
        usedThisLife: {}, usedEver: {}, lastBeat: null
      };
    }
    if (!g.emperorLegacy.usedThisLife) g.emperorLegacy.usedThisLife = {};
    if (!g.emperorLegacy.usedEver) g.emperorLegacy.usedEver = {};
    return g.emperorLegacy;
  }

  var EMPEROR_BEAT_META = {
    late_ambush: { lateOnly: true, oncePerLife: true },
    establish_heaven: { once: true },
    emperor_tomb: { once: true, minLife: 2 },
    imperial_god: { once: true },
    blood_pact: { once: true },
    underworld_edge: { once: true },
    reincarnation_dream: { once: true, minLife: 2 },
    mortal_farewell: { oncePerLife: true },
    faith_incense: { oncePerLife: true },
    self_method: { oncePerLife: true, minLife: 3 },
    reverse_deduction: { oncePerLife: true, minLife: 2 },
    lonely_throne: { oncePerLife: true, minLife: 5 },
    nine_secret: { max: 3 },
    predecessor_trace: { max: 3 },
    sealed_world: { max: 2 },
    reforge_weapon: { max: 2 },
    dao_prosper: { oncePerLife: true },
    heaven_gate: { max: 3 },
    tomb_builder: { once: true, minLife: 1 },
    emperor_seed: { max: 3 },
    fallen_friend: { max: 2 },
    ancient_pact: { max: 2 },
    race_ancestor: { max: 3 },
    chaos_source: { max: 2 },
    immortal_trace: { max: 3 },
    forbidden_dialogue: { max: 2 },
    dao_purge: { oncePerLife: true },
    epoch_turn: { minLife: 2, max: 3 },
    star_herding: { max: 3 },
    saint_pilgrimage: { max: 3 },
    dao_war: { max: 3 },
    quasi_challenger: { max: 4 }
  };

  function emperorBeatIds() {
    return [
      'body_refine', 'soul_nurture', 'dao_scripture', 'dark_turmoil', 'seek_longevity',
      'forbidden_art', 'reforge_weapon', 'red_dust_insight', 'world_order', 'suppress_forbidden',
      'late_ambush', 'mortal_farewell', 'lecture_beings', 'establish_heaven', 'star_voyage',
      'predecessor_trace', 'faith_incense', 'imperial_god', 'disciple_rise', 'time_scar',
      'sealed_world', 'race_mediation', 'ancient_road', 'underworld_edge', 'emperor_tomb',
      'blood_pact', 'cosmos_bloom', 'nine_secret', 'void_rift', 'reincarnation_dream',
      'self_method', 'reverse_deduction', 'lonely_throne',
      'dao_prosper', 'saint_pilgrimage', 'star_herding', 'race_ancestor', 'heaven_gate',
      'ancient_pact', 'dao_war', 'fallen_friend', 'emperor_seed', 'tomb_builder',
      'chaos_source', 'immortal_trace', 'forbidden_dialogue', 'dao_purge',
      'quasi_challenger', 'epoch_turn'
    ];
  }

  function beatUsedEver(legacy, id) {
    return (legacy.usedEver && legacy.usedEver[id]) || 0;
  }

  function pickEmperorBeat(g) {
    var legacy = emperorLegacy(g);
    var lifeNo = g.lifeNo || 1;
    var span = Math.max(1, g.emperorLifeEnd - g.emperorLifeStart);
    var progress = (g.age - g.emperorLifeStart) / span;
    var used = legacy.usedThisLife || {};
    var pool = emperorBeatIds().filter(function (id) {
      var m = EMPEROR_BEAT_META[id] || {};
      var ever = beatUsedEver(legacy, id);
      if (m.minLife && lifeNo < m.minLife) return false;
      if (m.maxLife && lifeNo > m.maxLife) return false;
      if (m.lateOnly && progress < 0.65) return false;
      if (m.once && ever) return false;
      if (m.max && ever >= m.max) return false;
      if (m.oncePerLife && used[id]) return false;
      return true;
    });
    var preferred = pool.filter(function (id) { return id !== legacy.lastBeat; });
    if (!preferred.length) preferred = pool;
    var unused = preferred.filter(function (id) { return !used[id]; });
    var pickFrom = unused.length ? unused : preferred;
    if (!pickFrom.length) return null;
    /* 帝者日常淬炼是最稳定的成长来源，略提高权重，避免被一次性大事件挤掉。 */
    var totalWeight = 0, pick;
    function beatWeight(id) {
      if (id === 'body_refine') return 2;
      if (id === 'reverse_deduction' && g.redDustPath === 'reverse') return lifeNo <= 5 ? 3 : 2;
      return 1;
    }
    for (var wi = 0; wi < pickFrom.length; wi++) totalWeight += beatWeight(pickFrom[wi]);
    var wr = Math.random() * totalWeight;
    for (var wj = 0; wj < pickFrom.length; wj++) {
      wr -= beatWeight(pickFrom[wj]);
      if (wr < 0) { pick = pickFrom[wj]; break; }
    }
    return pick || pickFrom[pickFrom.length - 1];
  }

  function markBeat(g, id) {
    var legacy = emperorLegacy(g);
    legacy.usedThisLife[id] = (legacy.usedThisLife[id] || 0) + 1;
    legacy.usedEver[id] = (legacy.usedEver[id] || 0) + 1;
    legacy.lastBeat = id;
    return legacy.usedThisLife[id];
  }

  function beatLine(g, log, cls, text) {
    push(log, { cls: cls, text: '帝历' + (g.age - g.emperorAge) + '年，' + text });
  }

  function pickVariant(g, id, variants) {
    var n = ((g.emperorLegacy && g.emperorLegacy.usedThisLife && g.emperorLegacy.usedThisLife[id]) || 1) - 1;
    return variants[n % variants.length];
  }

  function runEmperorExperience(g, id, log) {
    if (!g || !g.emperor || !id) return false;
    var roots = g.redDustRoots;
    var legacy = emperorLegacy(g);
    var add;
    markBeat(g, id);
    if (id === 'body_refine') {
      add = irand(1, 2); roots.body += add;
      beatLine(g, log, 'rainbow', pickVariant(g, id, [
        '你闭关熬炼帝躯，气血如海，肉身根基+' + add,
        '你以神火淬炼骨骼，帝躯更近不朽，肉身根基+' + add,
        '你在星核中坐化数载，血气重凝，肉身根基+' + add
      ]));
      return true;
    }
    if (id === 'soul_nurture') {
      add = irand(1, 2); roots.soul += add;
      beatLine(g, log, 'ev4', pickVariant(g, id, [
        '你于岁月中温养元神，神念更清，元神根基+' + add,
        '你以帝念观照自身，元神如灯，元神根基+' + add,
        '你在寂静虚空中打坐，神魂不散，元神根基+' + add
      ]));
      return true;
    }
    if (id === 'dao_scripture') {
      add = irand(1, 2); roots.dao += add;
      beatLine(g, log, 'god', pickVariant(g, id, [
        '你推演自身大道，补全帝经残章，道果根基+' + add,
        '你改写一卷帝经秘境，使之更合此世，道果根基+' + add,
        '你将毕生所悟写入经文，道则更稳，道果根基+' + add
      ]));
      return true;
    }
    if (id === 'dark_turmoil') {
      if (Math.random() < 0.55 + (g.tm.ward + pval(g, 'ward', 0)) / 100) {
        roots.dao += 2; g.cult = round(g.cult * 1.04);
        beatLine(g, log, 'god', pickVariant(g, id, [
          '黑暗动乱爆发，你镇杀至尊爪牙、平定宇宙，道果根基+2',
          '禁区倾巢，你以帝威压回万古杀劫，道果根基+2',
          '此世生灵将尽，你一怒血洗祸首，天下暂安，道果根基+2'
        ]));
      } else {
        var turmoilLoss = irand(300, 900);
        g.emperorLifeEnd -= turmoilLoss; g.lifeBase -= turmoilLoss; syncLife(g);
        beatLine(g, log, 'dead', '你血战禁区至尊，虽平动乱却大道受创，帝命-' + turmoilLoss + '年');
      }
      return true;
    }
    if (id === 'seek_longevity') {
      var foundSeal = false;
      if (!g.xianSource && Math.random() < 0.58) {
        g.xianSource = true;
        foundSeal = true;
        beatLine(g, log, 'rainbow', '你于古代仙路遗址寻得一块仙源，可封存帝躯跨越万古');
      }
      if (!g.primordialStone && Math.random() < 0.52) {
        g.primordialStone = true;
        foundSeal = true;
        beatLine(g, log, 'rainbow', '你从太初古矿深处取出一枚太初命石，可承载残缺帝躯');
      }
      if (foundSeal) return true;
      if (!g.deathless || g.deathlessUsed) {
        if (Math.random() < 0.12) {
          g.deathless = true; g.deathlessUsed = false;
          beatLine(g, log, 'rainbow', '你寻遍诸天，得获一株不死神药');
        } else {
          roots.body++;
          beatLine(g, log, 'rare', pickVariant(g, id, [
            '你遍寻长生物质，虽未得不死药，却令肉身根基+1',
            '你探访药园残址，只余药香，肉身根基+1',
            '你炼化一缕太古生气，未成续命神药，肉身根基+1'
          ]));
        }
      } else {
        roots.body += 2;
        beatLine(g, log, 'rainbow', '你参悟不死神药中的长生物质，肉身根基+2');
      }
      return true;
    }
    if (id === 'forbidden_art') {
      roots.dao++; g.cult = round(g.cult * 1.03);
      beatLine(g, log, 'gain', pickVariant(g, id, [
        '你开创禁忌秘术，实力蜕变，道果根基+1',
        '你自创一门逆天神通，专克同境，道果根基+1',
        '你将杀伐之意写入大道，帝威更烈，道果根基+1'
      ]));
      return true;
    }
    if (id === 'reforge_weapon') {
      roots.soul++; g.gotDiBing = true;
      beatLine(g, log, 'ev4', pickVariant(g, id, [
        '你重炼极道帝兵，以神祇温养元神，元神根基+1',
        '帝兵中神祇初醒，愿为你镇守一域，元神根基+1',
        '你以精血喂养帝兵，兵鸣三日，元神根基+1'
      ]));
      return true;
    }
    if (id === 'red_dust_insight') {
      var key = ['body', 'soul', 'dao'][Math.floor(Math.random() * 3)];
      roots[key]++;
      beatLine(g, log, 'rare', pickVariant(g, id, [
        '万载红尘流转，你从众生兴衰中悟得一缕长生真意',
        '你立于凡尘集市，看尽生老病死，忽有所悟',
        '你悄然走入人间，以帝尊之身听了一场婚丧，心境微动'
      ]));
      return true;
    }
    if (id === 'world_order') {
      legacy.order++;
      roots.dao += 2;
      gainDaoyun(g, 14);
      beatLine(g, log, 'god', pickVariant(g, id, [
        '万族争乱不休，你重定宇宙秩序、划下不可逾越的帝律，道果根基+2',
        '你重划星域疆界，禁绝私开战端，道果根基+2',
        '你颁布帝律，令圣地不得再以凡人祭道，道果根基+2'
      ]));
      return true;
    }
    if (id === 'suppress_forbidden') {
      legacy.forbiddenSuppressed++;
      if (Math.random() < 0.58 + (g.tm.ward + pval(g, 'ward', 0)) / 100) {
        roots.body++; roots.dao++;
        g.cult = round(g.cult * 1.025);
        beatLine(g, log, 'god', '你亲临生命禁区，逼得沉睡至尊封闭山门，肉身与道果根基各+1');
      } else {
        var pressLoss = irand(180, 520);
        g.emperorLifeEnd -= pressLoss; g.lifeBase -= pressLoss; syncLife(g);
        beatLine(g, log, 'dead', '你威压禁区时遭数道皇道法则反扑，虽全身而退，帝命-' + pressLoss + '年');
      }
      return true;
    }
    if (id === 'late_ambush') {
      legacy.lateAmbushes++;
      if (Math.random() < 0.48 + Math.min(0.32, g.cult / 10000000) + (g.tm.ward + pval(g, 'ward', 0)) / 100) {
        roots.body += 2;
        g.cult = round(g.cult * 1.035);
        beatLine(g, log, 'god', '你帝血转衰，蛰伏至尊联手袭杀；你拖着晚年帝躯反杀来敌，肉身根基+2');
      } else {
        var wound = irand(450, 1100);
        g.emperorLifeEnd -= wound; g.lifeBase -= wound; syncLife(g);
        beatLine(g, log, 'dead', '禁区趁你晚年血气衰败发动袭杀；你击退来敌，却留下难愈道伤，帝命-' + wound + '年');
      }
      return true;
    }
    if (id === 'mortal_farewell') {
      legacy.farewells++;
      roots.soul += 2; roots.dao++;
      gainDaoyun(g, 18);
      beatLine(g, log, 'rainbow', pickVariant(g, id, [
        '故人先后凋零，唯你独立红尘；在一次次送别中，你看清岁月与生灭，元神根基+2、道果根基+1',
        '你送走最后一位旧识，山河仍在，人已不在，元神根基+2、道果根基+1',
        '你立于故人坟前，帝威收尽，只余一声叹息，元神根基+2、道果根基+1'
      ]));
      return true;
    }
    if (id === 'lecture_beings') {
      roots.dao++; gainDaoyun(g, 12);
      beatLine(g, log, 'god', pickVariant(g, id, [
        '你开坛讲道，亿万生灵跪听，一道道香火化作你的道果根基+1',
        '你在星空中央讲经九日，诸天记下你的帝音，道果根基+1',
        '你随口点化一名后辈，却牵动整片星域悟道，道果根基+1'
      ]));
      return true;
    }
    if (id === 'establish_heaven') {
      roots.dao += 2;
      beatLine(g, log, 'god', pickVariant(g, id, [
        '你建立天庭，令万族朝拜，却不让信仰反噬己道，道果根基+2',
        '你拒绝立朝，独行宇宙，以帝尊本身为天，道果根基+2',
        '你设下巡天法度，命传人镇守各方，道果根基+2'
      ]));
      return true;
    }
    if (id === 'star_voyage') {
      roots.soul++; g.cult = round(g.cult * 1.02);
      beatLine(g, log, 'ev4', pickVariant(g, id, [
        '你横渡宇宙边荒，见残破世界沉于混沌，元神根基+1',
        '你穿过一道星空裂隙，带回一缕异域法则，元神根基+1',
        '你在荒古星域外找到一处无人问津的死寂宇宙，元神根基+1'
      ]));
      return true;
    }
    if (id === 'predecessor_trace') {
      roots.dao++;
      beatLine(g, log, 'rare', pickVariant(g, id, [
        '你遭遇前代大帝遗留执念，论道三日，各退一步，道果根基+1',
        '一具帝尸睁眼，要与你分个高下，你压下它的不甘，道果根基+1',
        '你踏入前代道痕深处，看见对方未走完的长生路，道果根基+1'
      ]));
      return true;
    }
    if (id === 'faith_incense') {
      if (Math.random() < 0.55) {
        roots.soul++; g.cult = round(g.cult * 1.02);
        beatLine(g, log, 'rainbow', '你收下部分众生香火，化为温养元神的力量，元神根基+1');
      } else {
        roots.dao++;
        beatLine(g, log, 'god', '你拒绝信仰，斩断香火反噬，己道更纯，道果根基+1');
      }
      return true;
    }
    if (id === 'imperial_god') {
      roots.soul += 2; g.gotDiBing = true;
      beatLine(g, log, 'ev4', '帝兵中神祇成型，或可镇守传承，或可随你征战，元神根基+2');
      return true;
    }
    if (id === 'disciple_rise') {
      roots.dao++;
      beatLine(g, log, 'gain', pickVariant(g, id, [
        '你座下传人证得圣人，为你分忧一方星域，道果根基+1',
        '一名后辈借你帝经残篇入准帝，天下再添变数，道果根基+1',
        '你随手留下的一缕道音，成就了一座圣地的气运，道果根基+1'
      ]));
      return true;
    }
    if (id === 'time_scar') {
      gainDaoyun(g, 16); roots.soul++;
      beatLine(g, log, 'rainbow', pickVariant(g, id, [
        '你误入岁月乱流，看见自己尚未走完的未来，元神根基+1',
        '时光神殿残响响起，你以帝尊之身硬抗一截岁月刀，元神根基+1',
        '你在乱流中抓住一缕属于来世的气息，元神根基+1'
      ]));
      return true;
    }
    if (id === 'sealed_world') {
      roots.body++; gainDaoyun(g, 10);
      beatLine(g, log, 'rare', '你发现一处被封死的小世界，其中生灵仍在祭拜一位早已死去的帝尊，肉身根基+1');
      return true;
    }
    if (id === 'race_mediation') {
      roots.dao++;
      beatLine(g, log, 'god', pickVariant(g, id, [
        '太古万族再起冲突，你以帝律压下杀劫，道果根基+1',
        '人族与异族争抢古路，你各打五十，令双方退兵，道果根基+1',
        '你不许任何一族再以血祭沟通上苍，道果根基+1'
      ]));
      return true;
    }
    if (id === 'ancient_road') {
      roots.body++; roots.soul++;
      beatLine(g, log, 'ev4', '星空古路再度开启，你巡视沿途杀阵，以免后辈尽数葬身，肉身与元神根基各+1');
      return true;
    }
    if (id === 'underworld_edge') {
      roots.soul++;
      beatLine(g, log, 'rare', '你立于轮回海边缘，未踏入其中，却看清了神魂归处，元神根基+1');
      return true;
    }
    if (id === 'emperor_tomb') {
      roots.dao += 2;
      beatLine(g, log, 'god', '你为自己预留帝陵与传承，既是后手，也是对岁月的宣战，道果根基+2');
      return true;
    }
    if (id === 'blood_pact') {
      g.forbiddenKarma = Math.max(0, (g.forbiddenKarma || 0) - 1);
      roots.dao++;
      beatLine(g, log, 'rare', '你与一处禁区立下互不侵扰之约，杀意暂歇，道果根基+1');
      return true;
    }
    if (id === 'cosmos_bloom') {
      roots.body++; g.cult = round(g.cult * 1.015);
      beatLine(g, log, 'gain', '你重开一片死寂星域的生机，草木重生，肉身根基+1');
      return true;
    }
    if (id === 'nine_secret') {
      roots.dao++; gainDaoyun(g, 14);
      beatLine(g, log, 'god', '你参悟一记九秘残篇，未得全貌，却足以补全自身大道一角，道果根基+1');
      return true;
    }
    if (id === 'void_rift') {
      if (Math.random() < 0.7) {
        roots.body++; g.cult = round(g.cult * 1.02);
        beatLine(g, log, 'gain', '虚空裂隙中冲出一头太古凶物，你将其镇杀，肉身根基+1');
      } else {
        var riftLoss = irand(120, 360);
        g.emperorLifeEnd -= riftLoss; g.lifeBase -= riftLoss; syncLife(g);
        beatLine(g, log, 'dead', '虚空裂隙反噬，你以帝躯硬抗，帝命-' + riftLoss + '年');
      }
      return true;
    }
    if (id === 'reincarnation_dream') {
      roots.soul += 2;
      beatLine(g, log, 'rainbow', '你梦见尚未成帝时的红尘旧事，醒来后神魂更稳，元神根基+2');
      return true;
    }
    if (id === 'self_method') {
      roots.dao += 2; gainDaoyun(g, 20);
      beatLine(g, log, 'god', '第' + g.lifeNo + '世中，你抛开药物与外物，自创一缕长生法则，道果根基+2');
      return true;
    }
    if (id === 'reverse_deduction') {
      var nextLife = Math.min(D.RED_DUST_LIVES, (g.lifeNo || 1) + 1);
      var methods = ['', '', '帝血重生', '斩尽旧道·神胎再生', '元神化茧',
        '帝躯涅槃', '信仰神胎', '混沌重塑', '岁月蜕壳', '九世道果合一'];
      g.reverseMethodReadyFor = nextLife;
      g.reverseDaoBreakthroughLife = g.lifeNo;
      roots.dao += 2;
      if (nextLife === 4 || nextLife === 8) roots.soul += 2;
      else if (nextLife === 5 || nextLife === 7) roots.body += 2;
      else { roots.body++; roots.soul++; }
      gainDaoyun(g, irand(90, 160), irand(12, 28));
      beatLine(g, log, 'god', '你在第' + g.lifeNo + '世遭逢长生机缘，悟透『' +
        methods[nextLife] + '』的关键；下一世蜕变法已经明晰，道海桎梏随之松动');
      return true;
    }
    if (id === 'lonely_throne') {
      roots.soul++; roots.dao++;
      beatLine(g, log, 'rainbow', '第' + g.lifeNo + '世帝尊独立万古，连禁区也不再轻易睁眼，元神与道果根基各+1');
      return true;
    }
    /* ---------- 扩充片段：让九世帝命不至于反复听同几句话 ---------- */
    if (id === 'dao_prosper') {
      roots.dao++; gainDaoyun(g, irand(14, 26));
      g.cult = round(g.cult * rand(1.02, 1.05));
      beatLine(g, log, 'god', pickVariant(g, id, [
        '你证道之后天心愈发偏向你的道，诸天修士争相研习你的法，修行者破境竟因此加快，道果根基+1',
        '你所开创的道统在星空中蔓延，天心与之相合，后辈依你的法门修行事半功倍，道果根基+1',
        '万道之中你的一脉声势最盛，连大道运转都隐隐随之倾斜，道果根基+1'
      ]));
      return true;
    }
    if (id === 'saint_pilgrimage') {
      roots.soul++; gainDaoyun(g, irand(8, 16));
      beatLine(g, log, 'rainbow', pickVariant(g, id, [
        '万族圣者跨越星海来朝，帝宫外跪伏成片；你只讲了一句话便让他们各自悟道，元神根基+1',
        '诸圣地老祖联袂觐见，请你为其道统点评得失，元神根基+1',
        '一群自禁区边缘逃出的老古董前来投效，你收下他们的效忠，元神根基+1'
      ]));
      return true;
    }
    if (id === 'star_herding') {
      roots.body++; g.cult = round(g.cult * rand(1.02, 1.04));
      beatLine(g, log, 'ev4', pickVariant(g, id, [
        '你以星辰为牧，驱赶古星群穿越幽暗星海，肉身在星力冲刷中更加圆融，肉身根基+1',
        '你放牧星空万载，将一颗死寂古星重新点燃，肉身根基+1',
        '你在星海边缘圈养凶兽古族，为后世留下一片牧场，肉身根基+1'
      ]));
      return true;
    }
    if (id === 'race_ancestor') {
      roots.dao++; gainDaoyun(g, irand(10, 20));
      beatLine(g, log, 'rare', pickVariant(g, id, [
        '你造访一处太古万族祖地，与沉睡的古老意志对谈；那些异种的道与人族全然不同，却同样通向极致，道果根基+1',
        '你走进一片自封沉眠的古族禁地，读完了他们刻在骨壁上的全部传承，道果根基+1',
        '你唤醒一位化道边缘的圣灵，听他讲完一段无人记载的纪元，道果根基+1'
      ]));
      return true;
    }
    if (id === 'heaven_gate') {
      roots.dao++; gainDaoyun(g, irand(16, 30), 12);
      beatLine(g, log, 'god', pickVariant(g, id, [
        '你抬头望向上苍，感受到某种远在仙域之上的目光；你什么也没问出来，道蕴却因此暴涨，道果根基+1',
        '你以帝道之力叩问天穹，回应你的只有一段听不懂的古老音节，道果根基+1',
        '你顺着一线天光上行万里，终被无形之力挡回，却也窥见了更高处的轮廓，道果根基+1'
      ]));
      return true;
    }
    if (id === 'ancient_pact') {
      roots.soul++; legacy.pacts = (legacy.pacts || 0) + 1;
      beatLine(g, log, 'rare', pickVariant(g, id, [
        '你与数支自封的古族立下盟约：他们不再插手人间，你亦不掘其祖地，元神根基+1',
        '你为一族解开困扰其万载的血脉之劫，换来他们永世不背叛的承诺，元神根基+1',
        '你与妖族天庭划定疆界，此后星域再无族战，元神根基+1'
      ]));
      return true;
    }
    if (id === 'dao_war') {
      if (Math.random() < 0.72) {
        roots.dao++; g.cult = round(g.cult * rand(1.03, 1.06));
        beatLine(g, log, 'god', '有人另立道统欲与你分庭抗礼；你一路镇压过去，把万道重新压回自己这一脉，道果根基+1');
      } else {
        var warLoss = irand(120, 380);
        g.emperorLifeEnd -= warLoss; g.lifeBase -= warLoss; syncLife(g);
        beatLine(g, log, 'dead', '你镇压异端道统时被数位准帝联手拖住，虽终获胜，帝命-' + warLoss + '年');
      }
      return true;
    }
    if (id === 'fallen_friend') {
      roots.soul++; gainDaoyun(g, irand(10, 18));
      beatLine(g, log, 'dead', pickVariant(g, id, [
        '一位跟随你最久的旧部背弃了你的道，你没有杀他，只收回了赠他的法，元神根基+1',
        '你亲手废去一名叛离道统的传人，回帝宫后独坐了整整一纪，元神根基+1',
        '昔年并肩的故友投向禁区，你在星海尽头拦下他，只说了一句「好自为之」，元神根基+1'
      ]));
      return true;
    }
    if (id === 'emperor_seed') {
      roots.dao++; legacy.seeds = (legacy.seeds || 0) + 1;
      beatLine(g, log, 'rainbow', pickVariant(g, id, [
        '你把自身道种撒向诸天万界，不求他们成帝，只求这条路上还有后来人，道果根基+1',
        '你在数十座古星留下道痕，等着有缘人来取，道果根基+1',
        '你收了一名毫无根基的凡人为记名弟子，只因他的眼神像极了当年的自己，道果根基+1'
      ]));
      return true;
    }
    if (id === 'tomb_builder') {
      roots.body++; roots.dao++;
      beatLine(g, log, 'ev4', '你开始为自己修筑帝陵，把最凶险的杀阵留给后来的盗墓者，肉身与道果根基各+1');
      return true;
    }
    if (id === 'chaos_source') {
      roots.body++; gainDaoyun(g, irand(14, 24), 10);
      g.cult = round(g.cult * rand(1.02, 1.05));
      beatLine(g, log, 'god', '你深入混沌本源之地，以帝躯承受万道未分时的原始气息，肉身根基+1，道蕴上限增长');
      return true;
    }
    if (id === 'immortal_trace') {
      roots.dao++; gainDaoyun(g, irand(12, 22));
      if (!g.knowsStrangeWorld && Math.random() < 0.18) {
        learnStrangeWorld(g, log, '帝历' + (g.age - g.emperorAge) + '年，你顺着这缕仙迹一路追索，竟真的摸到了界壁坐标');
      } else {
        beatLine(g, log, 'rare', '你在一处古战场找到疑似仙人留下的痕迹，只余半个脚印，却让你的道果根基+1');
      }
      return true;
    }
    if (id === 'forbidden_dialogue') {
      g.forbiddenKarma = (g.forbiddenKarma || 0) + (Math.random() < 0.4 ? 1 : 0);
      roots.dao++;
      beatLine(g, log, 'ev4', pickVariant(g, id, [
        '一位沉睡的禁区至尊隔着万古与你对话；他劝你也去自斩，你没有答应，道果根基+1',
        '禁区深处传来一声叹息，那位至尊说他也曾像你这样想过，道果根基+1',
        '你与至尊隔空论了一场道，谁也没能说服谁，道果根基+1'
      ]));
      return true;
    }
    if (id === 'dao_purge') {
      if (legacy.lateAmbushes > 0 || (g.forbiddenKarma || 0) > 0) {
        g.forbiddenKarma = Math.max(0, (g.forbiddenKarma || 0) - 1);
        roots.body++;
        beatLine(g, log, 'god', '你按着旧账一路清算，把当年趁你衰弱时出手的人挨个找了出来，血债了结，肉身根基+1');
      } else {
        roots.soul++;
        beatLine(g, log, 'rare', '你翻看自己这一世的因果簿，发现竟无仇可寻，索性把它烧了，元神根基+1');
      }
      return true;
    }
    if (id === 'quasi_challenger') {
      var challengerWin = clamp(0.86 + Math.min(0.10, currentCombatPower(g) / 5000000), 0.80, 0.97);
      if (Math.random() < challengerWin) {
        roots.body++; gainDaoyun(g, irand(6, 14));
        beatLine(g, log, 'rainbow', '一位准帝九重的狂徒杀上帝宫，声称要以力证道；你一指镇之，又把他放走了，肉身根基+1');
      } else {
        var hurtYears = irand(200, 600);
        g.emperorLifeEnd -= hurtYears; g.lifeBase -= hurtYears; syncLife(g);
        beatLine(g, log, 'dead', '挑战者手中竟有一件极道帝兵，你虽压下此战，却被兵锋伤到本源，帝命-' + hurtYears + '年');
      }
      return true;
    }
    if (id === 'epoch_turn') {
      roots.dao++; gainDaoyun(g, irand(10, 20));
      beatLine(g, log, 'rare', '一个纪元悄然翻篇：你熟悉的族群尽数变异，新生的种族喊你作古老传说中的名字，道果根基+1');
      return true;
    }
    return false;
  }

  function strangeWorldLearnChance(g) {
    if (!g || g.knowsStrangeWorld) return 0;
    var years = g.worldYear || 0;
    if (g.forbiddenLord) {
      return clamp(0.28 + Math.min(0.62, years / 1800000 * 0.62), 0.28, 0.90);
    }
    var span = Math.max(1, (g.emperorLifeEnd || 0) - (g.emperorLifeStart || 0));
    var progress = span > 0 ? clamp(((g.age || 0) - (g.emperorLifeStart || 0)) / span, 0, 1) : 0;
    var lifeBonus = Math.min(0.018, Math.max(0, (g.lifeNo || 1) - 1) * 0.006);
    return clamp(0.030 + progress * 0.018 + lifeBonus, 0.030, 0.08);
  }

  function emperorEvent(g, log) {
    if (!g.knowsStrangeWorld && Math.random() < strangeWorldLearnChance(g) &&
        learnStrangeWorld(g, log, '帝历' + (g.age - g.emperorAge) + '年，你追索一处仙路裂隙，确认奇异世界真实存在，并记下界壁坐标')) {
      g.redDustRoots.dao++;
      return;
    }
    runEmperorExperience(g, pickEmperorBeat(g), log);
  }

  function hasGoldDaoGrowth(g) {
    return !!(g && g.tm && g.tm.daog >= 1.5);
  }

  function reverseMethodReady(g) {
    if (!g) return false;
    var targetLife = Math.min(D.RED_DUST_LIVES, (g.lifeNo || 1) + 1);
    if (targetLife <= 2) return true;
    return g.reverseMethodReadyFor === targetLife;
  }

  function reverseLifeChance(g) {
    var roots = g.redDustRoots;
    var total = roots.body + roots.soul + roots.dao;
    var targetLife = Math.min(D.RED_DUST_LIVES, g.lifeNo + 1);
    var absoluteNeed = targetLife === 2 ? 800 : 1200;
    var daoPeak = g.daoyunCap > 0 ? clamp(g.daoyun / g.daoyunCap, 0, 1) : 0;
    var absoluteRatio = clamp(g.daoyun / absoluteNeed, 0, 1);
    /* 难点在于每世悟出新法并重新填海；两者俱全后不再重复用低概率惩罚玩家。 */
    if (!reverseMethodReady(g)) return clamp(0.02 + daoPeak * 0.04, 0.02, 0.08);
    if (g.daoyun >= absoluteNeed && daoPeak >= 0.995) return 0.99;
    var prepared = Math.pow(daoPeak, 3) * Math.pow(absoluteRatio, 2);
    var chance = 0.04 + prepared * 0.80 + Math.min(0.05, total * 0.003);
    if (g.gotDiBing) chance += 0.01;
    chance += Math.min(0.10, createdArtN(g) * 0.022);
    return clamp(chance, 0.02, 0.94);
  }

  function tryReverseLife(g, log, confirmed, medicineUsed) {
    var targetLife = Math.min(D.RED_DUST_LIVES, g.lifeNo + 1);
    var rescued = !!medicineUsed;
    var success = rescued || confirmed || Math.random() < reverseLifeChance(g);
    if (!success) {
      g.dead = true; g.deadCause = 'reverse';
      push(log, { cls: 'dead', text: !reverseMethodReady(g) ?
        '第' + g.lifeNo + '世帝命燃尽，你始终未能从机缘中悟出下一世的全新蜕变法，道尽身灭' :
        '第' + g.lifeNo + '世帝命燃尽，你以' + Math.round(g.daoyun) + '/' + Math.round(g.daoyunCap) +
          '道蕴尝试逆夺造化，却因道海尚未圆满而在蜕变中道崩身灭' });
      return false;
    }
    var routes = ['帝血重生', '斩尽旧道·神胎再生', '元神化茧', '帝躯涅槃', '信仰神胎', '混沌重塑', '岁月蜕壳', '九世道果合一'];
    var route = rescued ? '不死神药续命' : routes[targetLife - 2];
    g.redDustRoutes = g.redDustRoutes || [];
    g.redDustRoutes.push(route);
    var capGrowth = [0, 0, 180, 300, 240, 220, 200, 180, 160, 140][targetLife] || 160;
    g.daoyunCap = Math.min(D.DAO_ABSOLUTE_MAX, g.daoyunCap + capGrowth);
    g.lifeNo = targetLife;
    g.redDustMarks = g.lifeNo - 1;
    g.cult = round(g.cult * rand(1.06, 1.16));
    push(log, { cls: 'rainbow', text: '帝命将尽，你以『' + route + '』逆活出第' + g.lifeNo + '世，凝成一枚红尘印；道蕴上限提高至' + g.daoyunCap + '，须在新一世开辟不同长生法' });
    if (g.lifeNo >= D.RED_DUST_LIVES) {
      g.redDustImmortal = true; g.ascended = true; g.immortalMode = 'nine_lives';
      g.cult = round(g.cult * 2);
      push(log, { cls: 'god', text: '九世道果合一，岁月再不能加身——你于万丈红尘中化作仙！' });
      return true;
    }
    resetEmperorLife(g);
    return true;
  }

  function openDeathlessChoice(g, log) {
    if (!g || !g.emperor || g.lifeNo !== 1 || !g.deathless || g.deathlessUsed ||
        g.deathlessChoiceResolved || g.awaitingDeathlessChoice) return false;
    g.awaitingDeathlessChoice = true;
    push(log, { cls: 'rainbow', text: '第一世帝命将尽，你封存的不死神药复苏：是否服下神药，直接续出第二世？' });
    return true;
  }

  function chooseDeathless(g, useMedicine, log) {
    if (!g || !g.awaitingDeathlessChoice) return false;
    g.awaitingDeathlessChoice = false;
    g.deathlessChoiceResolved = true;
    if (useMedicine) {
      g.deathlessUsed = true;
      g.reverseMedicineUsed = true;
      g.redDustPath = 'reverse';
      push(log, { cls: 'rainbow', text: '你服下不死神药，枯竭帝血重新奔涌，以药力续出第二世；第三世起必须摆脱药物，自创长生法' });
      return tryReverseLife(g, log, true, true);
    }
    push(log, { cls: 'rare', text: '你没有服用不死神药，选择保留它，以自身道果继续面对帝命终点' });
    finishEmperorLife(g, log, true);
    return true;
  }

  function reversePathChance(g) {
    var daoPeak = g.daoyunCap > 0 ? g.daoyun / g.daoyunCap : 0;
    if (daoPeak < 0.85) return 0;
    var roots = g.redDustRoots || { body: 0, soul: 0, dao: 0 };
    var balance = Math.min(roots.body, roots.soul, roots.dao);
    var chance = 0.70 + (daoPeak - 0.85) / 0.15 * 0.18;
    if (g.daoyun >= 800) chance += 0.04;
    if (balance >= 1) chance += 0.04;
    if (g.cult >= 800000) chance += 0.03;
    return clamp(chance, 0.70, 0.95);
  }

  /* 不死天皇的蜕变进度取决于玩家何时打进来：
   * 第一、二世就轰开界壁的，遇到的多半是三至五世的天皇；
   * 拖到后几世、拖过百万年才入界的，对手已经多活了几世。 */
  function undeadEmperorMean(worldYear, lifeNo) {
    var byLife = Math.min(1.6, Math.max(0, (lifeNo || 1) - 1) * 0.42);
    var byYear = Math.min(1.8, Math.max(0, worldYear || 0) / 1500000 * 1.8);
    return 3.8 + byLife + byYear;
  }
  function undeadEmperorForRoll(r, worldYear, ctx) {
    ctx = ctx || {};
    var lifeNo = ctx.lifeNo || 1;
    /* 红尘仙级的天皇是真正的意外，早期入界几乎不可能撞上。 */
    var immortalChance = clamp(0.002 + Math.max(0, worldYear || 0) / 20000000 * 0.06 +
      Math.max(0, lifeNo - 1) * 0.004, 0, 0.08);
    if (r >= 1 - immortalChance) return { lives: 9, cult: 8000000, immortal: true };
    var mean = undeadEmperorMean(worldYear, lifeNo);
    var weights = [], total = 0, i;
    for (i = 2; i <= 8; i++) {
      var w = Math.exp(-Math.pow(i - mean, 2) / (2 * 1.1 * 1.1));
      weights.push(w); total += w;
    }
    var scaled = r / (1 - immortalChance), cumulative = 0;
    var cults = [1650000, 2100000, 2550000, 3000000, 3600000, 4300000, 5200000];
    for (i = 0; i < weights.length; i++) {
      cumulative += weights[i] / total;
      if (scaled < cumulative) return { lives: i + 2, cult: cults[i] };
    }
    return { lives: 8, cult: 5200000 };
  }

  /* 单人永远杀不死不死天皇：极限配置最多相持或逼退，真正斩杀只能靠与无始联手。 */
  function canSlayUndead(g) {
    return !!(g && g.strangeWorldAlliance === 'wushi');
  }
  function undeadRepelChance(g) {
    var ratio = strangeWorldPowerRatio(g);
    if (ratio < 0.85) return 0;
    var dao = clamp((g.daoyun || 0) / D.DAO_ABSOLUTE_MAX, 0, 1);
    var peak = isPeakPhysique(g.physiqueId) ? 0.10 : 0;
    return clamp((ratio - 0.85) * 0.55 + dao * 0.28 + peak, 0, 0.80);
  }

  function undeadStageText(g) {
    return g.undeadImmortal ? '已踏入红尘仙境' : '已活出第' + g.undeadLives + '世';
  }

  function strangeWorldSituationForRoll(r) {
    if (r < 0.10) return 'quiet';
    if (r < 0.80) return 'undead';
    return 'standoff';
  }

  function strangeWorldBattleChance(g, withWushi) {
    var boss = g.undeadCult || D.UNDEAD_EMPEROR_CULT;
    var ratio = currentCombatPower(g) / boss;
    var chance;
    if (ratio < 0.40) chance = 0.01;
    else if (ratio < 0.60) chance = 0.03 + (ratio - 0.40) * 0.60;
    else if (ratio < 0.80) chance = 0.15 + (ratio - 0.60) * 1.50;
    else if (ratio < 1.00) chance = 0.45 + (ratio - 0.80) * 1.25;
    else if (ratio < 1.25) chance = 0.70 + (ratio - 1.00) * 0.80;
    else chance = 0.90 + Math.min(0.08, (ratio - 1.25) * 0.08);
    var roots = g.redDustRoots;
    var total = roots.body + roots.soul + roots.dao;
    chance += Math.min(0.08, total * 0.003);
    chance += Math.min(0.05, (g.tm.ward + pval(g, 'ward', 0)) / 500);
    if (withWushi) chance += 0.28;
    return clamp(chance, 0.01, 0.98);
  }

  function strangeWorldPowerRatio(g) {
    var boss = (g && g.undeadCult) || D.UNDEAD_EMPEROR_CULT;
    return boss > 0 ? currentCombatPower(g) / boss : 0;
  }
  function strangeWorldAmbushChance(g) {
    var ratio = strangeWorldPowerRatio(g);
    var wardBonus = Math.min(0.08, ((g.tm && g.tm.ward) || 0) / 100 + pval(g, 'ward', 0) / 100);
    var chance;
    if (ratio < 0.40) chance = 0.04 + ratio * 0.10;
    else if (ratio < 0.70) chance = 0.08 + (ratio - 0.40) * 0.70;
    else if (ratio < 0.90) chance = 0.29 + (ratio - 0.70) * 1.20;
    else if (ratio < 1.10) chance = 0.53 + (ratio - 0.90) * 1.10;
    else chance = 0.75 + Math.min(0.17, (ratio - 1.10) * 0.40);
    return clamp(chance + wardBonus, 0.03, 0.95);
  }

  function applyStrangeAmbushWound(g) {
    g.cult = round(g.cult * rand(0.60, 0.72));
    g.daoyun = round(g.daoyun * 0.80);
    g.daoyunCap = Math.max(1, round(g.daoyunCap * 0.92));
    g.strangeWorldInsight = Math.max(0, (g.strangeWorldInsight || 0) - 20);
    var roots = g.redDustRoots;
    roots.body = Math.max(0, roots.body - 1);
    roots.soul = Math.max(0, roots.soul - 1);
    roots.dao = Math.max(0, roots.dao - 1);
  }

  function resolveUndeadHide(g, log, span) {
    var years = span || irand(5000, 20000);
    var add = irand(8, 15);
    g.strangeWorldInsight = (g.strangeWorldInsight || 0) + add;
    g.cult = round(g.cult * rand(1.03, 1.07));
    gainDaoyun(g, 8);
    push(log, { cls: 'rare', text: '五色天刀余威未散，你收敛帝道气机，藏入奇异世界的法则褶皱蛰伏' + years + '年；长生感悟+' + add + '，实力暗增至' + g.cult });
    return true;
  }

  function resolveUndeadHunt(g, log) {
    var survive = strangeWorldAmbushChance(g);
    var ratio = strangeWorldPowerRatio(g);
    push(log, { cls: 'ev4', text: '不死天皇' + undeadStageText(g) + '循着气机追杀而来；战力差距下，逃生把握约' + Math.round(survive * 100) + '%' });
    if (Math.random() >= survive) {
      g.dead = true; g.deadCause = 'undead_emperor';
      push(log, { cls: 'dead', text: '你未能拉开与五色天刀的距离，终被不死天皇截杀于奇异世界' });
      return false;
    }
    /* 极限配置可以正面相持并把天皇逼退，但杀不死他：不死之身要靠无始牵制才可能斩断。 */
    var repel = undeadRepelChance(g);
    if (repel > 0 && Math.random() < repel) {
      g.undeadRepelled = true;
      g.undeadHunting = false;
      g.cult = round(g.cult * rand(1.03, 1.08));
      g.strangeWorldInsight = (g.strangeWorldInsight || 0) + 14;
      push(log, { cls: 'god', text: '你反身硬撼五色天刀，以自身极道与之相持；不死天皇伤而不死，暂时退入此界深处，追杀就此中断' });
      return true;
    }
    if (ratio < 0.95) applyStrangeAmbushWound(g);
    else g.cult = round(g.cult * rand(0.94, 0.98));
    push(log, { cls: 'dead', text: '你再次从五色天刀下逃脱，却奈何不了不死之身；此后只能隐匿发育，或设法找到能牵制他的人' });
    return true;
  }

  function enterStrangeWorld(g, log) {
    g.redDustPath = 'strange_world';
    g.inStrangeWorld = true;
    g.forbiddenLord = false;
    g.strangeWorldYears = 0;
    g.strangeWorldInsight = 0;
    g.strangeWorldEvents = 0;
    g.strangeWorldAlliance = null;
    g.strangeWorldThreatKnown = false;
    g.undeadHunting = false;
    g.undeadRepelled = false;
    g.awaitingStrangeWorldChoice = false;
    g.strangeWorldImmortalAttempts = 0;
    if (g.playerEmperorActive) {
      g.playerEmperorActive = false;
      markDaoTraces(g, g.worldYear || 0);
    }
    var situationRoll = Math.random();
    g.strangeWorldSituation = strangeWorldSituationForRoll(situationRoll);
    if (g.strangeWorldSituation !== 'quiet') {
      var enemy = undeadEmperorForRoll(Math.random(), g.worldYear || 0, { lifeNo: g.lifeNo || 1 });
      g.undeadLives = enemy.lives;
      g.undeadCult = enemy.cult;
      g.undeadImmortal = !!enemy.immortal;
    } else {
      g.undeadLives = 0;
      g.undeadCult = 0;
      g.undeadImmortal = false;
    }
    push(log, { cls: 'god', text: '你轰开界壁，踏入一方长生物质更为浓郁的浩瀚天地；前路与此界强者皆不可知' });
  }

  function chooseStrangeWorldAlliance(g, choice, log) {
    if (!g || !g.awaitingStrangeWorldChoice || (choice !== 'wushi' && choice !== 'hide')) return false;
    g.awaitingStrangeWorldChoice = false;
    g.strangeWorldAlliance = choice;
    if (choice === 'wushi') {
      push(log, { cls: 'god', text: '你不再旁观，现身与无始大帝并肩；两道帝威共同牵制那名强敌，约定各自成仙后再决最终一战' });
    } else {
      push(log, { cls: 'rare', text: '你收敛一切帝道气机，远遁奇异世界深处，决定暂不卷入两位绝世强者的漫长对峙' });
    }
    return true;
  }

  function finishStrangeWorldBattle(g, log, withWushi) {
    var chance = strangeWorldBattleChance(g, withWushi);
    if (Math.random() >= chance) {
      g.dead = true;
      g.deadCause = 'undead_emperor';
      g.redDustImmortal = false;
      g.immortalMode = null;
      push(log, { cls: 'dead', text: withWushi ?
        '你与无始大帝联手血战，仍未能挡住对手跨越数世积累的五色天刀，仙躯崩灭于奇异世界' :
        '隐藏的强敌循着成仙波动杀至，你独战五色天刀，最终仙躯崩灭' });
      return false;
    }
    /* 只有与无始联手才谈得上斩杀；独自获胜只是挡下这一刀、逼其退走。 */
    if (withWushi && canSlayUndead(g)) {
      g.defeatedUndead = true;
      g.ascended = true;
      push(log, { cls: 'god', text: '你已蜕变红尘仙，与无始大帝前后夹击，终于斩断那具不死之身，结束这场持续万古的对峙！' });
      return true;
    }
    g.undeadRepelled = true;
    g.ascended = true;
    push(log, { cls: 'god', text: '你以新成红尘仙之身挡下五色天刀，将不死天皇逼退；你杀不死他，他一时也奈何不了你' });
    return true;
  }

  function strangeWorldImmortalityChance(g) {
    var daoPeak = g.daoyunCap > 0 ? g.daoyun / g.daoyunCap : 0;
    var roots = g.redDustRoots.body + g.redDustRoots.soul + g.redDustRoots.dao;
    var chance = 0.10 + Math.min(0.16, daoPeak * 0.16) + Math.min(0.08, roots * 0.003) +
      Math.min(0.08, Math.max(0, g.strangeWorldInsight - 80) * 0.0016);
    if (g.strangeWorldAlliance === 'wushi') chance += 0.04;
    chance += Math.min(0.10, createdArtN(g) * 0.025);
    return clamp(chance, 0.12, 0.72);
  }

  function tryStrangeWorldImmortality(g, log) {
    if ((g.strangeWorldImmortalAttempts || 0) >= 2) return false;
    g.strangeWorldImmortalAttempts = (g.strangeWorldImmortalAttempts || 0) + 1;
    var chance = strangeWorldImmortalityChance(g);
    if (Math.random() >= chance) {
      if (g.strangeWorldImmortalAttempts >= 2) {
        g.dead = true; g.deadCause = 'strange_world_tribulation';
        push(log, { cls: 'dead', text: '第二次红尘仙蜕变仍告失败，积累的道伤彻底爆发，道果与仙台一同崩散' });
      } else {
        g.strangeWorldInsight = Math.max(55, g.strangeWorldInsight - 30);
        g.cult = round(g.cult * 0.9);
        push(log, { cls: 'dead', text: '第一次冲击红尘仙境失败，帝躯与道果重创；你只剩最后一次完整蜕变机会' });
      }
      return false;
    }
    g.redDustImmortal = true;
    g.immortalMode = 'strange_world';
    g.cult = round(g.cult * rand(1.7, 2.1));
    push(log, { cls: 'rainbow', text: '你将漫长岁月的感悟熔于一炉，帝躯、元神与大道同时蜕变，终于踏入红尘仙境！' });

    if (g.strangeWorldSituation === 'standoff' && g.strangeWorldAlliance === 'wushi') {
      return finishStrangeWorldBattle(g, log, true);
    }
    if (g.strangeWorldSituation === 'undead' && !g.defeatedUndead) {
      return finishStrangeWorldBattle(g, log, false);
    }
    if (g.strangeWorldSituation === 'standoff' && g.strangeWorldAlliance === 'hide' && Math.random() < 0.35) {
      push(log, { cls: 'ev4', text: '成仙引发的万道波动暴露了你的藏身地，那名驾驭五色天刀的强敌横空杀至！' });
      return finishStrangeWorldBattle(g, log, false);
    }
    g.ascended = true;
    push(log, { cls: 'god', text: '你没有卷入未知强者的大战，在奇异世界深处开辟仙土，自此岁月不加身' });
    return true;
  }

  function stepStrangeWorld(g, log) {
    if (g.awaitingStrangeWorldChoice) return;
    var span = irand(5000, 20000);
    g.age += span;
    advanceWorldCalendar(g, span, null);
    g.strangeWorldYears += span;
    g.strangeWorldEvents++;

    if (g.strangeWorldSituation === 'standoff' && !g.strangeWorldAlliance) {
      g.strangeWorldThreatKnown = true;
      g.awaitingStrangeWorldChoice = true;
      push(log, { cls: 'ev4', text: '你在奇异世界深处发现两道对峙万古的身影：无始大帝正牵制一位沐浴五色神光、' + undeadStageText(g) + '的恐怖强者' });
      if (_fast) chooseStrangeWorldAlliance(g, 'hide', log);
      return;
    }

    if (g.strangeWorldSituation === 'undead' && !g.strangeWorldThreatKnown &&
        (g.strangeWorldEvents >= 3 || Math.random() < 0.30)) {
      g.strangeWorldThreatKnown = true;
      var ratioToUndead = strangeWorldPowerRatio(g);
      var survive = strangeWorldAmbushChance(g);
      push(log, { cls: 'ev4', text: '一柄五色天刀撕裂虚空，你这才发现不死天皇' + undeadStageText(g) +
        '，并在暗中巡视此界！此处没有其他强者牵制，战力越接近对方越容易逃生，当前把握约' + Math.round(survive * 100) + '%' });
      if (Math.random() >= survive) {
        g.dead = true; g.deadCause = 'undead_emperor';
        push(log, { cls: 'dead', text: '你尚未来得及参透此界长生奥秘，便被突如其来的五色天刀斩灭' });
        return;
      }
      g.undeadHunting = true;
      if (ratioToUndead < 1) {
        applyStrangeAmbushWound(g);
        push(log, { cls: 'dead', text: '你燃烧帝血才从五色天刀下逃得一命，却未能击杀不死天皇：实力重创至' + g.cult +
          '，当前道蕴与个人上限分别跌至' + Math.round(g.daoyun) + '/' + Math.round(g.daoyunCap) +
          '。此后此界随机机缘将变成追杀与隐匿发育，直至你反杀成功' });
      } else {
        g.strangeWorldInsight += 12;
        push(log, { cls: 'god', text: '你以不弱于对方的帝道修为避开绝杀，却仍未将其击杀；五色天刀开始循着气机猎杀，你只能隐匿发育或等待反杀' });
      }
      return;
    }

    /* 逼退只是暂时的：不死之身养好伤，迟早会再找上门。 */
    if (g.undeadRepelled && !g.undeadHunting && !g.defeatedUndead && Math.random() < 0.22) {
      g.undeadHunting = true;
      push(log, { cls: 'ev4', text: '被逼退的不死天皇再度涅槃归来，五色天刀的气息又一次锁定了你' });
      return;
    }

    if (g.undeadHunting && !g.defeatedUndead && Math.random() < 0.85) {
      if (Math.random() < 0.55) resolveUndeadHunt(g, log);
      else resolveUndeadHide(g, log, span);
      if (g.dead) return;
      if (!g.dead && (g.strangeWorldInsight >= 100 || g.strangeWorldEvents >= 18)) {
        tryStrangeWorldImmortality(g, log);
      }
      return;
    }

    if (g.strangeWorldAlliance === 'wushi' && Math.random() < 0.18) {
      var clash = clamp(0.50 + g.cult / g.undeadCult * 0.20 +
        (g.tm.ward + pval(g, 'ward', 0)) / 250, 0.50, 0.82);
      if (Math.random() >= clash) {
        if (Math.random() < 0.12) {
          g.dead = true; g.deadCause = 'undead_emperor';
          push(log, { cls: 'dead', text: '你驰援无始大帝时遭五色天刀锁定，帝躯与元神一并被斩灭' });
        } else {
          g.cult = round(g.cult * 0.82);
          push(log, { cls: 'dead', text: '你与无始大帝共同抵挡五色天刀，却在碰撞中遭受重创，实力跌至' + g.cult });
        }
      } else {
        g.strangeWorldInsight += 8;
        g.cult = round(g.cult * 1.025);
        push(log, { cls: 'god', text: '你与无始大帝联手挡下一次五色天刀袭杀，从仙道碰撞中获得长生感悟+8' });
      }
      return;
    }

    var r = Math.random(), add;
    if (r < 0.24) {
      add = irand(9, 16); g.strangeWorldInsight += add; g.cult = round(g.cult * rand(1.025, 1.06));
      push(log, { cls: 'gain', text: '你炼化此界长生物质' + span + '年，长生感悟+' + add + '，实力精进至' + g.cult });
    } else if (r < 0.44) {
      add = irand(6, 12); g.strangeWorldInsight += add; g.daoyunCap = Math.min(D.DAO_ABSOLUTE_MAX, g.daoyunCap + 32); gainDaoyun(g, 12);
      push(log, { cls: 'rainbow', text: '你观摩奇异世界的完整法则，道蕴上限+32，长生感悟+' + add });
    } else if (r < 0.61) {
      var safe = clamp(0.58 + (g.tm.ward + pval(g, 'ward', 0)) / 120, 0.58, 0.90);
      if (Math.random() < safe) {
        add = irand(7, 13); g.strangeWorldInsight += add; g.redDustRoots.body++;
        push(log, { cls: 'god', text: '奇异世界的长生风暴席卷仙土，你以帝躯硬抗而过，肉身根基+1，长生感悟+' + add });
      } else {
        g.cult = round(g.cult * 0.88);
        push(log, { cls: 'dead', text: '你被奇异世界的长生风暴重创，实力跌落至' + g.cult + '，不得不蛰伏疗伤' });
      }
    } else if (r < 0.80) {
      add = irand(8, 14); g.strangeWorldInsight += add; g.redDustRoots.soul++;
      push(log, { cls: 'ev4', text: '你在古老仙土中寻得前人蜕变遗痕，元神根基+1，长生感悟+' + add });
    } else if (r < 0.90) {
      add = irand(5, 10); g.strangeWorldInsight += add; g.redDustRoots.dao++;
      if (g.strangeWorldAlliance === 'wushi') g.strangeWorldInsight += 3;
      push(log, { cls: 'rare', text: '万载岁月流转，你在此界重演自身帝法，道果根基+1，长生感悟+' + add });
    } else {
      var danger = ['奇异世界的法则风暴撕开你的闭关地', '古代强者循着帝道气机袭杀而来', '异界法则反噬旧日道果', '熔炼长生物质时修行失控'][irand(0, 3)];
      var dangerSafe = clamp(0.42 + (g.tm.ward + pval(g, 'ward', 0)) / 120 + g.cult / 10000000, 0.42, 0.82);
      if (Math.random() >= dangerSafe && Math.random() < 0.45) {
        g.dead = true; g.deadCause = 'strange_world_accident';
        push(log, { cls: 'dead', text: danger + '；你未能熬过这场毫无征兆的仙道灾劫，帝躯与元神俱灭' });
        return;
      }
      g.cult = round(g.cult * 0.84);
      g.strangeWorldInsight = Math.max(0, g.strangeWorldInsight - 12);
      push(log, { cls: 'dead', text: danger + '；你虽侥幸脱身，却留下严重道伤，实力与长生感悟一并受损' });
    }

    if (!g.dead && (g.strangeWorldInsight >= 100 || g.strangeWorldEvents >= 18)) {
      tryStrangeWorldImmortality(g, log);
    }
  }

  function canChooseImmortalPath(g) {
    return !!(g.knowsStrangeWorld && g.cult >= D.STRANGE_WORLD_BREAK_CULT && !g.waitingImmortalRoad);
  }
  function openImmortalPathChoice(g, log) {
    if (!canChooseImmortalPath(g) || g.awaitingImmortalPath) return false;
    g.awaitingImmortalPath = true;
    push(log, { cls: 'rainbow', text: '你已掌握奇异世界坐标，且战力足以轰开界壁：是踏入未知世界寻找长生，还是继续等待虚无缥缈的成仙路？' });
    /* 批量校准没有前台可供点击，默认进入未知世界继续事件链。 */
    if (_fast) chooseImmortalPath(g, 'strange', log);
    return true;
  }
  function canOpenImmortalRoad(g) {
    return !!(g && g.waitingImmortalRoad && (g.worldYear || 0) >= (D.IMMORTAL_ROAD_MIN_YEAR || 3600000));
  }
  function immortalRoadAppearChance(g) {
    if (!canOpenImmortalRoad(g)) return 0;
    if (g.forbiddenLord) return 0.10;
    var span = Math.max(1, (g.emperorLifeEnd || 0) - (g.emperorLifeStart || 0));
    return (D.IMMORTAL_ROAD_EVENT_TARGET || 0.08) / span;
  }
  function immortalRoadChance(g) {
    var daoPeak = g && g.daoyunCap > 0 ? g.daoyun / g.daoyunCap : 0;
    var chance = 0.010 + Math.min(0.045, (g && g.cult || 0) / 8000000 * 0.045) +
      Math.min(0.025, daoPeak * 0.025);
    chance += Math.min(0.025, createdArtN(g) * 0.006);
    return clamp(chance, 0.008, 0.12);
  }
  function tryImmortalRoad(g, log) {
    if (!canOpenImmortalRoad(g)) return false;
    var chance = immortalRoadChance(g);
    push(log, { cls: 'rainbow', text: '近一纪元后，成仙路终于自虚无中显现；你携帝道冲关，凭当前战力与道蕴，横渡把握约' + Math.round(chance * 100) + '%' });
    if (Math.random() >= chance) {
      g.dead = true; g.deadCause = 'immortal_road';
      push(log, { cls: 'dead', text: '成仙路崩裂，你未能跨过那一道天堑，帝躯消散于仙路尽头' });
      return false;
    }
    g.redDustImmortal = true; g.ascended = true; g.immortalMode = 'immortal_road';
    g.cult = round(g.cult * rand(1.8, 2.3));
    push(log, { cls: 'god', text: '你横渡成仙路，万法归一，终成红尘仙！' });
    return true;
  }
  function chooseImmortalPath(g, path, log) {
    if (!g || !g.awaitingImmortalPath) return false;
    g.awaitingImmortalPath = false;
    if (path === 'strange') {
      push(log, { cls: 'god', text: '你不再等待，轰开界壁，主动打入奇异世界！' });
      enterStrangeWorld(g, log);
    } else {
      g.waitingImmortalRoad = true;
      push(log, { cls: 'rare', text: '你放弃眼前奇异世界之门，选择静候成仙路；此路需近一纪元、数百万年才可能显现，一世帝命几乎等不到' });
    }
    return true;
  }

  /* ---------- 自斩禁区：以帝位换取沉睡岁月；只能作为绝境退路，不能再走九世逆活 ---------- */
  function chooseSelfSlash(g, slash, log) {
    if (!g || !g.awaitingSelfSlash) return false;
    g.awaitingSelfSlash = false;
    if (!slash) {
      g.selfSlashDeclined = true;
      push(log, { cls: 'god', text: '帝命将尽，你拒绝自斩，不愿舍弃皇道果位；将以完整帝身继续寻找长生路' });
      return true;
    }
    if (!g.xianSource && !g.primordialStone) {
      g.selfSlashDeclined = true;
      push(log, { cls: 'dead', text: '你遍寻宇宙却未得仙源或太初命石，无法承载自斩后的残缺帝躯' });
      return true;
    }
    g.selfSlashed = true;
    g.forbiddenLord = true;
    var seal = g.xianSource ? '仙源' : '太初命石';
    g.forbiddenEssence = g.xianSource ? 3 : 2;
    if (g.xianSource && g.primordialStone) g.forbiddenEssence = 4;
    g.sealingMaterial = g.xianSource && g.primordialStone ? '仙源与太初命石' : seal;
    g.xianSource = false; g.primordialStone = false;
    g.forbiddenKarma = 0;
    g.redDustPath = 'forbidden';
    g.xintian = false;
    g.playerEmperorActive = false;
    markDaoTraces(g, g.worldYear || 0);
    g.cult = round(g.cult * 0.75);
    push(log, { cls: 'dead', text: '你自斩一刀，皇道果位残缺，战力跌落至' + g.cult + '；以' + g.sealingMaterial + '自封，化为一代禁区至尊' });
    push(log, { cls: 'rainbow', text: '禁区之路：拥有' + g.forbiddenEssence + '道生命本源，可跨数十万乃至百万年沉睡；但封印仍会衰减，且已永失九世逆活之资格' });
    return true;
  }

  function forbiddenBattleChance(g) {
    var ratio = g.cult / 1800000;
    return clamp(0.05 + ratio * 0.32 + (g.tm.ward + pval(g, 'ward', 0)) / 500 - g.forbiddenKarma * 0.06, 0.05, 0.72);
  }

  function forbiddenPurgeChance(karma, hasEmperor) {
    if (!hasEmperor) return 0;
    var chances = [0.16, 0.25, 0.35, 0.48, 0.65];
    return chances[Math.min(4, Math.max(0, karma || 0))];
  }

  function forbiddenSleepRange(g) {
    if (g && g.sealingMaterial === '仙源与太初命石') return [250000, 600000];
    if (g && g.sealingMaterial === '仙源') return [150000, 400000];
    return [80000, 220000];
  }

  function startForbiddenSleep(g, log) {
    var range = forbiddenSleepRange(g);
    var sleep = irand(range[0], range[1]);
    g.forbiddenSleepLeft = sleep;
    g.forbiddenSleepTotal = sleep;
    push(log, { cls: 'rare', text: '你以' + g.sealingMaterial + '封源，沉入禁区岁月；此番约莫要睡去' + sleep + '年' });
  }

  function forbiddenSleepChunk(g) {
    var left = g.forbiddenSleepLeft || 0;
    if (left <= 0) return 0;
    if (_fast) return left;
    return Math.min(left, Math.max(8000, Math.min(irand(12000, 30000), Math.ceil(left / 6))));
  }

  function resolveForbiddenWake(g, log) {
    g.forbiddenEssence--;
    push(log, { cls: 'rare', text: '你封于' + g.sealingMaterial + '，沉睡' + (g.forbiddenSleepTotal || 0) + '年后于万古历' + g.worldYear + '年苏醒；生命本源余' + g.forbiddenEssence + '道，' +
      (g.worldEmperor ? '此世天心有主' : '此世尚无大帝') });
    g.forbiddenSleepLeft = 0;
    g.forbiddenSleepTotal = 0;
    if (!g.knowsStrangeWorld && Math.random() < strangeWorldLearnChance(g)) {
      learnStrangeWorld(g, log, '你从仙路残片与古代至尊遗骸中，终于获知奇异世界坐标');
    }
    if (g.waitingImmortalRoad && Math.random() < immortalRoadAppearChance(g)) {
      tryImmortalRoad(g, log);
      return;
    }
    if (canChooseImmortalPath(g)) {
      openImmortalPathChoice(g, log);
      return;
    }
    if (g.forbiddenEssence <= 0) {
      g.awaitingDarkTurmoil = true; g.forcedDarkTurmoil = true;
      push(log, { cls: 'dead', text: '封印中的长生物质已经耗尽。你只能选择发动黑暗动乱补充本源，或拒绝屠戮并在下一次岁月侵蚀中坐化' +
        (g.worldEmperor ? '；但当世有帝，出世极可能立刻引发帝战' : '；此世无帝，眼下无人能够正面阻止你') });
      if (_fast) chooseDarkTurmoil(g, false, log);
      return;
    }
    if (Math.random() < forbiddenPurgeChance(g.forbiddenKarma, !!g.worldEmperor)) {
      var battle = forbiddenBattleChance(g);
      var coalition = g.forbiddenKarma >= 3;
      push(log, { cls: 'ev4', text: coalition ?
        '累世血债震动宇宙，当世大帝联合诸帝道统与极道兵器围剿禁区；你以残缺帝躯迎战，胜算约' + Math.round(battle * 100) + '%' :
        '当世大帝循着血债前来平定禁区，你以残缺帝躯迎战，胜算约' + Math.round(battle * 100) + '%' });
      if (Math.random() >= battle) {
        g.dead = true; g.deadCause = 'forbidden_battle';
        push(log, { cls: 'dead', text: coalition ? '你被诸帝道统合力镇杀，禁区与累世血债一并清算' : '你被当世大帝镇杀，禁区崩毁，万古谋划尽成空' });
        return;
      }
      g.cult = round(g.cult * rand(1.08, 1.16));
      push(log, { cls: 'god', text: coalition ? '你浴血击退诸帝道统的围剿，残缺皇道再度复苏，实力升至' + g.cult :
        '你击退当世大帝，残缺皇道在血战中复苏，实力升至' + g.cult });
    } else if (Math.random() < 0.55) {
      g.awaitingDarkTurmoil = true;
      push(log, { cls: 'dead', text: '你苏醒的年代众生鼎盛，禁区本源却在流失：是否发动黑暗动乱，吞纳众生精气续命？' });
      if (_fast) chooseDarkTurmoil(g, false, log);
      return;
    } else {
      g.cult = round(g.cult * rand(1.04, 1.09));
      push(log, { cls: 'gain', text: '你于神源中推演残缺皇道，虽未补全帝位，实力仍精进至' + g.cult });
    }
    if (!g.dead && canChooseImmortalPath(g)) {
      openImmortalPathChoice(g, log);
    }
  }

  function stepForbiddenLord(g, log) {
    if (g.awaitingDarkTurmoil || g.awaitingImmortalPath) return;
    if ((g.forbiddenSleepLeft || 0) > 0) {
      var tick = forbiddenSleepChunk(g);
      g.age += tick;
      advanceWorldCalendar(g, tick, _fast ? null : log);
      g.forbiddenSleepLeft -= tick;
      if (g.forbiddenSleepLeft > 0) {
        push(log, { cls: 'gain', text: '禁区岁月无声，又过' + tick + '年。万古历' + g.worldYear + '年，距苏醒尚余' + g.forbiddenSleepLeft + '年' });
        return;
      }
      resolveForbiddenWake(g, log);
      return;
    }
    if (g.forbiddenEssence <= 0) {
      g.dead = true; g.deadCause = 'forbidden_exhausted';
      push(log, { cls: 'dead', text: g.sealingMaterial + '中的长生物质耗尽，你的禁区再也无法封存生机，残缺帝躯最终化作尘埃' });
      return;
    }
    startForbiddenSleep(g, log);
    if (_fast) stepForbiddenLord(g, log);
  }

  function chooseDarkTurmoil(g, start, log) {
    if (!g || !g.awaitingDarkTurmoil) return false;
    g.awaitingDarkTurmoil = false;
    if (!start) {
      push(log, { cls: 'god', text: '你压下长生欲念，拒绝发动黑暗动乱；禁区继续沉寂于岁月中' });
      return true;
    }
    g.forbiddenKarma++;
    g.forbiddenEssence = Math.min(4, g.forbiddenEssence + 1);
    g.cult = round(g.cult * rand(1.12, 1.20));
    push(log, { cls: 'dead', text: '你发动黑暗动乱，吞纳众生精气，生命本源+1、实力攀升至' + g.cult + '；血债+' + g.forbiddenKarma });
    if (g.worldEmperor && Math.random() < Math.min(0.98, 0.78 + g.forbiddenKarma * 0.05)) {
      var battle = forbiddenBattleChance(g);
      push(log, { cls: 'ev4', text: '黑暗动乱惊醒当世大帝，对方横渡星空而来；帝战当即爆发，你的胜算约' + Math.round(battle * 100) + '%' });
      if (Math.random() >= battle) {
        g.dead = true; g.deadCause = 'forbidden_battle';
        push(log, { cls: 'dead', text: '你尚未吞纳足够生命精气，便被当世大帝镇杀；禁区与累世血债一并清算' });
        return true;
      }
      g.cult = round(g.cult * rand(1.08, 1.16));
      push(log, { cls: 'god', text: '你以残缺皇道击退当世大帝，却也让此世永远记住了这笔血债' });
    }
    g.forcedDarkTurmoil = false;
    return true;
  }

  function finishEmperorLife(g, log, skipDeathlessChoice) {
    if (!skipDeathlessChoice && openDeathlessChoice(g, log)) {
      if (_fast) chooseDeathless(g, g.redDustPath === 'reverse', log);
      return;
    }
    if (g.redDustPath === 'reverse') {
      tryReverseLife(g, log);
      return;
    }
    if (g.waitingImmortalRoad) {
      g.dead = true; g.deadCause = 'waited_immortal_road';
      push(log, { cls: 'dead', text: '帝命耗尽，成仙路需近一纪元才会开启，此世终究等不到；你错过奇异世界之门，最终坐化' });
      return;
    }
    if (Math.random() < reversePathChance(g)) {
      g.redDustPath = 'reverse';
      push(log, { cls: 'rainbow', text: '帝命将尽，你悟出一条前无古人的九世蜕变之路，决定不入奇异世界，以己身逆夺长生！' });
      tryReverseLife(g, log);
      return;
    }
    if (!g.knowsStrangeWorld) {
      g.dead = true; g.deadCause = 'no_strange_world_info';
      push(log, { cls: 'dead', text: '帝命燃尽，你至死也未能寻到仙域或奇异世界的确切坐标，只得坐化于人间' });
      return;
    }
    if (g.cult < D.STRANGE_WORLD_BREAK_CULT) {
      g.dead = true; g.deadCause = 'cannot_break_world';
      push(log, { cls: 'dead', text: '你虽已掌握奇异世界坐标，但当前实力未达' + Math.round(D.STRANGE_WORLD_BREAK_CULT / 10000) + '万，无法轰穿界壁，最终帝命耗尽' });
      return;
    }
    enterStrangeWorld(g, log);
  }

  function emperorTickSize(g) {
    var remaining = g.emperorLifeEnd - g.age;
    if (remaining <= 200) return 1;
    return Math.max(1, Math.min(irand(500, 2000), Math.floor(remaining / 8)));
  }

  function stepEmperor(g, log) {
    if (g.inStrangeWorld) { stepStrangeWorld(g, log); return; }
    if (g.forbiddenLord) { stepForbiddenLord(g, log); return; }
    if (g.awaitingDeathlessChoice) return;
    if (g.awaitingImmortalPath) return;
    if (g.waitingImmortalRoad) {
      if (Math.random() < immortalRoadAppearChance(g)) { tryImmortalRoad(g, log); return; }
    } else if (canChooseImmortalPath(g)) {
      openImmortalPathChoice(g, log);
      return;
    }
    if (!g.selfSlashOffered && !g.selfSlashed && !g.selfSlashDeclined && g.lifeNo === 1 &&
        g.age >= g.emperorLifeEnd - 200) {
      g.selfSlashOffered = true;
      if (_fast) { g.selfSlashDeclined = true; return; }
      g.awaitingSelfSlash = true;
      push(log, { cls: 'rainbow', text: '帝命只余百年：是保全皇道、继续求仙，还是自斩一刀、入主禁区？' });
      return;
    }
    if (g.awaitingSelfSlash) return;
    var tick = emperorTickSize(g);
    g.age += tick - 1;
    advanceWorldCalendar(g, tick - 1, log);
    gainDaoyun(g, emperorDaoyunGainPerYear(g) * tick);
    g.cult = round((g.cult || 0) + emperorCultGainPerYear(g) * tick);
    var span = Math.max(1, g.emperorLifeEnd - g.emperorLifeStart);
    if (Math.random() < D.EMPEROR_EVENT_TARGET * tick / span) emperorEvent(g, log);
    if (g.age >= g.emperorLifeEnd) finishEmperorLife(g, log);
  }
  /* 隐藏加成：获得过极道帝兵 / 不死药 者，证道判定时临时提升判定战力各 5%（各只算一次，不实际改战力） */
  function zhengdaoEff(g) {
    var m = 1;
    if (g.gotDiBing) m *= 1.05;   /* 曾获得极道帝兵 */
    if (g.deathless) m *= 1.05;   /* 曾获得不死药（含已服用） */
    if (g.resonanceState && g.resonanceState.overflowDao > 0) {
      m *= 1 + Math.min(0.15, g.resonanceState.overflowDao / 1000);
    }
    return currentCombatPower(g) * m;
  }
  /* 道蕴版重伤退回：没有命格词条的人，靠道基厚度硬扛下帝关反噬，一生仅一次。
   * 代价比 spendImperialRetry 重得多——那是金卡效果，这是所有人的保底。
   * 门槛按实测填充度标定：凡体/悟性10 均值 0.421 过得去，
   * 凡体/悟性5（0.220）与荒古圣体/悟性8（0.213）过不去，圣体另有战力那条线兜底。 */
  var DAO_RETREAT_FILL = 0.38;
  function tryDaoRetreat(g, log) {
    if (!g || g.daoRetreatUsed) return false;
    if (daoFill(g) < DAO_RETREAT_FILL) return false;
    g.daoRetreatUsed = true;
    g.cult = round(g.cult * 0.55);
    g.daoyun = Math.max(0, g.daoyun * 0.75);
    g.lifeBase = Math.max(g.age + 200, g.lifeBase - irand(400, 900));
    syncLife(g);
    g.emperorAttemptAge = g.age + irand(400, 900);
    push(log, { cls: 'rare', text: '第' + g.age + '岁，帝关反噬如天倾而下。你没有硬扛，' +
      '而是在道基碎裂的最后一瞬收了势，任那股力道把自己轰出关外。' +
      '一身修为去了近半，道蕴也散了一截，但人还活着——闭关至第' + g.emperorAttemptAge + '岁，再叩一次' });
    return true;
  }

  function spendImperialRetry(g, log) {
    if (!g.tm || g.tm.retry <= 0) return false;
    g.tm.retry--;
    if (g.resonanceState) g.resonanceState.imperialRetryUsed = true;
    var keepRate = 1 - 0.28 * (1 - (g.tm.retryKeep || 0));
    g.cult = round(g.cult * keepRate);
    g.daoyun = Math.max(0, g.daoyun * 0.9);
    g.lifeBase = Math.max(g.age + 300, g.lifeBase - irand(300, 800));
    syncLife(g);
    g.emperorAttemptAge = g.age + irand(300, 800);
    push(log, { cls: 'rainbow', text: '帝关破碎，你以命格护住真灵，保留一次重修机会；' +
      (keepRate >= 0.999 ? '全部战力得以保留，但道蕴与寿元仍有损耗' : '实力受损') +
      '，闭关至第' + g.emperorAttemptAge + '岁再争帝路' });
    return true;
  }
  /* ---------- 帝关：判定与展示共用同一套数 ----------
   * 冲关时机交给玩家之后，弹窗上写的成功率必须就是掷骰用的那个数，
   * 所以三条分支的概率各自抽成纯函数，tryZhengdao 与 imperialGateInfo 都从这里取。 */
  /* 凡体破灭看 110 万；圣体再叠有帝，要过 135 万才谈得上压帝。 */
  function overwhelmNeed(g) {
    return isHuangguSacred(g) ? D.SACRED_OVERWHELM_CULT : D.OVERWHELM_DAO_CULT;
  }
  /* 混沌成帝是大概率，不是保送。战力曲线本身可到 99%，体质 zhx 再一加就顶满。 */
  var CHAOS_ZHENGDAO_CAP = 0.84;
  function chaosZhengdaoCap(g, p) {
    if (g && g.physiqueId === 'chaos') return Math.min(p, CHAOS_ZHENGDAO_CAP);
    return p;
  }
  function overwhelmProb(g, eff, extra) {
    return chaosZhengdaoCap(g, clamp(0.35 + (eff - D.OVERWHELM_DAO_CULT) / 600000 + extra +
      (g.tm.ignoreSuppression || 0), 0.35, 1));
  }
  function zhengdaoLateScale(g) {
    var latePenalty = g.age > D.EMPEROR_PATH_FADE_AGE ?
      1 - 0.5 * (g.age - D.EMPEROR_PATH_FADE_AGE) / (D.EMPEROR_PATH_CLOSE_AGE - D.EMPEROR_PATH_FADE_AGE) : 1;
    var daoPenalty = g.daoSuppressed && !isPeakPhysique(g.physiqueId) ? 0.15 : 1;
    return Math.max(0.5, latePenalty) * daoPenalty;
  }
  /* 凡体绝世悟性可走「以道证帝」：不靠蛮力硬撼帝关，而以完整道果换取有限但真实的成功率。
   * 仅对低体质生效，避免混沌体叠加后把证帝变成必然。 */
  function pureDaoBonusOf(g) {
    return (g.innate <= 2 && pureDaoPath(g)) ?
      ((g.daoGift - 8) * 0.10 + Math.min(0.22, g.daoyun / D.DAO_ABSOLUTE_MAX * 0.22)) : 0;
  }
  function forceZhengdaoProb(g, eff, extra) {
    var lateScale = zhengdaoLateScale(g);
    var raw = isHuangguSacred(g) ? sacredEmperorChance(g) * lateScale :
      Math.min(1, (zhengdaoChance(eff) + extra + pureDaoBonusOf(g) + daoZhengdaoBonus(g)) * lateScale);
    return chaosZhengdaoCap(g, raw);
  }
  /* 天心融合线是每次现掷的 need，展示时按均匀分布算出「掷到能融的那一段」的概率。 */
  function tianxinScale(g) {
    var red = clamp(g.tm.dlm + pval(g, 'dlm', 0), 0, 90);
    var fade = g.age > D.EMPEROR_PATH_FADE_AGE ?
      1 + 0.3 * (g.age - D.EMPEROR_PATH_FADE_AGE) / (D.EMPEROR_PATH_CLOSE_AGE - D.EMPEROR_PATH_FADE_AGE) : 1;
    var suppression = g.daoSuppressed && !isPeakPhysique(g.physiqueId) ?
      1 + 0.5 * (1 - (g.tm.ignoreSuppression || 0)) : 1;
    return (1 - red / 100) * fade * suppression;
  }
  function tianxinFuseProb(g, eff) {
    var k = tianxinScale(g);
    if (!(k > 0)) return 1;
    return clamp((eff / k - D.XINTIAN_NEED_MIN) / (D.XINTIAN_NEED_MAX - D.XINTIAN_NEED_MIN), 0, 1);
  }

  /* 叩关前的全景：挡在门前的原因、走哪条路、总成功率。UI 与自动决策都用它。 */
  function imperialGateInfo(g) {
    var info = { block: null, mode: 'force', odds: 0, fatal: true, daoNeed: 0 };
    if (!g) return info;
    if (!g.worldEmperor && tracesStillActive(g)) { info.block = 'traces'; return info; }
    var need = effectiveDaoyunNeed(g, 99);
    if ((g.lvl || 1) >= 99 && need && g.daoyun < need) {
      info.block = 'daoyun'; info.daoNeed = need; return info;
    }
    var extra = g.tm.zhx + pval(g, 'zhx', 0) + (g.planEdge || 0);
    var eff = zhengdaoEff(g);
    if (g.worldEmperor) {
      info.mode = 'overwhelm';
      if (currentCombatPower(g) < overwhelmNeed(g)) { info.block = 'suppress'; return info; }
      info.odds = overwhelmProb(g, eff, extra);
      return info;
    }
    /* 九重天持天心：先赌一次融合，融不了再退回以力证道，两段叠加才是真实把握。
     * 混沌体除外——天心融合线对它等于保送，改走盖过帽的以力证道。 */
    if (g.xintian && !isHuangguSacred(g) && (g.lvl || 1) >= 99) {
      info.mode = 'tianxin';
      if (g.physiqueId === 'chaos') {
        info.odds = forceZhengdaoProb(g, eff, extra);
        return info;
      }
      var pFuse = tianxinFuseProb(g, eff);
      info.odds = clamp(pFuse + (1 - pFuse) * forceZhengdaoProb(g, eff, extra), 0, 1);
      return info;
    }
    info.odds = forceZhengdaoProb(g, eff, extra);
    return info;
  }

  /* ---------- 叩关时机由玩家决定 ----------
   * 旧式是到了准帝九重天就闭关 10~40 年自动去撞帝关，哪怕寿元还剩两三千年。
   * 高悟性反而吃亏：他们破境快、到九重天时很年轻，却被立刻推去送死，
   * 一身机缘都还没攒够——实测悟性10 的准帝九重战力比悟性8 还低，倒挂就是这么来的。
   * 现在改成弹窗：如实给出当前把握，玩家自己决定是叩还是再压几百年。 */
  var GATE_FORCE_LIFE = 60;      /* 寿元只剩这么点，没得选了 */
  var GATE_AUTO_ODDS = 0.55;     /* 自动决策：把握过半就叩 */
  var GATE_AUTO_RESERVE = 400;   /* 自动决策：寿元剩这么多以下就别等了 */
  var GATE_ODDS_STEP = 0.08;     /* 成功率涨了这么多，才值得再问一次 */

  /* 压关年数按「现在挡路的是什么」现算，禁止一律 80~220。
   * 否则余寿两三千年的人会被弹十几次——那不是抉择，是骚扰。 */
  function imperialGateWaitYears(g) {
    var room = Math.max(0, g.lifespan - g.age - GATE_FORCE_LIFE);
    if (room <= 0) return 0;
    var info = imperialGateInfo(g);
    var left = Math.max(0, g.lifespan - g.age);
    var want;
    if (info.block === 'traces' && g.daoTraceUntil != null) {
      want = g.daoTraceUntil - (g.worldYear || 0) + irand(8, 30);
    } else if (info.block === 'suppress' && g.worldEmperor) {
      var untilEmp = g.worldEmperor.end - (g.worldYear || 0);
      var power = currentCombatPower(g);
      /* 已经摸到破灭线八成五：可能靠机缘补上，不必干等到大帝坐化 */
      want = power >= overwhelmNeed(g) * 0.85 ?
        Math.min(untilEmp, Math.max(240, room * 0.22)) :
        untilEmp + irand(8, 30);
    } else if (info.block === 'daoyun' && info.daoNeed) {
      var gap = info.daoNeed - (g.daoyun || 0);
      var rate = (g.daoyun || 0) / Math.max(80, g.age || 1);
      want = rate > 0.02 ? gap / rate * 1.1 : room * 0.4;
      want = Math.min(want, room * 0.55);
    } else {
      var odds = info.odds || 0;
      if (odds < 0.12) want = room * 0.50;
      else if (odds < 0.28) want = room * 0.36;
      else if (odds < 0.45) want = room * 0.26;
      else want = room * 0.16;
      if ((g.imperialGateWaits || 0) >= 2) want = Math.max(want, room * 0.42);
    }
    /* 最短也要按余寿的一截来，杜绝「过两年又弹一次」 */
    var minWait = Math.min(room, Math.max(160, Math.round(left * 0.10)));
    if (!(want > 0)) want = minWait;
    return clamp(Math.round(want), Math.min(minWait, room), room);
  }
  function imperialGateWaitReason(g) {
    var info = imperialGateInfo(g);
    if (info.block === 'traces') return '等前代帝痕散尽';
    if (info.block === 'suppress') {
      return isHuangguSacred(g) ?
        '等当世大帝坐化，或把战力压过圣体破灭的' + Math.round(D.SACRED_OVERWHELM_CULT / 10000) + '万' :
        '等当世大帝坐化，或攒到破灭万道的战力';
    }
    if (info.block === 'daoyun') return '等道蕴补齐';
    if (!g.worldEmperor && (info.odds || 0) >= 0.35) return '再等下去，或有旁人捷足先登';
    if ((info.odds || 0) < 0.20) return '把握尚浅，先把道基养厚';
    if ((info.odds || 0) < 0.40) return '再积一截战力与道蕴';
    return '再磨一磨，等更有把握时再叩';
  }

  function imperialGateForced(g) {
    return !g || (g.lifespan - g.age) <= GATE_FORCE_LIFE;
  }
  function imperialGateSnapshot(g) {
    var info = imperialGateInfo(g);
    return {
      block: info.block || '',
      mode: info.mode,
      odds: Math.round((info.odds || 0) * 1000),
      we: g.worldEmperor ? (g.worldEmperor.end || 1) : 0,
      traces: tracesStillActive(g) ? 1 : 0,
      cultBand: Math.round(currentCombatPower(g) / 80000),
      daoBand: Math.round((g.daoyun || 0) / 120)
    };
  }
  /* 局面没变就不要再弹：成功率没明显上涨、挡路的还是那块、当世大帝也没换。 */
  function imperialGateChanged(g) {
    var prev = g.imperialGateSeen;
    if (!prev) return true;
    if (imperialGateForced(g) || (g.lifespan - g.age) <= GATE_AUTO_RESERVE) return true;
    var now = imperialGateSnapshot(g);
    if (now.block !== prev.block || now.mode !== prev.mode) return true;
    if (now.we !== prev.we || now.traces !== prev.traces) return true;
    /* 成功率涨满一截才问。战力小涨会被事件年年触发，再按战力分档就会刷屏。 */
    if (now.odds - prev.odds >= GATE_ODDS_STEP * 1000) return true;
    return false;
  }
  /* 自动决策：把握够了、等不起了、或再等也抬不高（圣体上限到不了 55%）就叩。
   * 门是封的时候绝不能替玩家去送死——那是 0%，不是悲壮。 */
  function imperialGateAutoStrike(g) {
    var info = imperialGateInfo(g);
    if (info.block) return false;
    if (imperialGateForced(g)) return true;
    if ((g.lifespan - g.age) <= GATE_AUTO_RESERVE) return true;
    /* 无帝之世已经有四成把握：再压会被路人帝把窗口堵死。 */
    if (!g.worldEmperor && !isHuangguSacred(g) && info.odds >= 0.42) return true;
    if (info.odds >= GATE_AUTO_ODDS) return true;
    if (isHuangguSacred(g) && info.odds >= 0.28 && (g.imperialGateWaits || 0) >= 1) return true;
    return false;
  }
  function imperialGateWait(g, log) {
    var reason = imperialGateWaitReason(g);
    var years = imperialGateWaitYears(g);
    if (!(years > 0)) years = 1;
    g.emperorAttemptAge = g.age + years;
    g.imperialGateWaits = (g.imperialGateWaits || 0) + 1;
    g.imperialGateSeen = imperialGateSnapshot(g);
    push(log, { cls: 'rare', text: '第' + g.age + '岁，你在帝关前站了很久，终究转身退了回去。' +
      reason + '——闭关至第' + g.emperorAttemptAge + '岁再看' });
  }
  registerChoiceHandler('imperial_gate', function (g, optionId, log) {
    if (optionId === 'wait') { imperialGateWait(g, log); return; }
    tryZhengdao(g, log);
  });
  /* 帝关弹窗一生最多两窗。再问只在「门从封到开」或寿元将尽。问多了就是作业。 */
  var GATE_ASK_MAX = 2;
  function imperialGateMayAsk(g) {
    if (imperialGateForced(g)) return false;
    var asks = (g && g.imperialGateAsks) || 0;
    if (asks < GATE_ASK_MAX) return true;
    var prev = g && g.imperialGateSeen;
    var info = imperialGateInfo(g);
    if (prev && prev.block && !info.block) return true;
    return false;
  }
  /* 返回 true 表示本年的叩关决策已经交出去了（弹窗挂起，或自动决策已当场结算）。 */
  function openImperialGateChoice(g, log) {
    if (imperialGateForced(g)) return false;    /* 不给选了；封门时由 stepYear 跳过硬闯，走寿尽 */
    if (!imperialGateMayAsk(g)) {
      var hold = imperialGateWaitYears(g);
      if (hold > 0) {
        g.emperorAttemptAge = g.age + hold;
        return true;
      }
      return false;
    }
    /* 到期了但局面没变：默默再压一截，不弹第二次一模一样的窗 */
    if (g.imperialGateSeen && !imperialGateChanged(g)) {
      var silent = imperialGateWaitYears(g);
      if (silent > 0) {
        g.emperorAttemptAge = g.age + silent;
        return true;
      }
      return false;
    }
    var info = imperialGateInfo(g);
    var left = Math.max(0, Math.round(g.lifespan - g.age));
    var years = imperialGateWaitYears(g);
    var desc;
    if (info.block === 'traces') desc = '前代帝道烙印未消，万道仍被镇压，此刻叩关必然无功';
    else if (info.block === 'daoyun') desc = '道蕴仅 ' + Math.round(g.daoyun) + '/' + info.daoNeed + '，还撑不开帝关';
    else if (info.block === 'suppress') desc = isHuangguSacred(g) ?
      '当世有帝，圣体诅咒未解，战力尚未及圣体破灭的' + Math.round(D.SACRED_OVERWHELM_CULT / 10000) + '万，此时硬闯是送死' :
      '当世有帝镇压万道，你的战力尚未及破灭万道的门槛，此时硬闯是送死';
    else if (info.mode === 'overwhelm') desc = isHuangguSacred(g) ?
      '当世有帝，你已压过圣体诅咒，此去是要破灭万道、以帝压帝' :
      '当世有帝，此去是要破灭万道、以帝压帝';
    else if (info.mode === 'tianxin') desc = '你身怀天心，可先试融合，融不成再以力强撼';
    else desc = '无帝之世，以力证道，成则万古一帝';
    var strikeLabel = info.block ? '仍要叩关（几无生机）' : '即刻叩关';
    g.imperialGateSeen = imperialGateSnapshot(g);
    g.imperialGateAsks = ((g.imperialGateAsks || 0) + 1);
    openChoice(g, log, {
      id: 'imperial_gate',
      title: '帝关',
      prompt: '第' + g.age + '岁，你立于帝关之前。' + desc + '。',
      info: '当前战力 ' + Math.round(currentCombatPower(g) / 10000) + '万 · 道蕴 ' +
        Math.round(g.daoyun) + '/' + Math.round(g.daoyunCap) + ' · 余寿 ' + left + ' 年' +
        (info.block ? '' : ' · 叩关把握 ' + pctText(info.odds)) +
        ((g.planEdge || 0) > 0 ? ' · 谋划 +' + pctText(g.planEdge) : ''),
      note: '叩关多半只有一次。这一生最多再问你一次；局面没变就闭关，不再弹窗。',
      cls: 'rainbow',
      options: [
        { id: 'strike', label: strikeLabel, risk: 'deadly',
          chance: info.block ? 0 : info.odds, auto: imperialGateAutoStrike(g) || undefined },
        { id: 'wait', label: '再压一压：' + imperialGateWaitReason(g) +
            '（约 ' + years + ' 年）',
          safe: true, detail: '闭关期间照常积累，局面有变才会再问' }
      ]
    });
    return true;
  }

  function tryZhengdao(g, log) {
    function deferImperialAttempt(years) {
      g.emperorAttemptAge = g.age + irand(years || 300, (years || 300) * 2);
    }
    var extra = g.tm.zhx + pval(g, 'zhx', 0) + (g.planEdge || 0);
    var eff = zhengdaoEff(g);     /* 判定用战力：含隐藏的帝兵/不死药加持 */
    if (!g.worldEmperor && tracesStillActive(g)) {
      push(log, { cls: 'rare', text: '第' + g.age + '岁，前代帝道烙印尚未消散，万道仍被镇压，此世无人能证道' });
      var traceWait = imperialGateWaitYears(g);
      if (traceWait > 0) g.emperorAttemptAge = g.age + traceWait;
      else deferImperialAttempt(300);
      return false;
    }
    if (isHuangguSacred(g) && g.lvl >= 99) completeSacredBody(g, log);
    var emperorDaoNeed = effectiveDaoyunNeed(g, 99);
    if (g.lvl >= 99 && emperorDaoNeed && g.daoyun < emperorDaoNeed) {
      push(log, { cls: 'rare', text: '第' + g.age + '岁，准帝九重已至，然道蕴仅' + Math.round(g.daoyun) +
        '/' + emperorDaoNeed + '，尚不足以叩开帝关' });
      var daoWait = imperialGateWaitYears(g);
      if (daoWait > 0) g.emperorAttemptAge = g.age + daoWait;
      else deferImperialAttempt(250);
      return false;
    }
    if (g.worldEmperor) {
      if (currentCombatPower(g) < overwhelmNeed(g)) {
        if (spendImperialRetry(g, log)) return true;
        var needWan = Math.round(overwhelmNeed(g) / 10000);
        push(log, { cls: 'dead', text: '第' + g.age + '岁，当世已有大帝镇压万道' +
          (isHuangguSacred(g) ? '，圣体诅咒未解' : '') +
          '；你的实际战力' + Math.round(currentCombatPower(g) / 10000) +
          '万尚未达到' + (isHuangguSacred(g) ? '圣体破灭' : '破灭万道') + '的' + needWan +
          '万硬门槛，帝兵等外物无法代替自身道行，帝关在道压中崩碎' });
        g.dead = true; g.deadCause = 'world_emperor_suppression';
        return true;
      }
      var overwhelmChance = overwhelmProb(g, eff, extra);
      if (Math.random() < overwhelmChance) {
        var oldEmperorName = g.worldEmperor.name;
        becomeDi(g, log, 'overwhelm');
        g.cult = Math.max(g.cult, D.HEAVENLY_EMPEROR_CULT);
        push(log, { cls: 'god', text: '第' + g.age + '岁，你以破灭万道之力压过' + oldEmperorName +
          '，在有帝之世逆天证道；初成帝便拥有天帝级战力！' });
        return true;
      }
      if (spendImperialRetry(g, log)) return true;
      push(log, { cls: 'dead', text: '第' + g.age + '岁，你强闯当世帝道，终究未能破灭万道，在两种帝则碰撞中身陨' });
      g.dead = true; g.deadCause = 'overwhelm_failed';
      return true;
    }
    /* 天心也不能给荒古圣体开后门：天道不容圣体成帝，仍要过那道万古难关。 */
    if (g.xintian && !isHuangguSacred(g)) {
      var need = Math.max(1, Math.round(irand(D.XINTIAN_NEED_MIN, D.XINTIAN_NEED_MAX) * tianxinScale(g)));
      /* 准帝九重天即已走到帝关前，战力达标后融合天心必成。
       * 混沌体不走这条保送，仍按盖过帽的以力证道掷。 */
      if (g.lvl >= 99 && eff >= need && g.physiqueId !== 'chaos') {
        becomeDi(g, log, 'tianxin');
        push(log, { cls: 'god', text: '第' + g.age + '岁，天心合一，我道即天道，证道成帝！' });
        return true;
      }
      /* 九重天后战力未达融合线：回退以力证道，不再走十五成的强融死门。 */
      if (g.lvl < 99) {
        if (Math.random() < D.TIANXIN_EARLY_CHANCE) {
          becomeDi(g, log, 'tianxin');
          push(log, { cls: 'god', text: '第' + g.age + '岁，虽然没有修炼到圆满，但你还是尝试融合天心，成功证道！' });
          return true;
        }
        if (spendImperialRetry(g, log)) return true;
        push(log, { cls: 'dead', text: '第' + g.age + '岁，虽然没有修炼到圆满，但你还是尝试融合天心，失败身陨' });
        g.dead = true; g.deadCause = 'zhengdao';
        return true;
      }
    }
    /* 无天心：以力证道（按判定战力查概率曲线） */
    var pureDaoBonus = pureDaoBonusOf(g);
    var prob = forceZhengdaoProb(g, eff, extra);
    if (Math.random() < prob) {
      becomeDi(g, log, 'force');
      push(log, { cls: 'god', text: isHuangguSacred(g) ?
        '第' + g.age + '岁，你以荒古圣体逆天而行，硬生生破开天道不容的帝关，证道成帝！' :
        (pureDaoBonus > 0 ?
        '第' + g.age + '岁，你以万古悟性熔炼自身道果，不借外力而证道成帝！' :
        '第' + g.age + '岁，一力降万法，强行证道，破开帝关！') });
      return true;
    }
    if (spendImperialRetry(g, log)) return true;
    if (tryDaoRetreat(g, log)) return true;
    push(log, { cls: 'dead', text: isHuangguSacred(g) ?
      '第' + g.age + '岁，天道不容圣体成帝，帝关反噬，身死道消' :
      '第' + g.age + '岁，冲击帝关失败，大道反噬，身死道消' });
    g.dead = true; g.deadCause = 'zhengdao';
    return true;
  }

  /* 不死药：寿元将尽（剩≤20年）时服下，再活一世（仅一次） */
  function tryDeathless(g, log) {
    if (!g.deathless || g.deathlessUsed) return false;
    if (g.lifespan - g.age > 20) return false;
    g.deathlessUsed = true;
    g.lifeBase = Math.round(g.lifespan * 2) - g.lifeBonus;
    syncLife(g);
    push(log, { cls: 'rainbow', text: '第' + g.age + '岁，寿元将尽，服下不死药，逆天夺命，再活一世！寿元焕发' });
    return true;
  }

  /* ---------- 初始化一局：drawTalent 抽体质 → applyTraits 注入词条 ---------- */
  function createGame(playerLv, traitIds, giftOpt) {
    var t = drawTalent(playerLv);
    var gift = (giftOpt && giftOpt.tier) ?
      { tier: giftOpt.tier, name: giftOpt.name || daoGiftName(giftOpt.tier), initialDaoyun: giftOpt.initialDaoyun } :
      drawDaoGift();
    var g = {
      innate: t.innate,
      aptitude: t.innate,
      physiqueId: t.physique ? t.physique.id : 'mortal',
      physiqueName: t.physique ? t.physique.name : t.talent,
      pm: t.physique ? t.physique.fx : {},
      lvl: 1,
      cult: irand(t.innate, t.innate * 10),
      lifeBase: irand(D.LIFE_MIN, D.LIFE_MAX),
      lifeBonus: 0,
      lifespan: 0,
      age: 6,
      year: 0,
      maxCount: {},
      createdArts: [], createdMethods: 0, fortuneHeat: 0, artGlimpse: false, artHomework: false,
      choiceByRealm: {},
      realmEnterAge: { 1: 6 },
      realmSeenBand: 1, realmSeenIds: {}, realmSeenTags: {},
      eventDraws: 0, eventDrawsBySpan: {}, spotlightCount: 0, imperialGateAsks: 0, planScore: 0, planEdge: 0,
      recentEvents: [], pendingChoice: null,
      eventChains: {},
      dead: false, ascended: false, emperor: false, becameEmperor: false, redDustImmortal: false,
      emperorAge: 0, emperorAttemptAge: 0, emperorLifeStart: 0, emperorLifeEnd: 0, lifeNo: 0, redDustMarks: 0,
      redDustRoots: { body: 0, soul: 0, dao: 0 }, redDustRoutes: [], redDustPath: null, immortalMode: null,
      reverseMethodReadyFor: 0, reverseDaoBreakthroughLife: 0,
      inStrangeWorld: false, strangeWorldYears: 0, strangeWorldInsight: 0, strangeWorldEvents: 0, strangeWorldImmortalAttempts: 0,
      strangeWorldSituation: null, strangeWorldAlliance: null, strangeWorldThreatKnown: false,
      awaitingStrangeWorldChoice: false, undeadHunting: false, undeadLives: 0, undeadCult: 0, undeadImmortal: false, defeatedUndead: false,
      ascendMode: null, deadCause: null,
      daoSuppressed: false,
      worldYear: 0, worldHistory: [], worldEmperor: null, worldEmperorSeq: 0,
      nextWorldEmperorYear: null, playerEmperorActive: false, daoTraceUntil: null,
      xintian: false, deathless: false, deathlessUsed: false, reverseMedicineUsed: false,
      awaitingDeathlessChoice: false, deathlessChoiceResolved: false, emperorDeathlessGranted: false,
      sacredPeakAwakened: false,
      xianSource: false, primordialStone: false, sealingMaterial: '',
      knowsStrangeWorld: false,
      awaitingSelfSlash: false, selfSlashOffered: false, selfSlashDeclined: false, selfSlashed: false,
      awaitingDarkTurmoil: false, forcedDarkTurmoil: false, awaitingImmortalPath: false, waitingImmortalRoad: false,
      forbiddenLord: false, forbiddenEssence: 0, forbiddenKarma: 0,
      forbiddenSleepLeft: 0, forbiddenSleepTotal: 0,
      traits: [],
      daoGift: gift.tier,
      daoGiftName: gift.name,
      daoyun: Math.max(gift.initialDaoyun || daoGiftDaoyun(gift.tier), baseDaoyun(t.innate)),
      daoyunCap: Math.max(daoGiftCap(gift.tier), baseDaoyunCap(t.innate)),
      era: null, swallowingArt: false, swallowState: null, swallowReady: false,
      traitPaths: [], resonance: null,
      resonanceState: { bodyUsed: false, overflowDao: 0, eventUpgraded: false, tianxinPity: 0, imperialRetryUsed: false },
      tm: {
        evf: 1, evt: 1, xin: 1, ward: 0, zhx: 0, dlm: 0, daog: 1, era: 1, retry: 0,
        retryKeep: 0, bodyChance: 0, bodyDao: 0, overflow: 0, upgradeEvent: 0,
        xinPity: 0, ignoreSuppression: 0
      }
    };
    syncLife(g);
    applyTraits(g, traitIds);
    g.era = drawEra(g.tm.era);
    initWorldCalendar(g);
    return g;
  }

  /* 寿尽要像这一世的收束，不能只写三个字坐化。停处不同、身子不同，句子就不同。 */
  function ageSettleTitle(g) {
    var lvl = (g && g.lvl) || 1;
    if (g && g.cutDaoTried && !g.cutDaoPassed) return '斩道止步';
    if (g && g.saintTried && !g.saintPassed) return '止步圣位';
    if (lvl < 21) return '苦海坐化';
    if (lvl < 41) return '四极坐化';
    if (lvl < 56) return '仙台坐化';
    if (lvl < 60) return '大能坐化';
    if (lvl === 60) return '斩道未斩';
    if (lvl < 70) return '王者坐化';
    if (lvl === 70) return '圣位之前';
    if (lvl < 91) return '圣位坐化';
    if (lvl < 99) return '准帝坐化';
    return '帝关之前';
  }
  function ageEpitaph(g) {
    if (!g) return '寿元耗尽，坐化';
    var lvl = g.lvl || 1;
    var phy = g.physiqueName || '这具身子';
    var gift = g.daoGift != null ? g.daoGift : 5;
    var line;
    if (lvl < 21) line = phy + '这一世，苦海那口气没匀开。第四极的门，你连边都没摸到';
    else if (lvl < 41) line = '第四极那口气一直差一截。' + phy + '把蒲团坐热了，寿元自己先散了';
    else if (lvl < 56) line = '仙台的窗户纸还在。' + phy + '坐到灯油尽了，纸也没破';
    else if (lvl < 60) line = '同境有人靠血脉走过去。你把息调到最后一夜，还是停在大能';
    else if (lvl === 60 && g.cutDaoTried && !g.cutDaoPassed) {
      line = g.cutNearMiss
        ? (g.cutDaoRekindled
          ? '刀意回过一次，还是差那一线。这一世停在斩道门口'
          : '这一刀只差一线。刀意还在骨头里，只是没能再燃起来')
        : '大能巅峰那一刀没落下去。这一世的名字，停在斩道门口';
    } else if (lvl === 60) line = '刀在膝上，寿元先到。这一世没斩，也没回头';
    else if (lvl < 70) line = '过了那一刀，王者内层把你留下来了。' + phy + '再往前，没有第二口寿元';
    else if (lvl === 70 && g.saintTried && !g.saintPassed) {
      line = '过了斩道，也大多过不了圣位。你看见了另一种生命，却没踏进去';
    } else if (lvl === 70) line = '圣位在前，蒲团还是热的。灯油尽了';
    else if (lvl < 91) line = '圣位之上，够格的机缘没来。你把灯油坐干了';
    else if (lvl < 99) line = '准帝的路还没走完。这一世先把自己坐化了';
    else line = '帝关在前，寿元先尽。你没有硬闯，只是坐化在门下';
    if (gift <= 2 && lvl < 60) line += '。悟性钝，靠的是坐，坐也有尽头';
    else if (gift >= 7 && lvl < 70) line += '。心里有法，寿元不够用';
    return line;
  }
  function writeAgeDeath(g, log) {
    g.dead = true;
    g.deadCause = 'age';
    g.epitaph = ageEpitaph(g);
    push(log, { cls: 'dead', text: '第' + g.age + '岁，' + g.epitaph });
  }

  /* ---------- 过一年，返回今年日志（fast 模式不建日志以提速校准） ---------- */
  function rollYear(g) {
    if (_fast) return rollYearFast(g);
    var log = [];
    stepYear(g, log);
    return log;
  }
  function rollYearFast(g) { stepYear(g, null); return null; }

  function stepYear(g, log) {
    /* 有未决选择时一切暂停，等玩家给出决定 */
    if (g.pendingChoice) return;
    g.year++; g.age++;
    advanceWorldCalendar(g, 1, log);

    if (g.emperor && !g.redDustImmortal) {
      stepEmperor(g, log);
      return;
    }

    /* 道蕴是可积累的后期根基；平常时代积累缓慢，黄金大世更易悟道。
     * 准帝空等不能单靠年数填满个人上限，除非带着金色道蕴成长。 */
    /* 体质越强越易破境，但每次破境沉淀的道蕴反而更少；悟性天赋决定道蕴产量。 */
    var bodyDaoYield = 1.22 - Math.min(0.72, (g.innate || 1) * 0.072);
    var giftDaoYield = 0.55 + Math.min(1.65, (g.daoGift || 5) * 0.13);
    var yearlyDao = 0.125 * (0.12 + giftDaoYield * bodyDaoYield) * artDaoMult(g);
    if (g.lvl >= 91 && !hasGoldDaoGrowth(g)) yearlyDao *= 0.35;
    gainDaoyun(g, yearlyDao);
    /* 吞天之路：按境界从低到高炼化诸般体质，集齐后才以旧日把握化混沌。 */
    stepSwallowPath(g, log);
    if (!g.swallowingArt && g.innate <= 2 && g.lvl >= 71 && isHighDaoyun(g) &&
        Math.random() < 0.00001 * ((g.era && g.era.daog) || 1)) {
      g.swallowingArt = true;
      push(log, { cls: 'rainbow', text: '第' + g.age + '岁，你观万法而自创吞天之意；此路逆天，唯有熔炼万体才可继续前行' });
    }

    /* 特殊事件：祭道传承（近无概率）直接证道成帝 */
    if (!g.ascended && !g.worldEmperor && Math.random() < D.JIDAO_CHANCE) {
      g.gotJidao = true;
      becomeDi(g, log, 'jidao');
      push(log, { cls: 'rainbow', text: '第' + g.age + '岁，得见祭道之门，承接古之大帝遗泽，一步证道成帝！' });
      return;
    }
    /* 特殊事件：合道花现世，直接证道成帝 */
    if (!g.ascended && !g.worldEmperor && Math.random() < D.HEDAO_CHANCE) {
      g.gotHedao = true;
      becomeDi(g, log, 'hedao');
      push(log, { cls: 'rainbow', text: '第' + g.age + '岁，万古难遇的合道花于你面前绽放，花落道成，证道成帝！' });
      return;
    }
    /* 特殊事件：大帝转世（前世道果令修炼资质臻至绝顶，不改先天体质） */
    if (Math.random() < D.DAZHUAN_CHANCE) {
      g.aptitude = 10;
      g.daoyunCap = Math.max(g.daoyunCap, 1500); g.daoyun = Math.max(g.daoyun, 300);
      g.lifeBonus += 100; syncLife(g);
      g.gotDazhuan = true;
      push(log, { cls: 'red', text: '第' + g.age + '岁，你竟是大帝转世！灵台深处记忆觉醒，修炼资质臻至绝顶，寿元+100' });
    }
    /* 特殊事件：叶天帝（原韩跑跑）：赠资源提资质，另有不死药相赠 */
    if (Math.random() < D.YETIAN_CHANCE) {
      g.aptitude = 10;
      g.daoyunCap = Math.max(g.daoyunCap, 1300); g.daoyun = Math.max(g.daoyun, 240);
      var cY = round(100000 * pval(g, 'cgt', 1));
      g.cult += cY;
      var give = false;
      if (!g.deathless) { g.deathless = true; give = true; }
      g.gotYetian = true;
      push(log, { cls: 'red', text: '第' + g.age + '岁，遇见一位白衣少年，自称叶某人，与你颇为投缘，赠你大量神源与造化，修炼资质臻至绝顶，实力+' + cY + (give ? '，并赠你一株不死药' : '') });
    }

    /* 天心：准帝期（≥91级）后每年有望感悟；先天品阶与具体体质特性共同生效。 */
    if (!g.xintian && g.lvl >= 91 && !g.ascended && !g.worldEmperor) {
      if (Math.random() < tianxinChance(g)) {
        g.xintian = true; g.gotXintian = true;
        g.resonanceState.tianxinPity = 0;
        push(log, { cls: 'ev4', text: '第' + g.age + '岁，于冥冥中感悟天心，诸天道则垂落，你的成道之路一片坦途！' });
      } else {
        g.resonanceState.tianxinPity += tianxinPityGain(g) + (g.resonance === 'tianxin' ? 0.000006 : 0);
      }
    }

    /* 修炼突破：同一称号并成一条，不再夹「连破！」空句 */
    if (g.lvl < 100) {
      var gained = attemptBreak(g);
      if (gained > 0) gainLevels(g, gained, log);
    }

    tryBodyEvolution(g, log);

    /* 修行中水到渠成：实力缓慢沉淀。默认不写进日志——否则回顾一生全是 +22。 */
    if (Math.random() < (D.STEADY_TARGET / Math.max(400, g.lifespan) * (g.tm.evf || 1) * pval(g, 'evf', 1))) {
      var sInc = round(round(g.cult * rand(0.001, 0.0015)) * pval(g, 'cgt', 1));
      if (sInc < 5) sInc = 5;
      g.cult += sInc;
    }

    /* 准帝九重天后：每年默默精进 +1~5 战力（后台结算，不弹日志） */
    if (g.lvl >= 100 && !g.ascended) g.cult += round(1 + Math.random() * 4);

    /* 不死药续命：寿元仅剩 ≤20 年时服下，再活一世 */
    if (!g.dead && !g.ascended && g.lifespan - g.age <= 20) {
      if (tryDeathless(g, log)) return;
    }
    /* 准帝九重天就是帝关门前。何时叩关由玩家自己定：寿元还剩两三千年就急着去送死没有道理，
     * 多压几百年攒战力攒道蕴是正经打法。只有寿元将尽时才由不得人。 */
    if (g.lvl >= 99 && !g.emperorAttemptAge) {
      /* 准帝九重天即圣体大成，先让它显化，叩关弹窗上的成功率才算得准 */
      if (isHuangguSacred(g)) completeSacredBody(g, log);
      g.emperorAttemptAge = g.age + irand(10, 40);
    }
    var shouldAttempt = (g.lvl >= 99 && g.age >= g.emperorAttemptAge) ||
      (g.xintian && g.lvl >= 91 && g.lifespan - g.age <= 10);
    if (shouldAttempt && !g.ascended && !g.dead) {
      /* 门封着再闯是 0%。寿元将尽也不替玩家送死，把年耗完等大帝自己坐化；等不到就老死。 */
      if (!(imperialGateForced(g) && imperialGateInfo(g).block)) {
        if (openImperialGateChoice(g, log)) return;
        if (tryZhengdao(g, log)) return;
      }
    }

    /* 寿元判定放在突破之后：寿元将尽那年仍可突破/续命 */
    if (g.age > g.lifespan && !g.dead) {
      writeAgeDeath(g, log);
      return;
    }

    /* 普通随机事件：按年密度抽，寿元变长不再稀释 */
    if (!g.ascended && !g.dead && Math.random() < eventYearChance(g)) rollEvent(g, log);
    if (!g.ascended && !g.dead && !g.pendingChoice) ensureRealmChoice(g, log);
    if (!g.ascended && !g.dead) maybeArtGlimpse(g, log);
    if (!g.ascended && !g.dead && !g.pendingChoice) ensureCutDao(g, log);
    if (!g.ascended && !g.dead && !g.pendingChoice) ensureEnterSaint(g, log);
    if (!g.ascended && !g.dead && !g.pendingChoice) ensureArtChoice(g, log);

    /* 事件可能致寿元耗尽：意外暴毙（区别于寿终正寝） */
    if (g.age > g.lifespan && !g.dead) {
      g.dead = true; g.deadCause = 'accident';
      push(log, { cls: 'dead', text: '第' + g.age + '岁，遭遇不测，不幸身陨' });
    }
  }

  /* ---------- 快捷模拟（供事件 cond / 校准脚本使用） ---------- */
  var _fast = false;
  function setFast(f) { _fast = !!f; }
  function testPercentile(innate, age, n, X, key) {
    var vals = [], saved = _fast; _fast = false;
    for (var i = 0; i < n; i++) {
      var g = createGame(0); g.innate = innate; g.aptitude = innate;
      var g0 = 0;
      while (!g.dead && !g.ascended && g.age < age && g0 < 10000) { g0++; rollYear(g); }
      vals.push(g[key]);
    }
    _fast = saved;
    vals.sort(function (a, b) { return a - b; });
    var p = 1 - X / 100;
    var idx = Math.min(vals.length - 1, Math.max(0, Math.floor(vals.length * p)));
    return vals[idx];
  }
  function testLv(innate, age, n, X) { return testPercentile(innate, age, n, X, 'lvl'); }
  function testCult(innate, age, n, X) { return testPercentile(innate, age, n, X, 'cult'); }

  return {
    drawTalent: drawTalent,
    setFollowBonus: setFollowBonus,
    setAchBonus: setAchBonus,
    baseDaoyunCap: baseDaoyunCap,
    breakChance: breakChance,
    daoyunNeed: daoyunNeed,
    effectiveDaoyunNeed: effectiveDaoyunNeed,
    daoBreakFactor: daoBreakFactor,
    canAdvance: canAdvance,
    isReverseCutPath: isReverseCutPath,
    noRealmBottleneck: noRealmBottleneck,
    thresholdFit: thresholdFit,
    bodyAttrScore: bodyAttrScore,
    giftAttrScore: giftAttrScore,
    breakthroughPillars: breakthroughPillars,
    breakthroughScore: breakthroughScore,
    breakthroughChance: breakthroughChance,
    cutDaoChance: cutDaoChance,
    enterSaintChance: enterSaintChance,
    rekindleCutDao: rekindleCutDao,
    rekindleEnterSaint: rekindleEnterSaint,
    ensureCutDao: ensureCutDao,
    ensureEnterSaint: ensureEnterSaint,
    quasiUnlocked: quasiUnlocked,
    markQuasiFate: markQuasiFate,
    quasiLayerMultiplier: quasiLayerMultiplier,
    attemptBreak: attemptBreak,
    cultGain: cultGain,
    gainLife: gainLife,
    subLife: subLife,
    realmLifeRefill: realmLifeRefill,
    zhengdaoChance: zhengdaoChance,
    zhengdaoEff: zhengdaoEff,
    xianCult: xianCult,
    emperorLifeSpanRange: emperorLifeSpanRange,
    emperorDaoyunGainPerYear: emperorDaoyunGainPerYear,
    ageEpitaph: ageEpitaph,
    ageSettleTitle: ageSettleTitle,
    emperorCultGainPerYear: emperorCultGainPerYear,
    runEmperorExperience: runEmperorExperience,
    emperorBeatIds: emperorBeatIds,
    pickEmperorBeat: pickEmperorBeat,
    gainLevels: gainLevels,
    levelUp: levelUp,
    drawTraits: drawTraits,
    drawDaoGift: drawDaoGift,
    daoGiftName: daoGiftName,
    applyTraits: applyTraits,
    resolveTraitResonance: resolveTraitResonance,
    gainDaoyun: gainDaoyun,
    isHighDaoyun: isHighDaoyun,
    currentCombatPower: currentCombatPower,
    tryBodyEvolution: tryBodyEvolution,
    trySwallowPhysique: trySwallowPhysique,
    swallowSiegeDeathChance: swallowSiegeDeathChance,
    swallowSiegeSurviveChance: swallowSiegeSurviveChance,
    swallowProgress: swallowProgress,
    swallowTargets: swallowTargets,
    nextSwallowTarget: nextSwallowTarget,
    becomeChaosFromSwallow: becomeChaosFromSwallow,
    eventDaoyunTier: eventDaoyunTier,
    markStory: markStory,
    hasStory: hasStory,
    clearStory: clearStory,
    eventAvailable: eventAvailable,
    eventFits: eventFits,
    physiqueFamily: physiqueFamily,
    eventFreshness: eventFreshness,
    eventTagBlocked: eventTagBlocked,
    eventDrawWeight: eventDrawWeight,
    eventAttrWeight: eventAttrWeight,
    isThrillEvent: isThrillEvent,
    isStakeEvent: isStakeEvent,
    eventSpanBudget: eventSpanBudget,
    eventSpanRoom: eventSpanRoom,
    choiceWorthAsking: choiceWorthAsking,
    choiceStakeShare: choiceStakeShare,
    eventYearInterval: eventYearInterval,
    eventFlavorInterval: eventFlavorInterval,
    earlyEventBudget: earlyEventBudget,
    daoByCap: daoByCap,
    eventPaysDao: eventPaysDao,
    grantCreateDao: grantCreateDao,
    eventHurtSeverity: eventHurtSeverity,
    lifeHurtShare: lifeHurtShare,
    applyLifeHurt: applyLifeHurt,
    fireEvent: fireEvent,
    rollEvent: rollEvent,
    collectAvailableEvents: collectAvailableEvents,
    markEventSeen: markEventSeen,
    markRealmSeen: markRealmSeen,
    syncRealmSeen: syncRealmSeen,
    ensureRealmChoice: ensureRealmChoice,
    ensureArtChoice: ensureArtChoice,
    daoArtGuarantee: daoArtGuarantee,
    maybeArtGlimpse: maybeArtGlimpse,
    daoFill: daoFill,
    hasImperialRoad: hasImperialRoad,
    grantEventDaoyun: grantEventDaoyun,
    /* 创法 */
    ART_TYPES: ART_TYPES,
    artType: artType,
    artTypeIds: artTypeIds,
    availableArtTypes: availableArtTypes,
    createArtChance: createArtChance,
    createArtDeathChance: createArtDeathChance,
    addCreatedArt: addCreatedArt,
    artCount: artCount,
    artCultMult: artCultMult,
    artBreakMult: artBreakMult,
    artDaoMult: artDaoMult,
    artWard: artWard,
    artSummary: artSummary,
    insightPrefix: insightPrefix,
    /* 选择框架 */
    pendingChoice: pendingChoice,
    resolveChoice: resolveChoice,
    judgePlanPick: judgePlanPick,
    applyPlanDividend: applyPlanDividend,
    openChoice: openChoice,
    registerChoiceHandler: registerChoiceHandler,
    defaultChoiceOption: defaultChoiceOption,
    quietChoiceOption: quietChoiceOption,
    allInDeathOdds: allInDeathOdds,
    allInOutcome: allInOutcome,
    allInPayoff: allInPayoff,
    allInFloor: allInFloor,
    allInDeathShare: allInDeathShare,
    allInPowerSurge: allInPowerSurge,
    powerSurge: powerSurge,
    realmCultCap: realmCultCap,
    grantZhengdaoEdge: grantZhengdaoEdge,
    artResonance: artResonance,
    artResonanceLevel: artResonanceLevel,
    artDefiantResonance: artDefiantResonance,
    isDefiantArt: isDefiantArt,
    addFortuneHeat: addFortuneHeat,
    spotlightBudget: spotlightBudget,
    setAutoChoice: setAutoChoice,
    isAutoChoice: isAutoChoice,
    pctText: pctText,
    tianxinChance: tianxinChance,
    tianxinPityGain: tianxinPityGain,
    createGame: createGame,
    rollYear: rollYear,
    setFast: setFast,
    tryZhengdao: tryZhengdao,
    imperialGateInfo: imperialGateInfo,
    imperialGateForced: imperialGateForced,
    imperialGateAutoStrike: imperialGateAutoStrike,
    imperialGateWaitYears: imperialGateWaitYears,
    openImperialGateChoice: openImperialGateChoice,
    imperialGateMayAsk: imperialGateMayAsk,
    sacredEmperorChance: sacredEmperorChance,
    completeSacredBody: completeSacredBody,
    spendImperialRetry: spendImperialRetry,
    reverseLifeChance: reverseLifeChance,
    reverseMethodReady: reverseMethodReady,
    grantEmperorDeathless: grantEmperorDeathless,
    openDeathlessChoice: openDeathlessChoice,
    chooseDeathless: chooseDeathless,
    reversePathChance: reversePathChance,
    learnStrangeWorld: learnStrangeWorld,
    canOpenImmortalRoad: canOpenImmortalRoad,
    immortalRoadAppearChance: immortalRoadAppearChance,
    immortalRoadChance: immortalRoadChance,
    tryImmortalRoad: tryImmortalRoad,
    strangeWorldLearnChance: strangeWorldLearnChance,
    emperorEvent: emperorEvent,
    tryReverseLife: tryReverseLife,
    initWorldCalendar: initWorldCalendar,
    advanceWorldCalendar: advanceWorldCalendar,
    becomeDi: becomeDi,
    chooseSelfSlash: chooseSelfSlash,
    chooseDarkTurmoil: chooseDarkTurmoil,
    chooseImmortalPath: chooseImmortalPath,
    chooseStrangeWorldAlliance: chooseStrangeWorldAlliance,
    stepStrangeWorld: stepStrangeWorld,
    strangeWorldImmortalityChance: strangeWorldImmortalityChance,
    tryStrangeWorldImmortality: tryStrangeWorldImmortality,
    finishStrangeWorldBattle: finishStrangeWorldBattle,
    strangeWorldSituationForRoll: strangeWorldSituationForRoll,
    strangeWorldAmbushChance: strangeWorldAmbushChance,
    applyStrangeAmbushWound: applyStrangeAmbushWound,
    resolveUndeadHunt: resolveUndeadHunt,
    resolveUndeadHide: resolveUndeadHide,
    undeadEmperorForRoll: undeadEmperorForRoll,
    undeadEmperorMean: undeadEmperorMean,
    undeadRepelChance: undeadRepelChance,
    canSlayUndead: canSlayUndead,
    forbiddenSleepRange: forbiddenSleepRange,
    forbiddenPurgeChance: forbiddenPurgeChance,
    setPhysique: setPhysique,
    pickAcquiredPhysique: pickAcquiredPhysique,
    drawHighTalent: drawHighTalent,
    testLv: testLv, testCult: testCult,
    EVENTS: E, DATA: D, U: U
  };
});
