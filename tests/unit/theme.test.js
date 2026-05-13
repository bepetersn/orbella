import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getInitialTheme, applyTheme, toggleTheme, initializeTheme } from '../../src/theme.js';

describe('theme', () => {
  beforeEach(() => {
    // jsdom does not implement matchMedia; provide a minimal stub
    window.matchMedia =
      window.matchMedia ||
      vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  describe('getInitialTheme', () => {
    it('returns stored value when set to "dark"', () => {
      localStorage.setItem('worldle-lite-theme', 'dark');
      expect(getInitialTheme()).toBe('dark');
    });

    it('returns stored value when set to "light"', () => {
      localStorage.setItem('worldle-lite-theme', 'light');
      expect(getInitialTheme()).toBe('light');
    });

    it('falls back to prefers-color-scheme when no stored preference', () => {
      localStorage.clear();
      const theme = getInitialTheme();
      expect(['dark', 'light']).toContain(theme);
    });
  });

  describe('applyTheme', () => {
    it('sets document.documentElement.dataset.theme', () => {
      applyTheme('dark');
      expect(document.documentElement.dataset.theme).toBe('dark');
    });

    it('sets theme to "light"', () => {
      applyTheme('light');
      expect(document.documentElement.dataset.theme).toBe('light');
    });

    it('syncs the checkbox when a toggle element is registered', () => {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      initializeTheme(checkbox);
      applyTheme('dark');
      expect(checkbox.checked).toBe(true);
      applyTheme('light');
      expect(checkbox.checked).toBe(false);
    });
  });

  describe('toggleTheme', () => {
    it('flips from dark to light', () => {
      applyTheme('dark');
      toggleTheme();
      expect(document.documentElement.dataset.theme).toBe('light');
    });

    it('flips from light to dark', () => {
      applyTheme('light');
      toggleTheme();
      expect(document.documentElement.dataset.theme).toBe('dark');
    });

    it('persists the new value in localStorage', () => {
      applyTheme('light');
      toggleTheme();
      expect(localStorage.getItem('worldle-lite-theme')).toBe('dark');
    });
  });
});
