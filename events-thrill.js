/* ============================================================
 * 遮天模拟器 · 分境界梭哈包
 * 专门补「能真正被抽到」的故事：按仙台 / 大能 / 王者 / 圣人 / 大圣 / 准帝切开。
 * 低阶秘境不再是中前期唯一一张梭哈。
 * ============================================================ */
(function (root) {
  var POOLS = typeof module !== 'undefined' && module.exports ? require('./events-pools.js') : root.EVENT_POOLS;
  var PICK = POOLS.PICK;
  var T2_HERB = POOLS.T2_HERB, T3_HERB = POOLS.T3_HERB, T2_GONG = POOLS.T2_GONG, T3_GONG = POOLS.T3_GONG;
  var T2_MI = POOLS.T2_MI, T3_MI = POOLS.T3_MI, T4_MI = POOLS.T4_MI;
  var T3_BING = POOLS.T3_BING, T3_CHUAN = POOLS.T3_CHUAN || POOLS.T3_GONG;
  var REGIONS = POOLS.REGIONS, RIVAL_TITLES = POOLS.RIVAL_TITLES, SECTS = POOLS.SECTS;
  var NINE_SECRETS = POOLS.NINE_SECRETS;

  function odds(g, U, base, powerRef) {
    var ratio = U.clamp(U.currentCombatPower(g) / (powerRef || 80000), 0, 2);
    var dao = U.clamp((g.daoyun || 0) / U.data.DAO_ABSOLUTE_MAX, 0, 1);
    var ward = U.clamp((((g.tm && g.tm.ward) || 0)) / 100, 0, 0.15);
    var realm = U.clamp(((g.lvl || 1) - 40) / 60, 0, 1) * 0.10;
    return U.clamp(base + ratio * 0.30 + dao * 0.16 + ward + realm, 0.08, 0.93);
  }
  function info(g, U) {
    return '战力 ' + U.round(U.currentCombatPower(g)) +
      ' · 道蕴 ' + U.round(g.daoyun || 0) + '/' + U.round(g.daoyunCap || 0) +
      ' · ' + U.data.titleOf(g.lvl);
  }
  function stash(g, id, val) {
    if (!g.thStash) g.thStash = {};
    g.thStash[id] = val;
    return val;
  }
  function stashed(g, id) { return (g.thStash && g.thStash[id]) || null; }
  function rival() { return PICK(RIVAL_TITLES); }
  function hurtLine(g, U, lo, hi, exemptText, hurtText) {
    var h = U.hurt(g, lo, hi);
    U.printlog(h.exempt || !h.loss ? exemptText : hurtText + '，寿元 -' + h.loss);
    return h;
  }
  function inBand(lo, hi) {
    return function (g) { return !g.becameEmperor && g.lvl >= lo && g.lvl <= hi; };
  }
  /* 卡关能推到大圣门口。进准帝不是坐出来的，要撞上机缘。 */
  function sitThrough(g, U) {
    var need = U.effectiveDaoyunNeed ? U.effectiveDaoyunNeed(g, g.lvl) : 0;
    if (need && (g.daoyun || 0) < need) g.daoyun = need;
    if ((g.lvl || 1) === 60 || (g.lvl || 1) === 70 || (g.lvl || 1) >= 90) return 0;
    return U.up(g, 1);
  }

  /* 三档：退避 / 深入 / 核心。核心不致命，只重伤。仙台凡体靠这个破境。 */
  function forkEvent(cfg) {
    function midOdds(g, U) { return odds(g, U, cfg.midBase, cfg.powerRef); }
    function hotOdds(g, U) { return odds(g, U, cfg.hotBase, cfg.powerRef); }
    return {
      id: cfg.id, name: cfg.name, tier: cfg.tier || 2, tag: cfg.tag || 'dungeon',
      desc: cfg.desc, weight: cfg.weight || 2.2, maxCount: cfg.maxCount != null ? cfg.maxCount : 1,
      minAge: cfg.minAge != null ? cfg.minAge : 30, maxAge: 100000,
      available: cfg.available,
      choice: function (g, U) {
        var s = cfg.setup ? cfg.setup(g, U) : {};
        stash(g, cfg.id, s);
        return {
          lead: typeof cfg.lead === 'function' ? cfg.lead(g, U, s) : cfg.lead,
          info: info(g, U),
          note: cfg.note,
          options: [
            { id: 'back', label: cfg.backLabel || '转身离开', desc: cfg.backDesc || '无险无获', safe: true },
            { id: 'mid', label: cfg.midLabel, desc: cfg.midDesc, chance: midOdds(g, U) },
            { id: 'hot', label: cfg.hotLabel, desc: cfg.hotDesc, chance: hotOdds(g, U) }
          ]
        };
      },
      resolve: function (g, U, optionId) {
        var s = stashed(g, cfg.id) || (cfg.setup ? cfg.setup(g, U) : {});
        if (optionId === 'back') { cfg.back(g, U, s); return; }
        if (optionId === 'mid') {
          if (Math.random() < midOdds(g, U)) cfg.midOk(g, U, s);
          else cfg.midFail(g, U, s);
          return;
        }
        if (Math.random() < hotOdds(g, U)) cfg.hotOk(g, U, s);
        else cfg.hotFail(g, U, s);
      }
    };
  }

  function allinEvent(cfg) {
    function sdOdds(g, U) { return odds(g, U, cfg.steadyBase, cfg.powerRef); }
    function alOdds(g, U) { return U.allInFloor(odds(g, U, cfg.allinBase, cfg.powerRef), g, cfg.powerRef); }
    function alShare(g, U) { return U.deathShare(g, cfg.allinDeathShare || 0.35, cfg.powerRef); }
    return {
      id: cfg.id, name: cfg.name, tier: cfg.tier, tag: 'allin',
      desc: cfg.desc, weight: cfg.weight || 0.9, maxCount: cfg.maxCount != null ? cfg.maxCount : 1,
      minAge: cfg.minAge != null ? cfg.minAge : 80, maxAge: 100000,
      available: cfg.available,
      choice: function (g, U) {
        var s = cfg.setup ? cfg.setup(g, U) : {};
        stash(g, cfg.id, s);
        return {
          lead: typeof cfg.lead === 'function' ? cfg.lead(g, U, s) : cfg.lead,
          info: info(g, U),
          note: cfg.note,
          options: [
            { id: 'back', label: cfg.backLabel || '退开', desc: cfg.backDesc || '无收益，无风险', safe: true },
            { id: 'steady', label: cfg.steadyLabel, desc: cfg.steadyDesc, chance: sdOdds(g, U) },
            {
              id: 'allin', label: cfg.allinLabel, desc: cfg.allinDesc,
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
        var p = alOdds(g, U);
        var out = U.allIn(p, alShare(g, U));
        if (out === 'win') {
          var mult = U.payoff(p);
          cfg.allinOk(g, U.boost(mult), s, log);
          var surge = U.surgeOf(mult);
          U.powerSurge(g, surge, log);
          var edge = U.zhengdaoEdge(g, mult);
          U.push(log, { cls: 'rainbow', text: U.surgeLine(surge, edge) });
          U.highlight(g, log, { title: cfg.name, kind: 'allin', note: '梭哈成功' });
        } else if (out === 'dead') {
          U.kill(g, cfg.deadText || '这一搏没成，你连退路都没留下');
        } else {
          var h = U.woundOnly(g, 180, 480);
          U.printlog(h.exempt || !h.loss ?
            '你在最后一瞬收了手，两手空空退了出来' :
            (cfg.hurtText || '你没拿住它，气血几近熬干') + '，寿元 -' + h.loss);
        }
      }
    };
  }

  var EVENTS = [

    /* ---------- 凡体卡关：不弹窗，额度用尽后进路边池，推一层并补寿 ---------- */
    {
      id: 'th_stuck_sea', name: '苦海夜坐', tier: 2, tag: 'insight',
      desc: '轮海道宫这点寿元，坐一夜才能续上', weight: 16, maxCount: 3,
      minAge: 12, maxAge: 100000,
      available: function (g) {
        return !g.becameEmperor && (g.innate || 1) <= 4 && g.lvl >= 6 && g.lvl <= 20;
      },
      cond: function (g) { return Math.random() < 0.74; },
      ok: function (g, U) {
        var lf = U.gainLife(g, 22, 45);
        var c = U.cultPct(g, 0.016, 0.030, 80);
        sitThrough(g, U);
        U.printlog('苦海里那口气今夜自己匀开了。你把命续上，再往前挪一步' +
          (lf ? '，寿元+' + lf : '') + '，实力+' + c);
      },
      fail: function (g, U) {
        U.printlog('苦海还是苦海。你把腿盘紧，明天再坐');
      }
    },
    {
      id: 'th_stuck_fourpole', name: '四极夜关', tier: 2, tag: 'insight',
      desc: '第四极那口气一夜没散', weight: 16, maxCount: 8,
      minAge: 25, maxAge: 100000,
      available: function (g) {
        return !g.becameEmperor && (g.innate || 1) <= 4 && g.lvl >= 21 && g.lvl <= 40;
      },
      cond: function (g) { return Math.random() < 0.72; },
      ok: function (g, U) {
        var lf = U.gainLife(g, 28, 55);
        var c = U.cultPct(g, 0.018, 0.035, 220);
        sitThrough(g, U);
        U.printlog('第四极那口气在夜里忽然通了。你没求任何人，只是自己坐到了天亮' +
          (lf ? '，寿元+' + lf : '') + '，实力+' + c);
      },
      fail: function (g, U) {
        U.printlog('你在夜里把第四极那口气又捋了一遍，还是差一截。差的那一截，明天再坐');
      }
    },
    {
      id: 'th_stuck_xian', name: '仙台枯坐', tier: 2, tag: 'insight',
      desc: '这一层的窗户纸，坐薄了', weight: 16, maxCount: 8,
      minAge: 80, maxAge: 100000,
      available: function (g) {
        return !g.becameEmperor && (g.innate || 1) <= 4 && g.lvl >= 41 && g.lvl <= 55;
      },
      cond: function (g) { return Math.random() < 0.70; },
      ok: function (g, U) {
        var lf = U.gainLife(g, 30, 58);
        var c = U.cultPct(g, 0.020, 0.038, 400);
        sitThrough(g, U);
        U.printlog('仙台这一层的窗户纸被你坐薄了。不是顿悟，是坐到它自己破' +
          (lf ? '，寿元+' + lf : '') + '，实力+' + c);
      },
      fail: function (g, U) {
        U.printlog('你从蒲团上起来，这一层还在。你把蒲团拍了拍，重新坐下');
      }
    },
    {
      id: 'th_stuck_neng', name: '大能调息', tier: 2, tag: 'insight',
      desc: '别人靠血脉过关，你靠把息调匀', weight: 15, maxCount: 8,
      minAge: 160, maxAge: 100000,
      available: function (g) {
        if (g.lvl === 60 && g.cutDaoTried) return false;
        return !g.becameEmperor && (g.innate || 1) <= 4 && g.lvl >= 51 && g.lvl <= 69;
      },
      cond: function (g) { return Math.random() < 0.68; },
      ok: function (g, U) {
        var lf = U.gainLife(g, 32, 60);
        var c = U.cultPct(g, 0.022, 0.040, 700);
        sitThrough(g, U);
        U.printlog('同境的人靠血脉一步跨过去。你把息调匀，自己走过去' +
          (lf ? '，寿元+' + lf : '') + '，实力+' + c);
      },
      fail: function (g, U) {
        U.printlog('息乱了一次，你停下来，没有硬闯。凡骨过关，急不得');
      }
    },
    {
      id: 'th_stuck_cut', name: '斩道前夜', tier: 2, tag: 'insight',
      desc: '大能巅峰，这一刀还没落下', weight: 18, maxCount: 2,
      minAge: 180, maxAge: 100000,
      available: function (g) {
        return !g.becameEmperor && (g.innate || 1) < 8 && g.lvl === 60 && !g.cutDaoTried && !g.cutDaoPassed;
      },
      cond: function (g) { return Math.random() < 0.70; },
      ok: function (g, U) {
        var lf = U.gainLife(g, 28, 52);
        var c = U.cultPct(g, 0.024, 0.044, 900);
        var reverse = U.isReverseCutPath && U.isReverseCutPath(g);
        U.printlog(reverse ?
          '少年大帝的气机在远方压过来。你今夜不斩，只把刀压在膝上，把战力再沉一分' +
            (lf ? '，寿元+' + lf : '') + '，实力+' + c :
          '同境有人斩过去了，有人跪在门口起不来。你把这一刀又掂了一遍，仍然没落' +
            (lf ? '，寿元+' + lf : '') + '，实力+' + c);
      },
      fail: function (g, U) {
        U.printlog('刀意散了一夜。斩道还在前面，你连压刀的资格都差一点');
      }
    },
    {
      id: 'th_cut_rekindle', name: '刀意回潮', tier: 2, tag: 'insight',
      desc: '只差一线的那一刀，自己回来了', weight: 18, maxCount: 1,
      minAge: 200, maxAge: 100000,
      available: function (g) {
        return !g.becameEmperor && (g.innate || 1) < 8 && g.lvl === 60 &&
          g.cutNearMiss && !g.cutDaoPassed && !g.cutDaoRekindled;
      },
      cond: function (g) { return Math.random() < 0.74; },
      ok: function (g, U, log) {
        var lf = U.gainLife(g, 20, 40);
        var c = U.cultPct(g, 0.018, 0.032, 700);
        U.gainDao(g, 8, 4);
        U.printlog('骨头里那一线刀意忽然烫起来。你没有再选，它自己要出鞘' +
          (lf ? '，寿元+' + lf : '') + '，实力+' + c);
        if (U.rekindleCutDao) U.rekindleCutDao(g, log);
      },
      fail: function (g, U) {
        U.printlog('刀意动了一下，又沉回去了。你知道它还在，只是这一夜没燃起来');
      }
    },
    {
      id: 'th_after_cut', name: '斩道余生', tier: 2, tag: 'insight',
      desc: '那一刀已经落过了，门还在', weight: 16, maxCount: 2,
      minAge: 200, maxAge: 100000,
      available: function (g) {
        return !g.becameEmperor && g.lvl === 60 && g.cutDaoTried && !g.cutDaoPassed;
      },
      cond: function (g) { return Math.random() < 0.78; },
      ok: function (g, U) {
        var lf = U.gainLife(g, 18, 36);
        var c = U.cultPct(g, 0.018, 0.032, 700);
        U.printlog('门口又来了一个人。他问前面是什么。你说，王者。他进去了，你没有' +
          (lf ? '。你在原处又坐了一夜，寿元+' + lf : '') + '，实力+' + c);
      },
      fail: function (g, U) {
        U.printlog('你又走到落刀的地方。门还在。你已经不是来砍的人了');
      }
    },
    {
      id: 'th_stuck_sheng', name: '圣位枯坐', tier: 2, tag: 'insight',
      desc: '大圣这一层，凡骨只能坐', weight: 14, maxCount: 8,
      minAge: 400, maxAge: 100000,
      available: function (g) {
        if (g.lvl === 70 && g.saintTried) return false;
        return !g.becameEmperor && (g.innate || 1) < 8 && g.lvl >= 70 && g.lvl <= 90;
      },
      cond: function (g) { return Math.random() < 0.64; },
      ok: function (g, U) {
        var lf = U.gainLife(g, 40, 80);
        var c = U.cultPct(g, 0.024, 0.042, 1200);
        var atQuasi = (g.lvl || 1) >= 90;
        var atSaintDoor = (g.lvl || 1) === 70;
        sitThrough(g, U);
        U.printlog(atQuasi ?
          '蒲团坐穿了，门还在前面。进准帝要的不是再坐一夜，是一场真正够格的机缘' :
          atSaintDoor ?
          '王者巅峰，你把息坐沉，不敢硬闯圣位。先把战力堆着' +
            (lf ? '，寿元+' + lf : '') + '，实力+' + c :
          '圣位这一层没有人来点破。你把息坐稳，自己往前挪了一步' +
            (lf ? '，寿元+' + lf : '') + '，实力+' + c);
      },
      fail: function (g, U) {
        U.printlog('这一坐没有通。你起身添了灯油，再坐');
      }
    },
    {
      id: 'th_after_saint', name: '圣位余生', tier: 2, tag: 'insight',
      desc: '圣位那一坎过不去，生命还在原来那边', weight: 14, maxCount: 2,
      minAge: 400, maxAge: 100000,
      available: function (g) {
        return !g.becameEmperor && g.lvl === 70 && g.saintTried && !g.saintPassed;
      },
      cond: function (g) { return Math.random() < 0.76; },
      ok: function (g, U) {
        var lf = U.gainLife(g, 22, 44);
        U.printlog('有人从圣位那一侧回头看你一眼。那一眼里的寿元、气血、神识，已经不是同一种东西' +
          (lf ? '。你把目光收回来，寿元+' + lf : ''));
      },
      fail: function (g, U) {
        U.printlog('你试着再迈半步。门槛还是门槛。过了斩道的人，也大多止步于此');
      }
    },

    /* ---------- 仙台：凡体最常卡死的地方 ---------- */
    forkEvent({
      id: 'th_xian_stele', name: '古碑裂纹', tier: 2, weight: 2.4,
      desc: '仙台侧峰一块古碑裂开，缝里渗出热气',
      available: inBand(41, 50), powerRef: 50000, midBase: 0.42, hotBase: 0.22,
      lead: '仙台侧峰那块没字的古碑夜里裂开一道缝，缝里往外冒热气。山下有人说摸到缝的人第二天就能破境，也有人说摸完就疯了',
      note: '摸一摸也许只是烫手；整个人贴上去，成了能破一层，败了要养很久。',
      midLabel: '伸手探缝', midDesc: '成功则修为松动；失败被热气灼伤',
      hotLabel: '以背贴碑', hotDesc: '成功当场破境一层；失败经脉逆行',
      back: function (g, U) { U.printlog('你看了那道缝一眼，转身下山。有些热气，不是给你准备的'); },
      midOk: function (g, U) {
        var c = U.cultPct(g, 0.028, 0.048, 400);
        U.printlog('缝里的热气顺着指尖钻进四肢百骸，像有人替你把滞住的那一截推开了，实力+' + c);
      },
      midFail: function (g, U) {
        hurtLine(g, U, 25, 70, '热气一烫你就缩手，只焦了一层皮', '热气顺着经脉乱窜，你在碑下跪了半日');
      },
      hotOk: function (g, U) {
        var c = U.cultPct(g, 0.04, 0.05, 600);
        U.up(g, 1);
        U.printlog('你把背贴上去。碑里那口热气整股灌进来，滞了多年的关口当场裂开，实力+' + c);
      },
      hotFail: function (g, U) {
        hurtLine(g, U, 50, 120, '经脉刚要逆行，你咬碎舌尖逼自己滚开', '热气在体内撞成一团，你是被人从碑下拖走的');
      }
    }),
    forkEvent({
      id: 'th_xian_well', name: '古井寒泉', tier: 2, weight: 2.3,
      desc: '一口冬天也不结冰的井',
      available: inBand(41, 50), powerRef: 48000, midBase: 0.40, hotBase: 0.20,
      setup: function () { return { herb: PICK(T2_HERB) }; },
      lead: function (g, U, s) {
        return '后山一口废井冬天也不结冰。井口白气森森，有人从里面捞出过' + s.herb + '，也有人捞上来一具自己的尸体——那人当时还活着';
      },
      note: '舀一瓢洗经脉最稳；跳下去碰泉眼，成了能多活一截，败了要冻伤根本。',
      midLabel: '吊桶舀水', midDesc: '寒泉洗体，寿元与战力微涨',
      hotLabel: '绳断也要下去', hotDesc: '碰到泉眼则寿元大补；失败冻伤',
      back: function (g, U) { U.printlog('你盖上井盖。这种井，看一眼就够了'); },
      midOk: function (g, U, s) {
        var c = U.cultPct(g, 0.022, 0.040, 320);
        var lf = U.gainLife(g, 18, 50);
        U.printlog('一瓢寒泉浇在头顶，你打了个寒颤，体内杂质却跟着汗一起出来' + (lf ? '，寿元+' + lf : '') + '，实力+' + c);
      },
      midFail: function (g, U) {
        hurtLine(g, U, 20, 60, '水刚沾唇你就吐了，井里的东西不让喝', '寒气顺着喉咙往下砸，你咳了一夜血');
      },
      hotOk: function (g, U) {
        var c = U.cultPct(g, 0.035, 0.05, 520);
        var lf = U.gainLife(g, 40, 60);
        U.printlog('你在井底摸到泉眼。那点水比刀还利，刮过一遍，你觉得自己又能多活些年' + (lf ? '，寿元+' + lf : '') + '，实力+' + c);
      },
      hotFail: function (g, U) {
        hurtLine(g, U, 45, 110, '你在井壁上磕破头，疼醒了，没敢再往下', '寒气封住四肢，是村里人把你吊上来的');
      }
    }),
    forkEvent({
      id: 'th_xian_pill', name: '同门夺丹', tier: 2, weight: 2.5,
      desc: '一枚破境丹，两个人',
      available: inBand(41, 52), powerRef: 52000, midBase: 0.38, hotBase: 0.18,
      setup: function () { return { who: rival() }; },
      lead: function (g, U, s) {
        return '丹房出事，一枚破境丹滚到廊下。' + s.who + '已经伸手，你也到了——这枚丹，够一个人当场再进一步';
      },
      note: '让开最稳；抢到手能破境。败了只是挨打，丹房里没人敢当场打死同门。',
      midLabel: '出声喝止', midDesc: '吓退则平分残丹；失败被反咬',
      hotLabel: '上手去夺', hotDesc: '夺到则破境一层；失败被打伤',
      back: function (g, U, s) { U.printlog('你退了一步。' + s.who + '把丹吞了，看你的眼神里多了一点东西，说不清是谢还是嘲'); },
      midOk: function (g, U) {
        var c = U.cultPct(g, 0.025, 0.042, 360);
        U.printlog('你一声断喝，对方手一滞，丹裂成两半。半枚入腹，滞关松了半分，实力+' + c);
      },
      midFail: function (g, U, s) {
        hurtLine(g, U, 22, 65, '对方把丹塞进嘴里，你没再抢', s.who + '反手一掌拍在你胸口，丹他吞了');
      },
      hotOk: function (g, U) {
        var c = U.cultPct(g, 0.04, 0.05, 580);
        U.up(g, 1);
        U.printlog('你比他快半息。丹入腹的那一下，眼前的关口像纸一样破了，实力+' + c);
      },
      hotFail: function (g, U, s) {
        hurtLine(g, U, 40, 100, '掌风擦过耳际，你就势滚开，丹没抢到人还在', s.who + '一肘砸在你肋上，丹他吞了，你在廊下躺到天黑');
      }
    }),
    forkEvent({
      id: 'th_xian_array', name: '崖上残阵', tier: 2, weight: 2.2,
      desc: '半座还在转的旧阵',
      available: inBand(41, 55), powerRef: 55000, midBase: 0.36, hotBase: 0.17, tag: 'dungeon',
      setup: function () { return { gong: PICK(T2_GONG) }; },
      lead: function (g, U, s) {
        return '悬崖半腰有半座旧阵还在转。阵心里压着一卷' + s.gong + '的残篇，阵纹一圈圈收，像在等人自己走进去';
      },
      note: '在外围描阵纹能学一点；走进阵心，残篇是你的，败了被阵绞伤。',
      midLabel: '外围描纹', midDesc: '学得残篇皮毛',
      hotLabel: '踏进阵心', hotDesc: '取得残篇正本，或被绞伤',
      back: function (g, U) { U.printlog('你沿原路退回。阵还在转，残篇还在，只是不归你'); },
      midOk: function (g, U, s) {
        var c = U.cultPct(g, 0.020, 0.038, 300);
        var d = U.irand(3, 6);
        U.gainDao(g, d);
        U.printlog('你把阵纹在地上画了三遍，' + s.gong + '的呼吸法自己会走了，实力+' + c + '，道蕴+' + d);
        if (U.markStory) U.markStory(g, 'array_wake');
      },
      midFail: function (g, U) {
        hurtLine(g, U, 18, 55, '阵纹一闪，你闭上眼，什么都没学到', '残阵反噬，指尖裂开，你连笔都握不住');
      },
      hotOk: function (g, U, s) {
        var c = U.cultPct(g, 0.038, 0.05, 540);
        var d = U.irand(4, 6);
        U.gainDao(g, d);
        U.printlog('你踏进阵心的瞬间阵停了。残篇落到掌心，' + s.gong + '缺的那一节自己补上，实力+' + c + '，道蕴+' + d);
        if (U.markStory) U.markStory(g, 'array_wake');
      },
      hotFail: function (g, U) {
        hurtLine(g, U, 48, 115, '阵纹收拢前你滚了出来，残篇没拿到', '阵绞了你三圈，是过路的散修把你从崖上捞起来的');
      }
    }),
    forkEvent({
      id: 'th_xian_gamble_stone', name: '黑市赌石', tier: 2, weight: 2.3,
      desc: '三块源石，切开才知道里面是什么',
      available: inBand(41, 58), powerRef: 50000, midBase: 0.40, hotBase: 0.16,
      lead: '夜市最里头三块源石码成一排。摊主说左边那块听过心跳，中间那块是哑巴，右边那块有人出过半条命。切开才算数',
      note: '切开中间最稳；切开左边可能发一笔。败了只是亏材料，摊上不让死人。',
      midLabel: '切开中间', midDesc: '多半是普通矿，偶尔有灵汁',
      hotLabel: '切开左边', hotDesc: '可能是一窝灵液；也可能是空石',
      back: function (g, U) { U.printlog('你把钱收进袖里。赌石这种事，看别人切就够了'); },
      midOk: function (g, U) {
        var c = U.cultPct(g, 0.018, 0.036, 280);
        U.printlog('中间那块剖开是一汪浅色灵汁，你就着石皮喝了，实力+' + c);
      },
      midFail: function (g, U) {
        U.printlog('中间是空的。摊主也不说话，只把石皮扫进篓里');
      },
      hotOk: function (g, U) {
        var c = U.cultPct(g, 0.04, 0.05, 560);
        var lf = U.gainLife(g, 20, 55);
        U.printlog('左边那块剖开的瞬间，一窝灵液溅到你腕上。摊主脸色变了，你已经把灵液逼进自己四肢' + (lf ? '，寿元+' + lf : '') + '，实力+' + c);
      },
      hotFail: function (g, U) {
        hurtLine(g, U, 16, 50, '左边也是空的。你笑了笑，把石皮放下', '石里喷出浊气，你退慢了半步，咳了两天');
      }
    }),
    forkEvent({
      id: 'th_neng_escort', name: '护送药车', tier: 2, weight: 2.2,
      desc: '一车圣药要过黑林',
      available: inBand(51, 62), powerRef: 90000, midBase: 0.38, hotBase: 0.18,
      setup: function () { return { herb: PICK(T3_HERB), sect: PICK(SECTS) }; },
      lead: function (g, U, s) {
        return s.sect + '的药车要过黑林，车里是一株' + s.herb + '。他们缺一个敢走林子的人，说事成之后可以让你闻一闻药香';
      },
      note: '跟车走半道最稳；你自己押车过林，成了能分一截药力，败了挨刀。',
      midLabel: '跟到林边', midDesc: '护送半程，分一点辛苦钱',
      hotLabel: '自己押车', hotDesc: '过林则分药力；失败遇劫',
      back: function (g, U) { U.printlog('你摇头。这种车，看一眼就知道后面跟着多少双眼睛'); },
      midOk: function (g, U) {
        var c = U.cultPct(g, 0.022, 0.040, 500);
        U.printlog('你把车送到林边就收手。车主扔给你一袋碎源，你炼进去，实力+' + c);
      },
      midFail: function (g, U) {
        hurtLine(g, U, 24, 70, '林边有人拦路，你把车一丢就走，人没事', '林边那一刀是冲着车来的，你用肩膀挡了一下');
      },
      hotOk: function (g, U, s) {
        var c = U.cultPct(g, 0.038, 0.05, 900);
        var lf = U.gainLife(g, 25, 60);
        U.printlog('黑林里那几拨人你都绕开了。车主把' + s.herb + '掰下一小截塞给你' + (lf ? '，寿元+' + lf : '') + '，实力+' + c);
      },
      hotFail: function (g, U) {
        hurtLine(g, U, 50, 130, '劫道的人比药车多，你把车扔了，自己从树上溜回去', '你押着车走进伏击圈，是爬着出来的');
      }
    }),
    forkEvent({
      id: 'th_neng_duel', name: '古族少主约战', tier: 2, weight: 2.3,
      desc: '约的是面子，不是命',
      available: inBand(51, 64), powerRef: 100000, midBase: 0.36, hotBase: 0.17,
      setup: function () { return { who: rival() }; },
      lead: function (g, U, s) {
        return s.who + '在城门口点你的名，说你不配走这条街。围了一圈人，约的是点到为止——可点到为止的架，打输了也很难看';
      },
      note: '应一声比划比划能涨声名；认真出手，赢了能压过同代，输了只是受伤。',
      midLabel: '点到为止', midDesc: '走两招就收，赚一点实战',
      hotLabel: '认真出手', hotDesc: '压过同代则修为暴涨；失败受伤',
      back: function (g, U, s) { U.printlog('你从另一条街走了。' + s.who + '的嘲笑跟着走出三条巷，你当没听见'); },
      midOk: function (g, U) {
        var c = U.cultPct(g, 0.024, 0.042, 560);
        U.printlog('两招之后你收手。对方也收了。围观的人有的喝彩有的嘘，你只记得自己那两招比昨天快，实力+' + c);
      },
      midFail: function (g, U) {
        hurtLine(g, U, 20, 60, '你主动认了，对方也没再逼', '点到为止变成他一掌拍实，你退了七步');
      },
      hotOk: function (g, U, s) {
        var c = U.cultPct(g, 0.04, 0.05, 1100);
        U.printlog('你把' + s.who + '打退到城墙根。他的护卫要上，他自己抬手拦住。这一场之后，这条街没人再拦你，实力+' + c);
      },
      hotFail: function (g, U, s) {
        hurtLine(g, U, 45, 120, '你看自己要输，主动坐下，对方也给了面子', s.who + '最后一掌没留手，你在城门口躺到宵禁');
      }
    }),

    /* ---------- 王者 / 圣人 / 大圣 / 准帝：梭哈，战力是主奖 ---------- */
    allinEvent({
      id: 'th_wang_mine', name: '血色矿脉', tier: 3, weight: 1.1,
      desc: '矿脉深处在跳，像有一颗心',
      available: inBand(61, 72), powerRef: 160000, steadyBase: 0.36, allinBase: 0.10,
      setup: function () { return { herb: PICK(T3_HERB) }; },
      lead: function (g, U, s) {
        return '一座废弃古矿的最深处在跳，像有一颗心。矿工说那是' + s.herb + '的母脉，也有人说是一头没死干净的矿兽';
      },
      note: '挖外围矿渣能稳赚；挖到母脉，成了战力能翻一截，败了可能被矿脉吞掉。',
      steadyLabel: '挖外围', steadyDesc: '矿渣也能炼', allinLabel: '挖到母脉', allinDesc: '成功则战力暴涨',
      back: function (g, U) { U.printlog('你退出矿洞。跳动声在背后停了，像是什么东西听你走远了才重新跳'); },
      steadyOk: function (g, U, s) {
        var c = U.cultPct(g, 0.05, 0.10, 1800);
        U.printlog('外围矿渣里果然夹着' + s.herb + '的碎屑，你炼了三天，实力+' + c);
      },
      steadyFail: function (g, U) {
        hurtLine(g, U, 40, 110, '矿壁塌了一角，你退得快', '矿渣里喷出毒雾，你是爬出来的');
      },
      allinOk: function (g, U, s) {
        var c = U.cultPct(g, 0.08, 0.13, 3600);
        U.printlog('母脉剖开的瞬间，一股比血还稠的灵液灌进你四肢。那颗「心」停了，实力+' + c);
      },
      deadText: '矿脉合拢，你连一声都没来得及发'
    }),
    allinEvent({
      id: 'th_wang_caravan', name: '截杀运宝队', tier: 3, weight: 1.0,
      desc: '夜路上一支熄了灯的车队',
      available: inBand(61, 74), powerRef: 170000, steadyBase: 0.34, allinBase: 0.09,
      setup: function () { return { bing: PICK(T3_BING), who: rival() }; },
      lead: function (g, U, s) {
        return '夜路上有一支熄了灯的车队。车辕上罩着布，布角露出' + s.bing + '的一截柄。押车的是' + s.who + '的人';
      },
      note: '摸一辆边车能拿点散财；劫中军，成了兵在你手里，败了就是敌。',
      steadyLabel: '摸边车', steadyDesc: '散财与矿材', allinLabel: '劫中军', allinDesc: '夺下重器',
      back: function (g, U) { U.printlog('你让开夜路。这种车队，看一眼就知道后面是一座城的怒火'); },
      steadyOk: function (g, U) {
        var c = U.cultPct(g, 0.05, 0.11, 2000);
        U.printlog('边车上是两箱矿材，你扛走一箱，天亮前炼进骨头里，实力+' + c);
      },
      steadyFail: function (g, U) {
        hurtLine(g, U, 50, 130, '巡夜的人喝了一声，你钻进树里', '暗器擦过小腿，你把箱子扔了才跑掉');
      },
      allinOk: function (g, U, s) {
        var c = U.cultPct(g, 0.09, 0.14, 4200);
        U.printlog('中军乱了片刻。' + s.bing + '到了你手里，柄上的温度还是别人的，实力+' + c);
      },
      deadText: '伏兵比你想象的多，夜路尽头没有你'
    }),
    allinEvent({
      id: 'th_sheng_mountain', name: '圣山拜山', tier: 3, weight: 1.05,
      desc: '圣山不开门，但山门前那道禁制在喘气',
      available: inBand(71, 82), powerRef: 260000, steadyBase: 0.33, allinBase: 0.08,
      setup: function () { return { sect: PICK(SECTS), gong: PICK(T3_GONG) }; },
      lead: function (g, U, s) {
        return s.sect + '的圣山不开门。山门前那道禁制却在喘气，像是有人故意留了一线。线后面隐约是一卷' + s.gong;
      },
      note: '在禁制外观想能学皮毛；闯一线，成了卷在你怀里，败了可能被山门抹掉。',
      steadyLabel: '门外观想', steadyDesc: '学得皮毛', allinLabel: '闯那一线', allinDesc: '夺卷或身陨',
      back: function (g, U, s) { U.printlog('你对着' + s.sect + '的山门作了个揖，下山了。有些门，拜一拜就够'); },
      steadyOk: function (g, U, s) {
        var c = U.cultPct(g, 0.06, 0.11, 3200);
        var d = U.irand(10, 22);
        U.gainDao(g, d);
        U.printlog('你在禁制外坐了四十九日，' + s.gong + '的呼吸被你记下了七成，实力+' + c + '，道蕴+' + d);
      },
      steadyFail: function (g, U) {
        hurtLine(g, U, 70, 180, '禁制闪了一下，你及时退开', '山门回了一记，你吐出一口黑血');
      },
      allinOk: function (g, U, s) {
        var c = U.cultPct(g, 0.09, 0.14, 7000);
        var d = U.irand(16, 32);
        U.gainDao(g, d);
        U.printlog('你从那一线挤进去。' + s.gong + '落到怀里的时候，山门像叹了口气，实力+' + c + '，道蕴+' + d);
      },
      deadText: '禁制合拢，圣山连你的名字都不记得'
    }),
    allinEvent({
      id: 'th_sheng_mark', name: '帝痕观想', tier: 3, weight: 1.0,
      desc: '石壁上浅浅一道，像谁随手划的',
      available: inBand(71, 84), powerRef: 280000, steadyBase: 0.32, allinBase: 0.08,
      setup: function () { return { mi: PICK(T3_MI) }; },
      lead: function (g, U, s) {
        return s.mi + '的石壁上有一道浅痕，像谁随手划的。盯久了，你会觉得那不是划痕，是一道还没走完的帝则';
      },
      note: '看一眼就走能留下余温；盯着把它走完，成了烙进道基，败了道被盖过去。',
      steadyLabel: '看一眼就走', steadyDesc: '余温入体', allinLabel: '把那一痕走完', allinDesc: '烙进道基或反噬',
      back: function (g, U) { U.printlog('你闭上眼退开。有些痕迹，不是这个境界该看完的'); },
      steadyOk: function (g, U) {
        var c = U.cultPct(g, 0.06, 0.12, 3600);
        var d = U.irand(12, 26);
        U.gainDao(g, d);
        U.printlog('你只看了一眼。那一眼在心里放了很久，像有人替你把路指了一寸，实力+' + c + '，道蕴+' + d);
      },
      steadyFail: function (g, U) {
        g.daoyun = Math.max(0, (g.daoyun || 0) - U.irand(4, 12));
        U.printlog('那道痕太锋，你看完只觉得自己的道浅了一截，连忙退走');
      },
      allinOk: function (g, U) {
        var c = U.cultPct(g, 0.10, 0.14, 8000);
        var d = U.irand(20, 36);
        U.gainDao(g, d);
        U.printlog('你把那一痕从起手看到收势。石壁还是石壁，你已经不是进谷时的那个人，实力+' + c + '，道蕴+' + d);
      },
      deadText: '帝痕中的意志顺着目光反压过来，你的道被盖了个干净'
    }),
    allinEvent({
      id: 'th_dasheng_mansion', name: '大圣遗府', tier: 3, weight: 1.05,
      desc: '一座没有门牌的府邸，灯却亮着',
      available: inBand(81, 90), powerRef: 360000, steadyBase: 0.31, allinBase: 0.07,
      setup: function () { return { region: PICK(REGIONS), secret: PICK(NINE_SECRETS) }; },
      lead: function (g, U, s) {
        return s.region + '深处有一座没有门牌的府邸，灯却亮着。门楣上落着灰，灰下是一位大圣的姓。堂上残卷翻开半页，隐约是' + s.secret;
      },
      note: '在廊下抄半页最稳；进堂拿走残卷，成了字秘入体，败了触发遗府禁制。',
      steadyLabel: '廊下抄半页', steadyDesc: '余韵入体', allinLabel: '进堂取卷', allinDesc: '字秘或身陨',
      back: function (g, U) { U.printlog('你在府门外站了一会儿，把灰重新拂回门楣上，走了'); },
      steadyOk: function (g, U, s) {
        var c = U.cultPct(g, 0.07, 0.12, 5000);
        var d = U.irand(14, 28);
        U.gainDao(g, d);
        U.printlog('你把那半页' + s.secret + '抄在自己手心里。字不完整，意思却通了，实力+' + c + '，道蕴+' + d);
      },
      steadyFail: function (g, U) {
        hurtLine(g, U, 90, 220, '廊下机关轻响，你退回门外', '灰里藏着禁制，你的手背裂开一道口');
      },
      allinOk: function (g, U, s) {
        var c = U.cultPct(g, 0.10, 0.14, 9000);
        var d = U.irand(22, 38);
        U.gainDao(g, d);
        U.printlog('堂上的灯灭了。' + s.secret + '那一页自己飞到你手里，像等了很久，实力+' + c + '，道蕴+' + d);
      },
      deadText: '遗府认主失败，禁制把你和灯一起熄了'
    }),
    allinEvent({
      id: 'th_dasheng_edge', name: '禁区边缘试探', tier: 3, weight: 0.95,
      desc: '禁区的雾比往年淡了一指',
      available: inBand(81, 92), powerRef: 380000, steadyBase: 0.30, allinBase: 0.07,
      setup: function () { return { mi: PICK(T4_MI) }; },
      lead: function (g, U, s) {
        return s.mi + '外围的雾比往年淡了一指。有人说里面的至尊在闭目，也有人说是在等人自己送上去';
      },
      note: '拾遗外围能捡到被吐出来的残宝；踏进淡雾那一指，成了机缘，败了可能被禁区点名。',
      steadyLabel: '拾遗外围', steadyDesc: '残宝与药渣', allinLabel: '踏进淡雾', allinDesc: '深入或被点名',
      back: function (g, U, s) { U.printlog('你对着' + s.mi + '的方向作揖，退了十里。雾又浓回去了'); },
      steadyOk: function (g, U) {
        var c = U.cultPct(g, 0.07, 0.12, 5500);
        var lf = U.gainLife(g, 40, 120);
        U.printlog('外围石缝里卡着一截被吐出来的药渣，你炼了进去' + (lf ? '，寿元+' + lf : '') + '，实力+' + c);
      },
      steadyFail: function (g, U) {
        hurtLine(g, U, 100, 260, '雾里伸出一只手，你退得快', '雾擦过肩头，那一块皮肉从此再没暖和过');
      },
      allinOk: function (g, U) {
        var c = U.cultPct(g, 0.10, 0.14, 10000);
        U.printlog('淡雾那一指里没有至尊，只有一枚被遗弃的源种。你把它按进自己的苦海，实力+' + c);
      },
      deadText: '禁区点了你的名，雾重新合上'
    }),
    allinEvent({
      id: 'th_quasi_private', name: '准帝私斗', tier: 3, weight: 1.1,
      desc: '不在台上，在没人看见的谷里',
      available: inBand(91, 99), powerRef: 520000, steadyBase: 0.30, allinBase: 0.08,
      setup: function () { return { who: rival() }; },
      lead: function (g, U, s) {
        return s.who + '约你去没人看见的谷里。台上的争锋有规则，谷里没有——他说想看看，你到底是不是那个能走完帝路的人';
      },
      note: '走两招就散能各进一步；认真分胜负，赢了战力能压过同代准帝，败了可能再也走不出这谷。',
      steadyLabel: '走两招就散', steadyDesc: '各进一步', allinLabel: '认真分胜负', allinDesc: '压过同代或身陨',
      back: function (g, U, s) { U.printlog('你没去。' + s.who + '后来也没再提，只是再见面时，中间隔了一层什么'); },
      steadyOk: function (g, U) {
        var c = U.cultPct(g, 0.07, 0.12, 8000);
        U.printlog('两招之后你们都退了。谷里的草被掌风割倒一片，你们谁都没再往下说，实力+' + c);
      },
      steadyFail: function (g, U) {
        hurtLine(g, U, 120, 300, '对方收手比你快，这场就算了', '第三招他没按约定收，你吐了口血退出谷');
      },
      allinOk: function (g, U, s) {
        var c = U.cultPct(g, 0.10, 0.14, 14000);
        U.printlog(s.who + '坐在谷底，好久才笑了一声。他说这谷里的风，从今往后认你，实力+' + c);
      },
      deadText: '谷里没有证人，也没有你'
    }),
    allinEvent({
      id: 'th_quasi_scripture', name: '半卷帝经', tier: 3, weight: 1.0,
      desc: '残卷只剩下半，上半据说在帝关里',
      available: inBand(91, 99), powerRef: 540000, steadyBase: 0.28, allinBase: 0.07,
      setup: function () { return { chuan: PICK(T3_CHUAN) }; },
      lead: function (g, U, s) {
        return '一位将死的老修把半卷' + s.chuan + '塞进你手里。他说上半卷在帝关里，谁先叩谁先看见——你也可以现在就试着把下半补完';
      },
      note: '按残卷推演能涨道蕴；强行补全，成了经义入骨，败了可能被残卷反噬道消。',
      steadyLabel: '按残卷推演', steadyDesc: '道蕴与战力稳涨', allinLabel: '强行补全', allinDesc: '经义入骨或反噬',
      back: function (g, U) { U.printlog('你把残卷封进玉匣。有些经，缺着比补完更像它自己'); },
      steadyOk: function (g, U, s) {
        var c = U.cultPct(g, 0.08, 0.13, 9000);
        var d = U.irand(20, 40);
        U.gainDao(g, d);
        U.printlog('你按着' + s.chuan + '的下半推了九年，缺的地方你不填，只把自己的理解写在页边，实力+' + c + '，道蕴+' + d);
      },
      steadyFail: function (g, U) {
        U.printlog('残卷前后对不上。你合上它，承认自己还没到能补的时候');
      },
      allinOk: function (g, U, s) {
        var c = U.cultPct(g, 0.11, 0.14, 16000);
        var d = U.irand(28, 48);
        U.gainDao(g, d, 12);
        U.printlog('你把' + s.chuan + '缺的上半用自己的道补完。补完的那一瞬，你分不清哪一句是古人的，哪一句是你的，实力+' + c + '，道蕴+' + d);
      },
      deadText: '残卷反卷，把你的道从中间撕开'
    }),
    allinEvent({
      id: 'th_quasi_night_offer', name: '帝关前夜', tier: 4, weight: 0.55,
      desc: '叩关前一夜，有人在关下烧香',
      available: inBand(96, 99), powerRef: 620000, steadyBase: 0.30, allinBase: 0.06, minAge: 200,
      setup: function () { return { who: rival() }; },
      lead: function (g, U, s) {
        return '帝关前一夜，' + s.who + '在关下烧了一炷香。香灰里埋着一枚他多年不服的源种，他说：你要是敢拿走，这关我们一起叩；你要是不敢，这关就他先走';
      },
      note: '分半枚源种能各进一步；独吞，成了关前最后一截战力，败了可能先死在关下。',
      steadyLabel: '各分一半', steadyDesc: '两人各进一步', allinLabel: '独吞源种', allinDesc: '关前暴涨或先死',
      back: function (g, U, s) { U.printlog('你没拿。' + s.who + '自己把源种吞了，对你点了下头，先向帝关走去'); },
      steadyOk: function (g, U) {
        var c = U.cultPct(g, 0.09, 0.16, 12000);
        U.printlog('源种掰开，两人各吃一半。这一夜谁都没再说话，实力+' + c);
      },
      steadyFail: function (g, U) {
        hurtLine(g, U, 140, 360, '源种一分为二时炸了，你们都没吃成', '半枚源种在你掌心炸开，这一夜你没能站起来');
      },
      allinOk: function (g, U) {
        var c = U.cultPct(g, 0.12, 0.22, 18000);
        U.printlog('你把源种整枚按进自己的道海。关下那炷香灭了，对方看了你很久，什么都没说，实力+' + c);
      },
      deadText: '源种认主失败，你死在帝关下，连关都没碰到'
    }),

    /* ---------- 余波：前事留下钩子，后事才上门，不弹窗 ---------- */
    {
      id: 'th_echo_omen', name: '教主余恨', tier: 2, tag: 'echo',
      desc: '天象那夜没完', needStory: 'omen_grudge', weight: 8, maxCount: 1,
      minAge: 50, maxAge: 100000,
      available: function (g) { return !g.becameEmperor && (g.lvl || 1) >= 51; },
      cond: function (g) { return Math.random() < 0.82; },
      ok: function (g, U) {
        if (U.clearStory) U.clearStory(g, 'omen_grudge');
        var c = U.cultPct(g, 0.018, 0.032, 900);
        U.printlog('天象那夜围你的人又来了。你没开门，在后山把来人打退，实力+' + c);
      },
      fail: function (g, U) {
        if (U.clearStory) U.clearStory(g, 'omen_grudge');
        var h = U.hurt(g, 28, 70);
        U.printlog(h.loss ? '教主的人堵在洞府外，你走偏门才脱身，寿元-' + h.loss :
          '教主的人在山下转了一夜，没有上来');
      }
    },
    {
      id: 'th_echo_herb', name: '药气泄露', tier: 2, tag: 'echo',
      desc: '圣药的香还没散', needStory: 'herb_scent', weight: 8, maxCount: 1,
      minAge: 20, maxAge: 100000,
      available: function (g) { return !g.becameEmperor && (g.lvl || 1) >= 11; },
      cond: function (g) { return Math.random() < 0.80; },
      ok: function (g, U) {
        if (U.clearStory) U.clearStory(g, 'herb_scent');
        var c = U.cultPct(g, 0.016, 0.028, 400);
        var lf = U.gainLife(g, 12, 28);
        U.printlog('有人循着药香摸到洞府。你把剩余药渣炼进自身，把来人打发走了' +
          (lf ? '，寿元+' + lf : '') + '，实力+' + c);
      },
      fail: function (g, U) {
        if (U.clearStory) U.clearStory(g, 'herb_scent');
        U.printlog('药香引来了采药人。他们在山门外转了一圈，没有敢进');
      }
    },
    {
      id: 'th_echo_tide', name: '潮退旧债', tier: 2, tag: 'echo',
      desc: '潮里拍过你的人还记得', needStory: 'tide_debt', weight: 8, maxCount: 1,
      minAge: 120, maxAge: 100000,
      available: function (g) { return !g.becameEmperor && (g.lvl || 1) >= 61 && (g.lvl || 1) <= 80; },
      cond: function (g) { return Math.random() < 0.80; },
      ok: function (g, U) {
        if (U.clearStory) U.clearStory(g, 'tide_debt');
        var c = U.cultPct(g, 0.020, 0.036, 1100);
        U.printlog('潮退之后，有人来讨那一夜的气运。你把债还在拳上，王者境又实了一分，实力+' + c);
      },
      fail: function (g, U) {
        if (U.clearStory) U.clearStory(g, 'tide_debt');
        var h = U.hurt(g, 24, 60);
        U.printlog(h.loss ? '讨债的人比潮还狠。你退了半步，寿元-' + h.loss :
          '讨债的人在门外站了一夜，天亮就走了');
      }
    },
    {
      id: 'th_echo_script', name: '残篇故人', tier: 2, tag: 'echo',
      desc: '补过的那卷残篇还有原主', needStory: 'remnant_owner', weight: 8, maxCount: 1,
      minAge: 14, maxAge: 100000,
      available: function (g) { return !g.becameEmperor && (g.lvl || 1) >= 11; },
      cond: function (g) { return Math.random() < 0.80; },
      ok: function (g, U) {
        if (U.clearStory) U.clearStory(g, 'remnant_owner');
        var c = U.cultPct(g, 0.014, 0.026, 260);
        var d = U.irand(3, 6);
        U.gainDao(g, d);
        U.printlog('补残篇的人找上门来。他看过你补的字，没有夺书，只把缺的另一角也留给你，实力+' + c + '，道蕴+' + d);
      },
      fail: function (g, U) {
        if (U.clearStory) U.clearStory(g, 'remnant_owner');
        U.printlog('有人在市集打听那卷残篇。你把书换了个匣，没有见他');
      }
    },
    {
      id: 'th_echo_market', name: '髓香追来', tier: 2, tag: 'echo',
      desc: '暗市那件东西有人记得气味', needStory: 'dark_buy', weight: 8, maxCount: 1,
      minAge: 80, maxAge: 100000,
      available: function (g) { return !g.becameEmperor && (g.lvl || 1) >= 61; },
      cond: function (g) { return Math.random() < 0.80; },
      ok: function (g, U) {
        if (U.clearStory) U.clearStory(g, 'dark_buy');
        var c = U.cultPct(g, 0.022, 0.038, 1400);
        U.printlog('暗市散了，有人循着髓香追到你的船上。你把货炼进自己，把尾巴甩掉，实力+' + c);
      },
      fail: function (g, U) {
        if (U.clearStory) U.clearStory(g, 'dark_buy');
        var h = U.hurt(g, 30, 80);
        U.printlog(h.loss ? '追货的人比卖家还狠。你把东西沉进星海，寿元-' + h.loss :
          '有船跟了你一夜，天亮时看不见了');
      }
    },
    {
      id: 'th_echo_insight', name: '心湖余波', tier: 2, tag: 'echo',
      desc: '顿悟那一夜的波纹还在', needStory: 'insight_ripple', weight: 8, maxCount: 1,
      minAge: 20, maxAge: 100000,
      available: function (g) { return !g.becameEmperor && (g.lvl || 1) >= 11; },
      cond: function (g) { return Math.random() < 0.80; },
      ok: function (g, U) {
        if (U.clearStory) U.clearStory(g, 'insight_ripple');
        var c = U.cultPct(g, 0.016, 0.028, 360);
        var d = U.irand(3, 6);
        U.gainDao(g, d);
        U.printlog('同辈循着那一夜的波纹找来。他没有夺悟，只把心湖又拍亮了一寸，实力+' + c + '，道蕴+' + d);
      },
      fail: function (g, U) {
        if (U.clearStory) U.clearStory(g, 'insight_ripple');
        U.printlog('有人在山下问：那一夜心湖是谁开的。你没有应声，波纹自己散了');
      }
    },
    {
      id: 'th_echo_array', name: '残阵未死', tier: 2, tag: 'echo',
      desc: '崖上那座阵还记得你', needStory: 'array_wake', weight: 8, maxCount: 1,
      minAge: 30, maxAge: 100000,
      available: function (g) { return !g.becameEmperor && (g.lvl || 1) >= 41; },
      cond: function (g) { return Math.random() < 0.80; },
      ok: function (g, U) {
        if (U.clearStory) U.clearStory(g, 'array_wake');
        var c = U.cultPct(g, 0.016, 0.028, 360);
        var d = U.irand(3, 6);
        U.gainDao(g, d);
        U.printlog('夜里洞府外自己转起半圈旧阵。你按那一夜描过的纹走了一遍，阵停了，实力+' + c + '，道蕴+' + d);
      },
      fail: function (g, U) {
        if (U.clearStory) U.clearStory(g, 'array_wake');
        U.printlog('有人在崖下问：那座阵是谁停的。你没有上去，纹路自己散了');
      }
    },
    {
      id: 'th_echo_lecture', name: '讲席余音', tier: 2, tag: 'echo',
      desc: '圣贤那一席话还没散尽', needStory: 'lecture_echo', weight: 8, maxCount: 1,
      minAge: 40, maxAge: 100000,
      available: function (g) { return !g.becameEmperor && (g.lvl || 1) >= 45; },
      cond: function (g) { return Math.random() < 0.80; },
      ok: function (g, U) {
        if (U.clearStory) U.clearStory(g, 'lecture_echo');
        var c = U.cultPct(g, 0.016, 0.028, 360);
        var d = U.irand(3, 6);
        U.gainDao(g, d);
        U.printlog('同辈循着讲席余音找来。他没有夺悟，只把那一席没听清的半句补上，实力+' + c + '，道蕴+' + d);
      },
      fail: function (g, U) {
        if (U.clearStory) U.clearStory(g, 'lecture_echo');
        U.printlog('有人在山下问：圣贤那一席是谁听完的。你没有应声，余音自己散了');
      }
    }
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = EVENTS;
  root.EVENT_PACK_THRILL = EVENTS;
})(typeof self !== 'undefined' ? self : this);
