/**
 * @fileoverview Application entrypoint.
 *
 * All runtime dependencies are wired through the ES module graph rooted at
 * `bootstrap()`. This file intentionally avoids side-effect-only imports so
 * startup no longer depends on a preserved script-tag order.
 */
import { bootstrap } from './app/bootstrap.js';

bootstrap().catch((err) => {
  console.error('[worldle-lite] fatal initialization error', err);
});
