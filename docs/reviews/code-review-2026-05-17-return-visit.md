Return-visit — Team Lead (angry) Code Review — 2026-05-17

Summary
- Recent commits reviewed: default Vite `base` set to `/orbella/` (build change); `docs/STATUS.md` updated to reflect recent work.
- Quick verdict: acceptable short-term changes, but the same fragile architectural cruft remains and is actively risking regressions. This is a return visit; I'm not pleased.

Findings
- Import-order fragility: `src/main.js` remains load-order sensitive. DO NOT reorder side-effect imports — doing so breaks the app. Severity: High.
- Makeshift globals: `window._gameStore` and `window.worldleLiteRuntime` patterns persist. These are test/workaround smells; do not expand them. Severity: High (for `_gameStore`) / Medium (for runtime persistence).
- Map-layer coverage: `src/map/` coverage remains low; `globe.js` and `globe-halo.js` are particularly under-tested. This keeps the map orchestration brittle and expensive to change. Severity: Medium.
- `src/app/debug.js` indentation still wrong (cosmetic but noisy). Severity: Low.
- Integration flakiness observed: `npm run test:integration` previously failed (exit code 1) while `npm test` passed in later runs — investigate intermittent integration failures. Severity: Medium.
- Vendor/build change note: setting Vite `base` to `/orbella/` is fine, but ensure `GH_PAGES_BASE` override path and `vendor:verify` step remain robust in CI. Severity: Low.

Action Items (concrete, short, assigned to maintainers)
1) (Owner: Core) Do not reorder `src/main.js` imports. Add a comment block at top documenting the required order and why. Severity: High. ETA: immediate.
2) (Owner: Store) Plan and schedule a remove-`window._gameStore` refactor. Create a small spike branch that replaces the registry with direct ES imports and `store/index.js` assembly. Don't spread new global reads/writes. Severity: High. ETA: next sprint.
3) (Owner: Tests) Investigate integration test flakiness: collect CI logs, reproduce locally with `vi.resetModules()` patterns, and harden fixtures. Add a failing-test reproducer and a CI gating check. Severity: Medium. ETA: 48–72h.
4) (Owner: Map) Raise `src/map/` coverage by extracting seamable orchestration functions from `globe.js` and `globe-halo.js`, then add unit tests targeting those seams. Focus on `lonLat` math and camera transition helpers first. Severity: Medium. ETA: 2 sprints.
5) (Owner: Docs) Add an explicit note in `.github/copilot-instructions.md` near the tech-debt table reminding contributors: "Do not add `window._gameStore` reads/writes." Severity: Low. ETA: next PR.
6) (Owner: DevOps) Confirm `vendor:verify` still runs on prebuild and that `GH_PAGES_BASE` override is documented in README and CI. Severity: Low. ETA: ASAP.
7) (Owner: Code-style) Fix `src/app/debug.js` indentation formatting with Prettier and run `npm run format:check`. Severity: Low. ETA: immediate.

Notes
- `docs/STATUS.md` was updated; good — keep the Recent Work list short and accurate. Remember to update coverage numbers if the map coverage plan changes them.
- This is not a nitpick-only pass. The persistent global and import-order patterns are the root risks — fix them before adding features.

Signed,
Team Lead (frustrated but pragmatic)

