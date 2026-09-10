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

  function pickPhysique(tier) {
    var pool = D.physiquesAtTier ? D.physiquesAtTier(tier) : [];
    if (!pool.length) return D.physiqueById ? D.physiqueById('mortal') : null;
    var total = 0, i;
    for (i = 0; i < pool.length; i++) total += pool[i].weight || 1;
    var r = Math.random() * total, acc = 0;
    for (i = 0; i < pool.length; i++) { acc += pool[i].weight || 1; if (r < acc) return pool[i]; }
    return pool[pool.length - 1];
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
    if (lvl >= 99) return 145; /* 准帝九重圆满 */
    if (lvl >= 91) return 110 + (lvl - 91) * 5; /* 准帝逐重加压 */
    if (lvl >= 90) return 110; /* 入准帝 */
    if (lvl >= 80) return 80;  /* 大圣 */
    if (lvl >= 70) return 55;  /* 入圣 */
    if (lvl >= 50) return 25;  /* 入仙台 */
    return 0;
  }
  function canAdvance(g) {
    var need = daoyunNeed(g.lvl);
    if (need && g.daoyun < need) return false;
    if (g.innate <= 2 && !g.swallowingArt && g.lvl >= 90) return false;
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
    g.daoyun = Math.min(g.daoyunCap, next);
    return round((g.daoyun - old) * 10) / 10;
  }
  function setPhysique(g, p) {
    if (!p) return;
    g.physiqueId = p.id; g.physiqueName = p.name; g.pm = p.fx || {};
    g.innate = p.tier; g.aptitude = Math.max(g.aptitude || 1, p.tier);
    if (g.daoyunCap != null) {
      g.daoyunCap = Math.max(g.daoyunCap, baseDaoyunCap(p.tier));
      g.daoyun = Math.max(g.daoyun || 0, baseDaoyun(p.tier));
    }
    syncLife(g);
  }
  /* 道蕴是后天成果而非另一种先天体质：起点差距小，体质主要决定积累速度与可望见的天花板。 */
  function baseDaoyun(tier) { return [0, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16][tier] || 4; }
  function baseDaoyunCap(tier) { return [0, 500, 560, 620, 700, 780, 880, 1000, 1150, 1300, 1500][tier] || 500; }

  function recordWorldEvent(g, year, text) {
    g.worldHistory = g.worldHistory || [];
    g.worldHistory.push({ year: Math.round(year), text: text });
    if (g.worldHistory.length > 40) g.worldHistory.shift();
  }
  function createWorldEmperor(g, startYear) {
    g.worldEmperorSeq = (g.worldEmperorSeq || 0) + 1;
    var duration = irand(9000, 12000);
    g.worldEmperor = {
      name: '当世第' + g.worldEmperorSeq + '位大帝',
      start: startYear,
      end: startYear + duration,
      cult: irand(1300000, 2200000)
    };
    recordWorldEvent(g, startYear, g.worldEmperor.name + '证道，天心有主');
  }
  function initWorldCalendar(g) {
    g.worldYear = 0; g.worldHistory = []; g.worldEmperorSeq = 0;
    g.playerEmperorActive = false; g.worldEmperor = null;
    if (Math.random() < 0.12) {
      createWorldEmperor(g, -irand(0, 8000));
      g.nextWorldEmperorYear = null;
    } else {
      g.nextWorldEmperorYear = irand(500, 6000);
    }
    g.daoSuppressed = !!g.worldEmperor;
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
        recordWorldEvent(g, ended.end, ended.name + '帝命终结，万道重归无主');
        if (years <= 1) push(log, { cls: 'rare', text: '万古历' + ended.end + '年，' + ended.name + '坐化，天心重归无主' });
        g.worldEmperor = null;
        g.nextWorldEmperorYear = ended.end + irand(800, 5000);
      } else {
        if (g.nextWorldEmperorYear == null) g.nextWorldEmperorYear = (g.worldYear || 0) + irand(800, 5000);
        if (g.nextWorldEmperorYear > target) break;
        var start = g.nextWorldEmperorYear;
        createWorldEmperor(g, start);
        g.nextWorldEmperorYear = null;
        if (years <= 1) push(log, { cls: 'ev4', text: '万古历' + start + '年，宇宙中另一位修士证道成帝，天心自此有主' });
      }
    }
    g.worldYear = target;
    g.daoSuppressed = !!g.worldEmperor;
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
    var table = g && g.physiqueId === 'chaos' ? D.QUASI_CHAOS_MULT : D.QUASI_LAYER_MULT;
    return table[lvl - 91] || 1;
  }
  function attemptBreak(g) {
    if (g.lvl >= 100) return 0;
    if (!canAdvance(g)) return 0;
    var coef = breakAgeCoef(g);
    var base = breakChance(g.aptitude, g.lvl) * coef * pval(g, 'brk', 1) / quasiLayerMultiplier(g, g.lvl);
    if (base <= 0.25 + 1e-9) {
      return Math.random() < base ? 1 : 0;
    }
    var gained = 0, step = 0;
    while (true) {
      var lvl = g.lvl + gained;
      if (lvl >= 100) break;
      var b = breakChance(g.aptitude, lvl) * coef * pval(g, 'brk', 1) / quasiLayerMultiplier(g, lvl);
      if (b <= 0.25 + 1e-9) break;
      var p = b * Math.pow(0.6, step);
      if (p <= 0.25 + 1e-9) break;
      if (Math.random() < p) { gained++; step++; }
      else break;
    }
    return gained;
  }

  /* ---------- 突破实力收益（境界越高、体质越高加得越多，每层 ±40% 波动） ---------- */
  function cultGain(aptitude, newLvl) {
    var c = D.CULT_COEF[aptitude] || 1;
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
      if (log) log.push({ cls: 'brk', text: '准帝巅峰圆满，参悟己身大道，实力+' + a2 });
      return;
    }
    var nl = g.lvl + 1;
    var cg = round(cultGain(g.aptitude, nl) * pval(g, 'cgt', 1));
    g.lvl = nl; g.cult += cg;
    if (nl > 1 && nl % 10 === 1) {
      var newLife = realmLifeRefill(g);
      if (log) log.push({ cls: 'brk', text: '突破至' + D.titleOf(nl) + '！实力+' + cg + '，寿元焕发，命限延展至' + newLife + '岁' });
      return;
    }
    if (log) log.push({ cls: 'brk', text: '突破至' + D.titleOf(nl) + '！实力+' + cg });
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
    hurt: function (g, lo, hi) {
      var p = rand(0.10, 0.30) + (g.tm.ward + pval(g, 'ward', 0)) / 100;
      if (Math.random() < p) return { exempt: true, loss: 0 };
      var loss = subLife(g, irand(lo, hi));
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
    printlog: printlog
  };
  /* 体质异变：按体质 7-10 权重抽取，替换先天体质/资质 */
  function drawHighTalent(g) {
    var wsum = 0, i;
    for (i = 7; i <= 10; i++) wsum += D.INNATE_WEIGHTS[i];
    var r = Math.random() * wsum, acc = 0, ni = 7;
    for (i = 7; i <= 10; i++) { acc += D.INNATE_WEIGHTS[i]; if (r < acc) { ni = i; break; } }
    var physique = pickPhysique(ni);
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
      evf: 1, evt: 1, xin: 1, ward: 0, zhx: 0, dlm: 0, daog: 1, era: 1, retry: 0,
      retryKeep: 0, bodyChance: 0, bodyDao: 0, overflow: 0, upgradeEvent: 0,
      xinPity: 0, ignoreSuppression: 0
    };
    var floorMax = 0, daoAdd = 0, daoCapAdd = 0;
    for (var i = 0; i < g.traits.length; i++) {
      var t = D.traitById(g.traits[i]);
      if (!t) continue;
      for (var j = 0; j < t.fx.length; j++) {
        var ty = t.fx[j][0], v = t.fx[j][1];
        if (ty === 'life') g.lifeBonus += v;
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
        else if (ty === 'retryKeep') g.tm.retryKeep = Math.min(0.75, g.tm.retryKeep + v);
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
    if (targetInnate > oldInnate) setPhysique(g, pickPhysique(targetInnate));
    g.innate = targetInnate;
    g.aptitude = Math.max(g.aptitude, targetInnate);
    g.daoyunCap = Math.min(D.DAO_ABSOLUTE_MAX, g.daoyunCap + daoCapAdd);
    g.daoyun += daoAdd;
    g.daoyun = Math.min(g.daoyun, g.daoyunCap);
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
      var it = pool[Math.floor(Math.random() * pool.length)];
      used[it.id] = 1; out.push(it);
    }
    return out;
  }

  function tryBodyEvolution(g, log) {
    if (!g.resonanceState || g.resonanceState.bodyUsed || g.lvl < 71 || g.innate >= 9) return false;
    var need = Math.max(60, 130 - (g.tm.bodyDao || 0));
    if (g.daoyun < need) return false;
    g.resonanceState.bodyUsed = true;
    var chance = Math.min(0.75, (g.tm.bodyChance || 0) + (g.resonance === 'body' ? 0.08 : 0));
    if (Math.random() >= chance) return false;
    var before = g.physiqueName;
    setPhysique(g, pickPhysique(Math.min(9, g.innate + 1)));
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

  /* ---------- 抽 1 个随机事件执行 ---------- */
  function rollEvent(g, log) {
    var pool = [], i, mc = g.maxCount || (g.maxCount = {});
    for (i = 0; i < E.length; i++) {
      var evi = E[i];
      var maxN = evi.maxCount != null ? evi.maxCount : 100;
      var left = mc[evi.id] != null ? mc[evi.id] : maxN;
      if (left <= 0) continue;
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

  function resetEmperorLife(g) {
    var span = irand(D.EMPEROR_LIFE_MIN, D.EMPEROR_LIFE_MAX);
    g.emperorLifeStart = g.age;
    g.emperorLifeEnd = g.age + span;
    g.lifeBase = g.emperorLifeEnd;
    g.lifeBonus = 0;
    g.redDustRoots = { body: 0, soul: 0, dao: 0 };
    syncLife(g);
  }

  /* ---------- 证道成帝：进入帝者篇，不再立刻结算 ---------- */
  function becomeDi(g, log, mode) {
    var displacedEmperor = g.worldEmperor;
    g.emperor = true; g.becameEmperor = true; g.ascendMode = mode; g.lvl = 101;
    g.emperorAge = g.age; g.lifeNo = 1; g.redDustMarks = 0;
    g.redDustPath = null; g.immortalMode = null; g.inStrangeWorld = false; g.strangeWorldYears = 0;
    g.strangeWorldInsight = 0; g.strangeWorldEvents = 0; g.strangeWorldSituation = null;
    g.strangeWorldAlliance = null; g.awaitingStrangeWorldChoice = false;
    g.strangeWorldThreatKnown = false; g.undeadLives = 0; g.undeadCult = 0; g.undeadImmortal = false; g.defeatedUndead = false;
    g.redDustRoutes = [];
    g.worldEmperor = null; g.nextWorldEmperorYear = null; g.playerEmperorActive = true; g.daoSuppressed = false;
    recordWorldEvent(g, g.worldYear || 0, displacedEmperor ?
      '你破灭当世万道，压过' + displacedEmperor.name + '证道' : '你证道成帝，君临此世');
    var rate;
    if (mode === 'jidao' || mode === 'hedao') rate = D.CHENGDI_BONUS_JIDAO;
    else rate = D.CHENGDI_BONUS_MIN + Math.random() * (D.CHENGDI_BONUS_MAX - D.CHENGDI_BONUS_MIN);
    g.cult = xianCult(g.cult, rate);
    resetEmperorLife(g);
    return g.cult;
  }

  function emperorEvent(g, log) {
    var roots = g.redDustRoots, r = Math.floor(Math.random() * 8), add;
    /* 帝者游历诸天时仍可能撞见传说级仙路线索；高阶机缘只提供“信息”，不会代替战力门槛。 */
    if (!g.knowsStrangeWorld && Math.random() < 0.025) {
      g.knowsStrangeWorld = true;
      roots.dao++;
      push(log, { cls: 'rainbow', text: '帝历' + (g.age - g.emperorAge) + '年，你追索一处仙路裂隙，确认奇异世界真实存在，并记下界壁坐标，道果根基+1' });
      return;
    }
    if (r === 0) {
      add = irand(1, 2); roots.body += add;
      push(log, { cls: 'rainbow', text: '帝历' + (g.age - g.emperorAge) + '年，你熬炼帝躯、参悟不朽，肉身根基+' + add });
    } else if (r === 1) {
      add = irand(1, 2); roots.soul += add;
      push(log, { cls: 'ev4', text: '帝历' + (g.age - g.emperorAge) + '年，你于岁月中温养元神，元神根基+' + add });
    } else if (r === 2) {
      add = irand(1, 2); roots.dao += add;
      push(log, { cls: 'god', text: '帝历' + (g.age - g.emperorAge) + '年，你推演自身大道，完善帝经，道果根基+' + add });
    } else if (r === 3) {
      var safe = 0.55 + (g.tm.ward + pval(g, 'ward', 0)) / 100;
      if (Math.random() < safe) {
        roots.dao += 2; g.cult = round(g.cult * 1.04);
        push(log, { cls: 'god', text: '帝历' + (g.age - g.emperorAge) + '年，黑暗动乱爆发，你镇杀至尊、平定宇宙，道果根基+2' });
      } else {
        var loss = irand(300, 900); g.emperorLifeEnd -= loss; g.lifeBase -= loss; syncLife(g);
        push(log, { cls: 'dead', text: '帝历' + (g.age - g.emperorAge) + '年，你血战禁区至尊，虽平动乱却大道受创，帝命-' + loss + '年' });
      }
    } else if (r === 4) {
      /* 仙源与太初命石是禁区自封的前提。帝者一生有较大机会寻到，但绝非人手一份。 */
      if (!g.xianSource && Math.random() < 0.22) {
        g.xianSource = true;
        push(log, { cls: 'rainbow', text: '帝历' + (g.age - g.emperorAge) + '年，你于古代仙路遗址寻得一块仙源，可封存帝躯跨越万古' });
      } else if (!g.primordialStone && Math.random() < 0.18) {
        g.primordialStone = true;
        push(log, { cls: 'rainbow', text: '帝历' + (g.age - g.emperorAge) + '年，你从太初古矿深处取出一枚太初命石，可承载残缺帝躯' });
      } else
      if (!g.deathless || g.deathlessUsed) {
        if (Math.random() < 0.12) {
          g.deathless = true; g.deathlessUsed = false;
          push(log, { cls: 'rainbow', text: '帝历' + (g.age - g.emperorAge) + '年，你寻遍诸天，得获一株不死神药' });
        } else {
          roots.body++;
          push(log, { cls: 'rare', text: '帝历' + (g.age - g.emperorAge) + '年，你遍寻长生物质，虽未得不死药，却令肉身根基+1' });
        }
      } else {
        roots.body += 2;
        push(log, { cls: 'rainbow', text: '帝历' + (g.age - g.emperorAge) + '年，你参悟不死神药中的长生物质，肉身根基+2' });
      }
    } else if (r === 5) {
      roots.dao++; g.cult = round(g.cult * 1.03);
      push(log, { cls: 'gain', text: '帝历' + (g.age - g.emperorAge) + '年，你开创禁忌秘术，实力蜕变，道果根基+1' });
    } else if (r === 6) {
      roots.soul++; g.gotDiBing = true;
      push(log, { cls: 'ev4', text: '帝历' + (g.age - g.emperorAge) + '年，你重炼极道帝兵，以神祇温养元神，元神根基+1' });
    } else {
      var key = ['body', 'soul', 'dao'][Math.floor(Math.random() * 3)];
      roots[key]++;
      push(log, { cls: 'rare', text: '帝历' + (g.age - g.emperorAge) + '年，万载红尘流转，你从众生兴衰中悟得一缕长生真意' });
    }
  }

  function reverseLifeChance(g) {
    var roots = g.redDustRoots;
    var total = roots.body + roots.soul + roots.dao;
    var targetLife = Math.min(D.RED_DUST_LIVES, g.lifeNo + 1);
    if (targetLife === 2 && g.deathless && !g.deathlessUsed && !g.reverseMedicineUsed) return 1;
    var baseByLife = [0, 0, 0.12, 0.03, 0.20, 0.35, 0.50, 0.65, 0.78, 0.88];
    var absoluteNeed = targetLife === 2 ? 700 : 1200;
    var daoPeak = g.daoyunCap > 0 ? clamp(g.daoyun / g.daoyunCap, 0, 1) : 0;
    if (g.daoyun >= absoluteNeed && daoPeak >= 0.995) return 1;
    var absoluteRatio = clamp(g.daoyun / absoluteNeed, 0, 1);
    var mastery = targetLife === 3 ? 0.38 : 0.28;
    var chance = baseByLife[targetLife] + Math.pow(absoluteRatio, 3) * mastery +
      daoPeak * 0.12 + Math.min(0.08, total * 0.003);
    if (g.gotDiBing) chance += 0.02;
    return clamp(chance, 0.02, 0.95);
  }

  function tryReverseLife(g, log, confirmed) {
    var targetLife = Math.min(D.RED_DUST_LIVES, g.lifeNo + 1);
    var rescued = false;
    if (targetLife === 2 && g.deathless && !g.deathlessUsed && !g.reverseMedicineUsed) {
      g.deathlessUsed = true; g.reverseMedicineUsed = true; rescued = true;
    }
    var success = rescued || confirmed || Math.random() < reverseLifeChance(g);
    if (!success) {
      g.dead = true; g.deadCause = 'reverse';
      push(log, { cls: 'dead', text: '第' + g.lifeNo + '世帝命燃尽，你以' + Math.round(g.daoyun) + '/' + Math.round(g.daoyunCap) + '道蕴尝试逆夺造化，却在蜕变中道崩身灭' });
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

  function reversePathChance(g) {
    return reverseLifeChance(g);
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

  function strangeWorldBattleChance(g, withWushi) {
    var boss = g.undeadCult || D.UNDEAD_EMPEROR_CULT;
    var ratio = g.cult / boss;
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

  function enterStrangeWorld(g, log) {
    g.redDustPath = 'strange_world';
    g.inStrangeWorld = true;
    g.forbiddenLord = false;
    g.strangeWorldYears = 0;
    g.strangeWorldInsight = 0;
    g.strangeWorldEvents = 0;
    g.strangeWorldAlliance = null;
    g.strangeWorldThreatKnown = false;
    g.awaitingStrangeWorldChoice = false;
    g.strangeWorldImmortalAttempts = 0;
    if (g.playerEmperorActive) {
      g.playerEmperorActive = false;
      g.nextWorldEmperorYear = (g.worldYear || 0) + irand(800, 5000);
    }
    var situationRoll = Math.random();
    g.strangeWorldSituation = situationRoll < 0.35 ? 'quiet' : (situationRoll < 0.70 ? 'undead' : 'standoff');
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

  function tryStrangeWorldImmortality(g, log) {
    if ((g.strangeWorldImmortalAttempts || 0) >= 2) return false;
    g.strangeWorldImmortalAttempts = (g.strangeWorldImmortalAttempts || 0) + 1;
    var daoPeak = g.daoyunCap > 0 ? g.daoyun / g.daoyunCap : 0;
    var roots = g.redDustRoots.body + g.redDustRoots.soul + g.redDustRoots.dao;
    var chance = 0.08 + Math.min(0.16, daoPeak * 0.16) + Math.min(0.08, roots * 0.003) +
      Math.min(0.08, Math.max(0, g.strangeWorldInsight - 80) * 0.0016) + Math.min(0.06, g.innate * 0.006);
    if (g.strangeWorldAlliance === 'wushi') chance += 0.04;
    chance = clamp(chance, 0.12, 0.72);
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
    if (g.strangeWorldSituation === 'undead') {
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
      push(log, { cls: 'ev4', text: '你在界海尽头发现两道对峙万古的身影：无始大帝正牵制一位沐浴五色神光、' + undeadStageText(g) + '的恐怖强者' });
      if (_fast) chooseStrangeWorldAlliance(g, 'hide', log);
      return;
    }

    if (g.strangeWorldSituation === 'undead' && !g.strangeWorldThreatKnown &&
        (g.strangeWorldEvents >= 3 || Math.random() < 0.30)) {
      g.strangeWorldThreatKnown = true;
      var survive = clamp(0.35 + g.cult / g.undeadCult * 0.28 + (g.tm.ward + pval(g, 'ward', 0)) / 250, 0.35, 0.82);
      push(log, { cls: 'ev4', text: '一柄五色天刀撕裂虚空，你这才发现不死天皇' + undeadStageText(g) + '，并在暗中巡视此界！' });
      if (Math.random() >= survive) {
        g.dead = true; g.deadCause = 'undead_emperor';
        push(log, { cls: 'dead', text: '你尚未来得及参透此界长生奥秘，便被突如其来的五色天刀斩灭' });
        return;
      }
      g.strangeWorldInsight += 12;
      push(log, { cls: 'god', text: '你竭尽帝道手段避开绝杀，并从对方的涅槃气息中窥见一缕长生真意' });
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
        push(log, { cls: 'god', text: '界海风暴席卷仙土，你以帝躯硬抗而过，肉身根基+1，长生感悟+' + add });
      } else {
        g.cult = round(g.cult * 0.88);
        push(log, { cls: 'dead', text: '你被界海风暴重创，实力跌落至' + g.cult + '，不得不蛰伏疗伤' });
      }
    } else if (r < 0.80) {
      add = irand(8, 14); g.strangeWorldInsight += add; g.redDustRoots.soul++;
      push(log, { cls: 'ev4', text: '你在古老仙土中寻得前人蜕变遗痕，元神根基+1，长生感悟+' + add });
    } else if (r < 0.90) {
      add = irand(5, 10); g.strangeWorldInsight += add; g.redDustRoots.dao++;
      if (g.strangeWorldAlliance === 'wushi') g.strangeWorldInsight += 3;
      push(log, { cls: 'rare', text: '万载岁月流转，你在此界重演自身帝法，道果根基+1，长生感悟+' + add });
    } else {
      var danger = ['界海风暴撕开你的闭关地', '古代强者循着帝道气机袭杀而来', '异界法则反噬旧日道果', '熔炼长生物质时修行失控'][irand(0, 3)];
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
  function tryImmortalRoad(g, log) {
    var daoPeak = g.daoyunCap > 0 ? g.daoyun / g.daoyunCap : 0;
    var chance = clamp(0.08 + Math.min(0.30, g.cult / D.UNDEAD_EMPEROR_CULT * 0.30) + Math.min(0.32, daoPeak * 0.32), 0.08, 0.70);
    push(log, { cls: 'rainbow', text: '成仙路于这一世开启，你携帝道冲关；凭当前战力与道蕴，闯关把握约' + Math.round(chance * 100) + '%' });
    if (Math.random() >= chance) {
      g.dead = true; g.deadCause = 'immortal_road';
      push(log, { cls: 'dead', text: '成仙路崩裂，你未能跨过那一道天堑，帝躯消散于仙路尽头' });
      return;
    }
    g.redDustImmortal = true; g.ascended = true; g.immortalMode = 'immortal_road';
    g.cult = round(g.cult * rand(1.8, 2.3));
    push(log, { cls: 'god', text: '你横渡成仙路，万法归一，终成红尘仙！' });
  }
  function chooseImmortalPath(g, path, log) {
    if (!g || !g.awaitingImmortalPath) return false;
    g.awaitingImmortalPath = false;
    if (path === 'strange') {
      push(log, { cls: 'god', text: '你不再等待，轰开界壁，主动打入奇异世界！' });
      enterStrangeWorld(g, log);
    } else {
      g.waitingImmortalRoad = true;
      push(log, { cls: 'rare', text: '你放弃眼前奇异世界之门，选择静候成仙路；此路不知何时开启，也可能此生无缘' });
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
    g.nextWorldEmperorYear = (g.worldYear || 0) + irand(800, 5000);
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

  function stepForbiddenLord(g, log) {
    if (g.awaitingDarkTurmoil || g.awaitingImmortalPath) return;
    if (g.forbiddenEssence <= 0) {
      g.dead = true; g.deadCause = 'forbidden_exhausted';
      push(log, { cls: 'dead', text: g.sealingMaterial + '中的长生物质耗尽，你的禁区再也无法封存生机，残缺帝躯最终化作尘埃' });
      return;
    }
    var sleepRange = forbiddenSleepRange(g);
    var sleep = irand(sleepRange[0], sleepRange[1]);
    g.age += sleep;
    advanceWorldCalendar(g, sleep, null);
    g.forbiddenEssence--;
    push(log, { cls: 'rare', text: '你封于' + g.sealingMaterial + '，沉睡' + sleep + '年后于万古历' + g.worldYear + '年苏醒；生命本源余' + g.forbiddenEssence + '道，' +
      (g.worldEmperor ? '此世天心有主' : '此世尚无大帝') });

    /* 已知坐标且战力恢复到破界线，苏醒后会立刻踏入奇异世界。 */
    if (g.waitingImmortalRoad && Math.random() < 0.18) {
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
    } else {
      var roll = Math.random();
      if (!g.knowsStrangeWorld && roll < 0.35) {
      g.knowsStrangeWorld = true;
      push(log, { cls: 'rainbow', text: '你从仙路残片与古代至尊遗骸中，终于获知奇异世界坐标' });
      } else if (roll < 0.70) {
        /* 黑暗动乱是玩家的道德与生存抉择，不再后台自动代选。 */
        g.awaitingDarkTurmoil = true;
        push(log, { cls: 'dead', text: '你苏醒的年代众生鼎盛，禁区本源却在流失：是否发动黑暗动乱，吞纳众生精气续命？' });
        /* 批量校准默认不发动，避免把模拟结果建立在自动屠戮之上。 */
        if (_fast) chooseDarkTurmoil(g, false, log);
        return;
      } else {
        g.cult = round(g.cult * rand(1.04, 1.09));
        push(log, { cls: 'gain', text: '你于神源中推演残缺皇道，虽未补全帝位，实力仍精进至' + g.cult });
      }
    }

    if (!g.dead && canChooseImmortalPath(g)) {
      openImmortalPathChoice(g, log);
    }
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

  function finishEmperorLife(g, log) {
    if (g.redDustPath === 'reverse') {
      tryReverseLife(g, log);
      return;
    }
    if (g.waitingImmortalRoad) {
      g.dead = true; g.deadCause = 'waited_immortal_road';
      push(log, { cls: 'dead', text: '帝命耗尽，成仙路始终未在此世开启；你错过奇异世界之门，最终坐化' });
      return;
    }
    if (Math.random() < reversePathChance(g)) {
      g.redDustPath = 'reverse';
      push(log, { cls: 'rainbow', text: '帝命将尽，你悟出一条前无古人的九世蜕变之路，决定不入奇异世界，以己身逆夺长生！' });
      tryReverseLife(g, log, true);
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

  function stepEmperor(g, log) {
    if (g.inStrangeWorld) { stepStrangeWorld(g, log); return; }
    if (g.forbiddenLord) { stepForbiddenLord(g, log); return; }
    if (g.awaitingImmortalPath) return;
    if (g.waitingImmortalRoad) {
      var waitSpan = Math.max(1, g.emperorLifeEnd - g.emperorLifeStart);
      if (Math.random() < D.IMMORTAL_ROAD_EVENT_TARGET / waitSpan) { tryImmortalRoad(g, log); return; }
    } else if (canChooseImmortalPath(g)) {
      openImmortalPathChoice(g, log);
      return;
    }
    /* 只在第一世帝命晚年给予一次自斩抉择；选择由前台弹窗处理。 */
    if (!g.selfSlashOffered && !g.selfSlashed && !g.selfSlashDeclined && g.lifeNo === 1 &&
        g.age >= g.emperorLifeEnd - 100) {
      g.selfSlashOffered = true;
      /* 批量校准不应卡在前台弹窗，默认按“保全帝位”路线继续。 */
      if (_fast) {
        g.selfSlashDeclined = true;
        return;
      }
      g.awaitingSelfSlash = true;
      push(log, { cls: 'rainbow', text: '帝命只余百年：是保全皇道、继续求仙，还是自斩一刀、入主禁区？' });
      return;
    }
    if (g.awaitingSelfSlash) return;
    /* 帝者一世万年仍在推演己身大道；这是道蕴真正拉开差距的阶段。 */
    gainDaoyun(g, 0.010 * (0.5 + g.innate * 0.25));
    var span = Math.max(1, g.emperorLifeEnd - g.emperorLifeStart);
    if (Math.random() < D.EMPEROR_EVENT_TARGET / span) emperorEvent(g, log);
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
    return g.cult * m;
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
    push(log, { cls: 'rainbow', text: '帝关破碎，你以命格护住真灵，保留一次重修机会；实力受损，闭关至第' + g.emperorAttemptAge + '岁再争帝路' });
    return true;
  }
  function tryZhengdao(g, log) {
    var extra = g.tm.zhx + pval(g, 'zhx', 0);
    var eff = zhengdaoEff(g);     /* 判定用战力：含隐藏的帝兵/不死药加持 */
    if (g.worldEmperor) {
      if (eff < D.OVERWHELM_DAO_CULT) {
        if (spendImperialRetry(g, log)) return true;
        push(log, { cls: 'dead', text: '第' + g.age + '岁，当世已有大帝镇压万道；你的' + Math.round(eff / 10000) +
          '万战力尚未达到破灭万道的90万门槛，帝关在道压中崩碎' });
        g.dead = true; g.deadCause = 'world_emperor_suppression';
        return true;
      }
      var overwhelmChance = clamp(0.35 + (eff - D.OVERWHELM_DAO_CULT) / 600000 + extra +
        (g.tm.ignoreSuppression || 0), 0.35, 1);
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
    if (g.xintian) {
      var red = clamp(g.tm.dlm + pval(g, 'dlm', 0), 0, 90);
      var fade = g.age > D.EMPEROR_PATH_FADE_AGE ? 1 + 0.3 * (g.age - D.EMPEROR_PATH_FADE_AGE) / (D.EMPEROR_PATH_CLOSE_AGE - D.EMPEROR_PATH_FADE_AGE) : 1;
      var suppression = g.daoSuppressed && g.physiqueId !== 'chaos' ?
        1 + 0.5 * (1 - (g.tm.ignoreSuppression || 0)) : 1;
      var need = Math.max(1, Math.round(irand(D.XINTIAN_NEED_MIN, D.XINTIAN_NEED_MAX) * (1 - red / 100) * fade * suppression));
      /* 准帝九重天即已走到帝关前，战力达标后融合天心必成。 */
      if (g.lvl >= 99 && eff >= need) {
        becomeDi(g, log, 'tianxin');
        push(log, { cls: 'god', text: '第' + g.age + '岁，天心合一，我道即天道，证道成帝！' });
        return true;
      }
      /* 未修炼至圆满（未到准帝巅峰或战力不足）也可强行融合天心：即便战力达标也只有 15% 把握，失败即身陨 */
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
    /* 无天心：以力证道（按判定战力查概率曲线） */
    var latePenalty = g.age > D.EMPEROR_PATH_FADE_AGE ? 1 - 0.5 * (g.age - D.EMPEROR_PATH_FADE_AGE) / (D.EMPEROR_PATH_CLOSE_AGE - D.EMPEROR_PATH_FADE_AGE) : 1;
    var daoPenalty = g.daoSuppressed && g.physiqueId !== 'chaos' ? 0.15 : 1;
    var prob = Math.min(1, (zhengdaoChance(eff) + extra) * Math.max(0.5, latePenalty) * daoPenalty);
    if (Math.random() < prob) {
      becomeDi(g, log, 'force');
      push(log, { cls: 'god', text: '第' + g.age + '岁，一力降万法，强行证道，破开帝关！' });
      return true;
    }
    if (spendImperialRetry(g, log)) return true;
    push(log, { cls: 'dead', text: '第' + g.age + '岁，冲击帝关失败，大道反噬，身死道消' });
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
  function createGame(playerLv, traitIds) {
    var t = drawTalent(playerLv);
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
      inStrangeWorld: false, strangeWorldYears: 0, strangeWorldInsight: 0, strangeWorldEvents: 0, strangeWorldImmortalAttempts: 0,
      strangeWorldSituation: null, strangeWorldAlliance: null, strangeWorldThreatKnown: false,
      awaitingStrangeWorldChoice: false, undeadLives: 0, undeadCult: 0, undeadImmortal: false, defeatedUndead: false,
      ascendMode: null, deadCause: null,
      daoSuppressed: false,
      worldYear: 0, worldHistory: [], worldEmperor: null, worldEmperorSeq: 0,
      nextWorldEmperorYear: null, playerEmperorActive: false,
      xintian: false, deathless: false, deathlessUsed: false, reverseMedicineUsed: false,
      xianSource: false, primordialStone: false, sealingMaterial: '',
      knowsStrangeWorld: false,
      awaitingSelfSlash: false, selfSlashOffered: false, selfSlashDeclined: false, selfSlashed: false,
      awaitingDarkTurmoil: false, forcedDarkTurmoil: false, awaitingImmortalPath: false, waitingImmortalRoad: false,
      forbiddenLord: false, forbiddenEssence: 0, forbiddenKarma: 0,
      traits: [],
      daoyun: baseDaoyun(t.innate),
      daoyunCap: baseDaoyunCap(t.innate),
      era: null, swallowingArt: false,
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

    /* 道蕴是可积累的后期根基；平常时代积累缓慢，黄金大世更易悟道。 */
    gainDaoyun(g, 0.125 * (0.2 + g.innate * 0.5));
    /* 凡体的逆天线：继承/自创吞天魔功后，积累足够道蕴可蜕为混沌体。 */
    if (g.swallowingArt && g.physiqueId !== 'chaos' && g.lvl >= 71 && g.daoyun >= 85) {
      var swallowChance = g.gotRuthless ? 0.004 : 0.001;
      if (Math.random() < swallowChance) {
        setPhysique(g, D.physiqueById('chaos'));
        g.daoyunCap = Math.max(g.daoyunCap, 1500);
        push(log, { cls: 'rainbow', text: '第' + g.age + '岁，你以吞天魔功熔炼万法，褪去旧躯，蜕变为混沌体！' });
      }
    }
    if (!g.swallowingArt && g.innate <= 2 && g.lvl >= 71 && g.daoyun >= 120 && Math.random() < 0.00001 * ((g.era && g.era.daog) || 1)) {
      g.swallowingArt = true;
      push(log, { cls: 'rainbow', text: '第' + g.age + '岁，你观万法而自创吞天之意；此路逆天，唯有熔炼万体才可继续前行' });
    }

    if (g.age > D.EMPEROR_PATH_CLOSE_AGE) {
      g.dead = true; g.deadCause = 'missed_emperor_path';
      push(log, { cls: 'dead', text: '第' + g.age + '岁，黄金帝路彻底闭合，你血气衰败，最终坐化于准帝绝巅之前' });
      return;
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
        g.resonanceState.tianxinPity += (g.tm.xinPity || 0) + (g.resonance === 'tianxin' ? 0.000006 : 0);
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
    quasiLayerMultiplier: quasiLayerMultiplier,
    attemptBreak: attemptBreak,
    cultGain: cultGain,
    gainLife: gainLife,
    subLife: subLife,
    realmLifeRefill: realmLifeRefill,
    zhengdaoChance: zhengdaoChance,
    zhengdaoEff: zhengdaoEff,
    xianCult: xianCult,
    gainLevels: gainLevels,
    levelUp: levelUp,
    drawTraits: drawTraits,
    applyTraits: applyTraits,
    resolveTraitResonance: resolveTraitResonance,
    gainDaoyun: gainDaoyun,
    tryBodyEvolution: tryBodyEvolution,
    eventDaoyunTier: eventDaoyunTier,
    tianxinChance: tianxinChance,
    createGame: createGame,
    rollYear: rollYear,
    setFast: setFast,
    tryZhengdao: tryZhengdao,
    reverseLifeChance: reverseLifeChance,
    tryReverseLife: tryReverseLife,
    initWorldCalendar: initWorldCalendar,
    advanceWorldCalendar: advanceWorldCalendar,
    becomeDi: becomeDi,
    chooseSelfSlash: chooseSelfSlash,
    chooseDarkTurmoil: chooseDarkTurmoil,
    chooseImmortalPath: chooseImmortalPath,
    chooseStrangeWorldAlliance: chooseStrangeWorldAlliance,
    stepStrangeWorld: stepStrangeWorld,
    tryStrangeWorldImmortality: tryStrangeWorldImmortality,
    finishStrangeWorldBattle: finishStrangeWorldBattle,
    undeadEmperorForRoll: undeadEmperorForRoll,
    forbiddenSleepRange: forbiddenSleepRange,
    forbiddenPurgeChance: forbiddenPurgeChance,
    setPhysique: setPhysique,
    testLv: testLv, testCult: testCult,
    EVENTS: E, DATA: D, U: U
  };
});
