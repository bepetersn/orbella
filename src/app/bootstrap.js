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
import { gameConfig }     from '../config.js';
import { gameConstants }  from '../constants.js';
import { gameStore }      from '../store/index.js';
import { createTargetSelector } from '../targetSelector.js';
import * as audioFeedback from '../audio.js';
import * as themeSystem   from '../theme.js';
import { createWorldMap } from '../map/index.js';
import { createWorldleGlobe } from '../map/globe.js';
import { syncDebugToggleUi, bindDebugToggle, resolveDebugMode } from './debug.js';
import { worldleLiteLogger as log } from './logger.js';

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
    : { ...gameConfig, COPY: gameConfig.COPY ?? gameConstants?.COPY ?? {} };
  const startup = _rt.startup || null;
  const COPY    = config.COPY || gameConstants?.COPY || {};

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
      actions: {
        loadCountriesIntoState: gameStore.loadCountriesIntoState,
        setSelectedIndex:       gameStore.setSelectedIndex,
        setTargetCountry:       gameStore.setTargetCountry,
        showFirstRound:         gameStore.showFirstRound,
        incrementCorrect:       gameStore.incrementCorrect,
        incrementPlayed:        gameStore.incrementPlayed,
        incrementHintsUsed:     gameStore.incrementHintsUsed,
        resetScores:            gameStore.resetScores,
        setSelectedContinent:   gameStore.setSelectedContinent,
        getRoundState:          gameStore.getRoundState,
        startRound:             gameStore.startRound,
        revealRoundAnswer:      gameStore.revealRoundAnswer,
        requestRoundHint:       gameStore.requestRoundHint,
        submitRoundGuess:       gameStore.submitRoundGuess,
        normalizeGuess:         gameStore.normalizeGuess,
        resolveCountryGuess:    gameStore.resolveCountryGuess,
        getSuggestedCountryNames: gameStore.getSuggestedCountryNames,
      },
    };
  })();

  log.debug('[bootstrap] runtime exists?', !!runtime.dom);

  function initializeCopy() {
    document.title = COPY.pageTitle || document.title;
    if (dom.buildMarker) dom.buildMarker.textContent = `Build: ${runtime.BUILD_ID || ''}`;
    if (dom.heroEyebrow && COPY.hero?.eyebrow) dom.heroEyebrow.textContent = COPY.hero.eyebrow;
    if (dom.heroTitle && COPY.hero?.title) dom.heroTitle.textContent = COPY.hero.title;
    if (dom.heroSubtitle && COPY.hero?.subtitle) dom.heroSubtitle.textContent = COPY.hero.subtitle;
    if (dom.ruleMisses && COPY.hero?.misses) dom.ruleMisses.textContent = COPY.hero.misses;
    if (dom.ruleAutocomplete && COPY.hero?.autocomplete) dom.ruleAutocomplete.textContent = COPY.hero.autocomplete;
    if (dom.ruleReveal && COPY.hero?.reveal) dom.ruleReveal.textContent = COPY.hero.reveal;
    if (dom.revealBtn && COPY.buttons?.showAnswer) dom.revealBtn.textContent = COPY.buttons.showAnswer;
    if (dom.nextRoundBtn && COPY.buttons?.nextRound) dom.nextRoundBtn.textContent = COPY.buttons.nextRound;
    if (dom.hintBtn && COPY.buttons?.hint) dom.hintBtn.textContent = COPY.buttons.hint;
    if (dom.replayHaloBtn && COPY.buttons?.replayHalo) dom.replayHaloBtn.textContent = COPY.buttons.replayHalo;
    if (dom.resetBtn && COPY.buttons?.reset) dom.resetBtn.textContent = COPY.buttons.reset;
    window.worldleLiteDebug?.syncDebugToggleUi?.();
    syncDebugToggleUi();
  }

  function bindEventListeners() {
    log.debug('[bootstrap] bindEventListeners - btn refs:', { hint: !!dom.hintBtn, reveal: !!dom.revealBtn });
    if (dom.revealBtn) dom.revealBtn.addEventListener('click', () => round.revealAnswer?.());
    if (dom.hintBtn) dom.hintBtn.addEventListener('click', () => round.showNextHint?.());
    if (dom.nextRoundBtn) dom.nextRoundBtn.addEventListener('click', () => round.advanceToNextRound?.());
    if (dom.replayHaloBtn) dom.replayHaloBtn.addEventListener('click', () => replayHalo());
    if (dom.resetBtn) dom.resetBtn.addEventListener('click', () => round.startRound?.());
    window.worldleLiteDebug?.bindDebugToggle?.();
    bindDebugToggle();
    runtime.input?.bindInputHandlers?.();
  }

  // Bootstrap is the authoritative loader for country GeoJSON. It loads the
  // data, populates the store, initializes the globe renderer, and starts
  // the first round. This function centralizes that flow.
  async function loadAndInitCountries() {
    const baseUrl = config.COUNTRIES_GEOJSON_URL || window.gameConfig?.COUNTRIES_GEOJSON_URL || 'pipeline/data/generated/world-countries.render.json';
    // Append BUILD_ID so the browser re-fetches only when data is regenerated.
    // BUILD_ID is injected at build time; falls back to empty string (no cache-bust)
    // in local dev where the data file is served directly.
    const cacheBust = runtime.BUILD_ID ? `v=${encodeURIComponent(runtime.BUILD_ID)}` : null;
    const url = cacheBust
      ? baseUrl + (baseUrl.includes('?') ? '&' : '?') + cacheBust
      : baseUrl;
    startup?.step('loading countries dataset', { url, cacheBust: cacheBust ?? 'none' });
    try {
      const data = runtime.d3?.json ? await runtime.d3.json(url) : await fetch(url).then((r) => r.json());
      const features = Array.isArray(data?.features) ? data.features : [];
      startup?.step('countries dataset loaded', {
        url,
        features: features.length
      });
      const countryNames = features.map((f) => f.properties?.name).filter(Boolean).sort();
      const countryByName = new Map(features.map((f) => [String(f.properties?.name || '').toLowerCase(), f]));

      const loader = runtime.actions?.loadCountriesIntoState || window._gameStore?.loadCountriesIntoState;
      if (typeof loader === 'function') {
        loader({ countriesData: features, countryNames, countryByName });
        startup?.step('country store hydrated', {
          countryNames: countryNames.length
        });
      } else {
        startup?.warn('country store loader unavailable');
      }

      // Populate continent filter UI if the input module is available.
      // Non-critical enhancement path: failures are logged but do not abort startup.
      try {
        runtime.input?.populateContinentFilter?.(features);
        startup?.step('continent filter populated');
      } catch (e) {
        startup?.warn('[bootstrap] populateContinentFilter failed — continuing', { message: e?.message || String(e) });
        log.warn('[bootstrap] populateContinentFilter failed', e);
      }

      const globeInit = _rt.createWorldleGlobe ?? createWorldleGlobe;
      if (typeof globeInit === 'function') {
        try {
          startup?.step('initializing globe renderer');
          const worldMapInst = globeInit(data);
          if (worldMapInst) {
            runtime.worldMapInst = worldMapInst;
          }
          startup?.step('globe renderer initialized');
        } catch (e) {
          startup?.error('globe renderer initialization failed', { message: e?.message || String(e) });
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
          loadCountries: () => Promise.resolve({ countriesData: features, countryNames, countryByName })
        };
        startup?.warn('world map fallback stub installed');
      }

      round.startRound?.();
      startup?.step('first round started');
    } catch (err) {
      startup?.error('countries dataset failed to load', {
        url,
        message: err?.message || String(err)
      });
      console.error('[bootstrap] failed to load countries GeoJSON:', err);
      throw err;
    }
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
  await loadAndInitCountries();
}
