// src/main.js
//
// Single entry point for the Worldle Lite application.
// Import order must match the previous HTML script-tag sequence exactly.
// The sequence below reflects the actual order in worldle-lite.html.

// Vendor — d3 first
import './vendor/d3.v7.min.js';

// Config + constants
import './config.js';
import './constants.js';

// Theme + audio
import './theme.js';
import './audio.js';

// App settings (before map so continent selection is ready on globe init)
import './app/settings.js';

// Map geometry (before globe.gl — no vendor dependency)
import './map/geometry.js';

// Vendor — globe.gl; HTML places this mid-list, after geometry, before globe renderer
import './vendor/globe.gl.min.js';

import './map/globe-halo.js';
import './map/globe.js';

// Target selector
import './targetSelector.js';

// Store
import './store/index.js';

// App modules
import './app/timerManager.js';
import './app/debug.js';
import './app/autoAdvance.js';
import './app/input.js';

// Map public façade (depends on globe being initialized above)
import './map/index.js';

// Round
import './app/round/ui.js';
import './app/round/transitions.js';
import './app/round/control.js';
import './app/round/index.js';

// Entry
import { bootstrap } from './app/bootstrap.js';
bootstrap().catch((err) => {
  console.error('[worldle-lite] fatal initialization error', err);
});
