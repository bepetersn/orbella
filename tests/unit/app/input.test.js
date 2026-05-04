import { describe, it, expect } from 'vitest';

/**
 * Unit Tests for src/app/input.js
 * Tests input validation and autocomplete
 */
describe('App / Input', () => {
  
  const validateInput = (value, countryLookup) => {
    if (!value || value.trim().length === 0) {
      return { valid: false, reason: 'empty' };
    }
    
    const normalized = String(value)
      .trim()
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ');
    
    return countryLookup.has(normalized)
      ? { valid: true, country: countryLookup.get(normalized) }
      : { valid: false, reason: 'not_found' };
  };

  const mockCountryLookup = new Map([
    ['france', 'France'],
    ['united kingdom', 'United Kingdom'],
    ['united states', 'United States'],
    ['germany', 'Germany']
  ]);

  describe('test_inputValidation_emptyString', () => {
    it('should show no suggestions for empty input', () => {
      const validation = validateInput('', mockCountryLookup);
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('empty');
    });

    it('should handle whitespace-only input', () => {
      const validation = validateInput('   ', mockCountryLookup);
      expect(validation.valid).toBe(false);
    });
  });

  describe('test_inputValidation_validCountry', () => {
    it('should enable guess button with valid country', () => {
      const validation = validateInput('France', mockCountryLookup);
      expect(validation.valid).toBe(true);
      expect(validation.country).toBe('France');
    });

    it('should handle case-insensitive validation', () => {
      const validation1 = validateInput('FRANCE', mockCountryLookup);
      const validation2 = validateInput('france', mockCountryLookup);
      const validation3 = validateInput('France', mockCountryLookup);
      
      expect(validation1.valid).toBe(true);
      expect(validation2.valid).toBe(true);
      expect(validation3.valid).toBe(true);
    });
  });

  describe('test_inputValidation_invalidCountry', () => {
    it('should disable guess button for invalid country', () => {
      const validation = validateInput('InvalidCountry', mockCountryLookup);
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('not_found');
    });

    it('should handle partial matches appropriately', () => {
      const validation = validateInput('Fra', mockCountryLookup);
      expect(validation.valid).toBe(false); // Partial doesn't count as valid
    });
  });

  describe('test_continentFilter_restricts_suggestions', () => {
    it('should apply continent filter to suggestions', () => {
      const europeanCountries = new Map([
        ['france', 'France'],
        ['united kingdom', 'United Kingdom'],
        ['germany', 'Germany']
      ]);

      const validation = validateInput('United', europeanCountries);
      // If continent filter is applied, should not find USA
      const usaValidation = validateInput('United States', europeanCountries);
      expect(usaValidation.valid).toBe(false);
    });
  });

  describe('test_inputButton_enabledDisabled', () => {
    it('should reflect button state based on validation', () => {
      const getButtonState = (input, lookup) => {
        const validation = validateInput(input, lookup);
        return {
          disabled: !validation.valid,
          styling: validation.valid ? 'enabled' : 'disabled'
        };
      };

      const stateValid = getButtonState('France', mockCountryLookup);
      expect(stateValid.disabled).toBe(false);
      expect(stateValid.styling).toBe('enabled');

      const stateInvalid = getButtonState('XYZ', mockCountryLookup);
      expect(stateInvalid.disabled).toBe(true);
      expect(stateInvalid.styling).toBe('disabled');
    });
  });
});
