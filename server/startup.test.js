// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import { startAfterInitialization } from './startup.js';

describe('startup initialization barrier', () => {
  it('does not start listeners before initialization completes', async () => {
    let finishInitialization;
    const initialize = vi.fn(() => new Promise((resolve) => {
      finishInitialization = resolve;
    }));
    const startListeners = vi.fn(async () => ({ listening: true }));

    const startup = startAfterInitialization({ initialize, startListeners });
    await Promise.resolve();

    expect(startListeners).not.toHaveBeenCalled();

    finishInitialization();
    await expect(startup).resolves.toEqual({ listening: true });
    expect(startListeners).toHaveBeenCalledTimes(1);
  });

  it('propagates initialization failure without starting listeners', async () => {
    const error = new Error('migration failed');
    const startListeners = vi.fn();

    await expect(startAfterInitialization({
      initialize: () => Promise.reject(error),
      startListeners,
    })).rejects.toBe(error);
    expect(startListeners).not.toHaveBeenCalled();
  });
});
