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
  function daoNeedMult(g) {
    if (!g) return 1;
    if (g.physiqueId === 'chaos' || g.physiqueId === 'innate_sacred_dao') return 0;
    var body = [0, 1.15, 1.05, 1, 0.9, 0.8, 0.65, 0.5, 0.35, 0.22, 0.12][Math.min(10, Math.max(1, g.innate || 1))] || 1;
    var gift = [0, 1.18, 1.08, 1.00, 0.90, 0.80, 0.66, 0.52, 0.38, 0.22, 0.10][Math.min(10, Math.max(1, g.daoGift || 5))] || 1;
    return Math.min(body, gift * 1.05);
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
  function daoBreakFactor(g) {
    var need = effectiveDaoyunNeed(g, g.lvl);
    if (!need) return 1;
    var ratio = g.daoyunCap > 0 ? g.daoyun / need : 0;
    if (ratio < 1) return 0;
    return clamp(0.35 + (ratio - 1) * 0.45, 0.35, 1.25);
  }
  function canAdvance(g) {
    var need = effectiveDaoyunNeed(g, g.lvl);
    if (need && g.daoyun < need) return false;
    if (g.innate <= 2 && !g.swallowingArt && g.lvl >= 90 && !pureDaoPath(g)) return false;
    return true;
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

  function swallowSiegeDeathChance(g) {
    if (!g || !g.swallowingArt) return 0;
    var n = swallowProgress(g).have || 0;
    if (n < 2) return 0;
    var chance = 0.06 + (n - 2) * 0.018;
    if (g.physiqueId === 'chaos' || g.swallowReady) chance += 0.08;
    chance -= Math.min(0.08, ((g.tm && g.tm.ward) || 0) / 200 + pval(g, 'ward', 0) / 200);
    return clamp(chance, 0.05, 0.48);
  }
  function swallowSiegeSurviveChance(g) {
    return clamp(1 - swallowSiegeDeathChance(g) * 1.6, 0.18, 0.78);
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
      cult: irand(1300000, 2200000)
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
    return table[lvl - 91] || 1;
  }
  function attemptBreak(g) {
    if (g.lvl >= 100) return 0;
    if (!canAdvance(g)) return 0;
    var coef = breakAgeCoef(g);
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
        daoBreakFactor({ daoyun: g.daoyun, daoyunCap: g.daoyunCap, lvl: lvl,
          physiqueId: g.physiqueId, innate: g.innate }) / quasiLayerMultiplier(g, lvl);
      if (b <= 0.25 + 1e-9) break;
      var p = b * Math.pow(0.6, step);
      if (p <= 0.25 + 1e-9) break;
      if (Math.random() < p) { gained++; step++; }
      else break;
    }
    return gained;
  }

  /* ---------- 突破实力收益（境界越高、体质越高加得越多，每层 ±40% 波动） ---------- */
  function cultGain(aptitude, newLvl, g) {
    var c = D.CULT_COEF[aptitude] || 1;
    var gift = g && g.daoGift ? g.daoGift : 5;
    c *= 0.86 + gift * 0.035;
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
      var a2 = round(10000 * pval(g, 'cgt', 1));
      g.cult += a2;
      if (log) log.push({ cls: 'brk', text: '准帝巅峰圆满，' +
        (isHighDaoyun(g) ? '万道在心中交织，你悟道并续写己法，' : '参悟己身大道，') + '实力+' + a2 });
      return;
    }
    var nl = g.lvl + 1;
    var cg = round(cultGain(g.aptitude, nl, g) * pval(g, 'cgt', 1));
    g.lvl = nl; g.cult += cg;
    var daoLine = isHighDaoyun(g) ? '你于悟道中推演己法，' : '';
    if (nl > 1 && nl % 10 === 1) {
      var newLife = realmLifeRefill(g);
      if (log) log.push({ cls: 'brk', text: daoLine + '突破至' + D.titleOf(nl) +
        '！实力+' + cg + '，寿元焕发，命限延展至' + newLife + '岁' });
      return;
    }
    if (log) log.push({ cls: 'brk', text: daoLine + '突破至' + D.titleOf(nl) + '！实力+' + cg });
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
    gainDao: function (g, amount, capAdd) { return gainDaoyun(g, amount, capAdd); },
    isHighDaoyun: isHighDaoyun,
    hurt: function (g, lo, hi) {
      var p = rand(0.10, 0.30) + (g.tm.ward + pval(g, 'ward', 0)) / 100;
      if (Math.random() < p) return { exempt: true, loss: 0 };
      var wanted = irand(lo, hi);
      /* 普通伤势不因凡体寿元短而额外致死；吞天路线仍承担反噬致命风险。 */
      if (!g.swallowingArt) wanted = Math.min(wanted, Math.max(0, g.lifespan - g.age - 1));
      var loss = subLife(g, wanted);
      return { exempt: false, loss: loss };
    },
    kill: function (g, text) { g.dead = true; g.deadCause = 'event'; if (text) printlog(text); },
    up: function (g, n, log) { return gainLevels(g, n, log); },
    cultPct: function (g, minPct, maxPct, floor) {
      var v = g.cult * rand(minPct, maxPct);
      if (v < (floor || 0)) v = floor || 0;
      v = round(v * pval(g, 'cgt', 1));
      g.cult += v;
      return v;
    },
    drawHighTalent: drawHighTalent,
    sacredEmperorChance: sacredEmperorChance,
    completeSacredBody: completeSacredBody,
    printlog: printlog,
    trySwallowPhysique: trySwallowPhysique,
    nextSwallowTarget: nextSwallowTarget,
    swallowProgress: swallowProgress,
    swallowSiegeDeathChance: swallowSiegeDeathChance,
    swallowSiegeSurviveChance: swallowSiegeSurviveChance
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
    _curEv.printed = true;
    _curEv.log.push({ cls: 'ev' + _curEv.ev.tier, text: '第' + _curEv.g.age + '岁，遇到' + _curEv.ev.name + '，' + text });
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

  function eventAvailable(g, ev) {
    return !ev || !ev.available || !!ev.available(g, U);
  }

  /* ---------- 抽 1 个随机事件执行 ---------- */
  function rollEvent(g, log) {
    var pool = [], i, mc = g.maxCount || (g.maxCount = {});
    for (i = 0; i < E.length; i++) {
      var evi = E[i];
      var maxN = evi.maxCount != null ? evi.maxCount : 100;
      var left = mc[evi.id] != null ? mc[evi.id] : maxN;
      if (left <= 0) continue;
      if (!eventAvailable(g, evi)) continue;
      var minA = evi.minAge != null ? evi.minAge : 0;
      var maxA = evi.maxAge != null ? evi.maxAge : 10000;
      if (g.age >= minA && g.age <= maxA) pool.push(evi);
    }
    if (!pool.length) return;
    var total = 0;
    for (i = 0; i < pool.length; i++) {
      var w = (pool[i].weight != null ? pool[i].weight : 1);
      if (pool[i].tier >= 3) w *= g.tm.evt * pval(g, 'evt', 1) * ((g.era && g.era.evt) || 1);   /* 高阶机缘：命格、体质、时代共同作用 */
      total += w;
    }
    var r = Math.random() * total, acc = 0, ev = pool[0];
    for (i = 0; i < pool.length; i++) {
      var w2 = (pool[i].weight != null ? pool[i].weight : 1);
      if (pool[i].tier >= 3) w2 *= g.tm.evt * pval(g, 'evt', 1) * ((g.era && g.era.evt) || 1);
      acc += w2; if (r < acc) { ev = pool[i]; break; }
    }
    var maxN2 = ev.maxCount != null ? ev.maxCount : 100;
    mc[ev.id] = (mc[ev.id] != null ? mc[ev.id] : maxN2) - 1;
    var prevCur = _curEv;
    _curEv = { ev: ev, g: g, log: log, printed: false };
    if (!ev.cond || ev.cond(g, U)) {
      if (ev.ok) ev.ok(g, U, log);
      var rewardTier = eventDaoyunTier(g, ev.tier);
      var daoGain = [0, 1, 2, 6, 15][rewardTier] || 1;
      /* 普通高阶机缘只能积累道蕴；唯有传说级机缘才可能抬高天赋上限。 */
      gainDaoyun(g, daoGain, ev.tier === 4 ? 16 : 0);
      if (rewardTier > ev.tier) {
        push(log, { cls: 'rare', text: g.resonance === 'fortune' ?
          '命格共鸣「否极泰来」，此番机缘额外沉淀了更多道蕴' :
          '命格牵引福缘，此番机缘额外沉淀了更多道蕴' });
      }
    } else {
      if (ev.fail) ev.fail(g, U, log);
    }
    if (log && !_curEv.printed && _curEv.ev !== ev) {}
    _curEv = prevCur;
  }

  /* 事件日志推进（仅 log 存在时收集） */
  function push(log, obj) { if (log) log.push(obj); }

  /* ---------- 以力证道成功率：兼顾自动玩法的可达性；战力越高越接近必成 ---------- */
  function zhengdaoChance(cult) {
    if (cult >= 450000) return 1.0;
    if (cult >= 300000) return 0.25 + (cult - 300000) / 150000 * 0.75;
    if (cult >= 100000) return 0.05 + (cult - 100000) / 200000 * 0.20;
    return 0.02;
  }

  /* 证道成帝后的实力 = (100w 证道之基 + 原实力) × 倍率 */
  function xianCult(cult, rate) {
    if (rate == null) rate = 1;
    return round((1000000 + cult) * rate);
  }

  function isSacredBody(g) {
    var id = g && g.physiqueId;
    return id === 'sacred' || id === 'origin_sacred' || id === 'innate_sacred_dao';
  }

  function isHuangguSacred(g) {
    return !!(g && g.physiqueId === 'sacred');
  }

  /* 大成之后叩帝关：荒古圣体成帝是万古难遇，原著仅叶凡做到。
   * 光秃约 2%；合适金卡可抬到约 30%，仍远不到保送。 */
  function sacredEmperorChance(g) {
    if (!isHuangguSacred(g)) return 0;
    var body = (g.tm && g.tm.bodyChance) || 0;
    var extra = ((g.tm && g.tm.zhx) || 0) + pval(g, 'zhx', 0);
    var dao = (g.daoyun || 0) / D.DAO_ABSOLUTE_MAX;
    var gift = Math.max(0, (g.daoGift || 5) - 8) * 0.012;
    var chance = 0.018 + Math.min(0.18, body * 0.22) + Math.min(0.09, extra * 0.9) +
      Math.min(0.02, dao * 0.02) + gift;
    if (g.gotDiBing) chance += 0.012;
    if (g.deathless) chance += 0.008;
    if (g.worldEmperor) chance *= 0.40;
    return clamp(chance, 0.012, 0.32);
  }

  /* 准帝九重天的荒古圣体即为大成圣体，无需再走额外大成机缘。 */
  function completeSacredBody(g, log) {
    if (!g || !isHuangguSacred(g) || (g.lvl || 0) < 99 || g.sacredPeakAwakened) return g;
    g.sacredPeakAwakened = true;
    var target;
    if (g.worldEmperor) {
      target = Math.max(D.OVERWHELM_DAO_CULT, irand(950000, 1300000));
    } else {
      target = Math.max(D.SACRED_JIDAO_CULT || 1600000, irand(1600000, 2000000));
    }
    g.cult = Math.max(g.cult || 0, target);
    if (log) {
      push(log, { cls: 'rainbow', text: '第' + (g.age || 0) + '岁，准帝九重天成，荒古圣体至此大成！' +
        (g.worldEmperor ?
          '极道至尊之象显化，战力达可与大帝争锋的' + Math.round(g.cult / 10000) + '万' :
          '此世无帝，大成圣体已是宇宙第一极道至尊，战力' + Math.round(g.cult / 10000) + '万') });
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
    reforge_weapon: { max: 2 }
  };

  function emperorBeatIds() {
    return [
      'body_refine', 'soul_nurture', 'dao_scripture', 'dark_turmoil', 'seek_longevity',
      'forbidden_art', 'reforge_weapon', 'red_dust_insight', 'world_order', 'suppress_forbidden',
      'late_ambush', 'mortal_farewell', 'lecture_beings', 'establish_heaven', 'star_voyage',
      'predecessor_trace', 'faith_incense', 'imperial_god', 'disciple_rise', 'time_scar',
      'sealed_world', 'race_mediation', 'ancient_road', 'underworld_edge', 'emperor_tomb',
      'blood_pact', 'cosmos_bloom', 'nine_secret', 'void_rift', 'reincarnation_dream',
      'self_method', 'reverse_deduction', 'lonely_throne'
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

  function undeadEmperorForRoll(r, worldYear) {
    /* 2~8世按 μ=5、σ≈1.5 的离散正态权重；最右侧约1%为已成红尘仙。 */
    if (!worldYear || worldYear <= 0) {
      if (r < 0.036) return { lives: 2, cult: 1650000 };
      if (r < 0.146) return { lives: 3, cult: 2100000 };
      if (r < 0.361) return { lives: 4, cult: 2550000 };
      if (r < 0.629) return { lives: 5, cult: 3000000 };
      if (r < 0.844) return { lives: 6, cult: 3600000 };
      if (r < 0.954) return { lives: 7, cult: 4300000 };
      if (r < 0.990) return { lives: 8, cult: 5200000 };
      return { lives: 9, cult: 8000000, immortal: true };
    }
    var immortalChance = 0.01 + Math.min(0.09, worldYear / 20000000 * 0.09);
    if (r >= 1 - immortalChance) return { lives: 9, cult: 8000000, immortal: true };
    var mean = 5 + Math.min(2, worldYear / 1000000);
    var weights = [], total = 0, i;
    for (i = 2; i <= 8; i++) {
      var w = Math.exp(-Math.pow(i - mean, 2) / (2 * 1.5 * 1.5));
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
    if (ratio >= 0.85 && Math.random() < strangeWorldBattleChance(g, false)) {
      g.defeatedUndead = true;
      g.undeadHunting = false;
      g.cult = round(g.cult * rand(1.04, 1.10));
      g.strangeWorldInsight = (g.strangeWorldInsight || 0) + 16;
      push(log, { cls: 'god', text: '你不再只求逃脱，反身硬撼五色天刀，当场击溃不死天皇！实力升至' + g.cult });
      return true;
    }
    if (ratio < 0.95) applyStrangeAmbushWound(g);
    else g.cult = round(g.cult * rand(0.94, 0.98));
    push(log, { cls: 'dead', text: '你再次从五色天刀下逃脱，却未能击杀不死天皇；此后只能隐匿发育，或等待下一次反杀' });
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
    g.awaitingStrangeWorldChoice = false;
    g.strangeWorldImmortalAttempts = 0;
    if (g.playerEmperorActive) {
      g.playerEmperorActive = false;
      markDaoTraces(g, g.worldYear || 0);
    }
    var situationRoll = Math.random();
    g.strangeWorldSituation = strangeWorldSituationForRoll(situationRoll);
    if (g.strangeWorldSituation !== 'quiet') {
      var enemy = undeadEmperorForRoll(Math.random(), g.worldYear || 0);
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
    g.defeatedUndead = true;
    g.ascended = true;
    push(log, { cls: 'god', text: withWushi ?
      '你已蜕变红尘仙，与无始大帝合力击碎五色天刀，终结了这场持续万古的对峙！' :
      '你以新成红尘仙之身正面击溃五色天刀，在奇异世界真正站稳了脚跟！' });
    return true;
  }

  function strangeWorldImmortalityChance(g) {
    var daoPeak = g.daoyunCap > 0 ? g.daoyun / g.daoyunCap : 0;
    var roots = g.redDustRoots.body + g.redDustRoots.soul + g.redDustRoots.dao;
    var chance = 0.10 + Math.min(0.16, daoPeak * 0.16) + Math.min(0.08, roots * 0.003) +
      Math.min(0.08, Math.max(0, g.strangeWorldInsight - 80) * 0.0016) + Math.min(0.06, g.innate * 0.006);
    if (g.strangeWorldAlliance === 'wushi') chance += 0.04;
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
    if (g && isPeakPhysique(g.physiqueId)) chance += 0.008;
    return clamp(chance, 0.008, 0.09);
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
  function tryZhengdao(g, log) {
    function deferImperialAttempt(years) {
      g.emperorAttemptAge = g.age + irand(years || 300, (years || 300) * 2);
    }
    var extra = g.tm.zhx + pval(g, 'zhx', 0);
    var eff = zhengdaoEff(g);     /* 判定用战力：含隐藏的帝兵/不死药加持 */
    if (!g.worldEmperor && tracesStillActive(g)) {
      push(log, { cls: 'rare', text: '第' + g.age + '岁，前代帝道烙印尚未消散，万道仍被镇压，此世无人能证道' });
      deferImperialAttempt(300);
      return false;
    }
    if (isHuangguSacred(g) && g.lvl >= 99) completeSacredBody(g, log);
    var emperorDaoNeed = effectiveDaoyunNeed(g, 99);
    if (g.lvl >= 99 && emperorDaoNeed && g.daoyun < emperorDaoNeed) {
      push(log, { cls: 'rare', text: '第' + g.age + '岁，准帝九重已至，然道蕴仅' + Math.round(g.daoyun) +
        '/' + emperorDaoNeed + '，尚不足以叩开帝关' });
      deferImperialAttempt(250);
      return false;
    }
    if (g.worldEmperor) {
      if (currentCombatPower(g) < D.OVERWHELM_DAO_CULT) {
        if (spendImperialRetry(g, log)) return true;
        push(log, { cls: 'dead', text: '第' + g.age + '岁，当世已有大帝镇压万道；你的实际战力' + Math.round(g.cult / 10000) +
          '万尚未达到破灭万道的90万硬门槛，帝兵等外物无法代替自身道行，帝关在道压中崩碎' });
        g.dead = true; g.deadCause = 'world_emperor_suppression';
        return true;
      }
      var overwhelmChance = clamp(0.35 + (eff - D.OVERWHELM_DAO_CULT) / 600000 + extra +
        (g.tm.ignoreSuppression || 0), 0.35, 1);
      if (isHuangguSacred(g)) overwhelmChance = sacredEmperorChance(g);
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
      var red = clamp(g.tm.dlm + pval(g, 'dlm', 0), 0, 90);
      var fade = g.age > D.EMPEROR_PATH_FADE_AGE ? 1 + 0.3 * (g.age - D.EMPEROR_PATH_FADE_AGE) / (D.EMPEROR_PATH_CLOSE_AGE - D.EMPEROR_PATH_FADE_AGE) : 1;
      var suppression = g.daoSuppressed && !isPeakPhysique(g.physiqueId) ?
        1 + 0.5 * (1 - (g.tm.ignoreSuppression || 0)) : 1;
      var need = Math.max(1, Math.round(irand(D.XINTIAN_NEED_MIN, D.XINTIAN_NEED_MAX) * (1 - red / 100) * fade * suppression));
      /* 准帝九重天即已走到帝关前，战力达标后融合天心必成。 */
      if (g.lvl >= 99 && eff >= need) {
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
    var latePenalty = g.age > D.EMPEROR_PATH_FADE_AGE ? 1 - 0.5 * (g.age - D.EMPEROR_PATH_FADE_AGE) / (D.EMPEROR_PATH_CLOSE_AGE - D.EMPEROR_PATH_FADE_AGE) : 1;
    var daoPenalty = g.daoSuppressed && !isPeakPhysique(g.physiqueId) ? 0.15 : 1;
    /* 凡体绝世悟性可走“以道证帝”：不靠蛮力硬撼九十万战力，而以完整道果换取有限但真实的帝关成功率。
     * 仅对低体质生效，避免混沌体叠加后把证帝变成必然。 */
    var pureDaoBonus = (g.innate <= 2 && pureDaoPath(g)) ?
      ((g.daoGift - 8) * 0.10 + Math.min(0.22, g.daoyun / D.DAO_ABSOLUTE_MAX * 0.22)) : 0;
    var lateScale = Math.max(0.5, latePenalty) * daoPenalty;
    var prob = isHuangguSacred(g) ?
      sacredEmperorChance(g) * lateScale :
      Math.min(1, (zhengdaoChance(eff) + extra + pureDaoBonus) * lateScale);
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

  /* ---------- 过一年，返回今年日志（fast 模式不建日志以提速校准） ---------- */
  function rollYear(g) {
    if (_fast) return rollYearFast(g);
    var log = [];
    stepYear(g, log);
    return log;
  }
  function rollYearFast(g) { stepYear(g, null); return null; }

  function stepYear(g, log) {
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
    var yearlyDao = 0.125 * (0.12 + giftDaoYield * bodyDaoYield);
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

    /* 修炼突破（连破逐层打印） */
    if (g.lvl < 100) {
      var gained = attemptBreak(g);
      if (gained > 0) {
        for (var k = 0; k < gained; k++) {
          levelUp(g, log);
          if (k + 1 < gained && g.lvl < 100) push(log, { cls: 'brk', text: '第' + g.age + '岁，修炼，连破！' });
          if (g.lvl >= 100) break;
        }
      }
    }

    tryBodyEvolution(g, log);

    /* 修行中水到渠成：实力缓慢沉淀 */
    if (Math.random() < (D.STEADY_TARGET / g.lifespan * g.tm.evf * pval(g, 'evf', 1))) {
      var sInc = round(round(g.cult * rand(0.001, 0.0015)) * pval(g, 'cgt', 1));
      if (sInc < 5) sInc = 5;
      g.cult += sInc;
      push(log, { cls: 'gain', text: '第' + g.age + '岁，水到渠成，实力有所精进，+' + sInc });
    }

    /* 准帝九重天后：每年默默精进 +1~5 战力（后台结算，不弹日志） */
    if (g.lvl >= 100 && !g.ascended) g.cult += round(1 + Math.random() * 4);

    /* 不死药续命：寿元仅剩 ≤20 年时服下，再活一世 */
    if (!g.dead && !g.ascended && g.lifespan - g.age <= 20) {
      if (tryDeathless(g, log)) return;
    }
    /* 准帝九重天就是帝关门前：闭关10~40年便会争渡，不再额外等待一个隐藏层级。
     * 持天心但尚未抵达九重天者，仍只会在寿元将尽时冒险强融。 */
    if (g.lvl >= 99 && !g.emperorAttemptAge) g.emperorAttemptAge = g.age + irand(10, 40);
    var shouldAttempt = (g.lvl >= 99 && g.age >= g.emperorAttemptAge) ||
      (g.xintian && g.lvl >= 91 && g.lifespan - g.age <= 10);
    if (shouldAttempt && !g.ascended && !g.dead) {
      if (tryZhengdao(g, log)) return;
    }

    /* 寿元判定放在突破之后：寿元将尽那年仍可突破/续命 */
    if (g.age > g.lifespan && !g.dead) {
      g.dead = true; g.deadCause = 'age';
      push(log, { cls: 'dead', text: '第' + g.age + '岁，寿元耗尽，坐化' });
      return;
    }

    /* 普通随机事件（一生约 EVENT_TARGET 次） */
    if (!g.ascended && !g.dead && Math.random() < (D.EVENT_TARGET / g.lifespan * g.tm.evf * pval(g, 'evf', 1) * ((g.era && g.era.evf) || 1))) rollEvent(g, log);

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
    eventAvailable: eventAvailable,
    tianxinChance: tianxinChance,
    tianxinPityGain: tianxinPityGain,
    createGame: createGame,
    rollYear: rollYear,
    setFast: setFast,
    tryZhengdao: tryZhengdao,
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
    forbiddenSleepRange: forbiddenSleepRange,
    forbiddenPurgeChance: forbiddenPurgeChance,
    setPhysique: setPhysique,
    pickAcquiredPhysique: pickAcquiredPhysique,
    drawHighTalent: drawHighTalent,
    testLv: testLv, testCult: testCult,
    EVENTS: E, DATA: D, U: U
  };
});
