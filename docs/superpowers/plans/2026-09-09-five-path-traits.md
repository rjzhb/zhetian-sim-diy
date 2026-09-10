# Five-Path Traits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all 100 legacy numeric traits with five build-defining paths, same-path resonance, and clear selection UI.

**Architecture:** `data.js` remains the declarative source of trait and path metadata. `sim.js` derives one resonance from the selected pair and consumes its state at existing yearly, event, Tianxin, and imperial-gate boundaries; `game.js` renders data supplied by those modules without duplicating rules.

**Tech Stack:** Static HTML/CSS and browser-compatible ES5 JavaScript; Node built-in `assert` for regression tests.

**Spec:** `docs/superpowers/specs/2026-09-09-five-path-traits-design.md`

## Global Constraints

- Keep the project dependency-free and build-free.
- Keep exactly 100 traits: 25 per rarity, five per path in every rarity.
- Remove `cult`, `brk`, and `cgt` from trait data and trait aggregation.
- Do not change physique-specific cultivation and combat modifiers.
- Gold traits change rules but never directly guarantee top physique or emperor success.

---

### Task 1: Trait schema regression harness

**Files:**
- Create: `tests/trait-system.test.js`
- Read: `data.js`

**Interfaces:**
- Consumes: `DATA.TRAITS`, `DATA.TRAIT_PATHS`, `DATA.traitDesc(trait)`
- Produces: dependency-free structural regression command `node tests/trait-system.test.js`

- [ ] **Step 1: Write the failing structural test**

```js
const assert = require('assert');
const DATA = require('../data.js');
const paths = Object.keys(DATA.TRAIT_PATHS);
const legacy = new Set(['cult', 'brk', 'cgt']);

assert.deepStrictEqual(paths.sort(), ['body', 'dao', 'fortune', 'imperial', 'tianxin']);
assert.strictEqual(DATA.TRAITS.length, 100);
for (const color of ['w', 'b', 'p', 'o']) {
  assert.strictEqual(DATA.TRAITS.filter(t => t.color === color).length, 25);
  for (const path of paths) {
    assert.strictEqual(DATA.TRAITS.filter(t => t.color === color && t.path === path).length, 5);
  }
}
for (const trait of DATA.TRAITS) {
  assert.ok(paths.includes(trait.path), trait.id + ' missing path');
  assert.ok(trait.fx.every(effect => !legacy.has(effect[0])), trait.id + ' has legacy effect');
  assert.ok(!/修行速度|修炼速度|实力成长|初始实力/.test(DATA.traitDesc(trait)));
}
```

- [ ] **Step 2: Run test and verify RED**

Run: `node tests/trait-system.test.js`

Expected: failure because `TRAIT_PATHS` and `path` are absent and legacy effects remain.

- [ ] **Step 3: Keep this test as the contract for Task 2**

No production code changes belong in this task.

---

### Task 2: Declarative five-path card pool

**Files:**
- Modify: `data.js:138-287`
- Test: `tests/trait-system.test.js`

**Interfaces:**
- Produces: `TRAIT_PATHS`, 100 `TRAITS` with `path`, and descriptions for all new effect types.
- Preserves: `traitById(id)`, `traitDesc(trait)`, `TRAIT_COLOR_NAME`

- [ ] **Step 1: Add path metadata**

```js
var TRAIT_PATHS = {
  body: { name: '体质蜕变', icon: '🩸', resonance: '百炼成道' },
  dao: { name: '道蕴悟道', icon: '☯', resonance: '道海无涯' },
  fortune: { name: '气运机缘', icon: '✦', resonance: '否极泰来' },
  tianxin: { name: '天心证道', icon: '✧', resonance: '天心相照' },
  imperial: { name: '帝路生存', icon: '♛', resonance: '帝路不绝' }
};
```

- [ ] **Step 2: Rewrite all 100 cards**

Assign five cards to every rarity/path pair. Use only these effect types:

```js
life, floor, dao, daog, daocap, evf, evt, ward, era,
xin, xinPity, dlm, ignoreSuppression, zhx, retry, retryKeep,
bodyChance, bodyDao, overflow, upgradeEvent, swallow
```

Names must match their effects. Merge duplicate growth effects within one card into one `daog` multiplier.

- [ ] **Step 3: Extend `traitDesc`**

Add exact player-facing descriptions for every new effect:

```js
case 'xinPity': return '天心保底每年+' + Math.round(v * 10000) / 100 + '%';
case 'ignoreSuppression': return '无视大道压制' + Math.round(v * 100) + '%';
case 'retryKeep': return '帝关重修保留+' + Math.round(v * 100) + '%';
case 'bodyChance': return '后天蜕变概率+' + Math.round(v * 100) + '%';
case 'bodyDao': return '体质蜕变所需道蕴-' + v;
case 'overflow': return '道蕴溢出保留' + Math.round(v * 100) + '%';
case 'upgradeEvent': return '首次低阶机缘提升一级';
```

- [ ] **Step 4: Export `TRAIT_PATHS` and run GREEN test**

Run: `node tests/trait-system.test.js`

Expected: all structural assertions pass and output ends with `trait-system: ok`.

---

### Task 3: Resonance engine and behavioral tests

**Files:**
- Modify: `sim.js:272-324`
- Modify: `sim.js:350-388`
- Modify: `sim.js:787-825`
- Modify: `sim.js:838-875`
- Modify: `sim.js:887-1010`
- Test: `tests/trait-system.test.js`

**Interfaces:**
- Produces: `g.traitPath`, `g.resonance`, `g.resonanceState`
- Produces: `SIM.resolveTraitResonance(g)` for direct deterministic testing.

- [ ] **Step 1: Add failing resonance tests**

```js
const SIM = require('../sim.js');
const same = SIM.createGame(0, ['w01', 'b01']);
assert.strictEqual(same.resonance, 'body');
const mixed = SIM.createGame(0, ['w01', 'w06']);
assert.strictEqual(mixed.resonance, null);
```

Use IDs matching the final ordered pool: the first five cards of each rarity are `body`, next five `dao`, then `fortune`, `tianxin`, and `imperial`.

- [ ] **Step 2: Run tests and verify RED**

Run: `node tests/trait-system.test.js`

Expected: failure because `resonance` is undefined.

- [ ] **Step 3: Aggregate new effects and determine resonance**

Initialize explicit state:

```js
g.resonance = null;
g.resonanceState = {
  bodyUsed: false, overflowDao: 0, eventUpgraded: false,
  tianxinPity: 0, imperialRetryUsed: false
};
```

Set `g.resonance` only when exactly two valid selected traits share the same `path`. Remove trait writes to `g.tm.brk` and `g.tm.cgt`.

- [ ] **Step 4: Implement one bounded hook per resonance**

- `body`: at level 71+, once per life, enough道蕴 permits a one-rank physique upgrade with a bounded probability.
- `dao`: when gains exceed cap, retain 25% of overflow up to 20% of cap; add it to `zhengdaoEff`.
- `fortune`: first successful tier 1–2 event uses one tier higher only for道蕴 reward.
- `tianxin`: at level 91+, increase `resonanceState.tianxinPity` each failed year and include it in the next roll.
- `imperial`: feed one retry into the existing `spendImperialRetry` path, then mark it used.

- [ ] **Step 5: Add deterministic tests for each hook**

Expose only the smallest pure helper needed for deterministic assertions. Stub `Math.random` inside `try/finally` and restore it after each test.

- [ ] **Step 6: Run tests**

Run: `node tests/trait-system.test.js`

Expected: structural and five resonance behavior sections pass.

---

### Task 4: Path badges and resonance preview

**Files:**
- Modify: `game.js:319-405`
- Modify: `game.js:432-443`
- Modify: `style.css:264-330`
- Test: `tests/trait-system.test.js`

**Interfaces:**
- Consumes: `DATA.TRAIT_PATHS[trait.path]`
- Produces: `.trait-path-badge`, `.trait-resonance-hint`, opening log resonance text.

- [ ] **Step 1: Add failing static UI assertions**

Read `game.js` as text and assert it references `TRAIT_PATHS`, `trait.path`, and `resonance`.

- [ ] **Step 2: Run tests and verify RED**

Run: `node tests/trait-system.test.js`

Expected: UI assertion fails because path badges are not rendered.

- [ ] **Step 3: Render path badge and preview**

Each option renders rarity, name, path icon/name, and effect description. Once one card is selected, cards sharing its path show the matching resonance name. Mixed-path cards remain selectable without warning styling.

- [ ] **Step 4: Add opening log**

After trait names, append exactly one resonance sentence when `G.resonance` is non-null.

- [ ] **Step 5: Style badges without changing layout width**

Use compact inline badges and existing rarity colors; use a distinct gold border only for an active resonance preview.

- [ ] **Step 6: Run tests**

Run: `node tests/trait-system.test.js`

Expected: all assertions pass.

---

### Task 5: Full static verification and balance smoke test

**Files:**
- Modify only if verification exposes an issue: `data.js`, `sim.js`, `game.js`, `style.css`, `tests/trait-system.test.js`

**Interfaces:**
- Produces: verified dependency-free static game.

- [ ] **Step 1: Check syntax**

Run:

```bash
node --check data.js
node --check events.js
node --check sim.js
node --check game.js
```

Expected: all commands exit 0 with no output.

- [ ] **Step 2: Run regression tests**

Run: `node tests/trait-system.test.js`

Expected: exit 0 and `trait-system: ok`.

- [ ] **Step 3: Scan for legacy trait language**

Run: `rg -n "初始实力|修行速度|修炼速度|实力成长|\\['(cult|brk|cgt)'" data.js game.js index.html`

Expected: no matches.

- [ ] **Step 4: Run simulation smoke batches**

For one same-path pair and one mixed-path pair from every path, simulate at least 200 games with the existing fast API. Assert every game terminates or ascends before the loop guard and no numeric state is `NaN`.

- [ ] **Step 5: Review diff against spec**

Confirm card counts, path counts, resonance limits, no direct top-physique guarantee, and no more than two imperial attempts.
