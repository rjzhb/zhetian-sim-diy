/* ============================================================
 * 遮天模拟器 · 随机事件聚合入口
 *
 * 事件按主题拆分成多个包，本文件只负责合并与校验：
 *   events-pools.js     原著核对后的素材池与共用工具
 *   events-core.js      早年修行、基础机缘、吞天路线、帝路骨架
 *   events-dao.js       悟道、创法、道蕴与纯悟性路线
 *   events-physique.js  体质、血脉、种族与蜕变
 *   events-world.js     势力、时代、宿敌、世界大势
 *   events-road.js      星空古路、秘境副本、梭哈型关键机缘
 *   events-life.js      分境界路边故事，按体质/悟性分流
 *   events-life-late.js 仙台到准帝的第二套路边故事
 *   events-thrill.js    分境界梭哈：仙台到准帝的第二套关键机缘
 *
 * 事件字段：
 *   id 唯一标识 / name 展示名 / tier 稀有度 1普通 2中级 3稀有 4传说
 *   weight 触发权重 / tag 去重标签（同标签事件短期内互相降权）
 *   minAge/maxAge 年龄区间 / available 是否进入奖池 / cond 成功判定
 *   ok/fail 自动结算回调
 *   choice(g,U) 返回 { lead, info, note, options:[{id,label,desc,chance,risk,safe}] }
 *               返回非空时事件交给玩家决定，由 resolve 结算
 *   resolve(g,U,optionId,log) 处理玩家选择
 * ============================================================ */
(function (root) {
  var isNode = typeof module !== 'undefined' && module.exports;
  var packs = isNode ? [
    require('./events-core.js'),
    require('./events-dao.js'),
    require('./events-physique.js'),
    require('./events-world.js'),
    require('./events-road.js'),
    require('./events-life.js'),
    require('./events-life-late.js'),
    require('./events-thrill.js')
  ] : [
    root.EVENT_PACK_CORE, root.EVENT_PACK_DAO, root.EVENT_PACK_PHYSIQUE,
    root.EVENT_PACK_WORLD, root.EVENT_PACK_ROAD, root.EVENT_PACK_LIFE,
    root.EVENT_PACK_LIFE_LATE, root.EVENT_PACK_THRILL
  ];

  var EVENTS = [], seen = {}, i, j;
  for (i = 0; i < packs.length; i++) {
    var pack = packs[i] || [];
    for (j = 0; j < pack.length; j++) {
      var ev = pack[j];
      if (!ev || !ev.id) continue;
      if (seen[ev.id]) throw new Error('重复事件 id: ' + ev.id);
      seen[ev.id] = true;
      EVENTS.push(ev);
    }
  }

  if (isNode) module.exports = EVENTS;
  root.EVENTS = EVENTS;
})(typeof self !== 'undefined' ? self : this);
