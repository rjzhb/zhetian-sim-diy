/* ============================================================
 * 遮天模拟器 · 随机事件 · 核心包（早年修行、基础机缘、吞天路线、帝路骨架）
 * 素材池见 events-pools.js，聚合入口见 events.js
 *
 * 事件字段：
 *   id 唯一标识 / name 展示名 / tier 稀有度 1普通 2中级 3稀有 4传说
 *   weight 触发权重（各 tier 权重合计近似 70:20:8:2 → 全局 t1~70% t2~20% t3~8% t4~2%）
 *   minAge/maxAge 年龄区间（默认 0 / 10000）
 *   cond 触发条件 cond(g,U)->bool（false 则走 fail）
 *   ok/fail 成功/失败回调，返回文本或用 U.printlog
 *
 * U 工具：
 *   U.irand/U.rand/U.round  U.data(DATA)
 *   U.cultPct(g,minPct,maxPct,floor) 按当前实力百分比提升并返回提升值
 *   U.gainLife(g,lo,hi) 加寿元（不可超本境上限），返回实际增加
 *   U.hurt(g,lo,hi) 寿元受损惩罚（带化险为夷豁免，返回 {loss, exempt})
 *   U.up(g,n,log) 直接晋升 n 层（突破时触发生寿/寿元补足）逐层打印
 *   U.apt(g,n) 资质提升（≤10）
 *   U.kill(g,text) 直接身陨
 * ============================================================ */
(function (root) {
  var POOLS = typeof module !== 'undefined' && module.exports ? require('./events-pools.js') : root.EVENT_POOLS;
  var PICK = POOLS.PICK;
  var T4_BING = POOLS.T4_BING, T3_BING = POOLS.T3_BING;
  var T4_HERB = POOLS.T4_HERB, T3_HERB = POOLS.T3_HERB, T2_HERB = POOLS.T2_HERB;
  var T4_CHUAN = POOLS.T4_CHUAN, T3_GONG = POOLS.T3_GONG, T2_GONG = POOLS.T2_GONG;
  var T4_MI = POOLS.T4_MI, T3_MI = POOLS.T3_MI, T2_MI = POOLS.T2_MI;
  var lvNeed = POOLS.lvNeed;

  var EVENTS = [

    /* ===================== tier 4 传说 ===================== */
    {
      id: 'qiyishijie', weight: 1.0, maxCount: 1,
      name: '仙路残响', tier: 4, desc: '残破仙府中只余传闻，并无坐标',
      minAge: 80, maxAge: 1000000,
      cond: null,
      ok: function (g, U) {
        /* 奇异世界坐标、仙源与太初命石只在成帝后的帝者机缘里出现。 */
        U.printlog('在一座残破仙府中读到古代至尊残篇，只知仙域之外另有世界，却得不到任何坐标。');
      },
      fail: null
    },
    {
      id: 'dibing', weight: 0.35, maxCount: 2,
      name: '极道帝兵现世', tier: 4, hurt: 'grave', desc: '帝兵有灵，自择其主',
      minAge: 2000, maxAge: 1000000,
      cond: function (g, U) { return g.lvl >= lvNeed(g, U, 70); },
      ok: function (g, U, log) {
        var b = PICK(T4_BING);
        g.gotDiBing = true;   /* 获得过极道帝兵：证道判定隐藏 +5%（各只一次） */
        var c = U.cultPct(g, 0.12, 0.25, 3000);
        U.printlog('帝兵『' + b + '』自混沌中出世，光华万丈，竟认你为主！实力大增，+' + c);
        U.up(g, U.irand(2, 4), log);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 200, 500);
        U.printlog(h.exempt ? '帝兵出世引来禁区至尊大战，你侥幸脱身，有惊无险' : '卷入帝兵争夺大战，被余波重创，寿元 -' + h.loss);
      }
    },
    {
      id: 'dijing', weight: 0.35, maxCount: 1,
      name: '古之大帝传承', tier: 4, desc: '于极境中得见前贤烙印',
      minAge: 60, maxAge: 1000000,
      cond: function (g, U) { return g.lvl >= lvNeed(g, U, 72); },
      ok: function (g, U, log) {
        var cg = PICK(T4_CHUAN);
        var lf = U.gainLife(g, 200, 500);
        var up = U.apt(g, 1);
        U.printlog('得见' + cg + '，大道烙印映照心田' + (up ? '，体质蜕变、资质提升！' : '！') + (lf ? '寿元+' + lf : ''));
        if (cg === '狠人大帝传承') {
          g.gotRuthless = true;
          g.swallowingArt = true;
          U.printlog('传承深处藏有吞天魔功真意：若能熔炼万法、承受反噬，凡体亦可踏上化混沌之路');
        }
        var c = U.cultPct(g, 0.15, 0.3, 5000);
        U.printlog('传承入体，实力大幅精进，+' + c);
        U.up(g, U.irand(2, 4), log);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 150, 400);
        if (!h.exempt) U.printlog('传承烙印太过霸道，肉身难承其重，你当场昏厥，道基受创，寿元 -' + h.loss);
        else U.printlog('传承烙印太过霸道，你强行切断了感应，虽昏厥半晌，所幸无碍');
      }
    },
    {
      id: 'busiyao', weight: 0.25, maxCount: 1,
      name: '不死药出世', tier: 4, desc: '夺天地造化，可续一世之命',
      minAge: 3000, maxAge: 1000000,
      cond: function (g, U) { return g.lvl >= lvNeed(g, U, 55); },
      ok: function (g, U, log) {
        var hb = PICK(T4_HERB);
        var lf = U.gainLife(g, 300, 800);
        g.deathless = true;   /* 不死药：寿元将尽时可再活一世（仅一次） */
        U.printlog('于隐秘处寻得' + hb + '，药香满山，你将其精心封存' + (lf ? '，仅嗅其香便觉寿元+' + lf : ''));
        var c = U.cultPct(g, 0.08, 0.16, 2000);
        U.printlog('药力冲刷肉身，实力+' + c);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 300, 600);
        U.printlog(h.exempt ? '众强争夺不死药，你趁乱遁走，毫发无伤' : '卷入不死药争夺战，被老古董追杀重创，寿元 -' + h.loss);
      }
    },
    {
      id: 'jinmi', weight: 0.3, maxCount: 1,
      name: '无上禁区', tier: 4, desc: '凶险与机缘并存的生命禁区',
      minAge: 100, maxAge: 1000000,
      cond: function (g, U) { return g.lvl >= lvNeed(g, U, 78); },
      ok: function (g, U, log) {
        var mi = PICK(T4_MI);
        var lf = U.gainLife(g, 200, 600);
        U.printlog('于' + mi + '九死一生，夺天地秘藏而归' + (lf ? '，寿元+' + lf : ''));
        var c = U.cultPct(g, 0.1, 0.22, 3000);
        U.printlog('底蕴暴涨，实力+' + c);
        U.up(g, U.irand(1, 3), log);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 300, 800);
        U.printlog(h.exempt ? '误入' + (PICK(T4_MI)) + '，幸得秘宝护身，狼狈逃出生天' : '深入禁区遇险，九死一生，寿元 -' + h.loss);
      }
    },
    {
      id: 'heian', weight: 0.15, maxCount: 1,
      name: '黑暗动乱', tier: 4, desc: '禁区至尊出世，天地染血',
      minAge: 2500, maxAge: 1000000,
      available: function (g) {
        return !g.becameEmperor && g.lvl >= 75 && g.cult >= 75000;
      },
      cond: function (g, U) { return g.lvl >= U.irand(75, 85) && g.cult > U.rand(0.3, 0.8) * U.data.XINTIAN_NEED_MIN; },
      ok: function (g, U, log) {
        var lf = U.gainLife(g, 1000, 2000);
        U.printlog('黑暗动乱席卷，你力挽狂澜，镇杀禁区至尊爪牙，威震天下！' + (lf ? '收获众生愿力，寿元+' + lf : ''));
        var c = U.cultPct(g, 0.2, 0.4, 10000);
        U.printlog('于绝境中磨砺己身，实力暴涨，+' + c);
        U.up(g, U.irand(2, 5), log);
      },
      fail: function (g, U) {
        U.kill(g, '黑暗动乱降临，至尊收割众生，你未能幸免，身死道消');
      }
    },
    {
      id: 'dao_create_nine_secret', weight: 0.7, maxCount: 2,
      name: '自创九秘', tier: 4, desc: '不循前人旧路，于万道中开创盖世秘术',
      minAge: 120, maxAge: 10000,
      available: function (g, U) {
        return !g.becameEmperor && g.lvl >= 81 && U.isHighDaoyun(g) &&
          (g.createdNineSecrets || 0) < 2;
      },
      cond: function (g, U) {
        return U.isHighDaoyun(g) && Math.random() < Math.min(0.55, 0.16 + g.daoyun / U.data.DAO_ABSOLUTE_MAX * 0.32);
      },
      ok: function (g, U) {
        g.createdNineSecrets = (g.createdNineSecrets || 0) + 1;
        var c = U.cultPct(g, 0.10, 0.18, 12000);
        U.gainDao(g, U.irand(35, 65), 20);
        U.printlog('你不借古人遗泽，自万道变化中创出第' + g.createdNineSecrets +
          '式九秘级禁术，一念运转皆字秘般的极尽升华，实力+' + c);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 80, 220);
        U.printlog(h.loss ? '推演禁忌秘术时大道反噬，寿元 -' + h.loss :
          '禁忌法雏形崩散，你及时斩断推演，保住道基');
      }
    },
    {
      id: 'dao_create_swallowing', weight: 0.35, maxCount: 1,
      name: '自创吞天魔功', tier: 4, desc: '凡躯观万法本源，开创吞噬诸体的逆天魔功',
      minAge: 100, maxAge: 10000,
      available: function (g, U) {
        return !g.becameEmperor && !g.swallowingArt && g.innate <= 2 &&
          g.lvl >= 71 && U.isHighDaoyun(g);
      },
      cond: function (g, U) {
        return U.isHighDaoyun(g) && Math.random() < Math.min(0.28, 0.05 + g.daoyun / U.data.DAO_ABSOLUTE_MAX * 0.20);
      },
      ok: function (g, U) {
        g.swallowingArt = true;
        g.selfCreatedSwallowing = true;
        U.gainDao(g, U.irand(25, 45), 24);
        U.printlog('你以凡体推演诸般本源，竟自创吞天魔功！从此可吞噬特殊体质，但举世皆敌与反噬也将真正致命');
      },
      fail: function (g, U) {
        var h = U.hurt(g, 60, 180);
        U.printlog(h.loss ? '你欲以凡躯吞纳万道，功法雏形反噬，寿元 -' + h.loss :
          '吞天法雏形一闪即灭，你没有强行踏上魔路');
      }
    },
    {
      id: 'mythic_battlefield', weight: 0.75, maxCount: 2,
      name: '神话战场重开', tier: 4, tag: 'insight', desc: '古天庭战场自虚空浮现，帝阵与残兵共鸣',
      minAge: 300, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 81 && g.lvl < 100; },
      cond: function (g) { return g.cult >= 180000 || Math.random() < 0.30; },
      ok: function (g, U) {
        var c = U.cultPct(g, 0.12, 0.24, 18000);
        U.gainDao(g, U.irand(24, 44), 16);
        g.mythicMarks = (g.mythicMarks || 0) + 1;
        U.printlog('你穿过破碎帝阵，在神话战场中与古代烙印鏖战，道与法皆被逼至极境，实力+' + c);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 180, 520);
        U.printlog(h.loss ? '古帝杀阵复苏，你斩断半截道基逃出，寿元 -' + h.loss :
          '帝阵将要闭合时，你舍弃机缘全身而退');
      }
    },
    {
      id: 'chaos_thunder_pool', weight: 0.6, maxCount: 2,
      name: '混沌雷池', tier: 4, tag: 'insight', desc: '准帝劫深处浮现混沌雷池，生灭同源',
      minAge: 400, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 91 && g.lvl < 100; },
      cond: function (g, U) {
        return Math.random() < Math.min(0.75, 0.24 + g.cult / 1200000 + (U.isHighDaoyun(g) ? 0.16 : 0));
      },
      ok: function (g, U) {
        var c = U.cultPct(g, 0.15, 0.28, 26000);
        U.gainDao(g, U.irand(30, 55), 20);
        U.printlog('你踏入混沌雷池，以生灭雷液重铸准帝躯，大道雏形越发完整，实力+' + c);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 220, 650);
        U.printlog(h.loss ? '混沌雷霆劈裂道躯，你拖着残体冲出雷海，寿元 -' + h.loss :
          '雷池杀意超出预料，你没有贪取池中造化');
      }
    },
    {
      id: 'imperial_tomb_open', weight: 0.55, maxCount: 1,
      name: '帝坟夜开', tier: 4, tag: 'daomark', desc: '古帝陵寝短暂洞开，道痕与杀机同时苏醒',
      minAge: 180, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 81 && g.lvl < 100; },
      cond: function (g, U) { return g.cult >= 150000 || U.isHighDaoyun(g); },
      ok: function (g, U) {
        var c = U.cultPct(g, 0.09, 0.17, 14000);
        U.gainDao(g, U.irand(28, 48), 28);
        g.imperialTombInsight = true;
        U.printlog('你只观帝坟道痕，不取陪葬重器，由古帝残道反照己身，实力+' + c + '，道蕴上限增长');
      },
      fail: function (g, U) {
        var h = U.hurt(g, 140, 420);
        U.printlog(h.loss ? '帝坟杀念惊醒，你被一道帝痕扫中，寿元 -' + h.loss :
          '帝坟中传出心跳般的震动，你立刻退走');
      }
    },
    {
      id: 'forbidden_fragment', weight: 0.45, maxCount: 2,
      name: '禁区法则碎片', tier: 4, tag: 'daomark', desc: '禁区裂隙逸出一角皇道法则，可悟亦可引祸',
      minAge: 500, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 91 && g.lvl < 100; },
      cond: function (g, U) { return U.isHighDaoyun(g) || Math.random() < 0.25; },
      ok: function (g, U) {
        U.gainDao(g, U.irand(38, 70), 32);
        g.forbiddenKarma = (g.forbiddenKarma || 0) + 1;
        U.printlog('你炼化一角皇道法则，以他人极道反证自己的路；道蕴大涨，也被禁区至尊记住气息');
      },
      fail: function (g, U) {
        var h = U.hurt(g, 160, 480);
        U.printlog(h.loss ? '皇道碎片忽然化作杀念，斩去你部分寿元 -' + h.loss :
          '禁区深处有目光睁开，你放弃碎片遁入星海');
      }
    },
    {
      id: 'yibian', weight: 0.5, maxCount: 1,
      name: '体质异变', tier: 4, desc: '凡体沉寂，一朝破茧',
      minAge: 6, maxAge: 100,
      cond: function (g) { return g.innate <= 6; },
      ok: function (g, U, log) {
        var n = U.drawHighTalent(g);
        var lf = U.gainLife(g, 100, 200);
        U.printlog('沉寂多年的体质一朝异变，觉醒为『' + n.talent + '』！先天品阶跃升至第 ' + n.innate + ' 档' + (lf ? '，寿元+' + lf : ''));
        U.up(g, U.irand(1, 3), log);
      },
      fail: null
    },

    /* ===================== tier 3 稀有 ===================== */
    {
      id: 'dao_epiphany', weight: 1.6, maxCount: 8,
      name: '万道顿悟', tier: 3, desc: '积累深厚者偶见天地脉络，自然而然再进一步',
      minAge: 30, maxAge: 10000,
      available: function (g, U) {
        return !g.becameEmperor && g.lvl >= 41 && g.lvl < 100 && U.isHighDaoyun(g);
      },
      cond: null,
      ok: function (g, U) {
        var c = U.cultPct(g, 0.04, 0.08, 2200);
        U.gainDao(g, U.irand(16, 30), 8);
        U.printlog('你静观天地运转，万法脉络在心中自行铺开；一场悟道令旧有经文焕然一新，实力+' + c);
      },
      fail: null
    },
    {
      id: 'dao_create_scripture', weight: 1.35, maxCount: 6,
      name: '自创经文', tier: 3, desc: '道蕴充盈，不再照搬前人经义',
      minAge: 60, maxAge: 10000,
      available: function (g, U) {
        return !g.becameEmperor && g.lvl >= 61 && g.lvl < 100 && U.isHighDaoyun(g);
      },
      cond: null,
      ok: function (g, U) {
        var names = ['苦海卷', '四极篇', '化龙真解', '仙台古章', '星海经', '万道书'];
        var name = PICK(names);
        g.createdMethods = (g.createdMethods || 0) + 1;
        var c = U.cultPct(g, 0.05, 0.10, 3500);
        U.gainDao(g, U.irand(20, 36), 12);
        U.printlog('你删尽所学中的前人痕迹，自创『' + name + '』，这是只属于自己的第' +
          g.createdMethods + '门法，实力+' + c);
      },
      fail: null
    },
    {
      id: 'dao_companion_debate', weight: 1.1, maxCount: 4,
      name: '星空论道', tier: 3, desc: '与另一位近道者争论三年，胜负皆有所得',
      minAge: 80, maxAge: 10000,
      available: function (g, U) {
        return !g.becameEmperor && g.lvl >= 51 && g.lvl < 100 && U.isHighDaoyun(g);
      },
      cond: function (g) { return Math.random() < 0.62 + Math.min(0.20, (g.daoGift || 5) * 0.015); },
      ok: function (g, U) {
        U.gainDao(g, U.irand(24, 42), 12);
        U.printlog('你与一位星空奇才坐而论道三年，以自己的法驳尽对方经义，道心愈发澄明');
      },
      fail: function (g, U) {
        g.daoyun = Math.max(0, g.daoyun - U.irand(8, 20));
        U.printlog('对方提出的道问击中你经文缺口，你闭关数年重整体系，道蕴暂时受损');
      }
    },
    {
      id: 'ancient_road_ambush', weight: 1.2, maxCount: 3,
      name: '古路绝杀局', tier: 3, desc: '数位帝路天骄联手布阵，只为提前除掉强敌',
      minAge: 100, maxAge: 9000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 71 && g.lvl < 100; },
      cond: function (g, U) {
        return Math.random() < Math.min(0.82, 0.30 + g.cult / 700000 + (U.isHighDaoyun(g) ? 0.10 : 0));
      },
      ok: function (g, U) {
        var c = U.cultPct(g, 0.07, 0.14, 6000);
        U.gainDao(g, U.irand(12, 28));
        U.printlog('帝路群雄布下绝杀阵，你反借杀阵磨砺己道，逐一击溃围猎者，实力+' + c);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 100, 320);
        U.printlog(h.loss ? '你在古路绝杀局中血战脱身，寿元 -' + h.loss :
          '你提前看破阵纹，没有踏入群雄围猎之地');
      }
    },
    {
      id: 'star_sea_auction', weight: 1.15, maxCount: 3,
      name: '星海暗市', tier: 3, desc: '跨星域暗市开门，真宝与骗局混杂',
      minAge: 80, maxAge: 9000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 61 && g.lvl < 100; },
      cond: function () { return Math.random() < 0.62; },
      ok: function (g, U) {
        var gains = ['一卷圣贤手札', '一块悟道古玉', '一滴真龙髓', '半页准帝阵图'];
        var c = U.cultPct(g, 0.04, 0.09, 2800);
        U.gainDao(g, U.irand(10, 24), 8);
        U.printlog('你在星海暗市辨出真品，换得' + PICK(gains) + '，实力+' + c);
      },
      fail: function (g, U) {
        g.cult = Math.max(1, U.round(g.cult * 0.97));
        U.printlog('暗市卖家以古阵设局，你虽脱身，却损失大量修行资源，实力略降');
      }
    },
    {
      id: 'heavenly_omen', weight: 1.0, maxCount: 3,
      name: '天象争夺', tier: 3, desc: '九星连珠映出大道奇景，诸教强者齐聚',
      minAge: 50, maxAge: 9000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 51 && g.lvl < 100; },
      cond: function (g, U) {
        return Math.random() < Math.min(0.78, 0.38 + g.lvl / 250 + (U.isHighDaoyun(g) ? 0.10 : 0));
      },
      ok: function (g, U) {
        var c = U.cultPct(g, 0.05, 0.11, 4000);
        U.gainDao(g, U.irand(14, 30), 10);
        U.printlog('你在诸教争夺中占据天象中心，将九星道图烙入仙台，实力+' + c);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 60, 180);
        U.printlog(h.loss ? '争夺天象失败，你被数位教主围攻，寿元 -' + h.loss :
          '群雄杀意太盛，你只在外围观摩天象');
      }
    },
    {
      id: 'xingkong_gulu', weight: 0.9, maxCount: 2,
      name: '星空古路启程', tier: 3, desc: '横渡星域，与诸天人杰争渡',
      minAge: 80, maxAge: 8000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 71 && g.lvl < 100 && (g.roadSegment || 0) >= 1; },
      cond: function (g) { return !g.becameEmperor && g.lvl >= 71 && g.lvl < 100 && (g.roadSegment || 0) >= 1; },
      ok: function (g, U, log) {
        var c = U.cultPct(g, 0.05, 0.10, 1800);
        U.gainDao(g, U.irand(10, 20));
        U.printlog('踏上人族古路，横渡星域、连战诸天人杰，实力+' + c + '，悟道能力随之精进');
        if (g.swallowingArt && Math.random() < 0.55) U.trySwallowPhysique(g, log);
        U.up(g, 1, log);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 60, 180);
        U.printlog(h.exempt ? '古路杀机四伏，你审时度势退回故土' : '古路尚非你所能涉足，遭护道杀阵重创，寿元 -' + h.loss);
      }
    },
    {
      id: 'dilu_zhengfeng', weight: 0.65, maxCount: 2,
      name: '帝路群雄争锋', tier: 3, desc: '一世群雄并起，争夺唯一帝路',
      minAge: 300, maxAge: 8000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 81 && g.lvl < 100; },
      cond: function (g) { return !g.becameEmperor && g.lvl >= 81 && g.lvl < 100; },
      ok: function (g, U, log) {
        var c = U.cultPct(g, 0.07, 0.13, 3500);
        U.gainDao(g, U.irand(14, 24));
        U.printlog('与帝子级人杰鏖战数百合，于生死间验证己道，实力+' + c);
        if (g.swallowingArt && Math.random() < 0.6) U.trySwallowPhysique(g, log);
        U.up(g, 1, log);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 120, 320);
        U.printlog(h.exempt ? '群雄环伺，你没有贸然卷入帝路杀局' : '帝路争雄失利，道基受创，寿元 -' + h.loss);
      }
    },
    {
      id: 'quasi_heavenly_tribulation', weight: 0.55, maxCount: 3,
      name: '准帝九重天劫', tier: 3, tag: 'insight', desc: '每进一步，皆要在万道雷海中重塑己身',
      minAge: 400, maxAge: 8000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 91 && g.lvl < 100; },
      cond: function (g) { return !g.becameEmperor && g.lvl >= 91 && g.lvl < 100; },
      ok: function (g, U) {
        var c = U.cultPct(g, 0.06, 0.11, 5000);
        U.gainDao(g, U.irand(18, 30));
        g.quasiTribulations = (g.quasiTribulations || 0) + 1;
        U.printlog('渡过万道雷海，帝躯与大道雏形一并重塑，实力+' + c + '，悟道能力大进');
      },
      fail: function (g, U) {
        var h = U.hurt(g, 180, 480);
        U.printlog(h.exempt ? '天劫压境，你暂缓破关，未强行引动雷海' : '准帝天劫几乎磨灭道基，寿元 -' + h.loss);
      }
    },
    {
      id: 'forbidden_gaze', weight: 0.35, maxCount: 1,
      name: '禁区至尊注视', tier: 3, desc: '帝路将成，沉睡至尊隔着万古投来目光',
      minAge: 800, maxAge: 8000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 96 && g.lvl < 100; },
      cond: function (g) { return !g.becameEmperor && g.lvl >= 96 && g.lvl < 100; },
      ok: function (g, U) {
        U.gainDao(g, U.irand(16, 26));
        g.forbiddenKarma = (g.forbiddenKarma || 0) + 1;
        U.printlog('面对禁区深处的皇道威压，你不退半步，以准帝道则斩断窥视，也与至尊结下因果');
      },
      fail: function (g, U) {
        var h = U.hurt(g, 100, 260);
        U.printlog(h.exempt ? '至尊神念扫过星空，并未在你身上久留' : '一道皇道神念跨域压落，你强撑不跪，寿元 -' + h.loss);
      }
    },
    {
      id: 'shengbing', weight: 1.0, maxCount: 3,
      name: '圣兵择主', tier: 3, desc: '一件圣兵自封中苏醒',
      minAge: 30, maxAge: 1000000,
      cond: function (g, U) { return g.lvl >= lvNeed(g, U, 45); },
      ok: function (g, U, log) {
        var b = PICK(T3_BING);
        var c = U.cultPct(g, 0.07, 0.14, 1500);
        U.printlog('圣兵『' + b + '』有灵，甘愿追随于你，实力+' + c);
        var lf = U.gainLife(g, 100, 300);
        if (lf) U.printlog('圣兵蕴含的一缕神性淬炼肉身，寿元+' + lf);
        U.up(g, U.irand(1, 2), log);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 80, 200);
        U.printlog(h.exempt ? '圣兵难以收服，你果断退走，未受损伤' : '强行收服圣兵遭反噬，气血翻涌，寿元 -' + h.loss);
      }
    },
    {
      id: 'shengyao', weight: 0.9, maxCount: 3,
      name: '罕见圣药', tier: 3, desc: '药王吐瑞，机缘天降',
      minAge: 20, maxAge: 1000000,
      cond: null,
      ok: function (g, U, log) {
        var hb = PICK(T3_HERB);
        var lf = U.gainLife(g, 80, 200);
        var up = null;
        if (g.aptitude < 10) { up = U.apt(g, g.aptitude < 6 ? 2 : 1); }
        U.printlog('寻得' + hb + '，服之炼化' + (lf ? '，寿元+' + lf : '') + (up ? '，体魄蜕变、资质提升！' : '，实力略有精进'));
        var c = U.cultPct(g, 0.05, 0.1, 800);
        U.printlog('药力冲关，实力+' + c);
        U.up(g, U.irand(1, 2), log);
      },
      fail: null
    },
    {
      id: 'digong', weight: 1.0, maxCount: 3,
      name: '无上功法', tier: 3, desc: '残碑古道，偶得妙法',
      minAge: 20, maxAge: 1000000,
      cond: function (g, U) { return g.lvl >= lvNeed(g, U, 40); },
      ok: function (g, U, log) {
        var gf = PICK(T3_GONG);
        var up = null;
        if (g.aptitude < 10) up = U.apt(g, 1);
        U.printlog('参悟' + gf + '，茅塞顿开' + (up ? '，明悟己身、资质提升！' : ''));
        var c = U.cultPct(g, 0.05, 0.12, 1000);
        U.printlog('修为大进，实力+' + c);
        U.up(g, U.irand(1, 2), log);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 60, 150);
        U.printlog(h.exempt ? '参悟无果，只觉前路茫茫' : '强行参悟，气机紊乱，寿元 -' + h.loss);
      }
    },
    {
      id: 'sandi', weight: 1.0, maxCount: 2,
      name: '秘境探险', tier: 3, desc: '古地秘府，一步一凶',
      minAge: 30, maxAge: 1000000,
      cond: function (g, U) { return g.lvl >= lvNeed(g, U, 50); },
      ok: function (g, U, log) {
        var mi = PICK(T3_MI);
        var lf = U.gainLife(g, 80, 250);
        U.printlog('闯荡' + mi + '，斩妖夺宝，满载而归' + (lf ? '，寿元+' + lf : ''));
        var c = U.cultPct(g, 0.06, 0.13, 1000);
        U.printlog('经历生死，实力+' + c);
        U.up(g, U.irand(1, 2), log);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 100, 300);
        U.printlog(h.exempt ? '身陷' + (PICK(T3_MI)) + '险地，历尽艰险才得脱身' : '误入' + (PICK(T3_MI)) + '绝地，遭重创，寿元 -' + h.loss);
      }
    },
    {
      id: 'dayan', weight: 1.2, maxCount: 2,
      name: '问鼎论道', tier: 3, desc: '天下英杰汇聚，一较高下',
      minAge: 40, maxAge: 1000000,
      cond: function (g, U) { return g.lvl >= lvNeed(g, U, 55); },
      ok: function (g, U, log) {
        var c = U.cultPct(g, 0.05, 0.11, 1000);
        U.printlog('斩遍同代天骄，一战成名！实力+' + c);
        if (g.swallowingArt && Math.random() < 0.55) U.trySwallowPhysique(g, log);
        U.up(g, U.irand(1, 2), log);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 50, 130);
        U.printlog(h.exempt ? '惜败于一位天骄之手，你越挫越勇，心有所悟' : '被某位圣子圣女重创，负伤而归，寿元 -' + h.loss);
      }
    },
    {
      id: 'jiangdao', weight: 1.2, maxCount: 3,
      name: '圣人讲道', tier: 3, tag: 'insight', desc: '有幸旁听一位圣贤论道',
      minAge: 40, maxAge: 1000000,
      cond: function (g, U) { return g.lvl >= lvNeed(g, U, 45); },
      ok: function (g, U, log) {
        if (g.lvl >= 81) {
          /* 高境界遇低阶讲道：不再是听圣人说法，而是与道友论道印证 */
          var c2 = U.cultPct(g, 0.01, 0.03, 200);
          U.printlog('你已至' + U.DATA.realmOf(g.lvl) + '，与道友论道印证，举一反三，实力+' + c2);
          return;
        }
        var c = U.cultPct(g, 0.04, 0.09, 700);
        U.printlog('聆听圣贤讲道，如醍醐灌顶，实力+' + c);
        var lf = U.gainLife(g, 50, 150);
        if (lf) U.printlog('道韵洗礼心神，寿元+' + lf);
        U.up(g, 1, log);
      },
      fail: function (g, U) {
        U.printlog('圣贤道音如天宪，你只觉玄奥难明，唯记下些许残篇');
        var c = U.cultPct(g, 0.01, 0.02, 100);
        U.printlog('静坐参悟数月，实力+' + c);
      }
    },
    {
      id: 'dunwu3', weight: 1.2, maxCount: 3,
      name: '顿悟玄机', tier: 3, desc: '天心有感，一朝明悟',
      minAge: 20, maxAge: 1000000,
      cond: null,
      ok: function (g, U, log) {
        var c = U.cultPct(g, 0.04, 0.08, 600);
        var lf = U.gainLife(g, 40, 120);
        U.printlog('心湖澄澈，一朝顿悟！实力+' + c + (lf ? '，寿元+' + lf : ''));
        U.up(g, 1, log);
      },
      fail: null
    },

    /* ===================== tier 2 中级 ===================== */
    {
      id: 'yaochao', weight: 3, maxCount: 4,
      name: '凶兽大潮', tier: 2, desc: '黑潮汹涌，兽潮来袭',
      minAge: 20, maxAge: 1000000,
      cond: function (g, U) { return g.lvl >= lvNeed(g, U, 25); },
      ok: function (g, U) {
        var c = U.cultPct(g, 0.02, 0.045, 400);
        U.printlog('力战兽潮，斩大妖于阵前，实力+' + c);
        var lf = U.gainLife(g, 10, 40);
        if (lf) U.printlog('搏杀中气血愈发雄浑，寿元+' + lf);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 40, 120);
        U.printlog(h.exempt ? '兽潮汹涌，你血战脱身，生死间有了感悟' : '被凶兽潮淹没，重伤垂死，寿元 -' + h.loss);
      }
    },
    {
      id: 'paimai', weight: 3, maxCount: 4,
      name: '拍卖盛会', tier: 2, desc: '中州巨城，天材地宝云集',
      minAge: 30, maxAge: 1000000,
      cond: function (g, U) { return g.lvl >= lvNeed(g, U, 30); },
      ok: function (g, U) {
        var hb = PICK(T2_HERB);
        var c = U.cultPct(g, 0.02, 0.05, 300);
        U.printlog('拍得' + hb + '，炼化入体，实力+' + c);
        var lf = U.gainLife(g, 20, 60);
        if (lf) U.printlog('药力温养肉身，寿元+' + lf);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 20, 60);
        U.printlog(h.exempt ? '竞价失利，空手而归，却也长了不少见识' : '被有心人设局算计，破财消灾，寿元 -' + h.loss);
      }
    },
    {
      id: 'taigu', weight: 3, maxCount: 3,
      name: '上古遗迹', tier: 2, desc: '误入一座残破的上古遗迹',
      minAge: 15, maxAge: 1000000,
      cond: function (g, U) { return g.lvl >= lvNeed(g, U, 22); },
      ok: function (g, U) {
        var c = U.cultPct(g, 0.018, 0.042, 300);
        U.printlog('遗迹中大有所获，得到一部前人手札，实力+' + c);
        var lf = U.gainLife(g, 15, 50);
        if (lf) U.printlog('手札蕴含一缕先贤生机，寿元+' + lf);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 30, 90);
        U.printlog(h.exempt ? '遗迹机关凶险，你堪堪避过' : '触动上古禁制，被反震重伤，寿元 -' + h.loss);
      }
    },
    {
      id: 'shoutu', weight: 2.5, maxCount: 3,
      name: '长老青睐', tier: 2, desc: '一位大人物看中了你的资质',
      minAge: 20, maxAge: 1000000,
      cond: function (g, U) { return g.lvl >= lvNeed(g, U, 28); },
      ok: function (g, U, log) {
        if (g.lvl >= 81) {
          /* 高境界已无人敢收你为徒：改为同辈论道/后进请益 */
          var c2 = U.cultPct(g, 0.005, 0.015, 100);
          U.printlog('你已至' + U.DATA.realmOf(g.lvl) + '，众人慕名来访、聆听你的见解，你于讲论间亦有收获，实力+' + c2);
          return;
        }
        var up = null;
        if (g.aptitude < 10 && Math.random() < 0.4) up = U.apt(g, 1);
        U.printlog('一位古族长老收你为门徒，悉心指点' + (up ? '，你资质更上一层！' : ''));
        var c = U.cultPct(g, 0.02, 0.04, 300);
        U.printlog('得其真传，实力+' + c);
      },
      fail: function (g, U) {
        var c = U.cultPct(g, 0.005, 0.01, 60);
        U.printlog('长老虽未收徒，却提点你几句，实力+' + c);
      }
    },
    {
      id: 'cangu', weight: 2.5, maxCount: 3,
      name: '残缺古兵', tier: 2, desc: '古战场中捡到一件残破古兵',
      minAge: 20, maxAge: 1000000,
      cond: null,
      ok: function (g, U) {
        var c = U.cultPct(g, 0.02, 0.04, 300);
        U.printlog('从古兵残骸中悟得一丝杀伐真意，实力+' + c);
        var lf = U.gainLife(g, 10, 40);
        if (lf) U.printlog('杀气淬体，寿元+' + lf);
      },
      fail: null
    },
    {
      id: 'tunti_yiti', weight: 3.4, maxCount: 22,
      name: '异体天骄', tier: 2, desc: '遇上身怀特殊体质的同代或古族后裔',
      minAge: 12, maxAge: 1000000,
      available: function (g, U) {
        return !!(g.swallowingArt && g.physiqueId !== 'chaos' && U.nextSwallowTarget(g));
      },
      cond: function (g, U) {
        return !!(g.swallowingArt && g.physiqueId !== 'chaos' && U.nextSwallowTarget(g));
      },
      ok: function (g, U, log) {
        var c = U.cultPct(g, 0.012, 0.03, 160);
        U.printlog('对方身怀异体，你与之争锋，实力+' + c);
        U.trySwallowPhysique(g, log);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 12, 40);
        U.printlog(h.exempt ? '异体本源太烈，你及时收手，未敢强吞' : '强吞异体反噬己身，寿元 -' + h.loss);
      }
    },
    {
      id: 'jushi_jiedi', weight: 2.8, maxCount: 8,
      name: '举世皆敌', tier: 3, desc: '吞天血债爆发，圣地古族联手围杀',
      minAge: 16, maxAge: 1000000,
      available: function (g, U) {
        return !!(g.swallowingArt && U.swallowProgress(g).have >= 2);
      },
      cond: function (g, U) {
        return Math.random() < U.swallowSiegeSurviveChance(g);
      },
      ok: function (g, U) {
        var c = U.cultPct(g, 0.02, 0.05, 180);
        U.printlog('举世皆敌，圣地与古族联手围攻；你以所吞本源杀出重围，实力+' + c);
      },
      fail: function (g, U) {
        var kill = U.clamp(U.swallowSiegeDeathChance(g) * 5, 0.04, 0.72);
        if ((g.lvl || 1) >= 91) kill = Math.min(kill, 0.06);
        else if ((g.lvl || 1) >= 81) kill = Math.min(kill, 0.16);
        if (Math.random() < kill) {
          U.kill(g, '举世皆敌！圣地、古族与仇家联手围攻，你炼化他人本源的因果爆发，最终被围杀陨落');
          g.deadCause = 'swallow_siege';
          return;
        }
        var h = U.hurt(g, 80, 220);
        U.printlog(h.exempt ? '仇家围攻将成，你提前遁走，暂避血债' : '举世围攻中你险死还生，寿元 -' + h.loss);
      }
    },
    {
      id: 'tianjiao', weight: 1.4, maxCount: 1,
      name: '同辈争锋', tier: 2, tag: 'duel', desc: '遇上一位心高气傲的天骄',
      minAge: 15, maxAge: 1000000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 11 && g.lvl <= 85; },
      cond: function (g, U) { return g.lvl >= lvNeed(g, U, 25); },
      choice: function (g, U) {
        var p = U.clamp(0.36 + (g.lvl || 1) / 200 + (g.innate || 1) * 0.018, 0.32, 0.80);
        g.pendingDuelChance = p;
        return {
          lead: '一位同代天骄拦在路中，气势逼人，要与你分个高下',
          info: '接战可夺其气运；避其锋芒则无损，只是要被看轻一眼',
          note: '避开无风险；接战成败看境界与体质。',
          options: [
            { id: 'avoid', label: '避其锋芒，侧身让开', desc: '不战，记下这股气机', safe: true },
            { id: 'fight', label: '接战，当场分胜负', desc: '胜则夺气运，败则道心受挫', chance: p }
          ]
        };
      },
      resolve: function (g, U, optionId, log) {
        var p = g.pendingDuelChance != null ? g.pendingDuelChance :
          U.clamp(0.36 + (g.lvl || 1) / 200 + (g.innate || 1) * 0.018, 0.32, 0.80);
        g.pendingDuelChance = null;
        if (optionId === 'avoid') {
          U.printlog('你侧身让开，天骄冷笑一声离去。路还长，不必在这里把气机耗尽');
          return;
        }
        if (Math.random() < p) {
          var c = U.cultPct(g, 0.018, 0.04, 250);
          U.printlog('战胜天骄，夺其气运，实力+' + c);
          var lf = U.gainLife(g, 10, 30);
          if (lf) U.printlog('胜势养气，寿元+' + lf);
          if (g.swallowingArt && Math.random() < 0.5) U.trySwallowPhysique(g, log);
          return;
        }
        var h = U.hurt(g, 20, 70);
        U.printlog(h.exempt ? '落败于天骄之手，你知耻而后勇' : '被同辈天骄击败，道心受挫，寿元 -' + h.loss);
      },
      ok: function (g, U, log) {
        var c = U.cultPct(g, 0.018, 0.04, 250);
        U.printlog('战胜天骄，夺其气运，实力+' + c);
        var lf = U.gainLife(g, 10, 30);
        if (lf) U.printlog('胜势养气，寿元+' + lf);
        if (g.swallowingArt && Math.random() < 0.5) U.trySwallowPhysique(g, log);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 20, 70);
        U.printlog(h.exempt ? '落败于天骄之手，你知耻而后勇' : '被同辈天骄击败，道心受挫，寿元 -' + h.loss);
      }
    },
    {
      id: 'guyao', weight: 3, maxCount: 3,
      name: '古药园', tier: 2, desc: '一片隐世古药园映入眼帘',
      minAge: 15, maxAge: 1000000,
      cond: null,
      ok: function (g, U) {
        var hb = PICK(T2_HERB);
        var lf = U.gainLife(g, 15, 60);
        U.printlog('在古药园中采得' + hb + '，药香浸体' + (lf ? '，寿元+' + lf : ''));
        var c = U.cultPct(g, 0.015, 0.035, 200);
        U.printlog('炼化药力，实力+' + c);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 15, 50);
        U.printlog(h.exempt ? '药园有古兽守护，你惊险脱身' : '被守园古兽所伤，仓皇逃遁，寿元 -' + h.loss);
      }
    },

    /* ===================== tier 1 普通 ===================== */
    {
      id: 'lieshou', weight: 6, maxCount: 100,
      name: '猎杀凶兽', tier: 1, desc: '荒山野岭，磨砺己身',
      minAge: 12, maxAge: 1000000,
      cond: function (g, U) { return g.lvl >= lvNeed(g, U, 15); },
      ok: function (g, U) {
        var c = U.cultPct(g, 0.005, 0.012, 120);
        U.printlog('猎杀数头凶兽，以战养战，实力+' + c);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 8, 25);
        U.printlog(h.exempt ? '被凶兽反扑，你负伤而退，却愈发坚韧' : '险些被凶兽撕裂，寿元 -' + h.loss);
      }
    },
    {
      id: 'caiyao', weight: 5, maxCount: 30,
      name: '荒山采药', tier: 1, desc: '于灵秀之地采药',
      minAge: 10, maxAge: 1000000,
      cond: function (g, U) { return g.lvl >= lvNeed(g, U, 12); },
      ok: function (g, U) {
        var hb = PICK(T2_HERB);
        var lf = U.gainLife(g, 6, 20);
        U.printlog('采得' + hb + '，炼化入体' + (lf ? '，寿元+' + lf : ''));
        var c = U.cultPct(g, 0.003, 0.008, 60);
        U.printlog('实力+' + c);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 6, 18);
        U.printlog(h.exempt ? '采药时遇险，所幸有惊无险' : '遇袭受伤，寿元 -' + h.loss);
      }
    },
    {
      id: 'qieshuo', weight: 6, maxCount: 100,
      name: '同门切磋', tier: 1, desc: '与同辈印证所学',
      minAge: 12, maxAge: 1000000,
      cond: function (g, U) { return g.lvl >= lvNeed(g, U, 10); },
      ok: function (g, U) {
        var c = U.cultPct(g, 0.004, 0.009, 80);
        U.printlog('切磋胜出，印证所学，实力+' + c);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 5, 15);
        U.printlog(h.exempt ? '切磋落败，你反躬自省' : '切磋失手，受了些伤，寿元 -' + h.loss);
      }
    },
    {
      id: 'jingxiu', weight: 6, maxCount: 100,
      name: '静坐感悟', tier: 1, desc: '坐看云起，偶有所得',
      minAge: 0, maxAge: 1000000,
      cond: null,
      ok: function (g, U) {
        var c = U.cultPct(g, 0.003, 0.006, 50);
        U.printlog('静坐参道，忽有所悟，实力+' + c);
      },
      fail: null
    },
    {
      id: 'mobi', weight: 5, maxCount: 100,
      name: '古碑参悟', tier: 1, desc: '一方无名古碑，蕴含残意',
      minAge: 15, maxAge: 1000000,
      cond: null,
      ok: function (g, U) {
        var c = U.cultPct(g, 0.004, 0.009, 80);
        U.printlog('参悟无名古碑，得一丝前人残意，实力+' + c);
      },
      fail: null
    },
    {
      id: 'lingquan', weight: 4, maxCount: 20,
      name: '灵泉淬体', tier: 1, desc: '一泓灵泉，蕴含生气',
      minAge: 10, maxAge: 1000000,
      cond: null,
      ok: function (g, U) {
        var lf = U.gainLife(g, 5, 18);
        U.printlog('以灵泉淬体，洗去铅华' + (lf ? '，寿元+' + lf : ''));
        var c = U.cultPct(g, 0.003, 0.007, 60);
        U.printlog('实力+' + c);
      },
      fail: null
    },
    {
      id: 'xijun', weight: 5, maxCount: 50,
      name: '路遇袭扰', tier: 1, desc: '荒野行路，祸福难料',
      minAge: 12, maxAge: 1000000,
      cond: function (g, U) { return g.lvl >= lvNeed(g, U, 15); },
      ok: function (g, U) {
        var c = U.cultPct(g, 0.005, 0.011, 100);
        U.printlog('反杀拦路劫修，夺得些许资源，实力+' + c);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 8, 25);
        U.printlog(h.exempt ? '遇袭时你机敏脱身' : '遭劫修围攻负伤，寿元 -' + h.loss);
      }
    },
    {
      id: 'yinyu', weight: 4, maxCount: 30,
      name: '深山奇遇', tier: 1, desc: '云深不知处，或有遗珍',
      minAge: 12, maxAge: 1000000,
      cond: null,
      ok: function (g, U) {
        var hb = PICK(T2_HERB);
        var c = U.cultPct(g, 0.003, 0.008, 60);
        U.printlog('于深山中寻得' + hb + '，实力+' + c);
        var lf = U.gainLife(g, 4, 15);
        if (lf) U.printlog('服食灵药，寿元+' + lf);
      },
      fail: null
    },
    {
      id: 'jianghu', weight: 4, maxCount: 30,
      name: '路见不平', tier: 1, desc: '江湖恩怨，仗义出手',
      minAge: 16, maxAge: 1000000,
      cond: function (g, U) { return g.lvl >= lvNeed(g, U, 15); },
      ok: function (g, U) {
        var c = U.cultPct(g, 0.004, 0.009, 70);
        U.printlog('出手相救于人，结下一份善缘，实力+' + c);
        var lf = U.gainLife(g, 4, 12);
        if (lf) U.printlog('心境通明，寿元+' + lf);
      },
      fail: null
    },
    {
      id: 'tanbao', weight: 4, maxCount: 20,
      name: '坊市捡漏', tier: 1, desc: '闹市之中，鱼龙混杂',
      minAge: 12, maxAge: 1000000,
      cond: null,
      ok: function (g, U) {
        var c = U.cultPct(g, 0.003, 0.007, 60);
        U.printlog('于坊市中淘得一部残卷，获益匪浅，实力+' + c);
      },
      fail: null
    },
    {
      id: 'lianqi', weight: 4, maxCount: 40,
      name: '体魄磨砺', tier: 1, desc: '搬山锻体，以苦修行',
      minAge: 0, maxAge: 1000000,
      cond: null,
      ok: function (g, U) {
        var lf = U.gainLife(g, 3, 12);
        var c = U.cultPct(g, 0.002, 0.006, 40);
        U.printlog('苦修体魄，气血充盈' + (lf ? '，寿元+' + lf : '') + '，实力+' + c);
      },
      fail: null
    },
    {
      id: 'xinhui', weight: 4, maxCount: 40,
      name: '神游物外', tier: 1, desc: '一夜酣眠，梦中见道',
      minAge: 0, maxAge: 1000000,
      cond: null,
      ok: function (g, U) {
        var c = U.cultPct(g, 0.003, 0.006, 50);
        U.printlog('梦中神游天地，醒来若有所得，实力+' + c);
      },
      fail: null
    },
    {
      id: 'shilian', weight: 3, maxCount: 20,
      name: '师门试炼', tier: 1, desc: '族中设下试炼，考较后辈',
      minAge: 15, maxAge: 1000000,
      cond: function (g, U) { return g.lvl >= lvNeed(g, U, 12); },
      ok: function (g, U) {
        if (g.lvl >= 71) {
          /* 高境界已无需参加试炼：改为指点后辈，教学相长 */
          var c2 = U.cultPct(g, 0.003, 0.007, 60);
          U.printlog('你已至' + U.DATA.realmOf(g.lvl) + '，坐镇门中指点后辈试炼，教学相长，实力+' + c2);
          return;
        }
        var c = U.cultPct(g, 0.004, 0.009, 80);
        U.printlog('通过试炼，得到长辈嘉奖，实力+' + c);
        var lf = U.gainLife(g, 4, 15);
        if (lf) U.printlog('得赐灵药，寿元+' + lf);
      },
      fail: function (g, U) {
        U.printlog('试炼未过关，你知耻后勇，加倍苦修');
        var c = U.cultPct(g, 0.002, 0.004, 40);
        U.printlog('实力+' + c);
      }
    }
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = EVENTS;
  root.EVENT_PACK_CORE = EVENTS;
})(typeof self !== 'undefined' ? self : this);
