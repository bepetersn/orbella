# Project Status — Worldle Lite

*Last updated: May 12, 2026*

---

## What It Is

Worldle Lite is a single-page geography guessing game. Each round zooms a 3D globe to a highlighted country; the player names it before exhausting three distinct misses. Features include autocomplete suggestions, wrong-guess map highlighting, optional reveal mode, auto-advance, light/dark theme, and audio/vibration feedback.

**Stack:** Vite (bundler + dev server), Vitest (test runner), Globe.gl + D3 (map rendering), vanilla JS ES modules.

**Related docs:**
- [README.md](../README.md) — project overview, features, module map, and how to run.
- [reviews/code-review-2026-05-07.md](reviews/code-review-2026-05-07.md) — detailed code-review notes on architecture problems.
- [.github/copilot-instructions.md](../.github/copilot-instructions.md) — AI-assistant context: layer map, tech-debt rules, code style, test conventions.
- [tests/README.md](../tests/README.md) — test suite structure and fixture guide.
- [diagrams/architecture.mmd](diagrams/architecture.mmd) · [diagrams/round-lifecycle.mmd](diagrams/round-lifecycle.mmd)

---

## Current State

### Tests

All **337 tests pass** across **26 test files** as of the last run.

| Scope | Files | Tests |
|---|---|---|
| Unit — store | 7 | ~80 |
| Unit — app/round | 4 | ~40 |
| Unit — map | 3 | ~27 |
| Unit — config / theme / targeting / phase1 | 4 | ~36 |
| Unit — app (other) | 5 | ~75 |
| Integration | 2 | 16 |
| Pipeline | 1 | ~12 |

Coverage is **75.38% overall** — above the >70% target. `src/store/` sits at **93.22%** and `src/map/` at **91.89%**. `src/app/round` is at 69.75%. `src/app` overall is at 49%, held down by `debug.js` (13.89%) and `ui.js` (41.51%).

### Recent Work (last 3 commits)

- **README.md module map updated:** Expanded the "What Lives Where" section to list all current source modules (`globe-halo.js`, `animations.js`, `rendering.js`, `loader.js`, `state.js`, `utils.js`, `map/constants.js`, `loadCountries.js`, `bindings.js`, `dom.js`, `logger.js`, `constants.js`, `targetSelector.js`); removed the collapsed multi-module line for `src/app/`.
- **Coverage milestone:** Overall coverage crossed the >70% target at **75.38%**; `src/store/` reached 93.22%, `src/map/geometry.js` reached 91.56%, and `src/store/actions.js` reached 96.84%; test count grew to 337 across 26 files.
- **Cyclomatic complexity audit:** Measured CC for all `src/` modules using acorn; identified `createWorldleGlobe` (CC=77) and `createHaloManager` (CC=60) as critical; documented targeted per-function refactor recommendations in STATUS.md.
- **D3 usage audit:** D3 is needed only for geo-math (`geoCentroid`, `geoArea`, `geoDistance` in `geometry.js`) and zoom helpers (`zoomIdentity`, `zoomTransform`, `easeCircleOut` in `animations.js`); the two `d3.json()` fetch calls could be replaced with plain `fetch()`; all `d3.select*` / projection usage lives in the dead `src/map/index.js` and would disappear with it.
- **Store coverage boost:** Added four new test files (`reducer`, `lookup`, `round`, `query`) that import and exercise the real store modules; overall coverage rose from 55.2% → 67.61% and `src/store/` rose from 27.91% → 79.58% (308 tests, 28 files).
- **AI-assisted dev setup:** Added `jsconfig.json` (`checkJs: true`) and `CLAUDE.md` (Claude Code context file) so both Copilot and Claude sessions have grounded project context; `jsconfig.json` covers all source, test, and pipeline files while excluding vendor and dist.
- **Prettier formatting pass:** Normalised code style across all test files (`store/`, `pipeline/`, `targetSelector`, `theme`) and `vite.config.js`. No logic changes — trailing commas, single quotes, arrow-function parens, and line-width wrapping brought into line with project style.

---

## Known Issues / Tech Debt

| # | Issue | Severity |
|---|---|---|
| 1 | `main.js` is still all side-effect imports in a load-bearing order. Multiple modules write globals (`window.gameConstants`, `window.worldMap`, `window.audioFeedback`, `window.themeSystem`, `window.targetSelector`, `window.worldleLiteSettings`) during import. This is the last remnant of the pre-Vite `<script>` tag architecture. | 🔥 High |
| 2 | `src/map/index.js` is almost certainly dead code. It defines a D3 SVG `createWorldMap` that is imported as a side effect in `main.js` (registering `window.worldMap`) but `createWorldMap` is never called anywhere in the codebase. The app uses `worldMapInst` (Globe.gl) exclusively. | 🔥 High |
| 3 | Coverage is **75.38% overall** — above the >70% target. `src/store/` is at 93.22%, `src/map/geometry.js` is at 91.56%. Remaining gaps: `src/app/round/ui.js` (41.51%), `src/app/input.js` (40.3%), `src/app/debug.js` (13.89%). | Low |
| 4 | `tests/README.md` is severely outdated — it claims 91 tests (reality: 337) and marks the store modules as "✅ Complete" with stale coverage numbers. | Medium |
| 5 | `runtime.js` falls back to `window.worldleLiteRuntime` when `_runtime` is null so test-reset module state survives `vi.resetModules()`. This is a test-architecture smell — don't replicate. | Medium |
| 6 | `src/store/normalize.js` has a stale JSDoc on line 4 claiming it "Exposes `normalizeGuess` and `toLooseGuessKey` on `window._gameStore`" — it does no such thing; the `window._gameStore` bus has been removed from the code. | Low |
| 7 | Every function body in `src/app/debug.js` is indented two extra spaces at module scope, as if an outer wrapper was removed without re-indenting. | Low |
| 8 | `src/map/globe.js` and `src/map/globe-halo.js` have severe cyclomatic complexity — `createWorldleGlobe` (CC=77), `createHaloManager` (CC=60), `createRuntimeStubTop` (CC=37). See recommendations below. | 🔥 High |

---

## Cyclomatic Complexity — Worst Offenders and Recommended Fixes

Measured with a custom acorn-based pass (May 12, 2026). The top 10 functions by CC, all in the map layer:

| CC | File | Function | Fix |
|---|---|---|---|
| 77 | `src/map/globe.js:633` | `createWorldleGlobe` | See below |
| 60 | `src/map/globe-halo.js:71` | `createHaloManager` | See below |
| 37 | `src/map/globe.js:340` | `createRuntimeStubTop` | See below |
| 29 | `src/map/globe.js:135` | `createDebugPanelTop` | Extract `updateDebug` RAF callback to a named top-level function `runDebugRaf(globe, dbgText)` |
| 25 | `src/map/globe.js:254` | `getCountryCentroidTop` | Split into `_centroidFromProperties(p)` and `_centroidFromGeometry(geometry)` helpers |
| 20 | `src/app/loadCountries.js:18` | `loadAndInitCountries` | Extract error-handling branches into named helpers |
| 20 | `src/map/globe-halo.js:17` | `resolveCentroid` | Already top-level; split `_centroidFromGeometry` out as a shared utility in `src/map/utils.js` |
| 19 | `src/map/globe-halo.js:171` | `project3DToScreen` | See below (fix for `createHaloManager`) |
| 19 | `src/map/globe.js:679` | `_applyGlobeExclusions` | See below (fix for `createWorldleGlobe`) |
| 16 | `src/store/query.js:218` | `getSuggestedCountryNames` | Extract scoring pipeline into `_rankCandidates(candidates, query, filter)` |

### `createWorldleGlobe` (CC 77 → target ≤25)

The function body is itself simple orchestration, but it captures two complex nested functions in its closure:

1. **Extract `_applyGlobeExclusions` to top level** (CC=19). It only reads `excludedBounds` from the closure — change signature to `applyGlobeExclusionsTop(feature, excludedBounds)` and call it with `window.gameConfig?.COUNTRY_EXCLUDED_POLYGON_BOUNDS` at the call site. This follows the `*Top` convention already established in the file.
2. **Extract `buildProcessedFeatures` to top level** (CC=13). It only reads `renderFeatures` from closure — change signature to `buildProcessedFeaturesTop(renderFeatures, flipped)` and pass `renderFeatures` explicitly. The `window.worldleFlipLon` callback in `setLonFlip` can be updated to call the new signature directly.

After both extractions the remaining `createWorldleGlobe` body is linear orchestration that should fall below CC=25.

### `createRuntimeStubTop` (CC 37 → target ≤15)

Contains an inline `markTarget` implementation (CC=15) that is more complex than the `applyPolygonStateTop` shorthand used for `markSolved`/`markWrong`. It re-finds the feature, clears all targets, sets the new one, refreshes `polygonsData`, and then re-resolves the centroid for camera pan. Extract this to `markTargetTop(globe, country, { log, warn })`, mirroring the other `*Top` helpers at the top of the file.

### `createHaloManager` (CC 60 → target ≤20)

The factory captures several self-contained algorithms in its closure. Three targeted extractions bring the factory back to orchestration:

1. **Extract `project3DToScreen` to top level** (CC=19). It only needs `globe`, `camera`, `renderer`, and `canvas` — all passable as params. Signature: `projectToScreen(globe, canvas, pos3d)`.
2. **Extract `drawHaloFrame(ctx, halos, now, getEasing)` to top level** — pulls the per-frame draw loop (the largest chunk of the animation callback) out of `updateHalos`. The loop body is self-contained given the canvas context, the halos array, and the easing map.
3. **Move `lonLatTo3D` to `src/map/utils.js`** — it is a pure trigonometric function with no closure dependencies and is useful elsewhere (e.g. `getCountryCentroidTop`).

After these three extractions `createHaloManager` becomes a thin setup function (canvas init, event wiring, public API construction) with no deeply nested branching.

---

## Next Priorities

1. **Reduce map-layer cyclomatic complexity** — extract `_applyGlobeExclusions`, `buildProcessedFeatures`, `markTargetTop` from their closures in `globe.js`, and `project3DToScreen` + `drawHaloFrame` from `globe-halo.js` (see above). This is a prerequisite for unit-testing the map layer.
2. **Audit and delete `src/map/index.js`** — verify nothing calls `createWorldMap`, then remove the file and its import from `main.js`. This unblocks understanding the true module graph.
3. **Fix `main.js` side-effect imports** — convert to real named imports/exports now that `window._gameStore` is gone; the remaining window globals are the last barrier.
4. **Continue pushing coverage higher** — `src/app/round/ui.js` (41.51%), `src/app/input.js` (40.3%), and `src/app/debug.js` (13.89%) are the remaining meaningful gaps now that the >70% target is met.
5. **Update `tests/README.md`** — correct the test count (255, not 91) and remove the false "✅ Complete" coverage claims.
6. **Fix `normalize.js` JSDoc** — remove the stale `window._gameStore` comment.
7. **Fix `debug.js` indentation.**
8. Consider Playwright E2E tests (scaffolded in `package.json` as `test:e2e` but not yet written).
