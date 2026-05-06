import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildRuntime } from '../../fixtures/runtime-builder.js';

describe('input', () => {
  let mod;
  let runtime;

  beforeEach(async () => {
    vi.resetModules();
    runtime = buildRuntime();

    // DOM stubs
    runtime.dom.input = document.createElement('input');
    runtime.dom.suggestionsBox = document.createElement('div');

    // actions stubs
    runtime.actions.getRoundState.mockReturnValue({ outcome: 'active', missCount: 0 });
    runtime.actions.resolveCountryGuess.mockImplementation((name) =>
      name === 'france' ? { properties: { name: 'France' } } : null
    );
    runtime.actions.normalizeGuess.mockImplementation((v) => v.toLowerCase().trim());
    runtime.actions.getSuggestedCountryNames.mockReturnValue([]);
    runtime.actions.setSelectedIndex = vi.fn();

    runtime.config.MAX_MISSES_PER_ROUND = 5;
    runtime.config.IS_VALID_CLASS = 'is-valid';
    runtime.config.MAX_SUGGESTIONS = 8;
    runtime.state.store = { selectedIndex: -1 };

    mod = await import('../../../src/app/input.js');
  });

  describe('validateInput', () => {
    it('returns true for a known country name', () => {
      runtime.dom.input.value = 'france';
      expect(mod.validateInput()).toBe(true);
    });

    it('returns false for an unknown country name', () => {
      runtime.dom.input.value = 'atlantis';
      expect(mod.validateInput()).toBe(false);
    });
  });

  describe('isCountryInSelectedContinent', () => {
    it('returns true when no continent filter is active', () => {
      const country = { properties: { continent: 'Europe' } };
      expect(mod.isCountryInSelectedContinent(country, null)).toBe(true);
    });

    it('returns true when country matches the selected continent', () => {
      const country = { properties: { continent: 'Europe', continents: ['Europe'] } };
      expect(mod.isCountryInSelectedContinent(country, 'Europe')).toBe(true);
    });

    it('returns false when country does not match the selected continent', () => {
      const country = { properties: { continent: 'Asia', continents: ['Asia'] } };
      expect(mod.isCountryInSelectedContinent(country, 'Europe')).toBe(false);
    });
  });

  describe('syncGuessButtonState', () => {
    it('enables input when round is active', () => {
      runtime.actions.getRoundState.mockReturnValue({ outcome: 'active' });
      mod.syncGuessButtonState(false);
      expect(runtime.dom.input.disabled).toBe(false);
    });

    it('disables input when round is not active', () => {
      runtime.actions.getRoundState.mockReturnValue({ outcome: 'won' });
      mod.syncGuessButtonState(false);
      expect(runtime.dom.input.disabled).toBe(true);
    });
  });

  describe('clearForm', () => {
    it('resets input value and hides suggestions', () => {
      runtime.dom.input.value = 'france';
      runtime.dom.suggestionsBox.style.display = 'block';
      mod.clearForm();
      expect(runtime.dom.input.value).toBe('');
      expect(runtime.dom.suggestionsBox.style.display).toBe('none');
    });
  });

  it('runtime.input shim is written', () => {
    expect(typeof runtime.input.validateInput).toBe('function');
    expect(typeof runtime.input.clearForm).toBe('function');
    expect(typeof runtime.input.isCountryInSelectedContinent).toBe('function');
    expect(typeof runtime.input.syncGuessButtonState).toBe('function');
  });
});
