import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import { createRedisSceneStore } from './redisSceneStore.js';

function makeScene(overrides = {}) {
  return {
    roomSize: { width: 10, height: 3, depth: 10 },
    items: [],
    floorPlanElements: [],
    wallMaterialOverrides: {},
    ...overrides,
  };
}

const isValidScene = (scene) => (
  Array.isArray(scene.items)
  && scene.items.every((item) => typeof item?.id === 'string')
);

function createFakeRedis() {
  const values = new Map();
  const client = {
    isOpen: true,
    values,
    set: vi.fn(async (key, value, options) => {
      if (options?.NX && values.has(key)) return null;
      values.set(key, value);
      return 'OK';
    }),
    get: vi.fn(async (key) => values.get(key) ?? null),
    eval: vi.fn(async (_script, { keys, arguments: args }) => {
      const [key] = keys;
      const current = values.get(key);
      if (!current) return [0, 'missing'];
      const currentEnvelope = JSON.parse(current);
      if (currentEnvelope.version !== Number(args[0])) {
        return [0, String(currentEnvelope.version)];
      }
      values.set(key, args[1]);
      return [1, String(Number(args[0]) + 1)];
    }),
    del: vi.fn(async (key) => Number(values.delete(key))),
    ping: vi.fn().mockResolvedValue('PONG'),
    quit: vi.fn(async () => {
      client.isOpen = false;
    }),
  };
  return client;
}

function roomKey(roomId) {
  const hash = createHash('sha256').update(roomId).digest('hex');
  return `mrei:multiplayer:scene:${hash}`;
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function makeSceneWithJsonBytes(targetBytes) {
  const scene = makeScene({ padding: '' });
  const baseBytes = Buffer.byteLength(JSON.stringify(scene), 'utf8');
  if (baseBytes > targetBytes) throw new Error('targetBytes is too small for fixture');
  scene.padding = 'x'.repeat(targetBytes - baseBytes);
  return scene;
}

describe('createRedisSceneStore', () => {
  it('initializes with a hashed key using SET NX EX and never overwrites', async () => {
    const client = createFakeRedis();
    const store = createRedisSceneStore({
      client,
      ttlSeconds: 90,
      validateScene: isValidScene,
      now: () => 1_000,
    });

    const first = await store.initialize('private-room-token', makeScene({
      items: [{ id: 'first' }],
    }));
    const second = await store.initialize('private-room-token', makeScene({
      items: [{ id: 'replacement' }],
    }));

    expect(first).toMatchObject({ version: 1, updatedAt: 1_000 });
    expect(second.scene.items).toEqual([{ id: 'first' }]);
    expect(client.set).toHaveBeenNthCalledWith(
      1,
      roomKey('private-room-token'),
      expect.any(String),
      { NX: true, EX: 90 },
    );
    expect(JSON.stringify(client.set.mock.calls)).not.toContain('private-room-token');
  });

  it('rejects malformed, invalid, and oversized stored values before use', async () => {
    const malformedClient = createFakeRedis();
    malformedClient.values.set(roomKey('malformed'), '{');
    const malformedStore = createRedisSceneStore({
      client: malformedClient,
      validateScene: isValidScene,
    });
    await expect(malformedStore.get('malformed')).rejects.toThrow('malformed JSON');

    malformedClient.values.set(roomKey('invalid'), JSON.stringify({
      version: 0,
      updatedAt: 1,
      scene: makeScene(),
    }));
    await expect(malformedStore.get('invalid')).rejects.toThrow('invalid envelope');

    const oversizedClient = createFakeRedis();
    oversizedClient.values.set(roomKey('oversized'), 'x'.repeat(1_281));
    const oversizedStore = createRedisSceneStore({
      client: oversizedClient,
      sceneMaxBytes: 256,
    });
    await expect(oversizedStore.get('oversized'))
      .rejects.toThrow('exceeds envelopeMaxBytes');

    oversizedClient.values.set(roomKey('oversized-scene'), JSON.stringify({
      version: 1,
      updatedAt: 1,
      scene: makeSceneWithJsonBytes(257),
    }));
    await expect(oversizedStore.get('oversized-scene'))
      .rejects.toThrow('exceeds sceneMaxBytes');
  });

  it('allows scene bytes at the exact limit and rejects scenes above it', async () => {
    const client = createFakeRedis();
    const store = createRedisSceneStore({
      client,
      sceneMaxBytes: 256,
    });
    const atLimit = makeSceneWithJsonBytes(256);
    const aboveLimit = makeSceneWithJsonBytes(257);

    await expect(store.initialize('at-limit', atLimit))
      .resolves.toMatchObject({ version: 1 });
    expect(Buffer.byteLength(
      client.values.get(roomKey('at-limit')),
      'utf8',
    )).toBeGreaterThan(256);
    await expect(store.initialize('above-limit', aboveLimit))
      .rejects.toThrow('exceeds sceneMaxBytes');
  });

  it('increments versions and refreshes TTL for accepted operations and replacements', async () => {
    const client = createFakeRedis();
    let time = 10;
    const store = createRedisSceneStore({
      client,
      ttlSeconds: 120,
      validateScene: isValidScene,
      now: () => time,
    });
    await store.initialize('gallery-1', makeScene());

    time = 20;
    const operation = await store.applyOperation(
      'gallery-1',
      { kind: 'add-item', item: { id: 'added' } },
    );
    time = 30;
    const replacement = await store.replace(
      'gallery-1',
      makeScene({ items: [{ id: 'replacement' }] }),
      isValidScene,
      { expectedVersion: 2 },
    );

    expect(operation).toMatchObject({ accepted: true, version: 2, updatedAt: 20 });
    expect(replacement).toMatchObject({ accepted: true, version: 3, updatedAt: 30 });
    expect(client.eval).toHaveBeenCalledTimes(2);
    expect(client.eval.mock.calls[0][1].arguments[2]).toBe('120');
    expect(client.eval.mock.calls[1][1].arguments[2]).toBe('120');
  });

  it('rejects invalid operations and replacements without writing', async () => {
    const client = createFakeRedis();
    const store = createRedisSceneStore({
      client,
      validateScene: isValidScene,
    });
    await store.initialize('gallery-1', makeScene());

    await expect(store.applyOperation(
      'gallery-1',
      { kind: 'unsupported' },
    )).resolves.toEqual({ accepted: false, reason: 'invalid_scene' });
    await expect(store.replace(
      'gallery-1',
      makeScene({ items: [{ title: 'Missing id' }] }),
      isValidScene,
      { expectedVersion: 1 },
    )).resolves.toEqual({ accepted: false, reason: 'invalid_scene' });

    expect(client.eval).not.toHaveBeenCalled();
    expect((await store.get('gallery-1')).version).toBe(1);
  });

  it('does not let a stale full-scene replace overwrite a winning operation', async () => {
    const client = createFakeRedis();
    const store = createRedisSceneStore({
      client,
      validateScene: isValidScene,
    });
    const staleScene = makeScene({ items: [{ id: 'stale-replacement' }] });
    const initialized = await store.initialize('gallery-1', makeScene());

    const operation = await store.applyOperation(
      'gallery-1',
      { kind: 'add-item', item: { id: 'operation-won' } },
    );
    const replacement = await store.replace(
      'gallery-1',
      staleScene,
      isValidScene,
      { expectedVersion: initialized.version },
    );

    expect(operation).toMatchObject({ accepted: true, version: 2 });
    expect(replacement).toEqual({ accepted: false, reason: 'conflict' });
    expect((await store.get('gallery-1')).scene.items)
      .toEqual([{ id: 'operation-won' }]);
    expect(client.eval).toHaveBeenCalledOnce();
  });

  it('rejects a missing or invalid expected version without reading Redis', async () => {
    const client = createFakeRedis();
    const store = createRedisSceneStore({ client });
    await store.initialize('gallery-1', makeScene());
    client.get.mockClear();

    await expect(store.replace('gallery-1', makeScene()))
      .resolves.toEqual({ accepted: false, reason: 'invalid_version' });
    await expect(store.replace(
      'gallery-1',
      makeScene(),
      undefined,
      { expectedVersion: 0 },
    )).resolves.toEqual({ accepted: false, reason: 'invalid_version' });
    await expect(store.replace(
      'gallery-1',
      makeScene(),
      undefined,
      { expectedVersion: 1.5 },
    )).resolves.toEqual({ accepted: false, reason: 'invalid_version' });
    expect(client.get).not.toHaveBeenCalled();
  });

  it('prioritizes missing and stale state over invalid replacement scenes', async () => {
    const client = createFakeRedis();
    const store = createRedisSceneStore({
      client,
      validateScene: isValidScene,
    });
    const invalidScene = makeScene({ items: [{ title: 'Missing id' }] });

    await expect(store.replace(
      'missing-gallery',
      invalidScene,
      isValidScene,
      { expectedVersion: 1 },
    )).resolves.toEqual({ accepted: false, reason: 'missing_scene' });

    await store.initialize('gallery-1', makeScene());
    await store.applyOperation(
      'gallery-1',
      { kind: 'add-item', item: { id: 'winner' } },
    );
    await expect(store.replace(
      'gallery-1',
      invalidScene,
      isValidScene,
      { expectedVersion: 1 },
    )).resolves.toEqual({ accepted: false, reason: 'conflict' });
  });

  it('does not retry a full-scene replacement after a CAS conflict', async () => {
    const client = createFakeRedis();
    const store = createRedisSceneStore({
      client,
      maxRetries: 5,
    });
    await store.initialize('gallery-1', makeScene());
    client.eval.mockResolvedValue([0, '2']);

    await expect(store.replace(
      'gallery-1',
      makeScene({ items: [{ id: 'replacement' }] }),
      isValidScene,
      { expectedVersion: 1 },
    )).resolves.toEqual({ accepted: false, reason: 'conflict' });
    expect(client.eval).toHaveBeenCalledOnce();
  });

  it('reloads and reapplies an operation after a CAS conflict', async () => {
    const client = createFakeRedis();
    const originalEval = client.eval;
    let conflicted = false;
    client.eval = vi.fn(async (...args) => {
      if (!conflicted) {
        conflicted = true;
        const key = args[1].keys[0];
        const current = JSON.parse(client.values.get(key));
        client.values.set(key, JSON.stringify({
          ...current,
          version: current.version + 1,
          scene: makeScene({ items: [{ id: 'concurrent' }] }),
        }));
        return [0, String(current.version + 1)];
      }
      return originalEval(...args);
    });
    const store = createRedisSceneStore({
      client,
      validateScene: isValidScene,
    });
    await store.initialize('gallery-1', makeScene());

    const result = await store.applyOperation(
      'gallery-1',
      { kind: 'add-item', item: { id: 'local' } },
    );

    expect(result).toMatchObject({ accepted: true, version: 3 });
    expect(result.scene.items).toEqual([{ id: 'concurrent' }, { id: 'local' }]);
    expect(client.eval).toHaveBeenCalledTimes(2);
  });

  it('returns a conflict after the bounded retry budget is exhausted', async () => {
    const client = createFakeRedis();
    client.eval.mockResolvedValue([0, 'newer']);
    const store = createRedisSceneStore({
      client,
      maxRetries: 5,
      validateScene: isValidScene,
    });
    await store.initialize('gallery-1', makeScene());

    await expect(store.applyOperation(
      'gallery-1',
      { kind: 'add-item', item: { id: 'local' } },
    )).resolves.toEqual({ accepted: false, reason: 'conflict' });
    expect(client.eval).toHaveBeenCalledTimes(6);
  });

  it('propagates Redis failures without mutating a local fallback', async () => {
    const client = createFakeRedis();
    const store = createRedisSceneStore({
      client,
      validateScene: isValidScene,
    });
    await store.initialize('gallery-1', makeScene());
    client.eval.mockRejectedValue(new Error('Redis unavailable'));

    await expect(store.applyOperation(
      'gallery-1',
      { kind: 'add-item', item: { id: 'lost' } },
    )).rejects.toThrow('Redis unavailable');
    expect((await store.get('gallery-1')).scene.items).toEqual([]);
  });

  it('propagates initialization, read, and readiness failures', async () => {
    const setClient = createFakeRedis();
    setClient.set.mockRejectedValue(new Error('SET failed'));
    const setStore = createRedisSceneStore({ client: setClient });
    await expect(setStore.initialize('gallery-1', makeScene()))
      .rejects.toThrow('SET failed');

    const getClient = createFakeRedis();
    getClient.get.mockRejectedValue(new Error('GET failed'));
    const getStore = createRedisSceneStore({ client: getClient });
    await expect(getStore.get('gallery-1')).rejects.toThrow('GET failed');

    const pingClient = createFakeRedis();
    pingClient.ping.mockRejectedValue(new Error('PING failed'));
    const pingStore = createRedisSceneStore({ client: pingClient });
    await expect(pingStore.checkReadiness()).rejects.toThrow('PING failed');
  });

  it('keeps caller and returned scene values deeply isolated', async () => {
    const client = createFakeRedis();
    const store = createRedisSceneStore({
      client,
      validateScene: isValidScene,
    });
    const scene = makeScene({
      items: [{ id: 'item-1', metadata: { title: 'Original' } }],
    });
    const initialized = await store.initialize('gallery-1', scene);
    scene.items[0].metadata.title = 'Caller mutation';
    initialized.scene.items[0].metadata.title = 'Result mutation';

    const stored = await store.get('gallery-1');
    expect(stored.scene.items[0].metadata.title).toBe('Original');
    stored.scene.items[0].metadata.title = 'Read mutation';
    expect((await store.get('gallery-1')).scene.items[0].metadata.title).toBe('Original');
  });

  it('isolates stored state from a validator that mutates a rejected candidate', async () => {
    const client = createFakeRedis();
    const store = createRedisSceneStore({
      client,
      validateScene: isValidScene,
    });
    await store.initialize('gallery-1', makeScene({
      items: [{ id: 'item-1', metadata: { title: 'Original' } }],
    }));

    const result = await store.applyOperation(
      'gallery-1',
      { kind: 'update-item', id: 'item-1', updates: { title: 'Candidate' } },
      (candidate) => {
        candidate.items[0].metadata.title = 'Validator mutation';
        return false;
      },
    );

    expect(result).toEqual({ accepted: false, reason: 'invalid_scene' });
    expect(await store.get('gallery-1')).toMatchObject({
      version: 1,
      scene: {
        items: [{
          id: 'item-1',
          metadata: { title: 'Original' },
        }],
      },
    });
  });

  it('checks readiness, has explicit client ownership, and rejects use after close', async () => {
    const sharedClient = createFakeRedis();
    const sharedStore = createRedisSceneStore({ client: sharedClient });
    await sharedStore.checkReadiness();
    await sharedStore.close();
    await sharedStore.close();

    expect(sharedClient.ping).toHaveBeenCalledOnce();
    expect(sharedClient.quit).not.toHaveBeenCalled();
    await expect(sharedStore.get('gallery-1')).rejects.toThrow('Redis scene store is closed');
    await expect(sharedStore.initialize('gallery-1', makeScene()))
      .rejects.toThrow('Redis scene store is closed');
    await expect(sharedStore.replace('gallery-1', makeScene()))
      .rejects.toThrow('Redis scene store is closed');
    await expect(sharedStore.applyOperation('gallery-1', {}))
      .rejects.toThrow('Redis scene store is closed');
    await expect(sharedStore.delete('gallery-1'))
      .rejects.toThrow('Redis scene store is closed');
    await expect(sharedStore.checkReadiness())
      .rejects.toThrow('Redis scene store is closed');

    const ownedClient = createFakeRedis();
    const ownedStore = createRedisSceneStore({
      client: ownedClient,
      ownsClient: true,
    });
    await ownedStore.close();
    await ownedStore.close();
    expect(ownedClient.quit).toHaveBeenCalledOnce();
  });

  it('rejects new work during close and drains an in-flight read before quitting', async () => {
    const client = createFakeRedis();
    const pendingGet = deferred();
    client.get.mockReturnValueOnce(pendingGet.promise);
    const store = createRedisSceneStore({
      client,
      ownsClient: true,
    });

    const read = store.get('gallery-1');
    await vi.waitFor(() => expect(client.get).toHaveBeenCalledOnce());
    const closing = store.close();

    await expect(store.get('late')).rejects.toThrow('Redis scene store is closed');
    expect(client.quit).not.toHaveBeenCalled();
    pendingGet.resolve(null);
    await expect(read).resolves.toBeNull();
    await closing;
    expect(client.quit).toHaveBeenCalledOnce();
  });

  it('drains an in-flight CAS before quitting', async () => {
    const client = createFakeRedis();
    const pendingEval = deferred();
    const store = createRedisSceneStore({
      client,
      ownsClient: true,
    });
    await store.initialize('gallery-1', makeScene());
    client.eval.mockReturnValueOnce(pendingEval.promise);

    const write = store.applyOperation(
      'gallery-1',
      { kind: 'add-item', item: { id: 'pending' } },
    );
    await vi.waitFor(() => expect(client.eval).toHaveBeenCalledOnce());
    const closing = store.close();

    expect(client.quit).not.toHaveBeenCalled();
    pendingEval.resolve([1, '2']);
    await expect(write).resolves.toMatchObject({ accepted: true, version: 2 });
    await closing;
    expect(client.quit).toHaveBeenCalledOnce();
  });

  it('drains an in-flight readiness check before quitting', async () => {
    const client = createFakeRedis();
    const pendingPing = deferred();
    client.ping.mockReturnValueOnce(pendingPing.promise);
    const store = createRedisSceneStore({
      client,
      ownsClient: true,
    });

    const readiness = store.checkReadiness();
    await vi.waitFor(() => expect(client.ping).toHaveBeenCalledOnce());
    const closing = store.close();

    expect(client.quit).not.toHaveBeenCalled();
    pendingPing.resolve('PONG');
    await expect(readiness).resolves.toBe('PONG');
    await closing;
    expect(client.quit).toHaveBeenCalledOnce();
  });

  it('validates bounded configuration', () => {
    const client = createFakeRedis();
    expect(() => createRedisSceneStore({ client, ttlSeconds: 86_401 }))
      .toThrow('ttlSeconds');
    expect(() => createRedisSceneStore({
      client,
      sceneMaxBytes: 1024 * 1024 + 1,
    })).toThrow('sceneMaxBytes');
    expect(() => createRedisSceneStore({ client, maxRetries: 6 }))
      .toThrow('maxRetries');
  });
});
