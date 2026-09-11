/* ============================================================
 * 遮天模拟器 · 随机事件包（life-late）
 * 仙台 / 大能 / 王者 / 圣人 / 大圣 / 准帝 路边故事
 * ============================================================ */
(function (root) {
  var POOLS = typeof module !== 'undefined' && module.exports ? require('./events-pools.js') : root.EVENT_POOLS;
  var PICK = POOLS.PICK, eraPair = POOLS.eraPair;
  var SECTS = POOLS.SECTS, REGIONS = POOLS.REGIONS, RIVAL_TITLES = POOLS.RIVAL_TITLES;
  var T3_HERB = POOLS.T3_HERB, T3_GONG = POOLS.T3_GONG, T3_MI = POOLS.T3_MI, T3_BING = POOLS.T3_BING;
  var AGES = POOLS.AGES, LEGEND_AGES = POOLS.LEGEND_AGES;

  var EVENTS = [

    /* ================================================================
     * 仙台一层天  lvl 41-50  minAge 40
     * ================================================================ */

    {
      id: 'lf_xt_noincense_altar', weight: 2.2, maxCount: 1,
      name: '没人上香的石坛', tier: 2, tag: 'altar',
      desc: '天璇圣地遗址上，一座石坛还在冒着冷烟',
      minAge: 40, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 41 && g.lvl <= 50; },
      choice: function (g, U) {
        return {
          lead: PICK(T3_MI) + '边上有一座没人上香的石坛，坛心积着一层灰白的冷烬，风一吹就散，散完又自己聚回来',
          info: '这坛不像是给人拜的，更像是给人还愿之后就忘了的东西',
          note: '绕开走最稳；捧一把灰能沾一点余温；在坛前坐一夜可能把冷烟吸入识海。',
          options: [
            { id: 'leave', label: '绕开石坛，只在路边折一根草记个方位', desc: '不碰灰，也不欠坛上一炷香', safe: true },
            { id: 'ash', label: '捧一把冷烬在掌心看它聚散', desc: '成则沾一点余温，败则寒气入骨', chance: 0.68 },
            { id: 'sit', label: '在坛前坐到冷烟散尽', desc: '成则把坛上旧愿听完，败则被烟呛进识海', chance: 0.44 }
          ]
        };
      },
      resolve: function (g, U, optionId) {
        var c, d, lf, h;
        if (optionId === 'leave') {
          lf = U.gainLife(g, 8, 22);
          U.printlog('你在石坛外折了一根被霜打过的草，草节里藏着半粒' + PICK(T3_HERB) +
            '的碎屑，你没有挖坛，只把碎屑含化，寿元+' + lf);
          return;
        }
        if (optionId === 'ash') {
          if (Math.random() < 0.68) {
            c = U.cultPct(g, 0.018, 0.038, 120);
            lf = U.gainLife(g, 12, 36);
            U.printlog('冷烬在掌心聚成一小团，像有人还没散尽的呼吸。你把它吹回坛心，自己留下那口余温，实力+' + c +
              (lf ? '，寿元+' + lf : ''));
          } else {
            h = U.hurt(g, 12, 36);
            U.printlog(h.exempt ? '灰一碰就散了，你拍拍手走开，坛上什么也没留下' :
              '寒气顺着掌纹往上爬，你在袖里搓了半天才缓过来，寿元-' + h.loss);
          }
          return;
        }
        if (Math.random() < 0.44) {
          c = U.cultPct(g, 0.022, 0.048, 160);
          d = U.irand(3, 6);
          U.gainDao(g, d);
          U.printlog('你在坛前坐到后半夜，听见有人用很老的口音念了一句没说完的愿。愿散了，你把那半句记下，实力+' + c + '，道蕴+' + d);
        } else {
          h = U.hurt(g, 16, 44);
          U.printlog(h.exempt ? '冷烟灌进鼻腔时你及时屏住呼吸，只咳了两声便起身' :
            '冷烟灌进识海，像有人在里面翻旧账，你太阳穴跳了一夜，寿元-' + h.loss);
        }
      }
    },

    {
      id: 'lf_xt_wineshop_scripture', weight: 1.3, maxCount: 1,
      name: '酒肆里的半卷经', tier: 3, tag: 'scripture',
      desc: '东荒小镇酒肆里，有人把半卷经当了酒钱',
      minAge: 40, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 41 && g.lvl <= 50; },
      choice: function (g, U) {
        return {
          lead: PICK(REGIONS) + '一座小镇酒肆里，掌柜把半卷被酒渍透的经往柜台上一拍：上一桌客人说这是' +
            PICK(T3_GONG) + '的抄本，抵了三坛劣酒就走了',
          info: '纸边还有' + PICK(SECTS) + '的印，印是旧的，酒是新的',
          note: '把经送回最稳；抄三页再还，能留下自己用得上的句子；整卷带走要跟印主结一笔账。',
          options: [
            { id: 'return', label: '按印上的地址把经送回去', desc: '不欠酒钱，也不欠经上的字', safe: true },
            { id: 'copy', label: '抄三页自己能用的句子，再把原件送走', desc: '成则留下口诀，败则抄走火', chance: 0.64 },
            { id: 'take', label: '付清酒钱，把半卷经收进袖里', desc: '成则经文入体，败则印主寻来问罪', chance: 0.42 }
          ]
        };
      },
      resolve: function (g, U, optionId) {
        var c, d, lf, h, gong, sect;
        gong = PICK(T3_GONG);
        sect = PICK(SECTS);
        if (optionId === 'return') {
          d = U.irand(8, 12);
          U.gainDao(g, d);
          lf = U.gainLife(g, 20, 70);
          U.printlog('你按印找到' + sect + '一座废弃别院，把门缝里的半卷经塞回去。门里没人应，院墙上却多了一行小字，教你辨认经文真伪，道蕴+' + d +
            (lf ? '，寿元+' + lf : ''));
          return;
        }
        if (optionId === 'copy') {
          if (Math.random() < 0.64) {
            c = U.cultPct(g, 0.04, 0.09, 280);
            d = U.irand(12, 22);
            U.gainDao(g, d);
            U.printlog('你就着油灯抄了三页' + gong + '，抄到气落丹田四个字时手忽然稳了。原件你第二天送了回去，实力+' + c + '，道蕴+' + d);
          } else {
            h = U.hurt(g, 22, 70);
            U.printlog(h.exempt ? '抄到第二页你发现笔顺是反的，及时停笔，只浪费了一夜灯油' :
              '反着的笔顺把真气带岔了，你在酒肆后院吐了一口浊气，寿元-' + h.loss);
          }
          return;
        }
        if (Math.random() < 0.42) {
          c = U.cultPct(g, 0.06, 0.12, 420);
          d = U.irand(16, 30);
          U.gainDao(g, d);
          U.printlog('半卷' + gong + '在袖里自己热起来。你连夜走完三页未抄的残句，到天亮时经文已化进识海，实力+' + c + '，道蕴+' + d);
        } else {
          h = U.hurt(g, 28, 80);
          U.printlog(h.exempt ? sect + '的人在路口拦住你，看清经上酒渍后只挥挥手让你走，没追究' :
            sect + '的人在镇外截住你，一掌拍在经上，震得你胸口发闷，寿元-' + h.loss);
        }
      }
    },

    {
      id: 'lf_xt_yaochi_guest', weight: 2.3, maxCount: 1,
      name: '瑶池来的客人', tier: 2, tag: 'guest',
      desc: '一位瑶池弟子路过，只借一壶热水',
      minAge: 40, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 41 && g.lvl <= 50; },
      choice: function (g, U) {
        return {
          lead: '门外站着一位' + PICK(SECTS) + '的' + PICK(RIVAL_TITLES) +
            '，衣摆还带着瑶池的冷香，开口只借一壶热水洗剑',
          info: '对方没有敌意，可洗剑的水会记得主人的气味',
          note: '倒水送客最稳；对拆三招能换一句指点；问瑶池的路可能被拒绝，也可能得到一张旧图。',
          options: [
            { id: 'tea', label: '烧一壶水，看对方洗完剑就走', desc: '人情到此为止', safe: true },
            { id: 'spar', label: '请对方赐三招，只论身法不论生死', desc: '成则得一句指点，败则被剑风刮伤', chance: 0.62 },
            { id: 'ask', label: '问起瑶池那条少有人走的侧径', desc: '成则得一张旧图，败则话不投机', chance: 0.48 }
          ]
        };
      },
      resolve: function (g, U, optionId) {
        var c, d, lf, h, who;
        who = PICK(SECTS) + '的' + PICK(RIVAL_TITLES);
        if (optionId === 'tea') {
          lf = U.gainLife(g, 10, 28);
          U.printlog(who + '洗完剑，把壶底沉淀的一粒' + PICK(T3_HERB) +
            '碎屑拨给你，说路上用。说完便没入云层，寿元+' + lf);
          return;
        }
        if (optionId === 'spar') {
          if (Math.random() < 0.62) {
            c = U.cultPct(g, 0.02, 0.045, 140);
            d = U.irand(2, 5);
            U.gainDao(g, d);
            U.printlog('三招过完，对方收剑时点了一下你的肩窝，说这里松了。你当晚把肩窝里的滞气逼出来，实力+' + c + '，道蕴+' + d);
          } else {
            h = U.hurt(g, 14, 40);
            U.printlog(h.exempt ? '第三招你主动收步，对方点点头，没有再进' :
              '剑风贴着耳廓过去，你当晚耳鸣到天亮，寿元-' + h.loss);
          }
          return;
        }
        if (Math.random() < 0.48) {
          c = U.cultPct(g, 0.016, 0.04, 110);
          lf = U.gainLife(g, 16, 48);
          U.printlog('对方在地上用剑尖划了三条折线，叫你别从正门走。你按图绕开一处哨岗，路上还采到一株被霜打过的药，实力+' + c +
            (lf ? '，寿元+' + lf : ''));
        } else {
          h = U.hurt(g, 10, 32);
          U.printlog(h.exempt ? '对方笑了笑，把话岔开，只说时候未到' :
            '话不投机，对方收剑时带起的冷香刺得你鼻腔发涩，寿元-' + h.loss);
        }
      }
    },

    {
      id: 'lf_xt_beiyuan_frost', weight: 1.2, maxCount: 1,
      name: '北原那一夜霜', tier: 3, tag: 'frost',
      desc: '北斗北原的霜夜里，有一口剑在土里喘气',
      minAge: 40, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 41 && g.lvl <= 50; },
      choice: function (g, U) {
        return {
          lead: '北斗北原的霜比刀快。你在冻土里看见一截剑脊，像' + PICK(T3_BING) +
            '的残片，霜花围着它长，长一寸，周围的草就白一寸',
          info: '残片在喘气，每一次起伏都带出一缕玄冰气息',
          note: '生火等天亮最稳；顺着霜走能摸到剑脊的来处；伸手暖它可能被反噬。',
          options: [
            { id: 'fire', label: '生一堆火，背对残片等到天亮', desc: '不碰冰，只借一夜寒意醒神', safe: true },
            { id: 'follow', label: '顺着霜花走，看它从哪里长出来', desc: '成则摸到剑脊来处，败则迷路受冻', chance: 0.60 },
            { id: 'warm', label: '把残片握在掌心，用气血去暖', desc: '成则寒气化力，败则冰入经脉', chance: 0.40 }
          ]
        };
      },
      resolve: function (g, U, optionId) {
        var c, d, lf, h;
        if (optionId === 'fire') {
          d = U.irand(8, 14);
          U.gainDao(g, d);
          lf = U.gainLife(g, 30, 90);
          U.printlog('火堆噼啪响了一夜。你没有回头，可霜花在背后一寸寸退开，像有什么东西认可你不伸手。天亮时你周身气机比昨夜更清，道蕴+' + d +
            (lf ? '，寿元+' + lf : ''));
          return;
        }
        if (optionId === 'follow') {
          if (Math.random() < 0.60) {
            c = U.cultPct(g, 0.05, 0.10, 320);
            d = U.irand(14, 26);
            U.gainDao(g, d);
            U.printlog('霜花把你带到一处浅坑，坑底压着半页被冻住的' + PICK(T3_GONG) +
              '口诀。你用体温化开那一页，记完便把坑填上，实力+' + c + '，道蕴+' + d);
          } else {
            h = U.hurt(g, 24, 72);
            U.printlog(h.exempt ? '霜花在第三道沟前断了，你循原路退回火堆残烬旁' :
              '你在白草里转了两个时辰，靴底结冰，退出来时嘴唇发青，寿元-' + h.loss);
          }
          return;
        }
        if (Math.random() < 0.40) {
          c = U.cultPct(g, 0.07, 0.13, 480);
          d = U.irand(18, 32);
          U.gainDao(g, d);
          U.printlog('残片在掌心化成一汪冷水，水沿经脉走了一圈又从毛孔渗出。你没有留住剑，却留下了它的寒意走法，实力+' + c + '，道蕴+' + d);
        } else {
          h = U.hurt(g, 30, 88);
          U.printlog(h.exempt ? '寒气刚入腕你便甩开，残片落回冻土，霜花重新把它盖住' :
            '冰意顺着脉门往心脏爬，你运了半个时辰才把那截寒气逼出指尖，寿元-' + h.loss);
        }
      }
    },

    {
      id: 'lf_xt_jiang_debt', weight: 1.4, maxCount: 1,
      name: '姜家来讨旧账', tier: 3, tag: 'debt',
      desc: '一张发黄的借条，债主比借条更老',
      minAge: 40, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 41 && g.lvl <= 50; },
      choice: function (g, U) {
        return {
          lead: PICK(SECTS) + '派来一位白发执事，展开一张你几乎不认得的借条：某年某月，你在' +
            PICK(T3_MI) + '随手取走过一株药，当时说日后双倍还',
          info: '借条上的字是你的笔迹，只是那年你还没把日后想清楚',
          note: '按价还药最稳；推迟三年要付利息；当场比试一次，赢了账销，输了还要加码。',
          options: [
            { id: 'pay', label: '当场取出等价灵材，把借条烧了', desc: '账清，人净', safe: true },
            { id: 'delay', label: '立新契，三年后再还，利息用自己的一道印记抵押', desc: '成则换来喘息，败则印记反噬', chance: 0.66 },
            { id: 'spar', label: '请执事以武销账，只分胜负不论生死', desc: '成则账销并得指点，败则加码还伤', chance: 0.46 }
          ]
        };
      },
      resolve: function (g, U, optionId) {
        var c, d, lf, h, herb;
        herb = PICK(T3_HERB);
        if (optionId === 'pay') {
          lf = U.gainLife(g, 24, 80);
          d = U.irand(8, 14);
          U.gainDao(g, d);
          U.printlog('你把一块' + herb + '放上借条。火起时执事点点头，说姜家的账，清了就是清了。你胸口那点说不清的滞涩也跟着散了，道蕴+' + d +
            (lf ? '，寿元+' + lf : ''));
          return;
        }
        if (optionId === 'delay') {
          if (Math.random() < 0.66) {
            c = U.cultPct(g, 0.04, 0.08, 260);
            lf = U.gainLife(g, 40, 120);
            U.printlog('新契落在你腕内侧，像一枚不会化的痣。执事走后你反倒睡得沉，三年的期限把心按下了，实力+' + c +
              (lf ? '，寿元+' + lf : ''));
          } else {
            h = U.hurt(g, 20, 64);
            U.printlog(h.exempt ? '印记刚落下你便运功把它逼到表皮，执事看了看，没再坚持' :
              '抵押的印记当天夜里发热，你靠着墙出了一身冷汗，寿元-' + h.loss);
          }
          return;
        }
        if (Math.random() < 0.46) {
          c = U.cultPct(g, 0.06, 0.12, 400);
          d = U.irand(14, 28);
          U.gainDao(g, d);
          U.printlog('执事收借条作势，三掌过后把纸撕了。临走丢下一句，说你肩上那式是旧的。你当晚把旧式拆开重练，实力+' + c + '，道蕴+' + d);
        } else {
          h = U.hurt(g, 26, 76);
          U.printlog(h.exempt ? '你主动认输，执事加了一成利息便走，没有下手' :
            '执事一掌拍在借条上，震得你虎口开裂，账上又多了一笔，寿元-' + h.loss);
        }
      }
    },

    /* ================================================================
     * 二层天·大能  lvl 51-60  minAge 80
     * ================================================================ */

    {
      id: 'lf_dn_daxia_court', weight: 1.3, maxCount: 1,
      name: '大夏的一夜朝议', tier: 3, tag: 'court',
      desc: '大夏皇朝缺一个不站队的人坐在角落听',
      minAge: 80, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 51 && g.lvl <= 60; },
      choice: function (g, U) {
        return {
          lead: '大夏皇朝派人来请。不是请你入朝，是请你在偏殿角落坐一夜，听' +
            PICK(SECTS) + '与中州古族争一条星路的过境权',
          info: '他们要的是一个不站队的证人，不是一个帮手',
          note: '推辞最稳；坐着听完能摸清几家底线；开口一句可能改写今夜的结果，也可能把自己卷进去。',
          options: [
            { id: 'decline', label: '回绝，只在城外茶摊坐到散朝', desc: '不入殿，只听市井怎么传', safe: true },
            { id: 'listen', label: '入偏殿，整夜不说话', desc: '成则摸清底线，败则被两家同时记恨', chance: 0.63 },
            { id: 'speak', label: '在僵持最久时说一句公道', desc: '成则两家欠你一个人情，败则两头不讨好', chance: 0.41 }
          ]
        };
      },
      resolve: function (g, U, optionId) {
        var c, d, lf, h, sect;
        sect = PICK(SECTS);
        if (optionId === 'decline') {
          d = U.irand(8, 14);
          U.gainDao(g, d);
          lf = U.gainLife(g, 40, 110);
          U.printlog('你在城外茶摊听脚夫吵架，比殿里清楚：星路过境真正卡的是一处驿站的水，不是面子。你把这事记在心里，道蕴+' + d +
            (lf ? '，寿元+' + lf : ''));
          return;
        }
        if (optionId === 'listen') {
          if (Math.random() < 0.63) {
            c = U.cultPct(g, 0.05, 0.10, 500);
            d = U.irand(14, 26);
            U.gainDao(g, d);
            U.printlog('偏殿里两家把底牌翻来翻去。你一句话没说，却把' + sect +
              '护道时的呼吸节奏听了个全，回程路上反复比对自己的，实力+' + c + '，道蕴+' + d);
          } else {
            h = U.hurt(g, 36, 96);
            U.printlog(h.exempt ? '散朝时有人朝你掷来一块玉，你侧身让开，玉碎在柱上' :
              '散朝后有人在巷口拦你，说听了也是参与，你硬接了一掌，寿元-' + h.loss);
          }
          return;
        }
        if (Math.random() < 0.41) {
          c = U.cultPct(g, 0.07, 0.13, 720);
          d = U.irand(18, 34);
          U.gainDao(g, d);
          U.printlog('你只说驿站的水归谁，路就归谁。殿里静了片刻，两家竟然按这个分了。事后各送来一份薄礼，你没收礼，收下了他们分路时露出来的手法，实力+' + c + '，道蕴+' + d);
        } else {
          h = U.hurt(g, 40, 110);
          U.printlog(h.exempt ? '话出口两边都变了脸色，你提前告退，殿门在身后关得很响' :
            '两边同时不高兴，散朝后你在宫道上挨了两记无意的肩撞，寿元-' + h.loss);
        }
      }
    },

    {
      id: 'lf_dn_bone_remnant', weight: 1.2, maxCount: 1,
      name: '枯骨怀里的残篇', tier: 3, tag: 'remnant',
      desc: '太玄门旧址，一具枯骨把书页抱了整整数百年',
      minAge: 80, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 51 && g.lvl <= 60; },
      choice: function (g, U) {
        var era = eraPair();
        return {
          lead: '太玄门旧址墙根下坐着一具枯骨，怀里夹着半册' + PICK(T3_GONG) +
            '，纸边写着自' + era.from + '抄至几个字，后面的时代被土浸没了',
          info: '枯骨的指节还扣在书脊上，像怕有人抢走',
          note: '把人连书埋了最稳；读半册再埋，能留下能用的；整册抽走要跟这具枯骨的执念打交道。',
          options: [
            { id: 'bury', label: '连人带书就地埋了，立一块无字石', desc: '不夺死者的东西', safe: true },
            { id: 'read', label: '读半册能看懂的，再把书放回怀里埋掉', desc: '成则得残篇，败则被执念盯上', chance: 0.61 },
            { id: 'take', label: '抽出整册，把枯骨另外安葬', desc: '成则经文完整入体，败则执念反扑', chance: 0.39 }
          ]
        };
      },
      resolve: function (g, U, optionId) {
        var c, d, lf, h, gong, era;
        gong = PICK(T3_GONG);
        era = eraPair();
        if (optionId === 'bury') {
          d = U.irand(10, 16);
          U.gainDao(g, d);
          lf = U.gainLife(g, 50, 140);
          U.printlog('土填平的时候，枯骨指节自己松开了。你没看那半册字，只在填土时闻见一缕像' + era.from +
            '纸墨的气味，记在鼻子里，道蕴+' + d + (lf ? '，寿元+' + lf : ''));
          return;
        }
        if (optionId === 'read') {
          if (Math.random() < 0.61) {
            c = U.cultPct(g, 0.05, 0.11, 560);
            d = U.irand(16, 28);
            U.gainDao(g, d);
            U.printlog('你读到气分六道便停。后面的字被血浸透，不是给你看的。书放回怀里时枯骨点了一下头，实力+' + c + '，道蕴+' + d);
          } else {
            h = U.hurt(g, 40, 108);
            U.printlog(h.exempt ? '读到第三页眼前发黑，你把书合上，枯骨没有动' :
              '执念从纸缝里钻出来，在你识海里喊了一个别人的名字，寿元-' + h.loss);
          }
          return;
        }
        if (Math.random() < 0.39) {
          c = U.cultPct(g, 0.08, 0.14, 800);
          d = U.irand(20, 36);
          U.gainDao(g, d);
          U.printlog('整册' + gong + '抽出时，枯骨松了口气似的散成灰。你连夜把残篇补进自己的路子里，没有照抄那套从' +
            era.from + '到' + era.to + '的旧法，实力+' + c + '，道蕴+' + d);
        } else {
          h = U.hurt(g, 48, 128);
          U.printlog(h.exempt ? '书脊刚离怀，枯骨抬手虚抓了一下，你把书放回去，双方都停了' :
            '执念扑进胸口，你像被一只看不见的手按在地上，半天才爬起来，寿元-' + h.loss);
        }
      }
    },

    {
      id: 'lf_dn_wanyao_hunt', weight: 1.4, maxCount: 1,
      name: '万妖巢外的围猎', tier: 3, tag: 'hunt',
      desc: '几家圣地在万妖巢穴外围合围一头古兽',
      minAge: 80, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 51 && g.lvl <= 60; },
      choice: function (g, U) {
        return {
          lead: PICK(SECTS) + '、' + PICK(SECTS) + '在万妖巢穴外围布了三道围，里头一头老兽拖着半截' +
            PICK(T3_BING) + '似的骨刺，血把草木都烫卷了',
          info: '围猎的人要骨，要血，不要旁观者插嘴',
          note: '在岭上看完最稳；截一头逃兽能得点血；抢心口那一击会跟围猎的人面对面。',
          options: [
            { id: 'ridge', label: '在岭上把围猎看完，不下山', desc: '只看别人怎么合围', safe: true },
            { id: 'cut', label: '截杀一头从缺口逃出的幼兽', desc: '成则得一腔精血，败则被老兽余波扫到', chance: 0.62 },
            { id: 'heart', label: '在合围最乱时抢一击心口', desc: '成则得骨刺精血，败则两头不讨好', chance: 0.40 }
          ]
        };
      },
      resolve: function (g, U, optionId) {
        var c, d, lf, h, sect;
        sect = PICK(SECTS);
        if (optionId === 'ridge') {
          c = U.cultPct(g, 0.03, 0.06, 360);
          d = U.irand(10, 18);
          U.gainDao(g, d);
          U.printlog('你把三道围的进退看了两个时辰。' + sect +
            '的人收网时故意松了一角，那一角不是仁慈，是给自己留退路。你把这招记下，实力+' + c + '，道蕴+' + d);
          return;
        }
        if (optionId === 'cut') {
          if (Math.random() < 0.62) {
            c = U.cultPct(g, 0.06, 0.11, 620);
            lf = U.gainLife(g, 60, 160);
            U.printlog('逃兽撞进你的刀里。你只取一碗血，把尸身推回围里——他们要全尸，你要的只是这碗还热着的东西，实力+' + c +
              (lf ? '，寿元+' + lf : ''));
          } else {
            h = U.hurt(g, 38, 100);
            U.printlog(h.exempt ? '幼兽从你刀下钻过，你没有追，余波在身后炸开一排树' :
              '老兽甩尾的风从缺口灌出来，你被带下山坡，嘴里全是土，寿元-' + h.loss);
          }
          return;
        }
        if (Math.random() < 0.40) {
          c = U.cultPct(g, 0.08, 0.14, 880);
          d = U.irand(16, 30);
          U.gainDao(g, d);
          U.printlog('你抢在收网前一指点进心口。骨刺崩开，一滴比黄金还重的精血溅在腕上。围猎的人骂归骂，没有人追——他们也怕这一滴烫手，实力+' + c + '，道蕴+' + d);
        } else {
          h = U.hurt(g, 50, 130);
          U.printlog(h.exempt ? '你抬手的瞬间围里有人喊停，你收势退回岭上，双方都当没看见' :
            '骨刺擦着肋骨过去，你滚出围外，袖子烧了一截，寿元-' + h.loss);
        }
      }
    },

    {
      id: 'lf_dn_starblood_vow', weight: 1.1, maxCount: 1,
      name: '星下立的血誓', tier: 3, tag: 'vow',
      desc: '有人要你在星空古路驿站跟他立一句不会反悔的话',
      minAge: 80, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 51 && g.lvl <= 60; },
      choice: function (g, U) {
        return {
          lead: '通天古路驿站外，一位' + PICK(SECTS) + '的' + PICK(RIVAL_TITLES) +
            '拦路，说要跟你立血誓：此后百年，谁先证到王者，谁就给对方让一条生路',
          info: '誓不是咒，可星空古路上的风会记住这句话',
          note: '拒绝最稳；做见证人不入誓；自己落血则百年内多一份约束，也多一份清醒。',
          options: [
            { id: 'refuse', label: '拒绝立誓，拱手让路', desc: '不欠百年的话', safe: true },
            { id: 'witness', label: '不做誓主，只做见证人', desc: '成则借誓意醒神，败则被卷进别人的因果', chance: 0.64 },
            { id: 'swear', label: '刺破指尖，把那句话落进风里', desc: '成则道心更稳，败则誓意反咬', chance: 0.43 }
          ]
        };
      },
      resolve: function (g, U, optionId) {
        var c, d, lf, h, who;
        who = PICK(SECTS) + '的' + PICK(RIVAL_TITLES);
        if (optionId === 'refuse') {
          d = U.irand(8, 14);
          U.gainDao(g, d);
          lf = U.gainLife(g, 40, 120);
          U.printlog(who + '看了你片刻，把准备好的血收了回去。你从他身边走过时，听见自己心里那句没说出口的话自己散了，道蕴+' + d +
            (lf ? '，寿元+' + lf : ''));
          return;
        }
        if (optionId === 'witness') {
          if (Math.random() < 0.64) {
            c = U.cultPct(g, 0.04, 0.09, 480);
            d = U.irand(14, 24);
            U.gainDao(g, d);
            U.printlog('两人当你的面刺血。风把那句话吹过去的时候，你把自己的退路也想清楚了——不是为他们，是为以后的自己，实力+' + c + '，道蕴+' + d);
          } else {
            h = U.hurt(g, 32, 90);
            U.printlog(h.exempt ? '风忽然转向，誓没立成，三人在驿站门口散了' :
              '别人的誓意擦过你的眉心，像被人用指甲掐了一下，寿元-' + h.loss);
          }
          return;
        }
        if (Math.random() < 0.43) {
          c = U.cultPct(g, 0.07, 0.13, 760);
          d = U.irand(18, 34);
          U.gainDao(g, d);
          U.printlog('血滴进风里没有落地。你发现自己走路时会下意识给左边留半步——那是你答应过的生路。约束反而让你出手更干净，实力+' + c + '，道蕴+' + d);
        } else {
          h = U.hurt(g, 44, 116);
          U.printlog(h.exempt ? '血刚滴出你便改口，对方也没逼，只说今日不作数' :
            '誓意反咬舌根，你有三日说不出整句完整的话，寿元-' + h.loss);
        }
      }
    },

    {
      id: 'lf_dn_shencan_mist', weight: 1.5, maxCount: 1,
      name: '神蚕岭的雾', tier: 3, tag: 'mist',
      desc: '雾里有丝，丝里有人走过的温度',
      minAge: 80, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 51 && g.lvl <= 60; },
      choice: function (g, U) {
        return {
          lead: '神蚕岭的雾贴着地面走。雾里挂着细丝，丝上还留着' + PICK(AGES) +
            '谁走过时的体温，摸上去像刚离开的手',
          info: '丝不是给你抽的，可雾会奖励肯等的人',
          note: '等风把雾吹薄最稳；走进三里能沾丝意；伸手抽丝可能被反缠。',
          options: [
            { id: 'wait', label: '在岭脚等到雾薄，再上路', desc: '不进雾，只借雾气醒神', safe: true },
            { id: 'walk', label: '顺着丝走进三里，到一处空地就停', desc: '成则沾丝意，败则迷路受困', chance: 0.60 },
            { id: 'pull', label: '抽一缕还热着的丝缠上腕', desc: '成则丝意入体，败则被反缠', chance: 0.38 }
          ]
        };
      },
      resolve: function (g, U, optionId) {
        var c, d, lf, h;
        if (optionId === 'wait') {
          lf = U.gainLife(g, 50, 140);
          d = U.irand(10, 16);
          U.gainDao(g, d);
          U.printlog('雾退的时候，岭脚的石头上多了一层薄茧。你没有揭，只把茧上的潮气吸进肺里，像喝了一口很淡的茶，道蕴+' + d +
            (lf ? '，寿元+' + lf : ''));
          return;
        }
        if (optionId === 'walk') {
          if (Math.random() < 0.60) {
            c = U.cultPct(g, 0.05, 0.11, 600);
            d = U.irand(16, 28);
            U.gainDao(g, d);
            U.printlog('三里外的空地上有一棵被丝裹住的枯树。你围着它走了七圈，看清丝是怎么绕的，没有碰树，实力+' + c + '，道蕴+' + d);
          } else {
            h = U.hurt(g, 36, 100);
            U.printlog(h.exempt ? '走到第二里丝忽然收紧，你停步后退，雾给了你一条原路' :
              '雾把方向偷走了。你在同一块石头旁转了半个时辰才摸出去，寿元-' + h.loss);
          }
          return;
        }
        if (Math.random() < 0.38) {
          c = U.cultPct(g, 0.08, 0.14, 840);
          d = U.irand(20, 36);
          U.gainDao(g, d);
          U.printlog('丝缠上腕的瞬间，你看见自己的经脉像被重新织过一遍。丝在午时自己断了，留下的走法还在，实力+' + c + '，道蕴+' + d);
        } else {
          h = U.hurt(g, 48, 124);
          U.printlog(h.exempt ? '丝刚上手你便用真火把它烫断，腕上只红了一圈' :
            '丝越缠越紧，你割断它时连带割开一层皮，血很快被雾吸干，寿元-' + h.loss);
        }
      }
    },

    /* ================================================================
     * 三层天·王者  lvl 61-70  minAge 120
     * ================================================================ */

    {
      id: 'lf_wk_jinwu_banner', weight: 1.4, maxCount: 1,
      name: '金乌旗动了一下', tier: 3, tag: 'banner',
      desc: '一面没人撑着的大旗，自己在风里动了一下',
      minAge: 120, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 61 && g.lvl <= 70; },
      choice: function (g, U) {
        return {
          lead: PICK(REGIONS) + '一座荒城里，' + PICK(['金乌大旗', '太阴大旗']) +
            '插在旗座上，没有旗手，旗面却自己响了一声，像有人在远处点名',
          info: '旗认的是气，不是手。你走近时旗穗朝你偏了偏',
          note: '不碰旗最稳；读旗面的风能悟一角；把旗抬高一寸会惊动附近的人。',
          options: [
            { id: 'leave', label: '站在百步外看它再响一声，然后走', desc: '不碰旗，也不被旗点名', safe: true },
            { id: 'read', label: '站在旗下，把旗面里的风读完', desc: '成则悟旗意，败则被旗威压伤', chance: 0.58 },
            { id: 'lift', label: '双手握杆，把旗抬高一寸再放下', desc: '成则旗意入体，败则惊动旧部', chance: 0.36 }
          ]
        };
      },
      resolve: function (g, U, optionId) {
        var c, d, lf, h, flag, sect;
        flag = PICK(['金乌大旗', '太阴大旗']);
        sect = PICK(SECTS);
        if (optionId === 'leave') {
          d = U.irand(10, 18);
          U.gainDao(g, d);
          lf = U.gainLife(g, 60, 160);
          U.printlog('旗又响了一声，像在打发一个过路的人。你头也没回。走出荒城时，耳边那一声却自己变成了节奏，道蕴+' + d +
            (lf ? '，寿元+' + lf : ''));
          return;
        }
        if (optionId === 'read') {
          if (Math.random() < 0.58) {
            c = U.cultPct(g, 0.06, 0.11, 900);
            d = U.irand(16, 30);
            U.gainDao(g, d);
            U.printlog(flag + '的旗面里不是图案，是一行行被风揉碎的军令。你读到退则全三个字便停，没有再往下看，实力+' + c + '，道蕴+' + d);
          } else {
            h = U.hurt(g, 50, 130);
            U.printlog(h.exempt ? '旗威刚压下来你便退到百步外，耳鸣了一阵就好了' :
              '旗面一掀，你跪了半息才站起来，膝盖上全是灰，寿元-' + h.loss);
          }
          return;
        }
        if (Math.random() < 0.36) {
          c = U.cultPct(g, 0.08, 0.14, 1200);
          d = U.irand(20, 36);
          U.gainDao(g, d);
          U.printlog('旗杆重得像一座山。你只抬了一寸，腕骨响了一声。放下时旗穗扫过你的手背，留下一道不会褪的热印，实力+' + c + '，道蕴+' + d);
        } else {
          h = U.hurt(g, 60, 150);
          U.printlog(h.exempt ? '旗杆纹丝不动，你及时松手。' + sect + '的巡骑从城外经过，只看了一眼' :
            '旗刚离座，城外便有人喝问。你放下旗退出荒城，后背挨了一记遥击，寿元-' + h.loss);
        }
      }
    },

    {
      id: 'lf_wk_sundark_eclipse', weight: 1.2, maxCount: 1,
      name: '白日忽然暗了', tier: 3, tag: 'eclipse',
      desc: '日食那一刻，有人在影子里改自己的路',
      minAge: 120, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 61 && g.lvl <= 70; },
      choice: function (g, U) {
        return {
          lead: '白日正当顶，光却一层层被咬走。' + PICK(REGIONS) +
            '的飞禽落地，连' + PICK(SECTS) + '的护山大阵都暗了一息',
          info: '日食里的影子比夜里干净，适合看自己平时看不见的那一截路',
          note: '闭目等复明最稳；坐着把影子看完能改一处滞涩；在全暗时睁眼可能被光反噬。',
          options: [
            { id: 'close', label: '闭目盘坐，等光回来', desc: '不抢这一息，只把心按住', safe: true },
            { id: 'watch', label: '睁着眼把影子从东看到西', desc: '成则改一处滞涩，败则眼伤', chance: 0.57 },
            { id: 'open', label: '在最暗那一息把双目睁到最圆', desc: '成则看见自己的暗处，败则被复明刺伤', chance: 0.35 }
          ]
        };
      },
      resolve: function (g, U, optionId) {
        var c, d, lf, h;
        if (optionId === 'close') {
          d = U.irand(12, 20);
          U.gainDao(g, d);
          lf = U.gainLife(g, 70, 180);
          U.printlog('光回来的时候，你才发觉自己的呼吸比日食前慢了半拍。慢的那半拍里，有些躁意自己死了，道蕴+' + d +
            (lf ? '，寿元+' + lf : ''));
          return;
        }
        if (optionId === 'watch') {
          if (Math.random() < 0.57) {
            c = U.cultPct(g, 0.06, 0.12, 1000);
            d = U.irand(18, 32);
            U.gainDao(g, d);
            U.printlog('影子从左肩移到右膝时，你看清自己练了百年的一式里有一处偷懒。你当场把那一式拆掉重来，实力+' + c + '，道蕴+' + d);
          } else {
            h = U.hurt(g, 52, 136);
            U.printlog(h.exempt ? '影子走到一半你流泪了，及时低头，没有硬看完' :
              '你把影子看完，复明时双眼像被砂子擦过，寿元-' + h.loss);
          }
          return;
        }
        if (Math.random() < 0.35) {
          c = U.cultPct(g, 0.09, 0.14, 1400);
          d = U.irand(22, 38);
          U.gainDao(g, d);
          U.printlog('最暗那一息，你看见自己识海里有一块从来没被照到的地方。光回来之前你把它记下来，回来之后那块地方不再躲，实力+' + c + '，道蕴+' + d);
        } else {
          h = U.hurt(g, 64, 160);
          U.printlog(h.exempt ? '复明的第一线光让你闭眼，你没有硬撑，只在眼皮里留下一个白点' :
            '光像钉子一样钉进瞳孔，你有十日不敢看太阳，寿元-' + h.loss);
        }
      }
    },

    {
      id: 'lf_wk_expelled_exile', weight: 1.3, maxCount: 1,
      name: '被圣地赶走的人', tier: 3, tag: 'exile',
      desc: '摇光的旧人坐在官道上，身边只有一只破袋',
      minAge: 120, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 61 && g.lvl <= 70; },
      choice: function (g, U) {
        return {
          lead: '官道边坐着一个被' + PICK(SECTS) + '除名的老人，腰牌削了半边。他认出你，没有求收容，只问能不能换一顿热的',
          info: '他袋里鼓着一件东西，形状像' + PICK(T3_BING) + '的残件，他不打算拿出来换',
          note: '给一顿饭送走最稳；藏他三日要担风险；送他到星域边上可能换来他压箱底的那一招。',
          options: [
            { id: 'meal', label: '买一碗热的，看他吃完，各走各的', desc: '人情到一碗为止', safe: true },
            { id: 'hide', label: '把他藏进附近废庙三日，等追的人过去', desc: '成则得其旧术，败则被搜到连坐', chance: 0.56 },
            { id: 'escort', label: '送他到星空古路第一段的入口', desc: '成则换来压箱底的一招，败则在路上遇截', chance: 0.38 }
          ]
        };
      },
      resolve: function (g, U, optionId) {
        var c, d, lf, h, sect;
        sect = PICK(SECTS);
        if (optionId === 'meal') {
          lf = U.gainLife(g, 50, 150);
          d = U.irand(10, 18);
          U.gainDao(g, d);
          U.printlog('他吃得很慢，吃完把碗扣在桌上，说' + sect +
            '搜人先搜袖口。说完便拐进了岔路。你后来真的因此少挨了一次盘查，道蕴+' + d +
            (lf ? '，寿元+' + lf : ''));
          return;
        }
        if (optionId === 'hide') {
          if (Math.random() < 0.56) {
            c = U.cultPct(g, 0.06, 0.11, 960);
            d = U.irand(16, 28);
            U.gainDao(g, d);
            U.printlog('三日里他只教你怎么把气息压进脚底板。追的人在庙外站过两次，没有进。第四天他走了，庙里留下一行用炭灰写的步法，实力+' + c + '，道蕴+' + d);
          } else {
            h = U.hurt(g, 54, 140);
            U.printlog(h.exempt ? '搜庙的人只掀了草席，你事先让他躲进井里，双方都装不认识' :
              '废庙被翻开，你替他挡了一记盘问，肩头肿了三日，寿元-' + h.loss);
          }
          return;
        }
        if (Math.random() < 0.38) {
          c = U.cultPct(g, 0.08, 0.14, 1300);
          d = U.irand(20, 36);
          U.gainDao(g, d);
          U.printlog('送到古路入口，他把袋里那半截残件拆开，教你其中一式如何在败势里留一口气。教完便头也不回地走进星尘，实力+' + c + '，道蕴+' + d);
        } else {
          h = U.hurt(g, 66, 168);
          U.printlog(h.exempt ? '半路遇见巡骑，他主动站出去，挥手让你走另一条沟' :
            '巡骑在河谷截住你们，你拼着挨了一掌把他推过界碑，寿元-' + h.loss);
        }
      }
    },

    {
      id: 'lf_wk_heijin_forge', weight: 1.1, maxCount: 1,
      name: '黑金炉前的一夜', tier: 3, tag: 'forge',
      desc: '有人在炼龙纹黑金，缺一个肯守炉的人',
      minAge: 120, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 61 && g.lvl <= 70; },
      choice: function (g, U) {
        return {
          lead: PICK(T3_MI) + '深处有一座地炉，炉里煮着一块' + PICK(['龙纹黑金', '羊脂白玉神铁', '大罗银精']) +
            '。守炉的老人说火候差一口气，请你今夜别走',
          info: '炉火认人。你靠近时火星朝你跳，像在问你肯不肯把自己也投进去',
          note: '只守火不碰金最稳；用金淬一根骨能换硬度；拿自己当胚去锤，成则筋骨重铸，败则火伤。',
          options: [
            { id: 'watch', label: '守一夜风箱，不碰炉里的东西', desc: '出一份力，换一夜火气洗尘', safe: true },
            { id: 'quench', label: '求老人用金汁淬你一根肋', desc: '成则骨头更硬，败则金汁乱走', chance: 0.55 },
            { id: 'hammer', label: '把自己的一只手伸进余温里，当胚锤三下', desc: '成则筋骨重铸，败则火入血', chance: 0.34 }
          ]
        };
      },
      resolve: function (g, U, optionId) {
        var c, d, lf, h, metal;
        metal = PICK(['龙纹黑金', '羊脂白玉神铁', '大罗银精']);
        if (optionId === 'watch') {
          lf = U.gainLife(g, 70, 180);
          d = U.irand(12, 20);
          U.gainDao(g, d);
          U.printlog('风箱拉到四更，老人只说了句够了。你出炉时眉毛被燎短一截，肺里却干净得像新的，道蕴+' + d +
            (lf ? '，寿元+' + lf : ''));
          return;
        }
        if (optionId === 'quench') {
          if (Math.random() < 0.55) {
            c = U.cultPct(g, 0.07, 0.12, 1100);
            lf = U.gainLife(g, 80, 200);
            U.printlog('一滴' + metal + '汁沿肋骨走下去，像有细针在里面绣花。绣完之后那根骨敲起来是金声，实力+' + c +
              (lf ? '，寿元+' + lf : ''));
          } else {
            h = U.hurt(g, 56, 144);
            U.printlog(h.exempt ? '金汁刚沾皮你便运功把它逼出，只烫掉一块痂' :
              '金汁走岔了，你在炉边打滚把那截热逼出毛孔，寿元-' + h.loss);
          }
          return;
        }
        if (Math.random() < 0.34) {
          c = U.cultPct(g, 0.09, 0.14, 1500);
          d = U.irand(20, 36);
          U.gainDao(g, d);
          U.printlog('三锤下去，你听见自己的腕骨在改口。老人骂你疯子，却把炉里最后一点' + metal +
            '屑扫进你的伤口。伤好之后手比以前沉，也比以前准，实力+' + c + '，道蕴+' + d);
        } else {
          h = U.hurt(g, 70, 176);
          U.printlog(h.exempt ? '第一锤你就缩手，老人用钳子把你拽开，骂归骂，没有再让你伸' :
            '火顺着血往上爬，你在水缸里泡到天亮才把热压下去，寿元-' + h.loss);
        }
      }
    },

    {
      id: 'lf_wk_youming_tide', weight: 1.5, maxCount: 1,
      name: '幽冥海的回头潮', tier: 3, tag: 'tide',
      desc: '潮水把几百年前沉下去的东西又送回岸边',
      minAge: 120, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 61 && g.lvl <= 70; },
      choice: function (g, U) {
        return {
          lead: '幽冥星海今夜涨回头潮。潮头推上来半扇门、一只断桨，还有一枚还在跳的' +
            PICK(T3_HERB) + '，像一颗不肯死的心',
          info: '回头潮只停留一个时辰，退时会把站得太前的人一起拽走',
          note: '在干沙上捡漂来的东西最稳；涉到膝能摸到潮心；潜一次呼吸可能带回潮里的旧物。',
          options: [
            { id: 'shore', label: '站在干沙上，只捡潮头推上来的残件', desc: '不下水，也够看一场', safe: true },
            { id: 'wade', label: '涉到膝深，用手去接潮心里那一跳', desc: '成则接住潮意，败则被拽倒', chance: 0.54 },
            { id: 'dive', label: '在潮回头的瞬间潜下去，只留一口气', desc: '成则取回潮里旧物，败则灌仓', chance: 0.33 }
          ]
        };
      },
      resolve: function (g, U, optionId) {
        var c, d, lf, h, herb;
        herb = PICK(T3_HERB);
        if (optionId === 'shore') {
          c = U.cultPct(g, 0.04, 0.07, 700);
          d = U.irand(12, 20);
          U.gainDao(g, d);
          U.printlog('你捡到半扇门板上刻着的三个字，被水磨得只剩偏旁。你靠偏旁把整句补全，补完潮也退了，实力+' + c + '，道蕴+' + d);
          return;
        }
        if (optionId === 'wade') {
          if (Math.random() < 0.54) {
            c = U.cultPct(g, 0.07, 0.12, 1150);
            lf = U.gainLife(g, 80, 210);
            U.printlog('那一跳落进掌心，原来是一粒' + herb +
              '。它在你脉门上跳了九下便化了，像把海的节奏借给你用一夜，实力+' + c +
              (lf ? '，寿元+' + lf : ''));
          } else {
            h = U.hurt(g, 58, 148);
            U.printlog(h.exempt ? '潮头打来时你及时坐回干沙，只湿了衣摆' :
              '回头潮在膝弯处一拽，你喝了一口发苦的水，咳到天亮，寿元-' + h.loss);
          }
          return;
        }
        if (Math.random() < 0.33) {
          c = U.cultPct(g, 0.09, 0.14, 1550);
          d = U.irand(22, 38);
          U.gainDao(g, d);
          U.printlog('水下没有光，只有一条更老的潮在往回走。你摸到一块被潮磨圆的玉，玉里封着半式早已失传的步法，浮上岸便化进脚心，实力+' + c + '，道蕴+' + d);
        } else {
          h = U.hurt(g, 72, 180);
          U.printlog(h.exempt ? '肺在发紧时你立刻上浮，潮只舔了你的脚踝' :
            '你在水下多贪了半息，被灌了半肚子黑水，爬上岸吐了许久，寿元-' + h.loss);
        }
      }
    },

    /* ================================================================
     * 四层天·圣人  lvl 71-80  minAge 200
     * ================================================================ */

    {
      id: 'lf_st_leiyin_sermon', weight: 1.3, maxCount: 1,
      name: '雷音寺外听了一场', tier: 3, tag: 'sermon',
      desc: '度人经开讲，门外也可以站',
      minAge: 200, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 71 && g.lvl <= 80; },
      choice: function (g, U) {
        return {
          lead: '雷音寺今日开讲' + PICK(['度人经', '涅槃经']) +
            '。山门不验腰牌，只验你能不能在钟声里站稳。你站在门槛外，已经能听见第一句',
          info: '寺里的人说，听懂一句是一句，问错一句要自己担',
          note: '站在门外听完最稳；入座听完一场能记下骨架；开口问一句可能被当头棒喝。',
          options: [
            { id: 'door', label: '不进门，把这一场站完', desc: '听得少，也不欠寺里一句', safe: true },
            { id: 'sit', label: '入座，把这一场听到散钟', desc: '成则记下骨架，败则被钟声震伤', chance: 0.56 },
            { id: 'ask', label: '在静默处问一句自己卡住的地方', desc: '成则被点破，败则棒喝伤神', chance: 0.36 }
          ]
        };
      },
      resolve: function (g, U, optionId) {
        var c, d, lf, h, jing;
        jing = PICK(['度人经', '涅槃经']);
        if (optionId === 'door') {
          d = U.irand(12, 20);
          U.gainDao(g, d);
          lf = U.gainLife(g, 70, 180);
          U.printlog('你站到散钟。门里最后一句被风撕成两半，你把两半在心里拼回去，拼完发现自己的路也缺过类似的半句，道蕴+' + d +
            (lf ? '，寿元+' + lf : ''));
          return;
        }
        if (optionId === 'sit') {
          if (Math.random() < 0.56) {
            c = U.cultPct(g, 0.06, 0.12, 1400);
            d = U.irand(18, 32);
            U.gainDao(g, d);
            U.printlog('一场' + jing + '听完，你没有记下原文，只记下讲经人每逢杀伐处便停一拍。那一拍后来成了你出手的空隙，实力+' + c + '，道蕴+' + d);
          } else {
            h = U.hurt(g, 60, 150);
            U.printlog(h.exempt ? '钟声起时你及时把识海阖上，只觉得耳热' :
              '散钟从顶门灌下去，你在蒲团上坐不稳，被人扶出山门，寿元-' + h.loss);
          }
          return;
        }
        if (Math.random() < 0.36) {
          c = U.cultPct(g, 0.08, 0.14, 1800);
          d = U.irand(22, 38);
          U.gainDao(g, d);
          U.printlog('你问的是度人是否先要度己。讲经人没有答，只把木鱼翻过来敲了一记——空的。你当场明白自己一直把木鱼敲在实处，实力+' + c + '，道蕴+' + d);
        } else {
          h = U.hurt(g, 70, 170);
          U.printlog(h.exempt ? '木鱼敲在你问句的半截，你及时住了口，讲经人点点头' :
            '棒喝不重，可那一声在识海里回了三日，你吃饭都听得见，寿元-' + h.loss);
        }
      }
    },

    {
      id: 'lf_st_difu_silence', weight: 1.1, maxCount: 1,
      name: '地府边上没有声音', tier: 3, tag: 'silence',
      desc: '地府外围，连自己的心跳都要小声',
      minAge: 200, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 71 && g.lvl <= 80; },
      choice: function (g, U) {
        return {
          lead: '地府外围的土是灰的。你走了半里，发现自己的脚步、衣襟、甚至脉跳都被什么东西轻轻按住了，像有一只手捂在世上',
          info: '这里不是叫你死，是叫你先学会不出声',
          note: '转身退回有声处最稳；坐着把无声听完能静心；喊一个名字可能把不该醒的东西叫醒。',
          options: [
            { id: 'back', label: '退回听得见风的地方，不再往里走', desc: '把无声当作一次警告', safe: true },
            { id: 'sit', label: '就地坐下，把这场无声坐完', desc: '成则心静如井，败则神识发沉', chance: 0.55 },
            { id: 'name', label: '在无声里轻轻念一个还活着的人的名字', desc: '成则确认自己还在，败则被回声咬一口', chance: 0.34 }
          ]
        };
      },
      resolve: function (g, U, optionId) {
        var c, d, lf, h;
        if (optionId === 'back') {
          d = U.irand(12, 20);
          U.gainDao(g, d);
          lf = U.gainLife(g, 80, 190);
          U.printlog('风声回来的时候，你才发觉自己连呼吸都学会了省。后来你在嘈杂处也能留出这么一小块静，道蕴+' + d +
            (lf ? '，寿元+' + lf : ''));
          return;
        }
        if (optionId === 'sit') {
          if (Math.random() < 0.55) {
            c = U.cultPct(g, 0.06, 0.11, 1500);
            d = U.irand(18, 32);
            U.gainDao(g, d);
            U.printlog('无声坐到后来，你听见的不是外面，是自己经脉里以前从未被注意到的杂响。你把杂响一一按灭，实力+' + c + '，道蕴+' + d);
          } else {
            h = U.hurt(g, 62, 156);
            U.printlog(h.exempt ? '神识往下沉时你咬破舌尖，腥味把你拉了回来' :
              '你坐得太久，站起来时像从井底往外爬，太阳穴空了一块，寿元-' + h.loss);
          }
          return;
        }
        if (Math.random() < 0.34) {
          c = U.cultPct(g, 0.08, 0.13, 1700);
          d = U.irand(20, 36);
          U.gainDao(g, d);
          U.printlog('名字出口，无声裂开一条缝。缝那边没有人应，可你确认了自己还能被这个世界听见。裂口合上时带给你一小段别人的静，实力+' + c + '，道蕴+' + d);
        } else {
          h = U.hurt(g, 72, 174);
          U.printlog(h.exempt ? '回声刚起你便把名字咽回去，缝没有完全裂开' :
            '回声用你的嗓子说了一句你没说过的话，你猛咳把那句话咳掉，寿元-' + h.loss);
        }
      }
    },

    {
      id: 'lf_st_huolin_ash', weight: 1.2, maxCount: 1,
      name: '火麟洞里的冷灰', tier: 3, tag: 'ash',
      desc: '洞还在，火已经走了很久',
      minAge: 200, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 71 && g.lvl <= 80; },
      choice: function (g, U) {
        return {
          lead: '火麟洞的火早熄了。洞壁上结着一层玻璃似的冷灰，踩上去会轻轻响，像有鳞片在底下翻身',
          info: '灰里还有余温，只是不肯给人轻易取走',
          note: '取一块已经凉透的灰最稳；沿灰路走到洞心能借余温；把最后一口气吸进肺里会烫，但烫不死。',
          options: [
            { id: 'cool', label: '在洞口刮一块凉透的灰收进瓶里', desc: '余温很少，也够养一夜', safe: true },
            { id: 'path', label: '沿着灰响的地方走到洞心再出来', desc: '成则借到余温，败则灰粉入肺', chance: 0.53 },
            { id: 'breathe', label: '在洞心把最后那口热灰吸进肺里', desc: '成则火种入体，败则灼伤经脉——不会当场死', chance: 0.32 }
          ]
        };
      },
      resolve: function (g, U, optionId) {
        var c, d, lf, h;
        if (optionId === 'cool') {
          lf = U.gainLife(g, 80, 200);
          d = U.irand(12, 20);
          U.gainDao(g, d);
          U.printlog('凉灰在瓶里自己排成一小片鳞的形状。你没有喂它火，只在入定前打开瓶塞闻一口，像有人在很远处烤着什么，道蕴+' + d +
            (lf ? '，寿元+' + lf : ''));
          return;
        }
        if (optionId === 'path') {
          if (Math.random() < 0.53) {
            c = U.cultPct(g, 0.07, 0.12, 1600);
            d = U.irand(18, 32);
            U.gainDao(g, d);
            U.printlog('洞心有一块没完全冷的石头。你把手按上去，数了三百下心跳，石头凉了，你的掌心却留下一枚不会褪的红印，实力+' + c + '，道蕴+' + d);
          } else {
            h = U.hurt(g, 64, 158);
            U.printlog(h.exempt ? '灰粉刚呛进鼻腔你便退出，在洞口咳干净再走' :
              '灰粉细得像烟，你在洞里咳出黑痰，三日吃不下热的，寿元-' + h.loss);
          }
          return;
        }
        if (Math.random() < 0.32) {
          c = U.cultPct(g, 0.09, 0.14, 2000);
          d = U.irand(22, 38);
          U.gainDao(g, d);
          U.printlog('热灰进肺的时候你以为自己要烧起来，可它只走了一圈便在气海底安营。后来你发力时胸腔会先热一下，像洞还没完全死，实力+' + c + '，道蕴+' + d);
        } else {
          h = U.hurt(g, 76, 180);
          U.printlog(h.exempt ? '第一口你就吐了出来，只烫裂了舌面，没有让它往下走' :
            '热灰在经脉里乱窜，你灌了半壶冷泉才把它按住，胸口结了一层新痂，寿元-' + h.loss);
        }
      }
    },

    {
      id: 'lf_st_sameorder_peer', weight: 1.4, maxCount: 1,
      name: '遇上同阶圣人', tier: 3, tag: 'peer',
      desc: '路边有人跟你境界一般高，谁也不肯先低头',
      minAge: 200, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 71 && g.lvl <= 80; },
      choice: function (g, U) {
        return {
          lead: PICK(REGIONS) + '一座断桥上，一位' + PICK(SECTS) + '的圣人与你迎面。两边都停了。风从桥洞底下穿过，像在等谁先让',
          info: '同阶见面，让是礼，不让是道。两样都可以',
          note: '点头让路最稳；隔空论三句能换看法；当真过一招会分出高下，也会留下伤。',
          options: [
            { id: 'yield', label: '侧身让到桥边，看对方先过', desc: '礼到了，道还在自己身上', safe: true },
            { id: 'talk', label: '隔空说三句，只论近日卡住的那一关', desc: '成则互相点破，败则话不投机伤神', chance: 0.54 },
            { id: 'clash', label: '请对方赐一招，桥上见高低', desc: '成则借力进一步，败则桥断人伤', chance: 0.35 }
          ]
        };
      },
      resolve: function (g, U, optionId) {
        var c, d, lf, h, who;
        who = PICK(SECTS) + '的圣人';
        if (optionId === 'yield') {
          d = U.irand(12, 20);
          U.gainDao(g, d);
          lf = U.gainLife(g, 70, 180);
          U.printlog(who + '走过时停了一停，说你肩上那式是从' + PICK(AGES) +
            '的路子里化出来的。说完便走。你被说中了，当晚把那式又削去一层锋，道蕴+' + d +
            (lf ? '，寿元+' + lf : ''));
          return;
        }
        if (optionId === 'talk') {
          if (Math.random() < 0.54) {
            c = U.cultPct(g, 0.06, 0.12, 1550);
            d = U.irand(20, 34);
            U.gainDao(g, d);
            U.printlog('三句说完，对方指出你太想把路走直。你回去把最近十年的推演全揉弯了一次，弯完反而通了，实力+' + c + '，道蕴+' + d);
          } else {
            h = U.hurt(g, 60, 152);
            U.printlog(h.exempt ? '第二句双方都住了口，点点头散了，谁也没再追问' :
              '话赶话把旧伤揭开，你在桥头站了很久才把气理顺，寿元-' + h.loss);
          }
          return;
        }
        if (Math.random() < 0.35) {
          c = U.cultPct(g, 0.09, 0.14, 2100);
          d = U.irand(22, 38);
          U.gainDao(g, d);
          U.printlog('一招过完，断桥又断了一截。对方收势时说你赢在不肯先退。你把这句话连同他那一招的力道一起吃进去，实力+' + c + '，道蕴+' + d);
        } else {
          h = U.hurt(g, 78, 184);
          U.printlog(h.exempt ? '招到中途桥面裂开，双方同时收，算谁也没赢' :
            '你被震退三步，嘴角见红，对方没有补刀，只留下一句下次再论，寿元-' + h.loss);
        }
      }
    },

    {
      id: 'lf_st_hellrim_veil', weight: 1.0, maxCount: 1,
      name: '地狱边上的薄纱', tier: 3, tag: 'veil',
      desc: '十八层地狱边缘挂着一层看不透的纱',
      minAge: 200, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 71 && g.lvl <= 80; },
      choice: function (g, U) {
        return {
          lead: '十八层地狱边缘没有门，只有一层薄纱。纱后有人影走动，影子比你高，也比你旧。纱本身不伤人，可掀开的人要自己担看见的东西',
          info: '这不是死地，是一层不愿意被看穿的布',
          note: '不掀最稳；贴着纱看能看见轮廓；掀起一角会看见具体的事，也会被那件事看见。不会死在这里。',
          options: [
            { id: 'leave', label: '记下纱的位置，转身走', desc: '不看，也不被看', safe: true },
            { id: 'press', label: '把额头贴上纱，只看轮廓', desc: '成则得一角法理，败则头痛欲裂', chance: 0.52 },
            { id: 'lift', label: '掀起一角，看清楚再放下', desc: '成则看见具体的事，败则被回视——不致死', chance: 0.31 }
          ]
        };
      },
      resolve: function (g, U, optionId) {
        var c, d, lf, h;
        if (optionId === 'leave') {
          d = U.irand(12, 22);
          U.gainDao(g, d);
          lf = U.gainLife(g, 80, 200);
          U.printlog('你走出去很远还是能感到后颈凉。你把这份凉当作尺子，后来衡量自己的杀心时会用上，道蕴+' + d +
            (lf ? '，寿元+' + lf : ''));
          return;
        }
        if (optionId === 'press') {
          if (Math.random() < 0.52) {
            c = U.cultPct(g, 0.07, 0.12, 1650);
            d = U.irand(18, 34);
            U.gainDao(g, d);
            U.printlog('轮廓是一座桥，桥上站着许多没有脸的人。你数到自己停下的位置，发现那正是你平时最不敢停的地方，实力+' + c + '，道蕴+' + d);
          } else {
            h = U.hurt(g, 66, 162);
            U.printlog(h.exempt ? '额头刚碰上你便退开，纱后有东西转过头，没有追' :
              '轮廓忽然凑近，你像被人用钉子在眉心敲了一下，寿元-' + h.loss);
          }
          return;
        }
        if (Math.random() < 0.31) {
          c = U.cultPct(g, 0.09, 0.14, 2050);
          d = U.irand(24, 40);
          U.gainDao(g, d);
          U.printlog('纱后不是殿宇，是一条你自己走过的路，路上少了几具你以为已经埋掉的仇。你把纱放下，把那几具仇重新埋进心里该埋的位置，实力+' + c + '，道蕴+' + d);
        } else {
          h = U.hurt(g, 80, 188);
          U.printlog(h.exempt ? '纱角刚掀一条缝你便放下，缝后有目光扫过，没有锁死' :
            '回视像一根冷针，从瞳孔扎到后脑，你连退七步才站稳，寿元-' + h.loss);
        }
      }
    },

    /* ================================================================
     * 五层天·大圣  lvl 81-90  minAge 300
     * ================================================================ */

    {
      id: 'lf_ds_roadline_horizon', weight: 1.2, maxCount: 1,
      name: '古路地平线', tier: 3, tag: 'horizon',
      desc: '星空古路走到某一段，天和路平了',
      minAge: 300, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 81 && g.lvl <= 90; },
      choice: function (g, U) {
        return {
          lead: '星空古路第二段的尽头，路和天接在一起。前面没有碑，没有驿站，只有一条细得像刀口的地平线，走的人会在那里变成一个点',
          info: '地平线不是尽头，是眼睛先到达的地方',
          note: '记下方位就折返最稳；走到线边停住能看见自己的来路；盯到暮色可能把神识拉细。',
          options: [
            { id: 'mark', label: '在路边刻一个自己认得的记号，转身往回走', desc: '路还在，不急着把点走没', safe: true },
            { id: 'edge', label: '走到线边，看清楚来路再退', desc: '成则把来路看穿，败则眼花路乱', chance: 0.50 },
            { id: 'stare', label: '对着那条刀口看到暮色落尽', desc: '成则神识被拉长，败则空得发慌', chance: 0.30 }
          ]
        };
      },
      resolve: function (g, U, optionId) {
        var c, d, lf, h;
        if (optionId === 'mark') {
          d = U.irand(14, 22);
          U.gainDao(g, d);
          lf = U.gainLife(g, 90, 220);
          U.printlog('你刻的是自己今年的岁数。回头时地平线还在，像不催人。后来你每逢想一口气走完的时候，都会想起这个数字，道蕴+' + d +
            (lf ? '，寿元+' + lf : ''));
          return;
        }
        if (optionId === 'edge') {
          if (Math.random() < 0.50) {
            c = U.cultPct(g, 0.07, 0.12, 2200);
            d = U.irand(20, 34);
            U.gainDao(g, d);
            U.printlog('线边往回看，来路短得不像自己走了那么多年。你看清哪些年是绕的，哪些年是停的，把绕的那几段在心里抹直，实力+' + c + '，道蕴+' + d);
          } else {
            h = U.hurt(g, 80, 190);
            U.printlog(h.exempt ? '线边风太大，你眯着眼退回刻痕处，没有硬看' :
              '来路在眼里叠成好几条，你走错半里才摸回原记号，寿元-' + h.loss);
          }
          return;
        }
        if (Math.random() < 0.30) {
          c = U.cultPct(g, 0.09, 0.14, 2800);
          d = U.irand(24, 40);
          U.gainDao(g, d);
          U.printlog('暮色把刀口染红的时候，你的神识被拉成一根线，线的那头还是你。收回来之后，远处的气息比以前清楚一截，实力+' + c + '，道蕴+' + d);
        } else {
          h = U.hurt(g, 90, 210);
          U.printlog(h.exempt ? '空意刚往外涌你便坐下，把神识一寸寸拽回丹田' :
            '你空得连自己的名字都慢了半拍，靠在路碑上睡到后半夜才回来，寿元-' + h.loss);
        }
      }
    },

    {
      id: 'lf_ds_qingtong_coffin', weight: 1.4, maxCount: 1,
      name: '驿站里的青铜棺', tier: 3, tag: 'coffin',
      desc: '通天古路驿站正中停着一口没人认领的棺',
      minAge: 300, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 81 && g.lvl <= 90; },
      choice: function (g, U) {
        return {
          lead: '通天古路驿站今夜只有你一个活人。正中停着一口青铜古棺，棺盖合着，缝里偶尔漏出一丝像' +
            PICK(LEGEND_AGES) + '的铁锈味',
          info: '棺不是给你躺的，可它在等一个肯陪它坐一夜的人',
          note: '放一炷香就走最稳；敲三下能问里面还在不在；陪它坐到天亮可能听见一句旧话。',
          options: [
            { id: 'incense', label: '在棺前燃一炷香，拜完便离开驿站', desc: '礼到了，不欠棺里的人', safe: true },
            { id: 'knock', label: '用指节在棺盖上敲三下，听有没有回', desc: '成则得一句旧应，败则被锈意侵体', chance: 0.48 },
            { id: 'sit', label: '靠着棺壁坐到天亮，一句话也不说', desc: '成则听见旧话，败则被棺中气息压住', chance: 0.30 }
          ]
        };
      },
      resolve: function (g, U, optionId) {
        var c, d, lf, h, era;
        era = PICK(LEGEND_AGES);
        if (optionId === 'incense') {
          d = U.irand(14, 22);
          U.gainDao(g, d);
          lf = U.gainLife(g, 90, 230);
          U.printlog('香燃到一半自己灭了。你没有再点。出驿站时风里那点铁锈味淡了，像有人领了这炷香，道蕴+' + d +
            (lf ? '，寿元+' + lf : ''));
          return;
        }
        if (optionId === 'knock') {
          if (Math.random() < 0.48) {
            c = U.cultPct(g, 0.07, 0.12, 2300);
            d = U.irand(20, 34);
            U.gainDao(g, d);
            U.printlog('第三下敲完，棺里回了一声极轻的「在」。没有下文。你把这一声当作自己还在路上的证据，走的时候步子稳了，实力+' + c + '，道蕴+' + d);
          } else {
            h = U.hurt(g, 82, 196);
            U.printlog(h.exempt ? '锈意刚爬上指节你便收手，棺盖安静如初' :
              '锈味钻进指甲缝，你洗了三次手还有一股' + era + '的腥，寿元-' + h.loss);
          }
          return;
        }
        if (Math.random() < 0.30) {
          c = U.cultPct(g, 0.09, 0.14, 2900);
          d = U.irand(24, 40);
          U.gainDao(g, d);
          U.printlog('天亮前棺里有人用很老的口音说别躺进来。你没有问他是谁。这句话后来成了你不肯提前给自己收场的理由，实力+' + c + '，道蕴+' + d);
        } else {
          h = U.hurt(g, 94, 216);
          U.printlog(h.exempt ? '棺中气息刚压上肩你便起身，到屋外吹风直到肩头回暖' :
            '你被压得几乎贴地，靠着把指尖掐进掌心才撑到鸡鸣，寿元-' + h.loss);
        }
      }
    },

    {
      id: 'lf_ds_daoangle_law', weight: 1.3, maxCount: 1,
      name: '道则自己现了一角', tier: 3, tag: 'law',
      desc: '一条法则从虚空里垂下来，像不肯收的线',
      minAge: 300, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 81 && g.lvl <= 90; },
      choice: function (g, U) {
        return {
          lead: '你在' + PICK(REGIONS) + '推演到卡住的地方，头顶忽然垂下一缕金线，细得像从天穹缝里漏出来的' +
            PICK(T3_GONG) + '的某一句，悬在手边，不进也不退',
          info: '线不是给你拿走的，是给你对照的',
          note: '只把这一句抄下来最稳；伸手碰一下能对上自己的缺口；让它从身上穿过去会痛，但能把路洗一遍。',
          options: [
            { id: 'copy', label: '不碰金线，只把看见的那一句抄进识海', desc: '对照有了，线自己会走', safe: true },
            { id: 'touch', label: '用指腹碰一下线，立刻松开', desc: '成则对上缺口，败则指尖发麻', chance: 0.47 },
            { id: 'through', label: '跨前一步，让金线从肩到腰穿过去', desc: '成则法则洗身，败则经脉发烫——不致死', chance: 0.28 }
          ]
        };
      },
      resolve: function (g, U, optionId) {
        var c, d, lf, h, gong;
        gong = PICK(T3_GONG);
        if (optionId === 'copy') {
          d = U.irand(16, 26);
          U.gainDao(g, d);
          lf = U.gainLife(g, 100, 240);
          U.printlog('金线在你抄完最后一个字时收了回去。那一句不像' + gong +
            '的原文，更像原文被人改过的批注。你把批注留下，道蕴+' + d +
            (lf ? '，寿元+' + lf : ''));
          return;
        }
        if (optionId === 'touch') {
          if (Math.random() < 0.47) {
            c = U.cultPct(g, 0.07, 0.13, 2400);
            d = U.irand(22, 36);
            U.gainDao(g, d);
            U.printlog('指腹碰到的不是热，是准。你立刻知道自己卡了二十年的那一关差在哪一息上，回去只改了半寸呼吸，实力+' + c + '，道蕴+' + d);
          } else {
            h = U.hurt(g, 84, 200);
            U.printlog(h.exempt ? '线比你想的烫，你松得快，只红了一小块皮' :
              '麻意从指尖窜到肩井，你甩了半个时辰才恢复握剑，寿元-' + h.loss);
          }
          return;
        }
        if (Math.random() < 0.28) {
          c = U.cultPct(g, 0.10, 0.14, 3200);
          d = U.irand(26, 40);
          U.gainDao(g, d);
          U.printlog('金线穿过身体时，沿途把一些你舍不得扔的旧招烫断了。痛过之后那些招接不回去，空出来的位置反而能走新的，实力+' + c + '，道蕴+' + d);
        } else {
          h = U.hurt(g, 96, 220);
          U.printlog(h.exempt ? '线刚入肩你便侧开，只在衣上留下一道焦痕' :
            '经脉像被开水浇过，你坐在原地运功到后半夜才把热压下去，寿元-' + h.loss);
        }
      }
    },

    {
      id: 'lf_ds_yizhan_lonely', weight: 1.1, maxCount: 1,
      name: '通天驿站独坐', tier: 3, tag: 'lonely',
      desc: '驿站的灯还亮着，可很久没有下一个人来',
      minAge: 300, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 81 && g.lvl <= 90; },
      choice: function (g, U) {
        return {
          lead: '通天古路驿站的灯油是满的。你推门进去，桌上还有半杯凉茶，杯沿的指印已经淡了。门外风走了一夜，没有第二双脚步',
          info: '大圣之后的路，常常是一个人的',
          note: '喝完那半杯就走最稳；在此独坐一年能把杂响坐死；等到有人来——可能谁也不来。',
          options: [
            { id: 'drink', label: '把凉茶喝完，把门带上，继续赶路', desc: '不在空屋里把自己坐老', safe: true },
            { id: 'year', label: '留下，按自己的日子坐满一年', desc: '成则杂念坐死，败则心沉下去', chance: 0.46 },
            { id: 'wait', label: '把灯添满，等到真正有人推门', desc: '成则在等待里开窍，败则空耗神魂', chance: 0.27 }
          ]
        };
      },
      resolve: function (g, U, optionId) {
        var c, d, lf, h;
        if (optionId === 'drink') {
          d = U.irand(14, 22);
          U.gainDao(g, d);
          lf = U.gainLife(g, 90, 220);
          U.printlog('茶是苦的，苦得刚好把一路上的应酬味冲掉。你把门扣好，听见自己的脚步重新变响，道蕴+' + d +
            (lf ? '，寿元+' + lf : ''));
          return;
        }
        if (optionId === 'year') {
          if (Math.random() < 0.46) {
            c = U.cultPct(g, 0.08, 0.13, 2500);
            d = U.irand(22, 36);
            U.gainDao(g, d);
            U.printlog('一年里你数过三百六十次日出。到后来，想被人看见的那一点自己死了。出门时肩上轻了一块，实力+' + c + '，道蕴+' + d);
          } else {
            h = U.hurt(g, 86, 204);
            U.printlog(h.exempt ? '坐到第三百日你发现心往下沉，当天就收拾出门，没有硬满一年' :
              '你把一年坐满了，可出门时连说话都慢半拍，像把自己忘在屋里，寿元-' + h.loss);
          }
          return;
        }
        if (Math.random() < 0.27) {
          c = U.cultPct(g, 0.10, 0.14, 3100);
          d = U.irand(24, 40);
          U.gainDao(g, d);
          U.printlog('门始终没开。你等到灯油见底才明白：等的不是人，是自己肯不肯一个人把灯添完。你把最后一滴油添进去，然后走了，实力+' + c + '，道蕴+' + d);
        } else {
          h = U.hurt(g, 98, 224);
          U.printlog(h.exempt ? '你在第四十九日把灯吹灭，承认自己等不来，这不算输' :
            '灯亮着的日子把神魂熬薄了，你走出驿站时眼前直发白，寿元-' + h.loss);
        }
      }
    },

    {
      id: 'lf_ds_askdao_dusk', weight: 1.5, maxCount: 1,
      name: '黄昏时有人问道', tier: 3, tag: 'dusk',
      desc: '日头压山，路边有人问你还走不走',
      minAge: 300, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 81 && g.lvl <= 90; },
      choice: function (g, U) {
        return {
          lead: PICK(REGIONS) + '的黄昏比别处短。一个看不清面目的人坐在土埂上，问你还走吗。问完便看着日头，不再催',
          info: '这人未必是敌，也未必是友，更像是把你心里那句话问出了口',
          note: '不答，看日头落完最稳；用自己的路答一句能把心钉住；陪他坐到天黑可能把黄昏走法学来。',
          options: [
            { id: 'silent', label: '不答，只在他对面坐下，看日头落完', desc: '问可以不问，路还是自己的', safe: true },
            { id: 'answer', label: '把你现在走的那条路用一句话说完', desc: '成则心钉住，败则被问句反难', chance: 0.45 },
            { id: 'stay', label: '陪他坐到最后一丝光灭尽', desc: '成则得黄昏走法，败则暮气入体', chance: 0.26 }
          ]
        };
      },
      resolve: function (g, U, optionId) {
        var c, d, lf, h;
        if (optionId === 'silent') {
          d = U.irand(16, 24);
          U.gainDao(g, d);
          lf = U.gainLife(g, 100, 240);
          U.printlog('日头落完，那人也不见了。土埂上留着一个浅坑，刚好是一个人坐过的。你把浅坑填平，发现自己并不需要回答任何人，道蕴+' + d +
            (lf ? '，寿元+' + lf : ''));
          return;
        }
        if (optionId === 'answer') {
          if (Math.random() < 0.45) {
            c = U.cultPct(g, 0.08, 0.13, 2600);
            d = U.irand(22, 36);
            U.gainDao(g, d);
            U.printlog('你说走到不能走为止。那人笑了一下，日头正好被山咬去一半。这句话后来成了你的尺子，量过许多想退的夜晚，实力+' + c + '，道蕴+' + d);
          } else {
            h = U.hurt(g, 88, 208);
            U.printlog(h.exempt ? '话说到一半你自己停了，那人也没有追问' :
              '问句像回声，把你没说圆的地方一一顶回来，你当晚失眠到四更，寿元-' + h.loss);
          }
          return;
        }
        if (Math.random() < 0.26) {
          c = U.cultPct(g, 0.10, 0.14, 3300);
          d = U.irand(26, 40);
          U.gainDao(g, d);
          U.printlog('最后一丝光灭尽时，你看清他起身的方式：不是走，是把白天慢慢收进骨头里。你学了这一收，夜里行路不再费神，实力+' + c + '，道蕴+' + d);
        } else {
          h = U.hurt(g, 100, 228);
          U.printlog(h.exempt ? '暮气刚沾衣你便起身，那人挥挥手，没有留你' :
            '暮气沉进关节，你有七日天亮得比别人慢，寿元-' + h.loss);
        }
      }
    },

    /* ================================================================
     * 准帝一至九重天  lvl 91-99  minAge 500
     * ================================================================ */

    {
      id: 'lf_zd_gate_threshold', weight: 1.3, maxCount: 1,
      name: '帝关门槛上坐着', tier: 3, tag: 'threshold',
      desc: '门还没开，门槛已经比人高',
      minAge: 500, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 91 && g.lvl <= 99; },
      choice: function (g, U) {
        return {
          lead: '你在' + PICK(REGIONS) + '看见一道没有门扇的门槛，高过膝盖。门槛上没有字，可所有走到这里的人都会不约而同地停——包括你',
          info: '这不是帝关本身，是帝关在大地上投下的一条影子',
          note: '量完门槛高度就离开最稳；把掌心按上去能感觉重量；站到膝头发软也不迈过去，是在练停。',
          options: [
            { id: 'measure', label: '用自己的骨尺量完高度，记下，离开', desc: '知道有多高，比贸然迈强', safe: true },
            { id: 'palm', label: '把掌心按在门槛上，数完一百下再收', desc: '成则习惯这份重量，败则腕骨发麻', chance: 0.44 },
            { id: 'stand', label: '贴着门槛站到膝头发软，始终不迈', desc: '成则把停练成力，败则气血下沉', chance: 0.26 }
          ]
        };
      },
      resolve: function (g, U, optionId) {
        var c, d, lf, h;
        if (optionId === 'measure') {
          d = U.irand(16, 26);
          U.gainDao(g, d);
          lf = U.gainLife(g, 110, 250);
          U.printlog('量完你才发现，门槛其实不高，高的是自己不肯迈的那一口气。你把这个发现带走，没有留下脚印，道蕴+' + d +
            (lf ? '，寿元+' + lf : ''));
          return;
        }
        if (optionId === 'palm') {
          if (Math.random() < 0.44) {
            c = U.cultPct(g, 0.08, 0.13, 3000);
            d = U.irand(22, 36);
            U.gainDao(g, d);
            U.printlog('一百下按完，掌心的纹路里多了一道横的。那不是伤，是重量的记忆。后来你承压时会先想起这道纹，实力+' + c + '，道蕴+' + d);
          } else {
            h = U.hurt(g, 100, 230);
            U.printlog(h.exempt ? '数到七十你腕骨发响，及时收手，门槛上只留下一点热' :
              '重量从掌心灌到肩，你收手时手指握不拢，寿元-' + h.loss);
          }
          return;
        }
        if (Math.random() < 0.26) {
          c = U.cultPct(g, 0.10, 0.14, 3800);
          d = U.irand(26, 40);
          U.gainDao(g, d);
          U.printlog('膝盖软了你还是没迈。软的那一刻你忽然明白：帝关要的不是勇气，是肯在门槛前把自己站直。你站直了，然后离开，实力+' + c + '，道蕴+' + d);
        } else {
          h = U.hurt(g, 110, 250);
          U.printlog(h.exempt ? '气血刚往下沉你便坐下，把腿揉热再走，没有硬撑' :
            '你站得太久，站起来时眼前发黑，扶着门槛缓了许久，寿元-' + h.loss);
        }
      }
    },

    {
      id: 'lf_zd_oldvoice_echo', weight: 1.2, maxCount: 1,
      name: '听见古帝说话', tier: 3, tag: 'echo',
      desc: '星空里有一句很老的话，在找耳朵',
      minAge: 500, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 91 && g.lvl <= 99; },
      choice: function (g, U) {
        var era = eraPair();
        return {
          lead: '星空古路第三段的风里，反复滚着一句残音。有人用' + PICK(LEGEND_AGES) +
            '的口音说半句，后半句被从' + era.from + '到' + era.to + '的风撕碎了',
          info: '回声不是传承，是有人把话说得太重，重到现在还没落地',
          note: '捂住耳朵只听自己的呼吸最稳；听完能听清的那半句；把整句听完可能被旧口音带偏。',
          options: [
            { id: 'cover', label: '捂住耳朵，只数自己的呼吸到风停', desc: '别人的话不必都进耳朵', safe: true },
            { id: 'half', label: '只把能听清的那半句听完，后面的放过', desc: '成则得半句真意，败则口音入识', chance: 0.42 },
            { id: 'full', label: '顺着风把整句残音捡完', desc: '成则听完全句，败则被旧道带着走', chance: 0.24 }
          ]
        };
      },
      resolve: function (g, U, optionId) {
        var c, d, lf, h, era;
        era = eraPair();
        if (optionId === 'cover') {
          d = U.irand(16, 26);
          U.gainDao(g, d);
          lf = U.gainLife(g, 110, 260);
          U.printlog('风停的时候，你的呼吸比来时慢，也比来时稳。有些话不进耳朵，反而让你把自己的那句听得更清楚，道蕴+' + d +
            (lf ? '，寿元+' + lf : ''));
          return;
        }
        if (optionId === 'half') {
          if (Math.random() < 0.42) {
            c = U.cultPct(g, 0.08, 0.13, 3100);
            d = U.irand(22, 36);
            U.gainDao(g, d);
            U.printlog('听清的半句是不要用别人的关当自己的门。后半句你没有追。这句话够你用很久，实力+' + c + '，道蕴+' + d);
          } else {
            h = U.hurt(g, 102, 236);
            U.printlog(h.exempt ? '口音刚往识海里钻你便哼了一段自己的调，把它顶回去' :
              '半句残音在脑后转了整夜，你用自己的名字把它一遍遍盖住，寿元-' + h.loss);
          }
          return;
        }
        if (Math.random() < 0.24) {
          c = U.cultPct(g, 0.10, 0.14, 3900);
          d = U.irand(26, 40);
          U.gainDao(g, d);
          U.printlog('整句捡完，原来只是一个从' + era.from + '活到' + era.to +
            '的人在说我走错了。你没有笑。把别人的错路看完，自己的路反而窄得更清楚，实力+' + c + '，道蕴+' + d);
        } else {
          h = U.hurt(g, 114, 256);
          U.printlog(h.exempt ? '旧道刚要带你偏，你在风里蹲下，等那口音自己散尽' :
            '你跟着残音走了很短的一段，发现脚下不是自己的纹路，退回来时腿是软的，寿元-' + h.loss);
        }
      }
    },

    {
      id: 'lf_zd_roadside_kneel', weight: 1.4, maxCount: 1,
      name: '有人跪在路边', tier: 3, tag: 'kneel',
      desc: '一位圣地旧人跪着，不求收徒，求你看一眼他们的山门',
      minAge: 500, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 91 && g.lvl <= 99; },
      choice: function (g, U) {
        return {
          lead: PICK(SECTS) + '一位须发皆白的执事跪在官道正中，腰牌还在，山门却已经歪了。他不求你收徒，只求你去看一眼他们还剩多少人',
          info: '准帝的路很窄，弯一次就可能晚一个时代',
          note: '扶他起来拒绝最稳；给他一件信物让他自己撑；陪他走三日会耽误自己，也可能把心垫稳。',
          options: [
            { id: 'up', label: '把他扶起来，说你帮不了，然后走开', desc: '不欠一座山门的命', safe: true },
            { id: 'token', label: '解下一件自己用旧的物件给他压山门', desc: '成则山门暂稳、你也得回响，败则物去神泄', chance: 0.43 },
            { id: 'walk', label: '陪他走三日，只看到山门，不入局', desc: '成则把心垫稳，败则在路上惹因果', chance: 0.25 }
          ]
        };
      },
      resolve: function (g, U, optionId) {
        var c, d, lf, h, sect;
        sect = PICK(SECTS);
        if (optionId === 'up') {
          d = U.irand(16, 24);
          U.gainDao(g, d);
          lf = U.gainLife(g, 100, 240);
          U.printlog('老人跪得太久，膝盖已经不听使。你把他扶到路边石上，没有承诺。走远后你发现自己的背比来时直——拒绝有时候也是一种修，道蕴+' + d +
            (lf ? '，寿元+' + lf : ''));
          return;
        }
        if (optionId === 'token') {
          if (Math.random() < 0.43) {
            c = U.cultPct(g, 0.08, 0.13, 3200);
            d = U.irand(22, 36);
            U.gainDao(g, d);
            U.printlog('你把一枚用旧的玉扣按进他手里。玉扣离开时回了一下，像把你这些年压住的杂气带走了一层。' + sect +
              '的山门后来有没有住，你没有再问，实力+' + c + '，道蕴+' + d);
          } else {
            h = U.hurt(g, 104, 240);
            U.printlog(h.exempt ? '玉扣刚离手你便觉得空，及时把一缕神识收回，没有真泄' :
              '信物带走的比你想的多，你当天走起路来脚下轻得发虚，寿元-' + h.loss);
          }
          return;
        }
        if (Math.random() < 0.25) {
          c = U.cultPct(g, 0.10, 0.14, 4000);
          d = U.irand(26, 40);
          U.gainDao(g, d);
          U.printlog('三日后你看见那座歪着的山门。门里还有人在扫台阶。你没有进去，只在门外站到扫完。走的时候心里那块已经高过他们的地方平了，实力+' + c + '，道蕴+' + d);
        } else {
          h = U.hurt(g, 116, 260);
          U.printlog(h.exempt ? '半路遇上仇家寻上门，老人自己挡出去，挥手让你走另一条沟' :
            '寻仇的人认准了准帝的气息，你为了不当街开杀，硬吃了一记擦肩，寿元-' + h.loss);
        }
      }
    },

    {
      id: 'lf_zd_onenian_still', weight: 1.1, maxCount: 1,
      name: '一念停了很久', tier: 3, tag: 'still',
      desc: '茶凉了，念头还没有下一句',
      minAge: 500, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 91 && g.lvl <= 99; },
      choice: function (g, U) {
        return {
          lead: '你在一座无名小屋里坐下。茶斟上，第一口还没喝，识海里那句一直往前赶的话忽然停了。停得很干净，像有人把笔搁下',
          info: '准帝最怕的不是走不动，是停下来以后不知道自己还是不是自己',
          note: '喝完这杯就起身最稳；按一个甲子的工夫坐；坐到看见一颗星落下，可能把停坐实。',
          options: [
            { id: 'tea', label: '把这杯茶喝完，起身继续赶路', desc: '停可以，不要停成坑', safe: true },
            { id: 'jiazi', label: '按一个甲子的工夫坐，坐满再睁眼', desc: '成则杂念死尽，败则神识发木', chance: 0.40 },
            { id: 'star', label: '不睁眼，直到感觉有一颗星从窗外落下去', desc: '成则一念真停，败则空得太过', chance: 0.23 }
          ]
        };
      },
      resolve: function (g, U, optionId) {
        var c, d, lf, h;
        if (optionId === 'tea') {
          d = U.irand(16, 26);
          U.gainDao(g, d);
          lf = U.gainLife(g, 110, 260);
          U.printlog('茶凉了你还是喝完。起身时那句停住的话自己接上了后半截，后半截很短，短得刚好能走。道蕴+' + d +
            (lf ? '，寿元+' + lf : ''));
          return;
        }
        if (optionId === 'jiazi') {
          if (Math.random() < 0.40) {
            c = U.cultPct(g, 0.08, 0.13, 3300);
            d = U.irand(24, 38);
            U.gainDao(g, d);
            U.printlog('睁眼时小屋还是小屋，茶渍却深了一圈。你发现自己不再追问下一步是什么——下一步会自己来，实力+' + c + '，道蕴+' + d);
          } else {
            h = U.hurt(g, 106, 244);
            U.printlog(h.exempt ? '坐到中途神识发木，你提前睁眼，在屋里走了三百步把木意走散' :
              '你坐满了，可站起来时连自己的名字都要在心里默两遍，寿元-' + h.loss);
          }
          return;
        }
        if (Math.random() < 0.23) {
          c = U.cultPct(g, 0.10, 0.14, 4100);
          d = U.irand(28, 40);
          U.gainDao(g, d);
          U.printlog('星落下去的时候，你没有睁眼。那一念停得彻底，停完又活过来，像冬天过后的井。你出屋时步子很轻，轻得像还没落地，实力+' + c + '，道蕴+' + d);
        } else {
          h = U.hurt(g, 118, 264);
          U.printlog(h.exempt ? '空意深过井口时你咬破舌尖，腥味把你拽回小屋' :
            '你空得太过，有一瞬分不清自己还在不在这具身体里，回笼后大汗淋漓，寿元-' + h.loss);
        }
      }
    },

    {
      id: 'lf_zd_before_laststep', weight: 1.0, maxCount: 1,
      name: '最后一步还没迈', tier: 3, tag: 'laststep',
      desc: '脚已经抬起来，地面还在等',
      minAge: 500, maxAge: 10000,
      available: function (g) { return !g.becameEmperor && g.lvl >= 91 && g.lvl <= 99; },
      choice: function (g, U) {
        return {
          lead: '星空里有一块比周围更黑的空地。你走到边缘时，前脚已经抬起来了——像有人在前面轻轻拍了拍地面，请你迈。你知道迈出去就不是今天的自己',
          info: '这不是死门，是一扇还没轮到你开的门。今日任何选择都不会把命交出去',
          note: '把脚收回来坐下最稳；先退半步看清空地；往前倾但不迈过线，能感觉门缝里的风。',
          options: [
            { id: 'sit', label: '把脚收回来，就地坐下，看空地自己暗着', desc: '今日不迈，把还没到坐实', safe: true },
            { id: 'back', label: '先退半步，把空地的边看清楚', desc: '成则看清门缝，败则气机回荡', chance: 0.38 },
            { id: 'lean', label: '身体往前倾，脚尖不越过那条暗线', desc: '成则借到门缝里的风，败则被风灌——不致死', chance: 0.22 }
          ]
        };
      },
      resolve: function (g, U, optionId) {
        var c, d, lf, h;
        if (optionId === 'sit') {
          d = U.irand(18, 28);
          U.gainDao(g, d);
          lf = U.gainLife(g, 120, 280);
          U.printlog('你坐下之后，空地没有消失。它只是不再拍地面。你在那里坐到自己把还没到三个字嚼碎，起身时心里反而定，道蕴+' + d +
            (lf ? '，寿元+' + lf : ''));
          return;
        }
        if (optionId === 'back') {
          if (Math.random() < 0.38) {
            c = U.cultPct(g, 0.08, 0.13, 3400);
            d = U.irand(24, 38);
            U.gainDao(g, d);
            U.printlog('退半步，你看见暗线其实是自己的影子。门不在前面，在你脚底下。这个发现够你再走很多年，实力+' + c + '，道蕴+' + d);
          } else {
            h = U.hurt(g, 108, 248);
            U.printlog(h.exempt ? '气机刚回荡你便坐下，让它自己平，没有再看' :
              '退步带起的风在胸腔里转了一圈，你咳出一口浊气，寿元-' + h.loss);
          }
          return;
        }
        if (Math.random() < 0.22) {
          c = U.cultPct(g, 0.10, 0.14, 4200);
          d = U.irand(28, 40);
          U.gainDao(g, d);
          U.printlog('门缝里的风很干净，干净得像还没有人的时代。你没有迈出去，只让风从鼻端走过。后来你辨真假时，会用这口风作尺子，实力+' + c + '，道蕴+' + d);
        } else {
          h = U.hurt(g, 120, 270);
          U.printlog(h.exempt ? '风刚灌进袖管你便坐回去，暗线那边安静了' :
            '风灌进识海，把一些还没想完的句子吹乱，你花了很长时间才重新理顺，寿元-' + h.loss);
        }
      }
    }

  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = EVENTS;
  root.EVENT_PACK_LIFE_LATE = EVENTS;
})(typeof self !== 'undefined' ? self : this);
