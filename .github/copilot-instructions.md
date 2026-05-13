# GitHub Copilot Instructions — Worldle Lite

Worldle Lite is a single-page geography guessing game (Vite + Vitest, vanilla ES modules, Globe.gl + D3). Each round zooms a 3D globe to a highlighted country; the player names it before exhausting three distinct misses.

**Key documentation:**
- [README.md](../README.md) — project overview, features, how to run, module map.
- [docs/STATUS.md](../docs/STATUS.md) — current test results, coverage numbers, recent work, and the prioritised tech-debt backlog.
---

## ⚠️ Always update `docs/STATUS.md` after making changes

After completing any task that affects the codebase, **you must update [docs/STATUS.md](../docs/STATUS.md)**. This is not optional. Specifically:

- **Tests:** If you add, remove, or fix tests, update the test count and per-scope table.
- **Coverage:** If coverage numbers change, update the overall percentage and the per-module breakdown.
- **Recent Work:** Prepend a bullet to the "Recent Work" section describing what was just done (one concise sentence per logical change). Keep the section to the 3 most recent items.
- **Known Issues / Tech Debt:** If you fix an item in the debt table, remove it. If you introduce new debt or discover an existing issue, add it with an appropriate severity.
- **Next Priorities:** Re-order or revise the list to reflect the current state after your changes.
- **Last updated date:** Update the date at the top of the file to today's date.

---

## Architecture — four layers

```
pipeline/          Preprocessing scripts only (Node). Derives world-countries.render.json
                   from the canonical Natural Earth GeoJSON. Run separately; not bundled.

src/store/         Pure state engine. reducer.js, actions.js, query.js, round.js, normalize.js,
                   lookup.js — all assembled by store/index.js which exposes window.gameStore.
                   No DOM, no map, no side effects beyond the store.

src/map/           Globe and geometry layer. globe.js owns Globe.gl setup and country rendering.
                   geometry.js owns multipolygon trimming. No store writes; receives state in.

src/app/           Orchestration layer. runtime.js assembles the shared runtime object.
                   bootstrap.js starts the app. round/ contains round UI/transition/flow.
                   input.js owns autocomplete. settings.js, autoAdvance.js, timerManager.js
                   are focused helpers.

src/config.js      Single source of truth for copy, dimensions, timings, field mappings,
                   and excluded country names. Import this; never hardcode config values.
```

Cross-cutting: `src/theme.js` (light/dark), `src/audio.js` (tone + vibration), `src/targetSelector.js` (country picking), `src/constants.js` (shared constants).

---

## ⚠️ Known tech debt — do not make these worse

### 1. `window._gameStore` — the makeshift module registry (🔥 High)

`src/store/constants.js` seeds `window._gameStore = window._gameStore || {}` and every store module reads/writes it at import time. This is a workaround that predates the current Vite setup. **Do not add new `window._gameStore` reads or writes.** The correct fix (tracked) is to refactor store modules to import from each other directly via ES `import` and let `store/index.js` assemble the public API from named imports.

### 2. `src/main.js` — import order is load-bearing (🔥 High)

Every import in `main.js` is a side-effect import in a specific, preserved order:

```
d3 → config → constants → theme → audio → settings → map/geometry
  → globe.gl (vendor) → globe-halo → globe → targetSelector
  → store/index → timerManager → debug → autoAdvance → input → round/index → bootstrap
```

**Do not reorder, add, or remove imports in `main.js` without understanding the full dependency chain.** Because modules mutate `window` globals at import time, load order is significant. The correct fix (tracked) is to replace side-effect imports with named imports/exports once the `window._gameStore` bus is removed.

### 3. `src/app/runtime.js` persists state on `window` to survive `vi.resetModules()` (Medium)

The runtime singleton is backed by `window.worldleLiteRuntime` so it survives Vitest's module reset between tests. This is a test-architecture smell, not a feature. Don't replicate this pattern elsewhere.

### 4. `docs/diagrams/architecture.mmd` and `README.md` reference `worldMap.js` (Medium)

Both `docs/diagrams/architecture.mmd` and the "Notes" section of `README.md` reference `src/map/worldMap.js`, which no longer exists. The actual module is `src/map/globe.js`. Do not add new references to `worldMap.js` anywhere.

### 5. `src/app/debug.js` — extra indentation at module scope (Low)

Every function body in `debug.js` is indented two extra spaces at the module level, as if an outer wrapper was removed without re-indenting. This is cosmetic but makes the file confusing to read.

---

## Code style

Formatting is enforced by **Prettier**. Run `npm run format` before committing. Key settings:

- **Single quotes** (`'`) everywhere — no double quotes in JS.
- **Trailing commas** on multi-line arrays, objects, and parameter lists.
- **Arrow-function parens:** always (`(x) => x`, not `x => x`).
- **Print width:** 80 characters; wrap long lines.
- **Semicolons:** yes.
- **Tab width:** 2 spaces.

To check without writing: `npm run format:check`.

---

## Tests

**Runner:** Vitest (`npm test`). All 255 tests across 24 files must pass.

```
tests/
  unit/
    store/          Pure reducer/action/query logic — no DOM, no window globals needed.
    app/round/      Round control, UI, and transition logic.
    map/            Geometry helpers and globe utilities.
    config/         Config shape assertions.
  integration/      Multi-module flows (round-flows, settings-and-persistence).
  pipeline/         generate-world-countries pipeline script tests.
  fixtures/
    mock-countries.js    Minimal country array for unit tests.
    mock-state.js        Canned store state snapshots.
    runtime-builder.js   Factory for window.worldleLiteRuntime (see below).
```

### `runtime-builder.js` — the most important fixture

Call `buildRuntime(overrides?)` in a `beforeEach` to install a fully-stubbed `window.worldleLiteRuntime` before loading any module that reads from it. Every slot is pre-populated with a `vi.fn()` stub so tests never hit "cannot read property of undefined". Pass an overrides object to shallow-merge specific keys:

```js
import { buildRuntime } from '../../fixtures/runtime-builder.js';

beforeEach(() => {
  buildRuntime({
    actions: { submitRoundGuess: vi.fn().mockReturnValue({ correct: true }) },
  });
});
```

Do not bypass `buildRuntime` by writing to `window.worldleLiteRuntime` directly in individual tests — the factory keeps the shape consistent.

### Writing new tests

- Store logic → `tests/unit/store/`. Import from `src/store/` directly; no DOM setup needed.
- App/round logic → `tests/unit/app/round/`. Use `buildRuntime()` + `vi.resetModules()` pattern already established in those files.
- New integration scenarios → `tests/integration/`. These tests import real modules and exercise multi-step flows.
- Coverage target: >70% for `src/store/` and `src/app/round/`.

---

## Data pipeline

`pipeline/generate-world-countries.mjs` reads `pipeline/data/world-countries.json` (Natural Earth GeoJSON) and writes `pipeline/data/generated/world-countries.render.json`. Run it manually when the source data changes — it is not part of the Vite build. The browser fetches the generated file; a SHA-256 content hash exposed as `__GEOJSON_HASH__` at build time drives cache-busting.

Normalized country fields the app cares about: `NAME_EN` (display name), `NAME_ALIASES` (alternate guesses, never shown in UI), `CONTINENT`, `ADM0_A3` / `ISO_A3` / `ISO_A2` (stable ids), plus raw GeoJSON geometry. Do not add new fields to the render shape without updating `src/config.js` and the pipeline tests.

---

## Commands

```bash
npm run dev            # Vite dev server (http://localhost:5173)
npm run build          # Production bundle → dist/
npm test               # Vitest (all unit + integration)
npm run test:coverage  # Coverage report
npm run format         # Prettier write
npm run format:check   # Prettier check (CI)
npm run vendor:verify  # Verify vendored d3 / globe.gl hashes
```
