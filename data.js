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
    { id: 'sacred', name: '荒古圣体', tier: 9, weight: 1, fx: pm({ cgt: 1.3, ward: 10, zhx: 0.02, life: 80 }), desc: '金色苦海、血气如海，大成可叫板大帝' },
    { id: 'overlord', name: '苍天霸体', tier: 9, weight: 1, fx: pm({ brk: 1.05, cgt: 1.28, ward: 12 }), desc: '紫色苦海、神形无双，与圣体争锋' },
    { id: 'origin_sacred', name: '元灵圣体', tier: 9, weight: 1, fx: pm({ brk: 1.18, cgt: 1.3, evf: 1.2 }), desc: '圣体肉身与元灵法力合一' },
    { id: 'chaos', name: '混沌体', tier: 10, weight: 1, fx: pm({ brk: 1.3, cgt: 1.4, evt: 1.5, xin: 1.5, dlm: 10, zhx: 0.70 }), desc: '万道交融，不受寻常大道压制' },
    { id: 'innate_sacred_dao', name: '先天圣体道胎', tier: 10, weight: 1, fx: pm({ brk: 1.35, cgt: 1.35, xin: 1.6, dlm: 10, ward: 10, zhx: 0.65 }), desc: '圣体肉身与道胎悟性合一' }
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

  /* 天时并非人人平等：黄金大世机缘更多，也意味着更强的竞争与危险。 */
  var ERAS = [
    { id: 'normal', name: '平常时代', weight: 80, daog: 0.75, evt: 0.8, evf: 0.9 },
    { id: 'prosperous', name: '修行盛世', weight: 15, daog: 1.10, evt: 1.2, evf: 1.1 },
    { id: 'golden', name: '黄金大世', weight: 5, daog: 1.45, evt: 1.7, evf: 1.25 }
  ];

  /* 实力成长系数：下标 = 后台修炼资质档位（1-10） */
  var CULT_COEF = [0, 1.0, 1.5, 2.2, 3.2, 4.5, 6.3, 8.8, 12, 16, 22];

  /* 突破年数表（单位：年）。高阶体质不是单纯多活几年，而是把成长高峰压到青年期：
   * 8档可在一世内争帝，9档通常数百至千余岁入准帝，10档目标为约二百岁准帝、五百岁内外帝关。 */
  var BREAK_CHANCE = [
    [4, 20, 50, 120, 300, 800, 2000, 4000, 10000, 16000, 24000, 30000],
    [2, 10, 25, 60, 150, 400, 1000, 2000, 5000, 8000, 12000, 15000],
    [1.3, 6.7, 17, 40, 100, 267, 667, 1333, 3333, 5333, 8000, 10000],
    [0.95, 4.8, 12, 29, 71, 190, 476, 952, 2381, 3810, 5714, 7143],
    [0.8, 4, 10, 24, 60, 160, 400, 800, 2000, 3200, 4800, 6000],
    [0.7, 3, 8, 20, 45, 100, 200, 350, 600, 1000, 1500, 2200],
    [0.5, 2, 5, 12, 25, 50, 100, 180, 320, 600, 900, 1400],
    [0.3, 1, 2, 4, 8, 16, 32, 60, 110, 220, 400, 700],
    [0.15, 0.5, 1, 2, 4, 8, 15, 25, 45, 90, 180, 350],
    [0.1, 0.2, 0.4, 0.8, 1.5, 3, 5, 8, 12, 20, 40, 80]
  ];

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
    [6500, 8000]          /* 10 准帝；正常帝路八千岁关闭 */
  ];

  /* ---------- 词条（100 个：白25 / 蓝25 / 紫25 / 金25） ----------
   * fx 效果数组：[ [type, value], ... ]；type：
   *   life 额外寿元+X（不计入境界上限） / cult 初始实力+X / apt 初始资质+X(≤10)
   *   floor 体质保底（先天体质不低于该级） / brk 突破概率×V / cgt 实力成长×V
   *   evf 机缘触发频率×V / evt 高阶机缘(≥t3)权重×V / ward 化险为夷+（百分点）
   *   xin 感悟天心概率×V / dlm 天心门槛降低V% / zhx 最终证道把握+V
   *   dao 初始道蕴+V / daog 道蕴成长×V / daocap 道蕴上限+V / era 盛世概率×V
   *   swallow 开启吞天魔功线 / retry 帝关重修机会+V
   * 抽取：白55% / 蓝28% / 紫13% / 金4%，每局从5张中选2张。
   * 金卡优先改变路线或规则，不直接赠送顶级体质。 */
  var TRAITS = [
    /* ---------- 白（凡品 25）：只许最基础的微量属性，≤2 项，无资质/高阶机缘/天心/证道 ---------- */
    { id: 'w01', name: '血气方刚', color: 'w', fx: [['life', 5]] },
    { id: 'w02', name: '身强体健', color: 'w', fx: [['life', 4], ['cult', 30]] },
    { id: 'w03', name: '日积月累', color: 'w', fx: [['life', 3], ['daog', 1.05]] },
    { id: 'w04', name: '灵韵初显', color: 'w', fx: [['life', 2], ['cgt', 1.01]] },
    { id: 'w05', name: '小有福缘', color: 'w', fx: [['life', 2], ['evf', 1.02]] },
    { id: 'w06', name: '心宽福长', color: 'w', fx: [['life', 3], ['ward', 1]] },
    { id: 'w07', name: '天生神力', color: 'w', fx: [['cult', 60]] },
    { id: 'w08', name: '磨砺己身', color: 'w', fx: [['cult', 50], ['brk', 1.02]] },
    { id: 'w09', name: '勤修不止', color: 'w', fx: [['cult', 40], ['cgt', 1.01]] },
    { id: 'w10', name: '乐善好施', color: 'w', fx: [['cult', 40], ['evf', 1.03]] },
    { id: 'w11', name: '处世圆融', color: 'w', fx: [['cult', 30], ['ward', 1]] },
    { id: 'w12', name: '百炼凡胎', color: 'w', fx: [['floor', 2]] },
    { id: 'w13', name: '筋骨初成', color: 'w', fx: [['floor', 2], ['life', 3]] },
    { id: 'w14', name: '精血充沛', color: 'w', fx: [['floor', 2], ['cult', 40]] },
    { id: 'w15', name: '悟性初醒', color: 'w', fx: [['dao', 3]] },
    { id: 'w16', name: '温故知新', color: 'w', fx: [['brk', 1.02], ['cgt', 1.01]] },
    { id: 'w17', name: '广交游历', color: 'w', fx: [['brk', 1.02], ['evf', 1.03]] },
    { id: 'w18', name: '心细谨慎', color: 'w', fx: [['brk', 1.02], ['ward', 1]] },
    { id: 'w19', name: '厚德载物', color: 'w', fx: [['cgt', 1.02]] },
    { id: 'w20', name: '水滴石穿', color: 'w', fx: [['cgt', 1.02], ['evf', 1.02]] },
    { id: 'w21', name: '稳重求生', color: 'w', fx: [['cgt', 1.01], ['ward', 1]] },
    { id: 'w22', name: '时来运转', color: 'w', fx: [['evf', 1.05]] },
    { id: 'w23', name: '命里藏福', color: 'w', fx: [['evf', 1.03], ['ward', 1]] },
    { id: 'w24', name: '苦练不辍', color: 'w', fx: [['life', 2], ['brk', 1.03]] },
    { id: 'w25', name: '天生长寿', color: 'w', fx: [['floor', 2], ['ward', 1]] },
    /* ---------- 蓝（稀有 15）：白的能力升级，另有 apt+1 / floor3 / 高阶机缘微增 ---------- */
    { id: 'b01', name: '天资初醒', color: 'b', fx: [['dao', 8], ['daog', 1.10]] },
    { id: 'b02', name: '骨架不凡', color: 'b', fx: [['floor', 3], ['life', 8]] },
    { id: 'b03', name: '灵秀之气', color: 'b', fx: [['evt', 1.4], ['life', 6]] },
    { id: 'b04', name: '福源不小', color: 'b', fx: [['evt', 1.4], ['cult', 300]] },
    { id: 'b05', name: '命格稳健', color: 'b', fx: [['life', 12], ['ward', 3]] },
    { id: 'b06', name: '大器晚成', color: 'b', fx: [['life', 10], ['brk', 1.04]] },
    { id: 'b07', name: '底蕴渐丰', color: 'b', fx: [['cult', 300], ['cgt', 1.04]] },
    { id: 'b08', name: '贵人相助', color: 'b', fx: [['cult', 250], ['evf', 1.06]] },
    { id: 'b09', name: '逢凶化吉', color: 'b', fx: [['cult', 250], ['ward', 3]] },
    { id: 'b10', name: '悟性渐佳', color: 'b', fx: [['dao', 6], ['daog', 1.15]] },
    { id: 'b11', name: '广结善缘', color: 'b', fx: [['brk', 1.05], ['evf', 1.06]] },
    { id: 'b12', name: '渐入佳境', color: 'b', fx: [['cgt', 1.04], ['evf', 1.07]] },
    { id: 'b13', name: '小有慧根', color: 'b', fx: [['life', 8], ['brk', 1.05]] },
    { id: 'b14', name: '沉稳老练', color: 'b', fx: [['ward', 4], ['evf', 1.06]] },
    { id: 'b15', name: '机缘尚可', color: 'b', fx: [['evt', 1.5], ['cgt', 1.03]] },
    /* 扩充蓝 → 至 25 条 */
    { id: 'b16', name: '命比金坚', color: 'b', fx: [['life', 14], ['evf', 1.06]] },
    { id: 'b17', name: '势大力沉', color: 'b', fx: [['cult', 400], ['brk', 1.05]] },
    { id: 'b18', name: '过目不忘', color: 'b', fx: [['dao', 10], ['evt', 1.5]] },
    { id: 'b19', name: '铜筋铁骨', color: 'b', fx: [['floor', 3], ['cgt', 1.05]] },
    { id: 'b20', name: '气贯长虹', color: 'b', fx: [['life', 16], ['evf', 1.07]] },
    { id: 'b21', name: '机缘不小', color: 'b', fx: [['cult', 300], ['evf', 1.08]] },
    { id: 'b22', name: '后发制人', color: 'b', fx: [['brk', 1.06], ['cgt', 1.04]] },
    { id: 'b23', name: '稳如磐石', color: 'b', fx: [['ward', 5], ['life', 12]] },
    { id: 'b24', name: '眼明手快', color: 'b', fx: [['evt', 1.6], ['brk', 1.05]] },
    { id: 'b25', name: '气运初开', color: 'b', fx: [['era', 1.4], ['cult', 400]] },
    /* ---------- 紫（史诗 8）：另有 apt+2 / floor5 / 感悟天心（仅微增） ---------- */
    { id: 'p01', name: '天心有感', color: 'p', fx: [['xin', 1.15], ['dao', 15]] },
    { id: 'p02', name: '王侯体魄', color: 'p', fx: [['floor', 5], ['brk', 1.09]] },
    { id: 'p03', name: '天纵其才', color: 'p', fx: [['dao', 18], ['daocap', 20]] },
    { id: 'p04', name: '大气运者', color: 'p', fx: [['era', 2], ['evt', 1.9]] },
    { id: 'p05', name: '战意勃发', color: 'p', fx: [['brk', 1.1], ['evf', 1.1]] },
    { id: 'p06', name: '长生近道', color: 'p', fx: [['cgt', 1.08], ['life', 50]] },
    { id: 'p07', name: '沉稳若山', color: 'p', fx: [['ward', 6], ['evf', 1.12]] },
    { id: 'p08', name: '秘境宠儿', color: 'p', fx: [['evt', 2], ['cgt', 1.06]] },
    /* 扩充紫 → 至 25 条 */
    { id: 'p09', name: '真龙之血', color: 'p', fx: [['apt', 2], ['evf', 1.12]] },
    { id: 'p10', name: '万古长青', color: 'p', fx: [['floor', 5], ['evt', 2.2]] },
    { id: 'p11', name: '心如明镜', color: 'p', fx: [['xin', 1.15], ['dao', 16]] },
    { id: 'p12', name: '战气冲霄', color: 'p', fx: [['brk', 1.1], ['cgt', 1.08]] },
    { id: 'p13', name: '大世应运', color: 'p', fx: [['era', 2.4], ['evf', 1.15]] },
    { id: 'p14', name: '鸿运当头', color: 'p', fx: [['evt', 2.2], ['cult', 900]] },
    { id: 'p15', name: '命如南山', color: 'p', fx: [['life', 60], ['ward', 8]] },
    { id: 'p16', name: '智珠在握', color: 'p', fx: [['dao', 20], ['daocap', 20]] },
    { id: 'p17', name: '天心常在', color: 'p', fx: [['floor', 5], ['xin', 1.2]] },
    { id: 'p18', name: '铁血战意', color: 'p', fx: [['brk', 1.09], ['cult', 700]] },
    { id: 'p19', name: '厚土承运', color: 'p', fx: [['cgt', 1.08], ['evf', 1.12]] },
    { id: 'p20', name: '长生古药', color: 'p', fx: [['evt', 2], ['life', 50]] },
    { id: 'p21', name: '不动如山', color: 'p', fx: [['ward', 8], ['brk', 1.08]] },
    { id: 'p22', name: '天纵逸才', color: 'p', fx: [['apt', 1], ['evt', 2.2]] },
    { id: 'p23', name: '玄玉之躯', color: 'p', fx: [['floor', 5], ['life', 30]] },
    { id: 'p24', name: '通神之窍', color: 'p', fx: [['xin', 1.2], ['dao', 18]] },
    { id: 'p25', name: '帝裔威压', color: 'p', fx: [['cult', 1200], ['brk', 1.08]] },
    /* ---------- 橙（传说 2）：另有 floor7 / 资质更高 / 天心门槛与证道把握（微幅） ---------- */
    { id: 'o01', name: '帝经残页', color: 'o', fx: [['dao', 28], ['daocap', 35]] },
    { id: 'o02', name: '万古独尊', color: 'o', fx: [['dao', 25], ['retry', 1], ['zhx', 0.01]] },
    /* 扩充金 → 至 25 条 */
    { id: 'o03', name: '魔胎', color: 'o', fx: [['swallow', 1], ['daocap', 45]] },
    { id: 'o04', name: '天资纵横', color: 'o', fx: [['apt', 3], ['evf', 1.3]] },
    { id: 'o05', name: '心合大道', color: 'o', fx: [['xin', 1.5], ['brk', 1.15]] },
    { id: 'o06', name: '道果垂青', color: 'o', fx: [['dlm', 8], ['cgt', 1.12]] },
    { id: 'o07', name: '力破乾坤', color: 'o', fx: [['zhx', 0.02], ['brk', 1.12]] },
    { id: 'o08', name: '命与天齐', color: 'o', fx: [['life', 200], ['cult', 3000]] },
    { id: 'o09', name: '黄金大世', color: 'o', fx: [['era', 4], ['evt', 2.5]] },
    { id: 'o10', name: '福泽深厚', color: 'o', fx: [['ward', 15], ['life', 150]] },
    { id: 'o11', name: '玄门正宗', color: 'o', fx: [['floor', 7], ['evf', 1.2]] },
    { id: 'o12', name: '悟道绝伦', color: 'o', fx: [['dao', 32], ['daog', 1.5]] },
    { id: 'o13', name: '天心随行', color: 'o', fx: [['xin', 1.3], ['evt', 3]] },
    { id: 'o14', name: '长生妙法', color: 'o', fx: [['dlm', 5], ['life', 120]] },
    { id: 'o15', name: '不世之勇', color: 'o', fx: [['zhx', 0.03], ['cgt', 1.1]] },
    { id: 'o16', name: '裂空战意', color: 'o', fx: [['brk', 1.15], ['evf', 1.3]] },
    { id: 'o17', name: '道蕴天成', color: 'o', fx: [['dao', 35], ['daocap', 45]] },
    { id: 'o18', name: '帝兵护身', color: 'o', fx: [['evt', 4], ['brk', 1.12]] },
    { id: 'o19', name: '万法归一', color: 'o', fx: [['dao', 30], ['daocap', 35]] },
    { id: 'o20', name: '气吞寰宇', color: 'o', fx: [['cult', 3000], ['evf', 1.25]] },
    { id: 'o21', name: '金刚不灭', color: 'o', fx: [['life', 150], ['brk', 1.15]] },
    { id: 'o22', name: '圣域垂青', color: 'o', fx: [['ward', 15], ['evt', 3]] },
    { id: 'o23', name: '天道酬帝', color: 'o', fx: [['dlm', 10], ['brk', 1.15]] },
    { id: 'o24', name: '一念通玄', color: 'o', fx: [['xin', 1.4], ['cult', 2500]] },
    { id: 'o25', name: '帝路独行', color: 'o', fx: [['retry', 1], ['zhx', 0.02]] }
  ];

  var TRAIT_COLOR_NAME = { o: '金', p: '紫', b: '蓝', w: '白' };
  function traitById(id) { for (var i = 0; i < TRAITS.length; i++) if (TRAITS[i].id === id) return TRAITS[i]; return null; }
  function traitDesc(t) {
    if (!t) return '';
    var s = [], k;
    function cat(type, v) {
      switch (type) {
        case 'life': return '寿元+' + v;
        case 'cult': return '初始实力+' + v;
        case 'apt': return '初始道蕴+' + (v * 8) + '，道蕴上限+' + (v * 10);
        case 'floor': return '体质保底为' + TALENTS[v];
        case 'brk': return '修行加速' + Math.round((v - 1) * 100) + '%';
        case 'cgt': return '实力成长+' + Math.round((v - 1) * 100) + '%';
        case 'evf': return '机缘概率+' + Math.round((v - 1) * 100) + '%';
        case 'evt': return '高阶机缘×' + v;
        case 'ward': return '化险为夷+' + v + '%';
        case 'xin': return '感悟天心×' + v;
        case 'dlm': return '融合天心门槛-' + v + '%';
        case 'zhx': return '证道把握+' + Math.round(v * 1000) / 10 + '%';
        case 'dao': return '初始道蕴+' + v;
        case 'daog': return '道蕴成长×' + v;
        case 'daocap': return '道蕴上限+' + v;
        case 'era': return '生于盛世概率×' + v;
        case 'swallow': return '吞天魔功机缘开启';
        case 'retry': return '帝关重修机会+1';
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
    REALM_LIFE: REALM_LIFE,
    TRAITS: TRAITS, TRAIT_COLOR_NAME: TRAIT_COLOR_NAME, traitById: traitById, traitDesc: traitDesc,
    /* 词条抽取颜色权重（可改：白/蓝/紫/金，和需为 100 或任意比例） */
    TRAIT_WEIGHT: { w: 55, b: 28, p: 13, o: 4 },
    ACHIEVEMENTS: ACHIEVEMENTS,
    /* 诞生寿元 60-100（之后按境界上限带补充） */
    LIFE_MIN: 60, LIFE_MAX: 100,
    /* 事件：每年触发概率 = EVENT_TARGET / 当前寿元（一生约 30 次） */
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
    EMPEROR_PATH_FADE_AGE: 6000,
    EMPEROR_PATH_CLOSE_AGE: 8000,
    EMPEROR_LIFE_MIN: 9000,
    EMPEROR_LIFE_MAX: 11000,
    EMPEROR_EVENT_TARGET: 18,
    RED_DUST_LIVES: 9,
    /* 不死天皇按“三世天帝级”折算的战力基准；普通一世大帝通常远低于此值。 */
    UNDEAD_EMPEROR_CULT: 3000000,
    /* 即使知道奇异世界坐标，也必须达到此战力才能轰穿界壁。 */
    STRANGE_WORLD_BREAK_CULT: 1500000,
    STRANGE_WORLD_YEARS_MIN: 200000,
    STRANGE_WORLD_YEARS_MAX: 500000,
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
