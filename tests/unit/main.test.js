import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('main entrypoint', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('invokes bootstrap on startup', async () => {
    const bootstrap = vi.fn().mockResolvedValue(undefined);
    vi.doMock('../../src/app/bootstrap.js', () => ({ bootstrap }));

    await import('../../src/main.js');

    expect(bootstrap).toHaveBeenCalledTimes(1);
  });

  it('logs bootstrap failures', async () => {
    const err = new Error('boom');
    const bootstrap = vi.fn().mockRejectedValue(err);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.doMock('../../src/app/bootstrap.js', () => ({ bootstrap }));

    await import('../../src/main.js');
    await Promise.resolve();
    await Promise.resolve();

    expect(consoleError).toHaveBeenCalledWith('[worldle-lite] fatal initialization error', err);

    consoleError.mockRestore();
  });
});
