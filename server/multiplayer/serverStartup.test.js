// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import { startServersAtomically } from './serverStartup.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('atomic server startup', () => {
  it('waits for multiplayer readiness before starting HTTP', async () => {
    const ready = deferred();
    const multiplayer = {
      ready: ready.promise,
      close: vi.fn(async () => {}),
    };
    const startHttp = vi.fn(async () => ({ close: vi.fn() }));

    const startup = startServersAtomically({
      startMultiplayer: () => multiplayer,
      startHttp,
    });

    await Promise.resolve();
    expect(startHttp).not.toHaveBeenCalled();

    ready.resolve();
    await startup;
    expect(startHttp).toHaveBeenCalledOnce();
  });

  it('does not start HTTP and closes multiplayer when multiplayer readiness fails', async () => {
    const startupError = Object.assign(new Error('multiplayer failed'), {
      code: 'EADDRINUSE',
    });
    const multiplayer = {
      ready: Promise.reject(startupError),
      close: vi.fn(async () => {}),
    };
    const startHttp = vi.fn();

    await expect(startServersAtomically({
      startMultiplayer: () => multiplayer,
      startHttp,
    })).rejects.toBe(startupError);

    expect(startHttp).not.toHaveBeenCalled();
    expect(multiplayer.close).toHaveBeenCalledOnce();
  });
});
