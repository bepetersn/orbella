/**
 * @fileoverview Auto-advance preference persistence and checkbox wiring.
 *
 * Stores the user's preference in localStorage, syncs the checkbox UI, and
 * exposes the current enabled state on `window.worldleLiteRuntime.autoAdvance`.
 */
(() => {
  const runtime = window.worldleLiteRuntime;
  const { dom, config } = runtime;

  function getAutoAdvanceStorageKey() {
    return config.AUTO_ADVANCE_STORAGE_KEY || "worldle-lite-auto-advance";
  }

  function getStoredAutoAdvancePreference() {
    try {
      const stored = window.localStorage.getItem(getAutoAdvanceStorageKey());

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

  function resolveAutoAdvanceEnabled() {
    const storedPreference = getStoredAutoAdvancePreference();

    if (typeof storedPreference === "boolean") {
      return storedPreference;
    }

    return true;
  }

  function syncAutoAdvanceUi(enabled) {
    if (!dom.autoAdvanceToggle) {
      return;
    }

    dom.autoAdvanceToggle.checked = Boolean(enabled);
  }

  function setAutoAdvanceEnabled(enabled) {
    const nextEnabled = Boolean(enabled);

    try {
      window.localStorage.setItem(getAutoAdvanceStorageKey(), nextEnabled ? "on" : "off");
    } catch {
      // Ignore storage failures; the preference still applies for this session.
    }

    runtime.autoAdvanceEnabled = nextEnabled;
    syncAutoAdvanceUi(nextEnabled);
  }

  function handleAutoAdvanceChange() {
    setAutoAdvanceEnabled(dom.autoAdvanceToggle.checked);
  }

  function initializeAutoAdvance(autoAdvanceToggleElement) {
    runtime.autoAdvanceEnabled = resolveAutoAdvanceEnabled();

    if (autoAdvanceToggleElement) {
      dom.autoAdvanceToggle = autoAdvanceToggleElement;
      dom.autoAdvanceToggle.addEventListener("change", handleAutoAdvanceChange);
    }

    syncAutoAdvanceUi(runtime.autoAdvanceEnabled);
  }

  runtime.autoAdvance = {
    initializeAutoAdvance,
    setAutoAdvanceEnabled,
    syncAutoAdvanceUi,
    resolveAutoAdvanceEnabled,
    isEnabled() {
      return Boolean(runtime.autoAdvanceEnabled);
    }
  };

  initializeAutoAdvance(dom.autoAdvanceToggle);
})();