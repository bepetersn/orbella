/**
 * @fileoverview Auto-advance preference persistence and checkbox wiring.
 *
 * Stores the user's preference in localStorage, syncs the checkbox UI, and
 * exposes the current enabled state on `window.worldleLiteRuntime.autoAdvance`.
 */
import { gameConfig as config } from '../config.js';
import { worldleLiteLogger as log } from './logger.js';
import { getRuntime } from './runtime.js';

const getDom = () => getRuntime().dom ?? {};

function getAutoAdvanceStorageKey() {
  return config.AUTO_ADVANCE_STORAGE_KEY || 'worldle-lite-auto-advance';
}

function getStoredAutoAdvancePreference() {
  try {
    const stored = window.localStorage.getItem(getAutoAdvanceStorageKey());

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

export function resolveAutoAdvanceEnabled() {
  const storedPreference = getStoredAutoAdvancePreference();

  if (typeof storedPreference === 'boolean') {
    return storedPreference;
  }

  return true;
}

// Guard: seed runtime.autoAdvanceEnabled from localStorage immediately when
// the runtime is already installed (tests).  In production, bootstrap calls
// initializeAutoAdvance() which does the same work at the right time.
if (typeof window !== 'undefined' && window.worldleLiteRuntime) {
  window.worldleLiteRuntime.autoAdvanceEnabled = resolveAutoAdvanceEnabled();
}

export function isEnabled() {
  return getRuntime().autoAdvanceEnabled ?? resolveAutoAdvanceEnabled();
}

export function syncAutoAdvanceUi(enabled) {
  if (!getDom().autoAdvanceToggle) {
    return;
  }

  getDom().autoAdvanceToggle.checked = Boolean(enabled);
}

export function setAutoAdvanceEnabled(enabled) {
  const nextEnabled = Boolean(enabled);

  try {
    window.localStorage.setItem(getAutoAdvanceStorageKey(), nextEnabled ? 'on' : 'off');
  } catch {
    // Ignore storage failures; the preference still applies for this session.
  }

  getRuntime().autoAdvanceEnabled = nextEnabled;
  log.info('[autoAdvance] setAutoAdvanceEnabled', {
    nextEnabled,
    storageKey: getAutoAdvanceStorageKey(),
  });
  syncAutoAdvanceUi(nextEnabled);
}

function handleAutoAdvanceChange() {
  setAutoAdvanceEnabled(getDom().autoAdvanceToggle.checked);
}

export function initializeAutoAdvance(autoAdvanceToggleElement) {
  getRuntime().autoAdvanceEnabled = resolveAutoAdvanceEnabled();
  getRuntime().autoAdvance = { isEnabled, setAutoAdvanceEnabled };

  if (autoAdvanceToggleElement) {
    getDom().autoAdvanceToggle = autoAdvanceToggleElement;
    getDom().autoAdvanceToggle.addEventListener('change', handleAutoAdvanceChange);
  }

  syncAutoAdvanceUi(getRuntime().autoAdvanceEnabled);
}
