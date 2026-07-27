import { describe, expect, it } from 'vitest';
import { checkFiles } from './check-server-syntax.mjs';

describe('checkFiles', () => {
  it('does not exceed the configured concurrency', async () => {
    let active = 0;
    let maxActive = 0;

    const result = await checkFiles(['a.js', 'b.js', 'c.js', 'd.js'], {
      concurrency: 2,
      runCheck: async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return { status: 0 };
      },
    });

    expect(maxActive).toBe(2);
    expect(result.exitCode).toBe(0);
  });

  it('reports every failed file in deterministic order with exit code 1', async () => {
    const result = await checkFiles(['z.js', 'ok.js', 'a.js'], {
      concurrency: 3,
      runCheck: async (file) => ({
        status: file === 'ok.js' ? 0 : 1,
        stderr: `${file} failed`,
      }),
    });

    expect(result.exitCode).toBe(1);
    expect(result.failures.map(({ file }) => file)).toEqual(['a.js', 'z.js']);
  });

  it('waits for all active checks before resolving', async () => {
    const releases = new Map();
    let resolved = false;
    const pending = checkFiles(['first.js', 'second.js'], {
      concurrency: 2,
      runCheck: (file) => new Promise((resolve) => releases.set(file, resolve)),
    }).then((result) => {
      resolved = true;
      return result;
    });

    await Promise.resolve();
    releases.get('first.js')({ status: 1 });
    await Promise.resolve();
    expect(resolved).toBe(false);

    releases.get('second.js')({ status: 0 });
    const result = await pending;
    expect(result.exitCode).toBe(1);
  });
});
