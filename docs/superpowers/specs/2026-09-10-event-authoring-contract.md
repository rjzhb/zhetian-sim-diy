# 事件包编写契约（遮天模拟器）

所有新事件包必须遵守本契约。引擎在 `sim.js`，聚合在 `events.js`，素材池在 `events-pools.js`。

## 文件骨架

```js
(function (root) {
  var POOLS = typeof module !== 'undefined' && module.exports ? require('./events-pools.js') : root.EVENT_POOLS;
  var PICK = POOLS.PICK, stage = POOLS.stage, lvNeed = POOLS.lvNeed;
  var EVENTS = [ /* ... */ ];
  if (typeof module !== 'undefined' && module.exports) module.exports = EVENTS;
  root.EVENT_PACK_XXX = EVENTS;
})(typeof self !== 'undefined' ? self : this);
```

必须是 ES5 语法：只用 `var`、`function`，不要箭头函数、模板字符串、`let/const`、`class`、解构。

## 事件字段

| 字段 | 说明 |
| --- | --- |
| `id` | 全局唯一，小写下划线，不得与其他包重复 |
| `name` | 展示名，日志会输出「第N岁，遇到{name}，{正文}」 |
| `tier` | 1 普通 / 2 中级 / 3 稀有 / 4 传说 |
| `weight` | 同 tier 内相对权重。T1 约 3~6，T2 约 2~3.5，T3 约 0.5~1.6，T4 约 0.15~1.0 |
| `tag` | 去重标签，同标签事件短期内互相降权。例如 `'dao'`、`'sect'`、`'beast'` |
| `minAge` / `maxAge` | 年龄区间，默认 0 / 10000 |
| `available(g, U)` | 是否进入奖池。不满足境界/体质/时代的事件必须在这里挡掉 |
| `cond(g, U)` | 成功判定。返回 true 走 `ok`，false 走 `fail`。`null` 表示必定成功 |
| `ok(g, U, log)` | 成功结算 |
| `fail(g, U, log)` | 失败结算，可为 `null` |
| `maxCount` | 一局内最多触发次数 |
| `choice(g, U)` | 返回选项规格则交给玩家决定，见下 |
| `resolve(g, U, optionId, log)` | 处理玩家选择，必须处理所有 optionId |

有 `choice` 时不会走 `cond/ok/fail`，只走 `resolve`。

## 选择型事件

```js
choice: function (g, U) {
  var win = U.clamp(0.25 + U.currentCombatPower(g) / 400000, 0.1, 0.8);
  return {
    lead: '帝兵自混沌中出世，数尊老怪已在赶来',
    info: '当前战力 ' + g.cult + ' · 正面争夺胜算 ' + U.pct(win),
    note: '退走没有损失；硬抢成功可得极道帝兵，失败当场身陨。',
    options: [
      { id: 'leave', label: '远远避开', desc: '无收益，无风险', safe: true },
      { id: 'watch', label: '外围观道痕', desc: '小幅收益', chance: 0.75 },
      { id: 'grab',  label: '出手争夺',   desc: '成功得极道帝兵', chance: win, risk: 'deadly' }
    ]
  };
}
```

- `chance` 会直接显示给玩家，必须与 `resolve` 里实际使用的概率一致。
- `risk: 'deadly'` 表示失败可能身陨，UI 会红色标注。
- 必须恰有一个选项带 `safe: true`，快速模式和批量模拟会自动选它。
- 选项数 2~4 个。文案说清收益与代价，不要写「未知」。

## 可用工具 `U`

数值：`U.rand(a,b)`、`U.irand(a,b)`、`U.round(x)`、`U.clamp(x,a,b)`、`U.pct(p)`、`U.data`（即 DATA）

修行：
- `U.cultPct(g, minPct, maxPct, floor)` 按当前实力百分比加战力，返回增加值
- `U.up(g, n, log)` 连升 n 层
- `U.apt(g, n)` 资质提升（≤10）
- `U.gainLife(g, lo, hi)` 加寿元（不超本境上限），返回实际值
- `U.gainDao(g, amount, capAdd)` 加道蕴，可同时抬高上限
- `U.hurt(g, lo, hi)` 受伤，返回 `{loss, exempt}`，自带化险为夷豁免
- `U.kill(g, text)` 直接身陨
- `U.printlog(text)` 输出正文（自动加「第N岁，遇到X，」前缀）
- `U.push(log, {cls, text})` 输出不带前缀的独立行，cls 可用 `rare`/`god`/`dead`/`rainbow`/`brk`

判定：`U.isHighDaoyun(g)`、`U.currentCombatPower(g)`、`U.breakChance`、`U.sacredEmperorChance`

创法：`U.availableArtTypes(g)`、`U.createArtChance(g, typeId)`、`U.createArtDeathChance(g, typeId)`、`U.addCreatedArt(g, typeId, opts)`、`U.artCount(g, typeId)`、`U.artSummary(g)`、`U.latestArt(g)`

吞天：`U.trySwallowPhysique(g, log)`、`U.nextSwallowTarget(g)`、`U.swallowProgress(g)`

体质：`U.drawHighTalent(g)`、`U.completeSacredBody(g, log)`

## 可读的 `g` 字段

`g.age` `g.lvl`（1~100，101 为大帝）`g.cult` 战力 `g.daoyun` / `g.daoyunCap` 道蕴
`g.daoGift` 悟性 1~10 `g.innate` 体质档 1~10 `g.physiqueId` / `g.physiqueName`
`g.aptitude` 修行根基 `g.lifespan` / `g.lifeBase` / `g.lifeBonus`
`g.era` 时代对象 `{id:'normal'|'prosperous'|'golden', name, daog, evt, evf}`
`g.becameEmperor` `g.emperor` `g.swallowingArt` `g.worldEmperor`（当世是否有别的大帝）
`g.forbiddenKarma` 与禁区的血债 `g.createdArts` 已创法门

自定义状态字段直接挂在 `g` 上即可（如 `g.myEventFlag = true`），用于事件链。

## 境界对照

| lvl | 境界 |
| --- | --- |
| 1-10 | 轮海 |
| 11-20 | 道宫 |
| 21-30 | 四极 |
| 31-40 | 化龙 |
| 41-50 | 仙台一层天 |
| 51-60 | 二层天·大能 |
| 61-70 | 三层天·王者 |
| 71-80 | 四层天·圣人 |
| 81-90 | 五层天·大圣 |
| 91-99 | 准帝一至九重天 |
| 100 | 准帝九重天巅峰 |

## 平衡红线

- T1 战力收益 `cultPct` 不超过 0.012，T2 不超过 0.05，T3 不超过 0.14，T4 不超过 0.30。
- T1/T2 加寿元不超过 60，T3 不超过 300，T4 不超过 800。
- 道蕴：T1 不加，T2 最多 6，T3 8~40，T4 20~70；只有 T4 可以 `capAdd`（最多 32）。
- 只有 T4 或玩家自选的 `risk: 'deadly'` 选项才能致死，自动结算事件不得无预警秒杀。
- 凡体（`g.innate <= 2`）在非吞天路线下不得有额外死亡惩罚。
- 所有 `available` 必须限制 `!g.becameEmperor`，除非事件本就写给帝者。

## 原著口径

- 只用《遮天》中真实存在的人物、器物、功法、地名；素材池已核对，优先从 `POOLS` 取。
- 需要新造名字时用泛化描述（「一位古族圣子」「某座无名古矿」），不要杜撰具体帝号或帝兵名。
- 荒古圣体准帝九重天即大成圣体、极道至尊，不需要额外的「大成」仪式。
- 圣体的诅咒来自禁区至尊，不是天意。
- 成帝前不得获得奇异世界坐标、仙源、太初命石。
- 不死药只能续一世，不能量产。
- 九秘是斗、字、皆、列、前、行、者、阵、兵九字真言。
