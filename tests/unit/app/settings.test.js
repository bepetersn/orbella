import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('settings', () => {
  let openModal, closeModal, toggleModal, isModalOpen;

  beforeEach(async () => {
    vi.resetModules();

    // Set up DOM elements the module's auto-init will find
    document.body.innerHTML = `
      <div id="settings-modal" hidden></div>
      <button id="settings-toggle" aria-expanded="false"></button>
      <button id="settings-close"></button>
      <div id="settings-panel"></div>
      <div id="settings-backdrop"></div>
    `;

    const mod = await import('../../../src/app/settings.js');
    openModal = mod.openModal;
    closeModal = mod.closeModal;
    toggleModal = mod.toggleModal;
    isModalOpen = mod.isModalOpen;
    mod.initialize();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.body.style.overflow = '';
  });

  it('openModal removes the hidden attribute', () => {
    openModal();
    expect(document.getElementById('settings-modal').hasAttribute('hidden')).toBe(false);
  });

  it('closeModal adds the hidden attribute', () => {
    openModal();
    closeModal();
    expect(document.getElementById('settings-modal').hasAttribute('hidden')).toBe(true);
  });

  it('toggleModal opens when closed', () => {
    expect(isModalOpen()).toBe(false);
    toggleModal();
    expect(isModalOpen()).toBe(true);
  });

  it('toggleModal closes when open', () => {
    openModal();
    toggleModal();
    expect(isModalOpen()).toBe(false);
  });

  it('backdrop click closes the modal', () => {
    openModal();
    const modal = document.getElementById('settings-modal');
    modal.dispatchEvent(new MouseEvent('click', { bubbles: true, target: modal }));
    // closeModal triggered via handleBackdropClick when target is the modal
    expect(isModalOpen()).toBe(false);
  });

  it('Escape key closes the modal', () => {
    openModal();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(isModalOpen()).toBe(false);
  });

  it('window.worldleLiteSettings shim exposes the public API', () => {
    expect(typeof window.worldleLiteSettings.openModal).toBe('function');
    expect(typeof window.worldleLiteSettings.closeModal).toBe('function');
    expect(typeof window.worldleLiteSettings.toggleModal).toBe('function');
    expect(typeof window.worldleLiteSettings.isModalOpen).toBe('function');
  });
});
