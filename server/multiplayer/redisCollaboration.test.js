// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import { createRedisCollaboration } from './redisCollaboration.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function createClientSet({ connectGates = {}, failConnectAt } = {}) {
  const events = [];
  const clients = [];

  function makeClient(name) {
    const client = {
      name,
      isOpen: false,
      on: vi.fn(),
      connect: vi.fn(async () => {
        events.push(`connect:${name}`);
        await connectGates[name]?.promise;
        if (failConnectAt === name) throw new Error(`cannot connect ${name}`);
        client.isOpen = true;
      }),
      ping: vi.fn(async () => 'PONG'),
      quit: vi.fn(async () => {
        events.push(`quit:${name}`);
        client.isOpen = false;
      }),
      duplicate: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
      eval: vi.fn(),
      del: vi.fn(),
    };
    clients.push(client);
    return client;
  }

  const publisher = makeClient('publisher');
  const subscriber = makeClient('subscriber');
  const scene = makeClient('scene');
  publisher.duplicate
    .mockReturnValueOnce(subscriber)
    .mockReturnValueOnce(scene);

  return { publisher, subscriber, scene, clients, events };
}

function createHarness(clientSet, options = {}) {
  const adapter = { name: 'redis-adapter' };
  const createSocketAdapter = vi.fn(() => adapter);
  const io = {
    adapter: vi.fn(() => {
      clientSet.events.push('adapter');
    }),
  };
  const collaboration = createRedisCollaboration({
    url: options.url ?? 'redis://user:secret@redis.internal:6379',
    createRedisClient: vi.fn(() => clientSet.publisher),
    createSocketAdapter,
    onError: options.onError,
  });
  return { adapter, collaboration, createSocketAdapter, io };
}

describe('createRedisCollaboration', () => {
  it('connects publisher, subscriber, and scene clients before attaching the adapter', async () => {
    const clientSet = createClientSet();
    const { adapter, collaboration, createSocketAdapter, io } = createHarness(clientSet);

    await collaboration.attach(io);

    expect(clientSet.events).toEqual([
      'connect:publisher',
      'connect:subscriber',
      'connect:scene',
      'adapter',
    ]);
    expect(createSocketAdapter).toHaveBeenCalledOnce();
    expect(createSocketAdapter).toHaveBeenCalledWith(
      clientSet.publisher,
      clientSet.subscriber,
    );
    expect(io.adapter).toHaveBeenCalledOnce();
    expect(io.adapter).toHaveBeenCalledWith(adapter);
  });

  it.each([
    ['publisher', ['publisher']],
    ['subscriber', ['publisher', 'subscriber']],
    ['scene', ['publisher', 'subscriber', 'scene']],
  ])(
    'closes clients opened while close races with the %s connection',
    async (pendingClient, connectedNames) => {
      const gate = deferred();
      const clientSet = createClientSet({
        connectGates: { [pendingClient]: gate },
      });
      const { collaboration, io } = createHarness(clientSet);
      const attachPromise = collaboration.attach(io);
      await vi.waitFor(() => {
        expect(clientSet.events).toContain(`connect:${pendingClient}`);
      });

      const firstClose = collaboration.close();
      const secondClose = collaboration.close();
      expect(secondClose).toBe(firstClose);
      gate.resolve();

      await expect(attachPromise).rejects.toThrow('Redis collaboration is closed');
      await firstClose;
      expect(io.adapter).not.toHaveBeenCalled();
      for (const client of clientSet.clients) {
        const expectedCalls = connectedNames.includes(client.name) ? 1 : 0;
        expect(client.quit).toHaveBeenCalledTimes(expectedCalls);
      }
    },
  );

  it('shares attach work for one io and rejects a concurrent different io', async () => {
    const publisherGate = deferred();
    const clientSet = createClientSet({
      connectGates: { publisher: publisherGate },
    });
    const { collaboration, io } = createHarness(clientSet);
    const otherIo = { adapter: vi.fn() };

    const firstAttach = collaboration.attach(io);
    const sameIoAttach = collaboration.attach(io);
    expect(sameIoAttach).toBe(firstAttach);
    await expect(collaboration.attach(otherIo)).rejects.toThrow(
      'Redis collaboration is already attaching',
    );

    publisherGate.resolve();
    await firstAttach;
    expect(io.adapter).toHaveBeenCalledOnce();
    expect(otherIo.adapter).not.toHaveBeenCalled();
  });

  it('rejects startup and closes every connected client after a partial failure', async () => {
    const clientSet = createClientSet({ failConnectAt: 'scene' });
    const { collaboration, io } = createHarness(clientSet);

    await expect(collaboration.attach(io)).rejects.toThrow('cannot connect scene');

    expect(clientSet.publisher.quit).toHaveBeenCalledOnce();
    expect(clientSet.subscriber.quit).toHaveBeenCalledOnce();
    expect(clientSet.scene.quit).not.toHaveBeenCalled();
    expect(io.adapter).not.toHaveBeenCalled();
  });

  it('creates a non-owning scene store and drains it before quitting clients', async () => {
    const clientSet = createClientSet();
    const { collaboration, io } = createHarness(clientSet);
    await collaboration.attach(io);
    const store = collaboration.createSceneStore();
    const originalStoreClose = store.close.bind(store);
    const storeClose = vi.spyOn(store, 'close').mockImplementation(async () => {
      clientSet.events.push('close:store');
      await originalStoreClose();
    });

    await collaboration.close();

    expect(storeClose).toHaveBeenCalledOnce();
    expect(clientSet.events.slice(-4)).toEqual([
      'close:store',
      'quit:publisher',
      'quit:subscriber',
      'quit:scene',
    ]);
    expect(clientSet.scene.quit).toHaveBeenCalledOnce();
  });

  it('pings every collaboration connection during readiness checks', async () => {
    const clientSet = createClientSet();
    const { collaboration, io } = createHarness(clientSet);
    await collaboration.attach(io);

    await collaboration.checkReadiness();

    for (const client of clientSet.clients) {
      expect(client.ping).toHaveBeenCalledOnce();
    }
  });

  it('closes owned clients only once', async () => {
    const clientSet = createClientSet();
    const { collaboration, io } = createHarness(clientSet);
    await collaboration.attach(io);

    await Promise.all([
      collaboration.close(),
      collaboration.close(),
    ]);

    for (const client of clientSet.clients) {
      expect(client.quit).toHaveBeenCalledOnce();
    }
  });

  it('reports sanitized client errors without exposing the Redis URL', () => {
    const onError = vi.fn();
    const clientSet = createClientSet();
    createHarness(clientSet, { onError });
    const subscriberErrorHandler = clientSet.subscriber.on.mock.calls
      .find(([event]) => event === 'error')[1];

    subscriberErrorHandler(
      new Error('connection failed for redis://user:secret@redis.internal:6379'),
    );

    expect(onError).toHaveBeenCalledOnce();
    const [reportedError, context] = onError.mock.calls[0];
    expect(reportedError.message).toBe('Redis subscriber client error');
    expect(reportedError.message).not.toContain('redis.internal');
    expect(context).toEqual({ client: 'subscriber' });
  });
});
