/**
 * @fileoverview Bootstrap: initialize UI, load countries, render globe, and start the round.
 */

// Bootstrap: initialize UI, load countries, render globe, and start the round.
(() => {
  console.log('[bootstrap] IIFE starting');
  const runtime = window.worldleLiteRuntime || {};
  console.log('[bootstrap] runtime exists?', !!runtime.dom);
  const dom = runtime.dom || {};
  const config = runtime.config || {};
  const actions = runtime.actions || {};
  const startup = runtime.startup;
  const COPY = config.COPY || {};
  const IMPORTS = runtime.IMPORTS || {};

  function initializeCopy() {
    document.title = COPY.pageTitle || document.title;
    try {
      if (dom.buildMarker) dom.buildMarker.textContent = `Build: ${runtime.BUILD_ID || ''}`;
      if (dom.heroTitle && COPY.hero?.title) dom.heroTitle.textContent = COPY.hero.title;
      if (dom.heroSubtitle && COPY.hero?.subtitle) dom.heroSubtitle.textContent = COPY.hero.subtitle;
      if (dom.revealBtn && COPY.buttons?.showAnswer) dom.revealBtn.textContent = COPY.buttons.showAnswer;
      if (dom.nextRoundBtn && COPY.buttons?.nextRound) dom.nextRoundBtn.textContent = COPY.buttons.nextRound;
      if (dom.hintBtn && COPY.buttons?.hint) dom.hintBtn.textContent = COPY.buttons.hint;
    } catch (e) { /* ignore UI update failures */ }
    window.worldleLiteDebug?.syncDebugToggleUi?.();
  }

  function bindEventListeners() {
    console.log('[bootstrap] bindEventListeners - btn refs:', { hint: !!dom.hintBtn, reveal: !!dom.revealBtn });
    if (dom.revealBtn) dom.revealBtn.addEventListener('click', () => runtime.round?.revealAnswer?.());
    if (dom.hintBtn) dom.hintBtn.addEventListener('click', () => runtime.round?.showNextHint?.());
    if (dom.nextRoundBtn) dom.nextRoundBtn.addEventListener('click', () => runtime.round?.advanceToNextRound?.());
    if (dom.replayHaloBtn) dom.replayHaloBtn.addEventListener('click', () => runtime.roundControl?.replayHalo?.());
    if (dom.resetBtn) dom.resetBtn.addEventListener('click', () => runtime.round?.startRound?.());
    window.worldleLiteDebug?.bindDebugToggle?.();
    runtime.input?.bindInputHandlers?.();
  }

  // Bootstrap is the authoritative loader for country GeoJSON. It loads the
  // data, populates the store, initializes the globe renderer, and starts
  // the first round. This function centralizes that flow.
  async function loadAndInitCountries() {
    const baseUrl = config.COUNTRIES_GEOJSON_URL || window.gameConfig?.COUNTRIES_GEOJSON_URL || 'pipeline/data/generated/world-countries.render.json';
    // Append a cache-busting timestamp so regenerated JSON is loaded immediately
    const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
    startup?.step('loading countries dataset', { url });
    try {
      const data = IMPORTS.d3?.json ? await IMPORTS.d3.json(url) : await fetch(url).then((r) => r.json());
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
      try {
        if (runtime.input && typeof runtime.input.populateContinentFilter === 'function') {
          runtime.input.populateContinentFilter(features);
          startup?.step('continent filter populated');
        }
      } catch (e) {
        startup?.warn('continent filter population failed', { message: e?.message || String(e) });
        console.warn('bootstrap: populateContinentFilter failed', e);
      }

      if (typeof window.createWorldleGlobe === 'function') {
        try {
          startup?.step('initializing globe renderer');
          window.createWorldleGlobe(data);
          startup?.step('globe renderer initialized');
        } catch (e) {
          startup?.error('globe renderer initialization failed', { message: e?.message || String(e) });
          console.error('bootstrap: createWorldleGlobe threw', e);
        }
      } else {
        startup?.warn('globe renderer unavailable');
        console.warn('bootstrap: createWorldleGlobe not defined');
      }

      // Ensure a minimal worldMapInst stub exists so `startRound` can
      // safely call `runtime.worldMapInst.resetRoundState()` even if the
      // globe failed to initialize or hasn't set the runtime hook yet.
      if (!window.worldleLiteRuntime) window.worldleLiteRuntime = runtime;
      if (!window.worldleLiteRuntime.worldMapInst) {
        window.worldleLiteRuntime.worldMapInst = {
          resetRoundState: () => {},
          markTarget: () => {},
          zoomToCountry: () => {},
          showLocationHalo: () => {},
          setRegionFilter: () => {},
          loadCountries: () => Promise.resolve({ countriesData: features, countryNames, countryByName })
        };
        startup?.warn('world map fallback stub installed');
      }

      runtime.round?.startRound?.();
      startup?.step('first round started');
    } catch (err) {
      startup?.error('countries dataset failed to load', {
        url,
        message: err?.message || String(err)
      });
      console.error('bootstrap: failed to load countries GeoJSON:', err);
    }
  }

  /**
   * Initialise every subsystem and start the game.  Called automatically when
   * the module is evaluated; the result is also accessible as
   * `window.worldleLiteApp.initializeApp`.
   */
  function initializeApp() {
    window.__WORLDLE_DEBUG__ = window.worldleLiteDebug?.resolveDebugMode?.() ?? Boolean(config.DEBUG);
    startup?.step('app initialization started', {
      buildId: runtime.BUILD_ID,
      debugEnabled: Boolean(window.__WORLDLE_DEBUG__)
    });
    initializeCopy();
    startup?.step('ui copy initialized');
    IMPORTS.themeSystem?.initializeTheme?.(dom.themeToggle);
    startup?.step('theme initialized');
    bindEventListeners();
    startup?.step('event listeners bound');
    loadAndInitCountries();
  }

  window.worldleLiteApp = { initializeApp };
  console.log('[bootstrap] calling initializeApp');
  initializeApp();
})();
