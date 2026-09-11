/* ============================================================
 * 遮天模拟器 · 随机事件包（dao）
 * 悟道、创法、道蕴积累，以及「不靠体质靠悟性」的纯悟性凡体路线。
 *
 * 设计要点：
 *   1. 创法是本包的核心玩法。选择型事件把 U.createArtChance 算出的真实
 *      成功率直接摆给玩家，由玩家按自己的道蕴水平决定推演哪一门。
 *   2. 触发情境刻意分散：闭关、战后、濒死、雷劫、论道、旧法崩坏、
 *      道则具现……而不是反复「你闭关推演」。
 *   3. 纯悟性凡体（innate<=2 且 daoGift>=8）走的是原著里最像
 *      「以道压人」的一条路，只给道蕴与创法机会，不加额外死亡率。
 * ============================================================ */
(function (root) {
  var POOLS = typeof module !== 'undefined' && module.exports ? require('./events-pools.js') : root.EVENT_POOLS;
  var PICK = POOLS.PICK, stage = POOLS.stage, lvNeed = POOLS.lvNeed;
  var SECTS = POOLS.SECTS, REGIONS = POOLS.REGIONS, RIVAL_TITLES = POOLS.RIVAL_TITLES, AGES = POOLS.AGES;
  var T2_MI = POOLS.T2_MI, T4_MI = POOLS.T4_MI;
  var T2_GONG = POOLS.T2_GONG, T3_GONG = POOLS.T3_GONG;

  /* ---------- 创法辅助 ---------- */

  /* 每类法门成形之后的体感描述，避免所有成法都是一句「威力大增」 */
  var ART_HINT = {
    scripture: '此后修行与道蕴积累都比从前顺畅',
    guard: '自此遇险时总能多出半分转圜余地',
    array: '布纹为局，攻守皆在你一念之间',
    secret: '破境时的那层窗户纸，从此薄了许多',
    soul: '元神有了根，日后逆活亦有所凭',
    killing: '同境之内，这一式便足以定胜负',
    longevity: '驻世之期延长，晚年血气不再急着枯竭',
    forbidden: '一念可裂星河，可它同样踩在大道的禁忌上'
  };

  function typeOf(g, U, id) {
    var t = U.artType ? U.artType(id) : null;
    if (t) return t;
    var list = U.availableArtTypes(g), i;
    for (i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function shuffled(arr) {
    var c = arr.slice(), i, j, tmp;
    for (i = c.length - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1));
      tmp = c[i]; c[i] = c[j]; c[j] = tmp;
    }
    return c;
  }

  /* 选项里显示的概率与 resolve 里判定的概率必须同源，一律走这里 */
  function adjChance(g, U, id, bonus) {
    var t = typeOf(g, U, id);
    var cap = (t && t.deadly) ? 0.60 : 0.93;
    var p = U.createArtChance(g, id) + (bonus || 0);
    return Math.max(0.03, Math.min(cap, Math.round(p * 1000) / 1000));
  }

  /* 创法不是「活得久就轮得到」的固定产出：要道蕴吃透当前境界、近期又撞过高阶机缘，
   * 两者共鸣才开窗口。判定见 sim.js 的 artResonance，标定依据见
   * docs/superpowers/specs/2026-09-10-thrill-economy-design.md 第 2 节。 */
  function createReady(g, U, skipDeadly) {
    var ready = U.artResonance(g);
    if (!ready && g.artGlimpse && U.daoFill && U.daoFill(g) >= 0.18) ready = true;
    if (!ready) return false;
    var list = U.availableArtTypes(g), i;
    for (i = 0; i < list.length; i++) if (!skipDeadly || !list[i].deadly) return true;
    return false;
  }

  /* 把当前能创的法门拼成选项。o: { want 之外还有 skipDeadly / bonus / first } */
  function artOptions(g, U, want, o) {
    o = o || {};
    var pool = shuffled(U.availableArtTypes(g)), out = [], i, t, ch, opt, n;
    pool.sort(function (a, b) {
      var pa = (o.first && a.id === o.first) ? -100 : U.artCount(g, a.id);
      var pb = (o.first && b.id === o.first) ? -100 : U.artCount(g, b.id);
      return pa - pb;
    });
    for (i = 0; i < pool.length && out.length < want; i++) {
      t = pool[i];
      if (o.skipDeadly && t.deadly) continue;
      n = U.artCount(g, t.id);
      ch = adjChance(g, U, t.id, o.bonus);
      opt = {
        id: 'art_' + t.id,
        label: '推演' + t.name + (n ? '（第' + (n + 1) + '门）' : ''),
        desc: t.desc + (t.deadly ?
          '；推演失败有 ' + U.pct(U.createArtDeathChance(g, t.id)) + ' 的概率当场道消' :
          '；推演失败只损道基，不致命'),
        chance: ch
      };
      if (t.deadly) opt.risk = 'deadly';
      out.push(opt);
    }
    return out;
  }

  function waitOption(label, desc) {
    return {
      id: 'wait',
      label: label || '暂缓推演，继续积累道蕴',
      desc: desc || '本次无收益也无损伤；道蕴越深，日后落笔越稳',
      safe: true
    };
  }

  function daoInfo(g, U) {
    return '道蕴 ' + U.round(g.daoyun) + '/' + U.round(g.daoyunCap) +
      ' · 悟性 ' + (g.daoGift || 5) +
      ' · 已自创 ' + ((g.createdArts && g.createdArts.length) || 0) + ' 门';
  }

  /* 推演结算：成功落笔成法并按 tier 给收益，失败按类型给道伤或致命反噬 */
  function resolveCreate(g, U, typeId, o) {
    o = o || {};
    var t = typeOf(g, U, typeId);
    if (!t) {
      U.printlog('那点灵光转瞬即逝，你终究没能把它落成文字');
      return false;
    }
    var chance = adjChance(g, U, typeId, o.bonus);
    if (Math.random() < chance) {
      var art = U.addCreatedArt(g, typeId);
      U.printlog(o.ok + '，一门' + t.name + '就此落成——《' + art.name + '》，' + (ART_HINT[typeId] || '自此为你独有'));
      var c, d;
      if (o.tier >= 4) {
        c = U.cultPct(g, 0.10, 0.22, 9000);
        d = U.grantCreateDao(g, 4);
      } else if (o.tier === 3) {
        c = U.cultPct(g, 0.05, 0.12, 2500);
        d = U.grantCreateDao(g, 3);
      } else {
        c = U.cultPct(g, 0.02, 0.045, 300);
        d = U.grantCreateDao(g, 2);
      }
      U.printlog('新法反哺己身，实力+' + c + '，道蕴+' + d);
      if (art.lifeAdd) U.printlog('法中自蕴驻世之理，寿元+' + art.lifeAdd);
      return true;
    }
    if (t.deadly && Math.random() < U.createArtDeathChance(g, typeId)) {
      U.kill(g, o.dead || '禁忌法则推演到一半忽然反卷，你连一声都未及发出，道消身死');
      return false;
    }
    var h = U.hurt(g, o.lo || 60, o.hi || 180);
    U.printlog(h.exempt ?
      (o.exempt || '法门雏形在成形前自行溃散，你及时收手，未伤根本') :
      (o.fail || '推演至关键处，大道反噬') + '，寿元 -' + h.loss);
    return false;
  }

  /* 纯悟性凡体：不靠体质、只靠一颗脑子的那条路 */
  function mortalDao(minLvl, maxLvl) {
    return function (g) {
      return !g.becameEmperor && g.innate <= 2 && (g.daoGift || 5) >= 8 &&
        g.lvl >= minLvl && (maxLvl == null || g.lvl <= maxLvl);
    };
  }
  function markMortal(g) { g.mortalDaoDeeds = (g.mortalDaoDeeds || 0) + 1; }

  var EVENTS = [

    /* ===================== tier 4 传说 ===================== */
    {
      id: 'dao_great_dao_manifest', weight: 0.5, maxCount: 2,
      name: '大道显形', tier: 4, tag: 'insight',
      desc: '万道在眼前露出真容，看得懂的只有一角',
      minAge: 150, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 81 && g.lvl < 100; },
      cond: function (g, U) { return U.isHighDaoyun(g) || Math.random() < 0.35; },
      ok: function (g, U) {
        var d = U.irand(40, 65);
        U.gainDao(g, d, 24);
        var c = U.cultPct(g, 0.12, 0.22, 15000);
        U.printlog('大道忽然在你面前显形：不是文字，不是图像，是一种看着就懂、移开眼便忘的东西。你死死盯了三天三夜，只记住其中极小的一角——这一角已让你此前百年的推演尽数重排，实力+' + c + '，道蕴+' + d);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 150, 400);
        U.printlog(h.exempt ? '那形影一闪即隐，你没有强追，只是长长吐出一口气' :
          '你强行去记那超出承载的东西，识海如遭重锤，寿元 -' + h.loss);
      }
    },
    {
      id: 'dao_tianxin_favor', weight: 0.3, maxCount: 1,
      name: '天心垂青', tier: 4, tag: 'daomark',
      desc: '天地间那点若有若无的「心」注意到了你',
      minAge: 400, maxAge: 10000,
      available: function (g, U) {
        return !g.becameEmperor && g.lvl >= 91 && g.lvl < 100 && U.isHighDaoyun(g);
      },
      cond: function (g, U) { return Math.random() < Math.min(0.55, 0.20 + g.daoyun / U.data.DAO_ABSOLUTE_MAX * 0.35); },
      ok: function (g, U) {
        var d = U.irand(45, 70);
        U.gainDao(g, d, 32);
        g.tianxinFavor = true;
        U.printlog('天地间那点若有若无的「心」似乎侧目看了你一眼。它不曾给你战力，不曾给你寿元，只是让你比同代人早半步望见路的走向——帝关仍要你自己去叩，但从今往后你不再摸黑走，道蕴+' + d + '，道蕴上限随之抬高');
      },
      fail: function (g, U) {
        var h = U.hurt(g, 120, 300);
        U.printlog(h.exempt ? '那一线垂青转瞬移开，你在原地枯坐了十年，什么也没等到' :
          '你试图追上那道注视，反被天地大势一荡，寿元 -' + h.loss);
      }
    },
    {
      id: 'dao_eternal_dao_sound', weight: 0.45, maxCount: 2,
      name: '万古道音', tier: 4, tag: 'insight',
      desc: '不知哪个年代传来的诵经声，仍在星空里回荡',
      minAge: 120, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 71 && g.lvl < 100; },
      cond: function (g, U) { return U.isHighDaoyun(g) || Math.random() < 0.40; },
      ok: function (g, U) {
        var era = PICK(AGES);
        var d = U.irand(30, 55);
        U.gainDao(g, d, 20);
        var c = U.cultPct(g, 0.08, 0.16, 8000);
        var lf = U.gainLife(g, 200, 600);
        U.printlog('一阵诵经声在死寂的星空里回荡，据说是' + era + '留下的余韵，万古不散。听过的人不知几何，听懂的万中无一——你是那个一，实力+' + c + '，道蕴+' + d + (lf ? '，道音洗过血肉，寿元+' + lf : ''));
      },
      fail: function (g, U) {
        var h = U.hurt(g, 100, 320);
        U.printlog(h.exempt ? '那道音太古老，你听了三年只听出一片苍茫，索性作罢' :
          '你强听万古之音，神魂几乎被那声浪冲散，寿元 -' + h.loss);
      }
    },
    {
      id: 'dao_emperor_mark_heart', weight: 0.5, maxCount: 2,
      name: '帝痕入心', tier: 4, tag: 'daomark',
      desc: '古帝随手留下的一道痕，看疯过许多人',
      minAge: 200, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 81 && g.lvl < 100; },
      cond: function (g, U) { return U.isHighDaoyun(g) || g.cult >= 160000; },
      ok: function (g, U) {
        var mi = PICK(T4_MI);
        var d = U.irand(35, 60);
        U.gainDao(g, d, 28);
        var c = U.cultPct(g, 0.09, 0.18, 12000);
        g.emperorMarkRead = (g.emperorMarkRead || 0) + 1;
        U.printlog('你在' + mi + '的石壁上见到一道帝痕，据说盯久了的人多半会疯。你只看了一眼便转身退开，把那一眼带回来，在心里放了整整一百年——一百年后，你终于敢承认自己看懂了半分，实力+' + c + '，道蕴+' + d);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 160, 450);
        g.daoyun = Math.max(0, g.daoyun - U.irand(10, 26));
        U.printlog(h.exempt ? '那道帝痕锋芒太盛，你在第一眼之后便闭目退走，只带回一片空白' :
          '帝痕中的意志顺着目光反压过来，你的道险些被人家的道盖过去，寿元 -' + h.loss);
      }
    },
    {
      id: 'dao_law_incarnate', weight: 0.4, maxCount: 2,
      name: '道则具现', tier: 4, tag: 'create',
      desc: '一条大道法则在身前具现，只停留一瞬',
      minAge: 200, maxAge: 10000,
      available: function (g, U) {
        return !g.becameEmperor && g.lvl >= 81 && g.lvl < 100 &&
          U.isHighDaoyun(g) && createReady(g, U, false);
      },
      choice: function (g, U) {
        var opts = artOptions(g, U, 3, { first: 'forbidden', bonus: 0.05 });
        opts.push(waitOption('目送它散去', '只把那一瞬记在心里，无收益也无风险'));
        return {
          lead: '你推演到极处时，一条大道法则竟自行在身前具现，像一根从天穹垂落的金线，触手可及',
          info: daoInfo(g, U) + ' · 法则加持：成功率 +5%',
          note: '借法则之力落笔，成法概率比平日更高；禁术一路若失败，反噬会当场要命。',
          options: opts
        };
      },
      resolve: function (g, U, optionId) {
        if (optionId === 'wait') {
          var d = U.irand(20, 34);
          U.gainDao(g, d, 12);
          U.printlog('你没有伸手。那根金线在你眼前安静地散了，可它垂落的那一瞬已经烙进识海，此后推演万法皆有参照，道蕴+' + d);
          return;
        }
        resolveCreate(g, U, optionId.slice(4), {
          tier: 4, bonus: 0.05, lo: 200, hi: 500,
          ok: '你伸手握住那根金线，借着它尚未散尽的余辉落笔',
          fail: '金线在你落笔到一半时散尽，未完成的法理无处安放，只能倒灌回己身',
          exempt: '金线散得比你想的更快，你收势及时，只是白白错过一场机缘',
          dead: '你以禁忌之法去锁大道法则，法则不肯被锁，反手将你一并抹去——连尸骨都未留下'
        });
      }
    },
    {
      id: 'dao_enlighten_tea_tree', weight: 0.35, maxCount: 1,
      name: '悟道古茶树', tier: 4, tag: 'insight',
      desc: '不死神药之一，一叶可换十年枯坐',
      minAge: 100, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 61 && g.lvl < 100; },
      cond: function (g, U) { return U.isHighDaoyun(g) || Math.random() < 0.45; },
      ok: function (g, U) {
        var d = U.irand(35, 60);
        U.gainDao(g, d, 24);
        var c = U.cultPct(g, 0.06, 0.14, 6000);
        var lf = U.gainLife(g, 300, 700);
        U.printlog('传说中的悟道古茶树只剩枝头最后几片叶子。你没有摘走，只煮了一壶，喝完便在树下坐了十年；那十年你一天功也没练，出来时却已不是原先那个人，实力+' + c + '，道蕴+' + d + (lf ? '，神药之气润入寿数，寿元+' + lf : ''));
      },
      fail: function (g, U) {
        var h = U.hurt(g, 80, 260);
        U.printlog(h.exempt ? '守树的老古董比你先到，你远远看了一眼便退走，没有争' :
          '为一叶茶与数尊老怪动手，你抢到了叶子却也挨了几记，寿元 -' + h.loss);
      }
    },
    {
      id: 'dao_read_others_emperor_road', weight: 0.3, maxCount: 1,
      name: '参悟他人帝路', tier: 4, tag: 'daomark',
      desc: '古帝走过的整条路，从第一步到最后叩关',
      minAge: 600, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 91 && g.lvl < 100; },
      choice: function (g, U) {
        var mid = U.clamp(0.35 + g.daoyun / U.data.DAO_ABSOLUTE_MAX * 0.35, 0.30, 0.78);
        var all = U.clamp(0.12 + g.daoyun / U.data.DAO_ABSOLUTE_MAX * 0.33 + ((g.daoGift || 5) - 5) * 0.012, 0.12, 0.55);
        return {
          lead: '一位古帝当年走过的路在星空里留下了完整烙印：从苦海第一步到最后那一次叩关，纤毫毕现，随时可以踏进去',
          info: daoInfo(g, U) + ' · 那是别人的路，走通了也只是「照着走」',
          note: '远观必有所得；走到中途收益更大；重走最后一步是拿命换道蕴，失败当场道消。',
          options: [
            { id: 'watch', label: '远观其起手三式', desc: '稳妥；只取自己能接住的那部分', safe: true },
            { id: 'follow', label: '沿帝路走到中途', desc: '成功得大量道蕴与实力；失败重伤', chance: Math.round(mid * 1000) / 1000 },
            { id: 'allin', label: '以己身重走那最后一步', desc: '成功道蕴暴涨、直逼帝关；失败道消身死',
              chance: U.allInFloor(all, g, 600000),
              deathChance: U.deathOdds(U.allInFloor(all, g, 600000), U.deathShare(g, 0.44, 600000)),
              risk: 'deadly' }
          ]
        };
      },
      resolve: function (g, U, optionId, log) {
        var d;
        if (optionId === 'watch') {
          d = U.irand(20, 32);
          U.gainDao(g, d, 12);
          U.printlog('你只看那位古帝最初的三式起手，反复看了八十年。前人怎样从苦海里爬出来，你终于看明白了，道蕴+' + d);
          return;
        }
        if (optionId === 'follow') {
          var mid = U.clamp(0.35 + g.daoyun / U.data.DAO_ABSOLUTE_MAX * 0.35, 0.30, 0.78);
          if (Math.random() < mid) {
            d = U.irand(40, 62);
            U.gainDao(g, d, 24);
            var c = U.cultPct(g, 0.12, 0.22, 16000);
            U.printlog('你踏着帝痕一路向前，走到那位古帝当年遇到的第一堵墙前才停下。他绕开了，你没有——你在墙前坐了三百年，替他把这道题做完了，实力+' + c + '，道蕴+' + d);
          } else {
            var h = U.hurt(g, 200, 550);
            U.printlog(h.exempt ? '走到半途你忽然醒觉：脚下每一步都在替别人重活一次，当即退了出来' :
              '帝路重压层层叠加，你的道躯在别人的道里被挤得几欲碎裂，寿元 -' + h.loss);
          }
          return;
        }
        var all = U.clamp(0.12 + g.daoyun / U.data.DAO_ABSOLUTE_MAX * 0.33 + ((g.daoGift || 5) - 5) * 0.012, 0.12, 0.55);
        var aOut = U.allIn(U.allInFloor(all, g, 600000), U.deathShare(g, 0.44, 600000));
        if (aOut === 'win') {
          d = U.irand(60, 70);
          U.gainDao(g, d, 32);
          var c2 = U.cultPct(g, 0.20, 0.30, 30000);
          g.walkedEmperorRoad = true;
          U.push(log, { cls: 'god', text: '你以自己的道硬生生重走了古帝的最后一步，走完之后没有成帝——因为那本就不是你的帝关。但你已站在门前，抬手就能敲。' });
          U.printlog('你踏进那最后一步的烙印中，让别人的极道从自己身上碾过一遍。骨断了又续，道碎了又聚，实力+' + c2 + '，道蕴+' + d);
          U.up(g, U.irand(1, 2), log);
        } else if (aOut === 'dead') {
          U.kill(g, '你以己身承接古帝最后一步的重量，那是整整一个时代压下来的分量——你的道在中途崩碎，连同你一起散进星空');
        } else {
          var ha = U.hurt(g, 240, 620);
          U.printlog(ha.loss ? '你在那最后一步上跪了下去，道基裂开，勉强爬了回来，寿元 -' + ha.loss :
            '你在门槛前收了势，没有把命交出去');
        }
      }
    },
    {
      id: 'dao_mortal_dao_fruit', weight: 0.35, maxCount: 1,
      name: '大道酬拙', tier: 4, tag: 'mortal_dao',
      desc: '一生没赢过一次体魄，却把稿纸堆得比神体更高',
      minAge: 300, maxAge: 10000,
      available: function (g, U) {
        return !g.becameEmperor && g.innate <= 2 && (g.daoGift || 5) >= 8 &&
          g.lvl >= 81 && g.lvl < 100 && U.isHighDaoyun(g);
      },
      cond: function (g, U) { return Math.random() < Math.min(0.72, 0.32 + g.daoyun / U.data.DAO_ABSOLUTE_MAX * 0.40); },
      ok: function (g, U) {
        var d = U.irand(45, 70);
        U.gainDao(g, d, 32);
        var c = U.cultPct(g, 0.15, 0.28, 20000);
        g.pureDaoFruit = true;
        markMortal(g);
        if (g.aptitude < 10) U.apt(g, 1);
        U.printlog('这一生你没有一次是靠体魄赢的。同代人身后是祖上的神体、古族的帝兵、圣地的护道人，你身后只有一屋子稿纸——可稿纸堆到今天，已经高过了那些神体。道心不灭，则道果不散，实力+' + c + '，道蕴+' + d);
      },
      fail: function (g, U) {
        U.printlog('你把毕生所学摊开重排，排到第九十九种可能时卡住了。凡骨终究撑不起这么大的推演，你合上稿纸，决定再等一等——反正等，你比谁都擅长');
      }
    },

    /* ===================== tier 3 稀有 ===================== */
    {
      id: 'dao_seclusion_deduce', weight: 1.4, maxCount: 4,
      name: '死关推演', tier: 3, tag: 'create',
      desc: '闭死关数十年，笔悬在空白兽皮上迟迟不落',
      minAge: 40, maxAge: 10000,
      available: function (g, U) {
        return !g.becameEmperor && g.lvl >= 31 && g.lvl < 100 && createReady(g, U, false);
      },
      choice: function (g, U) {
        var opts = artOptions(g, U, 3, {});
        opts.push(waitOption());
        return {
          lead: '你闭死关三十年，洞外藤蔓已经封住石门。案上摊着半张空白兽皮，笔悬在上面，迟迟没有落下',
          info: daoInfo(g, U),
          note: '成功率由你的道蕴、悟性与境界决定；同类法门创得越多，再创越难。',
          options: opts
        };
      },
      resolve: function (g, U, optionId) {
        if (optionId === 'wait') {
          U.printlog('你把笔搁回案上，吹熄了灯。三十年不算长，有些东西还没想透就写下来，写的便是错的');
          return;
        }
        resolveCreate(g, U, optionId.slice(4), {
          tier: 3, lo: 80, hi: 240,
          ok: '兽皮上第一笔落下，后面的便再也停不住，七日七夜一气呵成',
          fail: '写到第三卷时前后相抵，整套推演轰然塌了架',
          exempt: '你写到一半便看出根子上的错，把兽皮投进炉火，重新来过'
        });
      }
    },
    {
      id: 'dao_after_battle_create', weight: 1.2, maxCount: 3,
      name: '血未干时', tier: 3, tag: 'create',
      desc: '大战方歇，趁着那口气还没散',
      minAge: 60, maxAge: 10000,
      available: function (g, U) {
        return !g.becameEmperor && g.lvl >= 41 && g.lvl < 100 && createReady(g, U, false);
      },
      choice: function (g, U) {
        var opts = artOptions(g, U, 3, { bonus: 0.03 });
        opts.push(waitOption('先疗伤，把这口气存着', '无收益无损伤；那点战意留到下次再用'));
        return {
          lead: '大战方歇，你拄着断兵站在一地尸骸中间。对手临死前那一式还在眼前反复回放——趁着血没干，趁着那口气还没散',
          info: daoInfo(g, U) + ' · 余烬未冷：成功率 +3%',
          note: '战意正盛时落笔更准；但带伤推演，失败时伤上加伤。',
          options: opts
        };
      },
      resolve: function (g, U, optionId) {
        if (optionId === 'wait') {
          var c = U.cultPct(g, 0.03, 0.07, 1200);
          U.printlog('你坐下来先把断骨接回去。那一式你记住了，什么时候写出来不急——急的人都死在你脚边了，实力+' + c);
          return;
        }
        resolveCreate(g, U, optionId.slice(4), {
          tier: 3, bonus: 0.03, lo: 120, hi: 280,
          ok: '你以指沾血，就在对手的残兵上刻下第一行——杀出来的道理，果然比坐出来的利',
          fail: '血气一泄，刚刚还清晰无比的那一式忽然模糊；你强追不放，反被旧伤反噬',
          exempt: '那点战意散得太快，你及时停手，没有拿带伤的身子去赌'
        });
      }
    },
    {
      id: 'dao_deathbed_create', weight: 1.0, maxCount: 2,
      name: '断气之前', tier: 3, tag: 'create',
      desc: '倒在荒原上等死，平日推不通的关节忽然一一自明',
      minAge: 60, maxAge: 10000,
      available: function (g, U) {
        return !g.becameEmperor && g.lvl >= 41 && g.lvl < 100 && createReady(g, U, true);
      },
      choice: function (g, U) {
        var opts = artOptions(g, U, 2, { skipDeadly: true, bonus: 0.10 });
        opts.push(waitOption('保命要紧，先运功止血', '放弃这份明悟，安稳活下来'));
        return {
          lead: '你被一击打穿胸膛，倒在荒原上等死。神智一寸寸涣散时，那些平日怎么也推不通的关节，竟忽然一一自明',
          info: daoInfo(g, U) + ' · 生死交界：成功率 +10%',
          note: '濒死时的明悟最锋利，也最短暂；此刻再耗心神，必然雪上加霜。',
          options: opts
        };
      },
      resolve: function (g, U, optionId) {
        if (optionId === 'wait') {
          var lf = U.gainLife(g, 20, 60);
          U.printlog('你咬着牙先把伤势压下去。活着才有下一次——那些在断气前才看懂的道理，多半是要跟着人一起埋的' + (lf ? '，将养数年，寿元+' + lf : ''));
          return;
        }
        resolveCreate(g, U, optionId.slice(4), {
          tier: 3, bonus: 0.10, lo: 140, hi: 300,
          ok: '你用还能动的那只手在沙地上划完最后一笔，然后才昏死过去——醒来时，沙地上的东西已经刻进了骨头里',
          fail: '心神刚一凝聚，胸口的窟窿便再度崩裂，那点明悟随血一起流干',
          exempt: '你在最后一刻放弃了推演，把全部心力用来吊住这条命'
        });
      }
    },
    {
      id: 'dao_tribulation_create', weight: 0.9, maxCount: 2,
      name: '雷中立法', tier: 3, tag: 'create',
      desc: '第七道雷落下时，你伸手接住了它',
      minAge: 100, maxAge: 10000,
      available: function (g, U) {
        return !g.becameEmperor && g.lvl >= 51 && g.lvl < 100 && createReady(g, U, false);
      },
      choice: function (g, U) {
        var opts = artOptions(g, U, 3, { bonus: 0.06 });
        opts.push(waitOption('先把这道劫渡过去', '老老实实挨完剩下的雷，不冒险'));
        return {
          lead: '天劫第七道雷落下时，你没有闪避，而是抬手接住。雷光在掌心炸开，也照亮了你想了很多年的那个关节',
          info: daoInfo(g, U) + ' · 劫雷映照：成功率 +6%',
          note: '劫雷会替你照出法理的每一处缝隙；分心推演，余下的雷就得用肉身硬受。',
          options: opts
        };
      },
      resolve: function (g, U, optionId) {
        if (optionId === 'wait') {
          var c = U.cultPct(g, 0.04, 0.09, 2000);
          U.printlog('你收拢心神，规规矩矩把剩下的劫雷挨完。道基被雷液洗过一遍，比什么都实在，实力+' + c);
          return;
        }
        resolveCreate(g, U, optionId.slice(4), {
          tier: 3, bonus: 0.06, lo: 150, hi: 300,
          ok: '你以雷为墨、以掌为纸，在劫云之下把整套法理写完，最后一道雷落下时恰好收笔',
          fail: '一心二用之下，你既没写成法，也没接住雷',
          exempt: '劫雷压得心神一晃，你当即掐断推演，专心渡劫'
        });
      }
    },
    {
      id: 'dao_debate_create', weight: 1.1, maxCount: 3,
      name: '论道之后', tier: 3, tag: 'create',
      desc: '九天九夜谁也没说服谁，他走后你抓起了笔',
      minAge: 60, maxAge: 10000,
      available: function (g, U) {
        return !g.becameEmperor && g.lvl >= 41 && g.lvl < 100 && createReady(g, U, true);
      },
      choice: function (g, U) {
        var opts = artOptions(g, U, 3, { skipDeadly: true, bonus: 0.04 });
        opts.push(waitOption('把他的话再嚼几年', '不急着落笔，先让自己的疑问长一长'));
        return {
          lead: '你与那位' + PICK(RIVAL_TITLES) + '论了九天九夜，谁也没能说服谁。他走后你枯坐了一整宿，忽然抓起笔——你要写的不是驳他的话，是你自己的法',
          info: daoInfo(g, U) + ' · 辩锋未散：成功率 +4%',
          note: '被人问住的地方，往往正是自己该开路的地方。',
          options: opts
        };
      },
      resolve: function (g, U, optionId) {
        if (optionId === 'wait') {
          var d = U.irand(10, 20);
          U.gainDao(g, d);
          U.printlog('你把他留下的那几个问题一个个抄在墙上，日日看着。急着回答的人多半答错，你打算慢慢来，道蕴+' + d);
          return;
        }
        resolveCreate(g, U, optionId.slice(4), {
          tier: 3, bonus: 0.04, lo: 60, hi: 180,
          ok: '你顺着他没能驳倒你的那一处往下写，越写越快，天亮时已成一卷',
          fail: '写到一半你发现他是对的——旧的塌了，新的还没立起来',
          exempt: '落笔之前你重读了一遍自己的旧稿，当即把新写的都撕了'
        });
      }
    },
    {
      id: 'dao_old_art_collapse', weight: 1.0, maxCount: 2,
      name: '旧法崩坏', tier: 3, tag: 'create',
      desc: '成名之法忽然处处漏风：不是它不好，是你走得太远了',
      minAge: 80, maxAge: 10000,
      available: function (g, U) {
        return !g.becameEmperor && g.lvl >= 41 && g.lvl < 100 &&
          U.latestArt(g) && createReady(g, U, true);
      },
      choice: function (g, U) {
        var art = U.latestArt(g);
        var opts = artOptions(g, U, 3, { skipDeadly: true });
        opts.push(waitOption('打补丁，先凑合着用', '旧法能再撑一阵，破绽也跟着你上路'));
        return {
          lead: '你赖以成名的《' + art.name + '》在这一境界上忽然处处漏风。不是它不好，是你走得太远了——旧衣穿不下，只能重裁',
          info: daoInfo(g, U) + ' · 旧法《' + art.name + '》成于第' + art.age + '岁',
          note: '重裁一门新法可彻底补上破绽；只打补丁的话，旧法的漏洞会跟你一起走下去。',
          options: opts
        };
      },
      resolve: function (g, U, optionId) {
        if (optionId === 'wait') {
          var art = U.latestArt(g);
          var c = U.cultPct(g, 0.02, 0.05, 800);
          if (art) art.power = U.round((art.power + 0.05) * 100) / 100;
          U.printlog('你在《' + (art ? art.name : '旧法') + '》的空白处添了七八处小注，把漏风的地方一一堵上。堵得住一时，堵不住一世，实力+' + c);
          return;
        }
        resolveCreate(g, U, optionId.slice(4), {
          tier: 3, lo: 80, hi: 220,
          ok: '你把用了半生的旧法整卷投进炉火，看着它烧完，才开始写第一个字',
          fail: '旧法已废，新法未成，你有整整数十年是空着手过的',
          exempt: '烧到一半你把稿子抢了回来——时候还没到'
        });
      }
    },
    {
      id: 'dao_merge_arts', weight: 0.9, maxCount: 3,
      name: '两法合一', tier: 3, tag: 'create',
      desc: '游历星空归来，发现两门自创法原是同一个道理',
      minAge: 80, maxAge: 10000,
      available: function (g) {
        return !g.becameEmperor && g.lvl < 100 && g.createdArts && g.createdArts.length >= 2;
      },
      cond: function (g, U) { return U.isHighDaoyun(g) || Math.random() < 0.55; },
      ok: function (g, U) {
        var arts = g.createdArts;
        var i = U.irand(0, arts.length - 1), j = U.irand(0, arts.length - 1);
        if (j === i) j = (i + 1) % arts.length;
        var a = arts[i], b = arts[j];
        a.power = U.round((a.power + 0.14) * 100) / 100;
        b.power = U.round((b.power + 0.14) * 100) / 100;
        var c = U.cultPct(g, 0.05, 0.11, 3000);
        var d = U.irand(14, 28);
        U.gainDao(g, d);
        U.printlog('你游历' + PICK(REGIONS) + '归来，把行囊里的手稿一张张铺在地上，忽然愣住：《' + a.name + '》的收势与《' + b.name + '》的起手，原本就是同一个道理绕了一圈。两法并作一法，繁芜尽去，实力+' + c + '，道蕴+' + d);
      },
      fail: function (g, U) {
        U.printlog('你试着把两门法强行并作一门，结果两边的筋骨谁也不肯让谁；折腾十余年后，你只好把稿纸重新分开收好');
      }
    },
    {
      id: 'dao_break_and_rebuild', weight: 1.2, maxCount: 3,
      name: '破而后立', tier: 3, tag: 'daoheart',
      desc: '亲手废去数百年根基，从苦海重新炼起',
      minAge: 80, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 41 && g.lvl < 100; },
      cond: function (g, U) {
        return Math.random() < Math.min(0.75, 0.32 + (g.daoGift || 5) * 0.03 + (U.isHighDaoyun(g) ? 0.12 : 0));
      },
      ok: function (g, U, log) {
        var c = U.cultPct(g, 0.07, 0.13, 4000);
        var d = U.irand(18, 34);
        U.gainDao(g, d);
        g.rebuiltFoundation = (g.rebuiltFoundation || 0) + 1;
        U.printlog('你亲手废去修了数百年的根基，从苦海第一步重新炼起。旁人都说你疯了，只有你自己知道：那条老路的尽头你已经看见了，是一堵墙，实力+' + c + '，道蕴+' + d);
        U.up(g, 1, log);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 60, 200);
        U.printlog(h.exempt ? '自废的前一夜你停了手——尚有牵挂未了，破不彻底，破了也是白破' :
          '你破得够狠，却没能立起来；那几十年里连最简单的运功都要从头学起，寿元 -' + h.loss);
      }
    },
    {
      id: 'dao_heart_demon_kalpa', weight: 1.1, maxCount: 3,
      name: '心魔劫', tier: 3, tag: 'daoheart',
      desc: '幻境里你成了帝，坐了万古',
      minAge: 100, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 51 && g.lvl < 100; },
      cond: function (g, U) {
        return Math.random() < Math.min(0.82, 0.40 + (g.daoGift || 5) * 0.035 + (U.isHighDaoyun(g) ? 0.14 : 0));
      },
      ok: function (g, U) {
        var d = U.irand(16, 32);
        U.gainDao(g, d);
        var c = U.cultPct(g, 0.04, 0.09, 2500);
        U.printlog('幻境里你成了帝，坐了万古，杀尽了该杀的人，护住了该护的人。直到某一世你低头看自己的手——那不是你的手。你一剑劈开幻境，醒来时满身冷汗，道心却从此挑不出缝，实力+' + c + '，道蕴+' + d);
      },
      fail: function (g, U) {
        g.daoyun = Math.max(0, g.daoyun - U.irand(12, 28));
        var h = U.hurt(g, 40, 140);
        U.printlog(h.exempt ? '你在幻境里多留了三百年才醒，醒来后对着空墙坐了很久，什么也没说' :
          '心魔借你最不愿承认的那件事发难，你虽脱身，道蕴与元气皆有折损，寿元 -' + h.loss);
      }
    },
    {
      id: 'dao_seed_demon', weight: 0.8, maxCount: 2,
      name: '道心种魔', tier: 3, tag: 'daoheart',
      desc: '不斩心魔，反把它养在道心深处',
      minAge: 120, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 61 && g.lvl < 100 && !g.daoSeedDemon; },
      cond: function (g, U) {
        return Math.random() < Math.min(0.68, 0.26 + (g.daoGift || 5) * 0.035 + (U.isHighDaoyun(g) ? 0.14 : 0));
      },
      ok: function (g, U) {
        g.daoSeedDemon = true;
        var d = U.irand(20, 38);
        U.gainDao(g, d);
        var c = U.cultPct(g, 0.06, 0.12, 3500);
        U.printlog('你没有斩掉那个心魔，反而把它留在道心深处，日日与它对坐。它逼你，你便强；你强了，它又长。两不相让之下，你的道反倒比斩魔的人走得更快——只是从此再没有一夜是安稳的，实力+' + c + '，道蕴+' + d);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 80, 240);
        g.daoyun = Math.max(0, g.daoyun - U.irand(10, 24));
        U.printlog(h.exempt ? '你把心魔养到第七年便察觉不对，当即引劫雷入体，连着自己的半分执念一并烧了' :
          '心魔养得太肥，反过来啃你的道基；你斩它时连自己也斩伤了，寿元 -' + h.loss);
      }
    },
    {
      id: 'dao_star_gazing', weight: 1.3, maxCount: 5,
      name: '观星悟道', tier: 3, tag: 'insight',
      desc: '古星在眼前熄灭，光却还要再走三千年',
      minAge: 40, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 31 && g.lvl < 100; },
      cond: function (g, U) { return Math.random() < Math.min(0.85, 0.48 + (g.daoGift || 5) * 0.035 + (U.isHighDaoyun(g) ? 0.12 : 0)); },
      ok: function (g, U) {
        var c = U.cultPct(g, 0.04, 0.10, 2000);
        var d = U.irand(12, 26);
        U.gainDao(g, d);
        U.printlog('你在' + PICK(REGIONS) + '一颗荒星上枯坐十年，看星辰生灭。一颗古星在你眼前熄灭，它的光却还要再走三千年才能抵达此处——你忽然懂了什么叫「道在时间之外」，实力+' + c + '，道蕴+' + d);
      },
      fail: function (g, U) {
        var c = U.cultPct(g, 0.01, 0.03, 400);
        U.printlog('你抬头看了十年星空，最后只看出一件事：它太大了，而你还太小。收拾行囊继续赶路，实力+' + c);
      }
    },
    {
      id: 'dao_thunder_pool_insight', weight: 0.9, maxCount: 3,
      name: '雷池悟道', tier: 3, tag: 'insight',
      desc: '别人来此淬体，你却闭着眼听雷',
      minAge: 120, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 61 && g.lvl < 100; },
      cond: function (g, U) { return Math.random() < Math.min(0.78, 0.40 + g.lvl / 260 + (U.isHighDaoyun(g) ? 0.12 : 0)); },
      ok: function (g, U) {
        var c = U.cultPct(g, 0.06, 0.12, 4500);
        var d = U.irand(18, 34);
        U.gainDao(g, d);
        var lf = U.gainLife(g, 60, 200);
        U.printlog('你泡在雷池里，任雷液一寸寸洗过筋骨。旁人来此都是为了淬体，你却闭着眼听：雷有雷的道理，劈下来的每一道都不重样，听到第九万道时你笑出了声，实力+' + c + '，道蕴+' + d + (lf ? '，雷液洗髓，寿元+' + lf : ''));
      },
      fail: function (g, U) {
        var h = U.hurt(g, 90, 260);
        U.printlog(h.exempt ? '雷池之底忽然翻涌，你没有硬撑，抱着半瓮雷液就爬了上来' :
          '你听得太入神，忘了护住肉身，被一道池底暗雷正面劈中，寿元 -' + h.loss);
      }
    },
    {
      id: 'dao_time_turbulence', weight: 0.7, maxCount: 2,
      name: '时光乱流', tier: 3, tag: 'insight',
      desc: '看见自己的少年、暮年与从未走过的另一条路',
      minAge: 200, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 71 && g.lvl < 100; },
      cond: function (g, U) { return U.isHighDaoyun(g) || Math.random() < 0.45; },
      ok: function (g, U) {
        var d = U.irand(22, 38);
        U.gainDao(g, d);
        var c = U.cultPct(g, 0.05, 0.11, 5000);
        var h = U.hurt(g, 40, 150);
        U.printlog('一道时光乱流把你卷了进去。你看见自己的少年、暮年，还有一条从未走过的路上那个活得很好的自己。醒来不过一炷香工夫，鬓角却添了霜，实力+' + c + '，道蕴+' + d + (h.loss ? '，岁月加身，寿元 -' + h.loss : ''));
      },
      fail: function (g, U) {
        var h = U.hurt(g, 100, 280);
        U.printlog(h.exempt ? '乱流擦着你的道躯掠过，你在原地站了很久，什么也没看见，只觉得脊背发凉' :
          '乱流中的岁月不讲道理地压上来，你退出时已苍老了几分，寿元 -' + h.loss);
      }
    },
    {
      id: 'dao_mortal_outburst', weight: 1.2, maxCount: 3,
      name: '凡骨惊雷', tier: 3, tag: 'mortal_dao',
      desc: '「可惜了这悟性，投错了胎」——你笑了笑，当众破关',
      minAge: 30, maxAge: 10000,
      available: mortalDao(31, 99),
      cond: function (g, U) { return Math.random() < Math.min(0.86, 0.46 + (g.daoGift || 5) * 0.04 + (U.isHighDaoyun(g) ? 0.10 : 0)); },
      ok: function (g, U, log) {
        markMortal(g);
        var c = U.cultPct(g, 0.06, 0.12, 3000);
        var d = U.irand(16, 30);
        U.gainDao(g, d);
        U.printlog('又一次有人当众叹「可惜了这悟性，偏偏投错了胎」。你笑了笑，就在众目睽睽之下盘膝破关——凡骨撑不住的地方，你用道理撑；血脉给不了的东西，你自己写给自己，实力+' + c + '，道蕴+' + d);
        U.up(g, 1, log);
      },
      fail: function (g, U) {
        U.printlog('你当众破关，破到一半停了下来。围观的人哄笑着散去，你却在原地把方才卡住的那一处翻来覆去地想——笑声很快会停，这道题不会自己解开');
      }
    },
    {
      id: 'dao_mortal_deduce', weight: 1.0, maxCount: 3,
      name: '以凡躯推演绝学', tier: 3, tag: 'mortal_dao',
      desc: '没有神体可扛，没有秘传可抄，只有一屋子稿纸',
      minAge: 30, maxAge: 10000,
      available: function (g, U) {
        return mortalDao(31, 99)(g) && createReady(g, U, true);
      },
      choice: function (g, U) {
        var opts = artOptions(g, U, 3, { skipDeadly: true, bonus: 0.04 });
        opts.push(waitOption('再算一轮，稿纸还没堆够', '无收益也无损伤；凡体经不起白白消耗'));
        return {
          lead: '你没有神体可以硬扛大道碾压，也没有古族秘传可以照抄。有的只是一颗脑子，和一屋子推演到一半的稿纸',
          info: daoInfo(g, U) + ' · 凡骨推演：成功率 +4%，失败不致命',
          note: '这条路慢，但每一步都是你自己的；推演失败只是白熬几十年，不会伤及性命。',
          options: opts
        };
      },
      resolve: function (g, U, optionId) {
        markMortal(g);
        if (optionId === 'wait') {
          var d = U.irand(10, 20);
          U.gainDao(g, d);
          U.printlog('你把这一轮的稿纸压在最底下，又抽出一张空白的。旁人一日千里，你一日一寸——但一寸也是往前，道蕴+' + d);
          return;
        }
        resolveCreate(g, U, optionId.slice(4), {
          tier: 3, bonus: 0.04, lo: 30, hi: 90,
          ok: '第一万三千张稿纸铺满了整间石屋，你在最后一张的角落写下收势的那一笔',
          fail: '推演到第九千步时整条思路自相矛盾，几十年心血尽付流水',
          exempt: '你在崩盘之前就看出了不对，把整屋稿纸收起来，没有硬撑'
        });
      }
    },
    {
      id: 'dao_mortal_force_pass', weight: 0.9, maxCount: 3,
      name: '凡体渡关', tier: 3, tag: 'mortal_dao',
      desc: '这一关是给神体准备的，你偏偏从石磨的缝里钻了过去',
      minAge: 80, maxAge: 10000,
      available: mortalDao(51, 99),
      cond: function (g, U) {
        return Math.random() < Math.min(0.80, 0.34 + (g.daoGift || 5) * 0.04 + (U.isHighDaoyun(g) ? 0.14 : 0));
      },
      ok: function (g, U, log) {
        markMortal(g);
        var c = U.cultPct(g, 0.07, 0.13, 5000);
        var d = U.irand(20, 36);
        U.gainDao(g, d);
        U.printlog('这一关本是给神体准备的：要以肉身硬抗大道碾压，扛住就过，扛不住就死。你扛不住，于是你不扛——你顺着碾压的纹路走，硬是从那座石磨的缝隙里钻了过去。守关的老怪愣了半晌，只说了一句「原来还能这么过」，实力+' + c + '，道蕴+' + d);
        U.up(g, 1, log);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 60, 200);
        U.printlog(h.exempt ? '你在关前来回走了三十年，把每一道纹路都记熟了才退开——这次不过，下次再来' :
          '纹路算错了半寸，你被大道碾了个正着，拖着半条命退出关口，寿元 -' + h.loss);
      }
    },

    /* ===================== tier 2 中级 ===================== */
    {
      id: 'dao_battle_insight', weight: 3.2, maxCount: 12,
      name: '以战悟道', tier: 2, tag: 'insight',
      desc: '生死交界的一瞬，看清了自己出手时那半寸迟疑',
      minAge: 14, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 11 && g.lvl <= 90; },
      cond: function (g, U) { return Math.random() < Math.min(0.88, 0.55 + (g.daoGift || 5) * 0.03); },
      ok: function (g, U) {
        var c = U.cultPct(g, 0.02, 0.045, 200);
        var d = U.irand(3, 6);
        U.gainDao(g, d);
        U.printlog('那一战你被逼到断崖边缘，对方的掌风贴着耳根刮过去。就在生死交界的一瞬，你忽然看清了自己出手时那半寸的迟疑——正是这半寸，让你这些年始终差一口气，实力+' + c + '，道蕴+' + d);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 10, 45);
        U.printlog(h.exempt ? '一场恶战打完，你除了浑身酸痛什么也没得到，连对方的路数都没记全' :
          '你想在交手中分神体悟，结果挨了实打实的一记，寿元 -' + h.loss);
      }
    },
    {
      id: 'dao_wound_insight', weight: 2.8, maxCount: 10,
      name: '因伤悟道', tier: 2, tag: 'insight',
      desc: '气血绕开旧伤的走法，恰恰是一条更省力的路',
      minAge: 14, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 11 && g.lvl <= 90; },
      cond: function (g, U) { return Math.random() < Math.min(0.85, 0.52 + (g.daoGift || 5) * 0.03); },
      ok: function (g, U) {
        var c = U.cultPct(g, 0.02, 0.04, 180);
        var d = U.irand(3, 6);
        U.gainDao(g, d);
        var lf = U.gainLife(g, 10, 40);
        U.printlog('断骨接了整整一年。你日日盯着那道旧伤发呆，某天忽然发现：气血绕开伤处的那个走法，竟比原来的经脉路线更省力。你把这条弯路留了下来，实力+' + c + '，道蕴+' + d + (lf ? '，旧伤转为根基，寿元+' + lf : ''));
      },
      fail: function (g, U) {
        U.printlog('伤养了三年才好，除了一道疤什么也没留下。你对着铜镜看了半天，承认这次真的只是单纯挨打');
      }
    },
    {
      id: 'dao_ancient_stele', weight: 3.0, maxCount: 8,
      name: '参悟古碑', tier: 2, tag: 'daomark',
      desc: '碑文被风蚀干净，只剩几道刻痕',
      minAge: 12, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 6 && g.lvl <= 80; },
      cond: function (g, U) { return Math.random() < Math.min(0.86, 0.50 + (g.daoGift || 5) * 0.035); },
      ok: function (g, U) {
        var c = U.cultPct(g, 0.02, 0.045, 150);
        var d = U.irand(3, 6);
        U.gainDao(g, d);
        U.printlog('你在' + PICK(T2_MI) + '深处寻到一截半埋的残碑，碑文早被风蚀干净，只剩几道说不清是字还是裂纹的刻痕。你照着刻痕运气，经脉竟自行走出一个从未有过的周天，实力+' + c + '，道蕴+' + d);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 8, 35);
        U.printlog(h.exempt ? '那截残碑看了半年，终究只是一块被雷劈过的破石头' :
          '你照着残痕强行运气，走岔了经脉，吐了口血才停下，寿元 -' + h.loss);
      }
    },
    {
      id: 'dao_mountain_sermon', weight: 3.0, maxCount: 8,
      name: '山门听道', tier: 2, tag: 'insight',
      desc: '挤在最外围只听清三成，回去推敲却比旁人透彻',
      minAge: 12, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 6 && g.lvl <= 80; },
      cond: function (g, U) { return Math.random() < Math.min(0.88, 0.54 + (g.daoGift || 5) * 0.035); },
      ok: function (g, U) {
        var c = U.cultPct(g, 0.02, 0.045, 150);
        var d = U.irand(3, 6);
        U.gainDao(g, d);
        U.printlog(PICK(SECTS) + '开坛讲法，你没有请柬，只能挤在最外围的石阶上，风一吹便听漏几句，满打满算听清三成。回去闭门推敲半年，那三成竟比坐在前排听全的人还要透彻，实力+' + c + '，道蕴+' + d);
      },
      fail: function (g, U) {
        U.printlog('讲法的长老满口都是「妙不可言」「不可说」，你从头听到尾，只确认了一件事：他自己也没想明白');
      }
    },
    {
      id: 'dao_wash_heart', weight: 2.6, maxCount: 8,
      name: '洗炼道心', tier: 2, tag: 'daoheart',
      desc: '把得意事一桩桩想过，再一桩桩丢开',
      minAge: 20, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 11 && g.lvl <= 95; },
      cond: null,
      ok: function (g, U) {
        var d = U.irand(4, 6);
        U.gainDao(g, d);
        var c = U.cultPct(g, 0.015, 0.035, 150);
        g.daoHeartClean = (g.daoHeartClean || 0) + 1;
        U.printlog('你把这些年的得意事一桩桩想过，再一桩桩丢开：夺来的宝、压服的人、传开的名。丢到最后只剩少年时在屋檐下等雨停的那个自己——道心澄澈了几分，实力+' + c + '，道蕴+' + d);
      },
      fail: null
    },
    {
      id: 'dao_refine_own_art', weight: 2.6, maxCount: 10,
      name: '完善旧法', tier: 2, tag: 'create',
      desc: '在自己写下的法门边上批注，又划掉整整一页',
      minAge: 30, maxAge: 10000,
      available: function (g) {
        return !g.becameEmperor && g.lvl < 100 && g.createdArts && g.createdArts.length >= 1;
      },
      cond: null,
      ok: function (g, U) {
        var arts = g.createdArts;
        var art = arts[U.irand(0, arts.length - 1)];
        art.power = U.round((art.power + (U.rand(0.06, 0.12))) * 100) / 100;
        var c = U.cultPct(g, 0.02, 0.045, 250);
        var d = U.irand(3, 6);
        U.gainDao(g, d);
        U.printlog('你重读自己写下的《' + art.name + '》，在第二章边上批了一行小字，又把整整一页划掉。法门没有换名字，运转起来却已与初成那日不同，实力+' + c + '，道蕴+' + d);
      },
      fail: null
    },
    {
      id: 'dao_name_art', weight: 2.4, maxCount: 6,
      name: '法成之名', tier: 2, tag: 'create',
      desc: '自创之法被人传抄，连名字都传岔了',
      minAge: 40, maxAge: 10000,
      available: function (g) {
        return !g.becameEmperor && g.lvl < 100 && g.createdArts && g.createdArts.length >= 1;
      },
      cond: null,
      ok: function (g, U) {
        var art = U.latestArt(g);
        var region = PICK(REGIONS);
        g.artFame = (g.artFame || 0) + 1;
        var c = U.cultPct(g, 0.02, 0.04, 200);
        var d = U.irand(3, 6);
        U.gainDao(g, d);
        U.printlog('你自创的《' + art.name + '》不知怎么流了出去，越传越远，传到后来连名字都被抄岔成了另外三个。你索性亲手把正本刻在' + region + '的崖壁上，末尾署了自己的名——以后谁再传错，是他自己的事，实力+' + c + '，道蕴+' + d);
      },
      fail: null
    },
    {
      id: 'dao_create_guard_first', weight: 2.2, maxCount: 3,
      name: '死中求生之法', tier: 2, tag: 'create',
      desc: '梦里那一幕重演，指尖自行划出从未见过的纹路',
      minAge: 20, maxAge: 10000,
      /* 创法入口改成抉择：高悟必须亲手决定落不落笔，不能再自动写完 */
      available: function (g, U) {
        return !g.becameEmperor && g.lvl >= 21 && g.lvl <= 70 && createReady(g, U, true);
      },
      choice: function (g, U) {
        var opts = artOptions(g, U, 2, { skipDeadly: true, first: 'guard' });
        opts.push(waitOption('先把师兄安葬，日后再写', '这次不落笔；那道纹路会淡，但不至于散尽'));
        return {
          lead: '同行的师兄死在你面前，你连伸手都来不及。当夜你梦见那一幕重演，梦里你伸出手，指尖竟自行划出了一道从未见过的纹路',
          info: daoInfo(g, U),
          note: '这是你第一次有机会把自己的法写下来；护道法最好落，也最贴这一夜。',
          options: opts
        };
      },
      resolve: function (g, U, optionId) {
        if (optionId === 'wait') {
          U.printlog('你先把师兄埋了。梦里那道纹路第二天就淡了一截，你没有追——有些法，急着写反而写成了别人的');
          return;
        }
        resolveCreate(g, U, optionId.slice(4), {
          tier: 2, lo: 15, hi: 50,
          ok: '你凭着梦里那道纹路一笔笔往下补，第七年上终于合拢',
          fail: '梦里的纹路一天比一天淡，补到最后你自己也分不清哪一笔是真的',
          exempt: '纹路怎么也接不上，你把稿子锁进箱底，没有再耗下去'
        });
      }
    },
    {
      id: 'dao_create_stele_first', weight: 2.2, maxCount: 3,
      name: '残碑补字', tier: 2, tag: 'create',
      desc: '后山残碑被雨洗出字，缺的那几笔你自己补上了',
      minAge: 20, maxAge: 10000,
      available: function (g, U) {
        return !g.becameEmperor && g.lvl >= 21 && g.lvl <= 70 && createReady(g, U, true);
      },
      choice: function (g, U) {
        var opts = artOptions(g, U, 2, { skipDeadly: true, first: 'scripture' });
        opts.push(waitOption('先拓下来，不急着补', '残碑还在，缺的那几笔不会自己长出来，也不会自己消失'));
        return {
          lead: '后山那块残碑被连日暴雨洗出了字。前人写到一半便停了，缺的不是风化，是他当年没写完。你蹲在碑前，忽然觉得缺的那几笔自己会写',
          info: daoInfo(g, U),
          note: '这是你第一次有机会把自己的法写下来；经文最好落，也最贴这块残碑。',
          options: opts
        };
      },
      resolve: function (g, U, optionId) {
        if (optionId === 'wait') {
          U.printlog('你用湿纸把碑文拓了下来，缺的地方留着空白。山门里的人路过都当这是古迹，没人知道你其实已经想好了怎么补');
          return;
        }
        resolveCreate(g, U, optionId.slice(4), {
          tier: 2, lo: 15, hi: 50,
          ok: '你用石屑在缺处补了三笔，整块碑忽然顺了——那三笔不是前人的，是你的',
          fail: '补上去的字第二天就被雨冲掉了，碑还是残的，你也没再去',
          exempt: '你举起石屑又放下。这块碑不是你的纸，乱补只会把前人的意思也毁了'
        });
      }
    },
    {
      id: 'dao_create_rain_first', weight: 2.2, maxCount: 3,
      name: '雨夜自摸', tier: 2, tag: 'create',
      desc: '漏雨的石屋里，你把听来的半句经文摸成了自己的法',
      minAge: 20, maxAge: 10000,
      available: function (g, U) {
        return !g.becameEmperor && g.lvl >= 21 && g.lvl <= 70 && createReady(g, U, true);
      },
      choice: function (g, U) {
        var opts = artOptions(g, U, 2, { skipDeadly: true, first: 'array' });
        opts.push(waitOption('先把漏雨的屋顶补上', '半句经文还在心里，今夜不写也不会忘'));
        return {
          lead: '石屋漏雨，灯芯被风吹得只剩豆大一点。你把白天听来的半句经文在地上画了又擦、擦了又画——画到后半夜，那半句已经不像别人的了',
          info: daoInfo(g, U),
          note: '这是你第一次有机会把自己的法写下来；阵纹最好落，也最贴这一地水痕。',
          options: opts
        };
      },
      resolve: function (g, U, optionId) {
        if (optionId === 'wait') {
          U.printlog('你先把屋顶的漏处堵住。地上的水痕干了，半句经文还在，只是不再那么尖');
          return;
        }
        resolveCreate(g, U, optionId.slice(4), {
          tier: 2, lo: 15, hi: 50,
          ok: '你就着漏下来的雨水把纹路一遍遍描实，天亮时地上那摊已经能自己转起来',
          fail: '水一冲，纹路糊成一片。你坐到天亮，也没能把那半句重新分开',
          exempt: '灯灭了，你没有再点。有些法摸到一半就该停，硬写只会写成胡话'
        });
      }
    },
    {
      id: 'dao_mortal_untaught', weight: 2.8, maxCount: 6,
      name: '无师自通', tier: 2, tag: 'mortal_dao',
      desc: '残篇被当废纸贱卖，因为无人读得懂',
      minAge: 14, maxAge: 10000,
      available: mortalDao(11, 80),
      cond: function (g, U) { return Math.random() < Math.min(0.90, 0.56 + (g.daoGift || 5) * 0.04); },
      ok: function (g, U) {
        markMortal(g);
        var c = U.cultPct(g, 0.02, 0.045, 200);
        var d = U.irand(4, 6);
        U.gainDao(g, d);
        if (g.aptitude < 10 && Math.random() < 0.45) U.apt(g, 1);
        U.printlog('一卷' + PICK(T3_GONG) + '的残篇在市集上被当废纸贱卖，因为通篇缺字，无人读得懂。你蹲在摊边翻了半日，回去便把缺失的段落补了出来——补得未必与原作相同，却同样能行，实力+' + c + '，道蕴+' + d);
        if (U.markStory) U.markStory(g, 'remnant_owner');
      },
      fail: function (g, U) {
        U.printlog('你抱着那卷残篇啃了两年，最后承认：缺的不是字，是当年写它的人没打算让后来者看懂。你把它收进箱底，打算等自己再长些本事再来');
      }
    },
    {
      id: 'dao_mortal_refute', weight: 2.5, maxCount: 6,
      name: '当堂驳经', tier: 2, tag: 'mortal_dao',
      desc: '你指出讲经者一处前后抵牾，满堂哗然',
      minAge: 14, maxAge: 10000,
      available: mortalDao(11, 80),
      cond: function (g, U) { return Math.random() < Math.min(0.88, 0.50 + (g.daoGift || 5) * 0.04); },
      ok: function (g, U) {
        markMortal(g);
        var c = U.cultPct(g, 0.02, 0.045, 200);
        var d = U.irand(4, 6);
        U.gainDao(g, d);
        U.printlog('一位' + PICK(SECTS) + '的年轻执事当众讲经，你听出其中一处前后抵牾，忍不住起身指正。满堂哗然——一个凡骨也敢驳经？执事的脸色却一点点白了下去，因为你是对的，实力+' + c + '，道蕴+' + d);
      },
      fail: function (g, U) {
        var h = U.hurt(g, 5, 25);
        U.printlog(h.exempt ? '你把话咽了回去，只在心里默默把那一处记下。有些是非，争赢了也没好处' :
          '你当众驳得人下不来台，散场后被几个护道人堵在巷子里教训了一顿，寿元 -' + h.loss);
      }
    },

    /* ===================== tier 1 普通 ===================== */
    {
      id: 'dao_dawn_chant', weight: 5, maxCount: 30,
      name: '晨课诵经', tier: 1, tag: 'insight',
      desc: '同样四个字，今日读来却像在说自己',
      minAge: 8, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl <= 45; },
      cond: null,
      ok: function (g, U) {
        var c = U.cultPct(g, 0.004, 0.010, 20);
        U.printlog('天色未明你便在殿前诵经，念到「苦海无量」一句时忽然顿住——同样四个字，昨日读着是别人的话，今日听来却像在说自己，实力+' + c);
      },
      fail: null
    },
    {
      id: 'dao_water_mirror', weight: 4.5, maxCount: 25,
      name: '临水照心', tier: 1, tag: 'insight',
      desc: '水纹一乱，倒影便散',
      minAge: 8, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl <= 45; },
      cond: null,
      ok: function (g, U) {
        var c = U.cultPct(g, 0.004, 0.010, 20);
        U.printlog('你蹲在溪边看自己的倒影，抛一粒石子下去，水纹一乱，倒影便散。你盯着散开的那张脸忽然想到：心念一动，法也就散了，实力+' + c);
      },
      fail: null
    },
    {
      id: 'dao_village_carving', weight: 4, maxCount: 20,
      name: '荒村旧刻', tier: 1, tag: 'daomark',
      desc: '被牛蹭得发亮的石头上，刻着几道歪斜纹路',
      minAge: 8, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl <= 45; },
      cond: null,
      ok: function (g, U) {
        var c = U.cultPct(g, 0.004, 0.012, 25);
        if (g.aptitude < 10 && Math.random() < 0.12) U.apt(g, 1);
        U.printlog('村口那块被牛蹭得发亮的石头上刻着几道歪斜纹路，老人只说是先祖随手划的。你蹲在那里临摹了三个月，竟摹出半分说不清的韵味，实力+' + c);
      },
      fail: null
    },
    {
      id: 'dao_ask_wanderer', weight: 4.5, maxCount: 20,
      name: '问道游方修士', tier: 1, tag: 'insight',
      desc: '「法是死的，路是活的」——你嚼了半年',
      minAge: 8, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl <= 50; },
      cond: null,
      ok: function (g, U) {
        var c = U.cultPct(g, 0.004, 0.010, 20);
        U.printlog('一个衣衫褴褛的游方修士借宿三日，临走时你追出去问他修行的诀窍，他头也不回地丢下一句：「法是死的，路是活的。」你嚼了整整半年，实力+' + c);
      },
      fail: null
    },
    {
      id: 'dao_star_counting', weight: 4, maxCount: 20,
      name: '夜数星辰', tier: 1, tag: 'insight',
      desc: '数到第三千颗时，发现它们的排布并非杂乱',
      minAge: 8, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl <= 50; },
      cond: null,
      ok: function (g, U) {
        var c = U.cultPct(g, 0.004, 0.010, 20);
        U.printlog('你趴在屋脊上数星星，数到第三千颗时忽然发现：它们的排布并非杂乱无章，倒像某种铺得极大的阵纹。你没有告诉任何人，只是从此夜夜都爬上去看，实力+' + c);
      },
      fail: null
    },
    {
      id: 'dao_tinker_old_art', weight: 4, maxCount: 20,
      name: '拆解旧法', tier: 1, tag: 'create',
      desc: '删去三处画蛇添足，同样的法反而更快',
      minAge: 10, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 3 && g.lvl <= 50; },
      cond: null,
      ok: function (g, U) {
        var c = U.cultPct(g, 0.005, 0.012, 25);
        U.printlog('你把师门那套烂熟于心的' + PICK(T2_GONG) + '拆成一招一式重新拼过，发现其中有三处纯属画蛇添足。删掉之后，同样一套法反而使得更快——师父知道了大骂你不敬祖师，实力+' + c);
      },
      fail: null
    },
    {
      id: 'dao_mortal_slight', weight: 4, maxCount: 20,
      name: '凡骨之讥', tier: 1, tag: 'mortal_dao',
      desc: '「凡骨一具，学这些也是白费」',
      minAge: 8, maxAge: 10000,
      available: mortalDao(1, 45),
      cond: null,
      ok: function (g, U) {
        markMortal(g);
        var c = U.cultPct(g, 0.005, 0.012, 25);
        U.printlog('同门当着众人的面说你「凡骨一具，学这些经文也是白费」。你没有回嘴，只是把那卷他们统统看不懂的古经又从头读了一遍——三日后你能整卷背诵，他们还卡在第二页，实力+' + c);
      },
      fail: null
    },
    {
      id: 'dao_mortal_bookworm', weight: 4, maxCount: 20,
      name: '抄经万卷', tier: 1, tag: 'mortal_dao',
      desc: '抄到第七十卷时，你已能看出前人抄错的地方',
      minAge: 8, maxAge: 10000,
      available: mortalDao(1, 50),
      cond: null,
      ok: function (g, U) {
        markMortal(g);
        var c = U.cultPct(g, 0.005, 0.012, 25);
        if (g.aptitude < 10 && Math.random() < 0.15) U.apt(g, 1);
        U.printlog('你没有可以横推同辈的体魄，便把藏经阁最偏僻那一架上的旧卷一本本抄过去。抄到第七十卷时，你已经能看出前人哪几处是抄错的——包括写在扉页上的那位长老，实力+' + c);
      },
      fail: null
    }
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = EVENTS;
  root.EVENT_PACK_DAO = EVENTS;
})(typeof self !== 'undefined' ? self : this);
