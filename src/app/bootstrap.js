// Bootstrap: initialize UI, load countries, render globe, and start the round.
(() => {
  const runtime = window.worldleLiteRuntime || {};
  const dom = runtime.dom || {};
  const config = runtime.config || {};
  const actions = runtime.actions || {};
  const COPY = config.COPY || {};
  const IMPORTS = runtime.IMPORTS || {};

  function initializeCopy() {
    document.title = COPY.pageTitle || document.title;
    try {
      if (dom.buildMarker) dom.buildMarker.textContent = `Build: ${runtime.BUILD_ID || ''}`;
      if (dom.heroTitle) dom.heroTitle.textContent = COPY.hero?.title || '';
      if (dom.heroSubtitle) dom.heroSubtitle.textContent = COPY.hero?.subtitle || '';
      if (dom.revealBtn) dom.revealBtn.textContent = COPY.buttons?.showAnswer || '';
      if (dom.nextRoundBtn) dom.nextRoundBtn.textContent = COPY.buttons?.nextRound || '';
      if (dom.hintBtn) dom.hintBtn.textContent = COPY.buttons?.hint || '';
    } catch (e) { /* ignore UI update failures */ }
    window.worldleLiteDebug?.syncDebugToggleUi?.();
  }

  function initializeWorldMap() {
    // Deprecated: Globe.gl is used instead of the SVG worldMap.
  }

  function bindEventListeners() {
    if (dom.revealBtn) dom.revealBtn.addEventListener('click', () => runtime.round?.revealAnswer?.());
    if (dom.hintBtn) dom.hintBtn.addEventListener('click', () => runtime.round?.showNextHint?.());
    if (dom.nextRoundBtn) dom.nextRoundBtn.addEventListener('click', () => runtime.round?.advanceToNextRound?.());
    window.worldleLiteDebug?.bindDebugToggle?.();
    runtime.input?.bindInputHandlers?.();
  }

  // Bootstrap is the authoritative loader for country GeoJSON. It loads the
  // data, populates the store, initializes the globe renderer, and starts
  // the first round. This function centralizes that flow.
  async function loadAndInitCountries() {
    const baseUrl = config.COUNTRIES_GEOJSON_URL || window.gameConfig?.COUNTRIES_GEOJSON_URL || 'data/generated/world-countries.render.json';
    // Append a cache-busting timestamp so regenerated JSON is loaded immediately
    const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
    try {
      const data = IMPORTS.d3?.json ? await IMPORTS.d3.json(url) : await fetch(url).then((r) => r.json());
      console.info('bootstrap: loaded countries JSON', { url, features: Array.isArray(data?.features) ? data.features.length : 0 });
      const features = Array.isArray(data?.features) ? data.features : [];
      const countryNames = features.map((f) => f.properties?.name).filter(Boolean).sort();
      const countryByName = new Map(features.map((f) => [String(f.properties?.name || '').toLowerCase(), f]));

      const loader = runtime.actions?.loadCountriesIntoState || window._gameStore?.loadCountriesIntoState;
      if (typeof loader === 'function') loader({ countriesData: features, countryNames, countryByName });

      // Populate continent filter UI if the input module is available.
      try {
        if (runtime.input && typeof runtime.input.populateContinentFilter === 'function') {
          runtime.input.populateContinentFilter(features);
        }
      } catch (e) { console.warn('bootstrap: populateContinentFilter failed', e); }

      if (typeof window.createWorldleGlobe === 'function') {
        try {
          console.info('bootstrap: calling createWorldleGlobe');
          window.createWorldleGlobe(data);
        } catch (e) { console.error('bootstrap: createWorldleGlobe threw', e); }
      } else {
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
      }

      runtime.round?.startRound?.();
    } catch (err) {
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
    initializeCopy();
    IMPORTS.themeSystem?.initializeTheme?.(dom.themeToggle);
    bindEventListeners();
    loadAndInitCountries();
  }

  window.worldleLiteApp = { initializeApp };
  initializeApp();
})();
