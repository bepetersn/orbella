/**
 * @fileoverview Application entrypoint.
 *
 * IMPORTANT: The module import order for side-effectful modules is load-bearing
 * in this project. Many modules rely on preserved side-effects at import time
 * (mutating window globals or attaching runtime hooks). Do NOT reorder,
 * add, or remove side-effect imports in this file without verifying the full
 * dependency chain and consulting the tech-debt notes in
 * .github/copilot-instructions.md. Incorrect import order can break the app
 * at startup in subtle ways.
 *
 * Typical preserved import order (for reference):
 *
 *   d3 → config → constants → theme → audio → settings → map/geometry
 *     → globe.gl (vendor) → globe-halo → globe → targetSelector
 *     → store/index → timerManager → debug → autoAdvance → input → round/index → bootstrap
 */
import { bootstrap } from './app/bootstrap.js';

bootstrap().catch((err) => {
  console.error('[worldle-lite] fatal initialization error', err);
});
