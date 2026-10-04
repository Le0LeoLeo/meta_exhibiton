import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import { createRedisRateLimitStore } from './redisRateLimitStore.js';

function createFakeClient(results = [[1, 1000]]) {
  return {
    isOpen: false,
    on: vi.fn(),
    connect: vi.fn(function connect() {
      this.isOpen = true;
      return Promise.resolve();
    }),
    eval: vi.fn().mockImplementation(() => Promise.resolve(results.shift())),
    ping: vi.fn().mockResolvedValue('PONG'),
    quit: vi.fn(function quit() {
      this.isOpen = false;
      return Promise.resolve();
    }),
  };
}

describe('Redis rate-limit store', () => {
  it('uses an atomic script and hashes the subject in the Redis key', async () => {
    const client = createFakeClient([[3, 750]]);
    const store = createRedisRateLimitStore({ client });

    await expect(store.consume({
      namespace: 'auth',
      key: 'user@example.com',
      limit: 2,
      windowMs: 1000,
    })).resolves.toEqual({ allowed: false, retryAfterMs: 750 });

    const expectedHash = createHash('sha256')
      .update('user@example.com')
      .digest('hex');
    expect(client.eval).toHaveBeenCalledWith(expect.stringContaining("redis.call('INCR'"), {
      keys: [`mrei:rate-limit:auth:${expectedHash}`],
      arguments: ['1000'],
    });
    expect(JSON.stringify(client.eval.mock.calls)).not.toContain('user@example.com');
  });

  it('connects lazily, supports readiness, and closes an open client', async () => {
    const client = createFakeClient();
    const store = createRedisRateLimitStore({ client });

    await store.checkReadiness();
    await store.checkReadiness();
    await store.close();

    expect(client.connect).toHaveBeenCalledOnce();
    expect(client.ping).toHaveBeenCalledTimes(2);
    expect(client.quit).toHaveBeenCalledOnce();
  });

  it('propagates Redis failures instead of falling back to memory', async () => {
    const client = createFakeClient();
    client.eval.mockRejectedValue(new Error('Redis unavailable'));
    const store = createRedisRateLimitStore({ client });

    await expect(store.consume({
      namespace: 'auth',
      key: 'client',
      limit: 1,
      windowMs: 1000,
    })).rejects.toThrow('Redis unavailable');
  });
});
