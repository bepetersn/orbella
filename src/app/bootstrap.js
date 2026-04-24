/**
 * @fileoverview App entry point – initialises all subsystems and starts the
 * first round.
 *
 * Evaluates after every other module has registered itself on `window`.
 * Calls `initializeApp`, which: populates text content from config copy,
 * creates the world map, wires event listeners, fetches country GeoJSON, and
 * kicks off the first round.
 */
(() => {
  const runtime = window.worldleLiteRuntime;
  const { dom, config, actions } = runtime;
  const { COPY, W, H } = config;
  const IMPORTS = runtime.IMPORTS;

  function initializeCopy() {
    // 1. Page metadata
    document.title = COPY.pageTitle;

    if (dom.buildMarker) {
      dom.buildMarker.textContent = `Build: ${runtime.BUILD_ID}`;
    }

    // 2. Hero copy
    if (dom.heroEyebrow) {
      dom.heroEyebrow.textContent = COPY.hero.eyebrow;
    }

    if (dom.heroTitle) {
      dom.heroTitle.textContent = COPY.hero.title;
    }

    if (dom.heroSubtitle) {
      dom.heroSubtitle.textContent = COPY.hero.subtitle;
    }

    if (dom.ruleMisses) {
      dom.ruleMisses.textContent = COPY.hero.misses;
    }

    if (dom.ruleAutocomplete) {
      dom.ruleAutocomplete.textContent = COPY.hero.autocomplete;
    }

    if (dom.ruleReveal) {
      dom.ruleReveal.textContent = COPY.hero.reveal;
    }

    // 3. Action labels
    if (dom.revealBtn) {
      dom.revealBtn.textContent = COPY.buttons.showAnswer;
    }

    if (dom.replayHaloBtn) {
      dom.replayHaloBtn.textContent = COPY.buttons.replayHalo;
    }

    if (dom.nextRoundBtn) {
      dom.nextRoundBtn.textContent = COPY.buttons.nextRound;
    }

    if (dom.autoAdvanceLabel) {
      dom.autoAdvanceLabel.lastElementChild.textContent = COPY.buttons.autoAdvance;
    }

    if (dom.hintBtn) {
      dom.hintBtn.textContent = COPY.buttons.hint;
    }

    if (dom.resetBtn) {
      dom.resetBtn.textContent = COPY.buttons.reset;
    }

    window.worldleLiteDebug?.syncDebugToggleUi();
  }

  function initializeWorldMap() {
    runtime.worldMapInst = runtime.IMPORTS.worldMap.createWorldMap({
      d3: runtime.IMPORTS.d3,
      selector: config.MAP_SELECTOR,
      width: W,
      height: H,
      countriesGeoJsonUrl: config.COUNTRIES_GEOJSON_URL,
      countryNameProperty: config.COUNTRY_NAME_PROPERTY,
      countryContinentProperty: config.COUNTRY_CONTINENT_PROPERTY,
      countryContinentMemberships: config.COUNTRY_CONTINENT_MEMBERSHIPS
    });
  }

  function bindEventListeners() {
    // 1. Round action buttons
    if (dom.revealBtn && runtime.round?.revealAnswer) {
      dom.revealBtn.addEventListener("click", runtime.round.revealAnswer);
    }

    if (dom.replayHaloBtn && runtime.round?.replayHalo) {
      dom.replayHaloBtn.addEventListener("click", runtime.round.replayHalo);
    }

    if (dom.hintBtn && runtime.round?.showNextHint) {
      dom.hintBtn.addEventListener("click", runtime.round.showNextHint);
    }

    if (dom.resetBtn && runtime.round?.resetAll) {
      dom.resetBtn.addEventListener("click", runtime.round.resetAll);
    }

    if (dom.nextRoundBtn && runtime.round?.advanceToNextRound) {
      dom.nextRoundBtn.addEventListener("click", runtime.round.advanceToNextRound);
    }

    window.worldleLiteDebug?.bindDebugToggle();

    // 2. Input handlers
    if (runtime.input) {
      runtime.input.bindInputHandlers();
    }
  }

  function loadCountries() {
    return runtime.worldMapInst.loadCountries().then((loadedCountries) => {
      actions.loadCountriesIntoState(loadedCountries);
      runtime.input.populateContinentFilter(loadedCountries.countriesData);
    });
  }

  /**
   * Initialise every subsystem and start the game.  Called automatically when
   * the module is evaluated; the result is also accessible as
   * `window.worldleLiteApp.initializeApp`.
   */
  function initializeApp() {
    window.__WORLDLE_DEBUG__ = window.worldleLiteDebug?.resolveDebugMode?.() ?? Boolean(config.DEBUG);
    initializeCopy();
    initializeWorldMap();

    if (IMPORTS.themeSystem) {
      IMPORTS.themeSystem.initializeTheme(dom.themeToggle);
    }

    bindEventListeners();
    loadCountries().then(() => {
      window.worldleLiteDebug?.installDebugHelpers();
      runtime.round.startRound();
    });
  }

  window.worldleLiteApp = { initializeApp };
  initializeApp();
})();
