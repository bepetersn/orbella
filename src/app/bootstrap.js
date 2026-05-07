/**
 * @fileoverview Bootstrap: initialize UI, load countries, render globe, and start the round.
 */

import { round } from './round/index.js';
import { replayHalo } from './round/control.js';
import * as roundUiModule from './round/ui.js';
import * as inputModule from './input.js';
import * as roundTransitionsModule from './round/transitions.js';
import { queryDomElements } from './dom.js';
import { createTimerManager } from './timerManager.js';
import { gameConfig, COPY as _COPY } from '../config.js';
import { gameConstants }  from '../constants.js';
import { gameStore }      from '../store/index.js';                                     
import { createTargetSelector } from '../targetSelector.js';
import * as audioFeedback from '../audio.js';
import * as themeSystem   from '../theme.js';
import { syncDebugToggleUi, bindDebugToggle, resolveDebugMode } from './debug.js';
import { loadAndInitCountries } from './loadCountries.js';
import { worldleLiteLogger as log } from './logger.js';
import { initializeAutoAdvance } from './autoAdvance.js';
import { COPY_BINDINGS, CLICK_BINDINGS } from './bindings.js';

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
 * Initialise every subsystem and start the game.
 *
 * @param {object} [runtimeOverride] - Injected runtime for tests. Falls back
 *   to direct imports in production.  The override only needs to supply deps
 *   that are hard to mock in a test environment (dom refs, globe instance).
 * @returns {Promise<void>} Rejects if the countries dataset fails to load.
 */
export async function bootstrap(runtimeOverride) {
  log.debug('[bootstrap] starting');

  // In production runtimeOverride is undefined; all deps come from direct imports.
  // In tests, runtimeOverride supplies the same shape that runtime.js used to.
  const _rt = runtimeOverride ?? {};

  const timers = _rt.timers ?? createTimerManager();
  const dom     = _rt.dom     || queryDomElements();
  const config  = _rt.config
    ? _rt.config
    : { ...gameConfig, COPY: _COPY };
  const startup = _rt.startup || null;
  const COPY    = config.COPY ?? _COPY;

  // Build a runtime-compatible object so existing round/* modules can keep
  // reading runtime.actions / runtime.state etc. via window.worldleLiteRuntime.
  const runtime = _rt.actions ? _rt : (() => {
    const targetSelector = createTargetSelector();
    return {
      ..._rt,
      BUILD_ID: _rt.BUILD_ID ?? gameConfig.BUILD_ID ?? '',
      config,
      d3:           _rt.d3           ?? window.d3,
      audioFeedback: _rt.audioFeedback ?? audioFeedback,
      themeSystem:   _rt.themeSystem   ?? themeSystem,
      dom,
      startup,
      timers,
      state:   { store: gameStore.state, targetSelector },
      actions: storeActions,
    };
  })();

  log.debug('[bootstrap] runtime exists?', !!runtime.dom);

  function initializeCopy() {
    document.title = COPY.pageTitle || document.title;
    if (dom.buildMarker) dom.buildMarker.textContent = `Build: ${runtime.BUILD_ID || ''}`;
    for (const [domKey, section, prop] of COPY_BINDINGS) {
      const el = dom[domKey];
      const text = COPY[section]?.[prop];
      if (el && text) el.textContent = text;
    }
    window.worldleLiteDebug?.syncDebugToggleUi?.();
    syncDebugToggleUi();
  }

  function bindEventListeners() {
    log.debug('[bootstrap] bindEventListeners - btn refs:', { hint: !!dom.hintBtn, reveal: !!dom.revealBtn });
    for (const [domKey, method] of CLICK_BINDINGS) {
      dom[domKey]?.addEventListener('click', () => round[method]?.());
    }
    dom.replayHaloBtn?.addEventListener('click', () => replayHalo());
    window.worldleLiteDebug?.bindDebugToggle?.();
    bindDebugToggle();
    runtime.input?.bindInputHandlers?.();
  }


  // Wire subsystem namespaces onto runtime so round/* modules can find them
  // via getRuntime().roundUi and getRuntime().input.
  if (!runtime.roundUi) {
    runtime.roundUi = _rt.roundUi ?? roundUiModule;
  }
  if (!runtime.input) {
    runtime.input = _rt.input ?? inputModule;
  }
  if (!runtime.roundTransitions) {
    runtime.roundTransitions = _rt.roundTransitions ?? roundTransitionsModule;
  }

  window.__WORLDLE_DEBUG__ = resolveDebugMode() ?? Boolean(config.DEBUG);
  // Expose runtime on window early so lazy readers (debug.js, round/* modules) can
  // access it during the initialization sequence that follows.
  window.worldleLiteRuntime = runtime;
  startup?.step('app initialization started', {
    buildId: runtime.BUILD_ID,
    debugEnabled: Boolean(window.__WORLDLE_DEBUG__)
  });
  initializeCopy();
  startup?.step('ui copy initialized');
  runtime.themeSystem.initializeTheme?.(dom.themeToggle, { getGlobe: () => runtime.worldMapInst?.globe });
  startup?.step('theme initialized');
  bindEventListeners();
  startup?.step('event listeners bound');
  initializeAutoAdvance(dom.autoAdvanceToggle);
  startup?.step('auto-advance initialized');
  await loadAndInitCountries({ config, runtime, _rt, startup });
}
