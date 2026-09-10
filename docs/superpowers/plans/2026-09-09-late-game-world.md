# Late-Game World Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Rebalance quasi-emperor progression, forbidden-zone sleep, traits, and replace instant Strange World resolution with an unknown event-driven route.

**Architecture:** Keep constants and card data in `data.js`; add deterministic pacing helpers and a Strange World state machine to `sim.js`; expose only pending strategic choices to `game.js` and `index.html`.

**Tech Stack:** Dependency-free ES5 JavaScript, static HTML/CSS, Node `assert`.

**Spec:** `docs/superpowers/specs/2026-09-09-late-game-world-design.md`

## Tasks

### Task 1: Regression contracts
- [ ] Add failing tests for per-layer quasi-emperor pacing and Chaos exception.
- [ ] Add failing tests for material-specific forbidden sleep ranges.
- [ ] Add failing tests proving entry copy contains no hidden opponent.
- [ ] Add failing tests for the second-to-eighth-life normal distribution, its Red Dust Immortal tail, and Wushi choice state.

### Task 2: Quasi-emperor pacing
- [ ] Add exported `quasiLayerMultiplier(g, lvl)`.
- [ ] Apply it to levels 91–98 without changing lower realms.
- [ ] Make `daoyunNeed` rise per quasi-emperor layer.
- [ ] Run regression tests.

### Task 3: Strange World state machine
- [ ] Replace instant battle in `enterStrangeWorld` with hidden situation initialization.
- [ ] Add epoch events, longevity insight, injury, discovery, cultivation and final transformation.
- [ ] Add the weighted second-to-eighth-life Undying Emperor state plus its rare Red Dust Immortal tail.
- [ ] Add Wushi alliance/hide resolver and final battle outcomes.
- [ ] Ensure fast simulations auto-select hide and always terminate.

### Task 4: UI secrecy and choice
- [ ] Remove opponent names and percentages from entry choice.
- [ ] Add Wushi encounter modal and bindings.
- [ ] Display Strange World years, insight and route.
- [ ] Update settlement copy to describe actual discovered outcome.

### Task 5: Forbidden sleep and cards
- [ ] Add exported material-specific sleep range helper.
- [ ] Apply cross-era sleep ranges without guaranteeing immortality.
- [ ] Raise sub-threshold card effects while preserving rarity ordering and five-path counts.
- [ ] Run structural tests and comparative smoke simulations.

### Task 6: Verification
- [ ] Run all syntax checks and Node tests.
- [ ] Run at least 2,000 mortal-path simulations and 1,000 Strange World simulations.
- [ ] Scan entry UI for spoilers.
- [ ] Review the complete diff for state-machine deadlocks and unbounded retries.
