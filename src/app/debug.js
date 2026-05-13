/**
 * @fileoverview Debug-mode lifecycle and browser debug helpers.
 *
 * Centralises debug state resolution, UI toggle wiring, and helper commands
 * exposed on `window` for map inspection/testing.
 */
import { worldleLiteLogger as log } from './logger.js';
log.debug('[debug] debug.js loaded');
let debugTooltipEl = null;
let debugHelpersInstalled = false;

function getRuntime() {
  return window.worldleLiteRuntime;
}

function getD3() {
  return getRuntime()?.d3 || null;
}

function getCountrySelection() {
  const d3 = getD3();
  return d3 ? d3.selectAll('#map .country') : null;
}

function getGlobe() {
  const runtime = getRuntime();
  return runtime?.globe || runtime?.worldMapInst?.globe || null;
}

function ensureTooltip() {
  if (debugTooltipEl && document.body.contains(debugTooltipEl)) {
    return debugTooltipEl;
  }

  debugTooltipEl = document.createElement('div');
  debugTooltipEl.className = 'debug-country-tooltip';
  debugTooltipEl.setAttribute('aria-hidden', 'true');
  document.body.appendChild(debugTooltipEl);
  return debugTooltipEl;
}

function moveTooltip(event) {
  if (!debugTooltipEl || !event) {
    return;
  }

  debugTooltipEl.style.left = `${event.clientX + 12}px`;
  debugTooltipEl.style.top = `${event.clientY + 12}px`;
}

function showTooltip(countryName, event) {
  const tooltip = ensureTooltip();
  tooltip.textContent = countryName;
  tooltip.classList.add('visible');
  moveTooltip(event);
}

function hideTooltip() {
  if (!debugTooltipEl) {
    return;
  }

  debugTooltipEl.classList.remove('visible');
}

function enableDebugHoverInspect() {
  const globe = getGlobe();
  const container = document.getElementById('globeViz');

  if (!globe || !container || typeof globe.onPolygonHover !== 'function') {
    console.warn(
      '[debug-hover] enableDebugHoverInspect: missing globe, container, or onPolygonHover method'
    );
    return;
  }

  // Store current country being hovered and last mouse position
  let currentHoveredCountry = null;
  let lastMouseEvent = null;

  globe.onPolygonHover((country) => {
    currentHoveredCountry = country;
    if (!country) {
      hideTooltip();
    } else {
      showTooltip(country?.properties?.name ?? '', lastMouseEvent);
    }
  });

  // Track tooltip position with mousemove on the globe container
  const handleMouseMove = (event) => {
    lastMouseEvent = event;
    if (currentHoveredCountry) {
      moveTooltip(event);
    }
  };

  container.addEventListener('mousemove', handleMouseMove);
  // Store reference so we can remove it later
  container._debugHoverMouseMoveHandler = handleMouseMove;
}

function disableDebugHoverInspect() {
  const globe = getGlobe();
  const container = document.getElementById('globeViz');

  if (globe && typeof globe.onPolygonHover === 'function') {
    // Reset to default behavior (no hover tooltip)
    globe.onPolygonHover(null);
  }

  if (container && container._debugHoverMouseMoveHandler) {
    container.removeEventListener('mousemove', container._debugHoverMouseMoveHandler);
    delete container._debugHoverMouseMoveHandler;
  }

  hideTooltip();

  debugHelpersInstalled = false;
}

/**
 * Fully apply a debug-selected country as the new round target.
 * Updates both the visual map state and the store/round state so that
 * guesses work correctly against the new target.
 */
function applyDebugTarget(country, options = {}) {
  const runtime = getRuntime();
  if (!runtime || !country) {
    return;
  }

  const { reset = true, mark = true, zoom = true, halo = false } = options;

  if (reset) {
    // Reset visual map state
    runtime.worldMapInst?.resetRoundState();
    // Reset UI state
    runtime.roundTransitions?.clearRoundTransition?.();
    runtime.roundUi?.clearFeedback?.();
    runtime.roundUi?.clearHints?.();
    runtime.roundUi?.renderGuessPlaceholders?.();
    runtime.input?.clearForm?.();
    runtime.input?.syncGuessButtonState?.(false);
    // Update store: set the new target country and reset round state
    runtime.actions?.setTargetCountry?.(country);
    runtime.actions?.startRound?.(country.properties?.name ?? '');
  }

  if (mark) {
    runtime.worldMapInst?.markTarget?.(country);
  }

  if (zoom) {
    runtime.worldMapInst?.zoomToCountry?.(country);
  }

  if (halo) {
    runtime.worldMapInst?.showLocationHalo?.(country);
  }
}

function enableDebugClickInspect(options = {}) {
  const runtime = getRuntime();
  const countries = getCountrySelection();
  if (!runtime?.worldMapInst || !countries) {
    return;
  }

  const { reset = true, mark = true, zoom = true, halo = false } = options;

  countries.style('cursor', 'zoom-in').on('click.debugInspect', (_event, country) => {
    const countryName = country?.properties?.name ?? '';
    window.__WORLDLE_DEBUG_LAST_COUNTRY__ = country || null;
    window.__WORLDLE_DEBUG_LAST_COUNTRY_NAME__ = countryName;
    log.debug('[worldle-lite] clicked country:', countryName);

    applyDebugTarget(country, { reset, mark, zoom, halo });
  });
}

function disableDebugClickInspect() {
  const countries = getCountrySelection();
  if (!countries) {
    return;
  }

  countries.style('cursor', null).on('click.debugInspect', null);

  debugHelpersInstalled = false;
}

function getDebugStorageKey() {
  const runtime = getRuntime();
  return runtime?.config?.DEBUG_STORAGE_KEY || 'worldle-lite-debug';
}

function getStoredDebugPreference() {
  try {
    const stored = window.localStorage.getItem(getDebugStorageKey());
    if (stored === 'on' || stored === 'true') {
      return true;
    }

    if (stored === 'off' || stored === 'false') {
      return false;
    }
  } catch {
    return null;
  }

  return null;
}

function resolveDebugMode() {
  const runtime = getRuntime();
  const storedPreference = getStoredDebugPreference();
  if (typeof storedPreference === 'boolean') {
    return storedPreference;
  }

  return Boolean(runtime?.config?.DEBUG);
}

function syncDebugToggleUi() {
  const runtime = getRuntime();
  const debugToggle = runtime?.dom?.debugToggle;
  if (!debugToggle) {
    return;
  }

  const debugEnabled = Boolean(window.__WORLDLE_DEBUG__);
  debugToggle.checked = debugEnabled;
}

function toggleDebugMode() {
  const nextDebugMode = !Boolean(window.__WORLDLE_DEBUG__);
  log.debug('[debug] toggleDebugMode', { nextDebugMode });

  try {
    window.localStorage.setItem(getDebugStorageKey(), nextDebugMode ? 'on' : 'off');
  } catch {
    // Ignore storage failures (private mode, blocked storage, etc.).
  }

  window.__WORLDLE_DEBUG__ = nextDebugMode;

  if (nextDebugMode) {
    log.debug('[debug] debug mode ON, installing helpers');
    installDebugHelpers();
  } else {
    log.debug('[debug] debug mode OFF, disabling helpers');
    // Only disable if helpers were actually installed (i.e., after map loads)
    if (debugHelpersInstalled) {
      disableDebugClickInspect();
      disableDebugHoverInspect();
    }
  }

  syncDebugToggleUi();
}

function bindDebugToggle() {
  const runtime = getRuntime();
  const debugToggle = runtime?.dom?.debugToggle;
  if (!debugToggle) {
    return;
  }

  debugToggle.addEventListener('change', toggleDebugMode);
}

function installDebugHelpers() {
  const runtime = getRuntime();
  log.debug('[debug-hover] installDebugHelpers called', {
    debugEnabled: window.__WORLDLE_DEBUG__,
    hasRuntime: !!runtime,
  });

  if (!window.__WORLDLE_DEBUG__ || !runtime) {
    log.debug('[debug-hover] installDebugHelpers: debug not enabled or no runtime');
    return;
  }

  // Prevent installing helpers multiple times, which would attach duplicate event listeners
  if (debugHelpersInstalled) {
    log.debug('[debug-hover] installDebugHelpers: already installed');
    return;
  }

  // Check if globe (Globe.gl) is available, or fall back to checking for SVG country elements
  const globe = getGlobe();
  const countries = getCountrySelection();
  const hasGlobeOrMap = globe || (countries && !countries.empty());

  if (!hasGlobeOrMap) {
    // Map/globe not loaded yet; will be called again by bootstrap.js after map loads
    log.debug('[debug-hover] installDebugHelpers: globe/map not loaded yet', {
      hasGlobe: !!globe,
      hasCountries: !!countries,
    });
    return;
  }

  log.debug('[debug-hover] installing debug helpers...');

  window.debugGetLastClickedCountryName = () => window.__WORLDLE_DEBUG_LAST_COUNTRY_NAME__ || null;
  window.debugGetLastClickedCountry = () => window.__WORLDLE_DEBUG_LAST_COUNTRY__ || null;

  window.debugClearLastClickedCountry = () => {
    window.__WORLDLE_DEBUG_LAST_COUNTRY__ = null;
    window.__WORLDLE_DEBUG_LAST_COUNTRY_NAME__ = null;
  };

  window.debugZoomToCountry = (countryName, options = {}) => {
    const country = runtime.actions.resolveCountryGuess(String(countryName ?? '').trim());

    if (!country) {
      log.warn('[worldle-lite] Country not found:', countryName);
      return false;
    }

    window.__WORLDLE_DEBUG_LAST_COUNTRY__ = country;
    window.__WORLDLE_DEBUG_LAST_COUNTRY_NAME__ = country?.properties?.name ?? '';

    const { reset = true, mark = true, zoom = true, halo = true } = options;

    applyDebugTarget(country, { reset, mark, zoom, halo });

    return true;
  };

  window.debugEnableClickZoom = (options = {}) => {
    enableDebugClickInspect(options);
    return true;
  };

  window.debugDisableClickZoom = () => {
    disableDebugClickInspect();
    return true;
  };

  enableDebugHoverInspect();
  window.debugEnableClickZoom();

  debugHelpersInstalled = true;
  log.debug('[debug-hover] debug helpers installed successfully');
}

export {
  resolveDebugMode,
  syncDebugToggleUi,
  bindDebugToggle,
  installDebugHelpers,
  toggleDebugMode,
  getLastClickedCountry,
  clearLastClickedCountry,
};

function getLastClickedCountry() {
  return window.__WORLDLE_DEBUG_LAST_COUNTRY__ || null;
}

function clearLastClickedCountry() {
  window.__WORLDLE_DEBUG_LAST_COUNTRY__ = null;
  window.__WORLDLE_DEBUG_LAST_COUNTRY_NAME__ = null;
}
