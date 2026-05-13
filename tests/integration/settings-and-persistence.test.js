/**
 * Integration Tests — Settings and State Persistence
 *
 * Exercises the real theme, settings-modal, and autoAdvance modules together,
 * verifying that preferences survive module reloads and that the modules
 * interact correctly with localStorage and DOM.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildRuntime } from '../fixtures/runtime-builder.js';

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.body.innerHTML = '';
  document.body.style.overflow = '';
  // Minimal matchMedia stub for jsdom
  window.matchMedia =
    window.matchMedia ||
    vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
});

afterEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
  document.body.style.overflow = '';
});

describe('Integration / Settings & Persistence (real)', () => {
  describe('theme persistence', () => {
    it('getInitialTheme reads the stored preference on next import', async () => {
      const { applyTheme, toggleTheme } = await import('../../src/theme.js');
      applyTheme('light');
      toggleTheme(); // flips to dark and persists
      expect(localStorage.getItem('worldle-lite-theme')).toBe('dark');

      vi.resetModules();
      const { getInitialTheme } = await import('../../src/theme.js');
      expect(getInitialTheme()).toBe('dark');
    });

    it('applyTheme sets the document data-theme attribute', async () => {
      const { applyTheme } = await import('../../src/theme.js');
      applyTheme('dark');
      expect(document.documentElement.dataset.theme).toBe('dark');
      applyTheme('light');
      expect(document.documentElement.dataset.theme).toBe('light');
    });

    it('toggleTheme flips between light and dark', async () => {
      const { applyTheme, toggleTheme } = await import('../../src/theme.js');
      applyTheme('light');
      toggleTheme();
      expect(document.documentElement.dataset.theme).toBe('dark');
      toggleTheme();
      expect(document.documentElement.dataset.theme).toBe('light');
    });

    it('initializeTheme with a checkbox element syncs the checkbox', async () => {
      const { initializeTheme, applyTheme } = await import('../../src/theme.js');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      localStorage.setItem('worldle-lite-theme', 'dark');
      initializeTheme(checkbox);
      expect(checkbox.checked).toBe(true);
    });
  });

  describe('autoAdvance persistence', () => {
    it('defaults to enabled when localStorage is empty', async () => {
      buildRuntime();
      const mod = await import('../../src/app/autoAdvance.js');
      expect(mod.isEnabled()).toBe(true);
    });

    it('reads stored "off" preference after a module reset', async () => {
      localStorage.setItem('worldle-lite-auto-advance', 'off');
      buildRuntime();
      const mod = await import('../../src/app/autoAdvance.js');
      expect(mod.isEnabled()).toBe(false);
    });

    it('setAutoAdvanceEnabled persists preference so next session reads it', async () => {
      buildRuntime();
      const mod = await import('../../src/app/autoAdvance.js');
      mod.setAutoAdvanceEnabled(false);
      expect(localStorage.getItem('worldle-lite-auto-advance')).toBe('off');

      vi.resetModules();
      buildRuntime();
      const mod2 = await import('../../src/app/autoAdvance.js');
      expect(mod2.isEnabled()).toBe(false);
    });

    it('setAutoAdvanceEnabled(true) writes "on" to localStorage', async () => {
      buildRuntime();
      const mod = await import('../../src/app/autoAdvance.js');
      mod.setAutoAdvanceEnabled(true);
      expect(localStorage.getItem('worldle-lite-auto-advance')).toBe('on');
    });
  });

  describe('settings modal', () => {
    function setupDom() {
      document.body.innerHTML = `
        <div id="settings-modal" hidden></div>
        <button id="settings-toggle" aria-expanded="false"></button>
        <button id="settings-close"></button>
        <div id="settings-panel"></div>
        <div id="settings-backdrop"></div>
      `;
    }

    it('modal starts closed and openModal makes it visible', async () => {
      setupDom();
      const { openModal, isModalOpen, initialize } = await import('../../src/app/settings.js');
      initialize();
      expect(isModalOpen()).toBe(false);
      openModal();
      expect(isModalOpen()).toBe(true);
    });

    it('closeModal hides the modal after it has been opened', async () => {
      setupDom();
      const { openModal, closeModal, isModalOpen, initialize } =
        await import('../../src/app/settings.js');
      initialize();
      openModal();
      closeModal();
      expect(isModalOpen()).toBe(false);
    });

    it('Escape key closes an open modal', async () => {
      setupDom();
      const { openModal, isModalOpen, initialize } = await import('../../src/app/settings.js');
      initialize();
      openModal();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(isModalOpen()).toBe(false);
    });
  });

  describe('cross-module: theme + autoAdvance toggled in same session', () => {
    it('both preferences survive independently in localStorage', async () => {
      buildRuntime();
      const { applyTheme, toggleTheme } = await import('../../src/theme.js');
      const autoMod = await import('../../src/app/autoAdvance.js');

      applyTheme('light');
      toggleTheme(); // → dark
      autoMod.setAutoAdvanceEnabled(false);

      expect(localStorage.getItem('worldle-lite-theme')).toBe('dark');
      expect(localStorage.getItem('worldle-lite-auto-advance')).toBe('off');

      // Reload both modules
      vi.resetModules();
      buildRuntime();
      const { getInitialTheme } = await import('../../src/theme.js');
      const autoMod2 = await import('../../src/app/autoAdvance.js');

      expect(getInitialTheme()).toBe('dark');
      expect(autoMod2.isEnabled()).toBe(false);
    });
  });
});
