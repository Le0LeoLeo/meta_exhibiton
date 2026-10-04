import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

import { createRedisSceneStore } from './redisSceneStore.js';

function reportClientError(onError, client, _error) {
  const safeError = new Error(`Redis ${client} client error`);
  safeError.name = 'RedisClientError';
  onError(safeError, { client });
}

export function createRedisCollaboration({
  url,
  createRedisClient = (options) => createClient(options),
  createSocketAdapter = createAdapter,
  onError = () => {},
} = {}) {
  if (typeof url !== 'string' || !url.trim()) {
    throw new TypeError('Redis collaboration URL is required');
  }
  if (typeof createRedisClient !== 'function') {
    throw new TypeError('createRedisClient must be a function');
  }
  if (typeof createSocketAdapter !== 'function') {
    throw new TypeError('createSocketAdapter must be a function');
  }
  if (typeof onError !== 'function') {
    throw new TypeError('onError must be a function');
  }

  const pubClient = createRedisClient({ url });
  if (!pubClient || typeof pubClient.duplicate !== 'function') {
    throw new TypeError('Redis publisher must support duplicate()');
  }
  const subClient = pubClient.duplicate();
  const sceneClient = pubClient.duplicate();
  const clients = [
    ['publisher', pubClient],
    ['subscriber', subClient],
    ['scene', sceneClient],
  ];
  const connectedClients = new Set();
  const sceneStores = new Set();
  let attachedIo = null;
  let attachingIo = null;
  let attachPromise = null;
  let closePromise = null;
  let cleanupPromise = null;
  let closing = false;

  for (const [clientName, client] of clients) {
    client.on?.('error', (error) => {
      reportClientError(onError, clientName, error);
    });
  }

  async function quitClients() {
    const results = await Promise.allSettled(clients.map(async ([, client]) => {
      if (connectedClients.has(client) || client.isOpen) {
        await client.quit();
      }
      connectedClients.delete(client);
    }));
    const failure = results.find((result) => result.status === 'rejected');
    if (failure) throw failure.reason;
  }

  async function closeResources() {
    const storeResults = await Promise.allSettled(
      [...sceneStores].map((store) => store.close()),
    );
    const storeFailure = storeResults.find((result) => result.status === 'rejected');

    let clientFailure;
    try {
      await quitClients();
    } catch (error) {
      clientFailure = error;
    }

    if (storeFailure) throw storeFailure.reason;
    if (clientFailure) throw clientFailure;
  }

  function cleanupResourcesOnce() {
    cleanupPromise ||= closeResources();
    return cleanupPromise;
  }

  return {
    attach(io) {
      if (!io || typeof io.adapter !== 'function') {
        return Promise.reject(new TypeError('Socket.IO server is required'));
      }
      if (closing) {
        return Promise.reject(new Error('Redis collaboration is closed'));
      }
      if (attachedIo && attachedIo !== io) {
        return Promise.reject(new Error('Redis collaboration is already attached'));
      }
      if (attachingIo && attachingIo !== io) {
        return Promise.reject(new Error('Redis collaboration is already attaching'));
      }
      if (attachPromise) return attachPromise;

      attachingIo = io;
      attachPromise = (async () => {
        try {
          for (const [, client] of clients) {
            await client.connect();
            connectedClients.add(client);
            if (closing) {
              throw new Error('Redis collaboration is closed');
            }
          }
          if (closing) {
            throw new Error('Redis collaboration is closed');
          }
          io.adapter(createSocketAdapter(pubClient, subClient));
          attachedIo = io;
        } catch (error) {
          if (!closing) {
            closing = true;
            await cleanupResourcesOnce().catch(() => {});
          }
          throw error;
        }
      })();
      return attachPromise;
    },

    createSceneStore(options = {}) {
      if (closing) {
        throw new Error('Redis collaboration is closed');
      }
      const store = createRedisSceneStore({
        ...options,
        client: sceneClient,
        ownsClient: false,
      });
      sceneStores.add(store);
      return store;
    },

    async checkReadiness() {
      if (!attachedIo || closing) {
        throw new Error('Redis collaboration is not attached');
      }
      await Promise.all(clients.map(([, client]) => client.ping()));
    },

    close() {
      if (closePromise) return closePromise;
      closing = true;
      closePromise = (async () => {
        await attachPromise?.catch(() => {});
        await cleanupResourcesOnce();
      })();
      return closePromise;
    },
  };
}
