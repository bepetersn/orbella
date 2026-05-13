# Project Status — Worldle Lite

*Last updated: May 13, 2026 (bootstrap import-order cleanup + test refresh)*

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

All **335 tests pass** across **26 test files** as of the last run.

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

- **Bootstrap/import-order cleanup finished:** `src/main.js` now acts as a true entrypoint that calls `bootstrap()`, the old side-effect import chain is gone, and the remaining app-owned import-time globals (`audioFeedback`, `themeSystem`, `targetSelector`, `worldleLiteSettings`) were removed in favor of direct module imports.
- **Bootstrap coverage improved and shim assertions removed:** Added focused unit coverage for `bootstrap.js`, `loadCountries.js`, and `main.js`, and deleted obsolete shim assertions from audio/theme/target-selector/settings/auto-advance/round-control tests so the suite matches the current runtime architecture.
- **Removed dead D3 map facade:** Deleted unused `src/map/index.js` and removed its side-effect import from `main.js`; the app now relies exclusively on the Globe.gl-backed `worldMapInst` path.
- **Fixed stale JSDoc in `normalize.js`:** Replaced the comment claiming the module exposes functions on `window._gameStore` with an accurate description of its named exports.
- **Fixed `loadCountries.js` parameter mutation:** `loadAndInitCountries` now returns `worldMapInst` instead of writing to `runtime`; `bootstrap.js` assigns the return value and calls `installDebugHelpers` after assignment.
- **Code review 2 fixes applied:**** Fixed the `solvedCountriesByRegion`/`celebratedRegions` new-game bug in `control.js`; replaced `debug.js`'s private `getRuntime()` with a proper import; removed the duplicate `syncDebugToggleUi` call in `bindings.js`; replaced `globe.js` fallback color constants with a direct `gameConstants` import and removed the `window.gameConstants` global shim from `constants.js`; deleted the `d3.json` fetch path from `loadCountries.js`; removed self-registration shims from `ui.js` and `input.js`; test count dropped to 335 (2 shim-testing tests deleted).
- **Second code review written:** Produced `docs/reviews/code-review-2026-05-12.md`; identified new issues including module-level unresettable state in `control.js`, `debug.js` bypassing `getRuntime()`, double `syncDebugToggleUi` call in `bindings.js`, color-palette duplication between `globe.js` and `constants.js`, import-time self-registration shims in `ui.js`/`input.js`, and parameter mutation in `loadCountries.js`.
- **Coverage milestone:** Overall coverage crossed the >70% target at **75.38%**; `src/store/` reached 93.22%, `src/map/geometry.js` reached 91.56%, and `src/store/actions.js` reached 96.84%; test count grew to 337 across 26 files.

---

## Known Issues / Tech Debt

| # | Issue | Severity |
|---|---|---|
| 1 | Coverage is **75.38% overall** — above the >70% target. `src/store/` is at 93.22%, `src/map/geometry.js` is at 91.56%. Remaining gaps: `src/app/round/ui.js` (41.51%), `src/app/input.js` (40.3%), `src/app/debug.js` (13.89%). | Low |
| 2 | `runtime.js` falls back to `window.worldleLiteRuntime` when `_runtime` is null so test-reset module state survives `vi.resetModules()`. This is a test-architecture smell — don't replicate. | Medium |
| 3 | `src/map/globe.js` and `src/map/globe-halo.js` have severe cyclomatic complexity — `createWorldleGlobe` (CC=77), `createHaloManager` (CC=60), `createRuntimeStubTop` (CC=37). See recommendations below. | 🔥 High |


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
2. **Continue pushing coverage higher** — `src/app/round/ui.js` (41.51%), `src/app/input.js` (40.3%), and `src/app/debug.js` (13.89%) are the remaining meaningful gaps now that the >70% target is met.
3. **Update `tests/README.md`** — correct the test count (255, not 91) and remove the false "✅ Complete" coverage claims.
4. **Fix `debug.js` indentation.**
5. Consider Playwright E2E tests (scaffolded in `package.json` as `test:e2e` but not yet written).
