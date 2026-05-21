import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRuntime } from '../../fixtures/runtime-builder.js';

const loggerMocks = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('../../../src/app/logger.js', () => ({
  orbellaLogger: loggerMocks,
}));

function createCountriesSelection() {
  const handlers = new Map();
  const selection = {
    style: vi.fn(() => selection),
    on: vi.fn((eventName, handler) => {
      handlers.set(eventName, handler ?? null);
      return selection;
    }),
    handlers,
  };

  return selection;
}

describe('debug', () => {
  let mod;
  let runtime;
  let countriesSelection;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    document.body.innerHTML = '';
    window.localStorage.clear();

    // Clean any existing debug globals
    delete window.__ORBELLA_DEBUG__;
    delete window.__ORBELLA_DEBUG_LAST_COUNTRY__;
    delete window.__ORBELLA_DEBUG_LAST_COUNTRY_NAME__;

    runtime = await buildRuntime();
    runtime.dom.debugToggle = document.createElement('input');
    runtime.dom.debugToggle.type = 'checkbox';

    countriesSelection = createCountriesSelection();
    runtime.d3 = {
      selectAll: vi.fn(() => countriesSelection),
    };

    const globe = {
      onPolygonHover: vi.fn(() => globe),
    };

    runtime.worldMapInst = {
      globe,
      resetRoundState: vi.fn(),
      markTarget: vi.fn(),
      zoomToCountry: vi.fn(),
      showLocationHalo: vi.fn(),
    };

    runtime.roundTransitions = {
      clearRoundTransition: vi.fn(),
    };

    runtime.roundUi = {
      clearFeedback: vi.fn(),
      clearHints: vi.fn(),
      renderGuessPlaceholders: vi.fn(),
    };

    runtime.input = {
      clearForm: vi.fn(),
      syncGuessButtonState: vi.fn(),
    };

    mod = await import('../../../src/app/debug.js');
  });

  it('prefers a stored debug preference over config.DEBUG', () => {
    runtime.config.DEBUG = false;
    window.localStorage.setItem(runtime.config.DEBUG_STORAGE_KEY, 'on');

    expect(mod.resolveDebugMode()).toBe(true);

    window.localStorage.setItem(runtime.config.DEBUG_STORAGE_KEY, 'off');
    expect(mod.resolveDebugMode()).toBe(false);
  });

  it('falls back to config.DEBUG when no stored preference exists', () => {
    runtime.config.DEBUG = true;

    expect(mod.resolveDebugMode()).toBe(true);
  });

  it('syncs the debug toggle checkbox with the global debug flag', () => {
    window.__ORBELLA_DEBUG__ = true;

    mod.syncDebugToggleUi();

    expect(runtime.dom.debugToggle.checked).toBe(true);
  });

  it('binds the debug toggle and toggles debug mode on change', () => {
    window.__ORBELLA_DEBUG__ = false;
    mod.bindDebugToggle();

    runtime.dom.debugToggle.dispatchEvent(new Event('change'));

    expect(typeof window.__ORBELLA_DEBUG__).toBe('boolean');
  });

  it('clears the last-clicked helpers and exported accessor state', () => {
    window.__ORBELLA_DEBUG_LAST_COUNTRY__ = { properties: { name: 'Chile' } };
    window.__ORBELLA_DEBUG_LAST_COUNTRY_NAME__ = 'Chile';

    expect(mod.getLastClickedCountry()).toEqual({ properties: { name: 'Chile' } });

    mod.clearLastClickedCountry();

    expect(mod.getLastClickedCountry()).toBeNull();
    expect(window.__ORBELLA_DEBUG_LAST_COUNTRY_NAME__).toBeNull();
  });
});
