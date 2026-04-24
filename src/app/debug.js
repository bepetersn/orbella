/**
 * @fileoverview Debug-mode lifecycle and browser debug helpers.
 *
 * Centralises debug state resolution, UI toggle wiring, and helper commands
 * exposed on `window` for map inspection/testing.
 */
(() => {
  let debugTooltipEl = null;
  let debugHelpersInstalled = false;

  function getRuntime() {
    return window.worldleLiteRuntime;
  }

  function getD3() {
    return getRuntime()?.IMPORTS?.d3 || null;
  }

  function getCountrySelection() {
    const d3 = getD3();
    return d3 ? d3.selectAll("#map .country") : null;
  }

  function ensureTooltip() {
    if (debugTooltipEl && document.body.contains(debugTooltipEl)) {
      return debugTooltipEl;
    }

    debugTooltipEl = document.createElement("div");
    debugTooltipEl.className = "debug-country-tooltip";
    debugTooltipEl.setAttribute("aria-hidden", "true");
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
    tooltip.classList.add("visible");
    moveTooltip(event);
  }

  function hideTooltip() {
    if (!debugTooltipEl) {
      return;
    }

    debugTooltipEl.classList.remove("visible");
  }

  function enableDebugHoverInspect() {
    const countries = getCountrySelection();
    if (!countries) {
      return;
    }

    countries
      .on("mouseenter.debugHover", (event, country) => {
        showTooltip(country?.properties?.name ?? "", event);
      })
      .on("mousemove.debugHover", (event) => {
        moveTooltip(event);
      })
      .on("mouseleave.debugHover", () => {
        hideTooltip();
      });
  }

  function disableDebugHoverInspect() {
    const countries = getCountrySelection();
    if (!countries) {
      return;
    }

    countries
      .on("mouseenter.debugHover", null)
      .on("mousemove.debugHover", null)
      .on("mouseleave.debugHover", null);

    hideTooltip();
    
    debugHelpersInstalled = false;
  }

  function enableDebugClickInspect(options = {}) {
    const runtime = getRuntime();
    const countries = getCountrySelection();
    if (!runtime?.worldMapInst || !countries) {
      return;
    }

    const {
      reset = true,
      mark = true,
      zoom = true,
      halo = false
    } = options;

    countries
      .style("cursor", "zoom-in")
      .on("click.debugInspect", (_event, country) => {
        const countryName = country?.properties?.name ?? "";
        window.__WORLDLE_DEBUG_LAST_COUNTRY__ = country || null;
        window.__WORLDLE_DEBUG_LAST_COUNTRY_NAME__ = countryName;
        console.log("[worldle-lite] clicked country:", countryName);

        if (reset) {
          runtime.worldMapInst.resetRoundState();
        }

        if (mark) {
          runtime.worldMapInst.markTarget(country);
        }

        if (zoom) {
          runtime.worldMapInst.zoomToCountry(country);
        }

        if (halo) {
          runtime.worldMapInst.showLocationHalo(country);
        }
      });
  }

  function disableDebugClickInspect() {
    const countries = getCountrySelection();
    if (!countries) {
      return;
    }

    countries
      .style("cursor", null)
      .on("click.debugInspect", null);
    
    debugHelpersInstalled = false;
  }

  function getDebugStorageKey() {
    const runtime = getRuntime();
    return runtime?.config?.DEBUG_STORAGE_KEY || "worldle-lite-debug";
  }

  function getStoredDebugPreference() {
    try {
      const stored = window.localStorage.getItem(getDebugStorageKey());
      if (stored === "on" || stored === "true") {
        return true;
      }

      if (stored === "off" || stored === "false") {
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
    if (typeof storedPreference === "boolean") {
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
    debugToggle.textContent = debugEnabled ? "Debug: On" : "Debug: Off";
    debugToggle.setAttribute("aria-pressed", String(debugEnabled));
  }

  function toggleDebugMode() {
    const nextDebugMode = !Boolean(window.__WORLDLE_DEBUG__);

    try {
      window.localStorage.setItem(getDebugStorageKey(), nextDebugMode ? "on" : "off");
    } catch {
      // Ignore storage failures (private mode, blocked storage, etc.).
    }

    window.__WORLDLE_DEBUG__ = nextDebugMode;

    if (nextDebugMode) {
      installDebugHelpers();
    } else {
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

    debugToggle.addEventListener("click", toggleDebugMode);
  }

  function installDebugHelpers() {
    const runtime = getRuntime();
    if (!window.__WORLDLE_DEBUG__ || !runtime) {
      return;
    }

    // Prevent installing helpers multiple times, which would attach duplicate event listeners
    if (debugHelpersInstalled) {
      return;
    }

    // Only install if country elements are actually present in the DOM
    const countries = getCountrySelection();
    if (!countries || countries.empty()) {
      // Map not loaded yet; will be called again by bootstrap.js after map loads
      return;
    }

    window.debugGetLastClickedCountryName = () => window.__WORLDLE_DEBUG_LAST_COUNTRY_NAME__ || null;
    window.debugGetLastClickedCountry = () => window.__WORLDLE_DEBUG_LAST_COUNTRY__ || null;

    window.debugClearLastClickedCountry = () => {
      window.__WORLDLE_DEBUG_LAST_COUNTRY__ = null;
      window.__WORLDLE_DEBUG_LAST_COUNTRY_NAME__ = null;
    };

    window.debugZoomToCountry = (countryName, options = {}) => {
      const country = runtime.actions.resolveCountryGuess(String(countryName ?? "").trim());

      if (!country) {
        console.warn("[worldle-lite] Country not found:", countryName);
        return false;
      }

      window.__WORLDLE_DEBUG_LAST_COUNTRY__ = country;
      window.__WORLDLE_DEBUG_LAST_COUNTRY_NAME__ = country?.properties?.name ?? "";

      const {
        reset = true,
        mark = true,
        zoom = true,
        halo = true
      } = options;

      if (reset) {
        runtime.worldMapInst.resetRoundState();
      }

      if (mark) {
        runtime.worldMapInst.markTarget(country);
      }

      if (zoom) {
        runtime.worldMapInst.zoomToCountry(country);
      }

      if (halo) {
        runtime.worldMapInst.showLocationHalo(country);
      }

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
  }

  window.worldleLiteDebug = {
    resolveDebugMode,
    syncDebugToggleUi,
    bindDebugToggle,
    installDebugHelpers,
    toggleDebugMode,
    getLastClickedCountry: () => window.__WORLDLE_DEBUG_LAST_COUNTRY__ || null,
    clearLastClickedCountry: () => {
      window.__WORLDLE_DEBUG_LAST_COUNTRY__ = null;
      window.__WORLDLE_DEBUG_LAST_COUNTRY_NAME__ = null;
    }
  };
})();
