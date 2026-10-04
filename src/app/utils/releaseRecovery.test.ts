import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerRecoveryScene, tryAutoReloadForChunkError } from './releaseRecovery';

afterEach(() => sessionStorage.clear());

describe('tryAutoReloadForChunkError', () => {
  it('reloads once per URL within the guard window', () => {
    const reload = vi.fn();
    expect(tryAutoReloadForChunkError(reload, 1_000)).toBe(true);
    expect(tryAutoReloadForChunkError(reload, 5_000)).toBe(false);
    expect(reload).toHaveBeenCalledOnce();
  });

  it('reloads again after the guard window expires', () => {
    const reload = vi.fn();
    tryAutoReloadForChunkError(reload, 1_000);
    expect(tryAutoReloadForChunkError(reload, 40_000)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('never reloads while an unsaved scene is registered', () => {
    const reload = vi.fn();
    const unregister = registerRecoveryScene(() => ({ objects: [] }));
    try {
      expect(tryAutoReloadForChunkError(reload)).toBe(false);
    } finally {
      unregister();
    }
    expect(reload).not.toHaveBeenCalled();
  });
});
