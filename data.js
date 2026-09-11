/* ============================================================
 * 遮天模拟器 · 数据文件（纯数据，逻辑在 sim.js）
 * 体质 · 境界 · 词条 · 成就 · 常量
 * 随机事件见 events.js
 * ============================================================ */
(function (root) {
  /* 后台仍保留 1-10 档资质，以兼容原有突破/成长算法；前台显示原著体质名。 */
  var TALENTS = ['', '凡体', '初阶异体', '灵体', '战体', '王体', '神体', '上古异体', '绝世体质', '无敌体质', '逆天体质'];
  function talentOf(lv) { return TALENTS[lv] || '凡体'; }
  function pm(o) {
    var d = { brk: 1, cgt: 1, evf: 1, evt: 1, ward: 0, xin: 1, dlm: 0, zhx: 0, life: 0, daog: 1 };
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) d[k] = o[k];
    return d;
  }
  /* 仅收录原著中有明确名称的体质；tier 只用于复用旧数值公式，不代表前台排名。 */
  /* zhx 直接加在证道成功率上。混沌体 / 先天圣体道胎成帝本就没有瓶颈，
   * 这是原著口径，不是数值事故——不要按金卡量级去削。 */
  var PHYSIQUES = [
    { id: 'mortal', name: '凡体', tier: 1, weight: 1, fx: pm({}), desc: '无特殊血脉，胜在道路不受体质束缚' },
    { id: 'star', name: '星辰体', tier: 2, weight: 1, fx: pm({ cgt: 1.03, evt: 1.1 }), desc: '亲近星辰之力，实力与机缘略有增益' },
    { id: 'guanghan', name: '广寒灵体', tier: 3, weight: 1, fx: pm({ xin: 1.08, evt: 1.1 }), desc: '灵性清澈，更易感悟大道' },
    { id: 'light', name: '光明体', tier: 3, weight: 1, fx: pm({ brk: 1.05, ward: 2 }), desc: '神光护体，修行顺遂' },
    { id: 'vajra', name: '金刚不坏体', tier: 4, weight: 1, fx: pm({ cgt: 1.06, ward: 3 }), desc: '肉身坚固，生存能力出众' },
    { id: 'brahma', name: '梵天战体', tier: 4, weight: 1, fx: pm({ cgt: 1.08, life: 20 }), desc: '血气旺盛，擅长征战' },
    { id: 'barbarian', name: '蛮族战神体', tier: 5, weight: 1, fx: pm({ cgt: 1.1, ward: 4 }), desc: '体魄强横，越战越勇' },
    { id: 'human_king', name: '人王体', tier: 5, weight: 1, fx: pm({ brk: 1.07, cgt: 1.07 }), desc: '根基均衡，修行与战力兼备' },
    { id: 'divine_king', name: '东荒神体', tier: 6, weight: 1, fx: pm({ brk: 1.08, cgt: 1.1, ward: 4 }), desc: '异象天成，同境战力强大' },
    { id: 'origin_spirit', name: '元灵体', tier: 6, weight: 1, fx: pm({ brk: 1.12, cgt: 1.05, evf: 1.08 }), desc: '沟通天地精气，法力近乎不竭' },
    { id: 'heavenly_demon', name: '天妖体', tier: 6, weight: 1, fx: pm({ brk: 1.08, cgt: 1.1, evt: 1.2 }), desc: '妖族至强体质，战力与机缘兼具' },
    { id: 'jiuyou', name: '九幽体', tier: 7, weight: 1, fx: pm({ xin: 1.2, evt: 1.3, ward: 5 }), desc: '本源幽深，神念与悟道出众' },
    { id: 'solar', name: '太阳之体', tier: 7, weight: 1, fx: pm({ brk: 1.03, cgt: 1.18, life: 50 }), desc: '至阳血气炽盛，攻伐强横' },
    { id: 'lunar', name: '太阴之体', tier: 7, weight: 1, fx: pm({ xin: 1.25, evt: 1.4 }), desc: '亲近太阴大道，悟道机缘非凡' },
    { id: 'feathered', name: '羽化仙体', tier: 8, weight: 1, fx: pm({ brk: 1.15, cgt: 1.15 }), desc: '秘境神藏不断开启，潜力深厚' },
    { id: 'dao_fetus', name: '先天道胎', tier: 8, weight: 1, fx: pm({ brk: 1.18, xin: 1.4, dlm: 5 }), desc: '天生近道，最擅悟道与感应天心' },
    { id: 'sacred', name: '荒古圣体', tier: 9, weight: 1, fx: pm({ cgt: 1.3, ward: 10, zhx: 0.02, life: 80 }), desc: '金色苦海、血气如海。准帝九重天即大成，无帝之世为宇宙第一极道至尊。成帝极难，一旦证道则道蕴暴涨、直达天帝' },
    { id: 'overlord', name: '苍天霸体', tier: 9, weight: 1, fx: pm({ brk: 1.05, cgt: 1.28, ward: 12 }), desc: '紫色苦海、神形无双，与圣体争锋' },
    { id: 'origin_sacred', name: '元灵圣体', tier: 9, weight: 1, fx: pm({ brk: 1.18, cgt: 1.3, evf: 1.2 }), desc: '圣体肉身与元灵法力合一；成帝一世寿元悠长' },
    { id: 'chaos', name: '混沌体', tier: 10, weight: 1, fx: pm({ brk: 1.3, cgt: 1.4, evt: 1.5, xin: 1.5, dlm: 10, zhx: 0.70 }), desc: '万道交融，不受寻常大道压制' },
    { id: 'innate_sacred_dao', name: '先天圣体道胎', tier: 10, weight: 1, fx: pm({ brk: 1.35, cgt: 1.35, xin: 1.6, dlm: 10, ward: 10, zhx: 0.65, daog: 1.28 }), desc: '圣体肉身与道胎悟性合一，悟道更快；成帝一世寿元悠长' }
  ];
  function physiqueById(id) {
    for (var i = 0; i < PHYSIQUES.length; i++) if (PHYSIQUES[i].id === id) return PHYSIQUES[i];
    return PHYSIQUES[0];
  }
  function physiquesAtTier(tier) {
    var out = [];
    for (var i = 0; i < PHYSIQUES.length; i++) if (PHYSIQUES[i].tier === tier) out.push(PHYSIQUES[i]);
    return out;
  }
  function physiqueDesc(p) { return p ? p.desc : ''; }

  /* 境界：下标 1-10 = 轮海…准帝，每境 10 层（共 100 层）；101 = 大帝（证道成帝） */
  var REALMS = ['', '轮海', '道宫', '四极', '化龙', '仙台', '大能', '王者', '圣人', '大圣', '准帝'];
  function realmIdx(lvl) {
    if (lvl >= 101) return 0;
    var r = Math.floor((lvl - 1) / 10) + 1;
    if (r < 1) r = 1; if (r > 10) r = 10;
    return r;
  }
  function realmOf(lvl) {
    if (lvl >= 101) return '大帝';
    return REALMS[realmIdx(lvl)];
  }
  /* 小阶段：1-3 初期 / 4-6 中期 / 7-9 后期 / 10 巅峰 */
  function layerOf(lvl) {
    if (lvl >= 101) return '';
    return ((lvl - 1) % 10) + 1;
  }
  function phaseOf(lvl) {
    if (lvl >= 101) return '';
    var l = ((lvl - 1) % 10) + 1;
    if (l <= 3) return '初期';
    if (l <= 6) return '中期';
    if (l <= 9) return '后期';
    return '巅峰';
  }
  function titleOf(lvl) {
    if (lvl >= 101) return '大帝';
    var l = ((lvl - 1) % 10) + 1;
    if (lvl <= 10) return '轮海·' + (l <= 2 ? '苦海' : l <= 4 ? '命泉' : l <= 7 ? '神桥' : '彼岸');
    if (lvl <= 20) return '道宫·' + ['心之神藏', '肝之神藏', '脾之神藏', '肺之神藏', '肾之神藏'][Math.min(4, Math.floor((l - 1) / 2))];
    if (lvl <= 30) return '四极·第' + Math.min(4, Math.ceil(l * 4 / 10)) + '极';
    if (lvl <= 40) return '化龙·第' + Math.min(9, l) + '变';
    if (lvl <= 50) return '仙台一层天·' + phaseOf(lvl);
    if (lvl <= 60) return '仙台二层天·大能' + phaseOf(lvl);
    if (lvl <= 70) return '仙台三层天·王者' + phaseOf(lvl);
    if (lvl <= 80) return '仙台四层天·圣人' + phaseOf(lvl);
    if (lvl <= 90) return '仙台五层天·大圣' + phaseOf(lvl);
    if (lvl < 100) return '准帝' + ['一', '二', '三', '四', '五', '六', '七', '八', '九'][lvl - 91] + '重天';
    return '准帝九重天巅峰';
  }

  /* 体质抽取权重（沿用凡人，高阶 6-10 合计 15%，6=5% 7=4% 8=3% 9=2% 10=1%） */
  var INNATE_WEIGHTS = [
    0, 33.0, 25.0, 11.0, 9.0, 7.0, 5.0, 4.0, 3.0, 2.0, 1.0
  ];
  /* 悟性独立于体质：多数寻常，绝世天才与万古道心合计约 2.5%。 */
  var DAO_GIFT_NAMES = ['', '愚钝', '寻常', '小慧', '通明', '颖悟', '天资', '天纵', '道种', '绝世天才', '万古道心'];
  var DAO_GIFT_WEIGHTS = [
    0, 26.0, 22.0, 15.0, 11.0, 9.0, 7.0, 4.5, 3.0, 1.8, 0.7
  ];

  /* 天时并非人人平等：黄金大世机缘更多，也意味着更强的竞争与危险。 */
  var ERAS = [
    { id: 'normal', name: '平常时代', weight: 80, daog: 0.75, evt: 0.8, evf: 0.9 },
    { id: 'prosperous', name: '修行盛世', weight: 15, daog: 1.10, evt: 1.2, evf: 1.1 },
    { id: 'golden', name: '黄金大世', weight: 5, daog: 1.45, evt: 1.7, evf: 1.25 }
  ];

  /* 境界战力系数：仅由体质根基决定，不受命格的旧版成长词条影响。 */
  var CULT_COEF = [0, 1.0, 1.5, 2.2, 3.2, 4.5, 6.3, 8.8, 12, 16, 22];

  /* 突破年数表（单位：年）。高阶体质不是单纯多活几年，而是把成长高峰压到青年期：
   * 8档可在一世内争帝，9档通常数百至千余岁入准帝，10档目标为约二百岁准帝、五百岁内外帝关。 */
  var BREAK_CHANCE = [
    [4, 20, 50, 120, 300, 800, 2000, 4000, 12000, 36000, 54000, 72000],
    [2, 10, 25, 60, 150, 400, 1000, 2000, 6000, 18000, 28000, 40000],
    [1.3, 6.7, 17, 40, 100, 267, 667, 1333, 4000, 12000, 18000, 26000],
    [0.95, 4.8, 12, 29, 71, 190, 476, 952, 2800, 8500, 13000, 19000],
    [0.8, 4, 10, 24, 60, 160, 400, 800, 2400, 7200, 11000, 16000],
    [0.7, 3, 8, 20, 45, 100, 200, 350, 800, 2800, 4500, 7000],
    [0.5, 2, 5, 12, 25, 50, 100, 180, 420, 1600, 2600, 4000],
    [0.3, 1, 2, 4, 8, 16, 32, 60, 150, 500, 900, 1500],
    [0.15, 0.5, 1, 2, 4, 8, 15, 25, 60, 200, 400, 750],
    [0.1, 0.2, 0.4, 0.8, 1.5, 3, 5, 10, 20, 90, 180, 360]
  ];
  /* 准帝从第一重起就明显慢于大圣；混沌体可缩短停留，但仍需逐重破关。 */
  var QUASI_LAYER_MULT = [2.2, 2.8, 3.6, 4.6, 6, 8, 10.5, 14];
  var QUASI_CHAOS_MULT = [1.5, 1.7, 2.0, 2.4, 2.9, 3.6, 4.5, 5.8];
  var DAO_ABSOLUTE_MAX = 3000;
  /* ---------- 战力阶梯 ----------
   * 以「无缺大帝 = 约 100 万」为锚，其余按原著的相对强弱排：
   *   准帝九重天  约 30 万   —— 顶级体质配顶级悟性能摸到的上限
   *   大成荒古圣体 约 60~70 万 —— 远超准帝九重（约 2 倍），但只有大帝的六七成：
   *                            能叫板无缺大帝，正面打必死，这就是「叫板」二字的分寸
   *   以力证道新帝 约 85~95 万 —— 另类成道，接近无缺大帝而不及
   *   无缺大帝    85~105 万
   *   破灭万道门槛 110 万     —— 必须压过当世大帝才谈得上破灭万道
   *   圣体破灭门槛 135 万     —— 有帝 + 圣体诅咒是双重关，要比凡体破灭再高一截
   *   天帝 / 不死天皇 150 万
   * 旧刻度里准帝九重 19 万到天帝 300 万是 15.5 倍的断裂，
   * 且大成圣体 160~200 万反而高过新晋大帝的 105~135 万，梯度是倒的。
   * 现在准帝九重到天帝收紧到 5 倍。 */
  var WORLD_EMPEROR_CULT_MIN = 850000;
  var WORLD_EMPEROR_CULT_MAX = 1050000;
  var OVERWHELM_DAO_CULT = 1100000;
  /* 有帝之世的荒古圣体要同时压过帝压和圣体诅咒，门槛高于凡体破灭。 */
  var SACRED_OVERWHELM_CULT = 1350000;
  var HEAVENLY_EMPEROR_CULT = 1500000;
  /* 无帝之世的大成圣体是极道至尊，但仍在大帝之下。 */
  var SACRED_JIDAO_CULT = 700000;
  var SACRED_EMPEROR_DAO_CAP = 2800;

  /* 各境界寿元上限带（下标 = 境界 1-10：轮海…准帝）。
   * 玩家以 60-100 寿元诞生；突破大境界（轮海不算）时补至 rand(带下限,带上限)；
   * 期间加寿元事件不可越过本境上限；词条加成可越上限（额外寿元，不计入上限）。 */
  var REALM_LIFE = [
    null,                 /* 0 占位 */
    [100, 180],           /* 1 轮海 */
    [250, 400],           /* 2 道宫 */
    [450, 650],           /* 3 四极 */
    [700, 1000],          /* 4 化龙 */
    [1200, 1600],         /* 5 仙台 */
    [1800, 2400],         /* 6 大能 */
    [2600, 3400],         /* 7 王者 */
    [3500, 4500],         /* 8 圣人 */
    [5000, 6500],         /* 9 大圣 */
    [8000, 10000]         /* 10 准帝；寿元可到九千乃至一万 */
  ];

  var TRAIT_PATHS = {
    body: { name: '体质蜕变', icon: '🩸', resonance: '百炼成道', desc: '淬炼肉身，在后天打破先天桎梏' },
    dao: { name: '道蕴悟道', icon: '☯', resonance: '道海无涯', desc: '积累道蕴，将毕生感悟化作帝路根基' },
    fortune: { name: '气运机缘', icon: '✦', resonance: '否极泰来', desc: '借时代与机缘之势改写命途' },
    tianxin: { name: '天心证道', icon: '✧', resonance: '天心相照', desc: '感应天心，走我道即天道之路' },
    imperial: { name: '帝路生存', icon: '♛', resonance: '帝路不绝', desc: '延续性命，为帝关失败留下余地' }
  };

  /* ---------- 命格（100 个：白/蓝/紫/金各25，每个稀有度五流派各5张） ----------
   * 命格只改变体质蜕变、道蕴、机缘、天心与帝路规则。
   * 修炼速度和战力成长属于体质/事件系统，不再作为命格效果。 */
  var TRAITS = [
    /* 白：体质 / 道蕴 / 气运 / 天心 / 帝路 */
    { id: 'w01', name: '百炼凡骨', color: 'w', path: 'body', fx: [['floor', 2]] },
    { id: 'w02', name: '筋骨初成', color: 'w', path: 'body', fx: [['bodyChance', 0.08], ['dao', 3]] },
    { id: 'w03', name: '磨砺己身', color: 'w', path: 'body', fx: [['bodyDao', 8], ['life', 200]] },
    { id: 'w04', name: '精血充沛', color: 'w', path: 'body', fx: [['floor', 2], ['ward', 1]] },
    { id: 'w05', name: '凡胎藏灵', color: 'w', path: 'body', fx: [['bodyChance', 0.08], ['evf', 1.08]] },
    { id: 'w06', name: '悟性初醒', color: 'w', path: 'dao', fx: [['dao', 80]] },
    { id: 'w07', name: '日积月累', color: 'w', path: 'dao', fx: [['daog', 1.12]] },
    { id: 'w08', name: '灵台清明', color: 'w', path: 'dao', fx: [['daocap', 40]] },
    { id: 'w09', name: '温故知新', color: 'w', path: 'dao', fx: [['dao', 55], ['daog', 1.08]] },
    { id: 'w10', name: '水滴石穿', color: 'w', path: 'dao', fx: [['overflow', 0.15], ['daocap', 20]] },
    { id: 'w11', name: '小有福缘', color: 'w', path: 'fortune', fx: [['evf', 1.08]] },
    { id: 'w12', name: '时来运转', color: 'w', path: 'fortune', fx: [['evt', 1.2]] },
    { id: 'w13', name: '广交游历', color: 'w', path: 'fortune', fx: [['evf', 1.08], ['dao', 3]] },
    { id: 'w14', name: '命里藏福', color: 'w', path: 'fortune', fx: [['ward', 1], ['evt', 1.15]] },
    { id: 'w15', name: '顺时而生', color: 'w', path: 'fortune', fx: [['era', 1.25], ['life', 200]] },
    { id: 'w16', name: '天心微明', color: 'w', path: 'tianxin', fx: [['xin', 1.15]] },
    { id: 'w17', name: '静听道音', color: 'w', path: 'tianxin', fx: [['xinPity', 0.000004], ['dao', 45]] },
    { id: 'w18', name: '心如止水', color: 'w', path: 'tianxin', fx: [['dlm', 5], ['ward', 1]] },
    { id: 'w19', name: '仰观天象', color: 'w', path: 'tianxin', fx: [['xin', 1.12], ['era', 1.15]] },
    { id: 'w20', name: '守一存真', color: 'w', path: 'tianxin', fx: [['xinPity', 0.000005], ['life', 250]] },
    { id: 'w21', name: '天生长寿', color: 'w', path: 'imperial', fx: [['life', 500]] },
    { id: 'w22', name: '心细谨慎', color: 'w', path: 'imperial', fx: [['ward', 2]] },
    { id: 'w23', name: '稳重求生', color: 'w', path: 'imperial', fx: [['life', 350], ['ward', 1]] },
    { id: 'w24', name: '不屈之念', color: 'w', path: 'imperial', fx: [['zhx', 0.01]] },
    { id: 'w25', name: '留得青山', color: 'w', path: 'imperial', fx: [['retryKeep', 0.15], ['life', 600]] },

    /* 蓝 */
    { id: 'b01', name: '骨架不凡', color: 'b', path: 'body', fx: [['floor', 3], ['life', 800]] },
    { id: 'b02', name: '铜筋铁骨', color: 'b', path: 'body', fx: [['bodyChance', 0.15], ['ward', 3]] },
    { id: 'b03', name: '血脉返祖', color: 'b', path: 'body', fx: [['bodyDao', 8], ['dao', 6]] },
    { id: 'b04', name: '洗筋伐髓', color: 'b', path: 'body', fx: [['floor', 3], ['bodyChance', 0.12]] },
    { id: 'b05', name: '逆境淬体', color: 'b', path: 'body', fx: [['bodyChance', 0.18], ['evf', 1.1]] },
    { id: 'b06', name: '天资初醒', color: 'b', path: 'dao', fx: [['dao', 180], ['daog', 1.18]] },
    { id: 'b07', name: '底蕴渐丰', color: 'b', path: 'dao', fx: [['daocap', 100], ['daog', 1.18]] },
    { id: 'b08', name: '过目不忘', color: 'b', path: 'dao', fx: [['dao', 220], ['daocap', 100]] },
    { id: 'b09', name: '渐入佳境', color: 'b', path: 'dao', fx: [['daog', 1.22]] },
    { id: 'b10', name: '厚积薄发', color: 'b', path: 'dao', fx: [['overflow', 0.25], ['daocap', 80]] },
    { id: 'b11', name: '贵人相助', color: 'b', path: 'fortune', fx: [['evf', 1.12], ['evt', 1.3]] },
    { id: 'b12', name: '气运初开', color: 'b', path: 'fortune', fx: [['era', 1.5], ['evf', 1.1]] },
    { id: 'b13', name: '眼明手快', color: 'b', path: 'fortune', fx: [['evt', 1.6]] },
    { id: 'b14', name: '逢凶化吉', color: 'b', path: 'fortune', fx: [['ward', 4], ['evf', 1.1]] },
    { id: 'b15', name: '机缘不小', color: 'b', path: 'fortune', fx: [['upgradeEvent', 1], ['evf', 1.1]] },
    { id: 'b16', name: '天心有感', color: 'b', path: 'tianxin', fx: [['xin', 1.3], ['xinPity', 0.000008]] },
    { id: 'b17', name: '心如明镜', color: 'b', path: 'tianxin', fx: [['xinPity', 0.000008], ['dlm', 10]] },
    { id: 'b18', name: '道音常伴', color: 'b', path: 'tianxin', fx: [['xin', 1.25], ['daog', 1.18]] },
    { id: 'b19', name: '不染尘心', color: 'b', path: 'tianxin', fx: [['ignoreSuppression', 0.08], ['ward', 3]] },
    { id: 'b20', name: '观天悟道', color: 'b', path: 'tianxin', fx: [['xinPity', 0.000012], ['daocap', 70]] },
    { id: 'b21', name: '命比金坚', color: 'b', path: 'imperial', fx: [['life', 1400], ['ward', 3]] },
    { id: 'b22', name: '稳如磐石', color: 'b', path: 'imperial', fx: [['ward', 5], ['zhx', 0.02]] },
    { id: 'b23', name: '大器晚成', color: 'b', path: 'imperial', fx: [['life', 1200], ['retryKeep', 0.25]] },
    { id: 'b24', name: '败而不馁', color: 'b', path: 'imperial', fx: [['retryKeep', 0.25], ['dao', 35], ['zhx', 0.02]] },
    { id: 'b25', name: '帝关有路', color: 'b', path: 'imperial', fx: [['zhx', 0.02], ['dlm', 10]] },

    /* 紫 */
    { id: 'p01', name: '王侯体魄', color: 'p', path: 'body', fx: [['floor', 5], ['bodyChance', 0.25]] },
    { id: 'p02', name: '真龙之血', color: 'p', path: 'body', fx: [['bodyChance', 0.3], ['bodyDao', 15]] },
    { id: 'p03', name: '玄玉之躯', color: 'p', path: 'body', fx: [['floor', 5], ['ward', 7]] },
    { id: 'p04', name: '脱胎换骨', color: 'p', path: 'body', fx: [['bodyChance', 0.35], ['dao', 15]] },
    { id: 'p05', name: '万劫炼身', color: 'p', path: 'body', fx: [['bodyDao', 20], ['daog', 1.3]] },
    { id: 'p06', name: '天纵其才', color: 'p', path: 'dao', fx: [['dao', 350], ['daocap', 180]] },
    { id: 'p07', name: '智珠在握', color: 'p', path: 'dao', fx: [['daog', 1.4], ['dao', 300]] },
    { id: 'p08', name: '长生近道', color: 'p', path: 'dao', fx: [['life', 2000], ['daog', 1.35]] },
    { id: 'p09', name: '道海生潮', color: 'p', path: 'dao', fx: [['overflow', 0.4], ['daocap', 180]] },
    { id: 'p10', name: '万法留痕', color: 'p', path: 'dao', fx: [['evt', 1.8], ['dao', 260]] },
    { id: 'p11', name: '大气运者', color: 'p', path: 'fortune', fx: [['era', 2.2], ['evt', 2]] },
    { id: 'p12', name: '秘境宠儿', color: 'p', path: 'fortune', fx: [['evf', 1.2], ['evt', 2.1]] },
    { id: 'p13', name: '鸿运当头', color: 'p', path: 'fortune', fx: [['upgradeEvent', 1], ['evt', 1.8]] },
    { id: 'p14', name: '大世应运', color: 'p', path: 'fortune', fx: [['era', 2.8], ['evf', 1.2]] },
    { id: 'p15', name: '劫中藏缘', color: 'p', path: 'fortune', fx: [['ward', 9], ['evt', 1.8]] },
    { id: 'p16', name: '天心常在', color: 'p', path: 'tianxin', fx: [['xin', 1.65], ['xinPity', 0.000018]] },
    { id: 'p17', name: '通神之窍', color: 'p', path: 'tianxin', fx: [['dlm', 20], ['dao', 240]] },
    { id: 'p18', name: '我心映天', color: 'p', path: 'tianxin', fx: [['ignoreSuppression', 0.2], ['xin', 1.5]] },
    { id: 'p19', name: '大道垂音', color: 'p', path: 'tianxin', fx: [['xinPity', 0.000025], ['daog', 1.3]] },
    { id: 'p20', name: '天门一线', color: 'p', path: 'tianxin', fx: [['dlm', 25], ['daocap', 72]] },
    { id: 'p21', name: '命如南山', color: 'p', path: 'imperial', fx: [['life', 3000], ['ward', 8]] },
    { id: 'p22', name: '不动如山', color: 'p', path: 'imperial', fx: [['ward', 10], ['retryKeep', 0.4]] },
    { id: 'p23', name: '帝裔余荫', color: 'p', path: 'imperial', fx: [['zhx', 0.04], ['life', 2400]] },
    { id: 'p24', name: '破关留命', color: 'p', path: 'imperial', fx: [['retry', 1], ['retryKeep', 0.4]] },
    { id: 'p25', name: '向死而生', color: 'p', path: 'imperial', fx: [['zhx', 0.05], ['ward', 6]] },

    /* 金：规则牌，不直接保送仙体或大帝 */
    { id: 'o01', name: '玄门正宗', color: 'o', path: 'body', fx: [['floor', 7], ['bodyChance', 0.4]] },
    { id: 'o02', name: '凡躯逆命', color: 'o', path: 'body', fx: [['bodyChance', 0.47], ['bodyDao', 35]] },
    { id: 'o03', name: '魔胎', color: 'o', path: 'body', fx: [['swallow', 1], ['daocap', 200]] },
    { id: 'o04', name: '天资纵横', color: 'o', path: 'body', fx: [['bodyChance', 0.45], ['evt', 2.5]] },
    { id: 'o05', name: '万法归一', color: 'o', path: 'body', fx: [['bodyChance', 0.42], ['bodyDao', 25], ['daocap', 140]] },
    { id: 'o06', name: '悟道绝伦', color: 'o', path: 'dao', fx: [['dao', 650], ['daog', 1.65]] },
    { id: 'o07', name: '道蕴天成', color: 'o', path: 'dao', fx: [['dao', 800], ['daocap', 400]] },
    { id: 'o08', name: '一念通玄', color: 'o', path: 'dao', fx: [['daog', 1.8], ['evt', 2.2]] },
    { id: 'o09', name: '帝经残页', color: 'o', path: 'dao', fx: [['overflow', 0.6], ['daocap', 350]] },
    { id: 'o10', name: '道果垂青', color: 'o', path: 'dao', fx: [['dao', 550], ['dlm', 30], ['zhx', 0.06]] },
    { id: 'o11', name: '黄金大世', color: 'o', path: 'fortune', fx: [['era', 5], ['evt', 2.8]] },
    { id: 'o12', name: '福泽深厚', color: 'o', path: 'fortune', fx: [['ward', 16], ['evf', 1.4]] },
    { id: 'o13', name: '帝兵护身', color: 'o', path: 'fortune', fx: [['evt', 4], ['upgradeEvent', 1]] },
    { id: 'o14', name: '圣域垂青', color: 'o', path: 'fortune', fx: [['evf', 1.4], ['evt', 3]] },
    { id: 'o15', name: '气运之子', color: 'o', path: 'fortune', fx: [['upgradeEvent', 1], ['era', 3], ['ward', 12]] },
    { id: 'o16', name: '天心随行', color: 'o', path: 'tianxin', fx: [['xin', 2], ['xinPity', 0.00005], ['dao', 500]] },
    { id: 'o17', name: '心合大道', color: 'o', path: 'tianxin', fx: [['dlm', 40], ['xin', 1.8]] },
    { id: 'o18', name: '天道酬帝', color: 'o', path: 'tianxin', fx: [['ignoreSuppression', 0.5], ['dlm', 30]] },
    { id: 'o19', name: '大道无碍', color: 'o', path: 'tianxin', fx: [['xinPity', 0.00007], ['daog', 1.5]] },
    { id: 'o20', name: '我道合天', color: 'o', path: 'tianxin', fx: [['xin', 1.8], ['zhx', 0.06], ['dao', 450]] },
    { id: 'o21', name: '帝路独行', color: 'o', path: 'imperial', fx: [['retry', 1], ['retryKeep', 0.5]] },
    { id: 'o22', name: '万古独尊', color: 'o', path: 'imperial', fx: [['zhx', 0.08], ['retryKeep', 0.5]] },
    { id: 'o23', name: '命与天齐', color: 'o', path: 'imperial', fx: [['life', 6000], ['ward', 12]] },
    { id: 'o24', name: '长生妙法', color: 'o', path: 'imperial', fx: [['life', 5000], ['retry', 1]] },
    { id: 'o25', name: '不世之勇', color: 'o', path: 'imperial', fx: [['zhx', 0.1], ['dlm', 30]] }
  ];

  var TRAIT_COLOR_NAME = { o: '金', p: '紫', b: '蓝', w: '白' };
  function traitById(id) { for (var i = 0; i < TRAITS.length; i++) if (TRAITS[i].id === id) return TRAITS[i]; return null; }
  function traitDesc(t) {
    if (!t) return '';
    var s = [], k;
    function cat(type, v) {
      switch (type) {
        case 'life': return '寿元+' + v + '，帝者晚年血气更稳';
        case 'floor': return '体质保底为' + TALENTS[v];
        case 'evf': return '机缘概率+' + Math.round((v - 1) * 100) + '%';
        case 'evt': return '高阶机缘×' + v;
        case 'ward': return '化险为夷+' + v + '%';
        case 'xin': return '感悟天心×' + v + '，并加速天心保底';
        case 'dlm': return '融合天心门槛-' + v + '%';
        case 'zhx': return '证道把握+' + Math.round(v * 1000) / 10 + '%';
        case 'dao': return '初始道蕴+' + v;
        case 'daog': return '道蕴成长×' + v;
        case 'daocap': return '道蕴上限+' + v;
        case 'era': return '生于盛世概率×' + v;
        case 'swallow': return '吞天魔功：需炼化诸般体质方可化混沌';
        case 'retry': return '帝关重修机会+1';
        case 'retryKeep': return '帝关重修损失减轻' + Math.round(v * 100) + '%';
        case 'bodyChance': return '后天体质蜕变概率+' + Math.round(v * 100) + '%';
        case 'bodyDao': return '体质蜕变所需道蕴-' + v;
        case 'overflow': return '道蕴溢出保留' + Math.round(v * 100) + '%';
        case 'upgradeEvent': return '首次低阶机缘额外获得高一阶道蕴';
        case 'xinPity': return '天心保底每年+' + Math.round(v * 1000000) / 10000 + '%';
        case 'ignoreSuppression': return '无视大道压制' + Math.round(v * 100) + '%';
      }
      return '';
    }
    for (k = 0; k < t.fx.length; k++) s.push(cat(t.fx[k][0], t.fx[k][1]));
    return s.join('，');
  }

  /* ---------- 成就系统：达成后按 bonus 累加高阶体质（6-10）抽取概率（百分点） ---------- */
  var ACHIEVEMENTS = [
    { id: 'innate10', name: '天生逆天体质', bonus: 0.1 },
    { id: 'yibian',   name: '体质异变',    bonus: 0.1 },
    { id: 'hunsheng', name: '成就大能',    bonus: 0.1 },
    { id: 'hundou',   name: '成就王者',    bonus: 0.1 },
    { id: 'feng91',   name: '成就准帝',    bonus: 0.1 },
    { id: 'chaoji',   name: '准帝后期',    bonus: 0.1 },
    { id: 'lim99',    name: '准帝巅峰',    bonus: 0.2 },
    { id: 'shiwan',   name: '十万实力',    bonus: 0.1 },
    { id: 'sanshiwan', name: '三十万实力', bonus: 0.2 },
    { id: 'million',  name: '百万实力',    bonus: 0.3 },
    { id: 'xintian',  name: '融合天心',    bonus: 0.1 },
    { id: 'god',      name: '证道成帝',    bonus: 0.2 },
    { id: 'dujie',    name: '以力证道',    bonus: 0.3 },
    { id: 'tianxin',  name: '天心成帝',    bonus: 0.2 },
    { id: 'reverse3', name: '逆活三世',    bonus: 0.4 },
    { id: 'reddust',  name: '红尘为仙',    bonus: 1.0 },
    { id: 'jidao',    name: '祭道传承',    bonus: 0.3 },
    { id: 'hedao',    name: '合道花开',    bonus: 0.3 },
    { id: 'god3',     name: '三生成帝',    bonus: 0.3 },
    { id: 'god10',    name: '十生成帝',    bonus: 0.4 },
    { id: 'god30',    name: '三十生成帝',  bonus: 0.5 },
    { id: 'god50',    name: '五十生成帝',  bonus: 0.8 },
    { id: 'god100',   name: '百生成帝',    bonus: 1 },
    { id: 'dazhuan',  name: '大帝转世',    bonus: 1 },
    { id: 'yetian',   name: '叶天帝之缘',  bonus: 0.5 },
    { id: 'busiy',    name: '不死神药',    bonus: 0.3 }
  ];

  /* ---------- 常量 ---------- */
  var DATA = {
    TALENTS: TALENTS, talentOf: talentOf, ERAS: ERAS,
    PHYSIQUES: PHYSIQUES, physiqueById: physiqueById, physiquesAtTier: physiquesAtTier, physiqueDesc: physiqueDesc,
    REALMS: REALMS, realmOf: realmOf, realmIdx: realmIdx, layerOf: layerOf, phaseOf: phaseOf, titleOf: titleOf,
    INNATE_WEIGHTS: INNATE_WEIGHTS,
    CULT_COEF: CULT_COEF,
    BREAK_CHANCE: BREAK_CHANCE,
    QUASI_LAYER_MULT: QUASI_LAYER_MULT,
    QUASI_CHAOS_MULT: QUASI_CHAOS_MULT,
    DAO_ABSOLUTE_MAX: DAO_ABSOLUTE_MAX,
    OVERWHELM_DAO_CULT: OVERWHELM_DAO_CULT,
    SACRED_OVERWHELM_CULT: SACRED_OVERWHELM_CULT,
    HEAVENLY_EMPEROR_CULT: HEAVENLY_EMPEROR_CULT,
    SACRED_JIDAO_CULT: SACRED_JIDAO_CULT,
    WORLD_EMPEROR_CULT_MIN: WORLD_EMPEROR_CULT_MIN,
    WORLD_EMPEROR_CULT_MAX: WORLD_EMPEROR_CULT_MAX,
    SACRED_EMPEROR_DAO_CAP: SACRED_EMPEROR_DAO_CAP,
    REALM_LIFE: REALM_LIFE,
    TRAITS: TRAITS, TRAIT_PATHS: TRAIT_PATHS, TRAIT_COLOR_NAME: TRAIT_COLOR_NAME, traitById: traitById, traitDesc: traitDesc,
    /* 词条抽取颜色权重（可改：白/蓝/紫/金，和需为 100 或任意比例） */
    TRAIT_WEIGHT: { w: 48, b: 28, p: 17, o: 7 },
    DAO_GIFT_NAMES: DAO_GIFT_NAMES,
    DAO_GIFT_WEIGHTS: DAO_GIFT_WEIGHTS,
    ACHIEVEMENTS: ACHIEVEMENTS,
    /* 诞生寿元 60-100（之后按境界上限带补充） */
    LIFE_MIN: 60, LIFE_MAX: 100,
    /* 旧口径：一生约 30 次。现改为按年密度抽（约 50 年一件），此值只作文档对照。 */
    EVENT_TARGET: 30,
    /* 修行水到渠成：每年触发概率 = STEADY_TARGET / 当前寿元（一生约 50 次） */
    STEADY_TARGET: 50,
    /* 天心：准帝期（≥91级）每年感悟概率（校准：平均约 1 成准帝可感悟） */
    XINTIAN_CHANCE: 0.00003,
    /* 先天体质品阶带来的天心感悟加成（体质自身特性另行叠加） */
    XINTIAN_TALENT_MULT: { 8: 1.1, 9: 1.3, 10: 1.5 },
    /* 融合天心证道所需实力区间下限/上限（随机门槛，达到即证道成功） */
    XINTIAN_NEED_MIN: 250000,
    XINTIAN_NEED_MAX: 300000,
    /* 持天心但未修炼至圆满（未到准帝巅峰/战力不足）强行融合天心：即便战力达标也只有 15% 把握 */
    TIANXIN_EARLY_CHANCE: 0.15,
    /* 人道与帝者时间线 */
    EMPEROR_PATH_FADE_AGE: 7500,
    EMPEROR_PATH_CLOSE_AGE: 10000,
    /* 路人帝看同期天骄走完那条路的稀有度，不看「你活过了多少年」。
     * 一代里大约 3 个能叫天骄的人；大多到不了准帝，准帝里能成帝的也很少。
     * 6000 年只表示这一代还没走到门口，不是过线就该冒出一位帝。 */
    WORLD_RIVAL_EMPEROR_MIN_YEAR: 6000,
    WORLD_RIVAL_GENIUS_COHORT: 3,
    WORLD_RIVAL_QUASI_CHANCE: 0.08,
    WORLD_RIVAL_EMPEROR_GIVEN_QUASI: 0.06,
    WORLD_RIVAL_GENERATION_YEARS: 4000,
    WORLD_RIVAL_EMPEROR_YEARLY: (function () {
      var one = 0.08 * 0.06;
      var gen = 1 - Math.pow(1 - one, 3);
      return 1 - Math.pow(1 - gen, 1 / 4000);
    })(),
    /* 路人大帝一世约一万至一万四千年；坐化后道痕再压约一万年，此间无人能成帝。 */
    WORLD_EMPEROR_LIFE_MIN: 10000,
    WORLD_EMPEROR_LIFE_MAX: 14000,
    DAO_TRACE_MIN: 9000,
    DAO_TRACE_MAX: 11000,
    EMPEROR_LIFE_MIN: 9000,
    EMPEROR_LIFE_MAX: 11000,
    EMPEROR_EVENT_TARGET: 24,
    RED_DUST_LIVES: 9,
    /* 不死天皇高世蜕变阶段的战力基准；普通一世大帝通常远低于此值。 */
    UNDEAD_EMPEROR_CULT: 1500000,
    /* 即使知道奇异世界坐标，也必须达到此战力才能轰穿界壁。 */
    STRANGE_WORLD_BREAK_CULT: 1250000,
    STRANGE_WORLD_YEARS_MIN: 200000,
    STRANGE_WORLD_YEARS_MAX: 500000,
    /* 成仙路需近一纪元才会显现；开启后横渡仍极难。 */
    IMMORTAL_ROAD_MIN_YEAR: 3600000,
    IMMORTAL_ROAD_EVENT_TARGET: 0.08,
    /* 以力证道/融合天心 证道后的实力增幅倍率（随机 1.15~1.45） */
    CHENGDI_BONUS_MIN: 1.15,
    CHENGDI_BONUS_MAX: 1.45,
    /* 特殊事件概率 */
    JIDAO_CHANCE: 5e-10,    /* 祭道传承：古之大帝遗泽，直接证道成帝 */
    HEDAO_CHANCE: 1e-9,     /* 合道花：万古难遇，直接证道成帝 */
    DAZHUAN_CHANCE: 1e-8,   /* 大帝转世：修炼资质臻至绝顶，寿元+100 */
    YETIAN_CHANCE: 1e-8,    /* 叶天帝：赠资源提资质 */
    CHENGDI_BONUS_JIDAO: 2, /* 祭道/合道传承 证道后实力倍率：2 倍 */
    /* 玩家等级经验：升到第 n 级需 50×n 经验（累计 = 25×n×(n+1)） */
    PLAYER_LV_BASE: 50,
    /* 证道成帝直接获得经验 / 普通结算 = 境界层数×0.5 / 提前结算 = 境界层数×0.1 */
    CHENGDI_EXP: 1000,
    RED_DUST_EXP: 5000,
    EXP_PER_LVL: 0.5,
    EXP_PER_LVL_EARLY: 0.1
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  root.DATA = DATA;
})(typeof self !== 'undefined' ? self : this);
