# Project Status — Worldle Lite

*Last updated: May 17, 2026*


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

All **395 tests pass** across **33 test files** as of the last run.

| Scope | Files | Tests |
|---|---|---|
| Unit — store | 7 | 89 |
| Unit — app/round | 4 | 72 |
| Unit — map | 4 | 51 |
| Unit — config / theme / targeting / entry | 5 | 43 |
| Unit — app (other) | 8 | 57 |
| Integration | 4 | 25 |
| Pipeline | 1 | 45 |

Coverage is **75.72% overall**. `src/store/` sits at **93.23%**, `src/app/round` at **88.93%**, `src/app` overall at **87.51%**, and `src/map/` at **46.78%**. The biggest remaining map gaps are `globe.js` (**35.07%**) and `globe-halo.js` (**36.7%**), while the extracted shared helper in `src/map/utils.js` is **100%** covered.

### Recent Work (last 3 commits)
- **Set Vite base for GitHub Pages:** Set default `base` to `/orbella/` in `vite.config.js` (override with `GH_PAGES_BASE`), and documented the change. (May 17, 2026)
- **Add integration tests:** Added integration tests for `targetSelector` (persistence + recent-window behaviour) and `map/state` helpers. (May 17, 2026)
- **Prepared repository for GitHub Pages deployment:** Configured `vite.config.js` to build into `public/`, added `build:public` and `deploy:gh-pages` scripts and the `gh-pages` devDependency to `package.json`. (May 13, 2026)

---

## Known Issues / Tech Debt

| # | Issue | Severity |
|---|---|---|
| 1 | Coverage is **75.72% overall**, still above the >70% target, but `src/map/` is only **46.78%** because Globe.gl orchestration remains lightly exercised. The biggest gaps are `src/map/globe.js` (**35.07%**) and `src/map/globe-halo.js` (**36.7%**). | Medium |
| 2 | `src/app/debug.js` still has extra indentation at module scope, which makes the file harder to read than the rest of the app layer. | Low |

---

## Next Priorities

1. **Raise map-layer coverage** — build on the new helper seams in `src/map/globe.js`, `src/map/globe-halo.js`, and `src/map/utils.js` so the Globe.gl orchestration paths stop dominating the remaining uncovered lines.
2. **Fix `debug.js` indentation.**
3. Consider Playwright E2E tests (scaffolded in `package.json` as `test:e2e` but not yet written).
