import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildRuntime } from '../../fixtures/runtime-builder.js';

const roundMocks = vi.hoisted(() => ({
  resetAll: vi.fn(),
  submitGuess: vi.fn(),
}));

vi.mock('../../../src/app/round/index.js', () => ({
  round: {
    resetAll: roundMocks.resetAll,
    submitGuess: roundMocks.submitGuess,
  },
}));

describe('input', () => {
  let mod;
  let runtime;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    runtime = await buildRuntime();

    // DOM stubs
    runtime.dom.input = document.createElement('input');
    runtime.dom.suggestionsBox = document.createElement('div');
    runtime.dom.continentFilter = document.createElement('select');
    runtime.dom.continentFilter.innerHTML = '<option value="">All countries</option>';
    runtime.dom.continentFilter.blur = vi.fn();

    // actions stubs
    runtime.actions.getRoundState.mockReturnValue({ outcome: 'active', missCount: 0 });
    runtime.actions.resolveCountryGuess.mockImplementation((name) => {
      const normalizedName = String(name).toLowerCase().trim();
      const countries = {
        france: {
          properties: { name: 'France', displayName: 'France', flagEmoji: '🇫🇷' },
        },
        finland: {
          properties: { name: 'Finland', displayName: 'Republic of Finland' },
        },
        fiji: {
          properties: { name: 'Fiji' },
        },
      };
      return countries[normalizedName] ?? null;
    });
    runtime.actions.normalizeGuess.mockImplementation((v) => v.toLowerCase().trim());
    runtime.actions.getSuggestedCountryNames.mockReturnValue([]);
    runtime.actions.setSelectedIndex = vi.fn();
    runtime.actions.setSelectedContinent = vi.fn();

    runtime.config.MAX_MISSES_PER_ROUND = 5;
    runtime.config.IS_VALID_CLASS = 'is-valid';
    runtime.config.MAX_SUGGESTIONS = 2;
    runtime.state.store = { selectedIndex: -1 };
    runtime.worldMapInst = {
      setRegionFilter: vi.fn(),
    };

    mod = await import('../../../src/app/input.js');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  describe('renderSuggestions', () => {
    it('renders capped suggestions with display names and flags', () => {
      runtime.actions.getSuggestedCountryNames.mockReturnValue(['france', 'finland', 'fiji']);

      mod.renderSuggestions('f');

      expect(runtime.actions.getSuggestedCountryNames).toHaveBeenCalledWith('f', 24);
      expect(runtime.dom.suggestionsBox.children).toHaveLength(2);
      expect(runtime.dom.suggestionsBox.style.display).toBe('block');
      expect(runtime.dom.suggestionsBox.children[0].dataset.countryName).toBe('france');
      expect(runtime.dom.suggestionsBox.children[0].textContent).toContain('France');
      expect(runtime.dom.suggestionsBox.children[0].textContent).toContain('🇫🇷');
      expect(runtime.dom.suggestionsBox.children[1].textContent).toContain('Republic of Finland');
    });

    it('clicking a suggestion fills the input and submits the guess', () => {
      runtime.actions.getSuggestedCountryNames.mockReturnValue(['france']);

      mod.renderSuggestions('fr');
      runtime.dom.suggestionsBox.children[0].click();

      expect(runtime.dom.input.value).toBe('france');
      expect(runtime.dom.suggestionsBox.style.display).toBe('none');
      expect(roundMocks.submitGuess).toHaveBeenCalledTimes(1);
      expect(runtime.dom.input.classList.contains('is-valid')).toBe(true);
    });
  });

  describe('handleInputChange', () => {
    it('clears suggestions when the trimmed input is empty', () => {
      runtime.dom.input.value = '   ';
      runtime.dom.suggestionsBox.innerHTML = '<div>existing</div>';
      runtime.dom.suggestionsBox.style.display = 'block';

      mod.handleInputChange();

      expect(runtime.actions.setSelectedIndex).toHaveBeenCalledWith(-1);
      expect(runtime.dom.suggestionsBox.innerHTML).toBe('');
      expect(runtime.dom.suggestionsBox.style.display).toBe('none');
    });

    it('renders suggestions for non-empty input', () => {
      runtime.dom.input.value = 'fr';
      runtime.actions.getSuggestedCountryNames.mockReturnValue(['france']);

      mod.handleInputChange();

      expect(runtime.dom.suggestionsBox.children).toHaveLength(1);
      expect(runtime.dom.suggestionsBox.style.display).toBe('block');
    });
  });

  describe('handleInputKeydown', () => {
    function renderSuggestionList() {
      runtime.actions.getSuggestedCountryNames.mockReturnValue(['france', 'finland']);
      mod.renderSuggestions('f');
    }

    it('moves selection down and up through the suggestion list', () => {
      renderSuggestionList();
      const preventDefault = vi.fn();

      mod.handleInputKeydown({ key: 'ArrowDown', preventDefault });
      expect(preventDefault).toHaveBeenCalledTimes(1);
      expect(runtime.actions.setSelectedIndex).toHaveBeenLastCalledWith(0);

      runtime.state.store.selectedIndex = 1;
      mod.handleInputKeydown({ key: 'ArrowUp', preventDefault });
      expect(runtime.actions.setSelectedIndex).toHaveBeenLastCalledWith(0);
    });

    it('uses the selected suggestion on Enter before submitting', () => {
      renderSuggestionList();
      runtime.state.store.selectedIndex = 1;

      mod.handleInputKeydown({ key: 'Enter', preventDefault: vi.fn() });

      expect(runtime.dom.input.value).toBe('finland');
      expect(runtime.dom.suggestionsBox.style.display).toBe('none');
      expect(roundMocks.submitGuess).toHaveBeenCalledTimes(1);
    });

    it('falls back to the first suggestion on Enter when nothing is selected', () => {
      renderSuggestionList();

      mod.handleInputKeydown({ key: 'Enter', preventDefault: vi.fn() });

      expect(runtime.dom.input.value).toBe('france');
      expect(roundMocks.submitGuess).toHaveBeenCalledTimes(1);
    });

    it('clears visible suggestions on Escape', () => {
      renderSuggestionList();
      runtime.state.store.selectedIndex = 1;
      const preventDefault = vi.fn();

      mod.handleInputKeydown({ key: 'Escape', preventDefault });

      expect(preventDefault).toHaveBeenCalledTimes(1);
      expect(runtime.actions.setSelectedIndex).toHaveBeenLastCalledWith(-1);
      expect(runtime.dom.suggestionsBox.style.display).toBe('none');
    });
  });

  describe('bindInputHandlers', () => {
    it('wires input and keydown listeners onto the input element', () => {
      const inputListenerSpy = vi.spyOn(runtime.dom.input, 'addEventListener');

      mod.bindInputHandlers();

      expect(inputListenerSpy).toHaveBeenCalledWith('input', mod.handleInputChange);
      expect(inputListenerSpy).toHaveBeenCalledWith('keydown', mod.handleInputKeydown);
    });
  });

  describe('populateContinentFilter', () => {
    const countries = [
      { properties: { continent: 'Europe', continents: ['Europe'] } },
      { properties: { continent: 'Europe', continents: ['Europe', 'Asia'] } },
      { properties: { continent: 'Asia', continents: ['Asia'] } },
      { properties: { continent: 'Oceania', continents: ['Oceania'] } },
    ];

    it('adds continent options with counts', () => {
      mod.populateContinentFilter(countries);

      const optionLabels = Array.from(runtime.dom.continentFilter.querySelectorAll('option')).map(
        (option) => option.textContent
      );

      expect(optionLabels).toEqual(['All countries (4)', 'Asia (2)', 'Europe (2)', 'Oceania (1)']);
    });

    it('applies a new continent selection and resets the round on the next frame', () => {
      vi.stubGlobal('requestAnimationFrame', (callback) => {
        callback();
        return 1;
      });

      mod.populateContinentFilter(countries);
      runtime.dom.continentFilter.value = 'Asia';
      runtime.dom.continentFilter.dispatchEvent(new Event('change'));

      expect(runtime.actions.setSelectedContinent).toHaveBeenCalledWith('Asia');
      expect(runtime.worldMapInst.setRegionFilter).toHaveBeenCalledWith('Asia');
      expect(runtime.dom.continentFilter.blur).toHaveBeenCalled();
      expect(roundMocks.resetAll).toHaveBeenCalledTimes(1);
    });

    it('blurs without resetting when the selection has not changed', () => {
      runtime.dom.continentFilter.value = 'Europe';
      mod.populateContinentFilter(countries);
      runtime.actions.setSelectedContinent.mockClear();

      runtime.dom.continentFilter.dispatchEvent(new Event('change'));

      expect(runtime.dom.continentFilter.blur).toHaveBeenCalled();
      expect(runtime.actions.setSelectedContinent).not.toHaveBeenCalled();
      expect(roundMocks.resetAll).not.toHaveBeenCalled();
    });
  });
});
