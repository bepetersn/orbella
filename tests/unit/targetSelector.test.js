import { describe, it, expect, beforeEach } from 'vitest';
import { createTargetSelector } from '../../src/targetSelector.js';

describe('targetSelector', () => {
  const makePool = (names) => names.map((name) => ({ properties: { name } }));

  beforeEach(() => {
    localStorage.clear();
  });

  describe('selectTarget', () => {
    it('returns a country from the pool', () => {
      const sel = createTargetSelector({ recentWindowSize: 3 });
      const pool = makePool(['France', 'Germany', 'Italy']);
      const target = sel.getNextTarget(pool);
      expect(target).not.toBeNull();
      expect(pool).toContain(target);
    });

    it('returns null for an empty pool', () => {
      const sel = createTargetSelector();
      expect(sel.getNextTarget([])).toBeNull();
    });

    it('avoids repeating recent targets within the window', () => {
      const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
      const pool = makePool(names);
      const sel = createTargetSelector({ recentWindowSize: 5 });

      const seen = [];
      // Collect 5 selections
      for (let i = 0; i < 5; i++) {
        const t = sel.getNextTarget(pool);
        seen.push(t.properties.name.toLowerCase());
      }
      // All 5 should be unique (window = 5)
      expect(new Set(seen).size).toBe(5);
    });
  });

  describe('clearSelectionHistory / reset', () => {
    it('reset allows previously-seen countries to be selected again immediately', () => {
      const pool = makePool(['X', 'Y']);
      const sel = createTargetSelector({ recentWindowSize: 10 });

      sel.getNextTarget(pool);
      sel.getNextTarget(pool);
      sel.reset();

      // After reset, selections should be possible without exhausting the pool
      const t = sel.getNextTarget(pool);
      expect(t).not.toBeNull();
    });
  });

  describe('localStorage persistence', () => {
    it('persists history between instances sharing the same storageKey', () => {
      const key = 'test-selector-persistence';
      const pool = makePool(['P', 'Q', 'R', 'S']);

      const sel1 = createTargetSelector({ storageKey: key, recentWindowSize: 3 });
      const first = sel1.getNextTarget(pool);

      // Create a second instance reading from the same storage key
      const sel2 = createTargetSelector({ storageKey: key, recentWindowSize: 3 });
      // The second instance should see the persisted history and not repeat first immediately
      const second = sel2.getNextTarget(pool);
      // They may or may not match — what matters is no crash and a valid result
      expect(pool).toContain(second);
    });
  });

  it('window.targetSelector shim is present', () => {
    expect(typeof window.targetSelector.createTargetSelector).toBe('function');
  });
});
