/**
 * @fileoverview Loads the country GeoJSON dataset, hydrates the store,
 * initializes the globe renderer, and starts the first round.
 */

import { round } from './round/index.js';
import { createWorldleGlobe } from '../map/globe.js';
import { worldleLiteLogger as log } from './logger.js';
import { installDebugHelpers } from './debug.js';

/**
 * @param {object} deps
 * @param {object} deps.config   - Resolved app config (includes COUNTRIES_GEOJSON_URL).
 * @param {object} deps.runtime  - Live runtime object (mutated to attach worldMapInst).
 * @param {object} deps._rt      - Raw runtimeOverride (used to resolve createWorldleGlobe).
 * @param {object|null} deps.startup - Optional startup logger.
 */
export async function loadAndInitCountries({ config, runtime, _rt, startup }) {
  const baseUrl =
    config.COUNTRIES_GEOJSON_URL ||
    window.gameConfig?.COUNTRIES_GEOJSON_URL ||
    'pipeline/data/generated/world-countries.render.json';

  // Append BUILD_ID so the browser re-fetches only when data is regenerated.
  // BUILD_ID is injected at build time; falls back to empty string (no cache-bust)
  // in local dev where the data file is served directly.
  const cacheBust = runtime.BUILD_ID ? `v=${encodeURIComponent(runtime.BUILD_ID)}` : null;
  const url = cacheBust ? baseUrl + (baseUrl.includes('?') ? '&' : '?') + cacheBust : baseUrl;
  startup?.step('loading countries dataset', { url, cacheBust: cacheBust ?? 'none' });
  try {
    const data = runtime.d3?.json
      ? await runtime.d3.json(url)
      : await fetch(url).then((r) => r.json());
    const features = Array.isArray(data?.features) ? data.features : [];
    startup?.step('countries dataset loaded', { url, features: features.length });
    const countryNames = features
      .map((f) => f.properties?.name)
      .filter(Boolean)
      .sort();
    const countryByName = new Map(
      features.map((f) => [String(f.properties?.name || '').toLowerCase(), f])
    );

    const loader = runtime.actions?.loadCountriesIntoState;
    if (typeof loader === 'function') {
      loader({ countriesData: features, countryNames, countryByName });
      startup?.step('country store hydrated', { countryNames: countryNames.length });
    } else {
      startup?.warn('country store loader unavailable');
    }

    // Populate continent filter UI if the input module is available.
    // Non-critical enhancement path: failures are logged but do not abort startup.
    try {
      runtime.input?.populateContinentFilter?.(features);
      startup?.step('continent filter populated');
    } catch (e) {
      startup?.warn('[bootstrap] populateContinentFilter failed — continuing', {
        message: e?.message || String(e),
      });
      log.warn('[bootstrap] populateContinentFilter failed', e);
    }

    const globeInit = _rt.createWorldleGlobe ?? createWorldleGlobe;
    if (typeof globeInit === 'function') {
      try {
        startup?.step('initializing globe renderer');
        const worldMapInst = globeInit(data);
        if (worldMapInst) {
          runtime.worldMapInst = worldMapInst;
          // Debug helpers must be installed after worldMapInst is set on runtime
          // so that getGlobe() can resolve runtime.worldMapInst.globe.
          try {
            installDebugHelpers();
          } catch (e) {
            log.warn('[bootstrap] installDebugHelpers failed', e);
          }
        }
        startup?.step('globe renderer initialized');
      } catch (e) {
        startup?.error('globe renderer initialization failed', {
          message: e?.message || String(e),
        });
        log.error('[bootstrap] createWorldleGlobe threw', e);
      }
    } else {
      startup?.warn('globe renderer unavailable');
      log.warn('[bootstrap] createWorldleGlobe not defined');
    }

    // Ensure a minimal worldMapInst stub exists so `startRound` can
    // safely call `runtime.worldMapInst.resetRoundState()` even if the
    // globe failed to initialize.
    if (!runtime.worldMapInst) {
      runtime.worldMapInst = {
        resetRoundState: () => {},
        markTarget: () => {},
        zoomToCountry: () => {},
        showLocationHalo: () => {},
        setRegionFilter: () => {},
        loadCountries: () =>
          Promise.resolve({ countriesData: features, countryNames, countryByName }),
      };
      startup?.warn('world map fallback stub installed');
    }

    round.startRound?.();
    startup?.step('first round started');
  } catch (err) {
    startup?.error('countries dataset failed to load', {
      url,
      message: err?.message || String(err),
    });
    console.error('[bootstrap] failed to load countries GeoJSON:', err);
    throw err;
  }
}
