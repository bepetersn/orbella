import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRuntime } from '../../fixtures/runtime-builder.js';

const loggerMocks = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('../../../src/app/logger.js', () => ({
  worldleLiteLogger: loggerMocks,
}));

function createCountriesSelection() {
  const handlers = new Map();
  const selection = {
    style: vi.fn(() => selection),
    on: vi.fn((eventName, handler) => {
      handlers.set(eventName, handler ?? null);
      return selection;
    }),
    empty: vi.fn(() => false),
    handlers,
  };

  return selection;
}

describe('debug', () => {
  let mod;
  let runtime;
  let countriesSelection;
  let globe;
  let container;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    document.body.innerHTML = '';
    window.localStorage.clear();

    delete window.__WORLDLE_DEBUG__;
    delete window.__WORLDLE_DEBUG_LAST_COUNTRY__;
    delete window.__WORLDLE_DEBUG_LAST_COUNTRY_NAME__;
    delete window.debugGetLastClickedCountry;
    delete window.debugGetLastClickedCountryName;
    delete window.debugClearLastClickedCountry;
    delete window.debugZoomToCountry;
    delete window.debugEnableClickZoom;
    delete window.debugDisableClickZoom;

    runtime = await buildRuntime();
    runtime.dom.debugToggle = document.createElement('input');
    runtime.dom.debugToggle.type = 'checkbox';

    countriesSelection = createCountriesSelection();
    runtime.d3 = {
      selectAll: vi.fn(() => countriesSelection),
    };

    globe = {
      hoverHandler: null,
      onPolygonHover: vi.fn((handler) => {
        globe.hoverHandler = handler;
        return globe;
      }),
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

    container = document.createElement('div');
    container.id = 'globeViz';
    document.body.appendChild(container);

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
    window.__WORLDLE_DEBUG__ = true;

    mod.syncDebugToggleUi();

    expect(runtime.dom.debugToggle.checked).toBe(true);
  });

  it('binds the debug toggle and persists the toggled state', () => {
    mod.bindDebugToggle();

    runtime.dom.debugToggle.dispatchEvent(new Event('change'));

    expect(window.__WORLDLE_DEBUG__).toBe(true);
    expect(window.localStorage.getItem(runtime.config.DEBUG_STORAGE_KEY)).toBe('on');
    expect(runtime.dom.debugToggle.checked).toBe(true);
  });

  it('does not install helpers when debug mode is disabled', () => {
    window.__WORLDLE_DEBUG__ = false;

    mod.installDebugHelpers();

    expect(window.debugZoomToCountry).toBeUndefined();
    expect(globe.onPolygonHover).not.toHaveBeenCalled();
  });

  it('installs hover and click helpers when debug mode is enabled', () => {
    window.__WORLDLE_DEBUG__ = true;

    mod.installDebugHelpers();

    expect(typeof window.debugZoomToCountry).toBe('function');
    expect(typeof window.debugEnableClickZoom).toBe('function');
    expect(typeof window.debugDisableClickZoom).toBe('function');
    expect(globe.onPolygonHover).toHaveBeenCalledWith(expect.any(Function));
    expect(countriesSelection.style).toHaveBeenCalledWith('cursor', 'zoom-in');
    expect(countriesSelection.handlers.get('click.debugInspect')).toEqual(expect.any(Function));
    expect(typeof container._debugHoverMouseMoveHandler).toBe('function');
  });

  it('debugZoomToCountry returns false when the country cannot be resolved', () => {
    window.__WORLDLE_DEBUG__ = true;
    runtime.actions.resolveCountryGuess.mockReturnValue(null);

    mod.installDebugHelpers();

    expect(window.debugZoomToCountry('Atlantis')).toBe(false);
    expect(loggerMocks.warn).toHaveBeenCalledWith('[worldle-lite] Country not found:', 'Atlantis');
  });

  it('debugZoomToCountry applies the selected target through the runtime helpers', () => {
    const country = { properties: { name: 'France' } };
    window.__WORLDLE_DEBUG__ = true;
    runtime.actions.resolveCountryGuess.mockReturnValue(country);

    mod.installDebugHelpers();

    expect(window.debugZoomToCountry('France')).toBe(true);
    expect(runtime.worldMapInst.resetRoundState).toHaveBeenCalledTimes(1);
    expect(runtime.roundTransitions.clearRoundTransition).toHaveBeenCalledTimes(1);
    expect(runtime.roundUi.clearFeedback).toHaveBeenCalledTimes(1);
    expect(runtime.roundUi.clearHints).toHaveBeenCalledTimes(1);
    expect(runtime.roundUi.renderGuessPlaceholders).toHaveBeenCalledTimes(1);
    expect(runtime.input.clearForm).toHaveBeenCalledTimes(1);
    expect(runtime.input.syncGuessButtonState).toHaveBeenCalledWith(false);
    expect(runtime.actions.setTargetCountry).toHaveBeenCalledWith(country);
    expect(runtime.actions.startRound).toHaveBeenCalledWith('France');
    expect(runtime.worldMapInst.markTarget).toHaveBeenCalledWith(country);
    expect(runtime.worldMapInst.zoomToCountry).toHaveBeenCalledWith(country);
    expect(runtime.worldMapInst.showLocationHalo).toHaveBeenCalledWith(country);
    expect(window.debugGetLastClickedCountry()).toBe(country);
    expect(window.debugGetLastClickedCountryName()).toBe('France');
  });

  it('click inspection stores the clicked country and applies the debug target', () => {
    const clickedCountry = { properties: { name: 'Japan' } };
    window.__WORLDLE_DEBUG__ = true;

    mod.installDebugHelpers();

    const clickHandler = countriesSelection.handlers.get('click.debugInspect');
    clickHandler({}, clickedCountry);

    expect(window.__WORLDLE_DEBUG_LAST_COUNTRY__).toBe(clickedCountry);
    expect(window.__WORLDLE_DEBUG_LAST_COUNTRY_NAME__).toBe('Japan');
    expect(runtime.actions.setTargetCountry).toHaveBeenCalledWith(clickedCountry);
    expect(runtime.actions.startRound).toHaveBeenCalledWith('Japan');
  });

  it('toggleDebugMode disables installed helpers when turning debug off', () => {
    window.__WORLDLE_DEBUG__ = true;
    mod.installDebugHelpers();

    mod.toggleDebugMode();

    expect(window.__WORLDLE_DEBUG__).toBe(false);
    expect(window.localStorage.getItem(runtime.config.DEBUG_STORAGE_KEY)).toBe('off');
    expect(globe.onPolygonHover).toHaveBeenLastCalledWith(null);
    expect(countriesSelection.style).toHaveBeenLastCalledWith('cursor', null);
    expect(countriesSelection.handlers.get('click.debugInspect')).toBeNull();
    expect(container._debugHoverMouseMoveHandler).toBeUndefined();
  });

  it('clears the last-clicked helpers and exported accessor state', () => {
    window.__WORLDLE_DEBUG_LAST_COUNTRY__ = { properties: { name: 'Chile' } };
    window.__WORLDLE_DEBUG_LAST_COUNTRY_NAME__ = 'Chile';

    expect(mod.getLastClickedCountry()).toEqual({ properties: { name: 'Chile' } });

    mod.clearLastClickedCountry();

    expect(mod.getLastClickedCountry()).toBeNull();
    expect(window.__WORLDLE_DEBUG_LAST_COUNTRY_NAME__).toBeNull();
  });
});
