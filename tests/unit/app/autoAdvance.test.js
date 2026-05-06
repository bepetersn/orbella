import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildRuntime } from '../../fixtures/runtime-builder.js';

describe('autoAdvance', () => {
  let mod;
  let runtime;

  beforeEach(async () => {
    vi.resetModules();
    localStorage.clear();
    runtime = buildRuntime();
    mod = await import('../../../src/app/autoAdvance.js');
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('defaults to enabled when no stored preference', () => {
    expect(mod.isEnabled()).toBe(true);
    expect(runtime.autoAdvanceEnabled).toBe(true);
  });

  it('reads stored "off" preference and defaults to disabled', async () => {
    localStorage.setItem('worldle-lite-auto-advance', 'off');
    vi.resetModules();
    runtime = buildRuntime();
    mod = await import('../../../src/app/autoAdvance.js');
    expect(mod.isEnabled()).toBe(false);
  });

  it('reads stored "on" preference', async () => {
    localStorage.setItem('worldle-lite-auto-advance', 'on');
    vi.resetModules();
    runtime = buildRuntime();
    mod = await import('../../../src/app/autoAdvance.js');
    expect(mod.isEnabled()).toBe(true);
  });

  it('setAutoAdvanceEnabled persists the preference to localStorage', () => {
    mod.setAutoAdvanceEnabled(false);
    expect(localStorage.getItem('worldle-lite-auto-advance')).toBe('off');
  });

  it('setAutoAdvanceEnabled updates runtime.autoAdvanceEnabled', () => {
    mod.setAutoAdvanceEnabled(false);
    expect(runtime.autoAdvanceEnabled).toBe(false);
    mod.setAutoAdvanceEnabled(true);
    expect(runtime.autoAdvanceEnabled).toBe(true);
  });

  it('syncAutoAdvanceUi updates the checkbox when element is present', () => {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    runtime.dom.autoAdvanceToggle = checkbox;
    mod.syncAutoAdvanceUi(true);
    expect(checkbox.checked).toBe(true);
    mod.syncAutoAdvanceUi(false);
    expect(checkbox.checked).toBe(false);
  });

  it('syncAutoAdvanceUi does not throw when toggle is null', () => {
    runtime.dom.autoAdvanceToggle = null;
    expect(() => mod.syncAutoAdvanceUi(true)).not.toThrow();
  });

  it('runtime.autoAdvance shim is written', () => {
    expect(typeof runtime.autoAdvance.setAutoAdvanceEnabled).toBe('function');
    expect(typeof runtime.autoAdvance.isEnabled).toBe('function');
  });
});
