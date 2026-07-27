// @vitest-environment node

import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { createClient as createRedisClient } from 'redis';
import { io as createClient } from 'socket.io-client';

import { createRedisCollaboration } from './redisCollaboration.js';
import { createRedisSceneStore } from './redisSceneStore.js';
import {
  DEFAULT_SCENE_LIMITS,
  isValidScene,
  startMultiplayerServer,
} from './socketServer.js';

const redisTestUrl = process.env.REDIS_TEST_URL?.trim();
const enableCommand = [
  'docker compose -p meta-exb-multiplayer-test -f compose.multiplayer-test.yml up -d --wait',
  '$env:REDIS_TEST_URL="redis://127.0.0.1:6380"',
  'npm run test:multiplayer:redis',
].join('\n');

if (!redisTestUrl) {
  process.stderr.write(
    `[multiplayer integration] skipped: REDIS_TEST_URL is not set.\nRun: ${enableCommand}\n`,
  );
}

const clients = new Set();
const servers = new Set();
let cleanupRoomId = null;

const ROOM_SIZE = {
  width: 12,
  length: 18,
  height: 4,
  wallThickness: 0.1,
  wallColor: '#ffffff',
  wallMaterialPreset: 'paint',
  wallTextureUrl: '/textures/wall.svg',
  wallTextureTiling: 2,
  wallRoughness: 0.8,
  wallMetalness: 0,
  wallBumpScale: 0.04,
  wallEnvIntensity: 1,
  wallOpacity: 1,
  wallTransmission: 0,
  wallIor: 1.45,
  floorColor: '#eeeeee',
  floorTextureUrl: '/textures/floor.svg',
  floorTextureTiling: 2,
  floorRoughness: 0.8,
  floorMetalness: 0,
  environmentBrightness: 1,
};

function makeScene() {
  return {
    roomSize: { ...ROOM_SIZE },
    items: [],
    floorPlanElements: [],
    wallMaterialOverrides: {},
  };
}

function makeItem(id, x) {
  return {
    id,
    type: 'painting',
    position: [x, 1, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    content: '',
    title: id,
  };
}

function waitForEvent(target, event, timeoutMs = 5_000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      target.off(event, onEvent);
      reject(new Error(`timed out waiting for ${event}`));
    }, timeoutMs);

    function onEvent(payload) {
      clearTimeout(timeout);
      resolve(payload);
    }

    target.once(event, onEvent);
  });
}

async function startNode(roomId) {
  const collaboration = createRedisCollaboration({ url: redisTestUrl });
  const sceneStore = collaboration.createSceneStore({
    ttlSeconds: 60,
    validateScene: (scene) => isValidScene(scene, DEFAULT_SCENE_LIMITS),
  });

  const gallery = {
    id: roomId,
    owner_id: 'owner-1',
    is_published: 0,
    share_token: null,
    share_role: 'viewer',
    share_expires_at: null,
    scene_json: JSON.stringify(makeScene()),
  };
  const server = startMultiplayerServer({
    initialPort: 0,
    corsOrigin: 'http://localhost',
    allowMissingOrigin: true,
    verifyToken: (token) => (
      token === 'owner-token'
        ? { sub: 'owner-1', name: 'Owner' }
        : null
    ),
    getGalleryById: async (id) => (id === roomId ? gallery : null),
    getGalleryByShareToken: async () => null,
    collaboration,
    sceneStore,
    authorizationSweepMs: 0,
  });
  servers.add(server);
  await server.ready;
  expect(server.port()).toBeGreaterThan(0);
  return { server, sceneStore };
}

async function connect(server) {
  const client = createClient(`http://127.0.0.1:${server.port()}`, {
    auth: { token: 'owner-token' },
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
  });
  clients.add(client);
  await waitForEvent(client, 'connect');
  return client;
}

async function join(client, roomId, nickname) {
  const joined = waitForEvent(client, 'room:joined');
  const scene = waitForEvent(client, 'scene:synced');
  client.emit('room:join', { roomId, nickname });
  return Promise.all([joined, scene]);
}

afterEach(async () => {
  const cleanupFailures = [];
  for (const client of clients) {
    client.disconnect();
  }
  clients.clear();

  const serverResults = await Promise.allSettled(
    [...servers].map((server) => server.close()),
  );
  cleanupFailures.push(
    ...serverResults
      .filter((result) => result.status === 'rejected')
      .map((result) => result.reason),
  );
  servers.clear();

  if (cleanupRoomId) {
    const cleanupClient = createRedisClient({ url: redisTestUrl });
    const cleanupStore = createRedisSceneStore({
      client: cleanupClient,
      ownsClient: true,
    });
    try {
      await cleanupClient.connect();
      await cleanupStore.delete(cleanupRoomId);
    } catch (error) {
      cleanupFailures.push(error);
    } finally {
      try {
        await cleanupStore.close();
      } catch (error) {
        cleanupFailures.push(error);
        if (cleanupClient.isOpen) {
          await cleanupClient.quit().catch((quitError) => {
            cleanupFailures.push(quitError);
          });
        }
      }
      if (cleanupClient.isOpen) {
        try {
          cleanupClient.destroy();
        } catch (error) {
          cleanupFailures.push(error);
        }
      }
    }
  }

  cleanupRoomId = null;
  if (cleanupFailures.length > 0) {
    throw new AggregateError(cleanupFailures, 'multiplayer integration cleanup failed');
  }
});

describe.skipIf(!redisTestUrl)('Redis multi-instance multiplayer', () => {
  it('shares presence, events, and one versioned scene across two nodes', {
    timeout: 30_000,
  }, async () => {
    const roomId = `redis-integration-${randomUUID()}`;
    cleanupRoomId = roomId;
    const [{ server: serverA }, { server: serverB }] = await Promise.all([
      startNode(roomId),
      startNode(roomId),
    ]);

    const editorA = await connect(serverA);
    const [joinedA, initialA] = await join(editorA, roomId, 'Editor A');
    expect(joinedA.players.map((player) => player.nickname)).toEqual(['Editor A']);
    expect(initialA.version).toBe(1);

    const editorB = await connect(serverB);
    const aSawB = waitForEvent(editorA, 'player:joined');
    const [joinedB, initialB] = await join(editorB, roomId, 'Editor B');
    expect(joinedB.players.map((player) => player.nickname).sort())
      .toEqual(['Editor A', 'Editor B']);
    await expect(aSawB).resolves.toMatchObject({
      roomId,
      player: { nickname: 'Editor B' },
    });
    expect(initialB).toMatchObject({ roomId, version: 1 });

    const chatAtB = waitForEvent(editorB, 'chat:new');
    editorA.emit('chat:send', {
      roomId,
      nickname: 'Editor A',
      message: 'cross-node chat',
    });
    await expect(chatAtB).resolves.toMatchObject({
      roomId,
      nickname: 'Editor A',
      message: 'cross-node chat',
    });

    const focusAtA = waitForEvent(editorA, 'scene:focus');
    editorB.emit('scene:focus', {
      roomId,
      nickname: 'Editor B',
      itemId: 'item-a',
    });
    await expect(focusAtA).resolves.toMatchObject({
      roomId,
      nickname: 'Editor B',
      itemId: 'item-a',
    });

    const opA = {
      kind: 'add-item',
      item: makeItem('item-a', -1),
    };
    const opB = {
      kind: 'add-item',
      item: makeItem('item-b', 1),
    };
    const ackA = waitForEvent(editorA, 'scene:op:ack');
    const ackB = waitForEvent(editorB, 'scene:op:ack');
    const remoteAtA = waitForEvent(editorA, 'scene:oped');
    const remoteAtB = waitForEvent(editorB, 'scene:oped');
    editorA.emit('scene:op', { roomId, clientOpId: 'op-a', op: opA });
    editorB.emit('scene:op', { roomId, clientOpId: 'op-b', op: opB });

    const [acceptedA, acceptedB, propagatedToA, propagatedToB] = await Promise.all([
      ackA,
      ackB,
      remoteAtA,
      remoteAtB,
    ]);
    expect(acceptedA.clientOpId).toBe('op-a');
    expect(acceptedB.clientOpId).toBe('op-b');
    expect(new Set([acceptedA.version, acceptedB.version])).toEqual(new Set([2, 3]));
    expect(propagatedToA.clientOpId).toBe('op-b');
    expect(propagatedToA.version).toBe(acceptedB.version);
    expect(propagatedToB.clientOpId).toBe('op-a');
    expect(propagatedToB.version).toBe(acceptedA.version);

    editorA.disconnect();
    const rejoined = await connect(serverB);
    const [, recovered] = await join(rejoined, roomId, 'Rejoined');
    expect(recovered.version).toBe(3);
    expect(recovered.scene.items.map((item) => item.id).sort())
      .toEqual(['item-a', 'item-b']);

    await serverA.close();
    await expect(serverB.checkReadiness()).resolves.toBeUndefined();

    const afterShutdown = await connect(serverB);
    const [, afterShutdownScene] = await join(
      afterShutdown,
      roomId,
      'After shutdown',
    );
    expect(afterShutdownScene.version).toBe(3);
    expect(afterShutdownScene.scene.items.map((item) => item.id).sort())
      .toEqual(['item-a', 'item-b']);

    const stillUsable = waitForEvent(afterShutdown, 'chat:new');
    editorB.emit('chat:send', {
      roomId,
      nickname: 'Editor B',
      message: 'node B still works',
    });
    await expect(stillUsable).resolves.toMatchObject({
      roomId,
      message: 'node B still works',
    });
  });
});
