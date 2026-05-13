# Worldle Lite Test Suite

This file describes the current Vitest suite layout and the fixtures we
use to test Worldle Lite. For project-wide health, current counts, and
coverage numbers, see [docs/STATUS.md](../docs/STATUS.md).

## Current Snapshot

Verified on **May 13, 2026** with `npm test`:

- **349 tests** across **29 test files**
- **Vitest** runner with `jsdom`
- **Coverage target:** above 70% overall, with strong coverage in
  `src/store/`

Current per-scope totals:

| Scope | Files | Tests |
|---|---:|---:|
| Unit — store | 7 | 89 |
| Unit — app/round | 4 | 63 |
| Unit — map | 3 | 42 |
| Unit — config / theme / targeting / entry | 5 | 43 |
| Unit — app (other) | 7 | 46 |
| Integration | 2 | 21 |
| Pipeline | 1 | 45 |

## Directory Layout

```text
tests/
  fixtures/
    mock-countries.js
    mock-state.js
    runtime-builder.js
  integration/
    round-flows.test.js
    settings-and-persistence.test.js
  unit/
    app/
      audio.test.js
      autoAdvance.test.js
      bootstrap.test.js
      input.test.js
      loadCountries.test.js
      settings.test.js
      timerManager.test.js
      round/
        control.test.js
        index.test.js
        transitions.test.js
        ui.test.js
    map/
      constants.test.js
      geometry.test.js
      globe-centroid.test.js
    pipeline/
      generate-world-countries.test.js
    store/
      actions.test.js
      lookup.test.js
      normalize.test.js
      query.test.js
      reducer.test.js
      round-hints.test.js
      round.test.js
    config.test.js
    main.test.js
    phase1-exports.test.js
    targetSelector.test.js
    theme.test.js
```

## What Goes Where

- `tests/unit/store/`: pure state-engine coverage for reducer, actions,
  lookup, normalization, round flow, hints, and suggestions.
- `tests/unit/app/round/`: round orchestration, transitions, and UI
  rendering.
- `tests/unit/app/`: focused tests for non-round app modules such as
  `input`, `settings`, `autoAdvance`, and timers.
- `tests/unit/map/`: geometry helpers, map constants, and centroid
  calculations.
- `tests/unit/pipeline/`: Node-side preprocessing coverage for
  `pipeline/generate-world-countries.mjs`.
- `tests/integration/`: real multi-module flows using the store and app
  modules together.
- `tests/fixtures/`: shared mock data and runtime helpers.

## Running Tests

Run the full suite:

```bash
npm test
```

Run coverage:

```bash
npm run test:coverage
```

Open the Vitest UI:

```bash
npm run test:ui
```

Run a single file:

```bash
npm test -- tests/unit/store/query.test.js
npm test -- tests/integration/round-flows.test.js
```

Filter by test name:

```bash
npm test -- --grep "hint"
```

## Fixtures

### `runtime-builder.js`

`tests/fixtures/runtime-builder.js` is the most important fixture for
app-layer tests. Any test that touches a module reading
`window.worldleLiteRuntime` should call `buildRuntime(overrides?)` in a
`beforeEach` before importing the module under test.

```js
import { beforeEach, vi } from 'vitest';
import { buildRuntime } from '../fixtures/runtime-builder.js';

beforeEach(async () => {
  await buildRuntime({
    actions: {
      submitRoundGuess: vi.fn().mockReturnValue({ status: 'correct' }),
    },
  });
});
```

Do not write to `window.worldleLiteRuntime` directly in tests; use the
builder so the runtime shape stays consistent.

### `mock-countries.js`

Reusable country fixtures for lookup, normalization, query, and
round-resolution tests.

### `mock-state.js`

Canned state snapshots for reducer- and UI-adjacent tests that need a
known game state without building it from scratch.

## Common Patterns

### Pure store and utility tests

Import the module directly and assert on return values or store state.
These tests should not need DOM setup.

### App-layer tests with runtime reads

Use this flow:

1. `vi.resetModules()` in `beforeEach`
2. `await buildRuntime(...)`
3. dynamically `import()` the module under test

This keeps runtime-backed modules isolated between tests.

### Integration tests

Integration tests typically use real store modules, seed a small country
set, then exercise a full flow such as guessing, reveal, hints, or
settings persistence.

## Adding New Tests

- New store behavior goes in `tests/unit/store/`.
- New round controller or UI behavior goes in `tests/unit/app/round/`.
- New app helpers belong in `tests/unit/app/`.
- New map utilities belong in `tests/unit/map/`.
- Cross-module flows belong in `tests/integration/`.
- Pipeline transformations belong in `tests/unit/pipeline/`.

When you add or remove tests, update [docs/STATUS.md](../docs/STATUS.md)
so the suite counts and coverage snapshot stay in sync.
