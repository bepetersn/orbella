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

All **255 tests pass** across **24 test files** as of the last run.

| Scope | Files | Tests |
|---|---|---|
| Unit — store | 5 | 27 |
| Unit — app/round | 4 | ~40 |
| Unit — map | 3 | 24 |
| Unit — config / theme / targeting | 4 | 36 |
| Integration | 2 | 16 |
| Pipeline | 1 | ~12 |

Coverage is **55.2% overall** — well below the >70% target. The top-level `src/` modules (config, constants, theme, targetSelector) and `src/app/round` (69.75%) are the best-covered areas. `src/store/` is the weakest layer at 27.91%, and `src/app` overall sits at 49%.

### Recent Work (last 3 commits)

- **AI-assisted dev setup:** Added `jsconfig.json` (`checkJs: true`) and `CLAUDE.md` (Claude Code context file) so both Copilot and Claude sessions have grounded project context; `jsconfig.json` covers all source, test, and pipeline files while excluding vendor and dist.
- **Prettier formatting pass:** Normalised code style across all test files (`store/`, `pipeline/`, `targetSelector`, `theme`) and `vite.config.js`. No logic changes — trailing commas, single quotes, arrow-function parens, and line-width wrapping brought into line with project style.
- **GeoJSON content-hash cache-busting:** `vite.config.js` now computes a short SHA-256 hash of `pipeline/data/generated/world-countries.render.json` at build time and exposes it as `__GEOJSON_HASH__`. Falls back to `__BUILD_ID__` when the pipeline hasn't run yet.

---

## Known Issues / Tech Debt

| # | Issue | Severity |
|---|---|---|
| 1 | `main.js` is still all side-effect imports in a load-bearing order. Multiple modules write globals (`window.gameConstants`, `window.worldMap`, `window.audioFeedback`, `window.themeSystem`, `window.targetSelector`, `window.worldleLiteSettings`) during import. This is the last remnant of the pre-Vite `<script>` tag architecture. | 🔥 High |
| 2 | `src/map/index.js` is almost certainly dead code. It defines a D3 SVG `createWorldMap` that is imported as a side effect in `main.js` (registering `window.worldMap`) but `createWorldMap` is never called anywhere in the codebase. The app uses `worldMapInst` (Globe.gl) exclusively. | 🔥 High |
| 3 | Coverage is **55.2% overall**, well below the >70% target. `src/store/` sits at 27.91% — `round.js` (11.3%), `query.js` (9.3%), and `lookup.js` (10.5%) have virtually no function-level coverage despite having test files. `src/app/round/ui.js` is at 41.5%. | 🔥 High |
| 4 | `tests/README.md` is severely outdated — it claims 91 tests (reality: 255) and marks the store modules as "✅ Complete" when their actual coverage is 10–28%. | Medium |
| 5 | `runtime.js` falls back to `window.worldleLiteRuntime` when `_runtime` is null so test-reset module state survives `vi.resetModules()`. This is a test-architecture smell — don't replicate. | Medium |
| 6 | `src/store/normalize.js` has a stale JSDoc on line 4 claiming it "Exposes `normalizeGuess` and `toLooseGuessKey` on `window._gameStore`" — it does no such thing; the `window._gameStore` bus has been removed from the code. | Low |
| 7 | Every function body in `src/app/debug.js` is indented two extra spaces at module scope, as if an outer wrapper was removed without re-indenting. | Low |

---

## Next Priorities

1. **Audit and delete `src/map/index.js`** — verify nothing calls `createWorldMap`, then remove the file and its import from `main.js`. This unblocks understanding the true module graph.
2. **Fix `main.js` side-effect imports** — convert to real named imports/exports now that `window._gameStore` is gone; the remaining window globals are the last barrier.
3. **Bring coverage up to the >70% target** — `src/store/round.js`, `src/store/query.js`, `src/store/lookup.js`, and `src/app/round/ui.js` are the highest-value gaps.
4. **Update `tests/README.md`** — correct the test count (255, not 91) and remove the false "✅ Complete" coverage claims.
5. **Fix `normalize.js` JSDoc** — remove the stale `window._gameStore` comment.
6. **Fix `debug.js` indentation.**
7. Consider Playwright E2E tests (scaffolded in `package.json` as `test:e2e` but not yet written).
