# Project Status — Orbella

*Last updated: May 21, 2026*


---

## What It Is

Orbella is a single-page geography guessing game. Each round zooms a 3D globe to a highlighted country; the player names it before exhausting three distinct misses. Features include autocomplete suggestions, wrong-guess map highlighting, optional reveal mode, auto-advance, light/dark theme, and audio/vibration feedback.

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

All **389 tests pass** across **33 test files** as of the last run.

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
- **Fix corrupted unit test and restore test suite:** Repair `tests/unit/app/debug.test.js` so the Vitest suite runs green. (May 21, 2026)
- **Rename globe API & logger to Orbella:** Export `createOrbellaGlobe`, add `createWorldleGlobe` alias, introduce `orbellaLogger` with backwards-compatible aliases, and update tests accordingly. (May 21, 2026)
- **Conservative rename to Orbella:** Add `orbella-*` storage keys with legacy fallbacks, add orbella-prefixed window aliases and export aliases, and update tests and ambient types. (May 21, 2026)

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

## After making changes — update `docs/STATUS.md`

This is required, not optional:
- Prepend a bullet to **Recent Work** (keep to 3 items).
- Update test counts and coverage numbers if they changed.
- Remove resolved debt items; add new ones with severity.
- Update the **Last updated** date at the top.

### When to update `docs/STATUS.md` (formalized)

If you (human or AI) change code, tests, or docs, update these fields before merging:

- **Last updated:** today's date (top of file)
- **Recent Work:** prepend one sentence per logical change (keep to 3 most recent)
- **Tests:** total test count and per-scope table (update counts if tests added/removed)
- **Coverage:** overall percentage and per-module breakdown when coverage changes
- **Known Issues / Tech Debt:** remove or add items with a short severity note
- **Next Priorities:** adjust ordering if priorities shift due to the change

Example Recent Work sentence:

 - Add `docs/AI-GUIDELINES.md` consolidating AI usage rules and PR checklist. (May 17, 2026)
