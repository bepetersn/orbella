# Worldle Lite

Worldle Lite is a lightweight, single-page geography guessing game. Each round zooms the map to one country, and your job is to name it before you run out of distinct misses.

## What Lives Where

- `worldle-lite.html` is the browser entrypoint and wires the page together.
- `src/config.js` holds shared copy, dimensions, timings, excluded country names, the GeoJSON source configuration, and the normalized metadata field mapping.
- `src/constants.js` defines shared constants used across modules.
- `src/store/` keeps the shared game state engine and action/query API in small focused files, with `src/store/index.js` exposing `window.gameStore`.
- `src/theme.js` owns theme persistence and the light/dark toggle behavior.
- `src/audio.js` owns tone generation, win/loss cues, and vibration feedback.
- `src/targetSelector.js` owns country selection logic for choosing the next target each round.
- `src/map/globe.js` owns the 3D globe setup, GeoJSON loading, and country map rendering.
- `src/map/globe-halo.js` owns the animated halo effect rendered around the target country.
- `src/map/geometry.js` owns continent-aware multipolygon trimming for regional map views.
- `src/map/animations.js` owns globe camera zoom and transition animations.
- `src/map/rendering.js` owns per-country polygon colour and state rendering helpers.
- `src/map/loader.js` owns GeoJSON fetch and parse logic.
- `src/map/state.js` owns globe-level render state (current target, wrong guesses, etc.).
- `src/map/utils.js` owns shared geo-math utilities (e.g. `lonLatTo3D`).
- `src/map/constants.js` defines continent bounding boxes and other map constants.
- `pipeline/` owns preprocessing scripts that derive browser-ready data from the canonical GeoJSON source.
- `src/app/runtime.js` builds the shared runtime context object used across app modules.
- `src/app/bootstrap.js` starts the app after all modules are loaded.
- `src/app/input.js` handles autocomplete and guess submission.
- `src/app/loadCountries.js` fetches and initialises the country dataset at startup.
- `src/app/bindings.js` wires DOM event listeners to runtime actions.
- `src/app/dom.js` provides typed references to key DOM elements.
- `src/app/logger.js` provides a thin structured-logging wrapper.
- `src/app/settings.js` reads and writes persistent user settings.
- `src/app/autoAdvance.js` manages the auto-advance countdown after a solved round.
- `src/app/timerManager.js` centralises timeout and interval lifecycle management.
- `src/app/debug.js` exposes in-browser debug helpers.
- `src/app/round/` contains round UI (`ui.js`), flow control (`control.js`), transitions (`transitions.js`), and the public round API (`index.js`).
- `styles.css` contains all visual styling for the game shell and states.
- `docs/diagrams/` holds the architecture and round lifecycle diagrams.

## Features

- Country guessing with autocomplete suggestions
- Three distinct misses per round
- Wrong-guess feedback with map highlighting and a running miss list
- Optional reveal mode that leaves the round revealed until you start a new game
- Auto-advance toggle for solved rounds
- Light/dark mode toggle in the top-right corner
- Audio and vibration feedback for supported devices

## How to run

1. Install dependencies with `npm install`.
2. Start the Vite development server with `npm run dev`.
3. Open the URL printed by Vite (typically `http://localhost:5173`) in a modern browser.

To build a production bundle run `npm run build`. The output lands in `dist/`.

To run the test suite:

```bash
npm test
```

## Automated checks

### Pre-commit (runs automatically on `git commit`)

The `husky` pre-commit hook (`.husky/pre-commit`) runs two steps and blocks the commit if either fails:

1. `npm run format:check` — verifies all source, test, and pipeline files are Prettier-formatted.
2. `npm test` — runs the full Vitest suite.

The hook is installed automatically when you run `npm install` (via the `prepare` script).

### Pre-build (runs automatically on `npm run build`)

The `prebuild` npm lifecycle script runs `npm run vendor:verify` before every production build. This checks the SHA-256 hashes of the vendored `d3` and `globe.gl` files in `src/vendor/` against known-good values and aborts the build if they have changed.

## Structure

- **Build tooling:** [Vite](https://vitejs.dev/) is the bundler and dev server (`vite.config.js`). `package.json` lists all runtime and development dependencies. Tests are run with [Vitest](https://vitest.dev/) (`vitest.config.js`).
- **Source:** `src/` contains all application source modules. `src/config.js`, `src/store/`, `src/theme.js`, `src/audio.js`, and `src/map/` are split out so the runtime modules stay focused on orchestration.
- **App entrypoint:** `worldle-lite.html` is the browser entrypoint; `src/main.js` is the JavaScript entrypoint consumed by Vite.
- **Round & store:** Round rules live in the store reducer/actions API under `src/store/` so round state is part of the same app state model. `src/app/runtime.js`, `src/app/input.js`, `src/app/round/`, and `src/app/bootstrap.js` coordinate the UI around the store and map API.
- **Data pipeline:** `pipeline/` holds preprocessing scripts that derive browser-ready data from the canonical GeoJSON source. Run these scripts separately before building if the generated data needs to be refreshed.
- **Tests:** `tests/` contains unit and integration tests executed via `npm test`.

## Controls

- Type a country name in the input field.
- Use the arrow keys to move through suggestions.
- Press Enter or click Guess to submit.
- Click Reveal to give up on the current round; the answer appears and the round stays revealed until you start a new game.
- Use Auto-advance to control whether solved rounds automatically move on to the next country.
- Click Next round to manually start the next country after a finished round.
- Click the light/dark mode toggle in the top right to switch themes.
- Click New game to restart the score and rounds.

## Notes

- The game uses a vendored Natural Earth-derived GeoJSON file at `pipeline/data/world-countries.json`; preprocessing in `pipeline/` derives a browser-ready feature collection at `pipeline/data/generated/world-countries.render.json`.
- The app only needs a small country model: one stable id, one canonical display name, optional aliases, one continent value, and an exclusion flag for non-playable features.
- `src/config.js` chooses `NAME_EN` as the canonical display field; `NAME_ALIASES` adds alternate guesses, while the raw Natural Earth metadata stays intact.
- `NAME_ALIASES` is for alternate guesses only; it should help matching without producing duplicate visible suggestions.
- `CONTINENT` becomes the app’s normalized continent fields, while the source ids (`ADM0_A3`, `ISO_A3`, `ISO_A2`, `WB_A2`, `WB_A3`, `ISO_N3`, `WIKIDATAID`) are preserved as metadata.
- The generated dataset keeps the raw geometry plus normalized lookup fields so the browser stays simple while the data shape remains reusable.
- Audio and vibration require browser support and user interaction before they will activate.
- Round state and transitions live in `src/store/`; `src/app/round/control.js` handles round flow, `src/app/round/ui.js` handles round UI rendering, and `src/map/globe.js` handles the 3D globe visuals and country rendering.

## Architecture

- [Architecture diagram](docs/diagrams/architecture.mmd)
- [Round lifecycle diagram](docs/diagrams/round-lifecycle.mmd)

The architecture diagram shows the browser entrypoint, shared store, controller, and static assets. The round lifecycle diagram focuses on the hot path from guess submission to the end of a round.

## Documentation

| File | Purpose |
|---|---|
| [docs/STATUS.md](docs/STATUS.md) | Current project health: test results, coverage, recent work, and prioritised tech-debt backlog. |
| [docs/reviews/code-review-2026-05-07.md](docs/reviews/code-review-2026-05-07.md) | Detailed code-review notes covering architecture problems, naming issues, and copy-paste archaeology. |
| [.github/copilot-instructions.md](.github/copilot-instructions.md) | AI-assistant instructions: layer map, known tech debt, code style, test conventions, and commands. |
| [tests/README.md](tests/README.md) | Test suite overview, fixture guide, patterns, and CI integration notes. |
| [pipeline/README.md](pipeline/README.md) | Data pipeline: how to regenerate the GeoJSON render file. |
