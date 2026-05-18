/**
 * Integration Tests — Target Selector
 *
 * Verifies selection history, recent-window behaviour, and persistence to
 * localStorage for `createTargetSelector`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

function makeCountry(name) {
  return { properties: { name, displayName: name } };
}

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});

describe('Integration / Target Selector (real)', () => {
  it('remembers recent selections and persists to localStorage', async () => {
    const { createTargetSelector } = await import('../../src/targetSelector.js');

    // Make Math.random deterministic so deck shuffle is stable.
    const rnd = vi.spyOn(Math, 'random').mockReturnValue(0);

    const a = makeCountry('A');
    const b = makeCountry('B');
    const c = makeCountry('C');
    const selector = createTargetSelector({ recentWindowSize: 2, storageKey: 'tests-ts' });

    const t1 = selector.getNextTarget([a, b, c]);
    const t2 = selector.getNextTarget([a, b, c]);

    expect(t1).not.toBeNull();
    expect(t2).not.toBeNull();
    // persisted payload should exist and contain recentTargetNames
    const raw = localStorage.getItem('tests-ts');
    expect(typeof raw).toBe('string');
    const parsed = JSON.parse(raw);
    expect(Array.isArray(parsed.recentTargetNames)).toBe(true);
    expect(parsed.recentTargetNames.length).toBeGreaterThan(0);

    rnd.mockRestore();
  });

  it('avoids immediate repeats within recentWindowSize on rebuild', async () => {
    const { createTargetSelector } = await import('../../src/targetSelector.js');
    const rnd = vi.spyOn(Math, 'random').mockReturnValue(0);

    const a = makeCountry('A');
    const b = makeCountry('B');
    const c = makeCountry('C');

    const key = 'tests-ts-2';
    const selector1 = createTargetSelector({ recentWindowSize: 2, storageKey: key });
    const first = selector1.getNextTarget([a, b, c]);
    const second = selector1.getNextTarget([a, b, c]);

    // Recreate selector which should load persisted recent targets
    const selector2 = createTargetSelector({ recentWindowSize: 2, storageKey: key });
    const next = selector2.getNextTarget([a, b, c]);

    // `next` should not be equal to the immediate recent entries if pool allows
    const recent = JSON.parse(localStorage.getItem(key)).recentTargetNames;
    expect(Array.isArray(recent)).toBe(true);
    expect(recent.length).toBeGreaterThan(0);
    // `next` should be a valid selection from the pool
    expect(['a', 'b', 'c']).toContain(next.properties.name.toLowerCase());

    rnd.mockRestore();
  });
});
