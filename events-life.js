/* ============================================================
 * 遮天模拟器 · 阶段人生包
 * 按境界切开的路边故事；可用 needPhys / needFamily / daoMin / daoMax
 * 把不同体质、不同悟性的人生岔开。一律选择型，一生一次。
 * ============================================================ */
(function (root) {
  var POOLS = typeof module !== 'undefined' && module.exports ? require('./events-pools.js') : root.EVENT_POOLS;
  var PICK = POOLS.PICK;
  var SECTS = POOLS.SECTS, REGIONS = POOLS.REGIONS, RIVAL_TITLES = POOLS.RIVAL_TITLES;
  var T2_HERB = POOLS.T2_HERB, T2_GONG = POOLS.T2_GONG, T2_MI = POOLS.T2_MI;
  var T3_HERB = POOLS.T3_HERB, T3_GONG = POOLS.T3_GONG;

  function ev(o) {
    return {
      id: o.id, name: o.name, tier: o.tier || 2, tag: o.tag,
      weight: o.weight || 2.2, maxCount: 1,
      minAge: o.minAge || 8, maxAge: o.maxAge || 30000,
      needPhys: o.needPhys, needFamily: o.needFamily,
      daoMin: o.daoMin, daoMax: o.daoMax,
      innateMin: o.innateMin, innateMax: o.innateMax,
      available: function (g) {
        return !g.becameEmperor && g.lvl >= o.lo && g.lvl <= o.hi;
      },
      choice: o.choice,
      resolve: o.resolve
    };
  }

  var EVENTS = [

    /* ---------- 轮海 ---------- */
    ev({
      id: 'lf_village_well', name: '村井异响', tier: 2, tag: 'village', lo: 1, hi: 10, minAge: 8, weight: 2.3,
      choice: function (g, U) {
        return {
          lead: '村东那口废井夜里会响，老人说底下埋着一截旧兵器',
          info: '下去或许摸到残兵，也可能只是井壁塌方',
          note: '不去最稳；下去有险，却也只是一口井。',
          options: [
            { id: 'leave', label: '当没听见', desc: '继续砍柴', safe: true },
            { id: 'down', label: '拴绳下井', desc: '摸到残兵则气血微涨', chance: 0.62 }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'leave') { U.printlog('你把井口重新盖上石板。有些响动，听过也就过去了'); return; }
        if (Math.random() < 0.62) {
          var c = U.cultPct(g, 0.02, 0.04, 80);
          U.printlog('井底泥里露出一截断刀，刀脊还带着热。你握了一夜，实力+' + c);
        } else {
          var h = U.hurt(g, 8, 20);
          U.printlog(h.exempt ? '绳断了，你抓着石缝爬上来，只呛了两口水' : '井壁塌了一块，你被砸得眼冒金星，寿元 -' + h.loss);
        }
      }
    }),
    ev({
      id: 'lf_clan_tablet', name: '族谱缺页', tier: 2, tag: 'clan', lo: 1, hi: 10, minAge: 8, weight: 2.2,
      choice: function (g, U) {
        return {
          lead: '祠堂翻修，族谱里你这一支被墨汁盖住了半页',
          info: '追问可能得罪管事；不问则自己也说不清出身',
          note: '不问无事；追问能弄清一截血脉。',
          options: [
            { id: 'quiet', label: '当没看见', desc: '不惹族中长辈', safe: true },
            { id: 'ask', label: '夜里翻出底册', desc: '弄清血脉则心安，道蕴微增' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'quiet') { U.printlog('你把族谱放回原处。缺就缺着，人还在'); return; }
        var d = U.irand(2, 5);
        U.gainDao(g, d);
        U.printlog('底册夹缝里写着「这一支曾出走' + PICK(REGIONS) + '」。你把那行字抄下来，道蕴+' + d);
      }
    }),
    ev({
      id: 'lf_beast_track', name: '山猪夜闯', tier: 2, tag: 'beast', lo: 1, hi: 10, minAge: 8, weight: 2.4,
      choice: function (g, U) {
        return {
          lead: '一头黑山猪拱倒了篱笆，圈里的羊散了一半',
          info: '拦它要挨一记；不拦则要给邻里一个交代',
          note: '躲进屋最稳；拦下来能练胆。',
          options: [
            { id: 'hide', label: '关门等它走', desc: '无损', safe: true },
            { id: 'block', label: '扛矛去拦', desc: '赶走则气血涨一截', chance: 0.55 }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'hide') { U.printlog('你把门闩死。天亮后邻里来要说法，你只说自己当时不在'); return; }
        if (Math.random() < 0.55) {
          var c = U.cultPct(g, 0.018, 0.038, 70);
          U.printlog('矛尖刺进肩胛，山猪吼着逃进林子。你一夜没睡，实力+' + c);
        } else {
          var h = U.hurt(g, 10, 24);
          U.printlog(h.exempt ? '你被拱翻在泥里，好在没咬中脖子' : '獠牙擦过腰侧，养了半个月，寿元 -' + h.loss);
        }
      }
    }),
    ev({
      id: 'lf_market_fault', name: '集市错秤', tier: 2, tag: 'market', lo: 1, hi: 10, minAge: 8, weight: 2.1,
      choice: function (g, U) {
        return {
          lead: '货郎把一块温热的玉髓当成普通石头称给你',
          info: '收下便占了便宜；还回去只是心安',
          note: '还回去无得失；收下可能是块废石，也可能不是。',
          options: [
            { id: 'return', label: '当场还回去', desc: '心安', safe: true },
            { id: 'keep', label: '装进怀里就走', desc: '炼化则略有所得', chance: 0.5 }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'return') { U.printlog('货郎愣了一下，多塞给你两把含元露，说这孩子心正'); return; }
        if (Math.random() < 0.5) {
          var c = U.cultPct(g, 0.015, 0.03, 60);
          U.printlog('玉髓入腹化成一缕温热，原来是' + PICK(T2_HERB) + '的芯，实力+' + c);
        } else {
          U.printlog('回家用刀一剖，里面是普通河石。你把碎片扔进鸡窝');
        }
      }
    }),
    ev({
      id: 'lf_omen_crows', name: '三日乌鸦', tier: 2, tag: 'omen', lo: 1, hi: 10, minAge: 8, weight: 2.0,
      choice: function (g, U) {
        return {
          lead: '屋顶连三日落满乌鸦，族里有人要你去庙里上香',
          info: '上香只是个心安；自己观天象或许能悟一点',
          note: '上香无事；观天看悟性。',
          options: [
            { id: 'incense', label: '去庙里上香', desc: '求个心安', safe: true },
            { id: 'watch', label: '夜里看它们从哪来', desc: '或有一丝感悟' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'incense') { U.printlog('香灰落在手背。乌鸦第四天自己散了'); return; }
        var d = U.irand(1, 4);
        U.gainDao(g, d);
        U.printlog('它们是从北原方向来的。你看了一夜星，道蕴+' + d);
      }
    }),

    /* ---------- 道宫 ---------- */
    ev({
      id: 'lf_lecture_eaves', name: '墙外听经', tier: 2, tag: 'lecture', lo: 11, hi: 20, minAge: 14, weight: 2.3,
      choice: function (g, U) {
        return {
          lead: PICK(SECTS) + '外门讲《' + PICK(T2_GONG) + '》，门卫不让闲人进',
          info: '翻墙听半日，可能被赶；走掉就当没遇见',
          note: '走开最稳；偷听成则开窍。',
          options: [
            { id: 'go', label: '转身离开', desc: '不惹事', safe: true },
            { id: 'listen', label: '贴着墙根听完', desc: '听懂则法门微通', chance: 0.58 }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'go') { U.printlog('你把衣襟理好，沿官道走了。经文以后有的是'); return; }
        if (Math.random() < 0.58) {
          var c = U.cultPct(g, 0.02, 0.045, 140);
          var d = U.irand(2, 5);
          U.gainDao(g, d);
          U.printlog('讲经人恰好把「气落命泉」那一句重复了三遍。你在墙根坐到天黑，实力+' + c + '，道蕴+' + d);
        } else {
          U.printlog('巡卫一脚踢开你。你在尘土里听完了最后半句，却一个字也没留下来');
        }
      }
    }),
    ev({
      id: 'lf_relic_stele', name: '断碑残字', tier: 2, tag: 'relic', lo: 11, hi: 20, minAge: 14, weight: 2.2,
      choice: function (g, U) {
        return {
          lead: '官道旁半截断碑，字被青苔吃掉大半，只余「苦海」二字清楚',
          info: '坐下来描，可能描出自己的路；路过则只当风景',
          note: '路过无得失；描碑耗一下午。',
          options: [
            { id: 'pass', label: '看一眼就走', desc: '不当回事', safe: true },
            { id: 'copy', label: '拓下来慢慢想', desc: '或有所悟' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'pass') { U.printlog('你摸了摸碑面的凹槽，继续赶路'); return; }
        var d = U.irand(3, 6);
        U.gainDao(g, d);
        U.printlog('拓片在火边烤干。缺的那些字你按自己的意思补上了——对不对另说，道蕴+' + d);
      }
    }),
    ev({
      id: 'lf_herb_dew', name: '晨露药圃', tier: 2, tag: 'herb', lo: 11, hi: 20, minAge: 14, weight: 2.1,
      choice: function (g, U) {
        return {
          lead: '山坳里一畦无人看管的' + PICK(T2_HERB) + '，叶上全是露',
          info: '采几株能用；整畦搬走可能有主人',
          note: '不采最稳；少采无事。',
          options: [
            { id: 'none', label: '只看不动', desc: '当风景', safe: true },
            { id: 'few', label: '采三株便走', desc: '炼化略补气血' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'none') { U.printlog('你在田埂上坐了一会儿，把露水抖回土里'); return; }
        var lf = U.gainLife(g, 8, 22);
        var c = U.cultPct(g, 0.015, 0.032, 120);
        U.printlog('三株入药，苦得你咧嘴' + (lf ? '，寿元+' + lf : '') + '，实力+' + c);
      }
    }),
    ev({
      id: 'lf_travel_companion', name: '同路散修', tier: 2, tag: 'travel', lo: 11, hi: 20, minAge: 14, weight: 2.2,
      choice: function (g, U) {
        return {
          lead: '一名走脚的散修邀你结伴过' + PICK(T2_MI) + '外围',
          info: '结伴能省力气；独自走则不被人看清底细',
          note: '拒绝无事；同行可能学两招。',
          options: [
            { id: 'alone', label: '自己走', desc: '不交底', safe: true },
            { id: 'with', label: '结伴三日', desc: '听他讲路上的规矩' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'alone') { U.printlog('你拱手说各走各的。他也不勉强'); return; }
        var c = U.cultPct(g, 0.018, 0.036, 130);
        U.printlog('他教你辨兽粪和禁制残纹。三日后在岔路分开，实力+' + c);
      }
    }),
    ev({
      id: 'lf_trial_outer', name: '外门试炼旁听', tier: 2, tag: 'trial', lo: 11, hi: 20, minAge: 14, weight: 2.3,
      choice: function (g, U) {
        var p = U.clamp(0.40 + (g.innate || 1) * 0.02, 0.38, 0.7);
        g.pendingLifeP = p;
        return {
          lead: PICK(SECTS) + '外门比试缺人，有执事看你一眼，问要不要下场',
          info: '下场赢了有薄赏；输了当众出丑',
          note: '旁观最稳；下场看体质。',
          options: [
            { id: 'watch', label: '只在场边看', desc: '不露脸', safe: true },
            { id: 'join', label: '下场打一轮', desc: '赢则得些资源', chance: p }
          ]
        };
      },
      resolve: function (g, U, id) {
        var p = g.pendingLifeP != null ? g.pendingLifeP : 0.45;
        g.pendingLifeP = null;
        if (id === 'watch') { U.printlog('你把别人的出拳节奏记在心里，没有举手'); return; }
        if (Math.random() < p) {
          var c = U.cultPct(g, 0.022, 0.045, 160);
          U.printlog('你把对手逼出圈子。执事扔过来一小瓶地脉乳液，实力+' + c);
        } else {
          U.printlog('你被一掌拍下台。没人笑出声，只是没有人再看你');
        }
      }
    }),

    /* ---------- 四极 ---------- */
    ev({
      id: 'lf_array_dust', name: '残阵扫地', tier: 2, tag: 'array', lo: 21, hi: 30, minAge: 18, weight: 2.2,
      choice: function (g, U) {
        return {
          lead: '荒村里一座还在转的旧阵，阵眼积了三年的灰',
          info: '清灰可能接上旧法；不管它，阵自己也会停',
          note: '走开无事；动手有小险。',
          options: [
            { id: 'away', label: '绕村而过', desc: '不碰旧阵', safe: true },
            { id: 'sweep', label: '按纹路把灰扫开', desc: '接上则身法微快', chance: 0.6 }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'away') { U.printlog('你从村后田埂走了。阵嗡了一声，像是送客'); return; }
        if (Math.random() < 0.6) {
          var c = U.cultPct(g, 0.025, 0.045, 220);
          U.printlog('灰一开，脚下的纹亮了半息。你踩着那半息出了村，实力+' + c);
        } else {
          var h = U.hurt(g, 15, 40);
          U.printlog(h.exempt ? '阵纹反噬，你甩手退出圈外' : '旧禁制拍在肩上，半个月抬不起臂，寿元 -' + h.loss);
        }
      }
    }),
    ev({
      id: 'lf_cave_echo', name: '石窟回音', tier: 2, tag: 'cave', lo: 21, hi: 30, minAge: 18, weight: 2.2,
      choice: function (g, U) {
        return {
          lead: '山壁裂开一条缝，里面有人说话，走近又只是风',
          info: '进缝可能碰到残修遗物；不进最干净',
          note: '不进无事。',
          options: [
            { id: 'skip', label: '当风声', desc: '继续赶路', safe: true },
            { id: 'enter', label: '侧身挤进去', desc: '或得残页' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'skip') { U.printlog('你把缝口的碎石踢回去，把风堵上'); return; }
        var d = U.irand(3, 6);
        U.gainDao(g, d);
        U.printlog('缝底只有一页被熏黑的《' + PICK(T2_GONG) + '》残抄。你读完烧掉，道蕴+' + d);
      }
    }),
    ev({
      id: 'lf_envoy_letter', name: '圣地信使', tier: 2, tag: 'envoy', lo: 21, hi: 30, minAge: 18, weight: 2.1,
      choice: function (g, U) {
        return {
          lead: PICK(SECTS) + '的信使把你错认成同门，把一封密信塞进你手里',
          info: '拆开可能惹因果；原封送回最省事',
          note: '送回最稳；拆开看一眼就扔。',
          options: [
            { id: 'return', label: '原封追还', desc: '不当这回事', safe: true },
            { id: 'peek', label: '拆开看一眼', desc: '知道一点山门动静' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'return') {
          U.printlog('你把信追还给信使。对方脸红到耳根，连连拱手');
          return;
        }
        var c = U.cultPct(g, 0.02, 0.04, 200);
        U.printlog('信里只是一处矿脉的坐标，早已过期。你把纸搓成团，坐标却记住了，实力+' + c);
      }
    }),
    ev({
      id: 'lf_scar_old', name: '旧伤复发', tier: 2, tag: 'scar', lo: 21, hi: 30, minAge: 18, weight: 2.0,
      choice: function (g, U) {
        return {
          lead: '四极开到一半，少年时那道未愈的骨伤又开始响',
          info: '停下来养，进境慢；硬顶可能把伤养进骨里',
          note: '停养最稳。',
          options: [
            { id: 'rest', label: '闭关养伤半月', desc: '不冒险', safe: true },
            { id: 'push', label: '顶着痛往下开', desc: '成则四极更稳', chance: 0.52 }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'rest') {
          var lf = U.gainLife(g, 10, 28);
          U.printlog('你把伤按住，像按住一口旧井' + (lf ? '，寿元+' + lf : ''));
          return;
        }
        if (Math.random() < 0.52) {
          var c = U.cultPct(g, 0.028, 0.048, 260);
          U.printlog('骨响停在第四声。你知道这极算是开实了，实力+' + c);
        } else {
          var h = U.hurt(g, 20, 50);
          U.printlog(h.exempt ? '你及时收功，伤没有再裂' : '旧伤裂开，你在榻上躺了两个月，寿元 -' + h.loss);
        }
      }
    }),
    ev({
      id: 'lf_ferry_night', name: '夜渡无人', tier: 2, tag: 'ferry', lo: 21, hi: 30, minAge: 18, weight: 2.2,
      choice: function (g, U) {
        return {
          lead: '渡口只剩一条空船，艄公的斗笠扣在桨上，人不见',
          info: '自己撑过去能赶夜路；等天亮最稳',
          note: '等船无事。',
          options: [
            { id: 'wait', label: '等到天亮', desc: '不碰别人的船', safe: true },
            { id: 'row', label: '自己撑过去', desc: '河心或许有事' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'wait') { U.printlog('天亮后艄公从芦苇里钻出来，说他去捉了一夜蟹'); return; }
        var c = U.cultPct(g, 0.02, 0.04, 210);
        U.printlog('河心有一段逆流，像有人在底下走路。你撑过对岸，实力+' + c);
      }
    }),

    /* ---------- 化龙 ---------- */
    ev({
      id: 'lf_scale_shed', name: '蜕鳞之夜', tier: 2, tag: 'scale', lo: 31, hi: 40, minAge: 25, weight: 2.3,
      choice: function (g, U) {
        return {
          lead: '化龙到中途，脊背像有一层薄鳞要蜕，痒得睡不着',
          info: '硬撕可能伤筋；忍过这一夜最稳',
          note: '忍最稳；撕开则进境加快。',
          options: [
            { id: 'endure', label: '咬牙忍过这一夜', desc: '不弄伤自己', safe: true },
            { id: 'shed', label: '按骨节把那层皮褪掉', desc: '成则龙形更近', chance: 0.56 }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'endure') { U.printlog('天亮时痒停了。鳞没有蜕，可你还活着，也没缺一块皮'); return; }
        if (Math.random() < 0.56) {
          var c = U.cultPct(g, 0.03, 0.05, 400);
          var lf = U.gainLife(g, 12, 36);
          U.printlog('那层皮像薄纸一样揭下来，底下的骨头亮了一下' + (lf ? '，寿元+' + lf : '') + '，实力+' + c);
        } else {
          var h = U.hurt(g, 25, 60);
          U.printlog(h.exempt ? '你中途停手，皮只揭了一半，自行长回去了' : '揭得太急，血浸透衣裳，寿元 -' + h.loss);
        }
      }
    }),
    ev({
      id: 'lf_rain_bone', name: '化龙雨', tier: 2, tag: 'rain', lo: 31, hi: 40, minAge: 25, weight: 2.2,
      choice: function (g, U) {
        return {
          lead: '一场只打在你洞府上空的雨，雨里有龙骨的腥',
          info: '出去淋，可能借力；关窗则当它是天气',
          note: '关窗最稳。',
          options: [
            { id: 'shut', label: '关窗坐着', desc: '不淋这场雨', safe: true },
            { id: 'stand', label: '出去站一夜', desc: '借雨洗骨' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'shut') { U.printlog('雨打在窗纸上，像有人用指节敲门。你没有开'); return; }
        var c = U.cultPct(g, 0.028, 0.048, 380);
        var d = U.irand(3, 6);
        U.gainDao(g, d);
        U.printlog('雨停时衣裳是干的。腥气留在齿缝里，实力+' + c + '，道蕴+' + d);
      }
    }),
    ev({
      id: 'lf_bone_tune', name: '脊骨鸣响', tier: 2, tag: 'bone', lo: 31, hi: 40, minAge: 25, weight: 2.1,
      choice: function (g, U) {
        return {
          lead: '每一次吐纳，脊骨都像一根弦被拨动',
          info: '顺着它走，化龙会快一截；压下去则稳',
          note: '压住最稳。',
          options: [
            { id: 'press', label: '用气息压住', desc: '不跟它走', safe: true },
            { id: 'follow', label: '顺着鸣响走完一圈', desc: '龙形更完整' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'press') { U.printlog('鸣响停在第七节。你把它当作杂音'); return; }
        var c = U.cultPct(g, 0.03, 0.05, 420);
        U.printlog('走完一圈，你听见自己的骨头在对位。像一条还没出渊的龙，实力+' + c);
      }
    }),
    ev({
      id: 'lf_dream_flood', name: '梦里涨潮', tier: 2, tag: 'dream', lo: 31, hi: 40, minAge: 25, weight: 2.0,
      choice: function (g, U) {
        return {
          lead: '连续七日，梦里都是同一片要漫过头顶的潮',
          info: '沉下去看潮底；醒来把梦掐断',
          note: '掐断最稳。',
          options: [
            { id: 'wake', label: '每夜强迫自己醒来', desc: '不当回事', safe: true },
            { id: 'sink', label: '沉到潮底看一眼', desc: '或见龙巢残影' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'wake') { U.printlog('第八夜梦停了。你眼下发青，除此之外无事'); return; }
        var d = U.irand(4, 6);
        U.gainDao(g, d);
        U.printlog('潮底没有龙，只有一具盘着的骨架。你记住它的盘法，道蕴+' + d);
      }
    }),
    ev({
      id: 'lf_river_reverse', name: '河水倒流', tier: 3, tag: 'river', lo: 31, hi: 40, minAge: 25, weight: 1.2,
      choice: function (g, U) {
        return {
          lead: PICK(REGIONS) + '一条支流忽然倒着走，鱼群顶着水花上山',
          info: '沿河走到源头，可能撞上化龙旧迹；不下河最稳',
          note: '旁观无事。',
          options: [
            { id: 'bank', label: '在岸上看它流完', desc: '不当自己的事', safe: true },
            { id: 'source', label: '逆着水流找源头', desc: '或得一截龙息', chance: 0.5 }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'bank') { U.printlog('半日后河水正过来。鱼散了，像什么都没发生'); return; }
        if (Math.random() < 0.5) {
          var c = U.cultPct(g, 0.06, 0.11, 800);
          var d = U.irand(10, 22);
          U.gainDao(g, d);
          U.printlog('源头是一口干潭，潭壁刻着半条龙。你把那口气吸进肺里，实力+' + c + '，道蕴+' + d);
        } else {
          var h = U.hurt(g, 40, 90);
          U.printlog(h.exempt ? '潭是空的，你上来时只是腿软' : '倒流把你拍在石头上，养了一个季节，寿元 -' + h.loss);
        }
      }
    }),

    /* ---------- 仙台 ---------- */
    ev({
      id: 'lf_altar_ash', name: '旧坛冷灰', tier: 2, tag: 'altar', lo: 41, hi: 50, minAge: 40, weight: 2.2,
      choice: function (g, U) {
        return {
          lead: '仙台第一层天的路边，一座没人上香的石坛，灰是冷的',
          info: '添一炷香可能接通旧祭；不碰则干净',
          note: '路过最稳。',
          options: [
            { id: 'by', label: '绕开石坛', desc: '不接因果', safe: true },
            { id: 'burn', label: '燃一炷自己的香', desc: '坛若还在，或回你一点' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'by') { U.printlog('你连衣角都没擦到坛沿'); return; }
        var c = U.cultPct(g, 0.03, 0.05, 500);
        U.printlog('灰热了一下。没有神来，只有你自己的气息被坛吞进去又吐回来，实力+' + c);
      }
    }),
    ev({
      id: 'lf_scripture_rain', name: '经雨一夜', tier: 3, tag: 'scripture', lo: 41, hi: 50, minAge: 40, weight: 1.3,
      choice: function (g, U) {
        return {
          lead: '夜里下雨，雨点落在石上竟是《' + PICK(T3_GONG) + '》的残句',
          info: '抄到天明；或当它是错觉',
          note: '睡觉最稳。',
          options: [
            { id: 'sleep', label: '蒙头睡觉', desc: '不当神迹', safe: true },
            { id: 'copy', label: '借雨抄完', desc: '得残法一角' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'sleep') { U.printlog('天亮石面干了。你怀疑自己昨夜看花了眼'); return; }
        var d = U.irand(10, 24);
        var c = U.cultPct(g, 0.05, 0.10, 900);
        U.gainDao(g, d);
        U.printlog('抄到最后一句时雨停了。纸是湿的，字是齐的，实力+' + c + '，道蕴+' + d);
      }
    }),
    ev({
      id: 'lf_guest_uninvited', name: '不速之客', tier: 2, tag: 'guest', lo: 41, hi: 50, minAge: 40, weight: 2.1,
      choice: function (g, U) {
        return {
          lead: '洞府外站着一位' + PICK(RIVAL_TITLES) + '，不报姓名，只说借宿一夜',
          info: '留客可能交上朋友，也可能被看穿底细；拒之门外最干净',
          note: '拒绝无事。',
          options: [
            { id: 'refuse', label: '隔门回绝', desc: '不开门', safe: true },
            { id: 'stay', label: '留他一晚', desc: '交换一路见闻' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'refuse') { U.printlog('门外静了。天亮时门槛上多了一片叶子，没有字'); return; }
        var c = U.cultPct(g, 0.025, 0.045, 480);
        U.printlog('他讲' + PICK(SECTS) + '今年缺了一位执事。天未亮人走了，实力+' + c);
      }
    }),
    ev({
      id: 'lf_frost_step', name: '霜上台阶', tier: 2, tag: 'frost', lo: 41, hi: 50, minAge: 40, weight: 2.0,
      choice: function (g, U) {
        return {
          lead: '仙台石阶今夜结霜，别人绕开，你也可以踩上去',
          info: '踩霜走完这一层，寒气入骨；绕开最稳',
          note: '绕开无事。',
          options: [
            { id: 'around', label: '从侧面上去', desc: '不踩霜', safe: true },
            { id: 'tread', label: '一步一霜走完', desc: '寒气炼一层天' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'around') { U.printlog('你从苔藓那一侧上去。霜在你背后碎掉'); return; }
        var c = U.cultPct(g, 0.03, 0.05, 520);
        var lf = U.gainLife(g, 15, 40);
        U.printlog('霜化在脚心里。这一层天走得格外清楚' + (lf ? '，寿元+' + lf : '') + '，实力+' + c);
      }
    }),
    ev({
      id: 'lf_debt_old_favor', name: '旧人情', tier: 2, tag: 'debt', lo: 41, hi: 50, minAge: 40, weight: 2.1,
      choice: function (g, U) {
        return {
          lead: '多年前你随口应过的一个人来寻你，要你在' + PICK(SECTS) + '门前站一刻',
          info: '去了便欠他的清了，也可能惹事；不去则这人情一直挂着',
          note: '不去无死险。',
          options: [
            { id: 'no', label: '回绝这趟', desc: '人情继续挂着', safe: true },
            { id: 'go', label: '去站那一刻', desc: '清账，或有薄酬' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'no') { U.printlog('来人看了你很久，说「也是」，转身走了'); return; }
        var c = U.cultPct(g, 0.022, 0.04, 460);
        U.printlog('你在山门前站了一炷香。没有人出来问你是谁。来人留下一包' + PICK(T2_HERB) + '，实力+' + c);
      }
    }),

    /* ---------- 大能 ---------- */
    ev({
      id: 'lf_court_seat', name: '空着的席', tier: 3, tag: 'court', lo: 51, hi: 60, minAge: 80, weight: 1.3,
      choice: function (g, U) {
        return {
          lead: PICK(SECTS) + '议事缺一个旁听席，有人把你的名字写了上去',
          info: '去听能知大局；不去则不被卷进山门的账',
          note: '不去最稳。',
          options: [
            { id: 'skip', label: '让他们划掉名字', desc: '不入局', safe: true },
            { id: 'sit', label: '去坐那席', desc: '听完这一夜' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'skip') { U.printlog('名字被墨涂掉。你听见笔尖的声音，没有回头'); return; }
        var d = U.irand(12, 28);
        var c = U.cultPct(g, 0.06, 0.11, 1600);
        U.gainDao(g, d);
        U.printlog('他们争的是一座旧矿的归属。你一句话没说，把地图记在心里，实力+' + c + '，道蕴+' + d);
      }
    }),
    ev({
      id: 'lf_remnant_hand', name: '残修手骨', tier: 3, tag: 'remnant', lo: 51, hi: 60, minAge: 80, weight: 1.2,
      choice: function (g, U) {
        return {
          lead: '古洞里一具只剩手骨的残修，指节还扣在一块玉简上',
          info: '取简可能惹怨；拜过再走最干净',
          note: '拜过就走最稳。',
          options: [
            { id: 'bow', label: '拱手退出', desc: '不取遗物', safe: true },
            { id: 'take', label: '把玉简抽出来', desc: '读他未写完的那一笔', chance: 0.58 }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'bow') { U.printlog('你退出洞口，把碎石堆回原处'); return; }
        if (Math.random() < 0.58) {
          var d = U.irand(14, 30);
          U.gainDao(g, d);
          U.printlog('玉简最后一字没写完。你按自己的意思补上，道蕴+' + d);
        } else {
          var h = U.hurt(g, 50, 120);
          U.printlog(h.exempt ? '手骨一松，玉简碎了，你什么都没读到' : '怨气顺着指节爬上来，你在洞外吐了两口血，寿元 -' + h.loss);
        }
      }
    }),
    ev({
      id: 'lf_hunt_mark', name: '猎场印记', tier: 3, tag: 'hunt', lo: 51, hi: 60, minAge: 80, weight: 1.2,
      choice: function (g, U) {
        return {
          lead: '你背上不知何时多了一枚猎场印，像有人把你登记成了猎物',
          info: '自己撕掉；或顺着印去找猎人',
          note: '撕掉最稳。',
          options: [
            { id: 'tear', label: '运功撕掉印', desc: '不当猎物', safe: true },
            { id: 'find', label: '顺着印去见猎人', desc: '见了面再谈' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'tear') { U.printlog('印成灰。你后背凉了很久，没有人再跟上来'); return; }
        var c = U.cultPct(g, 0.055, 0.10, 1500);
        U.printlog('猎人是一名已经坐化的老者留下的禁制。你把禁制走完，实力+' + c);
      }
    }),
    ev({
      id: 'lf_vow_stone', name: '誓言石', tier: 3, tag: 'vow', lo: 51, hi: 60, minAge: 80, weight: 1.1,
      choice: function (g, U) {
        return {
          lead: '路边一块被人摸亮的石头，刻着「此生不入圣地为奴」',
          info: '按手印续上这句；或当它是别人的执念',
          note: '不按最稳。',
          options: [
            { id: 'pass', label: '看完就走', desc: '不续别人的誓', safe: true },
            { id: 'press', label: '把手按上去', desc: '誓与你有关时，道心会静一点' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'pass') { U.printlog('石头还是亮的。少你一只手，它也亮'); return; }
        var d = U.irand(10, 22);
        U.gainDao(g, d);
        U.printlog('石面热了一下。你没有发誓，只是同意了那句话，道蕴+' + d);
      }
    }),
    ev({
      id: 'lf_mist_name', name: '雾里点名', tier: 3, tag: 'mist', lo: 51, hi: 60, minAge: 80, weight: 1.2,
      choice: function (g, U) {
        return {
          lead: '山雾里有人点你的名字，声音像很久以前的同门',
          info: '应一声可能是故人；不应则雾自己散',
          note: '不应最稳。',
          options: [
            { id: 'mute', label: '不吭声', desc: '让雾过去', safe: true },
            { id: 'answer', label: '应一声', desc: '看是谁在叫' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'mute') { U.printlog('雾散时山路还在。没有人站在你对面'); return; }
        var c = U.cultPct(g, 0.05, 0.09, 1400);
        U.printlog('应完之后是空的。你把自己的名字又听了一遍，实力+' + c);
      }
    }),

    /* ---------- 王者 ---------- */
    ev({
      id: 'lf_banner_half', name: '半面旧旗', tier: 3, tag: 'banner', lo: 61, hi: 70, minAge: 120, weight: 1.3,
      choice: function (g, U) {
        return {
          lead: '王者境的战场边，一面断旗还插在土里，旗角写着已经没人用的年号',
          info: '拔旗收起来；或让它继续插着',
          note: '不碰最稳。',
          options: [
            { id: 'leave', label: '让旗继续插着', desc: '不收战场的东西', safe: true },
            { id: 'take', label: '拔出来叠好', desc: '旗上的杀意或可化用' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'leave') { U.printlog('风把旗角吹到你脸上又离开。你没有伸手'); return; }
        var c = U.cultPct(g, 0.06, 0.11, 2400);
        U.printlog('旗一离土，上面的字自己淡了。你把空布收进袖里，实力+' + c);
      }
    }),
    ev({
      id: 'lf_eclipse_sit', name: '日食枯坐', tier: 3, tag: 'eclipse', lo: 61, hi: 70, minAge: 120, weight: 1.2,
      choice: function (g, U) {
        return {
          lead: '日食那天，王者境的天像被谁用手盖住',
          info: '对着黑日枯坐；或闭关不理天象',
          note: '闭关最稳。',
          options: [
            { id: 'in', label: '关上门', desc: '不当天象', safe: true },
            { id: 'sit', label: '对着黑日坐到复明', desc: '或见一线王者真意' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'in') { U.printlog('复明时你在榻上。窗外有人欢呼，与你无关'); return; }
        var d = U.irand(16, 32);
        var c = U.cultPct(g, 0.07, 0.12, 2600);
        U.gainDao(g, d);
        U.printlog('黑日边缘那一圈金，比经文好懂，实力+' + c + '，道蕴+' + d);
      }
    }),
    ev({
      id: 'lf_exile_road', name: '被逐者的路', tier: 3, tag: 'exile', lo: 61, hi: 70, minAge: 120, weight: 1.1,
      choice: function (g, U) {
        return {
          lead: '一名被' + PICK(SECTS) + '除名的王者在你面前跪下，求你指一条活路',
          info: '指了可能被山门记恨；不指则眼看着他去送死',
          note: '不指最稳。',
          options: [
            { id: 'none', label: '让他自己走', desc: '不沾这摊', safe: true },
            { id: 'point', label: '指他一条僻静的路', desc: '他日或有回报' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'none') { U.printlog('他磕了一个头，自己去了。你没有问他叫什么'); return; }
        var d = U.irand(8, 18);
        U.gainDao(g, d);
        U.printlog('你把一条废弃驿道告诉他。他自己说「够了」，道蕴+' + d);
      }
    }),
    ev({
      id: 'lf_forge_cold', name: '冷炉一夜', tier: 3, tag: 'forge', lo: 61, hi: 70, minAge: 120, weight: 1.2,
      choice: function (g, U) {
        return {
          lead: '废弃兵冢里一座冷了百年的炉，炉口还是温的',
          info: '添自己的血点火；或走开',
          note: '走开最稳。',
          options: [
            { id: 'away', label: '不碰兵冢', desc: '炉继续冷着', safe: true },
            { id: 'fire', label: '滴血点火', desc: '看炉里还剩什么', chance: 0.54 }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'away') { U.printlog('炉口的温热在你走远后也散了'); return; }
        if (Math.random() < 0.54) {
          var c = U.cultPct(g, 0.065, 0.12, 2500);
          U.printlog('炉里没有兵，只有一勺还没凝的精铁。你把它喝了，实力+' + c);
        } else {
          var h = U.hurt(g, 60, 140);
          U.printlog(h.exempt ? '火苗舔了一下就灭，你退得快' : '冷火反噬，你的掌心裂开，寿元 -' + h.loss);
        }
      }
    }),
    ev({
      id: 'lf_tide_king', name: '王者潮', tier: 3, tag: 'tide', lo: 61, hi: 70, minAge: 120, weight: 1.2,
      choice: function (g, U) {
        return {
          lead: '气运如潮，一夜间有三名王者在远方陨落，潮声拍到你的洞府',
          info: '开门迎潮；或把门封死',
          note: '封门最稳。',
          options: [
            { id: 'seal', label: '封上门', desc: '不沾别人的死气', safe: true },
            { id: 'open', label: '开门迎潮', desc: '借潮压实自己的王者境' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'seal') { U.printlog('潮在门外散掉。你听见三声很远的金铁鸣'); return; }
        var c = U.cultPct(g, 0.07, 0.12, 2700);
        if (U.markStory) U.markStory(g, 'tide_debt');
        U.printlog('潮过之后洞府里的灰尘都是齐的。你的王者境被拍实了一分，实力+' + c);
      }
    }),

    /* ---------- 圣人 ---------- */
    ev({
      id: 'lf_sermon_empty', name: '无人讲坛', tier: 3, tag: 'sermon', lo: 71, hi: 80, minAge: 200, weight: 1.3,
      choice: function (g, U) {
        return {
          lead: '荒山上有一座讲坛，蒲团是新的，听众一个没有',
          info: '你可上去讲一炷香；也可当它是摆设',
          note: '不讲最稳。',
          options: [
            { id: 'down', label: '从坛下走过', desc: '不占这个位', safe: true },
            { id: 'speak', label: '上去讲完自己的法', desc: '讲给山听' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'down') { U.printlog('蒲团上的尘被风吹齐。你没有上台'); return; }
        var d = U.irand(18, 36);
        var c = U.cultPct(g, 0.08, 0.13, 4000);
        U.gainDao(g, d);
        U.printlog('你讲到一半发现自己在纠正自己。山下没有人鼓掌，实力+' + c + '，道蕴+' + d);
      }
    }),
    ev({
      id: 'lf_silence_year', name: '一年不语', tier: 3, tag: 'silence', lo: 71, hi: 80, minAge: 200, weight: 1.2,
      choice: function (g, U) {
        return {
          lead: '有个念头反复出现：这一年不要说话',
          info: '真闭口一年；或把念头当作杂念压下',
          note: '压下最稳。',
          options: [
            { id: 'speak', label: '当杂念，该说还说', desc: '日子照旧', safe: true },
            { id: 'mute', label: '闭口一年', desc: '用静把圣人境坐实' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'speak') { U.printlog('念头退了。你在山下买酒时还是说了「好」'); return; }
        var d = U.irand(16, 34);
        U.gainDao(g, d);
        U.printlog('一年后第一句话你忘了该怎么起音。道却比话清楚，道蕴+' + d);
      }
    }),
    ev({
      id: 'lf_ash_world', name: '一界成灰', tier: 3, tag: 'ash', lo: 71, hi: 80, minAge: 200, weight: 1.1,
      choice: function (g, U) {
        return {
          lead: '你路过一片刚被圣人交手夷平的丘陵，灰还是热的',
          info: '在灰里走一圈；或绕开这片死地',
          note: '绕开最稳。',
          options: [
            { id: 'around', label: '远远绕开', desc: '不踩别人的战场', safe: true },
            { id: 'walk', label: '从灰里走过去', desc: '看圣人出手留下的纹' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'around') { U.printlog('你多走了半日。灰在你右侧亮着，像另一条路'); return; }
        var c = U.cultPct(g, 0.075, 0.12, 3800);
        U.printlog('灰里的纹不是功法，是两个人当时各不相让。你把那股不相让记下了，实力+' + c);
      }
    }),
    ev({
      id: 'lf_peer_tea', name: '同代一盏', tier: 3, tag: 'peer', lo: 71, hi: 80, minAge: 200, weight: 1.2,
      choice: function (g, U) {
        return {
          lead: '同代里另一位圣人请你喝茶，茶是普通的，话不是',
          info: '去则两人对一遍道；不去则少一桩因果',
          note: '不去最稳。',
          options: [
            { id: 'decline', label: '回绝这盏茶', desc: '各修各的', safe: true },
            { id: 'drink', label: '去喝完', desc: '对完各自回去' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'decline') { U.printlog('回信只有两个字。对方没有再请'); return; }
        var d = U.irand(14, 30);
        U.gainDao(g, d);
        U.printlog('茶凉了才开始说话。你们谁也没有赢谁，道蕴+' + d);
      }
    }),
    ev({
      id: 'lf_veil_thin', name: '薄了一层', tier: 3, tag: 'veil', lo: 71, hi: 80, minAge: 200, weight: 1.2,
      choice: function (g, U) {
        return {
          lead: '圣人境到后来，你觉得天和你之间那层东西薄了，像窗户纸',
          info: '伸手去戳；或把它当错觉',
          note: '不当真最稳。',
          options: [
            { id: 'ignore', label: '当作错觉', desc: '不戳那层', safe: true },
            { id: 'touch', label: '用神念碰一下', desc: '看薄的那面是什么' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'ignore') { U.printlog('那层东西又厚回去了。你决定今年不再想它'); return; }
        var d = U.irand(18, 36);
        U.gainDao(g, d);
        U.printlog('碰上去是凉的。没有仙，也没有神，只有你自己的界限，道蕴+' + d);
      }
    }),

    /* ---------- 大圣 ---------- */
    ev({
      id: 'lf_horizon_crack', name: '天边一道缝', tier: 3, tag: 'horizon', lo: 81, hi: 90, minAge: 300, weight: 1.3,
      choice: function (g, U) {
        return {
          lead: '大圣境上，天边常年有一道细缝，别人当是云，你看得清',
          info: '走过去看缝；或当它不存在',
          note: '不看最稳。',
          options: [
            { id: 'not', label: '当云', desc: '不追天边', safe: true },
            { id: 'see', label: '走到能看清的距离', desc: '记下缝的走向' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'not') { U.printlog('缝还在。你把目光收回自己的掌心'); return; }
        var c = U.cultPct(g, 0.08, 0.13, 6000);
        var d = U.irand(20, 38);
        U.gainDao(g, d);
        U.printlog('缝里没有另一界，只有更深的这个界。你把走向记在骨上，实力+' + c + '，道蕴+' + d);
      }
    }),
    ev({
      id: 'lf_coffin_empty', name: '空棺', tier: 3, tag: 'coffin', lo: 81, hi: 90, minAge: 300, weight: 1.1,
      choice: function (g, U) {
        return {
          lead: '古陵里一口没有名字的棺，盖是开的，里面是空的',
          info: '躺进去试一下；或盖上离开',
          note: '盖上最稳。',
          options: [
            { id: 'lid', label: '把棺盖盖上', desc: '不躺别人的棺', safe: true },
            { id: 'lie', label: '躺进去一息', desc: '体会大圣的死法' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'lid') { U.printlog('盖合上时没有声音。你退出陵道'); return; }
        var d = U.irand(16, 32);
        U.gainDao(g, d);
        U.printlog('一息之后你自己坐起来。空棺要的不是人，是那一息，道蕴+' + d);
      }
    }),
    ev({
      id: 'lf_law_loose', name: '松动的法则', tier: 3, tag: 'law', lo: 81, hi: 90, minAge: 300, weight: 1.2,
      choice: function (g, U) {
        return {
          lead: '你脚下这块地的「重」忽然松了一寸，像法则在打盹',
          info: '趁松改自己的法；或等它自己绷紧',
          note: '等待最稳。',
          options: [
            { id: 'wait', label: '等它绷回去', desc: '不趁人之危', safe: true },
            { id: 'rewrite', label: '把自己的法写进去', desc: '大圣境更像你' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'wait') { U.printlog('一寸之后，重又回来了。你没有动'); return; }
        var c = U.cultPct(g, 0.08, 0.13, 6200);
        U.printlog('你只写了一笔。法则醒过来时，那一笔已经在里面了，实力+' + c);
      }
    }),
    ev({
      id: 'lf_lonely_peak', name: '无人峰', tier: 3, tag: 'lonely', lo: 81, hi: 90, minAge: 300, weight: 1.2,
      choice: function (g, U) {
        return {
          lead: '一座没有名字的峰，峰顶只有你的脚印',
          info: '在峰顶坐十年；或下山继续走',
          note: '下山最稳。',
          options: [
            { id: 'down', label: '看一眼就下山', desc: '峰还是没名字', safe: true },
            { id: 'sit', label: '坐到脚印被风抹平', desc: '大圣境沉一层' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'down') { U.printlog('下山时脚印还在。你没有回头'); return; }
        var d = U.irand(18, 36);
        var lf = U.gainLife(g, 40, 160);
        U.gainDao(g, d);
        U.printlog('风把脚印抹平的那天，你觉得自己可以走了' + (lf ? '，寿元+' + lf : '') + '，道蕴+' + d);
      }
    }),
    ev({
      id: 'lf_dusk_long', name: '黄昏特别长', tier: 3, tag: 'dusk', lo: 81, hi: 90, minAge: 300, weight: 1.1,
      choice: function (g, U) {
        return {
          lead: '这一年的黄昏比往年长，像有人把日头按住了',
          info: '借长黄昏推演；或照常歇息',
          note: '歇息最稳。',
          options: [
            { id: 'rest', label: '照常歇息', desc: '不当天时', safe: true },
            { id: 'use', label: '把这一黄昏用完', desc: '多推一截自己的法' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'rest') { U.printlog('黄昏终于结束。你睡得很好'); return; }
        var d = U.irand(20, 38);
        U.gainDao(g, d);
        U.printlog('日头松开时，你的推演刚好写到可以停的地方，道蕴+' + d);
      }
    }),

    /* ---------- 准帝 ---------- */
    ev({
      id: 'lf_threshold_dust', name: '门槛上的灰', tier: 3, tag: 'threshold', lo: 91, hi: 99, minAge: 400, weight: 1.3,
      choice: function (g, U) {
        return {
          lead: '准帝每一重天的门槛上都积着前人的灰，有人扫，有人踩过去',
          info: '扫干净再进；或直接踩',
          note: '扫干净最稳。',
          options: [
            { id: 'sweep', label: '把灰扫到门边', desc: '不踩前人', safe: true },
            { id: 'step', label: '踩着灰进去', desc: '灰里或有未散的帝意' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'sweep') { U.printlog('灰在门边堆成一条线。你迈进去时鞋底是干净的'); return; }
        var c = U.cultPct(g, 0.08, 0.13, 8000);
        var d = U.irand(20, 40);
        U.gainDao(g, d);
        U.printlog('灰里有一缕不愿散的执念。你踩过去，把它踩成自己的，实力+' + c + '，道蕴+' + d);
      }
    }),
    ev({
      id: 'lf_echo_old_di', name: '旧帝回声', tier: 3, tag: 'echo', lo: 91, hi: 99, minAge: 400, weight: 1.2,
      choice: function (g, U) {
        return {
          lead: '虚空里偶尔响起一句已经没人用的帝号，像回声找壳',
          info: '听完；或堵住耳识',
          note: '堵住最稳。',
          options: [
            { id: 'block', label: '堵住耳识', desc: '不接旧帝的声', safe: true },
            { id: 'hear', label: '把这一句听完', desc: '听他当时如何迈步' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'block') { U.printlog('回声在你识海外转了一圈，走了'); return; }
        var d = U.irand(22, 40);
        U.gainDao(g, d);
        U.printlog('那一句不是名，是他迈进第九重时的呼吸。你学会了那半口气，道蕴+' + d);
      }
    }),
    ev({
      id: 'lf_kneel_not', name: '有人要你跪', tier: 3, tag: 'kneel', lo: 91, hi: 99, minAge: 400, weight: 1.2,
      choice: function (g, U) {
        return {
          lead: '当世若有帝痕，它不会说话，只会让你的膝盖发沉',
          info: '跪下去避一避；或把膝盖挺直',
          note: '跪一下能避过这波镇压，不损道。挺直则自己扛。',
          options: [
            { id: 'bend', label: '单膝点地，等它过去', desc: '避过这波帝压', safe: true },
            { id: 'stand', label: '把膝盖挺直', desc: '准帝脊梁更硬' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'bend') { U.printlog('帝痕过去后，你把膝盖上的灰拍掉。没有人看见'); return; }
        var c = U.cultPct(g, 0.07, 0.12, 7500);
        U.printlog('沉意退了。你的膝盖没有响，实力+' + c);
      }
    }),
    ev({
      id: 'lf_still_nine', name: '第九重的静', tier: 3, tag: 'still', lo: 91, hi: 99, minAge: 400, weight: 1.1,
      choice: function (g, U) {
        return {
          lead: '越往后越静，静到你怀疑自己是不是已经停了',
          info: '在静里再坐一纪；或主动去找一声响',
          note: '坐着最稳。',
          options: [
            { id: 'sit', label: '继续坐', desc: '让静来', safe: true },
            { id: 'noise', label: '自己拍一声掌', desc: '用响确认还在走' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'sit') { U.printlog('静没有把你停住。它只是不再提醒你'); return; }
        var c = U.cultPct(g, 0.06, 0.11, 7200);
        U.printlog('掌音很短。短完之后你知道下一步该怎么迈，实力+' + c);
      }
    }),
    ev({
      id: 'lf_laststep_look', name: '最后一步之前', tier: 3, tag: 'laststep', lo: 91, hi: 99, minAge: 400, weight: 1.3,
      choice: function (g, U) {
        return {
          lead: '帝关还没到，可你已经能看见门缝里漏出来的光',
          info: '现在就多看一眼；或把眼睛闭上，等到真站在门前',
          note: '闭眼最稳，省着那一眼。',
          options: [
            { id: 'close', label: '先不看', desc: '把光留给叩关那天', safe: true },
            { id: 'look', label: '多看一眼', desc: '心里有数，叩关不慌' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'close') { U.printlog('你把光挡在眼皮外头。门还在那里'); return; }
        var d = U.irand(20, 40);
        U.gainDao(g, d);
        U.printlog('看了一眼就够了。门缝里的不是路，是一扇还没有打开的门，道蕴+' + d);
      }
    }),

    /* ---------- 凡体专属 ---------- */
    ev({
      id: 'lf_mortal_mock', name: '凡骨之席', tier: 2, tag: 'mortal_dao', lo: 8, hi: 45, minAge: 14, weight: 2.6,
      needFamily: 'mortal',
      choice: function (g, U) {
        return {
          lead: PICK(SECTS) + '外门设宴，把凡体单独排在角落，酒是凉的',
          info: '喝完这杯走人；或把席掀了——掀了也不致命，只是难看',
          note: '喝完走人最稳。',
          options: [
            { id: 'drink', label: '喝完就走', desc: '不给眼色', safe: true },
            { id: 'stay', label: '把凉酒喝完，再听他们把经念完', desc: '听完反而更清楚自己缺什么' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'drink') { U.printlog('酒凉，席也散了。你在门口把杯子扣在石阶上'); return; }
        var d = U.irand(3, 6);
        U.gainDao(g, d);
        U.printlog('他们笑的那些关窍，你听懂了七成。剩下三成是体质给的，你没有，道蕴+' + d);
      }
    }),
    ev({
      id: 'lf_mortal_copy', name: '抄别人的经', tier: 2, tag: 'mortal_dao', lo: 11, hi: 50, minAge: 16, weight: 2.5,
      innateMax: 2,
      choice: function (g, U) {
        return {
          lead: '同门把《' + PICK(T2_GONG) + '》借你三日，说凡体看了也白看',
          info: '抄完还他；或只看目录',
          note: '只看目录最稳。',
          options: [
            { id: 'catalog', label: '看一眼目录就还', desc: '不费那三日', safe: true },
            { id: 'copy', label: '三日抄完', desc: '凡体的抄经，反而记得牢' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'catalog') { U.printlog('目录你记住了。经还是别人的'); return; }
        var d = U.irand(4, 6);
        var c = U.cultPct(g, 0.02, 0.04, 180);
        U.gainDao(g, d);
        U.printlog('抄到第三日你发现有两处自相矛盾。你把矛盾标出来还他，实力+' + c + '，道蕴+' + d);
      }
    }),

    /* ---------- 悟性分轨 ---------- */
    ev({
      id: 'lf_dao_high_glance', name: '一眼完卷', tier: 2, tag: 'insight', lo: 11, hi: 40, minAge: 14, weight: 2.6,
      daoMin: 8,
      choice: function (g, U) {
        return {
          lead: '藏经阁底层一卷无人问津的残篇，你翻开第一页就看见了结尾',
          info: '把中间自己补上；或合上当没看见',
          note: '合上最稳，免得把别人的错抄进自己。',
          options: [
            { id: 'shut', label: '合上放回', desc: '不改别人的残篇', safe: true },
            { id: 'fill', label: '按自己的理解补完', desc: '高悟性吃的就是这一口' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'shut') { U.printlog('残篇回到架上。结尾还在你眼睛里，你没有写下来'); return; }
        var d = U.irand(4, 6);
        var c = U.cultPct(g, 0.025, 0.048, 240);
        U.gainDao(g, d);
        U.printlog('你补的那二十行，比残篇原来的还顺。管理员后头来问是谁动过笔，实力+' + c + '，道蕴+' + d);
        if (U.markStory) U.markStory(g, 'remnant_owner');
      }
    }),
    ev({
      id: 'lf_dao_low_grind', name: '同一句一百遍', tier: 2, tag: 'insight', lo: 11, hi: 40, minAge: 14, weight: 2.6,
      daoMax: 5,
      choice: function (g, U) {
        return {
          lead: '别人一日能过的关，你卡在同一句上已经一个月',
          info: '继续磨这一句；或换口诀绕开',
          note: '换口诀最稳，不跟自己较劲。',
          options: [
            { id: 'skip', label: '换一句绕开', desc: '先往前走', safe: true },
            { id: 'grind', label: '再磨一百遍', desc: '钝根有钝根的吃法' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'skip') { U.printlog('你换了口诀。关是过去了，那一句仍留在心里'); return; }
        var c = U.cultPct(g, 0.03, 0.05, 220);
        var lf = U.gainLife(g, 8, 24);
        U.printlog('第一百遍的时候句子自己通了。不是顿悟，是磨穿了' + (lf ? '，寿元+' + lf : '') + '，实力+' + c);
        if (U.markStory) U.markStory(g, 'insight_ripple');
      }
    }),
    ev({
      id: 'lf_dao_high_name', name: '法未成先有名', tier: 3, tag: 'create', lo: 51, hi: 80, minAge: 80, weight: 1.4,
      daoMin: 9,
      choice: function (g, U) {
        return {
          lead: '你还没立法，山下已经有人在传你那套还没写完的法的名字',
          info: '承认这名字，把它坐实；或否认，免得未成先满',
          note: '否认最稳。',
          options: [
            { id: 'deny', label: '否认，说没有这法', desc: '不让虚名跑在前面', safe: true },
            { id: 'take', label: '把这名字认下来', desc: '高悟性者，名也能反过来逼法' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'deny') { U.printlog('你说没有。传名的人少了，你自己反而轻松'); return; }
        var d = U.irand(16, 34);
        U.gainDao(g, d);
        U.printlog('名字一认，缺的那几笔自己找上门来。你仍未立法，可法已经在了，道蕴+' + d);
      }
    }),

    /* ---------- 体质专属 ---------- */
    ev({
      id: 'lf_phys_star_night', name: '星辰偏你', tier: 2, tag: 'refine', lo: 8, hi: 50, minAge: 12, weight: 2.5,
      needPhys: 'star',
      choice: function (g, U) {
        return {
          lead: '别人看星图要对着册子，你抬头就能对上',
          info: '今夜按星图走一遭；或当它是眼熟',
          note: '当眼熟最稳。',
          options: [
            { id: 'ignore', label: '不当回事', desc: '星还是那些星', safe: true },
            { id: 'walk', label: '按今晚的星走一遭', desc: '星辰体吃的就是这一口' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'ignore') { U.printlog('星偏了你也没动。它们明天还在'); return; }
        var c = U.cultPct(g, 0.03, 0.05, 280);
        U.printlog('走完一遭，靴底像沾了凉的铁。星图在你身上多了一笔，实力+' + c);
      }
    }),
    ev({
      id: 'lf_phys_solar_noon', name: '正午不歇', tier: 2, tag: 'refine', lo: 15, hi: 55, minAge: 16, weight: 2.5,
      needPhys: 'solar',
      choice: function (g, U) {
        return {
          lead: '正午毒日，别人找荫，你的血却热得要往外冒',
          info: '对着日头炼一炷香；或进洞压住',
          note: '进洞最稳。',
          options: [
            { id: 'shade', label: '进洞把血气压住', desc: '不在正午硬来', safe: true },
            { id: 'sun', label: '对着日头站完', desc: '太阳之体的正时' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'shade') { U.printlog('洞里凉快。血气退回经脉，像潮收了'); return; }
        var c = U.cultPct(g, 0.035, 0.05, 360);
        var lf = U.gainLife(g, 10, 30);
        U.printlog('日头偏西时你的影子短得几乎没有' + (lf ? '，寿元+' + lf : '') + '，实力+' + c);
      }
    }),
    ev({
      id: 'lf_phys_lunar_well', name: '井中太阴', tier: 2, tag: 'refine', lo: 15, hi: 55, minAge: 16, weight: 2.5,
      needPhys: 'lunar',
      choice: function (g, U) {
        return {
          lead: '月圆夜，井水比月还白，像有另一轮太阴沉在井底',
          info: '下去取一瓢；或只在井沿看',
          note: '只看最稳。',
          options: [
            { id: 'look', label: '在井沿看一夜', desc: '不取水', safe: true },
            { id: 'draw', label: '取一瓢饮下', desc: '太阴之体认水' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'look') { U.printlog('月偏了，井还是白的。你没有伸手'); return; }
        var c = U.cultPct(g, 0.035, 0.05, 340);
        var d = U.irand(3, 6);
        U.gainDao(g, d);
        U.printlog('水没有味道。饮完之后你的影子比人凉，实力+' + c + '，道蕴+' + d);
      }
    }),
    ev({
      id: 'lf_phys_sacred_gold', name: '苦海翻金', tier: 2, tag: 'sacred', lo: 11, hi: 70, minAge: 16, weight: 2.6,
      needPhys: 'sacred',
      choice: function (g, U) {
        return {
          lead: '苦海深处又翻起一层金，像有人在底下推',
          info: '压住，免得金气冲得太早；或由它翻上来',
          note: '压住最稳，圣体不怕慢。',
          options: [
            { id: 'press', label: '按住金气', desc: '不让它早熟', safe: true },
            { id: 'rise', label: '由它翻上来', desc: '血气再厚一分' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'press') { U.printlog('金气退回海下。你的呼吸又沉了回去'); return; }
        var c = U.cultPct(g, 0.035, 0.05, 500);
        U.printlog('金气贴着经脉走了一圈。别人看见的是异象，你看见的是自己的海，实力+' + c);
      }
    }),
    ev({
      id: 'lf_phys_chaos_mix', name: '万道打架', tier: 3, tag: 'refine', lo: 21, hi: 80, minAge: 30, weight: 1.5,
      needPhys: 'chaos',
      choice: function (g, U) {
        return {
          lead: '混沌体里几条不相干的法同时醒来，在识海挤成一团',
          info: '强行理顺；或由它们自己分出个主次',
          note: '由它们自己分，最不容易受伤。',
          options: [
            { id: 'wait', label: '坐着等它们自己停', desc: '不插手', safe: true },
            { id: 'sort', label: '按自己的意思理一遍', desc: '混沌体吃的就是兼收' }
          ]
        };
      },
      resolve: function (g, U, id) {
        if (id === 'wait') { U.printlog('它们自己停了。谁也不服谁，只是不再挤'); return; }
        var c = U.cultPct(g, 0.06, 0.11, 1800);
        var d = U.irand(12, 28);
        U.gainDao(g, d);
        U.printlog('你把打架的几条法按自己的次序排好。它们还在，只是听你的了，实力+' + c + '，道蕴+' + d);
      }
    })
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = EVENTS;
  root.EVENT_PACK_LIFE = EVENTS;
})(typeof self !== 'undefined' ? self : this);
