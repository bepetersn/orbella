# Worldle Lite

Worldle Lite is a lightweight, single-page geography guessing game. Each round zooms the map to one country, and your job is to name it before you run out of distinct misses.

## What Lives Where

- `worldle-lite.html` is the browser entrypoint and wires the page together.
- `src/config.js` holds shared copy, dimensions, timings, excluded country names, the GeoJSON source configuration, and the normalized metadata field mapping.
- `src/store/` keeps the shared game state engine and action/query API in small focused files, with `src/store/index.js` exposing `window.gameStore`.
- `src/theme.js` owns theme persistence and the light/dark toggle behavior.
- `src/audio.js` owns tone generation, win/loss cues, and vibration feedback.
- `src/map/worldMap.js` owns SVG setup, GeoJSON loading, and country map rendering.
- `src/map/geometry.js` owns continent-aware multipolygon trimming for regional map views.
- `tools/data/` owns preprocessing scripts that derive browser-ready data from the canonical GeoJSON source.
- `src/app/runtime.js` builds the shared runtime context, `src/app/input.js` handles autocomplete and input, `src/app/round/` contains round UI/transition/flow modules, and `src/app/bootstrap.js` starts the app.
- `styles.css` contains all visual styling for the game shell and states.
- `diagrams/` holds the architecture and round lifecycle diagrams.

## Features

- Country guessing with autocomplete suggestions
- Three distinct misses per round
- Wrong-guess feedback with map highlighting and a running miss list
- Optional reveal mode that leaves the round revealed until you start a new game
- Auto-advance toggle for solved rounds
- Light/dark mode toggle in the top-right corner
- Audio and vibration feedback for supported devices

## How to run

1. Open `worldle-lite.html` in a modern browser.
2. If your browser blocks loading the map data from a local file, serve the folder with a simple local web server instead.
3. The page loads a vendored local copy of D3 (`src/vendor/d3.v7.min.js`) and fetches country GeoJSON from the local `data/` folder, so a simple local web server is the easiest way to run it reliably.

### Example local server

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/worldle-lite.html`.

## Structure

- The app is intentionally static: no bundler, no build step, and no package install is required.
- `src/config.js`, `src/store/`, `src/theme.js`, `src/audio.js`, and `src/map/worldMap.js` are split out so the runtime modules stay focused on orchestration.
- Round rules now live in the store reducer/actions API under `src/store/` so round state is part of the same app state model.
- `src/app/runtime.js`, `src/app/input.js`, `src/app/round/`, and `src/app/bootstrap.js` coordinate the UI around the store and map API.

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

- The game uses a vendored Natural Earth-derived GeoJSON file at `data/world-countries.json`; preprocessing in `tools/data/` derives a browser-ready feature collection at `data/generated/world-countries.render.json`.
- The app only needs a small country model: one stable id, one canonical display name, optional aliases, one continent value, and an exclusion flag for non-playable features.
- `src/config.js` chooses `NAME_EN` as the canonical display field; `NAME_ALIASES` adds alternate guesses, while the raw Natural Earth metadata stays intact.
- `NAME_ALIASES` is for alternate guesses only; it should help matching without producing duplicate visible suggestions.
- `CONTINENT` becomes the app’s normalized continent fields, while the source ids (`ADM0_A3`, `ISO_A3`, `ISO_A2`, `WB_A2`, `WB_A3`, `ISO_N3`, `WIKIDATAID`) are preserved as metadata.
- The generated dataset keeps the raw geometry plus normalized lookup fields so the browser stays simple while the data shape remains reusable.
- Audio and vibration require browser support and user interaction before they will activate.
- Round state and transitions live in `src/store/`; `src/app/round/control.js` handles round flow, `src/app/round/ui.js` handles round UI rendering, and `src/map/worldMap.js` handles the map visuals and source-specific normalization.

## Architecture

- [Architecture diagram](diagrams/architecture.mmd)
- [Round lifecycle diagram](diagrams/round-lifecycle.mmd)

The architecture diagram shows the browser entrypoint, shared store, controller, and static assets. The round lifecycle diagram focuses on the hot path from guess submission to the end of a round.
