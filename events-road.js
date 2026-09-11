/* ============================================================
 * 遮天模拟器 · 随机事件 · 古路包（星空古路 / 秘境副本 / 梭哈型关键机缘）
 *
 * 本包是全项目最强调「玩家主动权」的一块：
 *   A 梭哈型关键机缘 —— 退避 / 稳取 / 梭哈 三档，梭哈失败当场身陨
 *   B 星空古路       —— g.roadSegment 分段推进，段位与境界挂钩
 *   C 秘境副本       —— 外围（安全）→ 中层（有风险）→ 核心（梭哈）
 *   D 准帝与帝关     —— 只加战力/道蕴/根基，成帝判定仍归 sim.js
 *
 * 契约见 docs/superpowers/specs/2026-09-10-event-authoring-contract.md：
 *   - 每个选择型事件恰有一个 safe 选项（快速模式与批量模拟按它自动决策）
 *   - choice 里展示的 chance 必须与 resolve 里实际判定的概率是同一个数，
 *     因此所有概率一律走下面的 odds()，它只读 g 的当前状态，不含随机量。
 * ============================================================ */
(function (root) {
  var POOLS = typeof module !== 'undefined' && module.exports ? require('./events-pools.js') : root.EVENT_POOLS;
  var PICK = POOLS.PICK;
  var T4_BING = POOLS.T4_BING, T3_BING = POOLS.T3_BING;
  var T4_HERB = POOLS.T4_HERB, T3_HERB = POOLS.T3_HERB, T2_HERB = POOLS.T2_HERB;
  var T4_CHUAN = POOLS.T4_CHUAN, T3_GONG = POOLS.T3_GONG, NINE_SECRETS = POOLS.NINE_SECRETS;
  var T4_MI = POOLS.T4_MI, T3_MI = POOLS.T3_MI, T2_MI = POOLS.T2_MI;
  var REGIONS = POOLS.REGIONS, RIVAL_TITLES = POOLS.RIVAL_TITLES;

  /* ---------- 星空古路分段 ----------
   * g.roadSegment：0 未登路 / 1~3 已在第 N 段 / 3 之后由「古路尽头」结算。
   * 进入第 N 段所需境界：第一段圣人（71），第二段大圣（81），第三段准帝（91）。
   * 古路的推进只能一段一段来，开局绝无可能走完。 */
  var SEG_LVL = [0, 71, 81, 91];
  var ROAD_SEGS = [];
  (function () {
    for (var i = 0; i < REGIONS.length; i++) {
      if (REGIONS[i].indexOf('星空古路') === 0) ROAD_SEGS.push(REGIONS[i]);
    }
  })();
  function segName(n) { return ROAD_SEGS[n - 1] || '星空古路深处'; }

  /* 境界允许走到第几段：圣人一段、大圣二段、准帝三段 */
  function segCap(g) {
    var n = 0;
    for (var i = 1; i < SEG_LVL.length; i++) if (g.lvl >= SEG_LVL[i]) n = i;
    return n;
  }
  /* 实际段位：登路之后，境界涨上去了，前面几段自然就趟过去了；
   * 「推进 / 争渡」事件的价值在于抢在境界之前多走一段（stored > segCap）。
   * 一生只有约 30 次事件，古路若要求逐段各命中一次专属事件便永远走不完，
   * 故以境界为主线、以事件为加速，既保证圣人级起步，也保证开局绝不可能走完。 */
  function seg(g) {
    var s = g.roadSegment || 0;
    if (s <= 0) return 0;
    var cap = segCap(g);
    if (cap > s) { s = Math.min(3, cap); g.roadSegment = s; }
    return s;
  }
  function onRoad(min) {
    return function (g) { return !g.becameEmperor && seg(g) >= (min || 1); };
  }
  /* 只有站在「境界允许的最远一段」上，才谈得上抢先再进一段 */
  function canPush(g) {
    var s = seg(g);
    return !g.becameEmperor && s >= 1 && s < 3 && s === segCap(g);
  }
  function setSeg(g, n) {
    if (n > seg(g)) g.roadSegment = Math.min(3, n);
    return g.roadSegment;
  }

  /* ---------- 概率：完全由玩家的实际状态算出 ----------
   * 战力对比（powerRef 是这次局面的「应有战力」）、道蕴、境界、体质、护道值。
   * choice 与 resolve 调用同一个函数、同一组参数，保证显示值即判定值。 */
  function odds(g, U, base, powerRef) {
    var ratio = U.clamp(U.currentCombatPower(g) / (powerRef || 100000), 0, 2);
    var dao = U.clamp((g.daoyun || 0) / U.data.DAO_ABSOLUTE_MAX, 0, 1);
    var ward = U.clamp((((g.tm && g.tm.ward) || 0)) / 100, 0, 0.15);
    var realm = U.clamp(((g.lvl || 1) - 60) / 40, 0, 1) * 0.10;
    var body = U.clamp((((g.innate || 1) - 5) * 0.010), -0.04, 0.05);
    return U.clamp(base + ratio * 0.30 + dao * 0.18 + ward + realm + body, 0.05, 0.93);
  }

  /* 选项面板上固定显示的状态行 */
  function statusInfo(g, U) {
    return '战力 ' + U.round(U.currentCombatPower(g)) +
      ' · 道蕴 ' + U.round(g.daoyun || 0) + '/' + U.round(g.daoyunCap || 0) +
      ' · ' + U.data.titleOf(g.lvl) +
      ' · 护道 ' + U.round((g.tm && g.tm.ward) || 0);
  }

  /* choice 里随机选定的地名/宝物要在 resolve 里复用，暂存一格即可（同时只会有一个待决选择） */
  function stash(g, id, val) {
    if (!g.rdStash) g.rdStash = {};
    g.rdStash[id] = val;
    return val;
  }
  function stashed(g, id) { return (g.rdStash && g.rdStash[id]) || null; }

  function txt(v, g, U, s) { return typeof v === 'function' ? v(g, U, s) : v; }

  /* 指名取用素材池里的秘地：池子若因原著核对改名，自动退回池内随机一处，不会留下杜撰地名 */
  function named(pool, want) {
    for (var i = 0; i < pool.length; i++) if (pool[i] === want) return pool[i];
    return PICK(pool);
  }

  /* ---------- 梭哈事件工厂 ----------
   * 统一产出「退避(safe) / 稳取 / 梭哈(deadly)」三档，杜绝概率错位与缺失 safe。 */
  function allinEvent(cfg) {
    function sdOdds(g, U) { return odds(g, U, cfg.steadyBase, cfg.powerRef); }
    /* 梭哈成功率走引擎的区间 [0.22, 0.90]：地板挡住「数学上必亏」的陷阱局面，
     * 上限放到 0.90 让战力真能买到安全感。 */
    function alOdds(g, U) { return U.allInFloor(odds(g, U, cfg.allinBase, cfg.powerRef), g, cfg.powerRef); }
    /* 致死比例同样随战力下降，这是「越强越敢赌」正反馈的另一半 */
    function alShare(g, U) { return U.deathShare(g, cfg.allinDeathShare, cfg.powerRef); }
    return {
      id: cfg.id, name: cfg.name, tier: cfg.tier, tag: cfg.tag || 'allin',
      desc: cfg.desc, weight: cfg.weight,
      maxCount: cfg.maxCount != null ? cfg.maxCount : 1,
      minAge: cfg.minAge != null ? cfg.minAge : 0,
      maxAge: cfg.maxAge != null ? cfg.maxAge : 100000,
      available: cfg.available,
      choice: function (g, U) {
        var s = cfg.setup ? cfg.setup(g, U) : {};
        stash(g, cfg.id, s);
        return {
          lead: txt(cfg.lead, g, U, s),
          info: statusInfo(g, U),
          note: txt(cfg.note, g, U, s),
          options: [
            { id: 'back', label: txt(cfg.backLabel, g, U, s), desc: txt(cfg.backDesc, g, U, s), safe: true },
            /* steadyAuto：古路推进这类「不推进就没有后续内容」的事件，让快速模式默认走中档（失败只是受伤，不会死）。
             * safe 选项依然唯一，玩家手动决策时不受影响。 */
            { id: 'steady', label: txt(cfg.steadyLabel, g, U, s), desc: txt(cfg.steadyDesc, g, U, s), chance: sdOdds(g, U), auto: cfg.steadyAuto ? true : undefined },
            {
              id: 'allin', label: txt(cfg.allinLabel, g, U, s), desc: txt(cfg.allinDesc, g, U, s),
              chance: alOdds(g, U), risk: 'deadly',
              deathChance: U.deathOdds(alOdds(g, U), alShare(g, U))
            }
          ]
        };
      },
      resolve: function (g, U, optionId, log) {
        var s = stashed(g, cfg.id) || (cfg.setup ? cfg.setup(g, U) : {});
        if (optionId === 'back') { cfg.back(g, U, s, log); return; }
        if (optionId === 'steady') {
          if (Math.random() < sdOdds(g, U)) cfg.steadyOk(g, U, s, log);
          else cfg.steadyFail(g, U, s, log);
          return;
        }
        /* 梭哈失败分两档：多数重伤生还，少数才真的陨落。
         * 成功时把 U 换成加成版，事件原有的奖励写法自动吃到凸收益倍率。 */
        var p = alOdds(g, U);
        var out = U.allIn(p, alShare(g, U));
        if (out === 'win') {
          var mult = U.payoff(p);
          /* 先让事件写自己的文案与小奖励，再统一灌入战力暴涨。
           * 战力是实测唯一能改变结局的货币，量级必须到 ×3~×24 才算数。 */
          cfg.allinOk(g, U.boost(mult), s, log);
          var surge = U.surgeOf(mult);
          U.powerSurge(g, surge, log);
          /* 再给一份直接作用于证道的收益：荒古圣体这类卡在帝关那一掷的体质，
           * 战力对它们是废货币，只给战力等于没给。 */
          var edge = U.zhengdaoEdge(g, mult);
          U.push(log, { cls: 'rainbow', text: U.surgeLine(surge, edge) });
          /* 赌赢了就停屏：这是玩家该被郑重告知的一刻，不能一闪而过 */
          U.highlight(g, log, { title: cfg.name, kind: 'allin', note: '梭哈成功 · 战力 ×' + surge.toFixed(1) });
        } else if (out === 'dead') cfg.allinFail(g, U, s, log);
        else (cfg.allinHurt || defaultAllinHurt)(g, U, s, log);
      }
    };
  }

  /* 梭哈失败但没死的兜底：重创而归，什么都没拿到。
   * 只扣寿元，绝不碰战力/道蕴/境界——这一档占 40%~60% 的概率权重，
   * 让它吃掉进度会把整个梭哈的期望拖到水下。依据见爽感经济设计文档 1.2.1。
   * 事件可以用 cfg.allinHurt 覆盖，写出更贴合情境的败退文案。 */
  function defaultAllinHurt(g, U, s, log) {
    var h = U.woundOnly(g, 200, 520);
    U.printlog(h.exempt || !h.loss ?
      '你在最后一瞬收了手，护道之力硬扛下反噬，两手空空退了出来' :
      '你终究没能拿住它。道基被生生震裂，一身气血几近熬干，什么也没带走，寿元 -' + h.loss);
  }

  /* 常用小工具 */
  function hurtLine(g, U, lo, hi, exemptText, hurtText) {
    var h = U.hurt(g, lo, hi);
    U.printlog(h.exempt || !h.loss ? exemptText : hurtText + '，寿元 -' + h.loss);
    return h;
  }
  function rival() { return PICK(RIVAL_TITLES); }

  var EVENTS = [

    /* ===================== tier 4 传说 ===================== */

    allinEvent({
      id: 'rd_dibing_seize', name: '极道帝兵出世', tier: 4, tag: 'allin',
      desc: '帝兵破土，举世老怪同至', weight: 0.42, maxCount: 2,
      minAge: 120, available: function (g) { return !g.becameEmperor && g.lvl >= 71; },
      powerRef: 620000, steadyBase: 0.34, allinBase: 0.04,
      setup: function () { return { bing: PICK(T4_BING) }; },
      lead: function (g, U, s) {
        return '混沌气自星空深处炸开，极道帝兵『' + s.bing + '』破土而出，一声轻鸣震碎半片星域。' +
          '数尊蛰伏万古的老怪与' + rival() + '同时破空而来，谁都不肯让';
      },
      note: '退走分文不取；只观道痕收获有限；正面夺兵成功便是至强底牌，失败当场被抹去。',
      backLabel: '退出百万里外', backDesc: '不争，只记下帝兵出世的方位，无风险',
      steadyLabel: '外围截取道痕', steadyDesc: '成功得帝兵逸散的一缕极道真意；失败被余波扫中重伤',
      allinLabel: '出手夺兵', allinDesc: '成功认主极道帝兵，实力暴涨并连升数层；失败身陨',
      back: function (g, U) {
        var c = U.cultPct(g, 0.008, 0.018, 600);
        U.printlog('你把气息压到最低，隔着百万里看那团混沌气翻滚。帝兵终究不属于此刻的你，但那一瞬的道韵已印在心底，实力+' + c);
      },
      steadyOk: function (g, U) {
        var c = U.cultPct(g, 0.09, 0.14, 9000);
        U.gainDao(g, U.irand(22, 34), 12);
        U.printlog('你不抢兵，只抢那一线逸散的极道真意，以己身经文强行承接。老怪们杀作一团，你带着满身道纹退走，实力+' + c);
      },
      steadyFail: function (g, U) {
        hurtLine(g, U, 160, 420, '帝兵威压扫来，你舍了到手的道痕，堪堪避开',
          '两尊老怪的余波正落在你身上，道基龟裂');
      },
      allinOk: function (g, U, s, log) {
        g.gotDiBing = true;
        var c = U.cultPct(g, 0.22, 0.30, 30000);
        U.gainDao(g, U.irand(46, 68), 28);
        U.printlog('你以命搏兵，硬顶三尊老怪的联手一击冲入混沌气中央，一掌按在兵胎之上！' +
          '『' + s.bing + '』竟嗡然认主，帝威反卷而出，将来犯者尽数轰退，实力+' + c);
        U.up(g, U.irand(2, 4), log);
      },
      allinFail: function (g, U, s) {
        U.kill(g, '你冲入混沌气中央的刹那，『' + s.bing + '』的帝威与老怪的杀招同时落下，肉身与神魂一并被碾成飞灰');
      }
    }),

    allinEvent({
      id: 'rd_busiyao_seize', name: '不死药争夺', tier: 4, tag: 'allin',
      desc: '药香一起，天下皆动', weight: 0.36, maxCount: 1,
      minAge: 100, available: function (g) { return !g.becameEmperor && g.lvl >= 71 && !g.deathless; },
      powerRef: 560000, steadyBase: 0.36, allinBase: 0.06,
      setup: function () { return { herb: PICK(T4_HERB), guard: rival() }; },
      lead: function (g, U, s) {
        return '一株『' + s.herb + '』在绝地中开花，药香飘出十万里，凡吸一口皆能延寿。' +
          '一位' + s.guard + '已守在药旁，方圆星域的强者正连夜赶来';
      },
      note: '不死药只能续一世，不可量产。抢到手便是多出一条命，抢不到便是把命留下。',
      backLabel: '远遁避祸', backDesc: '只嗅到一缕药香，略延寿元，无风险',
      steadyLabel: '趁乱摘半枝药叶', steadyDesc: '成功得药叶，寿元大增；失败被守药者击伤',
      allinLabel: '与守药者死战', allinDesc: '成功独得不死药（可续一世）；失败身陨',
      back: function (g, U) {
        var lf = U.gainLife(g, 20, 60);
        U.printlog('你顺风嗅了一口药香便掉头就走。身后星空很快亮起连天杀光' + (lf ? '，这一口药香让寿元+' + lf : '，你没有回头'));
      },
      steadyOk: function (g, U, s) {
        var lf = U.gainLife(g, 200, 400);
        var c = U.cultPct(g, 0.08, 0.13, 8000);
        U.printlog('群雄杀到时你贴地掠过，只摘走『' + s.herb + '』最外侧的两片药叶便遁入星海' +
          (lf ? '，药叶入腹，寿元+' + lf : '') + '，气血翻涌如江河，实力+' + c);
      },
      steadyFail: function (g, U, s) {
        hurtLine(g, U, 150, 400, '守药者一掌拍来，你弃叶而逃，只碎了几根肋骨',
          '你的手指刚触到药叶，' + s.guard + '的道术已洞穿你的肩胛');
      },
      allinOk: function (g, U, s, log) {
        g.deathless = true;
        var lf = U.gainLife(g, 500, 800);
        var c = U.cultPct(g, 0.18, 0.26, 22000);
        U.gainDao(g, U.irand(30, 52), 18);
        U.printlog('你与守药者从地底杀到星空，血流干了又生，终于一拳打爆对方的道基，将『' + s.herb +
          '』连根拔起！此药在手，寿元将尽时尚可再活一世' + (lf ? '，药力入体，寿元+' + lf : '') + '，实力+' + c);
        if (Math.random() < 0.5) U.up(g, 1, log);
      },
      allinFail: function (g, U, s) {
        U.kill(g, '你与' + s.guard + '两败俱伤时，后来者的帝兵光华已至。你倒在药前，成了这株『' + s.herb + '』的又一层肥料');
      }
    }),

    allinEvent({
      id: 'rd_forbidden_deep', name: '深入生命禁区', tier: 4, tag: 'allin',
      desc: '万古无人生还的地方', weight: 0.3, maxCount: 1,
      minAge: 150, available: function (g) { return !g.becameEmperor && g.lvl >= 81; },
      powerRef: 800000, steadyBase: 0.32, allinBase: 0.00,
      setup: function () { return { mi: named(T4_MI, '生命禁区外围') }; },
      lead: function (g, U, s) {
        return '你站在' + s.mi + '的血色雾墙前。雾里传出极缓的心跳，一声隔着百年，' +
          '每一次都让整片星域的修士同时心悸——那是活了不知多少万年的至尊在呼吸';
      },
      note: '禁区至尊沉睡而未死。走进去的人里，万古以来回来的不到一手之数；活着出来的都改写了自己的道。',
      backLabel: '转身离开', backDesc: '在雾墙外观禁区法则流转，小有所得，无风险',
      steadyLabel: '只在外围拾遗', steadyDesc: '成功得禁区逸散的皇道碎片；失败被血雾侵蚀重伤',
      allinLabel: '踏入雾墙深处', allinDesc: '成功掠夺至尊旧藏，实力与道蕴俱达巅峰；失败被至尊一念抹杀',
      back: function (g, U) {
        var c = U.cultPct(g, 0.01, 0.02, 900);
        U.printlog('你在雾墙外站了三年，只看不进。那心跳的节律本身就是一种道，看懂一分，实力+' + c);
      },
      steadyOk: function (g, U) {
        var c = U.cultPct(g, 0.09, 0.14, 12000);
        U.gainDao(g, U.irand(24, 38), 14);
        g.forbiddenKarma = (g.forbiddenKarma || 0) + 1;
        U.printlog('你只在雾墙边缘游走，捡走几片从禁区里漂出的皇道碎片。' +
          '以他人的极道反照己身，道蕴大涨，实力+' + c + '；那心跳，似乎慢了半拍');
      },
      steadyFail: function (g, U) {
        hurtLine(g, U, 200, 500, '血雾骤然内卷，你在被卷入前一步退出，只剩一身冷汗',
          '血雾腐蚀了你半边身躯，那心跳正对着你的方向');
      },
      allinOk: function (g, U, s, log) {
        var c = U.cultPct(g, 0.24, 0.30, 35000);
        U.gainDao(g, U.irand(52, 70), 32);
        g.forbiddenKarma = (g.forbiddenKarma || 0) + 2;
        U.printlog('你在血雾中走了整整九年，踏过白骨堆成的原野，从一座半塌的古殿里搬空了至尊少年时的旧藏。' +
          '走出雾墙那天你满头白发，可周身法则已换了一茬，实力+' + c);
        U.up(g, U.irand(3, 5), log);
        U.push(log, { cls: 'rare', text: '禁区深处的心跳自此记住了你的气息，这笔血债早晚要算' });
      },
      allinFail: function (g, U) {
        U.kill(g, '你走进血雾的第七步，那缓慢的心跳忽然快了一下。没有杀招，没有声音，你就这样不存在了');
      }
    }),

    allinEvent({
      id: 'rd_tomb_core', name: '帝坟核心', tier: 4, tag: 'allin',
      desc: '古帝陵寝的最深一层', weight: 0.34, maxCount: 1,
      minAge: 120, available: function (g) { return !g.becameEmperor && g.lvl >= 81; },
      powerRef: 500000, steadyBase: 0.33, allinBase: 0.03,
      setup: function () { return { bing: PICK(T3_BING) }; },
      lead: function () {
        return '帝坟一夜洞开，你越过九重陪葬坑，站在最后一道石门前。' +
          '门后是古帝真正的葬身处，门上的道纹还在自行流转，仿佛主人只是睡着';
      },
      note: '陪葬坑里的重器随手可取；石门之后的帝道本源无人取走过，因为死去的大帝也不是你能惊动的。',
      backLabel: '止步于门外', backDesc: '拓下门上道纹，小幅精进，无风险',
      steadyLabel: '取陪葬重器', steadyDesc: '成功得一件重器与大量道蕴；失败惊动杀阵重伤',
      allinLabel: '推开石门', allinDesc: '成功得古帝道则本源，实力暴涨并连升数层；失败身陨',
      back: function (g, U) {
        var c = U.cultPct(g, 0.01, 0.022, 1200);
        U.printlog('你把石门上的道纹一笔一笔拓在自己的血肉里，然后退了出去。有些门，推开的代价是命，实力+' + c);
      },
      steadyOk: function (g, U, s) {
        var c = U.cultPct(g, 0.10, 0.14, 12000);
        U.gainDao(g, U.irand(24, 36), 16);
        U.printlog('你只在陪葬坑里动手，掘出圣兵『' + s.bing + '』与半箱古帝生前手记。' +
          '石门始终没开，你也始终没敢多看它一眼，实力+' + c);
      },
      steadyFail: function (g, U) {
        hurtLine(g, U, 180, 450, '陪葬坑中的杀阵将启，你及时松手，空手退出',
          '你抱起重器的那一刻，九重陪葬坑同时亮起帝纹，你被轰出帝坟');
      },
      allinOk: function (g, U, s, log) {
        var c = U.cultPct(g, 0.23, 0.30, 32000);
        U.gainDao(g, U.irand(50, 70), 30);
        var up = U.apt(g, 1);
        U.printlog('石门在你掌下缓缓开启。棺中无尸，只有一团仍在搏动的帝道本源。' +
          '你与它对视了三天三夜，最终它认了你这个后来者，散作万千道纹钻入你眉心' +
          (up ? '，道基脱胎换骨' : '') + '，实力+' + c);
        U.up(g, U.irand(2, 4), log);
      },
      allinFail: function (g, U) {
        U.kill(g, '石门开启的瞬间，棺中那团本源只是「看」了你一眼。你连惨叫都没来得及，就在古帝的余威下化作齑粉');
      }
    }),

    allinEvent({
      id: 'rd_thunder_core', name: '混沌雷池中央', tier: 4, tag: 'allin',
      desc: '生灭同源的雷池最深处', weight: 0.32, maxCount: 1,
      minAge: 200, available: function (g) { return !g.becameEmperor && g.lvl >= 91; },
      powerRef: 560000, steadyBase: 0.34, allinBase: 0.04,
      setup: function () { return {}; },
      lead: function () {
        return '准帝劫余烬中浮出一座混沌雷池，池心那道紫金雷柱粗如星河。' +
          '雷液可洗炼帝躯，也能在一息间把准帝劈回原形——池边白骨累累，皆是与你同代的人物';
      },
      note: '雷池边缘的雷液已是无价；池心的混沌雷霆连准帝九重天也未必扛得住，但扛住了就是脱胎换骨。',
      backLabel: '只取池边残液', backDesc: '取一滴稀薄雷液温养肉身，无风险',
      steadyLabel: '入池至半腰', steadyDesc: '成功以雷液重铸帝躯；失败被雷霆劈裂道基重伤',
      allinLabel: '直入池心雷柱', allinDesc: '成功洗去一切驳杂，战力与道蕴齐至巅峰；失败身陨',
      back: function (g, U) {
        var lf = U.gainLife(g, 40, 120);
        var c = U.cultPct(g, 0.012, 0.025, 2000);
        U.printlog('你在池边蹲了半日，用玉瓶接了一滴最稀的雷液。够温养气血，不够改命' +
          (lf ? '，寿元+' + lf : '') + '，实力+' + c);
      },
      steadyOk: function (g, U) {
        var c = U.cultPct(g, 0.10, 0.14, 14000);
        U.gainDao(g, U.irand(26, 40), 16);
        U.printlog('你立在雷池半腰，任生灭雷液顺着骨缝灌入，血肉一寸寸炸开又一寸寸长回。' +
          '九日后你走出雷池，帝躯上多了一层雷纹，实力+' + c);
      },
      steadyFail: function (g, U) {
        hurtLine(g, U, 220, 560, '雷势陡然暴涨，你在被淹没前跃出池外',
          '一道雷霆顺着你的道基直劈心神，你被硬生生轰出雷池');
      },
      allinOk: function (g, U, s, log) {
        var lf = U.gainLife(g, 200, 450);
        var c = U.cultPct(g, 0.24, 0.30, 34000);
        U.gainDao(g, U.irand(50, 70), 26);
        U.printlog('你抱住池心那根紫金雷柱，任混沌雷霆把你反复劈成焦炭又反复重生。' +
          '第一百次重生时，你的道已经和雷池同源了' + (lf ? '，寿元+' + lf : '') + '，实力+' + c);
        U.up(g, U.irand(2, 3), log);
      },
      allinFail: function (g, U) {
        U.kill(g, '池心的混沌雷霆只落了一道。生与灭本是一体，你在这一道里，只分到了「灭」的那一半');
      }
    }),

    allinEvent({
      id: 'rd_mythic_deep', name: '神话战场深处', tier: 4, tag: 'allin',
      desc: '古天庭战场的核心废墟', weight: 0.3, maxCount: 1,
      minAge: 150, available: function (g) { return !g.becameEmperor && g.lvl >= 81; },
      powerRef: 520000, steadyBase: 0.33, allinBase: 0.03,
      setup: function () { return { mi: named(T4_MI, '黑暗动乱古战场'), secret: PICK(NINE_SECRETS) }; },
      lead: function (g, U, s) {
        return '你随一支联军闯进' + s.mi + '，越往深处，断兵越是完整。' +
          '战场核心悬着一座尚未熄灭的帝阵，阵中隐约有人影仍在挥刀，一挥便是一个纪元';
      },
      note: '外围残兵尚可拾取；核心帝阵里那道挥刀的烙印，是神话时代活人留下的最后一击。',
      backLabel: '在外围收殓残兵', backDesc: '捡几件断兵回炉，小幅精进，无风险',
      steadyLabel: '在阵外与烙印对招', steadyDesc: '成功以生死磨砺己道；失败被刀意贯体重伤',
      allinLabel: '踏入帝阵接那一刀', allinDesc: '成功悟得一式九秘级真意，实力暴涨；失败身陨',
      back: function (g, U) {
        var c = U.cultPct(g, 0.01, 0.02, 1000);
        U.printlog('你在战场外围收殓了十几件断兵，熔成一小块古金。这里每一寸土都埋着比你强的人，实力+' + c);
      },
      steadyOk: function (g, U) {
        var c = U.cultPct(g, 0.10, 0.14, 13000);
        U.gainDao(g, U.irand(24, 38), 14);
        g.mythicMarks = (g.mythicMarks || 0) + 1;
        U.printlog('你隔着阵纹与那道烙印对了九百余招，招招都在被杀死的边缘。走出战场时，你的法已经被逼出了新的形状，实力+' + c);
      },
      steadyFail: function (g, U) {
        hurtLine(g, U, 180, 480, '刀意压来，你舍了半件本命兵器换得脱身',
          '那一刀隔着帝阵斩出，你的肩胛连着道基一并被剖开');
      },
      allinOk: function (g, U, s, log) {
        var c = U.cultPct(g, 0.22, 0.30, 30000);
        U.gainDao(g, U.irand(48, 68), 28);
        g.mythicMarks = (g.mythicMarks || 0) + 2;
        U.printlog('你走进帝阵，不闪不避地迎上那一刀。刀锋停在眉心前一寸，烙印碎了，' +
          '而你在那一瞬间看懂了它——这是神话时代的『' + s.secret + '』真意，自此为你所有，实力+' + c);
        U.up(g, U.irand(2, 4), log);
      },
      allinFail: function (g, U) {
        U.kill(g, '你迎上那一刀。神话时代的人，果然不是后世可以比拟的——你连同你的道，被一刀两断');
      }
    }),

    allinEvent({
      id: 'rd_emperor_husk', name: '古皇遗蜕', tier: 4, tag: 'allin',
      desc: '一具盘坐万古的古皇躯壳', weight: 0.3, maxCount: 1,
      minAge: 150, available: function (g) { return !g.becameEmperor && g.lvl >= 81; },
      powerRef: 600000, steadyBase: 0.35, allinBase: 0.05,
      setup: function () { return {}; },
      lead: function () {
        return '一座荒星的山巅上盘坐着一具古皇遗蜕，皮肉尽干而道纹未散，' +
          '掌心向上，像是还在等什么人把最后一样东西放进去。周遭百里寸草不生';
      },
      note: '遗蜕虽死，帝威犹在。借它温养可得实打实的好处；要炼化它的本源，等于跟一位古皇借命。',
      backLabel: '叩首三拜后离去', backDesc: '受一缕古皇残念点化，小有所得，无风险',
      steadyLabel: '借遗蜕道纹温养己身', steadyDesc: '成功得古皇道纹加持；失败被残念冲击重伤',
      allinLabel: '炼化古皇本源', allinDesc: '成功得皇道根基，连升数层；失败神魂被吞、当场身陨',
      back: function (g, U) {
        var c = U.cultPct(g, 0.01, 0.022, 1100);
        U.printlog('你在遗蜕前叩了三个头才走。起身时膝下的石头裂了，那是古皇残念对晚辈的回礼，实力+' + c);
      },
      steadyOk: function (g, U) {
        var c = U.cultPct(g, 0.09, 0.14, 12000);
        U.gainDao(g, U.irand(22, 36), 14);
        var lf = U.gainLife(g, 120, 300);
        U.printlog('你在遗蜕身旁盘坐九年，让它的道纹一缕缕渗进自己的经文里' +
          (lf ? '，寿元+' + lf : '') + '，实力+' + c);
      },
      steadyFail: function (g, U) {
        hurtLine(g, U, 170, 440, '残念骤然睁眼，你立刻断开感应，退到山下',
          '古皇残念视你为窃贼，一缕皇威压得你七窍流血');
      },
      allinOk: function (g, U, s, log) {
        var c = U.cultPct(g, 0.22, 0.29, 30000);
        U.gainDao(g, U.irand(46, 66), 28);
        var up = U.apt(g, 1);
        U.printlog('你把自己的心血引入遗蜕掌心，以身为炉，与万古前的古皇争这一具躯壳的归属。' +
          '九十九日后，遗蜕化作飞灰，而你的骨血里多了一道皇道根基' + (up ? '，资质提升' : '') + '，实力+' + c);
        U.up(g, U.irand(2, 4), log);
      },
      allinFail: function (g, U) {
        U.kill(g, '遗蜕的掌心合拢了。它等的从来不是供奉，而是一个够分量的后辈来填补自己的残缺——你成了它的最后一块拼图');
      }
    }),

    allinEvent({
      id: 'rd_xianling_break', name: '仙陵洞开', tier: 4, tag: 'allin',
      desc: '葬着「仙」的陵墓', weight: 0.28, maxCount: 1,
      minAge: 300, available: function (g) { return !g.becameEmperor && g.lvl >= 91; },
      powerRef: 620000, steadyBase: 0.31, allinBase: 0.02,
      setup: function () { return { mi: named(T4_MI, '仙陵'), chuan: PICK(T4_CHUAN) }; },
      lead: function (g, U, s) {
        return '传说中的' + s.mi + '在星海尽头浮现，陵门之上垂落九条锁链，' +
          '每一条都缠着一具准帝级的枯骨。里面葬的不是大帝，据说是「仙」';
      },
      note: '连准帝的骨头都挂在门上。取陵外遗物尚可全身而退，开棺则是在向一个更高的层次伸手。',
      backLabel: '记下陵址便走', backDesc: '在陵外观九链道纹，小有所得，无风险',
      steadyLabel: '取陵外陪葬遗物', steadyDesc: '成功得一部大帝级经文；失败被锁链抽中重伤',
      allinLabel: '斩链开棺', allinDesc: '成功窥得仙道真意，战力与道蕴俱达极限；失败身陨',
      back: function (g, U) {
        var c = U.cultPct(g, 0.01, 0.02, 1200);
        U.printlog('你在陵外绕行一周，把九条锁链上的道纹记了个大概，转身离开。这地方现在还不属于你，实力+' + c);
      },
      steadyOk: function (g, U, s) {
        var c = U.cultPct(g, 0.09, 0.13, 12000);
        U.gainDao(g, U.irand(26, 40), 16);
        U.printlog('你只在陵门外的碎石堆里翻找，竟掘出一卷『' + s.chuan + '』的残篇。' +
          '陪葬的边角料，已抵得上一世苦修，实力+' + c);
      },
      steadyFail: function (g, U) {
        hurtLine(g, U, 200, 520, '一条锁链无风自动，你弃了遗物飞退千里',
          '锁链甩来，你的准帝之躯被抽出一道见骨长痕');
      },
      allinOk: function (g, U, s, log) {
        var lf = U.gainLife(g, 300, 700);
        var c = U.cultPct(g, 0.24, 0.30, 36000);
        U.gainDao(g, U.irand(52, 70), 32);
        U.printlog('你连斩九链，推开陵棺。棺中空无一物，只余一缕不属于此世的气息拂过你的面门——' +
          '就这一缕，让你明白了帝之上还有什么' + (lf ? '，寿元+' + lf : '') + '，实力+' + c);
        U.up(g, U.irand(2, 4), log);
      },
      allinFail: function (g, U) {
        U.kill(g, '第九条锁链被你斩断时，陵门内伸出一只白皙的手，把你像拂去灰尘一样拂灭了');
      }
    }),

    allinEvent({
      id: 'rd_samsara_sea', name: '轮回海', tier: 4, tag: 'allin',
      desc: '沉浮着前尘今世的黑色海洋', weight: 0.28, maxCount: 1,
      minAge: 300, available: function (g) { return !g.becameEmperor && g.lvl >= 91; },
      powerRef: 580000, steadyBase: 0.32, allinBase: 0.03,
      setup: function () { return { mi: named(T4_MI, '轮回海') }; },
      lead: function (g, U, s) {
        return '你立在' + s.mi + '之畔，海水漆黑无光，每一朵浪花里都浮着一张脸——' +
          '有你不认识的古人，也有一张，和你有七分像';
      },
      note: '海边听涛已能洗炼道心；渡海者据说能看见自己的前世与结局，但绝大多数人从此成了浪里的一张脸。',
      backLabel: '在岸边听涛', backDesc: '涛声洗心，道心澄澈，无风险',
      steadyLabel: '涉水至齐腰处', steadyDesc: '成功照见一段前尘，道蕴大涨；失败被拖入水中重伤',
      allinLabel: '沉入海底', allinDesc: '成功看清自己的来路与归途，道与力俱进；失败神魂散于轮回',
      back: function (g, U) {
        var c = U.cultPct(g, 0.01, 0.02, 1000);
        U.printlog('你在岸边坐了整整一年，看那些脸浮起又沉下，终究没有伸手去捞。道心反倒更稳了几分，实力+' + c);
      },
      steadyOk: function (g, U) {
        var c = U.cultPct(g, 0.08, 0.13, 11000);
        U.gainDao(g, U.irand(28, 40), 18);
        U.printlog('你只走到齐腰深处。海水映出一段不属于今生的记忆：某个很像你的人，也曾走到这里，然后回头了。' +
          '你懂了一些从前不懂的东西，实力+' + c);
      },
      steadyFail: function (g, U) {
        hurtLine(g, U, 190, 500, '水下有手拉你脚踝，你及时斩断水浪退回岸上',
          '万千前尘同时涌进识海，你被拖进水里又硬生生爬出来，神魂重创');
      },
      allinOk: function (g, U, s, log) {
        var c = U.cultPct(g, 0.20, 0.28, 28000);
        U.gainDao(g, U.irand(52, 70), 32);
        var lf = U.gainLife(g, 250, 500);
        U.printlog('你主动沉了下去。黑水灌满四肢百骸，无数世的自己在你面前依次死去，' +
          '最后一个转过头来，对你笑了一下。你浮出水面时，眼里已没有迷惘' + (lf ? '，寿元+' + lf : '') + '，实力+' + c);
        U.up(g, U.irand(1, 3), log);
      },
      allinFail: function (g, U) {
        U.kill(g, '你沉了下去，却再没分清哪一个才是自己。海面上多了一张脸，浮起，又沉下');
      }
    }),

    allinEvent({
      id: 'rd_huaxianchi', name: '化仙池', tier: 4, tag: 'allin',
      desc: '能化仙，也能化骨', weight: 0.26, maxCount: 1,
      minAge: 400, available: function (g) { return !g.becameEmperor && g.lvl >= 91; },
      powerRef: 700000, steadyBase: 0.30, allinBase: 0.02,
      setup: function () { return { mi: named(T4_MI, '化仙池') }; },
      lead: function (g, U, s) {
        return '仙路尽处的' + s.mi + '水色如乳，池底沉着一层白得刺眼的骨渣。' +
          '传说浸入此池者可褪去凡质，也传说，那层骨渣就是历代来此的准帝';
      },
      note: '取一瓢池水淬体已是天大的造化；整个人浸进去，成就与骨渣只在一线之间。',
      backLabel: '不下池', backDesc: '在池畔参悟水中道纹，小有所得，无风险',
      steadyLabel: '取池水淬体', steadyDesc: '成功洗去驳杂、帝躯精纯；失败被池水蚀骨重伤',
      allinLabel: '整个人浸入池中', allinDesc: '成功褪去凡质、境界连破数层；失败化作池底骨渣',
      back: function (g, U) {
        var c = U.cultPct(g, 0.012, 0.024, 1500);
        U.printlog('你在池畔看了很久，最终连手指都没伸进去。池水倒映出你的脸，也倒映出你的犹豫，实力+' + c);
      },
      steadyOk: function (g, U) {
        var c = U.cultPct(g, 0.10, 0.14, 14000);
        U.gainDao(g, U.irand(24, 38), 16);
        U.printlog('你只取了一瓢池水，兜头浇下。皮肉如遭万刀，褪下的死皮落地便化作白灰，' +
          '露出的新躯莹润生光，实力+' + c);
      },
      steadyFail: function (g, U) {
        hurtLine(g, U, 220, 560, '池水刚沾上皮肤便腾起白烟，你当机立断洗去',
          '一瓢池水蚀穿了你半条手臂，连骨头都在冒烟');
      },
      allinOk: function (g, U, s, log) {
        var c = U.cultPct(g, 0.25, 0.30, 40000);
        U.gainDao(g, U.irand(50, 70), 30);
        var lf = U.gainLife(g, 300, 700);
        U.printlog('你脱去衣袍，一步踏进池心。池水沸腾了整整七日，你的惨叫从第一日响到第四日，' +
          '第七日水面平静，走出来的人已经不是原来那个了' + (lf ? '，寿元+' + lf : '') + '，实力+' + c);
        U.up(g, U.irand(3, 6), log);
      },
      allinFail: function (g, U) {
        U.kill(g, '池水没到你下颌的时候，你想退，已经退不出来了。池底的骨渣又厚了薄薄一层');
      }
    }),

    allinEvent({
      id: 'rd_road_end_gate', name: '古路尽头的关卡', tier: 4, tag: 'starroad',
      /* 全包准入条件最苛刻的一个事件（已登路 + 第三段 + 准帝六重天以上），权重取 T4 上限 */
      desc: '星空古路的最后一关', weight: 1.0, maxCount: 1,
      minAge: 200,
      available: function (g) { return !g.becameEmperor && seg(g) >= 3 && g.lvl >= 96 && !g.roadCleared; },
      powerRef: 750000, steadyBase: 0.28, allinBase: 0.02,
      setup: function () { return { seg: segName(3) }; },
      lead: function (g, U, s) {
        return '你从' + s.seg + '一路杀到古路的尽头。前方不再有路，只有一座横亘星海的关门，' +
          '门前坐着一个看不清面目的守关者，脚下堆着历代闯关者的兵器，堆成了一座山';
      },
      note: '古路走到这里已是人族万古罕有；退回去不丢人，闯过去便是另一重天地，闯不过去就添一件兵器上那座山。',
      backLabel: '在关前止步', backDesc: '记下关门道纹，安然折返，无风险',
      steadyLabel: '与守关者论道三日', steadyDesc: '成功得守关者指点、道行大进；失败被一掌打落关前重伤',
      allinLabel: '强闯关门', allinDesc: '成功走通古路全程，战力道蕴皆登绝顶、境界连破；失败身陨于关前',
      back: function (g, U) {
        var c = U.cultPct(g, 0.012, 0.025, 2000);
        U.printlog('你在关门前站了三天，把门上的道纹从头看到尾，然后抱拳、转身。守关者始终没有抬头，实力+' + c);
      },
      steadyOk: function (g, U) {
        var c = U.cultPct(g, 0.10, 0.14, 15000);
        U.gainDao(g, U.irand(28, 42), 18);
        U.printlog('守关者终于开口，与你论道三日。他不说自己是谁，只把历代闯关者的破绽一条条说给你听。' +
          '第三日他挥手让你走，实力+' + c);
      },
      steadyFail: function (g, U) {
        hurtLine(g, U, 220, 560, '你自知言语间落了下风，主动退开三步，守关者收了手',
          '一句话没说对，守关者随手一掌把你拍落关前');
      },
      allinOk: function (g, U, s, log) {
        g.roadCleared = true;
        var lf = U.gainLife(g, 350, 800);
        var c = U.cultPct(g, 0.25, 0.30, 45000);
        U.gainDao(g, U.irand(55, 70), 32);
        U.printlog('你没有多话，一拳轰在关门上。守关者站了起来，你们从星海这头打到那头，打碎了九座荒星。' +
          '最后关门开了一线，守关者退回阴影里说了一句：这一世，你可以过去了' + (lf ? '，寿元+' + lf : '') + '，实力+' + c);
        U.up(g, U.irand(3, 6), log);
        U.push(log, { cls: 'rainbow', text: '星空古路自此对你再无阻隔——人族万古以来，走到这一步的没有几个' });
      },
      allinFail: function (g, U) {
        U.kill(g, '守关者只是站了起来。你的兵器落在那座山的最上面，还在轻轻颤动，而你已经没有了');
      }
    }),

    allinEvent({
      id: 'rd_road_legacy', name: '古路上的传承', tier: 4, tag: 'starroad',
      desc: '前人把道留在了路上', weight: 0.32, maxCount: 1,
      minAge: 100,
      available: function (g) { return !g.becameEmperor && seg(g) >= 1 && g.lvl >= 71; },
      powerRef: 640000, steadyBase: 0.34, allinBase: 0.05,
      setup: function (g) { return { chuan: PICK(T4_CHUAN), seg: segName(seg(g)) }; },
      lead: function (g, U, s) {
        return '在' + segName(seg(g)) + '的一块界碑背后，你摸到了一道活着的烙印。' +
          '那是某位古之大帝路过此地时随手留下的『' + s.chuan + '』，万古以来无人接得住';
      },
      note: '浅尝辄止便能受益一世；要把整道传承接进识海，等于让一位大帝在你脑子里重走一遍他的路。',
      backLabel: '记下界碑位置', backDesc: '只拓下烙印外围的道纹，无风险',
      steadyLabel: '接引一角传承', steadyDesc: '成功得传承残篇，道行大进；失败被烙印反噬重伤',
      allinLabel: '全盘承接', allinDesc: '成功尽得大帝传承，道蕴与战力暴涨、连升数层；失败识海崩毁身陨',
      back: function (g, U) {
        var c = U.cultPct(g, 0.01, 0.02, 900);
        U.printlog('你只把烙印外围的纹路拓了下来便收手。古路上的东西，看得越深越容易把自己搭进去，实力+' + c);
      },
      steadyOk: function (g, U, s) {
        var c = U.cultPct(g, 0.09, 0.13, 11000);
        U.gainDao(g, U.irand(24, 38), 14);
        U.printlog('你只接引了『' + s.chuan + '』的一角，便觉经文自行翻页、旧伤自行愈合。' +
          '大帝随手留下的边角，已经够你消化一世，实力+' + c);
      },
      steadyFail: function (g, U) {
        hurtLine(g, U, 160, 420, '烙印刚一接触便烫得吓人，你立刻断开神念',
          '传承烙印顺着神念倒灌，你当场昏死在界碑下');
      },
      allinOk: function (g, U, s, log) {
        var c = U.cultPct(g, 0.22, 0.29, 28000);
        U.gainDao(g, U.irand(48, 68), 30);
        U.printlog('你盘坐界碑之下，把整道『' + s.chuan + '』尽数引入识海。' +
          '那位大帝的一生在你脑中重演了一遍：他的挣扎、他的杀伐、他最后的回望。' +
          '醒来时你满脸是泪，道却已经不同了，实力+' + c);
        if (s.chuan === '狠人大帝传承' || s.chuan === '吞天魔功') {
          g.gotRuthless = true;
          g.swallowingArt = true;
          U.push(log, { cls: 'rare', text: '传承深处藏着吞天魔功真意：熔炼万法者，纵是凡体也能走出一条路，但从此举世皆敌' });
        }
        U.up(g, U.irand(2, 4), log);
      },
      allinFail: function (g, U, s) {
        U.kill(g, '『' + s.chuan + '』倾泻而下的第一瞬，你就知道自己错了。识海像被灌满岩浆的陶罐，砰然炸裂');
      }
    }),

    /* ===================== tier 3 稀有 ===================== */

    allinEvent({
      id: 'rd_road_depart', name: '踏上星空古路', tier: 3, tag: 'starroad',
      desc: '人族横渡星域的那条老路', weight: 1.6, maxCount: 3,
      minAge: 60,
      available: function (g) { return !g.becameEmperor && g.lvl >= SEG_LVL[1] && seg(g) === 0; },
      powerRef: 200000, steadyBase: 0.40, allinBase: 0.10, steadyAuto: true,
      setup: function () { return { seg: segName(1) }; },
      lead: function (g, U, s) {
        return '古路的入口是一座万丈石门，门上「星空古路」四个字被无数代人摸得发亮。' +
          '同代人杰陆续登路，' + s.seg + '的那头，是整个北斗都望不见的远方';
      },
      note: '古路只能一段一段走：第一段须圣人，第二段须大圣，第三段须准帝。登路之后才谈得上走到尽头。',
      backLabel: '暂不登路', backDesc: '留在本星域继续沉淀，无风险',
      steadyLabel: '随人族队伍登路', steadyDesc: '成功踏上第一段古路；失败被门前杀阵震退受伤',
      allinLabel: '独身抢渡', allinDesc: '成功抢先登路（境界够便可直入第二段）并大有斩获；失败葬身星海',
      back: function (g, U) {
        var c = U.cultPct(g, 0.01, 0.025, 800);
        U.printlog('你在石门前站了很久，终究先回去了。路一直在那里，不急在这一时，实力+' + c);
      },
      steadyOk: function (g, U, s, log) {
        setSeg(g, 1);
        var c = U.cultPct(g, 0.05, 0.09, 3000);
        U.gainDao(g, U.irand(12, 22));
        U.printlog('你随一支人族队伍踏过石门，正式登上' + s.seg + '。星海无风，脚下却是万古以来无数人的骨头，实力+' + c);
        U.up(g, 1, log);
      },
      steadyFail: function (g, U) {
        hurtLine(g, U, 80, 240, '门前古阵扫来，你退了半步，这次没能登路',
          '你低估了石门上的护道杀阵，被轰得倒飞回来');
      },
      allinOk: function (g, U, s, log) {
        setSeg(g, Math.max(1, segCap(g)) + 1);
        var c = U.cultPct(g, 0.11, 0.14, 8000);
        U.gainDao(g, U.irand(26, 38));
        U.printlog('你不等队伍，独自破开石门外围的乱流抢先登路，一路斩落三名拦截的' + rival() +
          '。等后来者赶到时，你已在' + segName(seg(g)) + '上站稳了脚跟，实力+' + c);
        U.up(g, U.irand(1, 2), log);
      },
      allinFail: function (g, U) {
        U.kill(g, '石门外的星空乱流不是给独行者准备的。你的道基在乱流里被撕成两半，连尸骨都没能落回北斗');
      }
    }),

    allinEvent({
      id: 'rd_road_push', name: '古路分段推进', tier: 3, tag: 'starroad',
      desc: '再往前一段，风景与杀机一起翻倍', weight: 1.6, maxCount: 4,
      minAge: 60, available: canPush,
      powerRef: 300000, steadyBase: 0.36, allinBase: 0.08, steadyAuto: true,
      setup: function (g) { return { cur: segName(seg(g)), next: segName(seg(g) + 1) }; },
      lead: function (g, U, s) {
        return '你已在' + s.cur + '上立足，前方通往' + s.next + '的星桥断了一半，' +
          '桥下是能绞碎准帝的空间乱流。同行的人杰有的原地结庐，有的头也不回地冲了过去';
      },
      note: '推进一段，日后能碰到的机缘与对手都会整体上一个台阶。每一段都有对应的境界门槛，不到境界连桥都上不去。',
      backLabel: '留在本段', backDesc: '原地结庐积累，稳妥无风险',
      steadyLabel: '稳步渡桥', steadyDesc: function (g, U, s) { return '成功推进至' + s.next + '；失败被乱流卷伤，退回原段'; },
      allinLabel: '强渡杀关', allinDesc: function (g, U, s) { return '成功推进至' + s.next + '并夺下关口机缘、连升数层；失败被乱流绞杀'; },
      back: function (g, U) {
        var c = U.cultPct(g, 0.012, 0.03, 1200);
        U.printlog('你在断桥这头结了间石庐，看着别人一个个冲过去，也看着乱流一次次把人绞成血雾。稳一点没坏处，实力+' + c);
      },
      steadyOk: function (g, U, s, log) {
        setSeg(g, seg(g) + 1);
        var c = U.cultPct(g, 0.06, 0.10, 4000);
        U.gainDao(g, U.irand(14, 26));
        U.printlog('你算准了乱流的九个间隙，一步一停地渡过断桥，正式踏上' + s.next + '，实力+' + c);
        U.up(g, 1, log);
      },
      steadyFail: function (g, U) {
        hurtLine(g, U, 100, 280, '乱流忽然改向，你及时折返，桥没渡成',
          '一道乱流擦过你的左半身，你连滚带爬退回原段');
      },
      allinOk: function (g, U, s, log) {
        setSeg(g, seg(g) + 1);
        var c = U.cultPct(g, 0.11, 0.14, 9000);
        U.gainDao(g, U.irand(28, 40));
        var lf = U.gainLife(g, 80, 250);
        U.printlog('你不走桥，直接跃进乱流，硬顶着空间刀锋横渡星海，' +
          '落地时衣袍尽碎，却抢在所有人之前占了' + segName(seg(g)) + '关口的那处道场' +
          (lf ? '，寿元+' + lf : '') + '，实力+' + c);
        U.up(g, U.irand(1, 3), log);
      },
      allinFail: function (g, U) {
        U.kill(g, '空间乱流里没有侥幸。你在半途被绞成万千碎片，连一声喊都没能传回桥这头');
      }
    }),

    {
      id: 'rd_road_contest', name: '争渡诸天人杰', tier: 3, tag: 'starroad',
      desc: '古路之上，同代皆敌', weight: 1.5, maxCount: 6,
      minAge: 70, maxAge: 100000,
      available: onRoad(1),
      cond: function (g, U) {
        return Math.random() < U.clamp(0.34 + U.currentCombatPower(g) / 700000 + (U.isHighDaoyun(g) ? 0.10 : 0), 0.15, 0.85);
      },
      ok: function (g, U, log) {
        var c = U.cultPct(g, 0.07, 0.13, 5000);
        U.gainDao(g, U.irand(14, 28));
        U.printlog('古路上没有讲道理的地方。你与' + rival() + '在' + segName(seg(g)) +
          '连战十七场，把对方的圣术一一破尽，气运随败者一并归你，实力+' + c);
        if (g.swallowingArt && Math.random() < 0.5) U.trySwallowPhysique(g, log);
        if (Math.random() < 0.45) U.up(g, 1, log);
        /* 争渡本就是往前抢路：赢下来便可能抢在境界之前多走一段 */
        if (seg(g) === segCap(g) && seg(g) < 3 && Math.random() < 0.35) {
          setSeg(g, seg(g) + 1);
          U.push(log, { cls: 'rare', text: '一路争渡向前，你抢在同代之先踏入了' + segName(seg(g)) });
        }
      },
      fail: function (g, U) {
        hurtLine(g, U, 90, 260, '你自知不敌，在对方出全力前认了负，对方也没有赶尽杀绝',
          '一位' + rival() + '的秘术贯穿了你的护体神光');
      }
    },

    allinEvent({
      id: 'rd_road_slaughter', name: '古路杀劫', tier: 3, tag: 'starroad',
      desc: '十几位天骄凑钱要你的命', weight: 0.95, maxCount: 2,
      minAge: 80, available: onRoad(1),
      powerRef: 320000, steadyBase: 0.34, allinBase: 0.07,
      setup: function () { return { who: rival(), who2: rival() }; },
      lead: function (g, U, s) {
        return '你在' + segName(seg(g)) + '走得太顺，顺到碍了别人的眼。' +
          '一位' + s.who + '牵头，纠集了十几位同代强者布下杀阵，连退路上的星桥都被人拆了';
      },
      note: '躲进驿站就没事，但从此古路上人人都知道你可以被逼退；反杀开局代价极大，收获也极大。',
      backLabel: '退入古路驿站', backDesc: '驿站有古老禁制庇护，安然避过，无风险',
      steadyLabel: '且战且退', steadyDesc: '成功杀穿一角包围圈全身而退；失败被围殴重伤',
      allinLabel: '反手开杀', allinDesc: '成功斩尽围杀者、尽夺其资粮与气运、连升数层；失败被乱刀分尸',
      back: function (g, U) {
        U.printlog('你转身退进驿站，那道古老禁制在你身后合拢。围杀者在外面骂了三天三夜，最后骂累了各自散去');
        U.cultPct(g, 0.008, 0.018, 600);
      },
      steadyOk: function (g, U, s) {
        var c = U.cultPct(g, 0.06, 0.10, 4000);
        U.gainDao(g, U.irand(12, 24));
        U.printlog('你专挑' + s.who2 + '那一角下手，一击破阵，从缺口杀了出去。身后阵法崩了一半，实力+' + c);
      },
      steadyFail: function (g, U) {
        hurtLine(g, U, 110, 300, '杀阵合拢前你祭出保命之物，勉强脱身',
          '十几道圣术同时落下，你在血泊里撑到阵法松动才逃出去');
      },
      allinOk: function (g, U, s, log) {
        var c = U.cultPct(g, 0.11, 0.14, 8000);
        U.gainDao(g, U.irand(26, 38));
        U.printlog('你没有退，反而一步踏进阵眼。那一战打了七日，' + s.who +
          '的头颅最后挂在断桥上示众。古路上此后一提你的名字，无人再敢结阵，实力+' + c);
        if (g.swallowingArt) U.trySwallowPhysique(g, log);
        U.up(g, U.irand(1, 3), log);
      },
      allinFail: function (g, U, s) {
        U.kill(g, '你踏进阵眼的那一刻，' + s.who + '笑了——他们等的就是这个。十几道圣术同时落下，古路上又多了一具无名尸骨');
      }
    }),

    {
      id: 'rd_road_guardian', name: '古路护道人', tier: 3, tag: 'starroad',
      desc: '有人在这条路上等了很多代', weight: 0.8, maxCount: 2,
      minAge: 70, maxAge: 100000,
      available: onRoad(1),
      cond: function (g, U) { return U.isHighDaoyun(g) || Math.random() < 0.55; },
      ok: function (g, U) {
        var c = U.cultPct(g, 0.05, 0.10, 3500);
        U.gainDao(g, U.irand(16, 30));
        var lf = U.gainLife(g, 60, 200);
        U.printlog('驿站深处坐着一位人族护道人，不知守了多少代。他把历代闯关者留下的血书摊给你看，' +
          '一条条指出他们死在哪里' + (lf ? '，临别赠你一枚养元丹，寿元+' + lf : '') + '，实力+' + c);
      },
      fail: function (g, U) {
        var c = U.cultPct(g, 0.01, 0.025, 700);
        U.printlog('护道人只看了你一眼便闭目不语。你在他门外站了一夜，天亮时自己想通了几分，实力+' + c);
      }
    },

    allinEvent({
      id: 'rd_road_alien', name: '异族强者拦路', tier: 3, tag: 'starroad',
      desc: '古路上，人族不是唯一的行者', weight: 0.9, maxCount: 2,
      minAge: 100, available: onRoad(2),
      powerRef: 340000, steadyBase: 0.33, allinBase: 0.06,
      setup: function () { return { who: '星空异族强者' }; },
      lead: function (g, U, s) {
        return '一名身高三丈、周身覆盖金色鳞甲的' + s.who + '横在' + segName(seg(g)) + '的必经之地，' +
          '脚下踩着七具人族修士的尸体，看你的眼神像在看一味补药';
      },
      note: '绕道要多耗几十年，但安全；正面斩杀异族强者可夺其本源血气，那是同代人求都求不来的东西。',
      backLabel: '绕道而行', backDesc: '多走几十年冤枉路，安然避开，无风险',
      steadyLabel: '以势压人', steadyDesc: '成功逼退异族、夺其一件重宝；失败被鳞甲撞伤',
      allinLabel: '死战到底', allinDesc: '成功斩杀异族、炼化其本源血气，战力大涨并连升数层；失败被生吞',
      back: function (g, U) {
        var c = U.cultPct(g, 0.01, 0.022, 800);
        U.printlog('你绕开了那条路，多走了几十年星海。路上你一直在想：如果那天动手，会怎么样？实力+' + c);
      },
      steadyOk: function (g, U, s) {
        var c = U.cultPct(g, 0.06, 0.10, 4200);
        U.gainDao(g, U.irand(14, 26));
        U.printlog('你放出全部气机，一步步压上去。那' + s.who +
          '在你走到第九步时退了，扔下一件重宝算作过路钱，实力+' + c);
      },
      steadyFail: function (g, U) {
        hurtLine(g, U, 100, 290, '对方气势更盛，你不再硬顶，从侧翼退开',
          '那身金色鳞甲直接撞了过来，你的护体神光碎了一地');
      },
      allinOk: function (g, U, s, log) {
        var c = U.cultPct(g, 0.11, 0.14, 8500);
        U.gainDao(g, U.irand(26, 38));
        var lf = U.gainLife(g, 100, 280);
        U.printlog('你没说话，直接出手。那一战从星桥打到荒星，鳞甲被你一片片剥下来。' +
          '最后你握着它的心脏，把那团滚烫的本源血气生生炼化' + (lf ? '，寿元+' + lf : '') + '，实力+' + c);
        if (g.swallowingArt) U.trySwallowPhysique(g, log);
        U.up(g, U.irand(1, 3), log);
      },
      allinFail: function (g, U, s) {
        U.kill(g, '你低估了异族的肉身。那' + s.who + '一口咬下，连同你的道基一起嚼碎，然后继续坐回原地等下一个');
      }
    }),

    allinEvent({
      id: 'rd_mi_mid_delve', name: '中阶秘境·层层深入', tier: 3, tag: 'dungeon',
      desc: '外围、中层、核心，每一层都要重新赌一次', weight: 1.05, maxCount: 3,
      minAge: 40, available: function (g) { return !g.becameEmperor && g.lvl >= 51; },
      powerRef: 180000, steadyBase: 0.38, allinBase: 0.12,
      setup: function () { return { mi: PICK(T3_MI), herb: PICK(T3_HERB) }; },
      lead: function (g, U, s) {
        return '『' + s.mi + '』的禁制今日松动。外围已有散修在捡漏，中层守着几头古兽，' +
          '而核心处那口终年不散的黑雾里，据说沉着开辟此地者的遗产';
      },
      note: '越往里走，东西越好，出来的人越少。核心是这座秘境真正的赌桌。',
      backLabel: '只搜外围', backDesc: '在外围采些灵材便走，收获不多但绝对安全',
      steadyLabel: '深入中层', steadyDesc: '成功斩古兽、得圣药级天材；失败被古兽重创',
      allinLabel: '直闯核心黑雾', allinDesc: '成功尽得开辟者遗产，实力与道蕴暴涨、连升数层；失败死在雾中',
      back: function (g, U, s) {
        var c = U.cultPct(g, 0.02, 0.04, 900);
        var lf = U.gainLife(g, 20, 70);
        U.printlog('你只在『' + s.mi + '』外围转了一圈，采了些年份尚可的灵草就退了出来' +
          (lf ? '，寿元+' + lf : '') + '，实力+' + c);
      },
      steadyOk: function (g, U, s) {
        var c = U.cultPct(g, 0.07, 0.11, 4500);
        U.gainDao(g, U.irand(12, 24));
        var lf = U.gainLife(g, 60, 180);
        U.printlog('你在中层斩了两头守洞古兽，从兽巢里刨出一块『' + s.herb + '』' +
          (lf ? '，炼化后寿元+' + lf : '') + '，实力+' + c);
      },
      steadyFail: function (g, U) {
        hurtLine(g, U, 90, 250, '古兽太过棘手，你丢下背囊全身而退',
          '你被古兽一尾扫在洞壁上，肋骨断了大半');
      },
      allinOk: function (g, U, s, log) {
        var c = U.cultPct(g, 0.11, 0.14, 7000);
        U.gainDao(g, U.irand(26, 40));
        var lf = U.gainLife(g, 120, 300);
        U.printlog('你闭气冲进核心黑雾，在里面摸索了整整四十天。雾散时，你抱着开辟『' + s.mi +
          '』那人留下的整座洞府走了出来' + (lf ? '，寿元+' + lf : '') + '，实力+' + c);
        U.up(g, U.irand(1, 3), log);
      },
      allinFail: function (g, U, s) {
        U.kill(g, '黑雾里没有古兽，也没有机关，只有一种会让人忘记来路的东西。你在『' + s.mi + '』核心里走了很久很久，再没走出来');
      }
    }),

    allinEvent({
      id: 'rd_taichu_mine', name: '太初古矿深处', tier: 3, tag: 'dungeon',
      desc: '万古以来埋人最多的一座矿', weight: 0.8, maxCount: 2,
      minAge: 60, available: function (g) { return !g.becameEmperor && g.lvl >= 61; },
      powerRef: 260000, steadyBase: 0.35, allinBase: 0.09,
      setup: function () { return { mi: named(T4_MI, '太初古矿'), herb: PICK(T3_HERB) }; },
      lead: function (g, U, s) {
        return '『' + s.mi + '』的矿洞一层深过一层。上三层的矿工点着灯在赌石，' +
          '下九层没人敢去——那里的石头里，偶尔会传出叩击声，从里往外敲';
      },
      note: '上层赌石只赌运气；下九层赌的是命，可那里出过能让人一步登天的源。',
      backLabel: '在上层赌石', backDesc: '花些资源赌几块源石，小有所得，无风险',
      steadyLabel: '下到中层掘源', steadyDesc: '成功掘出神源级矿料；失败被塌方与矿煞所伤',
      allinLabel: '独入下九层', allinDesc: '成功取出会叩击的那块源，道蕴与战力暴涨；失败被封进石中',
      back: function (g, U) {
        var c = U.cultPct(g, 0.02, 0.038, 800);
        U.printlog('你在上层跟矿工们赌了几块石头，开出些寻常灵玉。有人一夜暴富，更多人赔光了家当，实力+' + c);
      },
      steadyOk: function (g, U, s) {
        var c = U.cultPct(g, 0.07, 0.11, 4500);
        U.gainDao(g, U.irand(12, 22));
        U.printlog('你下到中层，凿开一条废弃的矿脉，掘出整整一车『' + s.herb + '』。' +
          '矿工们说，这一车够换一座小圣地了，实力+' + c);
      },
      steadyFail: function (g, U) {
        hurtLine(g, U, 90, 260, '矿道开始塌陷，你扔下矿料撑起护罩冲了出来',
          '矿煞顺着凿开的缝隙涌出，你在塌方里埋了三天才爬出来');
      },
      allinOk: function (g, U, s, log) {
        var c = U.cultPct(g, 0.11, 0.14, 7500);
        U.gainDao(g, U.irand(28, 40));
        U.printlog('你一个人打着灯下到第九层。那块会叩击的石头就在矿壁正中，' +
          '你凿了九天，石开的瞬间里面什么都没有，只有一段极古老的道则，顺着你的手臂爬进骨头里，实力+' + c);
        U.up(g, U.irand(1, 2), log);
      },
      allinFail: function (g, U) {
        U.kill(g, '你凿开石头的一刹那，叩击声停了。矿工们后来在第九层发现一块新的石头，里面隐约有个人形，还保持着举锤的姿势');
      }
    }),

    allinEvent({
      id: 'rd_bronze_hall', name: '青铜仙殿', tier: 3, tag: 'dungeon',
      desc: '从星海深处漂来的青铜巨殿', weight: 0.75, maxCount: 1,
      minAge: 90, available: function (g) { return !g.becameEmperor && g.lvl >= 71; },
      powerRef: 300000, steadyBase: 0.34, allinBase: 0.08,
      setup: function () { return { mi: named(T4_MI, '青铜仙殿'), gong: PICK(T3_GONG) }; },
      lead: function (g, U, s) {
        return '一座『' + s.mi + '』无声漂过星域，殿门半开，里面没有光。' +
          '已经有三批人进去了，一批都没出来，殿门却始终为下一个人留着那道缝';
      },
      note: '殿前廊柱上的古字就足够参悟多年；真正的东西在殿心，而殿心至今没人回来描述过。',
      backLabel: '只在殿外拓字', backDesc: '拓下廊柱古字慢慢参悟，无风险',
      steadyLabel: '进前殿一探', steadyDesc: '成功得一部圣级功法；失败被殿中禁制反噬重伤',
      allinLabel: '走到殿心', allinDesc: '成功得仙殿主人留下的道统，道蕴战力齐涨、连升数层；失败再无音讯',
      back: function (g, U) {
        var c = U.cultPct(g, 0.015, 0.03, 900);
        U.printlog('你把廊柱上的古字一个个拓下来，带回去参悟了十年。光是这些字的笔意，就够你受用许久，实力+' + c);
      },
      steadyOk: function (g, U, s) {
        var c = U.cultPct(g, 0.07, 0.11, 5000);
        U.gainDao(g, U.irand(14, 26));
        U.printlog('你只在前殿走动，从一具跪坐的古尸怀里取出『' + s.gong + '』。' +
          '退出来时你回头看了一眼，殿心的黑暗好像近了一点，实力+' + c);
      },
      steadyFail: function (g, U) {
        hurtLine(g, U, 100, 280, '前殿禁制忽然亮起，你撞破侧窗滚了出来',
          '一道青铜光华从殿心射来，穿透了你的胸口');
      },
      allinOk: function (g, U, s, log) {
        var c = U.cultPct(g, 0.11, 0.14, 8000);
        U.gainDao(g, U.irand(28, 40));
        var lf = U.gainLife(g, 100, 260);
        U.printlog('你一路走到殿心。那里只有一张空着的青铜座椅，椅上落满星尘。' +
          '你坐了上去——不知过了多久，整座仙殿的道纹开始围着你运转' + (lf ? '，寿元+' + lf : '') + '，实力+' + c);
        U.up(g, U.irand(1, 3), log);
      },
      allinFail: function (g, U) {
        U.kill(g, '殿心那张椅子不是空的，只是你看不见上面坐着谁。你坐下去的瞬间，就再也没能站起来');
      }
    }),

    allinEvent({
      id: 'rd_zangtian_isle', name: '葬天岛', tier: 3, tag: 'dungeon',
      desc: '海上孤岛，埋的都是不该埋的东西', weight: 0.72, maxCount: 1,
      minAge: 90, available: function (g) { return !g.becameEmperor && g.lvl >= 71; },
      powerRef: 310000, steadyBase: 0.33, allinBase: 0.07,
      setup: function () { return { mi: named(T4_MI, '葬天岛'), bing: PICK(T3_BING) }; },
      lead: function (g, U, s) {
        return '『' + s.mi + '』浮在血色海面上，岛上没有活物，只有密密麻麻插满全岛的断兵。' +
          '每一柄断兵下都埋着一个人，岛心那柄最大的，插了整整半座山';
      },
      note: '岛上随便拔一柄断兵都是横财；岛心那一柄谁都想拔，但插它的人，比埋在这里的所有人都强。',
      backLabel: '在滩涂拾遗', backDesc: '捡些被海浪冲上岸的碎兵，无风险',
      steadyLabel: '拔岛上的断兵', steadyDesc: '成功得一件圣兵残躯；失败被兵冢怨煞缠身重伤',
      allinLabel: '拔岛心那一柄', allinDesc: '成功承接葬天者的杀道，战力道蕴齐涨、连升数层；失败被钉在原地',
      back: function (g, U) {
        var c = U.cultPct(g, 0.015, 0.032, 900);
        U.printlog('你只在滩涂上捡了几截被海浪磨平的碎兵。就这几截，回去也能炼一件不错的本命兵，实力+' + c);
      },
      steadyOk: function (g, U, s) {
        var c = U.cultPct(g, 0.07, 0.11, 4800);
        U.gainDao(g, U.irand(14, 24));
        U.printlog('你挑了一柄气机尚存的断兵，用了三天三夜才拔出来——竟是圣兵『' + s.bing +
          '』的残躯，兵身上还缠着前主人的杀意，实力+' + c);
      },
      steadyFail: function (g, U) {
        hurtLine(g, U, 100, 280, '兵冢怨煞冲天而起，你及时松手退回海上',
          '断兵刚离土，冢中怨煞便顺着手臂灌入，你半边身子当场僵死');
      },
      allinOk: function (g, U, s, log) {
        var c = U.cultPct(g, 0.11, 0.14, 8000);
        U.gainDao(g, U.irand(26, 40));
        U.printlog('你双手握住岛心那柄巨兵，与半座山较劲了九日。兵起山崩，岛下露出的不是尸骨，' +
          '而是一道仍在缓缓运转的杀道法则。它认了你这个拔兵的人，实力+' + c);
        U.up(g, U.irand(1, 3), log);
      },
      allinFail: function (g, U) {
        U.kill(g, '巨兵纹丝未动，反倒顺势下沉了半寸。你被它连人带道基一并钉在岛心，成了全岛第一具站着的尸体');
      }
    }),

    {
      id: 'rd_quasi_layers', name: '准帝重天历练', tier: 3, tag: 'quasi',
      desc: '一重天一重天地往上熬', weight: 0.9, maxCount: 5,
      minAge: 200, maxAge: 100000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 91 && g.lvl < 100; },
      cond: function (g, U) {
        return Math.random() < U.clamp(0.38 + U.currentCombatPower(g) / 900000 + (U.isHighDaoyun(g) ? 0.12 : 0), 0.2, 0.85);
      },
      ok: function (g, U, log) {
        var layer = Math.max(1, g.lvl - 90);
        var c = U.cultPct(g, 0.07, 0.12, 7000);
        U.gainDao(g, U.irand(18, 32));
        U.printlog('准帝第' + layer + '重天不是坐出来的。你压着境界在星海里厮杀了数十年，' +
          '把这一重天的道则嚼碎了咽下去，实力+' + c);
        if (Math.random() < 0.4) U.up(g, 1, log);
      },
      fail: function (g, U) {
        hurtLine(g, U, 150, 380, '你察觉这一重天的道则尚未捋顺，果断收势闭关',
          '强压着未通的道则出手，反被自己的法反噬');
      }
    },

    allinEvent({
      id: 'rd_quasi_ninth_trib', name: '准帝九重天劫', tier: 3, tag: 'quasi',
      desc: '每进一重，都要在雷海里重死一次', weight: 0.7, maxCount: 2,
      minAge: 300,
      available: function (g) { return !g.becameEmperor && g.lvl >= 95 && g.lvl < 100; },
      powerRef: 520000, steadyBase: 0.32, allinBase: 0.08,
      setup: function () { return {}; },
      lead: function (g) {
        return '万道雷海在头顶凝成漏斗，准帝第' + Math.max(1, g.lvl - 90) +
          '重天的劫云比前几次厚了一倍。雷海中心那一线紫光，是历代准帝折戟最多的地方';
      },
      note: '避劫可以，但道则会留一处空缺；硬渡雷海中心能把帝躯彻底锤实，也可能就此渡不过去。',
      backLabel: '暂缓破关避劫', backDesc: '压住境界不引劫，稳妥沉淀，无风险',
      steadyLabel: '按部就班渡劫', steadyDesc: '成功渡过此劫、道则更完整；失败被雷霆劈裂道基重伤',
      allinLabel: '直迎雷海中心', allinDesc: '成功以劫锤炼帝躯，战力道蕴齐涨、境界连破；失败道消于劫下',
      back: function (g, U) {
        var c = U.cultPct(g, 0.01, 0.025, 2000);
        U.printlog('你把已经涨到嗓子眼的气机硬生生压了回去。劫云在头顶盘旋三日，悻悻散去，实力+' + c);
      },
      steadyOk: function (g, U) {
        var c = U.cultPct(g, 0.07, 0.11, 6000);
        U.gainDao(g, U.irand(18, 30));
        g.quasiTribulations = (g.quasiTribulations || 0) + 1;
        U.printlog('你一道一道地接，接到第九十九道时雷海终于散了。帝躯上多了一层焦壳，剥开后是更亮的骨，实力+' + c);
      },
      steadyFail: function (g, U) {
        hurtLine(g, U, 180, 460, '你在雷海合拢前撤出，这一劫算是欠下了',
          '一道雷劈中你道则的空缺处，帝躯自内而外裂开数道口子');
      },
      allinOk: function (g, U, s, log) {
        var c = U.cultPct(g, 0.11, 0.14, 10000);
        U.gainDao(g, U.irand(28, 40));
        g.quasiTribulations = (g.quasiTribulations || 0) + 2;
        U.printlog('你没有躲，反而迎着那一线紫光冲了上去。雷海把你劈成焦炭七次，你就重铸了七次。' +
          '第八次从雷海里走出来时，你的道则已经没有缝隙了，实力+' + c);
        U.up(g, U.irand(1, 3), log);
      },
      allinFail: function (g, U) {
        U.kill(g, '雷海中心那一线紫光落下时，你才明白为什么历代准帝都绕着走。焦痕散尽，星空里连一粒灰都没剩下');
      }
    }),

    allinEvent({
      id: 'rd_quasi_gate_prep', name: '帝关前的最后准备', tier: 3, tag: 'quasi',
      desc: '再往前一步，就是那道门', weight: 0.7, maxCount: 2,
      minAge: 400,
      available: function (g) { return !g.becameEmperor && g.lvl >= 96; },
      powerRef: 600000, steadyBase: 0.34, allinBase: 0.08,
      setup: function () { return { herb: PICK(T3_HERB) }; },
      lead: function () {
        return '帝关的气机已经能摸到了。它不在星空的任何一处，而在你自己的道里——' +
          '像一扇背对着你的门，你越是接近，它越是沉默';
      },
      note: '这一步的准备做得越足，日后叩关的胜算越大。但提前去摸那道门，很可能把门后的东西招来。',
      backLabel: '闭关沉淀', backDesc: '安分地打磨旧伤与道基，小幅精进，无风险',
      steadyLabel: '以圣药重宝温养', steadyDesc: '成功补全帝躯亏空、战力大进；失败药力冲突、道基受创',
      allinLabel: '提前引动帝关气机', allinDesc: '成功摸清帝关脉络、战力道蕴齐至巅峰；失败被帝关气机反噬身陨',
      back: function (g, U) {
        var c = U.cultPct(g, 0.012, 0.028, 2500);
        U.printlog('你闭关三十年，只做一件事：把过去几百年里所有没养好的暗伤一处处磨平。不急，实力+' + c);
      },
      steadyOk: function (g, U, s) {
        var c = U.cultPct(g, 0.08, 0.12, 8000);
        U.gainDao(g, U.irand(18, 30));
        var lf = U.gainLife(g, 100, 260);
        U.printlog('你散尽积蓄换来一炉以『' + s.herb + '』为引的大药，昼夜温养帝躯。' +
          '亏空一处处填回来，气血重新烧得旺盛' + (lf ? '，寿元+' + lf : '') + '，实力+' + c);
      },
      steadyFail: function (g, U) {
        hurtLine(g, U, 160, 400, '药力初起便觉不对，你及时散去药势，只损了那炉药',
          '数种至宝药力在帝躯里互相冲撞，你呕出的血都是五颜六色的');
      },
      allinOk: function (g, U, s, log) {
        g.gateTempered = true;
        var c = U.cultPct(g, 0.11, 0.14, 12000);
        U.gainDao(g, U.irand(28, 40));
        U.printlog('你主动伸手去推那扇背对着你的门。门没有开，但它的纹理、厚度、门后传来的呼吸，' +
          '你全都记住了。回过神来时你已在原地站了九年，实力+' + c);
        U.push(log, { cls: 'rare', text: '帝关的脉络已在心中，日后真正叩关时，你不会再是第一次见它' });
      },
      allinFail: function (g, U) {
        U.kill(g, '你的手指刚碰到门，门后的东西便回过头来。帝关从不迎接还没准备好的人——你的道，就断在这一指之间');
      }
    }),

    allinEvent({
      id: 'rd_quasi_zhengdao_pick', name: '以力证道前的抉择', tier: 3, tag: 'quasi',
      desc: '这一世要不要走到底', weight: 0.6, maxCount: 2,
      minAge: 300,
      /* 准帝九重天会在十余年内自行叩关，卡到 99 这个事件就没有出场窗口了，故从七重天起算 */
      available: function (g) { return !g.becameEmperor && g.lvl >= 97; },
      powerRef: 700000, steadyBase: 0.33, allinBase: 0.07,
      setup: function () { return {}; },
      lead: function () {
        return '你已站在准帝的尽头。以力证道者，要以一己之力把万古以来所有的「不可能」全部砸穿，' +
          '而这一世的机缘、寿元与旧伤，都只够你砸这一次';
      },
      note: '这一步只决定你带着多少底蕴去叩关，成帝与否终究要看那一刻的自己。斩去过去能换来最纯粹的战力，也可能斩断自己。',
      backLabel: '再等一等', backDesc: '不勉强，先稳住现有道行，无风险',
      steadyLabel: '打磨道则', steadyDesc: '成功把万法归于一途、战力大进；失败道则冲突、气机反噬',
      allinLabel: '斩去过去的自己', allinDesc: '成功尽去一切驳杂，战力与道蕴逼近极限；失败连同今生一并斩断',
      back: function (g, U) {
        var c = U.cultPct(g, 0.012, 0.028, 2500);
        U.printlog('你把手从帝关的方向收了回来。这一世还长，多一分把握就多一分活路，实力+' + c);
      },
      steadyOk: function (g, U) {
        var c = U.cultPct(g, 0.08, 0.12, 9000);
        U.gainDao(g, U.irand(20, 32));
        U.printlog('你用了整整一百年，把此生所学万法删到只剩一条。留下的那一条，比原先的全部加起来都锋利，实力+' + c);
      },
      steadyFail: function (g, U) {
        hurtLine(g, U, 170, 420, '万法归一时道则打架，你及时停手，维持原样',
          '删法删到一半，几道根本法则在体内互斩，你重伤闭关');
      },
      allinOk: function (g, U, s, log) {
        g.selfSlashed = true;
        var c = U.cultPct(g, 0.11, 0.14, 14000);
        U.gainDao(g, U.irand(30, 40));
        U.printlog('你把过去的自己——那些侥幸、那些退让、那些不得已——一刀斩了。' +
          '血从眉心流到脚底，站起来的人再没有半点驳杂，实力+' + c);
        U.up(g, 1, log);
        U.push(log, { cls: 'rainbow', text: '你已做好以力证道的全部准备，剩下的，交给帝关那一刻' });
      },
      allinFail: function (g, U) {
        U.kill(g, '你要斩的是过去，可过去也是你。刀落下去，今生的那一半跟着一起断了');
      }
    }),

    /* ===================== tier 2 中级 ===================== */

    {
      id: 'rd_mi_low_delve', name: '低阶秘境·再进一层', tier: 2, tag: 'dungeon',
      desc: '外围、中层、核心，见好就收还是再走一层', weight: 1.2, maxCount: 2,
      minAge: 14, maxAge: 100000,
      /* 低阶秘境只对低中境界构成抉择：圣人以上进去毫无悬念，概率会齐齐顶到上限，故不再出现 */
      available: function (g) { return !g.becameEmperor && g.lvl >= 11 && g.lvl <= 60; },
      choice: function (g, U) {
        var s = stash(g, 'rd_mi_low_delve', { mi: PICK(T2_MI), herb: PICK(T2_HERB) });
        return {
          lead: '『' + s.mi + '』外围的薄雾散了，几拨散修正往里走。' +
            '老人们说这地方越往里越邪，可每年都有人从里面抬着宝贝出来',
          info: statusInfo(g, U),
          note: '这座秘境层次不高，走错了最多是重伤，不至于丢命——但伤了就要养很久。',
          options: [
            { id: 'out', label: '见好就收', desc: '外围采些灵草即走，收获微薄但安全', safe: true },
            { id: 'mid', label: '深入中层', desc: '成功得灵药与矿材；失败被守兽所伤', chance: odds(g, U, 0.40, 60000) },
            { id: 'core', label: '直闯核心', desc: '成功尽得此地精华、修为大进；失败重伤而归', chance: odds(g, U, 0.18, 60000) }
          ]
        };
      },
      resolve: function (g, U, optionId) {
        var s = stashed(g, 'rd_mi_low_delve') || { mi: PICK(T2_MI), herb: PICK(T2_HERB) };
        if (optionId === 'out') {
          var c0 = U.cultPct(g, 0.008, 0.018, 150);
          U.printlog('你在『' + s.mi + '』外围转了半日，采了几株' + s.herb + '就回头了，实力+' + c0);
          return;
        }
        if (optionId === 'mid') {
          if (Math.random() < odds(g, U, 0.40, 60000)) {
            var c1 = U.cultPct(g, 0.025, 0.045, 350);
            var lf1 = U.gainLife(g, 15, 45);
            U.gainDao(g, U.irand(3, 6));
            U.printlog('中层的守兽被你引开，你摸进石窟掏空了整个药圃' + (lf1 ? '，寿元+' + lf1 : '') + '，实力+' + c1);
          } else {
            hurtLine(g, U, 30, 90, '守兽扑来，你丢下药篓跑得飞快', '守兽一爪拍在你背上，你是爬出秘境的');
          }
          return;
        }
        if (Math.random() < odds(g, U, 0.18, 60000)) {
          var c2 = U.cultPct(g, 0.035, 0.05, 500);
          var lf2 = U.gainLife(g, 25, 60);
          U.gainDao(g, U.irand(4, 6));
          U.printlog('你一路摸到『' + s.mi + '』核心，那里是一方小小的灵眼，' +
            '你在灵眼边坐了三个月，把这一池灵机吸得干干净净' + (lf2 ? '，寿元+' + lf2 : '') + '，实力+' + c2);
        } else {
          hurtLine(g, U, 45, 130, '核心处的禁制骤然收缩，你堪堪退了出来',
            '你在核心禁制里被反复碾了一遍，是同行的散修把你拖出来的');
        }
      }
    },

    {
      id: 'rd_mi_low_outer', name: '秘境外围搜寻', tier: 2, tag: 'dungeon',
      desc: '外围的漏，人人都在捡', weight: 3.2, maxCount: 8,
      minAge: 12, maxAge: 100000,
      available: function (g) { return !g.becameEmperor; },
      cond: function (g, U) { return Math.random() < U.clamp(0.55 + g.lvl / 200, 0.4, 0.88); },
      ok: function (g, U) {
        var c = U.cultPct(g, 0.02, 0.04, 280);
        var lf = U.gainLife(g, 12, 40);
        U.printlog('你在『' + PICK(T2_MI) + '』外围蹲了两个月，别人不要的边角你全捡了，' +
          '回去一清点竟凑出半炉' + PICK(T2_HERB) + (lf ? '，寿元+' + lf : '') + '，实力+' + c);
      },
      fail: function (g, U) {
        hurtLine(g, U, 20, 60, '外围也不是白捡的，你空手而归，好在没受伤',
          '你和另一队散修抢同一株药，挨了一记闷棍');
      }
    },

    {
      id: 'rd_mi_low_array', name: '秘境古阵', tier: 2, tag: 'dungeon',
      desc: '一座还在运转的旧阵', weight: 2.6, maxCount: 5,
      minAge: 15, maxAge: 100000,
      available: function (g) { return !g.becameEmperor; },
      cond: function (g, U) { return U.isHighDaoyun(g) || Math.random() < 0.5; },
      ok: function (g, U) {
        var c = U.cultPct(g, 0.022, 0.045, 300);
        U.gainDao(g, U.irand(3, 6));
        U.printlog('『' + PICK(T2_MI) + '』深处有一座还在转的古阵，你蹲在阵外画了大半年的纹路。' +
          '阵是破不开，可这些纹路本身就是好东西，实力+' + c);
      },
      fail: function (g, U) {
        hurtLine(g, U, 25, 70, '你踩错一格便立刻抽身，古阵只亮了一下',
          '你踩错了一格，古阵的杀纹擦着头皮掠过');
      }
    },

    {
      id: 'rd_road_station', name: '古路驿站', tier: 2, tag: 'starroad',
      desc: '星海里唯一能喘口气的地方', weight: 2.8, maxCount: 6,
      minAge: 70, maxAge: 100000,
      available: onRoad(1),
      cond: null,
      ok: function (g, U) {
        var c = U.cultPct(g, 0.018, 0.04, 600);
        U.gainDao(g, U.irand(3, 6));
        var lf = U.gainLife(g, 20, 55);
        U.printlog('『' + PICK(T3_MI) + '』式的古老驿站悬在' + segName(seg(g)) + '中途，禁制之内刀兵不起。' +
          '你在这里补足补给，也听遍了前方各处关卡的死法' + (lf ? '，寿元+' + lf : '') + '，实力+' + c);
      },
      fail: null
    },

    {
      id: 'rd_road_trapped', name: '困于古路某段', tier: 2, tag: 'starroad',
      desc: '前路断了，后路也断了', weight: 2.5, maxCount: 4,
      minAge: 80, maxAge: 100000,
      available: onRoad(1),
      cond: function (g, U) { return U.isHighDaoyun(g) || Math.random() < 0.55; },
      ok: function (g, U) {
        var c = U.cultPct(g, 0.022, 0.048, 700);
        U.gainDao(g, U.irand(4, 6));
        U.printlog('星桥两头同时崩断，你被困在' + segName(seg(g)) +
          '的一块荒星上整整四十年。没有敌人，没有机缘，只有自己的道可以琢磨——出来时反而更稳了，实力+' + c);
      },
      fail: function (g, U) {
        hurtLine(g, U, 35, 100, '困了些年月，好在补给尚足，未伤根本',
          '被困期间补给耗尽，你靠啃食星兽血肉硬熬，气血亏损');
      }
    },

    {
      id: 'rd_road_companion', name: '古路上的同行者', tier: 2, tag: 'starroad',
      desc: '一段路，两个人', weight: 2.6, maxCount: 5,
      minAge: 70, maxAge: 100000,
      available: onRoad(1),
      cond: function () { return Math.random() < 0.68; },
      ok: function (g, U) {
        var c = U.cultPct(g, 0.02, 0.042, 650);
        U.gainDao(g, U.irand(4, 6));
        U.printlog('你与一位同样在赶路的' + rival() + '结伴走了两千里。' +
          '你们白日各走各的，夜里背靠背论道，谁也没问对方的来历。分别时他说：古路尽头见，实力+' + c);
      },
      fail: function (g, U) {
        hurtLine(g, U, 30, 85, '同行者中途起了歹意，你早有防备，各自散去',
          '同行者在你渡劫时下了黑手，你重伤之下才把他打退');
      }
    },

    {
      id: 'rd_quasi_rule_perfect', name: '道则圆满', tier: 2, tag: 'quasi',
      desc: '缺的那一角自己补上了', weight: 2.4, maxCount: 6,
      minAge: 200, maxAge: 100000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 91; },
      cond: function (g, U) { return U.isHighDaoyun(g) || Math.random() < 0.6; },
      ok: function (g, U) {
        var c = U.cultPct(g, 0.025, 0.05, 4000);
        U.gainDao(g, U.irand(4, 6));
        U.printlog('你翻看自己数百年前写下的经文，忽然发现当年空着的那一处，' +
          '如今不用想也能填上了。道则至此再无残缺，实力+' + c);
      },
      fail: null
    },

    {
      id: 'rd_quasi_omen', name: '叩关征兆', tier: 2, tag: 'quasi',
      desc: '天地先一步知道了', weight: 2.4, maxCount: 5,
      minAge: 300, maxAge: 100000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 96; },
      cond: null,
      ok: function (g, U) {
        var c = U.cultPct(g, 0.022, 0.05, 4500);
        U.gainDao(g, U.irand(4, 6));
        U.printlog('你尚未动念，脚下的荒星先开了花，星海无风自起浪，' +
          '几处古老禁地同时睁开了眼睛——天地比你更早知道有人要叩帝关了，实力+' + c);
      },
      fail: null
    },

    /* ===================== tier 1 普通 ===================== */

    {
      id: 'rd_edge_scout', name: '秘境外围踏勘', tier: 1, tag: 'dungeon',
      desc: '先把地形摸清楚', weight: 5, maxCount: 100,
      minAge: 10, maxAge: 100000,
      available: function (g) { return !g.becameEmperor; },
      cond: null,
      ok: function (g, U) {
        var c = U.cultPct(g, 0.004, 0.009, 70);
        U.printlog('你绕着『' + PICK(T2_MI) + '』的外沿走了一圈，把出入口、水源和兽径都记在心里。' +
          '进秘境死的人，多半是死在不熟地形上，实力+' + c);
      },
      fail: null
    },

    {
      id: 'rd_broken_map', name: '残破秘境图', tier: 1, tag: 'dungeon',
      desc: '半张图，半个念想', weight: 4.5, maxCount: 100,
      minAge: 12, maxAge: 100000,
      available: function (g) { return !g.becameEmperor; },
      cond: null,
      ok: function (g, U) {
        var c = U.cultPct(g, 0.004, 0.01, 80);
        U.printlog('你花了点碎银从一个断了腿的老修士手里买下半张『' + PICK(T2_MI) +
          '』的舆图。他说另外半张在他师兄身上，而他师兄没能出来，实力+' + c);
      },
      fail: null
    },

    {
      id: 'rd_ruin_camp', name: '古洞府宿营', tier: 1, tag: 'dungeon',
      desc: '借死人的屋檐躲一夜雨', weight: 4.5, maxCount: 100,
      minAge: 10, maxAge: 100000,
      available: function (g) { return !g.becameEmperor; },
      cond: null,
      ok: function (g, U) {
        var lf = U.gainLife(g, 4, 14);
        var c = U.cultPct(g, 0.003, 0.008, 60);
        U.printlog('你在一座废弃洞府里过夜，墙上还留着前主人刻到一半的功法。' +
          '你就着火光把它抄了下来' + (lf ? '，夜里睡得安稳，寿元+' + lf : '') + '，实力+' + c);
      },
      fail: null
    },

    {
      id: 'rd_old_guide', name: '老修士引路', tier: 1, tag: 'dungeon',
      desc: '经验是拿命换来的', weight: 4, maxCount: 100,
      minAge: 12, maxAge: 100000,
      available: function (g) { return !g.becameEmperor; },
      cond: null,
      ok: function (g, U) {
        var c = U.cultPct(g, 0.004, 0.009, 70);
        U.printlog('一位跛脚的老修士领你走了一段险路，路上他一直念叨：' +
          '「见着黑雾就退，见着开着花的石头就退，见着不动的尸体——更要退。」实力+' + c);
      },
      fail: null
    },

    {
      id: 'rd_road_tale', name: '星空古路的传说', tier: 1, tag: 'starroad',
      desc: '说书人讲的那条路', weight: 4, maxCount: 100,
      minAge: 8, maxAge: 100000,
      available: function (g) { return !g.becameEmperor && seg(g) === 0; },
      cond: null,
      ok: function (g, U) {
        var c = U.cultPct(g, 0.003, 0.008, 60);
        U.printlog('坊市的说书人拍案讲起星空古路：石门之后是' + segName(1) + '，' +
          '再往后是' + segName(2) + '、' + segName(3) + '，一段比一段凶。' +
          '他说上路的门槛是圣人，你默默记下了，实力+' + c);
      },
      fail: null
    },

    {
      id: 'rd_gamble_tale', name: '赌命者的故事', tier: 1, tag: 'allin',
      desc: '有人赢了，更多人没回来', weight: 4, maxCount: 100,
      minAge: 10, maxAge: 100000,
      available: function (g) { return !g.becameEmperor; },
      cond: null,
      ok: function (g, U) {
        var c = U.cultPct(g, 0.004, 0.01, 70);
        U.printlog('酒肆里人人都在讲同一个故事：某人一头扎进禁地，十年后带着满身道纹回来，' +
          '如今已是一方巨擘。没人讲的是同他一起进去的另外三十七个人，实力+' + c);
      },
      fail: null
    }
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = EVENTS;
  root.EVENT_PACK_ROAD = EVENTS;
})(typeof self !== 'undefined' ? self : this);
