/**
 * @fileoverview Bootstrap: initialize UI, load countries, render globe, and start the round.
 */

import * as d3 from 'd3';
import * as roundUiModule from './round/ui.js';
import * as inputModule from './input.js';
import * as roundTransitionsModule from './round/transitions.js';
import { queryDomElements } from './dom.js';
import { createTimerManager } from './timerManager.js';
import { gameConfig, COPY as _COPY } from '../config.js';
import { gameStore } from '../store/index.js';
import { createTargetSelector } from '../targetSelector.js';
import * as audioFeedback from '../audio.js';
import * as themeSystem from '../theme.js';
import { resolveDebugMode, installDebugHelpers } from './debug.js';
import { loadAndInitCountries } from './loadCountries.js';
import { worldleLiteLogger as log } from './logger.js';
import { initializeAutoAdvance } from './autoAdvance.js';
import { initializeCopy, bindEventListeners } from './bindings.js';
import { initialize as initializeSettings } from './settings.js';
import { round } from './round/index.js';

//
/**
 * Extracts the internal store state and known constants from `gameStore` while
 * collecting the remaining public action methods into `storeActions`.
 *
 * This separation lets the bootstrap code access the store's current data and
 * exported enums/config values directly, without exposing or relying on the
 * full store object shape at each call site. It also keeps the remaining
 * action-oriented API grouped together for clearer use in the app setup.
 */
const {
  state: _gameStoreState,
  dispatch: _dispatch,
  ROUND_OUTCOME: _ROUND_OUTCOME,
  ACTIONS: _ACTIONS,
  ...storeActions
} = gameStore;

/**
 * Assembles the runtime object from direct imports, falling back to
 * runtimeOverride values for any dep that was explicitly supplied (e.g. in
 * tests). Subsystem namespaces (roundUi, input, roundTransitions) are wired
 * in here so they are present before any subsequent initialisation step reads
 * them via getRuntime().
 */
export function buildRuntime(_rt, { dom, config, timers, startup }) {
  if (_rt.actions) return _rt; // already a fully-formed runtime (test fast-path)

  const targetSelector = createTargetSelector();
  return {
    ..._rt,
    BUILD_ID: _rt.BUILD_ID ?? gameConfig.BUILD_ID ?? '',
    config,
    d3: _rt.d3 ?? d3,
    audioFeedback: _rt.audioFeedback ?? audioFeedback,
    themeSystem: _rt.themeSystem ?? themeSystem,
    roundUi: _rt.roundUi ?? roundUiModule,
    input: _rt.input ?? inputModule,
    roundTransitions: _rt.roundTransitions ?? roundTransitionsModule,
    dom,
    startup,
    timers,
    state: { store: gameStore.state, targetSelector },
    actions: storeActions,
  };
}

/**
 * Initialise every subsystem and start the game.
 *
 * @param {object} [runtimeOverride] - Injected runtime for tests. Falls back
 *   to direct imports in production.  The override only needs to supply deps
 *   that are hard to mock in a test environment (dom refs, globe instance).
 * @returns {Promise<void>} Rejects if the countries dataset fails to load.
 */
export async function bootstrap(runtimeOverride) {
  log.debug('[bootstrap] starting');

  const _rt = runtimeOverride ?? {};
  const dom = _rt.dom || queryDomElements();
  const config = _rt.config || { ...gameConfig, COPY: _COPY };
  const timers = _rt.timers ?? createTimerManager();
  const startup = _rt.startup || null;
  const COPY = config.COPY ?? _COPY;

  const runtime = buildRuntime(_rt, { dom, config, timers, startup });
  log.debug('[bootstrap] runtime exists?', !!runtime.dom);

  window.__WORLDLE_DEBUG__ = resolveDebugMode() ?? Boolean(config.DEBUG);
  // Expose runtime on window early so lazy readers (debug.js, round/* modules) can
  // access it during the initialization sequence that follows.
  window.worldleLiteRuntime = runtime;

  startup?.step('app initialization started', {
    buildId: runtime.BUILD_ID,
    debugEnabled: Boolean(window.__WORLDLE_DEBUG__),
  });
  initializeCopy(dom, COPY, runtime.BUILD_ID);
  startup?.step('ui copy initialized');
  runtime.themeSystem.initializeTheme?.(dom.themeToggle, {
    getGlobe: () => runtime.worldMapInst?.globe,
  });
  startup?.step('theme initialized');
  bindEventListeners(dom, runtime);
  startup?.step('event listeners bound');
  initializeSettings();
  startup?.step('settings initialized');
  initializeAutoAdvance(dom.autoAdvanceToggle);
  startup?.step('auto-advance initialized');
  runtime.worldMapInst = await loadAndInitCountries({ config, runtime, _rt, startup });
  // Debug helpers must be installed after worldMapInst is set on runtime
  // so that getGlobe() can resolve runtime.worldMapInst.globe.
  try {
    installDebugHelpers();
  } catch (e) {
    log.warn('[bootstrap] installDebugHelpers failed', e);
  }
  round.startRound?.();
  startup?.step('first round started');
}
