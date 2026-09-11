/* ============================================================
 * 遮天模拟器 · 随机事件包（world）：势力、时代、宿敌、世界大势
 *
 * 分区：
 *   A 宿敌与恩怨链  tag='nemesis'   共 10 个，靠 g.nemesis 串成一条链
 *   B 圣地古族与势力 tag='sect'      共 15 个（含招婿后续）
 *   C 时代与世界大势 tag='era'       共 8 个，读 g.era.id 与 g.worldEmperor
 *   D 禁区与黑暗动乱 tag='forbidden' 共 6 个，增减 g.forbiddenKarma
 *   E 传说级世界事件 tag 各异        共 6 个（全部 tier 4）
 *
 * 宿敌链状态 g.nemesis = {
 *   name  展示名（势力+称号，不杜撰具体人名）
 *   title 称号（取自 POOLS.RIVAL_TITLES）
 *   sect  所属势力（取自 POOLS.SECTS）
 *   cause 起因 treasure|protect|clan|dao
 *   ratio 宿敌战力 / 玩家战力 的比例，随交锋结果浮动
 *   power 结算瞬间的绝对战力快照，仅用于展示
 *   grudge 恩怨阶段 1..6，每个链节点严格匹配一个阶段后 +1
 * }
 * g.nemesisResolved 为 true 表示恩怨已了结，链不再触发。
 * ============================================================ */
(function (root) {
  var POOLS = typeof module !== 'undefined' && module.exports ? require('./events-pools.js') : root.EVENT_POOLS;
  var PICK = POOLS.PICK, stage = POOLS.stage, lvNeed = POOLS.lvNeed;
  var SECTS = POOLS.SECTS, REGIONS = POOLS.REGIONS;
  var RIVAL_TITLES = POOLS.RIVAL_TITLES, AGES = POOLS.AGES, eraPair = POOLS.eraPair;
  var T4_BING = POOLS.T4_BING, T3_BING = POOLS.T3_BING;
  var T3_HERB = POOLS.T3_HERB, T3_GONG = POOLS.T3_GONG;
  var T4_MI = POOLS.T4_MI, T3_MI = POOLS.T3_MI;

  /* ---------- 宿敌链工具 ---------- */

  /* 结仇：一局里只允许存在一条恩怨线，四个起因事件互斥 */
  function nemesisFree(g) {
    return !g.becameEmperor && !g.nemesis && !g.nemesisResolved;
  }
  /* 链节点准入：必须正好停在指定阶段，避免乱序与死循环 */
  function nemesisAt(step) {
    return function (g) {
      return !g.becameEmperor && !!g.nemesis && !g.nemesisResolved &&
        g.nemesis.grudge === step;
    };
  }
  function makeNemesis(g, cause, ratio) {
    var sect = PICK(SECTS), title = PICK(RIVAL_TITLES);
    g.nemesis = {
      name: sect + '的' + title, title: title, sect: sect,
      cause: cause, ratio: ratio,
      power: Math.round(g.cult * ratio), grudge: 1
    };
    return g.nemesis;
  }
  /* 推进一个阶段；delta 为正表示宿敌相对变强（你落了下风） */
  function bumpNemesis(g, delta) {
    var n = g.nemesis;
    if (!n) return null;
    n.grudge += 1;
    n.ratio = Math.max(0.55, Math.min(1.85, n.ratio + delta));
    n.power = Math.round(g.cult * n.ratio);
    return n;
  }
  function nemesisPower(g) {
    var n = g.nemesis;
    if (!n) return 0;
    n.power = Math.round(g.cult * n.ratio);
    return n.power;
  }
  /* 生死决战胜率：只看确定量，choice 与 resolve 两处调用结果必须一致 */
  function nemesisWinChance(g, U) {
    var n = g.nemesis;
    if (!n) return 0.5;
    var p = 0.5 + (1 - n.ratio) * 0.9;
    p += Math.min(0.09, ((g.daoGift || 5) - 5) * 0.018);
    if (U.isHighDaoyun(g)) p += 0.08;
    if (g.createdArts && g.createdArts.length) p += Math.min(0.06, g.createdArts.length * 0.02);
    return U.clamp(p, 0.12, 0.88);
  }
  /* 设局暗算：稳妥但难成，靠悟性与道蕴 */
  function nemesisSchemeChance(g, U) {
    var p = 0.16 + ((g.daoGift || 5) - 3) * 0.022;
    if (U.isHighDaoyun(g)) p += 0.10;
    if (g.nemesis && g.nemesis.ratio < 1) p += 0.05;
    return U.clamp(p, 0.12, 0.46);
  }

  /* ---------- 世界大势工具 ---------- */

  function eraIs(g, id) { return !!(g.era && g.era.id === id); }
  /* 当世有帝：帝道镇压万道，玩家证道受阻 */
  function underEmperor(g) { return !!g.worldEmperor; }
  /* 帝已坐化：天心已然无主，但帝道烙印仍在天地间慢慢消解 */
  function underTrace(g) {
    return !g.worldEmperor && (!!g.daoSuppressed || (g.worldEmperorSeq || 0) >= 1);
  }
  function emperorName(g) {
    return (g.worldEmperor && g.worldEmperor.name) || '当世大帝';
  }
  function karma(g) { return g.forbiddenKarma || 0; }

  /* 禁区外围：越深越险，血债越重越容易被盯上 */
  function forbiddenDeepChance(g, U) {
    var p = 0.20 + U.currentCombatPower(g) / 900000 * 0.42 - karma(g) * 0.05;
    if (U.isHighDaoyun(g)) p += 0.05;
    return U.clamp(p, 0.10, 0.72);
  }
  /* 黑暗动乱正面迎击至尊：梭哈胜率 */
  function turmoilWinChance(g, U) {
    var p = 0.07 + U.currentCombatPower(g) / 1600000 * 0.58 - karma(g) * 0.05;
    if (U.isHighDaoyun(g)) p += 0.06;
    if (g.lvl >= 99) p += 0.05;
    return U.clamp(p, 0.05, 0.74);
  }
  /* 帝兵争夺：极道帝兵认主本就看气运，压得很低 */
  function diBingGrabChance(g, U) {
    var p = 0.10 + U.currentCombatPower(g) / 1400000 * 0.40;
    if (U.isHighDaoyun(g)) p += 0.05;
    return U.clamp(p, 0.08, 0.58);
  }
  /* 古路尽头：越往前越是纯粹的以身试道 */
  function roadEndChance(g, U) {
    var p = 0.14 + U.currentCombatPower(g) / 1500000 * 0.44;
    if (U.isHighDaoyun(g)) p += 0.08;
    return U.clamp(p, 0.10, 0.70);
  }
  /* 招婿：记下的是圣地名；'refused' 只表示婉拒过，不算在婚 */
  function marriedSect(g) {
    var s = g && g.sectMarriage;
    if (!s || s === 'refused') return '';
    return s;
  }
  function marriageAlive(g) {
    return !!marriedSect(g) && !g.marriageBroken;
  }

  var EVENTS = [

    /* ================================================================
     * A · 宿敌与恩怨链（10）
     * 起因四选一 → 崛起 → 初战 → 设伏 → 势力火并 → 战书 → 生死决战
     * ================================================================ */

    /* --- A1 起因：夺宝 --- */
    {
      id: 'wld_nemesis_treasure', weight: 4, maxCount: 1,
      name: '夺宝结仇', tier: 1, tag: 'nemesis',
      desc: '一件机缘只能落在一人手中',
      minAge: 12, maxAge: 600,
      available: function (g) { return nemesisFree(g) && g.lvl >= 5 && g.lvl <= 62; },
      cond: function (g, U) { return Math.random() < 0.55 + Math.min(0.2, g.lvl / 300); },
      choice: function (g, U) {
        return {
          lead: '古洞里只剩一件机缘，洞口已经响起别人的脚步',
          info: '抢先取走会结下一桩恩怨；退让能保命，却要把东西让出去',
          note: '退让无死险；伸手则结仇，但机缘归你。',
          options: [
            { id: 'yield', label: '退到洞外，看他取走', desc: '记下这张脸，机缘让出', safe: true },
            { id: 'grab', label: '先一步取走机缘', desc: '得机缘，结下一桩不共戴天的仇' }
          ]
        };
      },
      resolve: function (g, U, optionId) {
        if (optionId === 'yield') {
          var n1 = makeNemesis(g, 'treasure', U.rand(0.88, 1.02));
          U.printlog('你退到洞外，看' + n1.name + '取走机缘。对方扫了你一眼，像在看一块石头——这仇，你自己知道');
          return;
        }
        var n2 = makeNemesis(g, 'treasure', U.rand(0.72, 0.88));
        var c = U.cultPct(g, 0.005, 0.011, 100);
        U.printlog('你在' + PICK(REGIONS) + '的一处古洞里先一步取走了机缘，' +
          n2.name + '踏碎半座山头也没能追上你，临走前记下了你的气息，实力+' + c);
      },
      ok: function (g, U) {
        var n = makeNemesis(g, 'treasure', U.rand(0.72, 0.88));
        var c = U.cultPct(g, 0.005, 0.011, 100);
        U.printlog('你在' + PICK(REGIONS) + '的一处古洞里先一步取走了机缘，' +
          n.name + '踏碎半座山头也没能追上你，临走前记下了你的气息，实力+' + c);
      },
      fail: function (g, U) {
        var n = makeNemesis(g, 'treasure', U.rand(0.88, 1.02));
        var h = U.hurt(g, 10, 30);
        U.printlog('机缘被' + n.name + '当面夺走，' +
          (h.loss ? '你还被顺手打断了一条手臂，寿元 -' + h.loss : '你咬牙记下了这张脸') +
          '。此仇不共戴天');
      }
    },
    /* --- A2 起因：护道 --- */
    {
      id: 'wld_nemesis_protect', weight: 3.5, maxCount: 1,
      name: '护道结仇', tier: 1, tag: 'nemesis',
      desc: '拦下的那一刀，也拦下了半生恩怨',
      minAge: 12, maxAge: 600,
      available: function (g) { return nemesisFree(g) && g.lvl >= 5 && g.lvl <= 62; },
      cond: function (g, U) { return Math.random() < 0.6 + Math.min(0.2, g.lvl / 300); },
      ok: function (g, U) {
        var n = makeNemesis(g, 'protect', U.rand(0.74, 0.9));
        var c = U.cultPct(g, 0.005, 0.011, 100);
        U.printlog('你横身拦下' + n.name + '的杀招，救走了一名被追杀的散修。' +
          '对方看着掌心裂开的血口，只说了一句「记住你了」，实力+' + c);
      },
      fail: function (g, U) {
        var n = makeNemesis(g, 'protect', U.rand(0.9, 1.05));
        var h = U.hurt(g, 12, 34);
        U.printlog('你出手护人，却被' + n.name + '一掌拍飞，眼睁睁看着那人被斩。' +
          (h.loss ? '气血翻涌，寿元 -' + h.loss : '你被血溅了满身') + '，从此结下死仇');
      }
    },
    /* --- A3 起因：族仇 --- */
    {
      id: 'wld_nemesis_clan', weight: 2.6, maxCount: 1,
      name: '故人血债', tier: 2, tag: 'nemesis',
      desc: '当年那场血洗，你终于查到了名字',
      minAge: 16, maxAge: 900,
      available: function (g) { return nemesisFree(g) && g.lvl >= 11 && g.lvl <= 72; },
      cond: function (g, U) { return Math.random() < 0.5 + Math.min(0.25, g.lvl / 260); },
      ok: function (g, U) {
        var n = makeNemesis(g, 'clan', U.rand(0.78, 0.94));
        var c = U.cultPct(g, 0.02, 0.045, 300);
        U.printlog('你顺着一枚残破族徽查到底，当年血洗故里的正是' + n.name + '一脉。' +
          '你在旧址上跪坐一夜，起身时道心反而澄澈了几分，实力+' + c);
      },
      fail: function (g, U) {
        var n = makeNemesis(g, 'clan', U.rand(0.95, 1.1));
        var h = U.hurt(g, 20, 55);
        U.printlog('你寻上门去问旧事，' + n.name + '连正眼都没给你，随手一记道印把你轰出祖地。' +
          (h.loss ? '寿元 -' + h.loss : '你吐着血爬起来') + '，血债自此记在心口');
      }
    },
    /* --- A4 起因：道争 --- */
    {
      id: 'wld_nemesis_dao', weight: 2.4, maxCount: 1,
      name: '道争结怨', tier: 2, tag: 'nemesis',
      desc: '两条路只能有一条走到最后',
      minAge: 18, maxAge: 900,
      available: function (g) { return nemesisFree(g) && g.lvl >= 11 && g.lvl <= 72; },
      cond: function (g, U) {
        return Math.random() < 0.5 + Math.min(0.28, ((g.daoGift || 5) - 3) * 0.05);
      },
      ok: function (g, U) {
        var n = makeNemesis(g, 'dao', U.rand(0.76, 0.92));
        var c = U.cultPct(g, 0.02, 0.045, 300);
        U.gainDao(g, U.irand(3, 6));
        U.printlog('你与' + n.name + '在' + PICK(REGIONS) + '论道七日，逐句拆穿了对方的经义。' +
          '对方拂袖而去，撂下一句「他日以道相见」，实力+' + c);
      },
      fail: function (g, U) {
        var n = makeNemesis(g, 'dao', U.rand(0.92, 1.08));
        U.printlog('论道落于下风，' + n.name + '当众断言你此生止步于此。' +
          '满场哄笑里你一句话也没说，只把这份不甘压进了道心');
      }
    },

    /* --- A5 崛起 --- */
    {
      id: 'wld_nemesis_rise', weight: 3.0, maxCount: 1,
      name: '宿敌崛起', tier: 2, tag: 'nemesis',
      desc: '你在苦修，他也在',
      minAge: 14, maxAge: 4000,
      available: nemesisAt(1),
      cond: function (g, U) { return Math.random() < 0.58; },
      ok: function (g, U) {
        var n = g.nemesis;
        bumpNemesis(g, -0.03);
        var c = U.cultPct(g, 0.02, 0.045, 300);
        U.printlog('传言' + n.name + '得了' + n.sect + '的重宝加持，声势日盛。' +
          '你听完只是把闭关的门又关紧了些，实力+' + c +
          '（宿敌战力约 ' + nemesisPower(g) + '）');
      },
      fail: function (g, U) {
        var n = g.nemesis;
        bumpNemesis(g, 0.09);
        U.printlog(n.sect + '倾力栽培' + n.title + '，一步登天。' +
          '消息传来时你正卡在瓶颈上，第一次清楚地感到被人甩在了后面' +
          '（宿敌战力约 ' + nemesisPower(g) + '）');
      }
    },
    /* --- A6 初次交锋 --- */
    {
      id: 'wld_nemesis_clash', weight: 3.0, maxCount: 1,
      name: '初次交锋', tier: 2, tag: 'nemesis',
      desc: '第一次真刀真枪地打过一场',
      minAge: 16, maxAge: 5000,
      available: nemesisAt(2),
      cond: function (g, U) {
        return Math.random() < U.clamp(0.62 - (g.nemesis.ratio - 0.85) * 0.6, 0.25, 0.85);
      },
      ok: function (g, U) {
        var n = g.nemesis;
        bumpNemesis(g, -0.04);
        var c = U.cultPct(g, 0.025, 0.05, 400);
        U.printlog('你与' + n.name + '在' + PICK(REGIONS) + '正面撞上，三百回合后对方吐血退走。' +
          '你没有追——你要的不是这一场，实力+' + c);
      },
      fail: function (g, U) {
        var n = g.nemesis;
        bumpNemesis(g, 0.1);
        var h = U.hurt(g, 25, 60);
        U.printlog('一场恶战，你被' + n.name + '压着打，最终靠遁术脱身。' +
          (h.loss ? '道基震裂，寿元 -' + h.loss : '衣衫尽碎，却没伤到根本') +
          '（宿敌战力约 ' + nemesisPower(g) + '）');
      }
    },
    /* --- A7 设伏（与 A8 同为第 3 阶的互斥分支） --- */
    {
      id: 'wld_nemesis_ambush', weight: 3.5, maxCount: 1,
      name: '血仇设伏', tier: 2, tag: 'nemesis',
      desc: '他不再讲什么规矩了',
      minAge: 20, maxAge: 6000,
      available: nemesisAt(3),
      cond: function (g, U) {
        return Math.random() < U.clamp(0.58 - (g.nemesis.ratio - 0.85) * 0.7 +
          (U.isHighDaoyun(g) ? 0.1 : 0), 0.22, 0.86);
      },
      ok: function (g, U) {
        var n = g.nemesis;
        bumpNemesis(g, -0.05);
        var c = U.cultPct(g, 0.03, 0.05, 700);
        U.gainDao(g, U.irand(3, 6));
        U.printlog(n.name + '联手数名死士布下杀阵候你入瓮，你却反其道踏阵而入，' +
          '在阵眼处斩尽爪牙。杀阵纹路反被你悟去几分，实力+' + c);
      },
      fail: function (g, U) {
        var n = g.nemesis;
        bumpNemesis(g, 0.12);
        var h = U.hurt(g, 25, 60);
        U.printlog('你终究还是踏进了' + n.name + '的杀阵，' +
          (h.loss ? '半边身子被阵光洞穿，靠一口气爬出重围，寿元 -' + h.loss :
            '所幸护身之法及时展开，狼狈却未伤根本') +
          '（宿敌战力约 ' + nemesisPower(g) + '）');
      }
    },
    /* --- A8 势力火并（与 A7 同为第 3 阶的互斥分支） --- */
    {
      id: 'wld_nemesis_sectwar', weight: 3.4, maxCount: 1,
      name: '两方火并', tier: 2, tag: 'nemesis',
      desc: '私仇烧成了两股势力的战争',
      minAge: 24, maxAge: 7000,
      available: nemesisAt(3),
      cond: function (g, U) {
        return Math.random() < U.clamp(0.55 - (g.nemesis.ratio - 0.9) * 0.7 +
          g.lvl / 400, 0.22, 0.84);
      },
      ok: function (g, U, log) {
        var n = g.nemesis;
        bumpNemesis(g, -0.06);
        var c = U.cultPct(g, 0.03, 0.05, 750);
        U.gainDao(g, U.irand(3, 6));
        U.printlog(n.sect + '举族压境，你孤身立于山门之前连挑十七位长老。' +
          '血流成河之后，对方主动收兵议和——只有' + n.title + '不肯罢手，实力+' + c);
        if (g.swallowingArt && Math.random() < 0.4) U.trySwallowPhysique(g, log);
      },
      fail: function (g, U) {
        var n = g.nemesis;
        bumpNemesis(g, 0.13);
        var h = U.hurt(g, 30, 75);
        U.printlog(n.sect + '举族压境，你所依之地被夷为平地。' +
          (h.loss ? '你背着重伤突围而出，寿元 -' + h.loss : '你在废墟里站到了天亮') +
          '。这笔账只能亲手算' +
          '（宿敌战力约 ' + nemesisPower(g) + '）');
      }
    },
    /* --- A9 战书 --- */
    {
      id: 'wld_nemesis_declare', weight: 3.5, maxCount: 1,
      name: '生死战书', tier: 2, tag: 'nemesis',
      desc: '一纸战书送到面前，约的是命',
      minAge: 28, maxAge: 8000,
      available: nemesisAt(4),
      cond: function (g, U) { return Math.random() < 0.6; },
      ok: function (g, U) {
        var n = g.nemesis;
        bumpNemesis(g, -0.05);
        var c = U.cultPct(g, 0.028, 0.05, 700);
        U.gainDao(g, U.irand(3, 6));
        U.printlog(n.name + '以血写战书，约你于' + PICK(REGIONS) + '决生死。' +
          '你把战书焚成灰，闭关推演对方的每一式杀招，实力+' + c);
      },
      fail: function (g, U) {
        var n = g.nemesis;
        bumpNemesis(g, 0.08);
        U.gainDao(g, U.irand(2, 5));
        U.printlog(n.name + '当着诸方势力的面掷下战书，还请了三位见证者压场。' +
          '你被架在火上，退无可退' +
          '（宿敌战力约 ' + nemesisPower(g) + '）');
      }
    },
    /* --- A10 生死决战（选择型，链终点） --- */
    {
      id: 'wld_nemesis_final', weight: 1.6, maxCount: 2,
      name: '宿敌决战', tier: 3, tag: 'nemesis',
      desc: '半生恩怨，今日了断',
      minAge: 30, maxAge: 9000,
      available: function (g) {
        return !g.becameEmperor && !!g.nemesis && !g.nemesisResolved && g.nemesis.grudge >= 5;
      },
      choice: function (g, U) {
        var n = g.nemesis;
        var win = nemesisWinChance(g, U);
        var scheme = nemesisSchemeChance(g, U);
        return {
          lead: n.name + '已在约定之地等了你三年，天地间杀气凝而不散',
          info: '你的战力 ' + U.currentCombatPower(g) + ' · 宿敌战力约 ' + nemesisPower(g) +
            ' · 恩怨已积 ' + n.grudge + ' 阶',
          note: '正面决战：赢则彻底了断并夺其气运，输则当场身陨。避战可保命，但要折损气运与道蕴。设局暗算把握不高，失败也只是无功而返。',
          options: [
            { id: 'avoid', label: '避而不战', desc: '保住性命，折损气运与部分道蕴', safe: true },
            { id: 'scheme', label: '设局暗算', desc: '成则借势除敌，败则无功而返', chance: scheme },
            { id: 'duel', label: '正面决战', desc: '赢则夺其道果气运，败则身陨',
              chance: U.allInFloor(win, g, Math.max(1, nemesisPower(g))),
              deathChance: U.deathOdds(U.allInFloor(win, g, Math.max(1, nemesisPower(g))),
                U.deathShare(g, 0.45, Math.max(1, nemesisPower(g)))),
              risk: 'deadly' }
          ]
        };
      },
      resolve: function (g, U, optionId, log) {
        var n = g.nemesis;
        if (!n) return;
        if (optionId === 'avoid') {
          g.nemesisResolved = true;
          g.nemesisOutcome = 'avoid';
          g.tm.evt = Math.max(0.6, g.tm.evt * 0.9);
          g.tm.evf = Math.max(0.6, g.tm.evf * 0.92);
          g.daoyun = Math.max(0, g.daoyun - U.irand(18, 36));
          U.printlog('你终究没有赴约。' + n.name + '在约战之地立碑刻你之名以为笑柄，' +
            '天下人皆知你避了这一战——道心裂了一道细纹，气运与道蕴俱损');
          return;
        }
        if (optionId === 'scheme') {
          if (Math.random() < nemesisSchemeChance(g, U)) {
            g.nemesisResolved = true;
            g.nemesisOutcome = 'scheme';
            var cs = U.cultPct(g, 0.05, 0.10, 1800);
            U.gainDao(g, U.irand(12, 24));
            U.printlog('你没有赴约，而是先一步毁去' + n.sect + '的护山大阵、断其后路，' +
              '再于归途设伏。' + n.title + '死时始终没看清杀他的是什么法，实力+' + cs);
          } else {
            bumpNemesis(g, 0.05);
            n.grudge = 5;   /* 停在决战阶段，靠 maxCount 兜住第二次机会，不会死循环 */
            var hs = U.hurt(g, 40, 120);
            U.printlog('设局被' + n.name + '提前识破，反手断了你埋下的所有暗手。' +
              (hs.loss ? '你在追杀中逃了三个月，寿元 -' + hs.loss : '你及时收手，未落把柄') +
              '。这一战终归躲不掉');
          }
          return;
        }
        /* duel */
        var win = nemesisWinChance(g, U);
        var nRef = Math.max(1, nemesisPower(g));
        var nOut = U.allIn(U.allInFloor(win, g, nRef), U.deathShare(g, 0.45, nRef));
        if (nOut === 'win') {
          g.nemesisResolved = true;
          g.nemesisOutcome = 'win';
          var c = U.cultPct(g, 0.09, 0.14, 4000);
          U.gainDao(g, U.irand(22, 40));
          var lf = U.gainLife(g, 80, 240);
          U.push(log, { cls: 'rare', text: '你与' + n.name + '战了九日九夜，最后一击将其道果连同肉身一并打散' });
          U.printlog('半生恩怨今日尽了。你立于尸山之上，夺其气运、承其道果，实力+' + c +
            (lf ? '，寿元+' + lf : ''));
        } else if (nOut === 'dead') {
          U.kill(g, '决战之地血光冲天。' + n.name + '的最后一式贯穿你的胸口，' +
            '你至死也没有后退半步——这一世的路，断在了这里');
          g.deadCause = 'nemesis';
        } else {
          var hn = U.hurt(g, 80, 220);
          bumpNemesis(g, 0.04);
          U.printlog('你们两败俱伤，谁也没能当场结果谁。' +
            (hn.loss ? '你吐着血退下场来，寿元 -' + hn.loss : '你咬牙撑住了最后一击') +
            '。这一战还没有完');
        }
      }
    },

    /* ================================================================
     * B · 圣地古族与势力（10）
     * ================================================================ */

    {
      id: 'wld_sect_invite', weight: 4, maxCount: 4,
      name: '圣地相邀', tier: 1, tag: 'sect',
      desc: '有人带着请帖找上门来',
      minAge: 10, maxAge: 3000,
      available: function (g) { return !g.becameEmperor && g.lvl <= 80; },
      cond: function (g, U) { return Math.random() < 0.6 + Math.min(0.25, g.innate * 0.03); },
      ok: function (g, U) {
        var s = PICK(SECTS);
        var c = U.cultPct(g, 0.005, 0.012, 120);
        U.printlog(s + '遣使持请帖登门，愿以外门供奉之礼相待。' +
          '你随其入山住了一段时日，借其洞天灵机温养己身，实力+' + c);
        var lf = U.gainLife(g, 5, 20);
        if (lf) U.printlog('圣地灵气浸润肉身，寿元+' + lf);
      },
      fail: function (g, U) {
        U.printlog(PICK(SECTS) + '的执事上下打量你一番，只丢下半句「再看看罢」便走了。' +
          '你站在原地，把这份轻慢咽了下去');
      }
    },
    {
      id: 'wld_clan_trial', weight: 4, maxCount: 5,
      name: '古族试炼', tier: 1, tag: 'sect',
      desc: '古族祖地开启，考较后辈',
      minAge: 12, maxAge: 3000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 3 && g.lvl <= 80; },
      cond: function (g, U) { return g.lvl >= Math.min(70, Math.floor(g.age * 0.6)) - U.irand(0, 10); },
      ok: function (g, U) {
        var s = PICK(SECTS);
        var c = U.cultPct(g, 0.006, 0.012, 130);
        U.printlog(s + '开祖地试炼，你在血气冲天的古战场幻象里走到了最后一层，' +
          '得赐一枚温养元神的古玉，实力+' + c);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 6, 20);
        U.printlog(h.exempt ? '古族试炼中幻象凶戾，你及时退出，未受损伤' :
          '试炼幻象里的古兵斩落，你被震得七窍流血，寿元 -' + h.loss);
      }
    },
    {
      id: 'wld_sect_library', weight: 3.5, maxCount: 4,
      name: '圣地藏经阁', tier: 1, tag: 'sect',
      desc: '一层层往上，皆是先贤旧笔',
      minAge: 12, maxAge: 4000,
      available: function (g) { return !g.becameEmperor && g.lvl <= 85; },
      cond: null,
      ok: function (g, U) {
        var s = PICK(SECTS);
        var c = U.cultPct(g, 0.005, 0.011, 110);
        U.printlog('你获准进入' + s + '藏经阁三日。旁人抢着抄录高深法门，' +
          '你却在最底层翻出一卷无名残页，其上批注比经文本身更值钱，实力+' + c);
      },
      fail: null
    },
    {
      id: 'wld_sect_marriage', weight: 1.2, maxCount: 1,
      name: '圣地招婿', tier: 2, tag: 'sect',
      desc: '一桩婚约，半座圣地的资源',
      minAge: 16, maxAge: 2000,
      available: function (g) {
        return !g.becameEmperor && g.lvl >= 21 && g.lvl <= 80 && !g.sectMarriage;
      },
      choice: function (g, U) {
        var s = PICK(SECTS);
        g.pendingMarriageSect = s;
        return {
          lead: s + '的太上长老亲至，欲以嫡系' + (Math.random() < 0.5 ? '圣女' : '少主') + '相许',
          info: '应下则得' + s + '岁岁供养，日后征召、姻亲有难都要你出面；婉拒当面无事，他们却会记仇，秘境与路都会堵你',
          note: '应婚有长期供养，也被山门捆住；婉拒眼下最稳，日后会被堵路。',
          options: [
            { id: 'refuse', label: '婉言谢绝', desc: '道途自主，日后可能被他们堵路', safe: true },
            { id: 'accept', label: '应下婚约', desc: '得圣地供养，也要为他们挡刀' }
          ]
        };
      },
      resolve: function (g, U, optionId, log) {
        var s = g.pendingMarriageSect || PICK(SECTS);
        g.pendingMarriageSect = null;
        if (optionId === 'accept') {
          g.sectMarriage = s;
          g.sectPatron = s;
          var c = U.cultPct(g, 0.03, 0.05, 500);
          var lf = U.gainLife(g, 20, 55);
          U.gainDao(g, U.irand(3, 6));
          U.printlog('你受了' + s + '的婚约。自此圣药重宝源源不断送入你的洞府，' +
            '实力+' + c + (lf ? '，寿元+' + lf : '') + '——只是从今往后，你的道也牵着别人的命');
        } else {
          g.sectMarriage = 'refused';
          U.printlog('你朝' + s + '的太上长老拱手一礼，说自己的路要自己走完。' +
            '老人盯了你许久，最终只留下一句「但愿你走得到」');
        }
      }
    },
    {
      id: 'wld_marriage_tribute', weight: 2.4, maxCount: 5,
      name: '岁岁圣药', tier: 2, tag: 'sect',
      desc: '岳家按年送来的供养',
      minAge: 18, maxAge: 8000,
      available: function (g) {
        return !g.becameEmperor && marriageAlive(g) && g.lvl >= 25 && g.lvl <= 90;
      },
      cond: function (g, U) {
        return Math.random() < U.clamp(0.72 - (g.marriageDebt || 0) * 0.12, 0.38, 0.82);
      },
      ok: function (g, U) {
        var s = marriedSect(g);
        var c = U.cultPct(g, 0.018, 0.034, 280);
        var lf = U.gainLife(g, 12, 36);
        U.printlog(s + '按旧约送来一匣圣药。轿子停在洞府外，执事只说「岳家的心意」，' +
          '实力+' + c + (lf ? '，寿元+' + lf : '') + '——这份礼，来年还会再来');
      },
      fail: function (g, U) {
        var s = marriedSect(g);
        var c = U.cultPct(g, 0.004, 0.010, 80);
        U.printlog(s + '今年的供养在山门内斗里被人截走。送到你手上的只剩半匣残药，实力+' + c +
          '。传讯石那头只丢下一句「明年补」');
      }
    },
    {
      id: 'wld_marriage_levy', weight: 1.6, maxCount: 3,
      name: '姻亲征召', tier: 3, tag: 'sect',
      desc: '养你的人，要你去挡第一波',
      minAge: 20, maxAge: 9000,
      available: function (g) {
        return !g.becameEmperor && marriageAlive(g) && g.lvl >= 31 && g.lvl <= 95;
      },
      choice: function (g, U) {
        var s = marriedSect(g);
        var p = U.clamp(0.48 + (g.lvl || 1) / 220 + (g.innate || 1) * 0.02, 0.40, 0.86);
        g.pendingLevyChance = p;
        return {
          lead: s + '传讯召你。对家圣地压境，岳家要你这位女婿上阵，挡谷口第一波',
          info: '去了是拿命换他们这些年的供养；不去则婚约开始发苦。此战胜算 ' + U.pct(p),
          note: '称病眼下最稳，但他们会记这一笔。',
          options: [
            { id: 'ill', label: '称病不出', desc: '暂避刀锋，姻亲记下这笔账', safe: true },
            { id: 'fight', label: '领命上阵', desc: '挡下这一波，或在两圣地夹缝里重伤', chance: p }
          ]
        };
      },
      resolve: function (g, U, optionId) {
        var s = marriedSect(g) || PICK(SECTS);
        var p = g.pendingLevyChance != null ? g.pendingLevyChance :
          U.clamp(0.48 + (g.lvl || 1) / 220 + (g.innate || 1) * 0.02, 0.40, 0.86);
        g.pendingLevyChance = null;
        if (optionId === 'ill') {
          g.marriageDebt = (g.marriageDebt || 0) + 1;
          if ((g.marriageDebt || 0) >= 3) {
            g.marriageBroken = true;
            g.sectPatron = null;
            U.printlog(s + '的传讯石冷了。第三次称病之后，他们把婚书退了回来，只附一句「不必再来」');
            return;
          }
          U.printlog(s + '的传讯石冷了下去。你没去。从此他们看你的眼神里多了一层「原来如此」');
          return;
        }
        if (Math.random() < p) {
          var c = U.cultPct(g, 0.04, 0.08, 900);
          U.printlog('你替' + s + '挡下对家第一波冲击，血洗山门前的谷口。' +
            '岳家从此拿你当自己人，实力+' + c);
          return;
        }
        var h = U.hurt(g, 40, 120);
        U.printlog(s + '把你推到最前面。两座圣地的杀阵对撞，' +
          (h.loss ? '你险些被撕开，寿元 -' + h.loss : '你咬着牙撑了下来') +
          '。回来时，洞府里那匣圣药还摆在原处');
      }
    },
    {
      id: 'wld_marriage_kin', weight: 1.3, maxCount: 2,
      name: '姻亲有难', tier: 3, tag: 'sect',
      desc: '婚书另一头的人，被人堵在祖地',
      minAge: 30, maxAge: 10000,
      available: function (g) {
        return !g.becameEmperor && marriageAlive(g) && g.lvl >= 41 && g.lvl < 100;
      },
      choice: function (g, U) {
        var s = marriedSect(g);
        var p = U.clamp(0.44 + (g.lvl || 1) / 240 + (g.innate || 1) * 0.018, 0.36, 0.84);
        g.pendingKinChance = p;
        return {
          lead: s + '祖地被围。传讯里只有一句：若你还认这门亲，今夜赶到',
          info: '驰援是拿自己填他们的缺口；不往则婚约当场作废。杀出重围胜算 ' + U.pct(p),
          note: '不往眼下最稳，但这门亲就此断了。',
          options: [
            { id: 'stay', label: '不往', desc: '保全自身，婚书作废', safe: true },
            { id: 'aid', label: '连夜驰援', desc: '杀入祖地，或与他们一同重伤', chance: p }
          ]
        };
      },
      resolve: function (g, U, optionId) {
        var s = marriedSect(g) || PICK(SECTS);
        var p = g.pendingKinChance != null ? g.pendingKinChance :
          U.clamp(0.44 + (g.lvl || 1) / 240 + (g.innate || 1) * 0.018, 0.36, 0.84);
        g.pendingKinChance = null;
        if (optionId === 'stay') {
          g.marriageBroken = true;
          g.sectPatron = null;
          U.printlog('你没有动身。三日后' + s + '派人送来被撕开的婚书，墨迹还是湿的');
          return;
        }
        if (Math.random() < p) {
          var c = U.cultPct(g, 0.05, 0.10, 1400);
          U.gainDao(g, U.irand(8, 18));
          U.printlog('你杀入' + s + '祖地，把围攻的人从山门上撕了下去。' +
            '他们没再叫你女婿，改口叫你自己人，实力+' + c);
          return;
        }
        var h = U.hurt(g, 55, 160);
        U.printlog('你赶到时祖地已破了一角。你把人救出来，自己却' +
          (h.loss ? '在杀阵里挨了一记，寿元 -' + h.loss : '险死还生') +
          '。' + s + '此后再不敢拿你当外人');
      }
    },
    {
      id: 'wld_marriage_ask', weight: 1.2, maxCount: 1,
      name: '岳家求援', tier: 3, tag: 'sect',
      desc: '当年招你的人，反过来求你坐镇',
      minAge: 80, maxAge: 12000,
      available: function (g) {
        return !g.becameEmperor && marriageAlive(g) && g.lvl >= 71 && g.lvl < 100;
      },
      choice: function (g, U) {
        var s = marriedSect(g);
        return {
          lead: '你已是一方巨擘。' + s + '太上长老再至，这次不是招婿，是求你坐镇山门三年',
          info: '出手则他们从此仰你鼻息；不管则这门亲再也热不起来',
          note: '不管眼下最稳，婚约会凉。',
          options: [
            { id: 'ignore', label: '让他们自己撑', desc: '不欠新账，旧亲渐冷', safe: true },
            { id: 'help', label: '去坐镇三年', desc: '圣地改口称你为倚仗' }
          ]
        };
      },
      resolve: function (g, U, optionId) {
        var s = marriedSect(g) || PICK(SECTS);
        if (optionId === 'ignore') {
          g.marriageBroken = true;
          g.sectPatron = null;
          U.printlog(s + '的老人在你洞府外站了很久。走时只留下一句「也是」。从此两边再无岁供，也再无征召');
          return;
        }
        var c = U.cultPct(g, 0.06, 0.11, 2200);
        U.gainDao(g, U.irand(12, 24));
        g.sectVassal = s;
        U.printlog('你在' + s + '山门坐了三年。从前供养你的人，如今见你要躬身。' +
          '香火愿力灌入道躯，实力+' + c);
      }
    },
    {
      id: 'wld_marriage_cold', weight: 1.8, maxCount: 3,
      name: '拒婚余波', tier: 2, tag: 'sect',
      desc: '当年那句「但愿你走得到」，他们当真来验',
      minAge: 18, maxAge: 7000,
      available: function (g) {
        return !g.becameEmperor && g.sectMarriage === 'refused' && g.lvl >= 21 && g.lvl <= 88;
      },
      choice: function (g, U) {
        var p = U.clamp(0.46 + (g.lvl || 1) / 200 + (g.innate || 1) * 0.02, 0.38, 0.84);
        g.pendingColdChance = p;
        var s = PICK(SECTS);
        g.pendingColdSect = s;
        return {
          lead: s + '封了你要走的那条秘境。山门执事拦在路口，说「当年那位长老让我们看看，你到底走没走得到」',
          info: '硬闯能争一口气，也可能被他们当众折辱。硬闯胜算 ' + U.pct(p),
          note: '绕道眼下最稳，只是机缘让给别人。',
          options: [
            { id: 'avoid', label: '绕道走', desc: '不跟圣地撕破脸，错过这处机缘', safe: true },
            { id: 'face', label: '硬闯秘境', desc: '当场验道，成则得机缘', chance: p }
          ]
        };
      },
      resolve: function (g, U, optionId) {
        var s = g.pendingColdSect || PICK(SECTS);
        var p = g.pendingColdChance != null ? g.pendingColdChance :
          U.clamp(0.46 + (g.lvl || 1) / 200 + (g.innate || 1) * 0.02, 0.38, 0.84);
        g.pendingColdChance = null;
        g.pendingColdSect = null;
        if (optionId === 'avoid') {
          U.printlog('你没跟' + s + '的执事争。绕路那天，秘境里的光亮了一夜，一颗都没落到你手里');
          return;
        }
        if (Math.random() < p) {
          var c = U.cultPct(g, 0.03, 0.06, 700);
          U.printlog('你当着' + s + '的面闯进去，把当年那句「走得到」还了回去。' +
            '执事没再拦，秘境里的机缘归你，实力+' + c);
          return;
        }
        var h = U.hurt(g, 28, 80);
        U.printlog(s + '的执事没动手，只把护山大阵偏了一线。你被震退三步，' +
          (h.loss ? '经脉隐隐作痛，寿元 -' + h.loss : '当场没伤到根本') +
          '。他们要的不是你的命，是让旁人看见你走不过去');
      }
    },
    {
      id: 'wld_sect_favor', weight: 2.8, maxCount: 3,
      name: '教主赏识', tier: 2, tag: 'sect',
      desc: '真正的大人物看了你一眼',
      minAge: 16, maxAge: 4000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 15 && g.lvl <= 88; },
      cond: function (g, U) {
        return Math.random() < 0.5 + Math.min(0.3, g.innate * 0.035 + (g.daoGift || 5) * 0.012);
      },
      choice: function (g, U) {
        var p = U.clamp(0.5 + Math.min(0.3, (g.innate || 1) * 0.035 + (g.daoGift || 5) * 0.012), 0.45, 0.88);
        g.pendingFavorChance = p;
        return {
          lead: PICK(SECTS) + '教主破例看了你一眼，似要召你入静室',
          info: '受其指点可省十年苦功，却也欠下一份山门人情',
          note: '独自离开无损；入室则看教主是否真点化你。',
          options: [
            { id: 'leave', label: '拱手退去，自己走', desc: '不欠人情，只得一句随口点拨', safe: true },
            { id: 'enter', label: '入静室受其指点', desc: '成则经脉通畅、法门开窍', chance: p }
          ]
        };
      },
      resolve: function (g, U, optionId, log) {
        var p = g.pendingFavorChance != null ? g.pendingFavorChance :
          U.clamp(0.5 + Math.min(0.3, (g.innate || 1) * 0.035 + (g.daoGift || 5) * 0.012), 0.45, 0.88);
        g.pendingFavorChance = null;
        if (optionId === 'leave') {
          var c0 = U.cultPct(g, 0.008, 0.02, 200);
          U.printlog(PICK(SECTS) + '教主只在人群里看了你一眼便移开目光，' +
            '却也随口点出你法门中的一处死结。你回去闭关半年，实力+' + c0);
          return;
        }
        if (Math.random() < p) {
          var s = PICK(SECTS);
          var c = U.cultPct(g, 0.03, 0.05, 600);
          U.gainDao(g, U.irand(3, 6));
          g.sectPatron = s;
          U.printlog(s + '教主破例召你入静室，为你梳理经脉、指点法门要害。' +
            '一夜之间抵得上苦修十年，实力+' + c);
          if (Math.random() < 0.35) U.up(g, 1, log);
          return;
        }
        var c1 = U.cultPct(g, 0.008, 0.02, 200);
        U.printlog(PICK(SECTS) + '教主只在人群里看了你一眼便移开目光，' +
          '却也随口点出你法门中的一处死结。你回去闭关半年，实力+' + c1);
      },
      ok: function (g, U, log) {
        var s = PICK(SECTS);
        var c = U.cultPct(g, 0.03, 0.05, 600);
        U.gainDao(g, U.irand(3, 6));
        g.sectPatron = s;
        U.printlog(s + '教主破例召你入静室，为你梳理经脉、指点法门要害。' +
          '一夜之间抵得上苦修十年，实力+' + c);
        if (Math.random() < 0.35) U.up(g, 1, log);
      },
      fail: function (g, U) {
        var c = U.cultPct(g, 0.008, 0.02, 200);
        U.printlog(PICK(SECTS) + '教主只在人群里看了你一眼便移开目光，' +
          '却也随口点出你法门中的一处死结。你回去闭关半年，实力+' + c);
      }
    },
    {
      id: 'wld_sect_strife', weight: 1.4, maxCount: 3,
      name: '势力倾轧', tier: 3, tag: 'sect',
      desc: '山门之内的刀，往往比山外的快',
      minAge: 18, maxAge: 5000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 11 && g.lvl <= 90; },
      cond: function (g, U) {
        return Math.random() < U.clamp(0.5 + g.lvl / 260 + ((g.daoGift || 5) - 5) * 0.02, 0.3, 0.85);
      },
      ok: function (g, U) {
        var a = marriedSect(g) || PICK(SECTS), b = PICK(SECTS);
        if (b === a) b = PICK(SECTS);
        var c = U.cultPct(g, 0.05, 0.10, 1600);
        U.gainDao(g, U.irand(10, 22));
        U.printlog(marriageAlive(g)
          ? a + '与' + b + '争夺一条灵脉，岳家点名要你这位女婿下场。你两头周旋，最后灵脉分了三成给你，实力+' + c
          : a + '与' + b + '争夺一条灵脉，把你也卷了进去。你两头周旋，最后灵脉分了三成给你，实力+' + c);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 50, 140);
        U.printlog('势力倾轧中你被人当作弃子推出去挡刀，' +
          (h.loss ? '重伤而归，寿元 -' + h.loss : '所幸没吃大亏') +
          '。你记下了每一张笑脸');
      }
    },
    {
      id: 'wld_sect_outcast', weight: 1.3, maxCount: 2,
      name: '视为弃子', tier: 3, tag: 'sect',
      desc: '养你的人，第一个放弃你',
      minAge: 18, maxAge: 5000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 11 && g.lvl <= 90; },
      cond: function (g, U) {
        return Math.random() < U.clamp(0.42 + ((g.daoGift || 5) - 4) * 0.04 + g.innate * 0.02, 0.25, 0.8);
      },
      ok: function (g, U) {
        var wed = marriageAlive(g);
        var s = marriedSect(g) || g.sectPatron || PICK(SECTS);
        var c = U.cultPct(g, 0.05, 0.10, 1500);
        U.gainDao(g, U.irand(12, 26));
        U.printlog(wed
          ? s + '把婚书退回，说「女婿若无前途，便不必占着圣女的位子」。你在山门外站了一夜，把这门亲连同心里那点依靠一起斩了，实力+' + c
          : s + '将你除名逐出，理由是「资源不该浪费在没有前途的人身上」。你在山门外站了一夜，转身走时反而把心里最后一点依靠也斩了，实力+' + c);
        g.sectPatron = null;
        g.sectOutcast = true;
        if (wed) g.marriageBroken = true;
      },
      fail: function (g, U) {
        var wed = marriageAlive(g);
        var h = U.hurt(g, 40, 120);
        g.sectPatron = null;
        g.sectOutcast = true;
        if (wed) g.marriageBroken = true;
        U.printlog(wed
          ? '岳家连婚书带随身法器一并收走。' + (h.loss ? '押送的执事废了你半条经脉，寿元 -' + h.loss : '你什么也没带走') + '，这门亲到此为止'
          : '你被逐出山门，连随身法器也被收缴。' + (h.loss ? '押送的执事顺手废了你半条经脉，寿元 -' + h.loss : '你什么也没带走') + '，从此在荒野里独自求活');
      }
    },
    {
      id: 'wld_sect_rule', weight: 1.2, maxCount: 2,
      name: '执掌一方', tier: 3, tag: 'sect',
      desc: '你被推上了那把椅子',
      minAge: 40, maxAge: 8000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 61 && g.lvl < 100; },
      cond: function (g, U) {
        return Math.random() < U.clamp(0.5 + g.lvl / 300 + (U.isHighDaoyun(g) ? 0.12 : 0), 0.3, 0.88);
      },
      ok: function (g, U) {
        var s = PICK(SECTS);
        var c = U.cultPct(g, 0.06, 0.12, 2200);
        U.gainDao(g, U.irand(12, 26));
        var lf = U.gainLife(g, 60, 200);
        g.rulingSect = s;
        U.printlog('你接过' + s + '的掌教之位，一言可决数十万修士生死。' +
          '万人朝拜的香火愿力汇入道躯，实力+' + c + (lf ? '，寿元+' + lf : ''));
      },
      fail: function (g, U) {
        var h = U.hurt(g, 50, 150);
        U.printlog('执掌一方谈何容易——旧势力在你接位当日发难，' +
          (h.loss ? '你血洗宗门才坐稳位子，寿元 -' + h.loss :
            '你以雷霆手段镇下叛乱，未损根本') + '，此后再无人敢直视你');
      }
    },
    {
      id: 'wld_sect_massacre', weight: 0.9, maxCount: 1,
      name: '圣地灭门之祸', tier: 3, tag: 'sect',
      desc: '传承万载的圣地，一夜之间除名',
      minAge: 30, maxAge: 9000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 41 && g.lvl < 100; },
      cond: function (g, U) {
        return Math.random() < U.clamp(0.45 + U.currentCombatPower(g) / 500000, 0.25, 0.82);
      },
      ok: function (g, U, log) {
        var wed = marriageAlive(g);
        var s = wed ? marriedSect(g) : PICK(SECTS);
        var c = U.cultPct(g, 0.07, 0.13, 2600);
        U.gainDao(g, U.irand(14, 30));
        U.printlog(wed
          ? '数方势力围攻你的岳家' + s + '。山门崩塌时你杀进去，把最后一脉血裔救了出来，也从残破护山大阵里悟得半篇' + PICK(T3_GONG) + '，实力+' + c
          : '数方势力围攻' + s + '，山门崩塌、血流成河。你在乱军中救下最后一脉血裔，也从残破的护山大阵中悟得半篇' + PICK(T3_GONG) + '，实力+' + c);
        if (g.swallowingArt && Math.random() < 0.4) U.trySwallowPhysique(g, log);
      },
      fail: function (g, U) {
        var wed = marriageAlive(g);
        var s = wed ? marriedSect(g) : PICK(SECTS);
        var h = U.hurt(g, 60, 180);
        if (wed) {
          g.marriageBroken = true;
          g.sectPatron = null;
        }
        U.printlog(wed
          ? '你赶到时岳家' + s + '已成焦土。婚书另一头的人连完整尸首都没有。' +
            (h.loss ? '残留杀阵扫过，寿元 -' + h.loss : '你在灰烬里站了三天') + '，这门亲随山门一起没了'
          : '你赶到时' + s + '已成焦土，连一具完整的尸首都找不出来。' +
            (h.loss ? '残留的杀阵余威扫过，寿元 -' + h.loss : '你在灰烬里站了三天，只带走了一块断碑'));
      }
    },
    {
      id: 'wld_clan_slumber', weight: 0.8, maxCount: 1,
      name: '古族自封', tier: 3, tag: 'sect',
      desc: '有些血脉宁可睡过一个时代',
      minAge: 40, maxAge: 9000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 51 && g.lvl < 100; },
      cond: function (g, U) { return Math.random() < 0.6; },
      ok: function (g, U) {
        var s = PICK(SECTS);
        var c = U.cultPct(g, 0.06, 0.11, 2000);
        U.gainDao(g, U.irand(16, 32));
        U.printlog(s + '举族自封于祖地，以血脉为锁沉眠，只待来日大世。' +
          '临封前族老将一卷族史交到你手上，其中记着' + PICK(AGES) + '的旧事，实力+' + c);
      },
      fail: function (g, U) {
        U.gainDao(g, U.irand(8, 16));
        U.printlog('你赶到' + PICK(SECTS) + '祖地时，最后一道封印刚刚落下。' +
          '厚重石门后传来悠长的呼吸声，你隔门坐了很久，只悟到一点「等」字的意味');
      }
    },

    /* ================================================================
     * C · 时代与世界大势（8）
     * ================================================================ */

    {
      id: 'wld_era_barren', weight: 4, maxCount: 6,
      name: '资源枯竭', tier: 1, tag: 'era',
      desc: '平常时代，天地灵机一年薄过一年',
      minAge: 10, maxAge: 9000,
      available: function (g) { return !g.becameEmperor && eraIs(g, 'normal'); },
      cond: function (g, U) { return Math.random() < 0.5; },
      ok: function (g, U) {
        var c = U.cultPct(g, 0.004, 0.010, 90);
        U.printlog('平常时代灵机稀薄，一株' + PICK(T3_HERB) + '级的宝材几百年才出一枚。' +
          '你走遍' + PICK(REGIONS) + '，靠着零碎所得硬生生凑出一炉药，实力+' + c);
      },
      fail: function (g, U) {
        U.printlog('这是个乏善可陈的时代：灵脉干涸，古地早被搜刮干净，' +
          '你奔波一年颗粒无收，只能回到蒲团上继续苦熬');
      }
    },
    {
      id: 'wld_era_dao_favor', weight: 3.5, maxCount: 4,
      name: '大道昌盛', tier: 1, tag: 'era',
      desc: '一位大帝证道之后，其道便成了显学',
      minAge: 10, maxAge: 9000,
      available: function (g) { return !g.becameEmperor && underEmperor(g); },
      cond: function (g, U) { return Math.random() < 0.55; },
      ok: function (g, U) {
        var c = U.cultPct(g, 0.005, 0.012, 120);
        U.printlog(emperorName(g) + '证道之后，其所修之道格外为天心所青睐，' +
          '天下同修此道者进境如飞。你旁参其皮毛，也沾了几分昌盛之气，实力+' + c);
      },
      fail: function (g, U) {
        U.printlog('举世都在追捧' + emperorName(g) + '之道，你试着改弦更张，' +
          '修了半年反倒把自己的根基修乱，只得又拆回来重走原路');
      }
    },
    {
      id: 'wld_era_chronicle', weight: 3.5, maxCount: 5,
      name: '纪元更替', tier: 1, tag: 'era',
      desc: '古碑上一行字，就是一个时代的坟',
      minAge: 10, maxAge: 9000,
      available: function (g) { return !g.becameEmperor; },
      cond: null,
      ok: function (g, U) {
        var era = eraPair();
        var c = U.cultPct(g, 0.004, 0.010, 90);
        U.printlog('你在' + PICK(REGIONS) + '读到一方风化的古碑：' +
          era.from + '万族争渡，至' + era.to + '而尽墨。碑文只剩最后一句——「后来者慎行」。' +
          '一时心神震动，实力+' + c);
      },
      fail: null
    },
    {
      id: 'wld_era_golden', weight: 3.0, maxCount: 5,
      name: '群雄并起', tier: 2, tag: 'era',
      desc: '黄金大世，天骄如过江之鲫',
      minAge: 12, maxAge: 9000,
      available: function (g) {
        return !g.becameEmperor && (eraIs(g, 'golden') || eraIs(g, 'prosperous'));
      },
      cond: function (g, U) {
        return Math.random() < U.clamp(0.45 + g.innate * 0.03 + g.lvl / 300, 0.3, 0.85);
      },
      ok: function (g, U, log) {
        var c = U.cultPct(g, 0.03, 0.05, 600);
        U.gainDao(g, U.irand(3, 6));
        U.printlog((g.era && g.era.name) + '群雄并起，一年之内连出七位圣体级的天骄。' +
          '你在' + PICK(REGIONS) + '连挑三人不败，声名鹊起，实力+' + c);
        if (g.swallowingArt && Math.random() < 0.45) U.trySwallowPhysique(g, log);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 20, 55);
        U.printlog('大世之中天骄辈出，你自以为已算一号人物，' +
          (h.loss ? '却被一名少年三招击落云端，寿元 -' + h.loss :
            '却在人群里连前十都排不进') + '。这一巴掌打得你彻夜难眠');
      }
    },
    {
      id: 'wld_star_invasion', weight: 1.5, maxCount: 3,
      name: '星空异族入侵', tier: 3, tag: 'era',
      desc: '古路那头来的东西，不讲人族的规矩',
      minAge: 16, maxAge: 9000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 21; },
      cond: function (g, U) {
        return Math.random() < U.clamp(0.42 + U.currentCombatPower(g) / 300000, 0.28, 0.85);
      },
      ok: function (g, U) {
        var c = U.cultPct(g, 0.05, 0.11, 1800);
        U.gainDao(g, U.irand(12, 26));
        var lf = U.gainLife(g, 60, 180);
        U.printlog('星空异族自' + PICK(REGIONS) + '破界而入，屠戮凡人城池。' +
          '你随人族联军死守三月，斩其先锋大将于城头，实力+' + c + (lf ? '，寿元+' + lf : ''));
      },
      fail: function (g, U) {
        var h = U.hurt(g, 50, 150);
        U.printlog('异族的血肉之躯远比想象中坚硬，你一刀砍在对方脊骨上竟卷了刃。' +
          (h.loss ? '溃退时被追出百里，寿元 -' + h.loss : '你舍了坐骑才逃出重围'));
      }
    },
    {
      id: 'wld_emperor_fade', weight: 3.4, maxCount: 3,
      name: '帝痕消散', tier: 2, tag: 'era',
      desc: '大帝已死，可他的道还压在天上',
      minAge: 20, maxAge: 9000,
      /* 当世帝刚坐化时讲「道痕未消」；无此局面时退化为参悟前代大帝的残余帝痕 */
      available: function (g) { return !g.becameEmperor && (underTrace(g) || g.lvl >= 61); },
      cond: function (g, U) { return Math.random() < 0.55; },
      ok: function (g, U) {
        var c = U.cultPct(g, 0.028, 0.05, 600);
        U.gainDao(g, U.irand(4, 6));
        U.printlog(underTrace(g) ?
          '那位大帝早已坐化，可他烙在天地间的帝道痕迹仍未散尽，举世无人能再证道。' +
            '你索性顺着这道残痕逆推其法，反倒看清了自己该走哪一步，实力+' + c :
          '你在' + PICK(REGIONS) + '寻到一段几乎散尽的古老帝痕，是某位大帝坐化后遗落的余韵。' +
            '你守着它枯坐半年，在它彻底消失前逆推出小半截路，实力+' + c);
      },
      fail: function (g, U) {
        U.printlog(underTrace(g) ?
          '抬头望天，能感到一层看不见的盖子仍压在世间——帝虽死，道痕未消，还要再等上万年。' +
            '你把心气按了下去，继续熬' :
          '那缕古帝残痕在你伸手触及的一瞬便散作流光。你只抓住一点余温，' +
            '却连它属于哪一个时代都判不出来');
      }
    },
    {
      id: 'wld_emperor_suppress', weight: 1.4, maxCount: 3,
      name: '大帝镇压万道', tier: 3, tag: 'era',
      desc: '天心有主，众生皆为臣',
      minAge: 40, maxAge: 9000,
      available: function (g) { return !g.becameEmperor && underEmperor(g) && g.lvl >= 71; },
      cond: function (g, U) {
        return Math.random() < U.clamp(0.4 + U.currentCombatPower(g) / 600000 +
          (U.isHighDaoyun(g) ? 0.12 : 0), 0.2, 0.8);
      },
      ok: function (g, U) {
        var c = U.cultPct(g, 0.06, 0.12, 2400);
        U.gainDao(g, U.irand(16, 34));
        U.printlog(emperorName(g) + '一念镇压万道，你每前进一步都像背着一座山。' +
          '你偏要在这层重压下推演己法——被压得越狠，道基反而锤得越死，实力+' + c);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 50, 140);
        U.printlog('你试图在' + emperorName(g) + '的道威下强行叩关，' +
          (h.loss ? '刚起念头便被一缕帝威扫落，道基倒退，寿元 -' + h.loss :
            '心神震荡之下及时收势') +
          '。天心有主之世，一切证道之路皆被堵死');
      }
    },
    {
      id: 'wld_road_reopen', weight: 1.2, maxCount: 2,
      name: '古路重开', tier: 3, tag: 'era',
      desc: '沉寂多年的帝路，又亮了',
      minAge: 60, maxAge: 9000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 61 && g.lvl < 100; },
      cond: function (g, U) {
        return Math.random() < U.clamp(0.45 + g.lvl / 250, 0.28, 0.85);
      },
      ok: function (g, U, log) {
        var c = U.cultPct(g, 0.06, 0.12, 2200);
        U.gainDao(g, U.irand(14, 30));
        U.printlog('沉寂了不知多少年的' + PICK(['星空古路第一段', '星空古路第二段', '星空古路第三段']) +
          '重新亮起，人族天骄闻讯尽出。你踏上古路第一段，' +
          '一路斩过去，走得比谁都靠前，实力+' + c);
        if (Math.random() < 0.4) U.up(g, 1, log);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 50, 140);
        U.printlog('古路重开，杀机也随之复苏。' +
          (h.loss ? '你在第一段便撞上护路古阵，被打回起点，寿元 -' + h.loss :
            '你在路口感到一股熟悉的死气，果断折返'));
      }
    },

    /* ================================================================
     * D · 禁区与黑暗动乱（6）
     * ================================================================ */

    {
      id: 'wld_blood_rain', weight: 3.5, maxCount: 5,
      name: '血雨腥风', tier: 1, tag: 'forbidden',
      desc: '天降血雨，必有大事',
      minAge: 10, maxAge: 9000,
      available: function (g) { return !g.becameEmperor; },
      cond: function (g, U) { return Math.random() < 0.55; },
      ok: function (g, U) {
        var c = U.cultPct(g, 0.005, 0.012, 120);
        U.printlog('连下七日血雨，' + PICK(REGIONS) + '的走兽尽数伏地不敢动。' +
          '你在血雨中静坐，从那股腥气里辨出了一丝极古老的死意，实力+' + c);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 6, 20);
        U.printlog(h.exempt ? '血雨落身即化，你避入洞府，未受侵蚀' :
          '血雨带着蚀骨的怨气，你回来时皮肉尽赤，寿元 -' + h.loss);
      }
    },
    {
      id: 'wld_dark_omen', weight: 3.0, maxCount: 5,
      name: '动乱前兆', tier: 1, tag: 'forbidden',
      desc: '老人说，上一次这样是很久以前了',
      minAge: 10, maxAge: 9000,
      available: function (g) { return !g.becameEmperor; },
      cond: null,
      ok: function (g, U) {
        var c = U.cultPct(g, 0.004, 0.010, 90);
        U.printlog('星辰错位，古井生腥，' + PICK(SECTS) + '连夜闭山。' +
          '一位活了千年的老修士喃喃道：上一回见这景象，还是黑暗动乱之前。' +
          '你在惶惶之中反倒定住了心，实力+' + c);
      },
      fail: null
    },
    {
      id: 'wld_old_servant', weight: 2.5, maxCount: 4,
      name: '旧仆出没', tier: 2, tag: 'forbidden',
      desc: '禁区放出来的东西，早不是人了',
      minAge: 16, maxAge: 9000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 21; },
      cond: function (g, U) {
        return Math.random() < U.clamp(0.45 + U.currentCombatPower(g) / 260000 - karma(g) * 0.04, 0.25, 0.85);
      },
      ok: function (g, U) {
        var c = U.cultPct(g, 0.03, 0.05, 700);
        U.gainDao(g, U.irand(4, 6));
        U.printlog('一具披着腐烂道袍的禁区旧仆游荡至' + PICK(REGIONS) + '，所过之处生机绝灭。' +
          '你与之缠斗三日，斩落其一臂，从残躯里剜出半枚死气凝成的珠子，实力+' + c);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 25, 60);
        g.forbiddenKarma = karma(g) + 1;
        U.printlog('旧仆只抬了抬眼皮，你便觉神魂欲裂。' +
          (h.loss ? '你拼死遁走，寿元 -' + h.loss : '你舍了一件本命法器才脱身') +
          '。它记住了你的气息——血债+1');
      }
    },
    {
      id: 'wld_forbidden_edge', weight: 1.0, maxCount: 2,
      name: '生命禁区外围', tier: 3, tag: 'forbidden',
      desc: '再往里一步，就是死地',
      minAge: 60, maxAge: 9000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 71 && g.lvl < 100; },
      choice: function (g, U) {
        var deep = forbiddenDeepChance(g, U);
        return {
          lead: '你立在' + PICK(T4_MI) + '的边缘，脚下的白骨一直铺到雾里',
          info: '当前战力 ' + U.currentCombatPower(g) + ' · 与禁区已负血债 ' + karma(g) +
            ' · 深入把握 ' + U.pct(deep),
          note: '外围拾遗几乎没有风险，所得有限；深入雾中可得禁区法则真意，失败则被至尊余威绞杀。',
          options: [
            { id: 'back', label: '就此止步', desc: '记下地形便走，无得无失', safe: true },
            { id: 'edge', label: '外围拾遗', desc: '在白骨堆中翻检古修遗物', chance: 0.78 },
            { id: 'deep', label: '踏入雾中', desc: '成则悟得皇道法则一角，败则身陨',
              chance: U.allInFloor(deep, g, 600000),
              deathChance: U.deathOdds(U.allInFloor(deep, g, 600000), U.deathShare(g, 0.42, 600000)),
              risk: 'deadly' }
          ]
        };
      },
      resolve: function (g, U, optionId, log) {
        if (optionId === 'back') {
          U.printlog('你在白骨线前站了整整一夜，最终转身。' +
            '雾里有什么东西轻轻翻了个身——你走得很快，没有回头');
          return;
        }
        if (optionId === 'edge') {
          if (Math.random() < 0.78) {
            var c = U.cultPct(g, 0.05, 0.10, 1800);
            U.gainDao(g, U.irand(10, 22));
            U.printlog('你只在外围的白骨堆里翻检，寻得半截' + PICK(T3_BING) +
              '的残片与一枚锈死的道印，实力+' + c);
          } else {
            var h = U.hurt(g, 60, 170);
            U.printlog(h.loss ? '一具古修遗骸忽然睁眼，你斩断其头颅才脱身，寿元 -' + h.loss :
              '骨堆下有死气涌动，你及时退了出来');
          }
          return;
        }
        /* deep */
        var dOut = U.allIn(U.allInFloor(forbiddenDeepChance(g, U), g, 600000), U.deathShare(g, 0.42, 600000));
        if (dOut === 'win') {
          var cd = U.cultPct(g, 0.09, 0.14, 5000);
          U.gainDao(g, U.irand(24, 40));
          g.forbiddenKarma = karma(g) + 1;
          U.push(log, { cls: 'rare', text: '你在死雾深处触到一角皇道法则，那不属于任何活着的存在' });
          U.printlog('你自禁区外围的死雾中生还，带回一缕皇道法则的真意，实力+' + cd +
            '；深处有目光随你而出，血债+1');
        } else if (dOut === 'dead') {
          U.kill(g, '死雾之中有一声极轻的叹息。你连对方的形貌都没能看清，' +
            '道躯便自内而外化作了飞灰');
          g.deadCause = 'forbidden';
        } else {
          var hd = U.hurt(g, 120, 320);
          U.printlog(hd.loss ? '雾里那一瞥让你吐出一口黑血，你连滚带爬退回白骨线，寿元 -' + hd.loss :
            '你在死雾边缘收住了脚步，什么也没带出来');
        }
      }
    },
    {
      id: 'wld_supreme_whisper', weight: 0.9, maxCount: 2,
      name: '至尊低语', tier: 3, tag: 'forbidden',
      desc: '沉睡了一个纪元的东西，在跟你说话',
      minAge: 50, maxAge: 9000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 71 && g.lvl < 96; },
      cond: function (g, U) {
        return Math.random() < U.clamp(0.5 + (U.isHighDaoyun(g) ? 0.15 : 0) - karma(g) * 0.05, 0.25, 0.82);
      },
      ok: function (g, U) {
        U.gainDao(g, U.irand(18, 34));
        var c = U.cultPct(g, 0.04, 0.09, 1600);
        U.printlog('入定之时，一道横跨万古的声音落进你的识海，许你「不老不死」。' +
          '你一言不发地斩断了这缕神念——原来圣体身上的诅咒，正是从这里来的，实力+' + c);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 50, 150);
        g.forbiddenKarma = karma(g) + 1;
        U.printlog('那声音在你识海里盘桓了整整九日，' +
          (h.loss ? '待你醒来，鬓角已白，寿元 -' + h.loss : '你死死守住灵台，未被夺舍') +
          '。禁区深处记下了你——血债+1');
      }
    },
    {
      id: 'wld_supreme_claw', weight: 0.9, maxCount: 2,
      name: '至尊爪牙清算', tier: 3, tag: 'forbidden',
      desc: '欠禁区的账，是要还的',
      minAge: 60, maxAge: 9000,
      available: function (g) {
        return !g.becameEmperor && g.lvl >= 81 && g.lvl < 100 && karma(g) >= 1;
      },
      cond: function (g, U) {
        return Math.random() < U.clamp(0.55 + U.currentCombatPower(g) / 700000 - karma(g) * 0.07, 0.2, 0.85);
      },
      ok: function (g, U) {
        var c = U.cultPct(g, 0.07, 0.13, 3000);
        U.gainDao(g, U.irand(16, 32));
        g.forbiddenKarma = Math.max(0, karma(g) - 1);
        U.printlog('禁区遣下三名爪牙来取你性命，皆是当年跟着至尊自斩的老怪。' +
          '你在' + PICK(T3_MI) + '与之血战，尽数镇杀，把头颅挂在了古路口，实力+' + c +
          '；血债 -1');
      },
      fail: function (g, U) {
        var h = U.hurt(g, 80, 220);
        g.forbiddenKarma = karma(g) + 1;
        U.printlog('清算者来时天都黑了一半。' +
          (h.loss ? '你断了一臂才杀出重围，寿元 -' + h.loss :
            '你以秘法遁走千里，勉强保住性命') + '。这笔账越滚越大——血债+1');
      }
    },

    /* ================================================================
     * E · 传说级世界事件（6，全部 tier 4）
     * ================================================================ */

    {
      id: 'wld_dark_turmoil_war', weight: 0.35, maxCount: 1,
      name: '黑暗动乱爆发', tier: 4, tag: 'turmoil',
      desc: '禁区至尊倾巢而出，天下俱为薪柴',
      minAge: 200, maxAge: 100000,
      available: function (g) {
        return !g.becameEmperor && g.lvl >= 91 && g.cult >= 80000;
      },
      choice: function (g, U) {
        var win = turmoilWinChance(g, U);
        return {
          lead: '生命禁区尽数洞开，至尊亲临，星域之内亿万生灵化作精气飞卷而上',
          info: '你的战力 ' + U.currentCombatPower(g) + ' · 与禁区血债 ' + karma(g) +
            ' · 正面迎击至尊的胜算 ' + U.pct(win),
          note: '正面迎击若胜，可名震天下、道果暴涨；若败，当场身陨，无人收尸。随诸圣地据守多半能保住性命与一份功德。远遁避世毫无风险，也毫无所得。',
          options: [
            { id: 'flee', label: '远遁避世', desc: '躲进星海深处，无得无失', safe: true },
            { id: 'hold', label: '随诸圣地据守', desc: '守一方生民，收获有限但稳妥', chance: 0.7 },
            { id: 'fight', label: '正面迎击至尊', desc: '胜则名震天下、战力与道蕴暴涨；败则身陨',
              chance: U.allInFloor(win, g, 800000),
              deathChance: U.deathOdds(U.allInFloor(win, g, 800000), U.deathShare(g, 0.48, 800000)),
              risk: 'deadly' }
          ]
        };
      },
      resolve: function (g, U, optionId, log) {
        if (optionId === 'flee') {
          U.printlog('你把洞府沉进星海最深的暗礁里，闭死了所有感知。' +
            '不知过了多少年再睁眼时，外面的世界已经换了一茬人——你什么也没失去，也什么都没得到');
          return;
        }
        if (optionId === 'hold') {
          if (Math.random() < 0.7) {
            var c = U.cultPct(g, 0.12, 0.22, 12000);
            U.gainDao(g, U.irand(24, 45), 16);
            var lf = U.gainLife(g, 200, 500);
            U.printlog('你与诸圣地强者结阵死守' + PICK(REGIONS) + '，硬生生把至尊爪牙挡在界外三十年。' +
              '万民香火愿力汇聚，实力+' + c + (lf ? '，寿元+' + lf : ''));
          } else {
            var h = U.hurt(g, 200, 600);
            g.forbiddenKarma = karma(g) + 1;
            U.printlog('守阵被至尊一指点破，同阵者十去七八。' +
              (h.loss ? '你背着两名重伤的圣人杀出来，寿元 -' + h.loss :
                '你在阵破前一刻撕开虚空遁走') + '；至尊记住了你——血债+1');
          }
          return;
        }
        /* fight：梭哈 */
        var tOut = U.allIn(U.allInFloor(turmoilWinChance(g, U), g, 800000), U.deathShare(g, 0.48, 800000));
        if (tOut === 'win') {
          var cw = U.cultPct(g, 0.22, 0.30, 40000);
          U.gainDao(g, U.irand(45, 70), 32);
          var lw = U.gainLife(g, 400, 800);
          g.forbiddenKarma = Math.max(0, karma(g) - 1);
          g.slewSupreme = true;
          U.push(log, { cls: 'god', text: '你以一己之力将至尊打回了禁区，血染半边星空' });
          U.printlog('黑暗动乱因你而止。此战之后天下皆知你的名字，道果与杀伐尽入己身，' +
            '实力+' + cw + (lw ? '，寿元+' + lw : '') + '；禁区暂时不敢再来寻你');
          U.up(g, U.irand(1, 3), log);
        } else if (tOut === 'dead') {
          U.kill(g, '你迎着至尊的道威冲了上去，那一击照亮了整片星空。' +
            '天下人只看见你最后的身影，此后再无人见过你');
          g.deadCause = 'turmoil';
        } else {
          var ht = U.hurt(g, 280, 640);
          U.printlog(ht.loss ? '你没能挡住至尊那一击，被震出星域，捡回一条命，寿元 -' + ht.loss :
            '你在至尊抬手的一瞬收势遁走，两手空空');
        }
      }
    },
    {
      id: 'wld_holy_alliance', weight: 0.5, maxCount: 1,
      name: '诸圣地联手', tier: 4, tag: 'sect',
      desc: '互斗了万年的圣地，头一次坐到了一张桌上',
      minAge: 150, maxAge: 100000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 81 && g.lvl < 100; },
      cond: function (g, U) {
        return Math.random() < U.clamp(0.42 + U.currentCombatPower(g) / 800000 +
          (U.isHighDaoyun(g) ? 0.14 : 0), 0.25, 0.85);
      },
      ok: function (g, U, log) {
        var a = PICK(SECTS), b = PICK(SECTS), s = PICK(SECTS);
        var c = U.cultPct(g, 0.16, 0.26, 20000);
        U.gainDao(g, U.irand(30, 55), 20);
        var lf = U.gainLife(g, 200, 600);
        U.push(log, { cls: 'rare', text: a + '、' + b + '与' + s + '开启祖地禁库，共推你为盟首' });
        U.printlog('诸圣地为抗大劫结盟，把压箱底的圣兵与道经一并搬了出来。' +
          '你居中主持，遍观各家不传之秘，实力+' + c + (lf ? '，寿元+' + lf : ''));
        U.up(g, U.irand(1, 2), log);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 150, 400);
        U.printlog('联盟议事三日便谈崩了，各家忙着算计彼此的祖地禁库。' +
          (h.loss ? '你被推出去当探路的刀，重伤而归，寿元 -' + h.loss :
            '你冷眼看完这场戏，抽身而退'));
      }
    },
    {
      id: 'wld_dibing_starwar', weight: 0.4, maxCount: 1,
      name: '帝兵引发的星域大战', tier: 4, tag: 'world',
      desc: '一件极道帝兵出世，半个星域为之流血',
      minAge: 150, maxAge: 100000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 81 && g.lvl < 100; },
      choice: function (g, U) {
        var grab = diBingGrabChance(g, U);
        return {
          lead: '『' + PICK(T4_BING) + '』自混沌中出世，数尊老怪与三方圣地已在赶来的路上',
          info: '当前战力 ' + U.currentCombatPower(g) + ' · 正面争夺胜算 ' + U.pct(grab),
          note: '远远避开毫无损失。外围借帝兵道痕悟法收益中等且安全性尚可。出手争夺成功可得极道帝兵，失败当场身陨。',
          options: [
            { id: 'leave', label: '远远避开', desc: '不趟这摊浑水，无得无失', safe: true },
            { id: 'watch', label: '外围观道痕', desc: '借帝兵溢散的道痕悟法', chance: 0.72 },
            { id: 'grab', label: '出手争夺', desc: '成则得极道帝兵认主，败则身陨',
              chance: U.allInFloor(grab, g, 700000),
              deathChance: U.deathOdds(U.allInFloor(grab, g, 700000), U.deathShare(g, 0.45, 700000)),
              risk: 'deadly' }
          ]
        };
      },
      resolve: function (g, U, optionId, log) {
        if (optionId === 'leave') {
          U.printlog('你在千万里之外看着那片星空一次次亮起又暗下。' +
            '三个月后战火平息，谁也没能带走那件东西——你庆幸自己没去');
          return;
        }
        if (optionId === 'watch') {
          if (Math.random() < 0.72) {
            var c = U.cultPct(g, 0.12, 0.20, 14000);
            U.gainDao(g, U.irand(28, 50), 16);
            U.printlog('你伏在战场外围，只借帝兵溢散的道痕印证己法。' +
              '厮杀声中，你的经文反倒一页页补全了，实力+' + c);
          } else {
            var h = U.hurt(g, 200, 550);
            U.printlog(h.loss ? '一道帝兵余波横扫万里，你被殃及池鱼，寿元 -' + h.loss :
              '战场溃散得太快，你及时退出了余波范围');
          }
          return;
        }
        /* grab */
        var gOut = U.allIn(U.allInFloor(diBingGrabChance(g, U), g, 700000), U.deathShare(g, 0.45, 700000));
        if (gOut === 'win') {
          var b = PICK(T4_BING);
          g.gotDiBing = true;
          var cg = U.cultPct(g, 0.20, 0.30, 30000);
          U.gainDao(g, U.irand(40, 65), 28);
          U.push(log, { cls: 'god', text: '『' + b + '』震鸣三声，越过所有老怪，落入你手中' });
          U.printlog('你在尸山血海中抢出了这件极道帝兵。器灵认主的那一刻，' +
            '半个星域的强者都在看着你，实力+' + cg);
          U.up(g, U.irand(1, 3), log);
        } else if (gOut === 'dead') {
          U.kill(g, '你终究不是那些老怪的对手。帝兵光华闪过，你连同身后的星辰一起，' +
            '被抹成了虚无');
          g.deadCause = 'dibing_war';
        } else {
          var hg = U.hurt(g, 220, 560);
          U.printlog(hg.loss ? '帝兵光华擦着你的肩飞过，你吐着血退出战场，寿元 -' + hg.loss :
            '你在老怪围上来前收了手，什么也没抢到');
        }
      }
    },
    {
      id: 'wld_road_end_call', weight: 0.3, maxCount: 1,
      name: '古路尽头的召唤', tier: 4, tag: 'world',
      desc: '古路走到最后，有东西在等着',
      minAge: 300, maxAge: 100000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 91 && g.lvl < 100; },
      choice: function (g, U) {
        var go = roadEndChance(g, U);
        return {
          lead: '星空古路的尽头浮着一座无字石门，门后有什么在一遍遍呼唤你的名字',
          info: '当前战力 ' + U.currentCombatPower(g) + ' · 应召踏入的把握 ' + U.pct(go),
          note: '折返而归毫无损失。留下道痕观望可得一份感悟，安全性较高。应召踏入若能生还，所获远超帝路一切机缘；若不能，连尸骨都留不下。',
          options: [
            { id: 'back', label: '折返而归', desc: '记下方位便走，无得无失', safe: true },
            { id: 'mark', label: '留痕观望', desc: '以道痕试探门后，收获中等', chance: 0.68 },
            { id: 'enter', label: '应召踏入', desc: '生还则道果暴涨，失则形神俱灭',
              chance: U.allInFloor(go, g, 650000),
              deathChance: U.deathOdds(U.allInFloor(go, g, 650000), U.deathShare(g, 0.46, 650000)),
              risk: 'deadly' }
          ]
        };
      },
      resolve: function (g, U, optionId, log) {
        if (optionId === 'back') {
          U.printlog('你在石门前站了七年，最终把它的方位刻进了识海，然后转身沿古路走了回去。' +
            '身后的呼唤一直没有停');
          return;
        }
        if (optionId === 'mark') {
          if (Math.random() < 0.68) {
            var c = U.cultPct(g, 0.13, 0.22, 16000);
            U.gainDao(g, U.irand(30, 55), 20);
            U.printlog('你分出一缕道痕探入门缝。它没有回来，却在断开前送回了一段极古的画面——' +
              '万族列阵，向着更高处叩问。你以此重铸己道，实力+' + c);
          } else {
            var h = U.hurt(g, 200, 600);
            U.printlog(h.loss ? '道痕入门即被绞碎，反噬沿着神念烧回你的识海，寿元 -' + h.loss :
              '道痕刚触到门缝便自行溃散，你果断掐断了联系');
          }
          return;
        }
        /* enter */
        var eOut = U.allIn(U.allInFloor(roadEndChance(g, U), g, 650000), U.deathShare(g, 0.46, 650000));
        if (eOut === 'win') {
          var ce = U.cultPct(g, 0.20, 0.30, 32000);
          U.gainDao(g, U.irand(45, 70), 32);
          var lf = U.gainLife(g, 300, 800);
          g.roadEndInsight = true;
          U.push(log, { cls: 'god', text: '你推开石门，又从门里走了回来——身上多了些谁也说不清的东西' });
          U.printlog('门后是什么，你此后从未对人提起。只知你归来时道意通天，' +
            '实力+' + ce + (lf ? '，寿元+' + lf : '')); 
          U.up(g, U.irand(1, 3), log);
        } else if (eOut === 'dead') {
          U.kill(g, '你迈过了门槛。古路上的人只看到石门合拢，' +
            '此后无论谁再来，那扇门都不曾为任何人开过第二次');
          g.deadCause = 'road_end';
        } else {
          var he = U.hurt(g, 240, 600);
          U.printlog(he.loss ? '门缝里的那股力把你掀出古路，你在星空里漂了很久才醒，寿元 -' + he.loss :
            '你刚抬脚便被石门余威震退，没能踏进去');
        }
      }
    },
    {
      id: 'wld_shangcang_gaze', weight: 0.25, maxCount: 1,
      name: '上苍垂视', tier: 4, tag: 'world',
      desc: '传说仙域之上还有更高的东西，那东西看了一眼下面',
      minAge: 400, maxAge: 100000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 96 && g.lvl < 100; },
      cond: function (g, U) {
        return Math.random() < U.clamp(0.35 + (U.isHighDaoyun(g) ? 0.2 : 0) +
          U.currentCombatPower(g) / 1200000, 0.2, 0.75);
      },
      ok: function (g, U, log) {
        U.gainDao(g, U.irand(40, 68), 30);
        var c = U.cultPct(g, 0.14, 0.24, 18000);
        g.shangcangSeen = true;
        U.push(log, { cls: 'rainbow', text: '万古以来只在残卷里出现过的「上苍」二字，此刻真真切切地压在头顶' });
        U.printlog('那一瞬间，你连同整片星空都被某种目光笼罩。你既得不到坐标，也听不到言语，' +
          '只是本能地明白了自己站在多低的地方——道心因此被撑开了一大截，实力+' + c);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 200, 550);
        U.printlog(h.loss ? '那道目光只是掠过，你的准帝道躯便自行跪了下去，' +
          '强撑着不倒，寿元 -' + h.loss :
          '你在目光落下前伏身敛息，什么也没被看见，什么也没得到');
      }
    },
    {
      id: 'wld_emperor_edict', weight: 0.45, maxCount: 1,
      name: '大帝遗诏', tier: 4, tag: 'world',
      desc: '一位未曾留下名号的古之大帝，把话留给了后来人',
      minAge: 120, maxAge: 100000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 81 && g.lvl < 100; },
      cond: function (g, U) {
        return Math.random() < U.clamp(0.4 + (U.isHighDaoyun(g) ? 0.18 : 0) + g.lvl / 400, 0.25, 0.85);
      },
      ok: function (g, U, log) {
        var c = U.cultPct(g, 0.16, 0.27, 22000);
        U.gainDao(g, U.irand(38, 62), 26);
        var lf = U.gainLife(g, 250, 700);
        g.emperorEdict = true;
        U.push(log, { cls: 'rare', text: '古帝遗诏于' + PICK(T4_MI) + '中自行展开，只有寥寥数十字' });
        U.printlog('那位大帝没有留下名号，只留了一句话给后来者：路是走绝的，不是等来的。' +
          '数十字里蕴着他一世的道，你就此参悟数年，实力+' + c + (lf ? '，寿元+' + lf : ''));
        U.up(g, U.irand(1, 2), log);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 180, 480);
        U.printlog(h.loss ? '遗诏上的帝道文字太重，你只读了三个字便神魂欲裂，寿元 -' + h.loss :
          '你自知火候未到，恭敬合上遗诏，退了出来');
      }
    }
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = EVENTS;
  root.EVENT_PACK_WORLD = EVENTS;
})(typeof self !== 'undefined' ? self : this);
