/**
 * @fileoverview Loads the country GeoJSON dataset, hydrates the store,
 * and initializes the globe renderer.
 */

import { gameConfig } from '../config.js';
import { createWorldleGlobe } from '../map/globe.js';
import { worldleLiteLogger as log } from './logger.js';

/**
 * @param {object} deps
 * @param {object} deps.config   - Resolved app config (includes COUNTRIES_GEOJSON_URL).
 * @param {object} deps.runtime  - Live runtime object (read-only; caller assigns the return value).
 * @param {object} deps._rt      - Raw runtimeOverride (used to resolve createWorldleGlobe).
 * @param {object|null} deps.startup - Optional startup logger.
 * @returns {Promise<object>} Resolves to the initialized worldMapInst (or a minimal stub).
 */
export async function loadAndInitCountries({ config, runtime, _rt, startup }) {
  const baseUrl =
    config.COUNTRIES_GEOJSON_URL ||
    gameConfig.COUNTRIES_GEOJSON_URL ||
    'pipeline/data/generated/world-countries.render.json';

  // Append BUILD_ID so the browser re-fetches only when data is regenerated.
  // BUILD_ID is injected at build time; falls back to empty string (no cache-bust)
  // in local dev where the data file is served directly.
  const cacheBust = runtime.BUILD_ID ? `v=${encodeURIComponent(runtime.BUILD_ID)}` : null;
  const url = cacheBust ? baseUrl + (baseUrl.includes('?') ? '&' : '?') + cacheBust : baseUrl;
  startup?.step('loading countries dataset', { url, cacheBust: cacheBust ?? 'none' });
  try {
    const data = await fetch(url).then((r) => r.json());
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

    let resolvedMapInst = null;
    const globeInit = _rt.createWorldleGlobe ?? createWorldleGlobe;
    if (typeof globeInit === 'function') {
      try {
        startup?.step('initializing globe renderer');
        const worldMapInst = globeInit(data);
        if (worldMapInst) {
          resolvedMapInst = worldMapInst;
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
    if (!resolvedMapInst) {
      resolvedMapInst = {
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
    return resolvedMapInst;
  } catch (err) {
    startup?.error('countries dataset failed to load', {
      url,
      message: err?.message || String(err),
    });
    console.error('[bootstrap] failed to load countries GeoJSON:', err);
    throw err;
  }
}
