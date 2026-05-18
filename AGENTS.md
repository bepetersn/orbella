# Worldle Lite — Agents Context

Worldle Lite is a single-page geography guessing game (Vite + Vitest,
vanilla ES modules, Globe.gl + D3). Each round zooms a 3D globe to a
highlighted country; the player names it before exhausting three
distinct misses.

**Read these before making changes:**
- [docs/AI-GUIDELINES.md](docs/AI-GUIDELINES.md) — canonical AI usage guide (roles, guardrails, workflows, prompt templates). See `.github/copilot-instructions.md` for project-specific architecture notes.
- IMPORTANT: create a `git worktree` before editing files

Before making any edits to this repository, create a dedicated `git worktree` branch and work inside it. Do not edit files directly in the main working tree. See `docs/AI-GUIDELINES.md` 'Local agent workflow' for an example and recommended commands.
- [docs/STATUS.md](docs/STATUS.md) — current test count, coverage
   numbers, recent work, and prioritised tech-debt backlog.
- [docs/reviews/code-review-2026-05-07.md](docs/reviews/code-review-2026-05-07.md)
   — detailed review notes on architecture problems.

---

## Critical constraints (do not violate)

1. **Do not add `window._gameStore` reads or writes.** This pattern is
   tracked as high-severity debt and must not spread. Store modules
   should import from each other directly.

2. **Do not reorder imports in `src/main.js`.** Every import is a
   side-effect import in a load-bearing order. Reordering silently
   breaks the app.

3. **Do not replicate the `window.worldleLiteRuntime` pattern** from
   `src/app/runtime.js`. It exists only to survive `vi.resetModules()`
   in tests — it is a known smell, not a convention.

4. **Always use `buildRuntime(overrides?)` from
   `tests/fixtures/runtime-builder.js`** in a `beforeEach` when writing
   tests for any module that reads `window.worldleLiteRuntime`. Do not
   write to it directly.

5. **Run `npm run format` before finishing.** Prettier is enforced:
   single quotes, trailing commas, semicolons, 2-space indent, 80-char
   print width.

---

## Architecture — four layers

```text
pipeline/     Node preprocessing only. Derives world-countries.render.json. Not bundled.
src/store/    Pure state engine (reducer, actions, query, round, normalize, lookup).
              No DOM, no map, no side effects. Assembled by store/index.js.
src/map/      Globe.gl setup (globe.js) + multipolygon trimming (geometry.js).
              Receives state in; no store writes.
src/app/      Orchestration. runtime.js, bootstrap.js, input.js, round/, settings,
              autoAdvance, timerManager.
src/config.js Single source of truth for copy, timings, field mappings. Import it;
              never hardcode config values.
```

---

## After making changes — update `docs/STATUS.md`

This is required, not optional:
- Prepend a bullet to **Recent Work** (keep to 3 items).
- Update test counts and coverage numbers if they changed.
- Remove resolved debt items; add new ones with severity.
- Update the **Last updated** date at the top.

---

## Commands

```bash
npm run dev            # Vite dev server (http://localhost:5173)
npm test               # Vitest — all 255 tests must still pass
npm run test:coverage  # Coverage report
npm run format         # Prettier write
npm run format:check   # Prettier check
```
