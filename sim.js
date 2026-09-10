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
    if (capAdd) g.daoyunCap += capAdd;
    var old = g.daoyun;
    g.daoyun = Math.min(g.daoyunCap, g.daoyun + amount * g.tm.daog * pval(g, 'daog', 1) * ((g.era && g.era.daog) || 1));
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
  function baseDaoyunCap(tier) { return [0, 200, 220, 240, 270, 300, 340, 390, 450, 520, 600][tier] || 200; }

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
  function attemptBreak(g) {
    if (g.lvl >= 100) return 0;
    if (!canAdvance(g)) return 0;
    var coef = breakAgeCoef(g);
    var base = breakChance(g.aptitude, g.lvl) * coef * g.tm.brk * pval(g, 'brk', 1);
    if (base <= 0.25 + 1e-9) {
      return Math.random() < base ? 1 : 0;
    }
    var gained = 0, step = 0;
    while (true) {
      var lvl = g.lvl + gained;
      if (lvl >= 100) break;
      var b = breakChance(g.aptitude, lvl) * coef * g.tm.brk * pval(g, 'brk', 1);
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
      var a2 = round(10000 * g.tm.cgt * pval(g, 'cgt', 1));
      g.cult += a2;
      if (log) log.push({ cls: 'brk', text: '准帝巅峰圆满，参悟己身大道，实力+' + a2 });
      return;
    }
    var nl = g.lvl + 1;
    var cg = round(cultGain(g.aptitude, nl) * g.tm.cgt * pval(g, 'cgt', 1));
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
      v = round(v * g.tm.cgt * pval(g, 'cgt', 1));
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
  function applyTraits(g, ids) {
    g.traits = ids || [];
    g.tm = { brk: 1, cgt: 1, evf: 1, evt: 1, xin: 1, ward: 0, zhx: 0, dlm: 0, daog: 1, era: 1, retry: 0 };
    var floorMax = 0, aptAdd = 0, gold = 0, pur = 0;
    for (var i = 0; i < g.traits.length; i++) {
      var t = D.traitById(g.traits[i]);
      if (!t) continue;
      if (t.color === 'o') gold++;
      else if (t.color === 'p') pur++;
      for (var j = 0; j < t.fx.length; j++) {
        var ty = t.fx[j][0], v = t.fx[j][1];
        if (ty === 'life') g.lifeBonus += v;
        else if (ty === 'cult') g.cult += v;
        /* 旧“资质+N”统一改为可成长的道蕴，不再把两张卡直接叠成顶级体质。 */
        else if (ty === 'apt') { g.daoyun += v * 8; g.daoyunCap += v * 10; }
        else if (ty === 'floor') { if (v > floorMax) floorMax = v; }
        else if (ty === 'brk') g.tm.brk *= v;
        else if (ty === 'cgt') g.tm.cgt *= v;
        else if (ty === 'evf') g.tm.evf *= v;
        else if (ty === 'evt') g.tm.evt *= v;
        else if (ty === 'xin') g.tm.xin *= v;
        else if (ty === 'ward') g.tm.ward += v;
        else if (ty === 'zhx') g.tm.zhx += v;
        else if (ty === 'dlm') g.tm.dlm += v;
        else if (ty === 'dao') g.daoyun += v;
        else if (ty === 'daog') g.tm.daog *= v;
        else if (ty === 'daocap') g.daoyunCap += v;
        else if (ty === 'era') g.tm.era *= v;
        else if (ty === 'swallow') g.swallowingArt = true;
        else if (ty === 'retry') g.tm.retry += v;
      }
    }
    /* 先按词条的 floor/资质正常结算；保底抬升先天品阶时，从对应原著体质池随机觉醒。 */
    var oldInnate = g.innate;
    var targetInnate = Math.max(g.innate, floorMax);
    var targetAptitude = Math.max(targetInnate, Math.min(10, targetInnate + aptAdd));
    /* 隐藏金系保底（最后结算）：若正常结果低于保底，强制抬到保底档——只抬不压 */
    if (gold > 0) {
      var guard = gold >= 2 ? 7 : (pur >= 1 ? (Math.random() < 0.5 ? 5 : 6) : 5);
      if (targetAptitude < guard) {
        targetInnate = Math.max(targetInnate, guard);
        targetAptitude = guard;
      }
    }
    if (targetInnate > oldInnate) setPhysique(g, pickPhysique(targetInnate));
    g.innate = targetInnate;
    g.aptitude = Math.max(targetInnate, targetAptitude);
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
      var daoGain = [0, 1, 2, 6, 15][ev.tier] || 1;
      /* 普通高阶机缘只能积累道蕴；唯有传说级机缘才可能抬高天赋上限。 */
      gainDaoyun(g, daoGain, ev.tier === 4 ? 4 : 0);
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
    g.emperor = true; g.becameEmperor = true; g.ascendMode = mode; g.lvl = 101;
    g.emperorAge = g.age; g.lifeNo = 1; g.redDustMarks = 0;
    g.redDustPath = null; g.immortalMode = null; g.strangeWorldYears = 0;
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

  function tryReverseLife(g, log) {
    var roots = g.redDustRoots;
    var total = roots.body + roots.soul + roots.dao;
    /* 选择逆活路以后，每一世仍是生死大劫；越到后期越难，不能靠常规积累稳定九世。 */
    var daoPeak = g.daoyunCap > 0 ? g.daoyun / g.daoyunCap : 0;
    var daoBonus = Math.max(0, g.daoyun - 150) * 0.003 + Math.max(0, daoPeak - 0.85) * 0.20;
    var chance = 0.30 + Math.min(0.12, total * 0.005) + Math.min(0.42, daoBonus) - Math.max(0, g.lifeNo - 1) * 0.04;
    if (g.gotDiBing) chance += 0.02;
    chance = clamp(chance, 0.08, 0.88);
    var rescued = false, success = Math.random() < chance;
    if (!success && g.deathless && !g.deathlessUsed && !g.reverseMedicineUsed) {
      g.deathlessUsed = true; g.reverseMedicineUsed = true; rescued = true; success = true;
    }
    if (!success) {
      g.dead = true; g.deadCause = 'reverse';
      push(log, { cls: 'dead', text: '第' + g.lifeNo + '世帝命燃尽，你试图逆夺造化，却在蜕变中道崩身灭' });
      return;
    }
    var route = roots.body >= roots.soul && roots.body >= roots.dao ? '帝躯涅槃' :
      (roots.soul >= roots.dao ? '元神化胎' : '斩尽旧道');
    if (rescued) route = '不死神药续命';
    g.lifeNo++;
    g.redDustMarks = g.lifeNo - 1;
    g.cult = round(g.cult * rand(1.06, 1.16));
    push(log, { cls: 'rainbow', text: '帝命将尽，你以『' + route + '』逆活出第' + g.lifeNo + '世，凝成一枚红尘印' });
    if (g.lifeNo >= D.RED_DUST_LIVES) {
      g.redDustImmortal = true; g.ascended = true; g.immortalMode = 'nine_lives';
      g.cult = round(g.cult * 2);
      push(log, { cls: 'god', text: '九世道果合一，岁月再不能加身——你于万丈红尘中化作仙！' });
      return;
    }
    resetEmperorLife(g);
  }

  /* 悟出连续逆活之法本身就是万古罕见的奇迹。典型一世大帝只有约千分之一机会踏上此路，
   * 真正连续渡过八次生死蜕变还要再过八重独立判定。 */
  function reversePathChance(g) {
    var roots = g.redDustRoots;
    var balance = Math.min(roots.body, roots.soul, roots.dao);
    var ratio = g.cult / D.UNDEAD_EMPEROR_CULT;
    var daoPeak = g.daoyunCap > 0 ? g.daoyun / g.daoyunCap : 0;
    /* 道蕴圆满者已悟出独属于自己的长生法，才有资格稳定挑战九世蜕变。 */
    if (daoPeak >= 0.98) return clamp(0.35 + Math.min(0.35, (g.daoyun - 180) * 0.004), 0.35, 0.70);
    return clamp(0.0001 + Math.min(0.0012, balance * 0.00015) + Math.max(0, ratio - 0.5) * 0.002 + Math.max(0, daoPeak - 0.85) * 0.08, 0.0001, 0.10);
  }

  function strangeWorldBattleChance(g) {
    var ratio = g.cult / D.UNDEAD_EMPEROR_CULT;
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
    return clamp(chance, 0.01, 0.98);
  }

  function enterStrangeWorld(g, log) {
    g.redDustPath = 'strange_world';
    var boss = D.UNDEAD_EMPEROR_CULT;
    var chance = strangeWorldBattleChance(g);
    push(log, { cls: 'god', text: '帝命将尽，你没有贸然逆活，而是轰开仙路、打入奇异世界；不死天皇以三世天帝级战力截杀而来！' });
    push(log, { cls: 'ev4', text: '你当前战力相当于不死天皇的' + Math.round(g.cult / boss * 100) + '%，结合帝者根基，此战胜算约' + Math.round(chance * 100) + '%' });
    if (Math.random() >= chance) {
      g.dead = true; g.deadCause = 'undead_emperor';
      push(log, { cls: 'dead', text: '你当前实力仅有不死天皇的' + Math.round(g.cult / boss * 100) + '%，血战后仍被五色天刀斩灭' });
      return;
    }
    g.strangeWorldYears = irand(D.STRANGE_WORLD_YEARS_MIN, D.STRANGE_WORLD_YEARS_MAX);
    g.age += g.strangeWorldYears;
    g.cult = round((g.cult + boss) * rand(1.15, 1.35));
    g.redDustImmortal = true; g.ascended = true; g.immortalMode = 'strange_world';
    push(log, { cls: 'god', text: '你挡住五色天刀，在奇异世界站稳脚跟；又经' + g.strangeWorldYears + '年炼化长生物质，最终于红尘中成仙！' });
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
    g.cult = round(g.cult * 0.75);
    push(log, { cls: 'dead', text: '你自斩一刀，皇道果位残缺，战力跌落至' + g.cult + '；以' + g.sealingMaterial + '自封，化为一代禁区至尊' });
    push(log, { cls: 'rainbow', text: '禁区之路：拥有' + g.forbiddenEssence + '道生命本源，可跨数万年沉睡；但已永失九世逆活之资格' });
    return true;
  }

  function forbiddenBattleChance(g) {
    var ratio = g.cult / 1800000;
    return clamp(0.05 + ratio * 0.32 + (g.tm.ward + pval(g, 'ward', 0)) / 500 - g.forbiddenKarma * 0.035, 0.05, 0.72);
  }

  function stepForbiddenLord(g, log) {
    if (g.forbiddenEssence <= 0) {
      g.dead = true; g.deadCause = 'forbidden_exhausted';
      push(log, { cls: 'dead', text: g.sealingMaterial + '中的长生物质耗尽，你的禁区再也无法封存生机，残缺帝躯最终化作尘埃' });
      return;
    }
    var sleep = irand(30000, 80000);
    g.age += sleep;
    g.forbiddenEssence--;
    push(log, { cls: 'rare', text: '你封于' + g.sealingMaterial + '，沉睡' + sleep + '年后于新纪元苏醒；生命本源余' + g.forbiddenEssence + '道' });

    /* 已知坐标且战力恢复到破界线，苏醒后会立刻踏入奇异世界。 */
    if (g.knowsStrangeWorld && g.cult >= D.STRANGE_WORLD_BREAK_CULT) {
      push(log, { cls: 'god', text: '漫长沉睡后，你的残缺帝躯终于恢复到可破界之力，决定打入奇异世界' });
      enterStrangeWorld(g, log);
      return;
    }

    var roll = Math.random();
    if (!g.knowsStrangeWorld && roll < 0.35) {
      g.knowsStrangeWorld = true;
      push(log, { cls: 'rainbow', text: '你从仙路残片与古代至尊遗骸中，终于获知奇异世界坐标' });
    } else if (roll < 0.70) {
      /* 黑暗动乱是续命手段而非奖励：补本源、强战力，也显著提高被清算的风险。 */
      g.forbiddenKarma++;
      g.forbiddenEssence = Math.min(4, g.forbiddenEssence + 1);
      g.cult = round(g.cult * rand(1.12, 1.20));
      push(log, { cls: 'dead', text: '你发动黑暗动乱，吞纳众生精气，生命本源+1、实力攀升至' + g.cult + '；血债+' + g.forbiddenKarma });
    } else if (roll < 0.86) {
      var battle = forbiddenBattleChance(g);
      push(log, { cls: 'ev4', text: '当世大帝前来平定禁区，你以残缺帝躯迎战，胜算约' + Math.round(battle * 100) + '%' });
      if (Math.random() >= battle) {
        g.dead = true; g.deadCause = 'forbidden_battle';
        push(log, { cls: 'dead', text: '你被当世大帝镇杀，禁区崩毁，万古谋划尽成空' });
        return;
      }
      g.cult = round(g.cult * rand(1.08, 1.16));
      push(log, { cls: 'god', text: '你击退当世大帝，残缺皇道在血战中复苏，实力升至' + g.cult });
    } else {
      g.cult = round(g.cult * rand(1.04, 1.09));
      push(log, { cls: 'gain', text: '你于神源中推演残缺皇道，虽未补全帝位，实力仍精进至' + g.cult });
    }

    if (!g.dead && g.knowsStrangeWorld && g.cult >= D.STRANGE_WORLD_BREAK_CULT) {
      push(log, { cls: 'god', text: '你已集齐坐标与破界战力，趁苏醒之机轰开界壁，打入奇异世界' });
      enterStrangeWorld(g, log);
    }
  }

  function finishEmperorLife(g, log) {
    if (g.redDustPath === 'reverse') {
      tryReverseLife(g, log);
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

  function stepEmperor(g, log) {
    if (g.forbiddenLord) { stepForbiddenLord(g, log); return; }
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
    gainDaoyun(g, 0.006 * (0.5 + g.innate * 0.25));
    var span = Math.max(1, g.emperorLifeEnd - g.emperorLifeStart);
    if (Math.random() < D.EMPEROR_EVENT_TARGET / span) emperorEvent(g, log);
    if (g.age >= g.emperorLifeEnd) finishEmperorLife(g, log);
  }
  /* 隐藏加成：获得过极道帝兵 / 不死药 者，证道判定时临时提升判定战力各 5%（各只算一次，不实际改战力） */
  function zhengdaoEff(g) {
    var m = 1;
    if (g.gotDiBing) m *= 1.05;   /* 曾获得极道帝兵 */
    if (g.deathless) m *= 1.05;   /* 曾获得不死药（含已服用） */
    return g.cult * m;
  }
  function spendImperialRetry(g, log) {
    if (!g.tm || g.tm.retry <= 0) return false;
    g.tm.retry--;
    g.cult = round(g.cult * 0.72);
    g.lifeBase = Math.max(g.age + 300, g.lifeBase - irand(300, 800));
    syncLife(g);
    g.emperorAttemptAge = g.age + irand(300, 800);
    push(log, { cls: 'rainbow', text: '帝关破碎，你以命格护住真灵，保留一次重修机会；实力受损，闭关至第' + g.emperorAttemptAge + '岁再争帝路' });
    return true;
  }
  function tryZhengdao(g, log) {
    var extra = g.tm.zhx + pval(g, 'zhx', 0);
    var eff = zhengdaoEff(g);     /* 判定用战力：含隐藏的帝兵/不死药加持 */
    if (g.xintian) {
      var red = clamp(g.tm.dlm + pval(g, 'dlm', 0), 0, 90);
      var fade = g.age > D.EMPEROR_PATH_FADE_AGE ? 1 + 0.3 * (g.age - D.EMPEROR_PATH_FADE_AGE) / (D.EMPEROR_PATH_CLOSE_AGE - D.EMPEROR_PATH_FADE_AGE) : 1;
      var suppression = g.daoSuppressed && g.physiqueId !== 'chaos' ? 1.5 : 1;
      var need = Math.max(1, Math.round(irand(D.XINTIAN_NEED_MIN, D.XINTIAN_NEED_MAX) * (1 - red / 100) * fade * suppression));
      /* 已至准帝巅峰且判定战力达标 → 圆满融合天心，必成 */
      if (g.lvl >= 100 && eff >= need) {
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
      ascended: false, emperor: false, becameEmperor: false, redDustImmortal: false,
      emperorAge: 0, emperorAttemptAge: 0, emperorLifeStart: 0, emperorLifeEnd: 0, lifeNo: 0, redDustMarks: 0,
      redDustRoots: { body: 0, soul: 0, dao: 0 }, redDustPath: null, immortalMode: null,
      strangeWorldYears: 0, ascendMode: null, deadCause: null,
      daoSuppressed: Math.random() < 0.12,
      xintian: false, deathless: false, deathlessUsed: false, reverseMedicineUsed: false,
      xianSource: false, primordialStone: false, sealingMaterial: '',
      knowsStrangeWorld: false,
      awaitingSelfSlash: false, selfSlashOffered: false, selfSlashDeclined: false, selfSlashed: false,
      forbiddenLord: false, forbiddenEssence: 0, forbiddenKarma: 0,
      traits: [],
      daoyun: baseDaoyun(t.innate),
      daoyunCap: baseDaoyunCap(t.innate),
      era: null, swallowingArt: false,
      tm: { brk: 1, cgt: 1, evf: 1, evt: 1, xin: 1, ward: 0, zhx: 0, dlm: 0, daog: 1, era: 1, retry: 0 }
    };
    syncLife(g);
    applyTraits(g, traitIds);
    g.era = drawEra(g.tm.era);
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
        g.daoyunCap = Math.max(g.daoyunCap, 600);
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
    if (!g.ascended && Math.random() < D.JIDAO_CHANCE) {
      g.gotJidao = true;
      becomeDi(g, log, 'jidao');
      push(log, { cls: 'rainbow', text: '第' + g.age + '岁，得见祭道之门，承接古之大帝遗泽，一步证道成帝！' });
      return;
    }
    /* 特殊事件：合道花现世，直接证道成帝 */
    if (!g.ascended && Math.random() < D.HEDAO_CHANCE) {
      g.gotHedao = true;
      becomeDi(g, log, 'hedao');
      push(log, { cls: 'rainbow', text: '第' + g.age + '岁，万古难遇的合道花于你面前绽放，花落道成，证道成帝！' });
      return;
    }
    /* 特殊事件：大帝转世（前世道果令修炼资质臻至绝顶，不改先天体质） */
    if (Math.random() < D.DAZHUAN_CHANCE) {
      g.aptitude = 10;
      g.daoyunCap = Math.max(g.daoyunCap, 600); g.daoyun = Math.max(g.daoyun, 150);
      g.lifeBonus += 100; syncLife(g);
      g.gotDazhuan = true;
      push(log, { cls: 'red', text: '第' + g.age + '岁，你竟是大帝转世！灵台深处记忆觉醒，修炼资质臻至绝顶，寿元+100' });
    }
    /* 特殊事件：叶天帝（原韩跑跑）：赠资源提资质，另有不死药相赠 */
    if (Math.random() < D.YETIAN_CHANCE) {
      g.aptitude = 10;
      g.daoyunCap = Math.max(g.daoyunCap, 520); g.daoyun = Math.max(g.daoyun, 120);
      var cY = round(100000 * g.tm.cgt * pval(g, 'cgt', 1));
      g.cult += cY;
      var give = false;
      if (!g.deathless) { g.deathless = true; give = true; }
      g.gotYetian = true;
      push(log, { cls: 'red', text: '第' + g.age + '岁，遇见一位白衣少年，自称叶某人，与你颇为投缘，赠你大量神源与造化，修炼资质臻至绝顶，实力+' + cY + (give ? '，并赠你一株不死药' : '') });
    }

    /* 天心：准帝期（≥91级）后每年有望感悟；先天品阶与具体体质特性共同生效。 */
    if (!g.xintian && g.lvl >= 91 && !g.ascended) {
      var tMult = (D.XINTIAN_TALENT_MULT && D.XINTIAN_TALENT_MULT[g.innate]) || 1;
      if (Math.random() < (D.XINTIAN_CHANCE * g.tm.xin * pval(g, 'xin', 1) * tMult)) {
        g.xintian = true; g.gotXintian = true;
        push(log, { cls: 'ev4', text: '第' + g.age + '岁，于冥冥中感悟天心，诸天道则垂落，你的成道之路一片坦途！' });
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

    /* 修行中水到渠成：实力缓慢沉淀 */
    if (Math.random() < (D.STEADY_TARGET / g.lifespan * g.tm.evf * pval(g, 'evf', 1))) {
      var sInc = round(round(g.cult * rand(0.001, 0.0015)) * g.tm.cgt * pval(g, 'cgt', 1));
      if (sInc < 5) sInc = 5;
      g.cult += sInc;
      push(log, { cls: 'gain', text: '第' + g.age + '岁，水到渠成，实力有所精进，+' + sInc });
    }

    /* 准帝巅峰圆满后：每年默默精进 +1~5 战力（后台结算，不弹日志） */
    if (g.lvl >= 100 && !g.ascended) g.cult += round(1 + Math.random() * 4);

    /* 不死药续命：寿元仅剩 ≤20 年时服下，再活一世 */
    if (!g.dead && !g.ascended && g.lifespan - g.age <= 20) {
      if (tryDeathless(g, log)) return;
    }
    /* 准帝巅峰不会枯等晚年：圆满后闭关 10~100 年便争渡帝关。
     * 未圆满而持天心者仍只会在寿元将尽时冒险强融，保留随机逆袭与风险。 */
    if (g.lvl >= 100 && !g.emperorAttemptAge) g.emperorAttemptAge = g.age + irand(10, 100);
    var shouldAttempt = (g.lvl >= 100 && g.age >= g.emperorAttemptAge) ||
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
    breakChance: breakChance,
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
    createGame: createGame,
    rollYear: rollYear,
    setFast: setFast,
    tryZhengdao: tryZhengdao,
    becomeDi: becomeDi,
    chooseSelfSlash: chooseSelfSlash,
    setPhysique: setPhysique,
    testLv: testLv, testCult: testCult,
    EVENTS: E, DATA: D, U: U
  };
});
