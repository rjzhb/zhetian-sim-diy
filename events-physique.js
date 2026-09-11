/* ============================================================
 * 遮天模拟器 · 随机事件 · 体质包
 * 体质 / 血脉 / 种族 / 肉身蜕变
 *
 * 分区：
 *   A 荒古圣体专线（苦海化金、血气冲霄、至尊诅咒、四极难关、大成极道）
 *   B 各体质专属机缘（按 g.physiqueId 分流，互不污染奖池）
 *   C 妖族 / 古族 / 圣灵 / 异族血脉
 *   D 凡体与低阶体质的逆袭（g.innate <= 3）
 *   E 传说级淬体机缘（含选择型豪赌）
 *
 * 素材池见 events-pools.js，字段契约见
 * docs/superpowers/specs/2026-09-10-event-authoring-contract.md
 * ============================================================ */
(function (root) {
  var POOLS = typeof module !== 'undefined' && module.exports ? require('./events-pools.js') : root.EVENT_POOLS;
  var PICK = POOLS.PICK, stage = POOLS.stage, lvNeed = POOLS.lvNeed;
  var T4_BING = POOLS.T4_BING, T3_BING = POOLS.T3_BING;
  var T4_HERB = POOLS.T4_HERB, T3_HERB = POOLS.T3_HERB, T2_HERB = POOLS.T2_HERB;
  var T3_GONG = POOLS.T3_GONG;
  var T4_MI = POOLS.T4_MI, T3_MI = POOLS.T3_MI, T2_MI = POOLS.T2_MI;
  var SECTS = POOLS.SECTS, REGIONS = POOLS.REGIONS, RIVAL_TITLES = POOLS.RIVAL_TITLES;

  /* 体质专属事件准入：必须同时卡住成帝与体质，否则会污染其他玩家的奖池 */
  function phys(id, min, max) {
    return function (g) {
      if (!g || g.becameEmperor) return false;
      if (g.physiqueId !== id) return false;
      if (min != null && g.lvl < min) return false;
      if (max != null && g.lvl > max) return false;
      return true;
    };
  }
  /* 凡体与低阶体质（1-3 档）专属 */
  function lowBody(maxLvl) {
    return function (g) {
      if (!g || g.becameEmperor) return false;
      if ((g.innate || 1) > 3) return false;
      if (maxLvl != null && g.lvl > maxLvl) return false;
      return true;
    };
  }
  /* 通用准入：未成帝且在境界区间内 */
  function open(min, max) {
    return function (g) {
      if (!g || g.becameEmperor) return false;
      if (min != null && g.lvl < min) return false;
      if (max != null && g.lvl > max) return false;
      return true;
    };
  }
  /* 荒古圣体所受的是禁区至尊按下的诅咒，不是天意；只可镇压，不可解除 */
  function curseSeal(g) { return g.sacredCurseSeal || 0; }
  function curseResist(g, U) {
    return U.clamp(0.34 + curseSeal(g) * 0.12 + g.lvl / 260 + (g.aptitude || 1) * 0.012, 0.30, 0.88);
  }
  /* 帝血入体的承受把握：肉身档次为主，战力为辅 */
  function dixueChance(g, U) {
    return U.clamp(0.13 + (g.innate || 1) * 0.028 + U.currentCombatPower(g) / 1400000, 0.12, 0.60);
  }
  /* 沉入混沌气旋的把握：肉身、道蕴、战力三者共同决定 */
  function chaosQiChance(g, U) {
    return U.clamp(0.10 + (g.innate || 1) * 0.030 +
      (g.daoyun || 0) / U.data.DAO_ABSOLUTE_MAX * 0.16 +
      U.currentCombatPower(g) / 1600000, 0.10, 0.56);
  }

  var EVENTS = [

    /* ===================== tier 4 传说 ===================== */
    {
      id: 'phy_dixue_cuiti', weight: 0.55, maxCount: 1,
      name: '帝血淬体', tier: 4, tag: 'refine',
      desc: '一滴古之大帝的精血封在龙纹黑金中，至今未凉',
      minAge: 40, maxAge: 10000,
      available: open(41, null),
      choice: function (g, U) {
        var full = dixueChance(g, U);
        var opts = [
          { id: 'seal', label: '原样封存，不敢妄动', desc: '无收益，无风险', safe: true },
          { id: 'drip', label: '引一缕血雾温养', desc: '成功：气血与肉身稳步精进', chance: 0.72 }
        ];
        /* 凡体在非吞天路线下不承担额外死亡惩罚，故不开放全滴入体的死局 */
        if ((g.innate || 1) >= 3 || g.swallowingArt) {
          var p = U.allInFloor(full, g, 400000);
          opts.push({
            id: 'full', label: '破金引全滴帝血入体',
            desc: '成功：肉身脱胎换骨，战力暴涨；失败多半当场炸体身死',
            chance: p, deathChance: U.deathOdds(p, U.deathShare(g, 0.50, 400000)), risk: 'deadly'
          });
        }
        return {
          lead: '你在一块龙纹黑金的封印中，寻到一滴万古不凝的大帝精血',
          info: '当前体质『' + g.physiqueName + '』· 全滴入体的承受把握 ' + U.pct(full),
          note: '封存无损；一缕血雾只是稳妥温养；全滴入体成则肉身直追古之圣者，败则血肉尽化金雾。',
          options: opts
        };
      },
      resolve: function (g, U, optionId, log) {
        if (optionId === 'seal') {
          U.printlog('你终究没敢揭开龙纹黑金的封印，只将那滴帝血贴身收好，权当留一线后路');
          return;
        }
        if (optionId === 'drip') {
          if (Math.random() < 0.72) {
            var c = U.cultPct(g, 0.10, 0.18, 6000);
            var lf = U.gainLife(g, 200, 480);
            U.gainDao(g, U.irand(22, 40), 12);
            U.printlog('你只放出一缕血雾，任其顺着毛孔渗入。周身骨骼如金铁鸣响，旧伤暗疾一并被烧尽，实力+' + c +
              (lf ? '，寿元+' + lf : ''));
            return;
          }
          var h1 = U.hurt(g, 200, 520);
          U.printlog(h1.exempt ? '血雾刚一沾体便如烈焰灼烧，你当机立断挥手震散，只是虚脱了几日' :
            '一缕血雾入体便如熔铁灌髓，你强行逼出时经脉尽断，闭死关百年，寿元 -' + h1.loss);
          return;
        }
        var pFull = U.allInFloor(dixueChance(g, U), g, 400000);
        var out = U.allIn(pFull, U.deathShare(g, 0.50, 400000));
        if (out === 'win') {
          var c2 = U.cultPct(g, 0.20, 0.30, 20000);
          var lf2 = U.gainLife(g, 400, 800);
          U.gainDao(g, U.irand(38, 62), 24);
          U.printlog('帝血入体，你在金色血焰中活活烧了三年，皮肉褪去一层又一层。再睁眼时血气如大海倒悬，实力+' + c2 +
            (lf2 ? '，寿元+' + lf2 : ''));
          if ((g.innate || 1) <= 5) {
            var n = U.drawHighTalent(g);
            U.push(log, { cls: 'god', text: '帝血洗去你一身凡骨，先天根基彻底重塑，觉醒为『' + n.talent + '』！' });
          }
          U.up(g, U.irand(1, 3), log);
          return;
        }
        if (out === 'dead') {
          U.kill(g, '帝血一入苦海便再不受控，你的血肉自内而外化作金雾，连一具尸骸都没能留下');
          return;
        }
        var h2 = U.hurt(g, 500, 800);
        U.printlog(h2.exempt ? '帝血炸开的刹那，护身之物替你挡下这一劫，你被掀飞出去却侥幸留命' :
          '帝血炸体，你斩去自己一条手臂才把血焰隔绝在外，道基崩去大半，寿元 -' + h2.loss);
      }
    },
    {
      id: 'phy_hundunqi_cuiti', weight: 0.45, maxCount: 1,
      name: '混沌气淬体', tier: 4, tag: 'refine',
      desc: '一道开天辟地般的混沌气旋横亘在星空裂隙中',
      minAge: 120, maxAge: 10000,
      available: open(61, null),
      choice: function (g, U) {
        var win = chaosQiChance(g, U);
        var opts = [
          { id: 'away', label: '绕道而行', desc: '无收益，无风险', safe: true },
          { id: 'edge', label: '在气旋外缘引一丝混沌气', desc: '成功：肉身与道基同步夯实', chance: 0.68 }
        ];
        if ((g.innate || 1) >= 3 || g.swallowingArt) {
          var p = U.allInFloor(win, g, 500000);
          opts.push({
            id: 'dive', label: '沉入气旋核心任其磨身',
            desc: '成功：肉身被万道重铸，战力与道蕴齐飞；失败被混沌气抹成虚无',
            chance: p, deathChance: U.deathOdds(p, U.deathShare(g, 0.50, 500000)), risk: 'deadly'
          });
        }
        return {
          lead: '星空裂隙中垂下一道混沌气旋，光与暗在其中反复生灭',
          info: '当前体质『' + g.physiqueName + '』· 沉入核心的存活把握 ' + U.pct(win),
          note: '混沌气能磨尽肉身杂质，也能把一尊大圣磨回虚无。外缘取气稳妥，核心磨身是拿命换造化。',
          options: opts
        };
      },
      resolve: function (g, U, optionId, log) {
        if (optionId === 'away') {
          U.printlog('你远远绕开那道气旋。混沌之力不辨敌我，你自认还没有拿命去赌的本钱');
          return;
        }
        if (optionId === 'edge') {
          if (Math.random() < 0.68) {
            var c = U.cultPct(g, 0.12, 0.20, 9000);
            var lf = U.gainLife(g, 220, 500);
            U.gainDao(g, U.irand(26, 44), 16);
            U.printlog('你在气旋外缘布下阵纹，牵出一丝混沌气缠绕四肢百骸。杂质如尘落地，实力+' + c +
              (lf ? '，寿元+' + lf : ''));
            return;
          }
          var h1 = U.hurt(g, 220, 560);
          U.printlog(h1.exempt ? '那一丝混沌气骤然暴动，你及时斩断阵纹，只被余波掀出星空' :
            '混沌气不认阵纹，倒卷回来磨去你半边肩背，血洒星海，寿元 -' + h1.loss);
          return;
        }
        var pDive = U.allInFloor(chaosQiChance(g, U), g, 500000);
        var outQi = U.allIn(pDive, U.deathShare(g, 0.50, 500000));
        if (outQi === 'win') {
          var c2 = U.cultPct(g, 0.18, 0.28, 24000);
          var lf2 = U.gainLife(g, 380, 760);
          U.gainDao(g, U.irand(40, 68), 28);
          U.printlog('你赤身沉入气旋核心。混沌气把你磨成一副骨架，又一寸寸重新生出血肉；那已不是原来的身体，实力+' + c2 +
            (lf2 ? '，寿元+' + lf2 : ''));
          U.up(g, U.irand(1, 3), log);
          return;
        }
        if (outQi === 'dead') {
          U.kill(g, '混沌气不问来历，你连惨叫都没能发出，从头颅到脚趾一寸寸被抹成虚无');
          return;
        }
        var h2 = U.hurt(g, 480, 800);
        U.printlog(h2.exempt ? '眼看半身将化虚无，随身圣兵自行飞出，硬生生把你从气旋里拽了回来' :
          '你在被彻底抹去前一刻逃出气旋，却永远失去了半只脚掌与大半修为，寿元 -' + h2.loss);
      }
    },
    {
      id: 'phy_busiyao_xisui', weight: 0.30, maxCount: 1,
      name: '不死药洗髓', tier: 4, tag: 'refine',
      desc: '不死药只能续一世之命，却足以把一具肉身洗到极致',
      minAge: 300, maxAge: 10000,
      available: open(71, null),
      cond: function (g, U) { return g.lvl >= lvNeed(g, U) - 6 || Math.random() < 0.45; },
      ok: function (g, U, log) {
        var hb = PICK(T4_HERB);
        var c = U.cultPct(g, 0.16, 0.26, 16000);
        var lf = U.gainLife(g, 400, 800);
        U.gainDao(g, U.irand(30, 55), 20);
        U.printlog('你以' + hb + '的一片药叶入药，洗髓伐骨七日七夜。褪下的污垢积了满池，肉身却通体莹白如玉，实力+' + c +
          (lf ? '，寿元+' + lf : ''));
        U.push(log, { cls: 'rare', text: '药力只是洗体，并未续命——不死药能给的那一世，你留着没用' });
        U.up(g, U.irand(1, 2), log);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 260, 620);
        U.printlog(h.exempt ? '药力太霸道，你只敢含着药叶不敢咽下，最终原样吐出' :
          '一片药叶下肚便如吞了座火山，药力横冲直撞，你几乎被自己的血气撑爆，寿元 -' + h.loss);
      }
    },
    {
      id: 'phy_huaxianchi_zhuoti', weight: 0.32, maxCount: 1,
      name: '化仙池濯体', tier: 4, tag: 'refine',
      desc: '池水能化血肉为仙，也能把人化成一滩血水',
      minAge: 200, maxAge: 10000,
      available: open(81, null),
      cond: function (g, U) {
        return Math.random() < U.clamp(0.28 + (g.innate || 1) * 0.035 + g.cult / 1400000, 0.25, 0.80);
      },
      ok: function (g, U, log) {
        var c = U.cultPct(g, 0.17, 0.27, 22000);
        var lf = U.gainLife(g, 350, 700);
        U.gainDao(g, U.irand(34, 58), 22);
        g.huaxianBath = (g.huaxianBath || 0) + 1;
        U.printlog('你踏入化仙池。池水一寸寸吞噬旧躯，又一寸寸还你一副新的；上岸时连呼吸都带着淡淡仙气，实力+' + c +
          (lf ? '，寿元+' + lf : ''));
        U.up(g, U.irand(1, 3), log);
      },
      fail: function (g, U) {
        /* 凡体在非吞天路线下不承担额外死亡惩罚，只会被池水濯去一层血肉 */
        if (((g.innate || 1) >= 3 || g.swallowingArt) && Math.random() < 0.18) {
          U.kill(g, '化仙池不认这具躯壳，你刚没过胸口便再无声息，池面只泛起一层薄薄血沫');
          return;
        }
        var h = U.hurt(g, 300, 700);
        U.printlog(h.exempt ? '刚入池半尺你便觉魂魄将散，当即翻身滚回岸上' :
          '你只在池中撑了三息，上岸时半边身子已化作血水，寿元 -' + h.loss);
      }
    },
    {
      id: 'phy_zhenlong_xuemai', weight: 0.35, maxCount: 1,
      name: '真龙血脉', tier: 4, tag: 'bloodline',
      desc: '一具盘踞在古矿深处的真龙残骸，龙血未冷',
      minAge: 80, maxAge: 10000,
      available: open(51, null),
      cond: function (g, U) { return Math.random() < U.clamp(0.32 + (g.innate || 1) * 0.03 + g.lvl / 320, 0.30, 0.82); },
      ok: function (g, U, log) {
        var c = U.cultPct(g, 0.15, 0.24, 12000);
        var lf = U.gainLife(g, 320, 700);
        U.gainDao(g, U.irand(26, 48), 18);
        g.dragonBlood = true;
        U.printlog('古矿深处盘着一具真龙残骸，鳞下仍有龙血在缓缓流动。你割开手掌与之相接，龙血逆流入体，' +
          '骨节爆响如龙吟，自此血脉中多了一线真龙之性，实力+' + c + (lf ? '，寿元+' + lf : ''));
        U.up(g, U.irand(1, 2), log);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 240, 600);
        U.printlog(h.exempt ? '龙血刚一沾身就烫得皮开肉绽，你果断割断相接的血线' :
          '真龙之性太过刚烈，它不肯认你为主，反而顺着经脉一路绞碎你的血肉，寿元 -' + h.loss);
      }
    },
    {
      id: 'phy_shizu_xuemai_juexing', weight: 0.16, maxCount: 1,
      name: '始祖血脉觉醒', tier: 4, tag: 'bloodline',
      desc: '沉睡在血脉最深处的那一缕古老印记，终于睁开了眼',
      minAge: 10, maxAge: 600,
      available: function (g) { return !g.becameEmperor && (g.innate || 1) <= 5; },
      cond: function (g, U) {
        return Math.random() < U.clamp(0.16 + (g.daoGift || 5) * 0.012 + (g.aptitude || 1) * 0.010, 0.14, 0.40);
      },
      ok: function (g, U, log) {
        var n = U.drawHighTalent(g);
        var lf = U.gainLife(g, 200, 500);
        U.gainDao(g, U.irand(20, 40), 14);
        U.printlog('你自幼寻常的血脉深处，忽然浮起一道苍老到无法辨认的印记。' +
          '那是某个早已绝迹的种族留在后裔骨血里的最后一笔，它认了你，也就此改了你的根骨' +
          (lf ? '，寿元+' + lf : ''));
        U.push(log, { cls: 'god', text: '始祖血脉觉醒，先天体质蜕变为『' + n.talent + '』，先天品阶跃至第 ' + n.innate + ' 档！' });
        U.up(g, U.irand(1, 3), log);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 60, 180);
        U.printlog(h.exempt ? '那道印记只亮了一瞬便重新沉没，你在原地怔了很久，什么也没能抓住' :
          '你强行催动那道印记，血脉被撕开一道口子，多年积累一朝倒退，寿元 -' + h.loss);
      }
    },
    {
      id: 'phy_sacred_dacheng_zhizun', weight: 0.70, maxCount: 1,
      name: '荒古圣体·极道之威', tier: 4, tag: 'sacred',
      desc: '准帝九重天的荒古圣体，便是大成圣体、极道至尊',
      minAge: 300, maxAge: 10000,
      available: phys('sacred', 95, null),
      cond: null,
      ok: function (g, U, log) {
        var c = U.cultPct(g, 0.08, 0.16, 30000);
        var lf = U.gainLife(g, 400, 800);
        U.gainDao(g, U.irand(36, 60), 26);
        if (g.lvl < 99) {
          U.printlog('你在准帝高位与一域群雄对峙。金色血气未及大成便已压得众人不敢抬头，' +
            '而所有人都清楚：等这具圣体走到九重天，这片星空就再没有能与之照面的了，实力+' + c +
            (lf ? '，寿元+' + lf : ''));
          return;
        }
        U.completeSacredBody(g, log);
        if (g.worldEmperor) {
          U.printlog('准帝九重天的荒古圣体，便是大成圣体。血气如金色汪洋倾泻万里，' +
            '此世虽有大帝在上，你亦是无人敢直撄其锋的极道至尊，实力+' + c + (lf ? '，寿元+' + lf : ''));
        } else {
          U.printlog('大成圣体气血如金海覆天，一步踏出便有星辰崩碎。' +
            '无帝之世，你已是人间极道至尊，仍在无缺大帝之下，实力+' + c + (lf ? '，寿元+' + lf : ''));
        }
        U.push(log, { cls: 'god', text: '至尊诅咒仍在骨血中低语——它压不垮今日的你，却依旧横在帝关之前' });
      },
      fail: null
    },
    {
      id: 'phy_tuntian_ronglu', weight: 1.00, maxCount: 2,
      name: '吞天熔炉', tier: 4, tag: 'refine',
      desc: '以己身为炉，把诸般异体本源一并熔了',
      minAge: 60, maxAge: 10000,
      available: function (g, U) {
        return !g.becameEmperor && !!g.swallowingArt && g.physiqueId !== 'chaos' &&
          g.lvl >= 21 && !!U.nextSwallowTarget(g);
      },
      cond: function (g, U) {
        return Math.random() < U.clamp(0.34 + g.cult / 800000 + (U.isHighDaoyun(g) ? 0.12 : 0), 0.30, 0.85);
      },
      ok: function (g, U, log) {
        var c = U.cultPct(g, 0.14, 0.24, 10000);
        U.gainDao(g, U.irand(28, 50), 18);
        U.printlog('你不再一具具慢慢炼化，而是以自身苦海为炉，把囤积的异体本源尽数投了进去。' +
          '炉火烧了整整九年，实力+' + c);
        U.trySwallowPhysique(g, log);
        if (!g.dead && Math.random() < 0.55 && U.nextSwallowTarget(g)) U.trySwallowPhysique(g, log);
      },
      fail: function (g, U) {
        /* 致命反噬只属于吞天路线；离了魔功，这一炉根本烧不起来 */
        if (g.swallowingArt && Math.random() < 0.25) {
          U.kill(g, '万源同炉，反噬之力自苦海倒卷而上。你被自己吞下的诸般本源生生撑爆，血雨落了一地');
          return;
        }
        var h = U.hurt(g, 300, 700);
        U.printlog(h.exempt ? '炉火将要失控时你及时熄了魔功，本源未化，性命尚存' :
          '诸源在体内互噬，你散去大半积蓄才把这场反噬压下，寿元 -' + h.loss);
      }
    },

    /* ===================== tier 3 稀有 ===================== */
    {
      id: 'phy_sacred_curse_suppress', weight: 1.10, maxCount: 2,
      name: '镇压至尊诅咒', tier: 3, tag: 'sacred',
      desc: '诅咒来自禁区至尊，解不掉，只能一层层压下去',
      minAge: 60, maxAge: 9000,
      available: phys('sacred', 41, null),
      cond: function (g, U) {
        return Math.random() < U.clamp(0.36 + g.lvl / 300 + (U.isHighDaoyun(g) ? 0.12 : 0), 0.32, 0.80);
      },
      ok: function (g, U, log) {
        var thing = PICK(T3_HERB);
        var c = U.cultPct(g, 0.06, 0.12, 3000);
        var lf = U.gainLife(g, 120, 300);
        U.gainDao(g, U.irand(16, 30));
        g.sacredCurseSeal = curseSeal(g) + 1;
        U.printlog('你以' + thing + '为引，在心口刻下第' + g.sacredCurseSeal + '道镇咒符纹。' +
          '那来自禁区至尊的咒力被压回骨髓深处——它仍在，只是暂时咬不动你了，实力+' + c +
          (lf ? '，寿元+' + lf : ''));
      },
      fail: function (g, U) {
        var h = U.hurt(g, 120, 280);
        U.printlog(h.exempt ? '符纹刻到一半便被咒力震碎，你及时收手，没让它反噬心脉' :
          '镇咒失败，沉睡的咒力被彻底激怒，反手在你血气上又添一道裂口，寿元 -' + h.loss);
      }
    },
    {
      id: 'phy_sacred_zhizun_zhaoya', weight: 1.00, maxCount: 3,
      name: '至尊爪牙猎圣体', tier: 3, tag: 'sacred',
      desc: '禁区旧仆专挑圣体下手，几个纪元都没变过',
      minAge: 100, maxAge: 9000,
      available: phys('sacred', 61, null),
      cond: function (g, U) {
        return Math.random() < U.clamp(0.38 + g.cult / 600000 + curseSeal(g) * 0.06, 0.32, 0.84);
      },
      ok: function (g, U, log) {
        var who = PICK(RIVAL_TITLES);
        var c = U.cultPct(g, 0.07, 0.13, 4500);
        U.gainDao(g, U.irand(14, 28));
        g.forbiddenKarma = (g.forbiddenKarma || 0) + 1;
        U.printlog('一名' + who + '奉禁区之命而来，开口便是「圣体的血，至尊要」。' +
          '你以金色血气将其轰成一团血雾，也彻底把这笔账记到了禁区头上，实力+' + c);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 130, 320);
        U.printlog(h.exempt ? '猎杀者身法诡谲，你重伤其一臂后果断退走，没有恋战' :
          '对方本就是冲着放你的血来的，你杀出重围时浑身金血淋漓，寿元 -' + h.loss);
      }
    },
    {
      id: 'phy_sacred_wen_di', weight: 0.80, maxCount: 1,
      name: '荒古圣体·叩问帝威', tier: 3, tag: 'sacred',
      desc: '走到准帝高位的圣体，开始向帝道叫板',
      minAge: 300, maxAge: 10000,
      available: phys('sacred', 93, null),
      cond: function (g, U) { return Math.random() < U.clamp(0.42 + g.cult / 1600000, 0.40, 0.85); },
      ok: function (g, U, log) {
        var c = U.cultPct(g, 0.07, 0.13, 20000);
        U.gainDao(g, U.irand(24, 40));
        if (g.worldEmperor) {
          U.printlog('你立于当世大帝的道场之外，以大成圣体之身叫阵三日。' +
            '对方未曾现身，只落下一缕帝威把方圆万里压成平地——你没跪，实力+' + c);
        } else {
          U.printlog('你踏碎一座古之大帝遗留的道痕，向那早已远去的背影叫了一声板。' +
            '帝痕轰然反击，你硬挨下来，反把那一缕帝道咀嚼入腹，实力+' + c);
        }
      },
      fail: function (g, U) {
        var h = U.hurt(g, 160, 300);
        U.printlog(h.exempt ? '帝威压落的一瞬，你的金色苦海翻涌如潮，替你卸去了大半' :
          '帝威之下，圣体亦要低头。你被压得单膝触地，骨骼寸寸开裂，寿元 -' + h.loss);
      }
    },
    {
      id: 'phy_chaos_wandao_bumo', weight: 1.00, maxCount: 3,
      name: '混沌体·万道不磨', tier: 3, tag: 'refine',
      desc: '混沌体不受寻常大道压制，因为它本身就是万道的起点',
      minAge: 40, maxAge: 10000,
      available: phys('chaos', 31, null),
      cond: null,
      ok: function (g, U, log) {
        var mi = PICK(T3_MI);
        var c = U.cultPct(g, 0.09, 0.14, 5000);
        U.gainDao(g, U.irand(20, 36));
        U.printlog('你在' + mi + '的大道禁制中随意行走，那些足以磨灭大圣的法则一触到你便自行崩散。' +
          '万道交融之体，本就不受任何一条道的约束，实力+' + c);
      },
      fail: null
    },
    {
      id: 'phy_isd_ti_dao_tongxiu', weight: 0.95, maxCount: 3,
      name: '先天圣体道胎·体道同证', tier: 3, tag: 'sacred',
      desc: '圣体的肉身与道胎的悟性长在同一具躯壳里',
      minAge: 20, maxAge: 10000,
      available: phys('innate_sacred_dao', 21, null),
      cond: null,
      ok: function (g, U, log) {
        var c = U.cultPct(g, 0.09, 0.13, 4500);
        U.gainDao(g, U.irand(24, 40));
        U.printlog('你一边以圣体血气硬撼山岳，一边以道胎之心照见山中道纹。' +
          '别人要分作两世去走的两条路，你在同一具身子里一并走完了，实力+' + c);
        U.up(g, 1, log);
      },
      fail: null
    },
    {
      id: 'phy_origin_sacred_fati', weight: 0.95, maxCount: 3,
      name: '元灵圣体·法体双圆', tier: 3, tag: 'sacred',
      desc: '圣体的肉身配上元灵近乎不竭的法力',
      minAge: 30, maxAge: 10000,
      available: phys('origin_sacred', 31, null),
      cond: function (g, U) { return Math.random() < U.clamp(0.52 + g.lvl / 260, 0.50, 0.88); },
      ok: function (g, U, log) {
        var c = U.cultPct(g, 0.08, 0.13, 4000);
        var lf = U.gainLife(g, 100, 260);
        U.gainDao(g, U.irand(18, 32));
        U.printlog('你以圣体之躯扛住正面轰击，同时以元灵法力连开十八重神通。' +
          '法与体互为表里，越打越是浑圆，实力+' + c + (lf ? '，寿元+' + lf : ''));
      },
      fail: function (g, U) {
        var h = U.hurt(g, 90, 220);
        U.printlog(h.exempt ? '法力与血气一时不谐，你收势静修数载便重新理顺' :
          '强行以法力冲刷圣体经脉，两股力道在体内相撞，寿元 -' + h.loss);
      }
    },
    {
      id: 'phy_lunar_taiyin_guxing', weight: 0.90, maxCount: 2,
      name: '太阴之体·太阴古星', tier: 3, tag: 'refine',
      desc: '太阴古星的清辉，只为太阴之体而落',
      minAge: 30, maxAge: 10000,
      available: phys('lunar', 21, null),
      cond: null,
      ok: function (g, U, log) {
        var c = U.cultPct(g, 0.07, 0.12, 3000);
        var lf = U.gainLife(g, 120, 280);
        U.gainDao(g, U.irand(24, 40));
        U.printlog('你独坐太阴古星的寒渊之底，任由亿万缕清辉浸透骨髓。' +
          '太阴大道在你面前几乎不设门槛，一夜静坐胜过旁人十年苦修，实力+' + c + (lf ? '，寿元+' + lf : ''));
      },
      fail: null
    },
    {
      id: 'phy_jiuyou_mingyuan', weight: 0.90, maxCount: 2,
      name: '九幽体·幽冥本源', tier: 3, tag: 'refine',
      desc: '九幽体的本源，本就与地府同出一脉',
      minAge: 40, maxAge: 10000,
      available: phys('jiuyou', 31, null),
      cond: function (g, U) { return Math.random() < U.clamp(0.48 + g.lvl / 280 + (U.isHighDaoyun(g) ? 0.10 : 0), 0.45, 0.86); },
      ok: function (g, U, log) {
        var c = U.cultPct(g, 0.08, 0.13, 3500);
        U.gainDao(g, U.irand(26, 40));
        U.printlog('你沿黄泉逆行，一路走到十八层地狱边缘。九幽本源在你身周自行铺开，' +
          '幽冥之力不但不侵你，反倒像归巢一般涌入神魂，实力+' + c);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 100, 240);
        U.printlog(h.exempt ? '幽冥深处有旧物苏醒，你不敢再往下走，掉头返回阳世' :
          '你走得太深，神魂被幽冥之气浸得几乎回不来，寿元 -' + h.loss);
      }
    },
    {
      id: 'phy_feathered_shencang', weight: 0.90, maxCount: 3,
      name: '羽化仙体·神藏自开', tier: 3, tag: 'refine',
      desc: '羽化仙体的秘境神藏，一处接一处地自行开启',
      minAge: 20, maxAge: 10000,
      available: phys('feathered', 11, null),
      cond: null,
      ok: function (g, U, log) {
        var c = U.cultPct(g, 0.08, 0.13, 3200);
        U.gainDao(g, U.irand(18, 32));
        U.printlog('你什么也没做，体内又一处秘境神藏轰然开启，浩荡气机自行涌出。' +
          '羽化仙体的潜力像是没有尽头，只是需要时间一处处翻开，实力+' + c);
        U.up(g, 1, log);
      },
      fail: null
    },
    {
      id: 'phy_daotai_jindao', weight: 0.90, maxCount: 3,
      name: '先天道胎·近道之感', tier: 3, tag: 'refine',
      desc: '道胎天生离道最近，天心也更愿意照拂',
      minAge: 15, maxAge: 10000,
      available: phys('dao_fetus', 11, null),
      cond: null,
      ok: function (g, U, log) {
        var gf = PICK(T3_GONG);
        var c = U.cultPct(g, 0.06, 0.11, 2600);
        U.gainDao(g, U.irand(28, 40));
        U.printlog('一部' + gf + '摊在膝上，你只看了一遍便合书起身——上面写的东西，' +
          '你的道胎似乎在娘胎里就已经知道了，实力+' + c);
      },
      fail: null
    },
    {
      id: 'phy_yaozu_zudi', weight: 1.00, maxCount: 2,
      name: '妖族祖地', tier: 3, tag: 'race',
      desc: '妖族祖地深处，供着一具比人族史书还老的骨骸',
      minAge: 40, maxAge: 10000,
      available: open(41, null),
      cond: function (g, U) { return Math.random() < U.clamp(0.44 + g.lvl / 280, 0.40, 0.84); },
      ok: function (g, U, log) {
        var c = U.cultPct(g, 0.07, 0.12, 2800);
        var lf = U.gainLife(g, 100, 250);
        U.gainDao(g, U.irand(16, 30));
        U.printlog('你被一头老妖引进妖族祖地。万兽俯首的石台上供着一具庞大骨骸，' +
          '骨缝间仍有妖气流转。你在骨下盘坐三年，血气被那股洪荒气息硬生生拔高一截，实力+' + c +
          (lf ? '，寿元+' + lf : ''));
      },
      fail: function (g, U) {
        var h = U.hurt(g, 100, 260);
        U.printlog(h.exempt ? '祖地中群妖鼓噪，你自知客随主便，未取分毫便退了出来' :
          '你伸手去触那具骨骸，残存的妖威当场炸开，把你掀飞出祖地，寿元 -' + h.loss);
      }
    },
    {
      id: 'phy_guzu_chenmian', weight: 0.95, maxCount: 2,
      name: '古族沉眠之地', tier: 3, tag: 'race',
      desc: '古族自封于地脉之下，等一个能用得上他们的时代',
      minAge: 60, maxAge: 10000,
      available: open(51, null),
      cond: function (g, U) { return Math.random() < U.clamp(0.42 + g.lvl / 300 + (U.isHighDaoyun(g) ? 0.10 : 0), 0.38, 0.82); },
      ok: function (g, U, log) {
        var sect = PICK(SECTS);
        var c = U.cultPct(g, 0.06, 0.12, 2600);
        U.gainDao(g, U.irand(20, 34));
        U.printlog('地脉之下是一整座自封的古族城池，石棺一口接一口排到视野尽头。' +
          '一位半醒的' + sect + '老祖睁眼看了你一息，替你理了一遍气血，又重新阖上眼皮，实力+' + c);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 110, 280);
        U.printlog(h.exempt ? '石棺群中有呼吸声渐次响起，你立刻原路退出，没有惊动沉眠者' :
          '你惊醒了不该惊醒的东西，一只枯手隔空按下，你逃出地脉时已是重伤，寿元 -' + h.loss);
      }
    },
    {
      id: 'phy_guhuang_yitui', weight: 0.85, maxCount: 1,
      name: '朝拜古皇遗蜕', tier: 3, tag: 'race',
      desc: '妖族古皇的遗蜕仍伏在星空中，鳞甲未朽',
      minAge: 120, maxAge: 10000,
      available: open(71, null),
      cond: function (g, U) { return Math.random() < U.clamp(0.40 + g.cult / 700000, 0.36, 0.80); },
      ok: function (g, U, log) {
        var c = U.cultPct(g, 0.09, 0.14, 6000);
        var lf = U.gainLife(g, 150, 300);
        U.gainDao(g, U.irand(26, 40));
        U.printlog('一具妖族古皇的遗蜕横亘在星空古路旁，鳞甲如山，历万古而未朽。' +
          '你依古礼三拜，遗蜕中残存的一缕皇道气息落在你眉心，替你把血气重新梳过一遍，实力+' + c +
          (lf ? '，寿元+' + lf : ''));
      },
      fail: function (g, U) {
        var h = U.hurt(g, 120, 300);
        U.printlog(h.exempt ? '古皇遗威太重，你只在千里之外遥遥一拜便调头离开' :
          '你靠得太近，古皇残威视你为觊觎者，一缕气息压来便令你口吐鲜血，寿元 -' + h.loss);
      }
    },

    /* ===================== tier 2 中级 ===================== */
    {
      id: 'phy_sacred_xueqi_chongxiao', weight: 3.00, maxCount: 5,
      name: '荒古圣体·血气冲霄', tier: 2, tag: 'sacred',
      desc: '同境之下，圣体的血气从来不讲道理',
      minAge: 12, maxAge: 4000,
      available: phys('sacred', 5, 70),
      cond: function (g, U) { return Math.random() < U.clamp(0.62 + (g.aptitude || 1) * 0.02, 0.60, 0.92); },
      ok: function (g, U, log) {
        var who = PICK(RIVAL_TITLES);
        var c = U.cultPct(g, 0.028, 0.048, 500);
        var lf = U.gainLife(g, 15, 45);
        U.gainDao(g, U.irand(2, 5));
        U.printlog('一位' + who + '当街拦路。你连法门都懒得动，只一拳递出，' +
          '金色血气冲霄而起，对方连人带兵器倒飞出去，实力+' + c + (lf ? '，寿元+' + lf : ''));
      },
      fail: function (g, U) {
        var h = U.hurt(g, 25, 70);
        U.printlog(h.exempt ? '对方唤出祖传重器，你自知眼下拼不过血气，笑了笑便退开' :
          '你仗着圣体硬接一件圣兵，金血洒了一地，寿元 -' + h.loss);
      }
    },
    {
      id: 'phy_sacred_curse_flare', weight: 2.60, maxCount: 6,
      name: '至尊诅咒发作', tier: 2, tag: 'sacred',
      desc: '禁区至尊按在圣体骨血里的那道咒，会自己找上门',
      minAge: 16, maxAge: 9000,
      available: phys('sacred', 11, null),
      cond: function (g, U) { return Math.random() < curseResist(g, U); },
      ok: function (g, U, log) {
        g.sacredCurseFlares = (g.sacredCurseFlares || 0) + 1;
        var c = U.cultPct(g, 0.015, 0.030, 300);
        var h = U.hurt(g, 10, 35);
        U.printlog('毫无征兆地，金色血气一夜之间退得干干净净，你枯坐在榻上连抬手都难。' +
          '你以' + (curseSeal(g) ? '心口的镇咒符纹' : '一口纯粹的意志') + '把它硬压了回去，反而对这具身子多了几分了解，实力+' + c +
          (h.loss ? '，寿元 -' + h.loss : ''));
      },
      fail: function (g, U) {
        g.sacredCurseFlares = (g.sacredCurseFlares || 0) + 1;
        var h = U.hurt(g, 40, 110);
        U.printlog(h.exempt ? '诅咒发作得凶，幸而随身药物压住，你在床上躺了小半年才缓过来' :
          '咒力自骨髓深处炸开，血气如退潮般枯竭，你瘦得只剩一把骨头，' +
          '这一场几乎要了命——至尊压在圣体上的那只手，从来没松过，寿元 -' + h.loss);
      }
    },
    {
      id: 'phy_sacred_siji_barrier', weight: 2.80, maxCount: 3,
      name: '荒古圣体·四极难关', tier: 2, tag: 'sacred',
      desc: '前代圣体多半卡死在四极这一关，终身不得寸进',
      minAge: 10, maxAge: 3000,
      available: phys('sacred', 11, 40),
      cond: function (g, U) {
        return Math.random() < U.clamp(0.40 + curseSeal(g) * 0.10 + (g.aptitude || 1) * 0.018 + g.lvl / 300, 0.35, 0.86);
      },
      ok: function (g, U, log) {
        var c = U.cultPct(g, 0.026, 0.048, 420);
        var lf = U.gainLife(g, 12, 40);
        U.gainDao(g, U.irand(3, 6));
        g.sacredSijiPassed = true;
        U.printlog('开辟四极时，圣体血气太盛，四肢经脉一寸寸炸裂又一寸寸重生。' +
          '你咬牙把这道关生生撞穿——多少前代圣体便永远卡死在了这里，实力+' + c +
          (lf ? '，寿元+' + lf : ''));
      },
      fail: function (g, U) {
        var h = U.hurt(g, 30, 90);
        g.sacredSijiStuck = (g.sacredSijiStuck || 0) + 1;
        U.printlog(h.exempt ? '四极秘境反复崩塌，你停手静养，暂且不去硬撞这道关' :
          '四极难成，金色血气在四肢中来回冲撞，你卡在这道关上白耗了许多岁月，寿元 -' + h.loss);
      }
    },
    {
      id: 'phy_overlord_zise_kuhai', weight: 2.80, maxCount: 4,
      name: '苍天霸体·紫色苦海', tier: 2, tag: 'refine',
      desc: '紫色苦海翻腾，神形无双，天生要与圣体争锋',
      minAge: 12, maxAge: 6000,
      available: phys('overlord', 3, null),
      cond: function (g, U) { return Math.random() < U.clamp(0.60 + g.lvl / 300, 0.58, 0.90); },
      ok: function (g, U, log) {
        var c = U.cultPct(g, 0.026, 0.046, 450);
        var lf = U.gainLife(g, 12, 40);
        U.gainDao(g, U.irand(2, 5));
        U.printlog('你的苦海泛着紫光，浪潮拍岸声震耳欲聋。霸体的路子简单得可怕——' +
          '堆血气、堆神形，堆到同代无人敢照面，实力+' + c + (lf ? '，寿元+' + lf : ''));
      },
      fail: function (g, U) {
        var h = U.hurt(g, 20, 60);
        U.printlog(h.exempt ? '紫气一时冲得太猛，你及时收功，把这口气按了回去' :
          '紫色浪潮反噬岸基，苦海几乎溃堤，你静养数载才稳住，寿元 -' + h.loss);
      }
    },
    {
      id: 'phy_solar_jinwu_zhenhuo', weight: 2.80, maxCount: 4,
      name: '太阳之体·金乌真火', tier: 2, tag: 'refine',
      desc: '至阳血气一旦被点燃，便是焚山煮海的真火',
      minAge: 12, maxAge: 6000,
      available: phys('solar', 5, null),
      cond: null,
      ok: function (g, U, log) {
        var c = U.cultPct(g, 0.026, 0.048, 450);
        var lf = U.gainLife(g, 15, 45);
        U.gainDao(g, U.irand(2, 5));
        U.printlog('你迎着朝阳吐纳，周身腾起赤金色的火焰。' +
          '至阳之体引动金乌真火，草木化灰、顽石流淌，出手之处从不留活口，实力+' + c +
          (lf ? '，寿元+' + lf : ''));
      },
      fail: null
    },
    {
      id: 'phy_demon_tianyaobian', weight: 2.70, maxCount: 4,
      name: '天妖体·天蚕变', tier: 2, tag: 'race',
      desc: '妖族至强体质，每一次蜕皮都是一次重生',
      minAge: 10, maxAge: 6000,
      available: phys('heavenly_demon', 3, null),
      cond: function (g, U) { return Math.random() < U.clamp(0.62 + (g.aptitude || 1) * 0.018, 0.60, 0.92); },
      ok: function (g, U, log) {
        var c = U.cultPct(g, 0.026, 0.046, 400);
        var lf = U.gainLife(g, 15, 50);
        U.gainDao(g, U.irand(2, 6));
        U.printlog('你依《天蚕变》之法结茧自缚，七日后破茧而出，蜕下的旧皮坚硬如金铁。' +
          '天妖体的每一次蜕变，都比人族修士的一次大突破还要彻底，实力+' + c + (lf ? '，寿元+' + lf : ''));
      },
      fail: function (g, U) {
        var h = U.hurt(g, 20, 55);
        U.printlog(h.exempt ? '蜕变中途被人打断，你强行退回原形，未伤根本' :
          '蜕皮到一半被外力惊扰，新生的血肉暴露在外，险些溃烂，寿元 -' + h.loss);
      }
    },
    {
      id: 'phy_vajra_wanji_bupo', weight: 2.70, maxCount: 4,
      name: '金刚不坏体·万击不破', tier: 2, tag: 'refine',
      desc: '打不动、砸不烂，圣兵砍上去只留一道白痕',
      minAge: 10, maxAge: 6000,
      available: phys('vajra', 3, null),
      cond: null,
      ok: function (g, U, log) {
        var b = PICK(T3_BING);
        var c = U.cultPct(g, 0.022, 0.042, 380);
        var lf = U.gainLife(g, 12, 40);
        U.printlog('对方祭出' + b + '当头劈落，你连躲都没躲。刀光散去，' +
          '你身上只多了一道浅浅白痕——金刚不坏，说的就是这个意思，实力+' + c +
          (lf ? '，寿元+' + lf : ''));
      },
      fail: null
    },
    {
      id: 'phy_divine_king_yixiang', weight: 2.70, maxCount: 4,
      name: '东荒神体·异象天成', tier: 2, tag: 'refine',
      desc: '东荒神体每一次出手，身后都有异象自成',
      minAge: 10, maxAge: 6000,
      available: phys('divine_king', 3, null),
      cond: function (g, U) { return Math.random() < U.clamp(0.62 + g.lvl / 300, 0.60, 0.92); },
      ok: function (g, U, log) {
        var region = PICK(REGIONS);
        var c = U.cultPct(g, 0.026, 0.046, 420);
        U.gainDao(g, U.irand(2, 5));
        U.printlog('你在' + region + '与人交手，一拳递出，身后浮起山河日月的虚影。' +
          '围观者当场噤声——东荒神体的异象，不是修出来的，是生出来的，实力+' + c);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 18, 55);
        U.printlog(h.exempt ? '异象引来强者围观，你不愿多生事端，收手作罢' :
          '异象太扎眼，当夜便有人循迹寻仇，你负伤遁走，寿元 -' + h.loss);
      }
    },
    {
      id: 'phy_shengling_huaxing', weight: 1.05, maxCount: 2,
      name: '圣灵化形', tier: 3, tag: 'race',
      desc: '天地孕育的圣灵脱去兽形，第一次学人走路',
      minAge: 15, maxAge: 8000,
      available: open(11, null),
      cond: function (g, U) { return Math.random() < U.clamp(0.58 + g.lvl / 300, 0.55, 0.90); },
      ok: function (g, U, log) {
        var c = U.cultPct(g, 0.06, 0.11, 2200);
        var lf = U.gainLife(g, 100, 250);
        U.gainDao(g, U.irand(16, 30));
        U.printlog('一头自石中孕育的圣灵在你面前化形，褪去鳞甲后是个懵懂少年模样。' +
          '它认你为第一个见到的生灵，分了一缕先天灵性给你作谢礼，实力+' + c + (lf ? '，寿元+' + lf : ''));
      },
      fail: function (g, U) {
        var h = U.hurt(g, 90, 220);
        U.printlog(h.exempt ? '化形正是最凶险的关头，你没有靠近，远远护了它一程' :
          '圣灵化形不稳，暴走的先天之气把你掀出老远，寿元 -' + h.loss);
      }
    },
    {
      id: 'phy_yizu_xingyu', weight: 2.50, maxCount: 3,
      name: '异族星域', tier: 2, tag: 'race',
      desc: '星空古路之外，还有人族从未记载过的族群',
      minAge: 40, maxAge: 9000,
      available: open(31, null),
      cond: function (g, U) { return Math.random() < U.clamp(0.55 + g.lvl / 320, 0.52, 0.88); },
      ok: function (g, U, log) {
        var region = PICK(REGIONS);
        var c = U.cultPct(g, 0.024, 0.044, 420);
        U.gainDao(g, U.irand(3, 6));
        U.printlog('你在' + region + '边缘撞进一座异族星域。那里的生灵以晶石为骨、以星光为血，' +
          '修行之法与人族全然不同。你换走半卷他们的炼体图谱，实力+' + c);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 22, 60);
        U.printlog(h.exempt ? '异族视你为不速之客，你亮明来意后全身而退' :
          '异族不与外人往来，你被一群晶骨战士赶出星域，寿元 -' + h.loss);
      }
    },
    {
      id: 'phy_xuemai_shenquan', weight: 2.50, maxCount: 3,
      name: '血脉神泉', tier: 2, tag: 'bloodline',
      desc: '古族守着的一眼血泉，只对血脉说话',
      minAge: 20, maxAge: 9000,
      available: open(11, null),
      cond: function (g, U) { return Math.random() < U.clamp(0.56 + (g.innate || 1) * 0.02, 0.52, 0.90); },
      ok: function (g, U, log) {
        var c = U.cultPct(g, 0.026, 0.048, 420);
        var lf = U.gainLife(g, 18, 55);
        U.gainDao(g, U.irand(2, 6));
        U.printlog('泉眼深处涌出的不是水，是暗红黏稠的血脉精气。你俯身饮了三口，' +
          '整条脊骨都在发烫，沉睡的血脉像是被人在耳边喊了一声，实力+' + c + (lf ? '，寿元+' + lf : ''));
      },
      fail: function (g, U) {
        var h = U.hurt(g, 20, 58);
        U.printlog(h.exempt ? '泉水入口滚烫，你察觉不对便吐了出来，未受实伤' :
          '血泉精气与你血脉相冲，一口下去便呕出黑血，寿元 -' + h.loss);
      }
    },

    /* ===================== tier 1 普通 ===================== */
    {
      id: 'phy_sacred_golden_kuhai', weight: 4.00, maxCount: 6,
      name: '荒古圣体·苦海化金', tier: 1, tag: 'sacred',
      desc: '别人的苦海一片幽蓝，你的是金的',
      minAge: 8, maxAge: 400,
      available: phys('sacred', 1, 20),
      cond: null,
      ok: function (g, U, log) {
        var c = U.cultPct(g, 0.006, 0.012, 90);
        var lf = U.gainLife(g, 10, 35);
        U.printlog('你盘坐在溪边引气入体，苦海忽然泛起一层金光，金色浪涛一圈圈拍向岸边。' +
          '族中长辈看得脸色发白——那是荒古圣体才有的景象，实力+' + c + (lf ? '，寿元+' + lf : ''));
      },
      fail: null
    },
    {
      id: 'phy_xuemai_fanzu', weight: 3.20, maxCount: 5,
      name: '血脉返祖', tier: 1, tag: 'bloodline',
      desc: '祖上那点东西，隔了不知多少代又冒出来一星半点',
      minAge: 8, maxAge: 3000,
      available: open(1, null),
      cond: function (g, U) { return Math.random() < U.clamp(0.52 + (g.innate || 1) * 0.025, 0.50, 0.88); },
      ok: function (g, U, log) {
        var c = U.cultPct(g, 0.005, 0.011, 80);
        var lf = U.gainLife(g, 8, 28);
        U.printlog('一场高热烧了三日，退热后你发觉自己的眼瞳在暗处会微微反光，' +
          '力气也大了不少。这是极淡的一丝返祖，族中天赋跟着醒了一线，实力+' + c +
          (lf ? '，寿元+' + lf : ''));
      },
      fail: function (g, U) {
        var h = U.hurt(g, 6, 20);
        U.printlog(h.exempt ? '返祖之兆只闪了一闪便隐去，你什么也没留住' :
          '返祖的血脉与你本身不合，高热反复，把身子拖垮了些，寿元 -' + h.loss);
      }
    },
    {
      id: 'phy_bailian_duangu', weight: 5.00, maxCount: 40,
      name: '百炼锻骨', tier: 1, tag: 'refine',
      desc: '没有血脉可依仗的人，只能一锤一锤自己打',
      minAge: 8, maxAge: 10000,
      available: lowBody(null),
      cond: null,
      ok: function (g, U, log) {
        var c = U.cultPct(g, 0.005, 0.012, 70);
        var lf = U.gainLife(g, 5, 20);
        U.printlog('你把自己吊进滚烫的药汤，一日三遍，整整三年。' +
          '骨头一次次裂开又长合，比从前硬了不止一筹，实力+' + c + (lf ? '，寿元+' + lf : ''));
      },
      fail: null
    },
    {
      id: 'phy_xisui_fagu', weight: 4.00, maxCount: 15,
      name: '洗髓伐骨', tier: 1, tag: 'refine',
      desc: '把凡胎里那点浊气一遍遍逼出来',
      minAge: 10, maxAge: 10000,
      available: lowBody(null),
      cond: function (g, U) { return Math.random() < U.clamp(0.66 + (g.aptitude || 1) * 0.02, 0.64, 0.92); },
      ok: function (g, U, log) {
        var hb = PICK(T2_HERB);
        var c = U.cultPct(g, 0.005, 0.011, 70);
        var lf = U.gainLife(g, 6, 22);
        U.printlog('你以' + hb + '熬药，闭门洗髓。一层层黑垢自毛孔逼出，' +
          '水换了十二次才算干净，实力+' + c + (lf ? '，寿元+' + lf : ''));
      },
      fail: function (g, U) {
        var h = U.hurt(g, 5, 16);
        U.printlog(h.exempt ? '药性偏烈，你减了药量，这一回只当白忙' :
          '药力逼得太急，浊气未出、真气先乱，你病了一场，寿元 -' + h.loss);
      }
    },
    {
      id: 'phy_qiyao_gaiming', weight: 3.00, maxCount: 5,
      name: '奇药改命', tier: 1, tag: 'refine',
      desc: '一株无名奇药，未必能换个体质，却能换个根基',
      minAge: 10, maxAge: 10000,
      available: lowBody(null),
      cond: null,
      ok: function (g, U, log) {
        var up = 0;
        if (g.aptitude < 10 && Math.random() < 0.32) up = U.apt(g, 1);
        var c = U.cultPct(g, 0.005, 0.011, 70);
        var lf = U.gainLife(g, 6, 22);
        U.printlog('崖缝里长着一株连药老都叫不出名字的奇药。你囫囵吞下，' +
          '腹中先冷后热' + (up ? '，多年淤塞的根基竟被冲开一段，修行根基提升！' : '，只觉浑身通泰') +
          '，实力+' + c + (lf ? '，寿元+' + lf : ''));
      },
      fail: null
    },
    {
      id: 'phy_guzu_kanzouyan', weight: 3.00, maxCount: 4,
      name: '古族看走眼', tier: 1, tag: 'refine',
      desc: '他们量了你的骨，摇头走了',
      minAge: 10, maxAge: 2000,
      available: lowBody(null),
      cond: null,
      ok: function (g, U, log) {
        var sect = PICK(SECTS);
        var c = U.cultPct(g, 0.005, 0.012, 80);
        U.printlog('' + sect + '的人来选苗子，取出一块测骨玉按在你胸口，玉面毫无反应。' +
          '他们收起玉牌，看也没再看你一眼。你把这口气咽下去，回头把功法多练了一千遍，实力+' + c);
      },
      fail: null
    },
    {
      id: 'phy_fanti_kangbao', weight: 3.00, maxCount: 4,
      name: '凡体扛异宝', tier: 1, tag: 'refine',
      desc: '异宝挑主人，偏偏挑中了最不像样的那个',
      minAge: 12, maxAge: 10000,
      available: lowBody(null),
      cond: function (g, U) { return Math.random() < U.clamp(0.58 + (g.daoGift || 5) * 0.02, 0.55, 0.88); },
      ok: function (g, U, log) {
        var c = U.cultPct(g, 0.006, 0.012, 90);
        var lf = U.gainLife(g, 6, 22);
        U.printlog('一件不知来历的古物落到你手里，先后炸伤了三名异体天骄。' +
          '轮到你时，它安安静静地贴在掌心——凡胎无异，反倒没什么可与它相冲的，实力+' + c +
          (lf ? '，寿元+' + lf : ''));
      },
      fail: function (g, U) {
        var h = U.hurt(g, 5, 18);
        U.printlog(h.exempt ? '古物微微一震，你手一松让它落地，没让它伤着自己' :
          '古物余威扫过，你吐了口血，抱着它在地上滚了半圈，寿元 -' + h.loss);
      }
    },
    {
      id: 'phy_fantai_cangling', weight: 3.00, maxCount: 4,
      name: '凡胎藏灵', tier: 1, tag: 'refine',
      desc: '看似最普通的一副身子，里头未必真的空无一物',
      minAge: 10, maxAge: 10000,
      available: lowBody(null),
      cond: null,
      ok: function (g, U, log) {
        var c = U.cultPct(g, 0.005, 0.011, 70);
        var lf = U.gainLife(g, 8, 26);
        U.printlog('你静坐时忽觉心口一处从未留意的地方微微一暖，像是有什么东西在极深处翻了个身。' +
          '你追着那点暖意打坐了整夜，天亮时气息比昨日绵长了许多，实力+' + c +
          (lf ? '，寿元+' + lf : ''));
      },
      fail: null
    }
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = EVENTS;
  root.EVENT_PACK_PHYSIQUE = EVENTS;
})(typeof self !== 'undefined' ? self : this);
