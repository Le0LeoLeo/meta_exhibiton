// @vitest-environment node

import { once } from 'node:events';
import { createServer as createHttpServer } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { io as createClient } from 'socket.io-client';

import { defaultGalleryScene } from '../../src/app/modules/metaverse3d/store/defaultGalleryScene.ts';
import {
  fetchRoomPlayers,
  startMultiplayerServer,
} from './socketServer.js';
import { createMemorySceneStore } from './memorySceneStore.js';
import { DEFAULT_AVATAR_APPEARANCE } from '../schemas/avatarAppearanceSchema.js';

const PUBLIC_GALLERY = {
  id: 'public-gallery',
  owner_id: 'owner-1',
  is_published: 1,
  share_token: null,
  share_role: 'viewer',
  share_expires_at: null,
};

const PRIVATE_GALLERY = {
  id: 'private-gallery',
  owner_id: 'owner-1',
  is_published: 0,
  share_token: null,
  share_role: 'viewer',
  share_expires_at: null,
};

const VIEWER_SHARE = {
  ...PRIVATE_GALLERY,
  id: 'viewer-share-gallery',
  share_token: 'viewer-token',
  share_role: 'viewer',
};

const EDITOR_SHARE = {
  ...PRIVATE_GALLERY,
  id: 'editor-share-gallery',
  share_token: 'editor-token',
  share_role: 'editor',
};

const EXPIRED_SHARE = {
  ...PRIVATE_GALLERY,
  id: 'expired-share-gallery',
  share_token: 'expired-token',
  share_role: 'editor',
  share_expires_at: '2000-01-01T00:00:00.000Z',
};

const galleries = new Map([
  [PUBLIC_GALLERY.id, PUBLIC_GALLERY],
  [PRIVATE_GALLERY.id, PRIVATE_GALLERY],
  [VIEWER_SHARE.id, VIEWER_SHARE],
  [EDITOR_SHARE.id, EDITOR_SHARE],
  [EXPIRED_SHARE.id, EXPIRED_SHARE],
]);

const shares = new Map([
  [VIEWER_SHARE.share_token, VIEWER_SHARE],
  [EDITOR_SHARE.share_token, EDITOR_SHARE],
  [EXPIRED_SHARE.share_token, EXPIRED_SHARE],
]);

const CUSTOM_AVATAR_APPEARANCE = {
  version: 1,
  body: 'body02',
  head: 'head02',
  eyes: 'eyes03',
  eyebrows: 'eyebrows03',
  mouth: 'mouth03',
  hair: 'hair03',
  top: 'top03',
  bottom: 'bottom03',
  shoes: 'shoes02',
  accessory: 'glasses01',
  colors: {
    skin: 'skin04',
    hair: 'hairRed',
    top: 'violet',
    bottom: 'brown',
    shoes: 'white',
  },
  facialPlacement: {
    eyes: { offsetY: 0.04, spacing: 0.03, scale: 1.2 },
    eyebrows: { offsetY: -0.02, spacing: 0.01, rotation: 0.18 },
    mouth: { offsetX: -0.03, offsetY: 0.02, scaleX: 1.25, scaleY: 0.85 },
  },
};

const VALID_ROOM_SIZE = {
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

function makeValidItem(id, overrides = {}) {
  return {
    id,
    type: 'painting',
    position: [0, 1, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    content: '',
    ...overrides,
  };
}

function makeValidFloorElement(id, overrides = {}) {
  return {
    id,
    type: 'room',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [10, 0.1, 10],
    ...overrides,
  };
}

function makeValidScene(overrides = {}) {
  return {
    roomSize: { ...VALID_ROOM_SIZE },
    items: [],
    floorPlanElements: [],
    wallMaterialOverrides: {},
    ...overrides,
  };
}

const servers = new Set();
const clients = new Set();

function waitForEvent(target, event, timeoutMs = 1000) {
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

function expectNoEvent(target, event, timeoutMs = 100) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      target.off(event, onEvent);
      resolve();
    }, timeoutMs);

    function onEvent(payload) {
      clearTimeout(timeout);
      reject(new Error(`unexpected ${event}: ${JSON.stringify(payload)}`));
    }

    target.once(event, onEvent);
  });
}

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function createDeferredSceneStore(methodName) {
  const inner = createMemorySceneStore();
  const started = deferred();
  const release = deferred();
  let shouldDefer = false;
  return {
    store: {
      initialize: (...args) => inner.initialize(...args),
      get: async (...args) => {
        if (methodName === 'get' && shouldDefer) {
          shouldDefer = false;
          started.resolve();
          await release.promise;
        }
        return inner.get(...args);
      },
      replace: async (...args) => {
        if (methodName === 'replace' && shouldDefer) {
          shouldDefer = false;
          started.resolve();
          await release.promise;
        }
        return inner.replace(...args);
      },
      applyOperation: async (...args) => {
        if (methodName === 'applyOperation' && shouldDefer) {
          shouldDefer = false;
          started.resolve();
          await release.promise;
        }
        return inner.applyOperation(...args);
      },
      delete: (...args) => inner.delete(...args),
      checkReadiness: (...args) => inner.checkReadiness(...args),
      close: (...args) => inner.close(...args),
    },
    deferNext() {
      shouldDefer = true;
    },
    started: started.promise,
    release: release.resolve,
  };
}

async function startServer(options = {}) {
  const normalizedOptions = options && (
    Object.prototype.hasOwnProperty.call(options, 'maxBytes')
    || Object.prototype.hasOwnProperty.call(options, 'maxItems')
  )
    ? { sceneLimits: options }
    : options;
  const getGallery = normalizedOptions.getGalleryById
    || (async (id) => galleries.get(id) || null);
  const server = startMultiplayerServer({
    initialPort: 0,
    corsOrigin: normalizedOptions.corsOrigin || 'http://localhost',
    allowMissingOrigin: normalizedOptions.allowMissingOrigin ?? true,
    verifyToken: normalizedOptions.verifyToken || ((token) => {
      if (token === 'participant-token') return { sub: 'user-2', name: 'Participant' };
      if (token === 'owner-token') return { sub: 'owner-1', name: 'Owner' };
      return null;
    }),
    getGalleryById: async (id) => {
      const gallery = await getGallery(id);
      if (!gallery || normalizedOptions.withPersistedScene === false) return gallery;
      return gallery.scene_json === undefined
        ? { ...gallery, scene_json: JSON.stringify(makeValidScene()) }
        : gallery;
    },
    getGalleryByShareToken: normalizedOptions.getGalleryByShareToken
      || (async (token) => shares.get(token) || null),
    verifySessionToken: normalizedOptions.verifySessionToken,
    sceneLimits: normalizedOptions.sceneLimits,
    connectionLimits: normalizedOptions.connectionLimits,
    joinLimits: normalizedOptions.joinLimits,
    startupLimits: normalizedOptions.startupLimits,
    movementLimits: normalizedOptions.movementLimits,
    appearanceRateLimitNow: normalizedOptions.appearanceRateLimitNow,
    authorizationSweepMs: normalizedOptions.authorizationSweepMs,
    collaboration: normalizedOptions.collaboration,
    sceneStore: normalizedOptions.sceneStore,
    sceneTtlMs: normalizedOptions.sceneTtlMs,
  });
  servers.add(server);

  await (server.ready || once(server.httpServer, 'listening'));

  expect(server.port()).toBeGreaterThan(0);
  return server;
}

async function connect(server, token = undefined) {
  const client = createClient(`http://127.0.0.1:${server.port()}`, {
    auth: token ? { token } : {},
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
  });
  clients.add(client);
  await waitForEvent(client, 'connect');
  return client;
}

async function connectWithOptions(server, options = {}) {
  const client = createClient(`http://127.0.0.1:${server.port()}`, {
    auth: options.token ? { token: options.token } : {},
    extraHeaders: options.origin ? { Origin: options.origin } : options.extraHeaders,
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    autoConnect: false,
  });
  clients.add(client);
  return client;
}

async function join(client, {
  roomId = PUBLIC_GALLERY.id,
  nickname = 'Tester',
  shareToken,
  ...untrusted
} = {}) {
  const joined = waitForEvent(client, 'room:joined');
  client.emit('room:join', {
    roomId,
    nickname,
    shareToken,
    ...untrusted,
  });
  const result = await joined;
  await new Promise((resolve) => setTimeout(resolve, 25));
  return result;
}

async function joinError(client, payload) {
  const error = waitForEvent(client, 'room:error');
  client.emit('room:join', payload);
  return error;
}

afterEach(async () => {
  for (const client of clients) {
    client.disconnect();
  }
  clients.clear();

  for (const server of servers) {
    await server.close();
  }
  servers.clear();
  galleries.set(PUBLIC_GALLERY.id, PUBLIC_GALLERY);
  galleries.set(PRIVATE_GALLERY.id, PRIVATE_GALLERY);
  galleries.set(VIEWER_SHARE.id, VIEWER_SHARE);
  galleries.set(EDITOR_SHARE.id, EDITOR_SHARE);
  galleries.set(EXPIRED_SHARE.id, EXPIRED_SHARE);
  shares.clear();
  shares.set(VIEWER_SHARE.share_token, VIEWER_SHARE);
  shares.set(EDITOR_SHARE.share_token, EDITOR_SHARE);
  shares.set(EXPIRED_SHARE.share_token, EXPIRED_SHARE);
});

describe('multiplayer room authorization', () => {
  it('immediately disconnects only the requested account sessions', async () => {
    const server = await startServer();
    const owner = await connect(server, 'owner-token');
    const other = await connect(server, 'participant-token');
    await join(owner);
    await join(other);
    const disconnected = waitForEvent(owner, 'disconnect');
    await server.revokeUserSessions('owner-1');
    await disconnected;
    expect(other.connected).toBe(true);
  });
  it('disconnects an established connection when its persisted session is revoked', async () => {
    let active = true;
    const server = await startServer({
      verifySessionToken: async token => active && token === 'owner-token' ? { sub: 'owner-1' } : null,
      authorizationSweepMs: 20,
    });
    const owner = await connect(server, 'owner-token');
    await join(owner, { roomId: PRIVATE_GALLERY.id });
    const disconnected = waitForEvent(owner, 'disconnect');
    active = false;
    await disconnected;
    expect(owner.connected).toBe(false);
    const stale = await connect(server, 'owner-token');
    await expect(joinError(stale, { roomId: PRIVATE_GALLERY.id, nickname: 'Owner' })).resolves.toMatchObject({ code: 'AUTH_REQUIRED' });
  });
  it('builds presence snapshots from all adapter-returned sockets', async () => {
    const remotePlayer = {
      id: 'remote-socket',
      nickname: 'Remote',
      position: { x: 1, y: 2, z: 3 },
      yaw: 0.5,
      lastSeq: 4,
      updatedAt: 123,
    };
    const fetchSockets = async () => [
      {
        id: 'remote-socket',
        data: {
          galleryId: PUBLIC_GALLERY.id,
          player: remotePlayer,
          playerAnnounced: true,
        },
      },
      {
        id: 'transient-socket',
        data: {
          galleryId: PUBLIC_GALLERY.id,
          player: { ...remotePlayer, id: 'transient-socket' },
          playerAnnounced: false,
        },
      },
      {
        id: 'other-room-socket',
        data: {
          galleryId: PRIVATE_GALLERY.id,
          player: { ...remotePlayer, id: 'other-room-socket' },
        },
      },
      {
        id: 'mismatched-id',
        data: {
          galleryId: PUBLIC_GALLERY.id,
          player: { ...remotePlayer, id: 'stale-id' },
        },
      },
    ];
    const io = {
      in: (roomId) => {
        expect(roomId).toBe(PUBLIC_GALLERY.id);
        return { fetchSockets };
      },
    };

    await expect(fetchRoomPlayers(io, PUBLIC_GALLERY.id))
      .resolves.toEqual([remotePlayer]);
    await expect(fetchRoomPlayers(io, PUBLIC_GALLERY.id, {
      includeSocketId: 'transient-socket',
    })).resolves.toEqual([
      remotePlayer,
      { ...remotePlayer, id: 'transient-socket' },
    ]);
  });

  it('accepts configured WebSocket origins and rejects mismatched origins', async () => {
    const server = await startServer({
      corsOrigin: ['https://allowed.example', 'https://second.example'],
      allowMissingOrigin: false,
    });
    const allowed = await connectWithOptions(server, {
      origin: 'https://allowed.example',
    });
    const connected = waitForEvent(allowed, 'connect');
    allowed.connect();
    await expect(connected).resolves.toBeUndefined();

    const evil = await connectWithOptions(server, {
      origin: 'https://evil.example',
    });
    const rejected = waitForEvent(evil, 'connect_error');
    evil.connect();
    await expect(rejected).resolves.toBeTruthy();
    expect(evil.connected).toBe(false);

    const missing = await connectWithOptions(server);
    const missingError = waitForEvent(missing, 'connect_error');
    missing.connect();
    await expect(missingError).resolves.toBeTruthy();
    expect(missing.connected).toBe(false);
  });

  it('exposes a ready promise that rejects after bounded port retries', async () => {
    const occupied = createHttpServer();
    occupied.listen(0);
    await once(occupied, 'listening');
    const occupiedPort = occupied.address().port;

    const server = startMultiplayerServer({
      initialPort: occupiedPort,
      corsOrigin: 'http://localhost',
      allowMissingOrigin: true,
      verifyToken: () => null,
      getGalleryById: async () => null,
      getGalleryByShareToken: async () => null,
      startupLimits: { maxPortRetries: 0, retryDelayMs: 1 },
    });
    servers.add(server);

    expect(server.ready).toBeInstanceOf(Promise);
    await expect(server.ready).rejects.toMatchObject({ code: 'EADDRINUSE' });

    await new Promise((resolve) => occupied.close(resolve));
  });

  it('enforces total and per-IP connection caps', async () => {
    const totalServer = await startServer({
      connectionLimits: { maxConnections: 1, maxConnectionsPerIp: 10 },
    });
    await connect(totalServer);
    const totalRejected = await connectWithOptions(totalServer);
    const totalError = waitForEvent(totalRejected, 'connect_error');
    totalRejected.connect();
    await expect(totalError).resolves.toMatchObject({
      message: expect.stringMatching(/connection limit/i),
    });

    const ipServer = await startServer({
      connectionLimits: { maxConnections: 10, maxConnectionsPerIp: 1 },
    });
    await connect(ipServer);
    const ipRejected = await connectWithOptions(ipServer);
    const ipError = waitForEvent(ipRejected, 'connect_error');
    ipRejected.connect();
    await expect(ipError).resolves.toMatchObject({
      message: expect.stringMatching(/connection limit/i),
    });
  });

  it('rate limits joins per socket and across reconnects from the same IP', async () => {
    const perSocketServer = await startServer({
      joinLimits: {
        perSocketLimit: 1,
        perSocketWindowMs: 60_000,
        perIpLimit: 100,
        perIpWindowMs: 60_000,
      },
    });
    const client = await connect(perSocketServer);
    await join(client);
    await expect(joinError(client, {
      roomId: PUBLIC_GALLERY.id,
      nickname: 'Again',
    })).resolves.toMatchObject({ code: 'RATE_LIMITED' });

    const perIpServer = await startServer({
      joinLimits: {
        perSocketLimit: 10,
        perSocketWindowMs: 60_000,
        perIpLimit: 1,
        perIpWindowMs: 60_000,
      },
    });
    const first = await connect(perIpServer);
    await join(first);
    first.disconnect();

    const reconnected = await connect(perIpServer);
    await expect(joinError(reconnected, {
      roomId: PUBLIC_GALLERY.id,
      nickname: 'Reconnect',
    })).resolves.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('joins an anonymous public client as a server-derived viewer', async () => {
    const server = await startServer();
    const client = await connect(server);

    const joined = await join(client, { role: 'owner', isHost: true });

    expect(joined).toMatchObject({
      roomId: PUBLIC_GALLERY.id,
      role: 'viewer',
    });
  });

  it('defaults legacy joins and includes appearance in join presence snapshots', async () => {
    const server = await startServer();
    const observer = await connect(server);
    const customized = await connect(server);

    const observerJoined = await join(observer, { nickname: 'Legacy' });
    expect(observerJoined.players).toContainEqual(expect.objectContaining({
      id: observer.id,
      appearance: DEFAULT_AVATAR_APPEARANCE,
    }));

    const announced = waitForEvent(observer, 'player:joined');
    const customizedJoined = await join(customized, {
      nickname: 'Customized',
      appearance: CUSTOM_AVATAR_APPEARANCE,
    });

    expect(customizedJoined.players).toContainEqual(expect.objectContaining({
      id: observer.id,
      appearance: DEFAULT_AVATAR_APPEARANCE,
    }));
    expect(customizedJoined.players).toContainEqual(expect.objectContaining({
      id: customized.id,
      appearance: CUSTOM_AVATAR_APPEARANCE,
    }));
    await expect(announced).resolves.toMatchObject({
      player: {
        id: customized.id,
        appearance: CUSTOM_AVATAR_APPEARANCE,
      },
    });
  });

  it('strictly rejects invalid appearance supplied while joining', async () => {
    const server = await startServer();
    const client = await connect(server);

    await expect(joinError(client, {
      roomId: PUBLIC_GALLERY.id,
      nickname: 'Invalid avatar',
      appearance: {
        ...CUSTOM_AVATAR_APPEARANCE,
        hair: 'remote-url',
      },
    })).resolves.toMatchObject({ code: 'INVALID_PAYLOAD' });
  });

  it('broadcasts valid appearance changes and persists them in room state', async () => {
    const server = await startServer();
    const player = await connect(server);
    const observer = await connect(server);
    await join(player);
    await join(observer);

    const changed = waitForEvent(observer, 'player:appearance:changed');
    player.emit('player:appearance', {
      roomId: PUBLIC_GALLERY.id,
      appearance: CUSTOM_AVATAR_APPEARANCE,
    });
    await expect(changed).resolves.toMatchObject({
      roomId: PUBLIC_GALLERY.id,
      id: player.id,
      appearance: CUSTOM_AVATAR_APPEARANCE,
      updatedAt: expect.any(Number),
    });

    const newcomer = await connect(server);
    const snapshot = await join(newcomer);
    expect(snapshot.players).toContainEqual(expect.objectContaining({
      id: player.id,
      appearance: CUSTOM_AVATAR_APPEARANCE,
    }));
  });

  it('rejects invalid and oversized appearance updates without mutating room state', async () => {
    const server = await startServer();
    const player = await connect(server);
    const observer = await connect(server);
    await join(player);
    await join(observer);

    const invalid = waitForEvent(player, 'room:error');
    const noInvalidBroadcast = expectNoEvent(observer, 'player:appearance:changed');
    player.emit('player:appearance', {
      roomId: PUBLIC_GALLERY.id,
      appearance: {
        ...CUSTOM_AVATAR_APPEARANCE,
        facialPlacement: {
          ...CUSTOM_AVATAR_APPEARANCE.facialPlacement,
          eyes: {
            ...CUSTOM_AVATAR_APPEARANCE.facialPlacement.eyes,
            offsetY: 0.101,
          },
        },
      },
    });
    await expect(invalid).resolves.toMatchObject({ code: 'INVALID_PAYLOAD' });
    await noInvalidBroadcast;

    const nonFinite = waitForEvent(player, 'room:error');
    const noNonFiniteBroadcast = expectNoEvent(observer, 'player:appearance:changed');
    player.emit('player:appearance', {
      roomId: PUBLIC_GALLERY.id,
      appearance: {
        ...CUSTOM_AVATAR_APPEARANCE,
        facialPlacement: {
          ...CUSTOM_AVATAR_APPEARANCE.facialPlacement,
          mouth: {
            ...CUSTOM_AVATAR_APPEARANCE.facialPlacement.mouth,
            scaleX: Number.POSITIVE_INFINITY,
          },
        },
      },
    });
    await expect(nonFinite).resolves.toMatchObject({ code: 'INVALID_PAYLOAD' });
    await noNonFiniteBroadcast;

    const oversized = waitForEvent(player, 'room:error');
    const noOversizedBroadcast = expectNoEvent(observer, 'player:appearance:changed');
    player.emit('player:appearance', {
      roomId: PUBLIC_GALLERY.id,
      appearance: {
        ...CUSTOM_AVATAR_APPEARANCE,
        facialPlacement: {
          ...CUSTOM_AVATAR_APPEARANCE.facialPlacement,
          eyes: {
            ...CUSTOM_AVATAR_APPEARANCE.facialPlacement.eyes,
            padding: 'x'.repeat(1024),
          },
        },
      },
    });
    await expect(oversized).resolves.toMatchObject({ code: 'INVALID_PAYLOAD' });
    await noOversizedBroadcast;

    const newcomer = await connect(server);
    const snapshot = await join(newcomer);
    expect(snapshot.players).toContainEqual(expect.objectContaining({
      id: player.id,
      appearance: DEFAULT_AVATAR_APPEARANCE,
    }));
  });

  it('rate limits appearance updates to once per socket every two seconds', async () => {
    let now = 1_000;
    const server = await startServer({
      appearanceRateLimitNow: () => now,
    });
    const player = await connect(server);
    const observer = await connect(server);
    await join(player);
    await join(observer);

    const first = waitForEvent(observer, 'player:appearance:changed');
    player.emit('player:appearance', {
      roomId: PUBLIC_GALLERY.id,
      appearance: CUSTOM_AVATAR_APPEARANCE,
    });
    await first;

    const limited = waitForEvent(player, 'room:error');
    const noSecondBroadcast = expectNoEvent(observer, 'player:appearance:changed');
    player.emit('player:appearance', {
      roomId: PUBLIC_GALLERY.id,
      appearance: DEFAULT_AVATAR_APPEARANCE,
    });
    await expect(limited).resolves.toMatchObject({ code: 'RATE_LIMITED' });
    await noSecondBroadcast;

    now += 2_000;
    const afterWindow = waitForEvent(observer, 'player:appearance:changed');
    player.emit('player:appearance', {
      roomId: PUBLIC_GALLERY.id,
      appearance: DEFAULT_AVATAR_APPEARANCE,
    });
    await expect(afterWindow).resolves.toMatchObject({
      appearance: DEFAULT_AVATAR_APPEARANCE,
    });
  });

  it('rejects movement payloads that smuggle appearance data', async () => {
    const server = await startServer();
    const player = await connect(server);
    const observer = await connect(server);
    await join(player);
    await join(observer);

    const invalid = waitForEvent(player, 'room:error');
    const noMove = expectNoEvent(observer, 'player:moved');
    player.emit('player:move', {
      roomId: PUBLIC_GALLERY.id,
      seq: 1,
      t: Date.now(),
      yaw: 0,
      position: { x: 1, y: 2.6, z: 1 },
      appearance: CUSTOM_AVATAR_APPEARANCE,
    });

    await expect(invalid).resolves.toMatchObject({ code: 'INVALID_PAYLOAD' });
    await noMove;
  });

  it('rejects anonymous private joins with AUTH_REQUIRED', async () => {
    const server = await startServer();
    const client = await connect(server);

    const error = await joinError(client, {
      roomId: PRIVATE_GALLERY.id,
      nickname: 'Anonymous',
    });

    expect(error).toMatchObject({ code: 'AUTH_REQUIRED' });
  });

  it('assigns participant and owner roles from verified JWT identity', async () => {
    const server = await startServer();
    const participant = await connect(server, 'participant-token');
    const owner = await connect(server, 'owner-token');

    await expect(join(participant)).resolves.toMatchObject({ role: 'participant' });
    await expect(join(owner, { roomId: PRIVATE_GALLERY.id })).resolves.toMatchObject({
      role: 'owner',
    });
  });

  it('assigns viewer and editor roles from valid shares and rejects expired shares', async () => {
    const server = await startServer();
    const viewer = await connect(server);
    const editor = await connect(server);
    const expired = await connect(server);

    await expect(join(viewer, {
      roomId: VIEWER_SHARE.id,
      shareToken: VIEWER_SHARE.share_token,
    })).resolves.toMatchObject({ role: 'viewer' });
    await expect(join(editor, {
      roomId: EDITOR_SHARE.id,
      shareToken: EDITOR_SHARE.share_token,
    })).resolves.toMatchObject({ role: 'editor' });
    await expect(joinError(expired, {
      roomId: EXPIRED_SHARE.id,
      shareToken: EXPIRED_SHARE.share_token,
    })).resolves.toMatchObject({ code: 'SHARE_EXPIRED' });
  });

  it.each([
    ['revoked', () => shares.delete(EDITOR_SHARE.share_token), 'INVALID_SHARE'],
    ['expired', () => {
      const expired = {
        ...EDITOR_SHARE,
        share_expires_at: '2000-01-01T00:00:00.000Z',
      };
      galleries.set(expired.id, expired);
      shares.set(expired.share_token, expired);
    }, 'SHARE_EXPIRED'],
  ])('revalidates an editor share that becomes %s before scene mutation', async (
    _case,
    revokeAccess,
    expectedCode,
  ) => {
    const server = await startServer();
    const editor = await connect(server);
    const observer = await connect(server);
    await join(editor, {
      roomId: EDITOR_SHARE.id,
      shareToken: EDITOR_SHARE.share_token,
    });
    await join(observer, {
      roomId: EDITOR_SHARE.id,
      shareToken: EDITOR_SHARE.share_token,
    });

    revokeAccess();
    const denied = waitForEvent(editor, 'room:error');
    const noAck = expectNoEvent(editor, 'scene:op:ack');
    const noBroadcast = expectNoEvent(observer, 'scene:oped');
    editor.emit('scene:op', {
      roomId: EDITOR_SHARE.id,
      clientOpId: `stale-${_case}`,
      op: { kind: 'add-item', item: makeValidItem(`stale-${_case}`) },
    });

    await expect(denied).resolves.toMatchObject({ code: expectedCode });
    await Promise.all([noAck, noBroadcast]);

    galleries.set(EDITOR_SHARE.id, EDITOR_SHARE);
    shares.set(EDITOR_SHARE.share_token, EDITOR_SHARE);
  });

  it('evicts a socket when its resolved role changes', async () => {
    const server = await startServer();
    const editor = await connect(server);
    const observer = await connect(server);
    await join(editor, {
      roomId: EDITOR_SHARE.id,
      shareToken: EDITOR_SHARE.share_token,
    });
    await join(observer, {
      roomId: EDITOR_SHARE.id,
      shareToken: EDITOR_SHARE.share_token,
    });

    const downgraded = { ...EDITOR_SHARE, share_role: 'viewer' };
    galleries.set(downgraded.id, downgraded);
    shares.set(downgraded.share_token, downgraded);

    const denied = waitForEvent(editor, 'room:error');
    const left = waitForEvent(observer, 'player:left');
    editor.emit('scene:focus', {
      roomId: EDITOR_SHARE.id,
      itemId: null,
    });

    await expect(denied).resolves.toMatchObject({ code: 'FORBIDDEN' });
    await expect(left).resolves.toMatchObject({ id: editor.id });
  });

  it.each([
    ['chat:send', { message: 'stale', nickname: 'Editor' }, 'chat:new'],
    ['scene:sync', { scene: { items: [], floorPlanElements: [] } }, 'scene:synced'],
    ['scene:focus', { itemId: null, nickname: 'Editor' }, 'scene:focus'],
  ])('revalidates a revoked share before %s', async (
    eventName,
    eventPayload,
    broadcastName,
  ) => {
    const server = await startServer();
    const editor = await connect(server);
    const observer = await connect(server);
    await join(editor, {
      roomId: EDITOR_SHARE.id,
      shareToken: EDITOR_SHARE.share_token,
    });
    await join(observer, {
      roomId: EDITOR_SHARE.id,
      shareToken: EDITOR_SHARE.share_token,
    });

    shares.delete(EDITOR_SHARE.share_token);
    const denied = waitForEvent(editor, 'room:error');
    const noBroadcast = expectNoEvent(observer, broadcastName);
    editor.emit(eventName, {
      roomId: EDITOR_SHARE.id,
      ...eventPayload,
    });

    await expect(denied).resolves.toMatchObject({ code: 'INVALID_SHARE' });
    await noBroadcast;
    shares.set(EDITOR_SHARE.share_token, EDITOR_SHARE);
  });

  it('clears old membership when a same-room rejoin is denied', async () => {
    const server = await startServer();
    const editor = await connect(server);
    const observer = await connect(server);
    await join(editor, {
      roomId: EDITOR_SHARE.id,
      shareToken: EDITOR_SHARE.share_token,
    });
    await join(observer, {
      roomId: EDITOR_SHARE.id,
      shareToken: EDITOR_SHARE.share_token,
    });

    shares.delete(EDITOR_SHARE.share_token);
    const left = waitForEvent(observer, 'player:left');
    const denied = joinError(editor, {
      roomId: EDITOR_SHARE.id,
      nickname: 'Editor',
      shareToken: EDITOR_SHARE.share_token,
    });

    await expect(denied).resolves.toMatchObject({ code: 'INVALID_SHARE' });
    await expect(left).resolves.toMatchObject({ id: editor.id });

    const notJoined = waitForEvent(editor, 'room:error');
    editor.emit('scene:focus', {
      roomId: EDITOR_SHARE.id,
      itemId: null,
    });
    await expect(notJoined).resolves.toMatchObject({ code: 'NOT_JOINED' });
    shares.set(EDITOR_SHARE.share_token, EDITOR_SHARE);
  });

  it('re-verifies the original JWT before a same-room private rejoin', async () => {
    let tokenValid = true;
    const server = await startServer({
      verifyToken: (token) => (
        tokenValid && token === 'owner-token'
          ? { sub: 'owner-1', name: 'Owner' }
          : null
      ),
    });
    const owner = await connect(server, 'owner-token');
    const observer = await connect(server, 'owner-token');
    await join(owner, { roomId: PRIVATE_GALLERY.id });
    await join(observer, { roomId: PRIVATE_GALLERY.id });

    tokenValid = false;
    const ownerId = owner.id;
    const left = waitForEvent(observer, 'player:left');
    const disconnected = waitForEvent(owner, 'disconnect');
    await expect(joinError(owner, {
      roomId: PRIVATE_GALLERY.id,
      nickname: 'Owner',
    })).resolves.toMatchObject({ code: 'AUTH_REQUIRED' });
    await expect(left).resolves.toMatchObject({ id: ownerId });
    await expect(disconnected).resolves.toBe('io server disconnect');
    expect(owner.connected).toBe(false);
  });

  it('rejects an event whose authorization completes after the socket joins another room', async () => {
    let delayNextGalleryA = false;
    let releaseGalleryA;
    const galleryAReleased = new Promise((resolve) => {
      releaseGalleryA = resolve;
    });
    const server = await startServer({
      getGalleryById: async (id) => {
        if (id === PRIVATE_GALLERY.id && delayNextGalleryA) {
          await galleryAReleased;
        }
        return galleries.get(id) || null;
      },
    });
    const owner = await connect(server, 'owner-token');
    const observerA = await connect(server, 'owner-token');
    const observerB = await connect(server, 'owner-token');
    await join(owner, { roomId: PRIVATE_GALLERY.id });
    await join(observerA, { roomId: PRIVATE_GALLERY.id });
    await join(observerB, { roomId: PUBLIC_GALLERY.id });

    delayNextGalleryA = true;
    const staleError = waitForEvent(owner, 'room:error');
    const noAck = expectNoEvent(owner, 'scene:op:ack', 250);
    const noBroadcastA = expectNoEvent(observerA, 'scene:oped', 250);
    const noBroadcastB = expectNoEvent(observerB, 'scene:oped', 250);
    owner.emit('scene:op', {
      roomId: PRIVATE_GALLERY.id,
      clientOpId: 'stale-room-op',
      op: { kind: 'add-item', item: makeValidItem('stale-room-item') },
    });

    await expect(join(owner, { roomId: PUBLIC_GALLERY.id })).resolves.toMatchObject({
      roomId: PUBLIC_GALLERY.id,
      role: 'owner',
    });
    releaseGalleryA();

    await expect(staleError).resolves.toMatchObject({ code: 'FORBIDDEN' });
    await Promise.all([noAck, noBroadcastA, noBroadcastB]);
  });

  it('revalidates player movement and evicts revoked passive viewers during sweep', async () => {
    const server = await startServer({ authorizationSweepMs: 20 });
    const viewer = await connect(server);
    const owner = await connect(server, 'owner-token');
    await join(viewer, {
      roomId: VIEWER_SHARE.id,
      shareToken: VIEWER_SHARE.share_token,
    });
    await join(owner, { roomId: VIEWER_SHARE.id });

    shares.delete(VIEWER_SHARE.share_token);
    const moveDenied = waitForEvent(viewer, 'room:error');
    const noMove = expectNoEvent(owner, 'player:moved');
    viewer.emit('player:move', {
      roomId: VIEWER_SHARE.id,
      seq: 1,
      t: Date.now(),
      yaw: 0,
      position: { x: 1, y: 0, z: 1 },
    });
    await expect(moveDenied).resolves.toMatchObject({ code: 'INVALID_SHARE' });
    await noMove;

    shares.set(VIEWER_SHARE.share_token, VIEWER_SHARE);
    await join(viewer, {
      roomId: VIEWER_SHARE.id,
      shareToken: VIEWER_SHARE.share_token,
    });
    shares.delete(VIEWER_SHARE.share_token);

    const swept = waitForEvent(viewer, 'room:error');
    await expect(swept).resolves.toMatchObject({ code: 'INVALID_SHARE' });

    const noScene = expectNoEvent(viewer, 'scene:oped', 150);
    const ack = waitForEvent(owner, 'scene:op:ack');
    owner.emit('scene:op', {
      roomId: VIEWER_SHARE.id,
      clientOpId: 'after-viewer-revocation',
      op: { kind: 'add-item', item: makeValidItem('owner-item') },
    });
    await ack;
    await noScene;
  });

  it('stops the authorization sweep when the server closes', async () => {
    let galleryLookups = 0;
    const server = await startServer({
      authorizationSweepMs: 15,
      getGalleryById: async (id) => {
        galleryLookups += 1;
        return galleries.get(id) || null;
      },
    });
    const viewer = await connect(server);
    await join(viewer);

    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(galleryLookups).toBeGreaterThan(1);

    await server.close();
    servers.delete(server);
    const lookupsAfterClose = galleryLookups;
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(galleryLookups).toBe(lookupsAfterClose);
  });

  it('updates a same-room role without broadcasting a duplicate player join', async () => {
    const server = await startServer();
    const editor = await connect(server);
    const observer = await connect(server);
    await join(editor, {
      roomId: EDITOR_SHARE.id,
      shareToken: EDITOR_SHARE.share_token,
    });
    await join(observer, {
      roomId: EDITOR_SHARE.id,
      shareToken: EDITOR_SHARE.share_token,
    });

    const noDuplicate = expectNoEvent(observer, 'player:joined');
    await expect(join(editor, {
      roomId: EDITOR_SHARE.id,
      shareToken: EDITOR_SHARE.share_token,
    })).resolves.toMatchObject({ role: 'editor' });
    await noDuplicate;
  });

  it('updates duplicate-join nickname while preserving the socket movement sequence', async () => {
    const server = await startServer();
    const player = await connect(server);
    const observer = await connect(server);
    await join(player, { nickname: 'Before' });
    await join(observer);

    const moved = waitForEvent(observer, 'player:moved');
    player.emit('player:move', {
      roomId: PUBLIC_GALLERY.id,
      seq: 7,
      t: Date.now(),
      yaw: 1,
      position: { x: 3, y: 2.6, z: 4 },
    });
    await moved;

    const noDuplicate = expectNoEvent(observer, 'player:joined');
    const rejoined = await join(player, { nickname: 'After' });
    await noDuplicate;
    expect(rejoined.players).toContainEqual(expect.objectContaining({
      id: player.id,
      nickname: 'After',
      lastSeq: 7,
      position: { x: 3, y: 2.6, z: 4 },
    }));
  });

  it('keeps movement sequence state on the socket and ignores stale moves', async () => {
    const server = await startServer();
    const mover = await connect(server);
    const observer = await connect(server);
    await join(mover);
    await join(observer);

    const moved = waitForEvent(observer, 'player:moved');
    mover.emit('player:move', {
      roomId: PUBLIC_GALLERY.id,
      seq: 2,
      t: Date.now(),
      yaw: 0.25,
      pose: 'sitting',
      emote: 'clap',
      emoteNonce: 3,
      position: { x: 2, y: 2.6, z: 2 },
    });
    await expect(moved).resolves.toMatchObject({
      seq: 2,
      pose: 'sitting',
      emote: 'clap',
      emoteNonce: 3,
    });

    const noStaleMove = expectNoEvent(observer, 'player:moved');
    mover.emit('player:move', {
      roomId: PUBLIC_GALLERY.id,
      seq: 1,
      t: Date.now(),
      yaw: 1,
      position: { x: 9, y: 2.6, z: 9 },
    });
    await noStaleMove;

    const newcomer = await connect(server);
    const snapshot = await join(newcomer);
    expect(snapshot.players).toContainEqual(expect.objectContaining({
      id: mover.id,
      lastSeq: 2,
      yaw: 0.25,
      pose: 'sitting',
      emote: 'clap',
      emoteNonce: 3,
      position: { x: 2, y: 2.6, z: 2 },
    }));
  });

  it('broadcasts one leave and keeps live scene state after the local last player leaves', async () => {
    const server = await startServer();
    const owner = await connect(server, 'owner-token');
    const observer = await connect(server);
    await join(owner);
    await join(observer);

    const synced = waitForEvent(observer, 'scene:synced');
    owner.emit('scene:sync', {
      roomId: PUBLIC_GALLERY.id,
      expectedVersion: 1,
      scene: makeValidScene({
        items: [makeValidItem('persistent-item')],
      }),
    });
    await synced;

    const left = waitForEvent(observer, 'player:left');
    const ownerId = owner.id;
    owner.disconnect();
    await expect(left).resolves.toMatchObject({ id: ownerId });
    await expectNoEvent(observer, 'player:left');

    observer.disconnect();
    const newcomer = await connect(server);
    const sceneAfterEmpty = waitForEvent(newcomer, 'scene:synced');
    await join(newcomer);
    await expect(sceneAfterEmpty).resolves.toMatchObject({
      scene: { items: [{ id: 'persistent-item' }] },
    });
  });

  it('serializes a delayed old leave before a newer same-room join', async () => {
    let watchLatestLookup = false;
    let markLatestLookup;
    const latestLookupStarted = new Promise((resolve) => {
      markLatestLookup = resolve;
    });
    const server = await startServer({
      getGalleryById: async (id) => {
        if (watchLatestLookup && id === PUBLIC_GALLERY.id) {
          markLatestLookup();
        }
        return galleries.get(id) || null;
      },
    });
    const observer = await connect(server, 'owner-token');
    const player = await connect(server, 'owner-token');
    await join(observer);
    await join(player, { nickname: 'Initial' });

    const serverSocket = server.io.of('/').sockets.get(player.id);
    const originalLeave = serverSocket.leave.bind(serverSocket);
    let releaseLeave;
    let markLeaveStarted;
    const leaveStarted = new Promise((resolve) => {
      markLeaveStarted = resolve;
    });
    const leaveReleased = new Promise((resolve) => {
      releaseLeave = resolve;
    });
    let delayNextLeave = true;
    serverSocket.leave = async (roomId) => {
      if (delayNextLeave) {
        delayNextLeave = false;
        markLeaveStarted();
        await leaveReleased;
      }
      return originalLeave(roomId);
    };

    const leftEvents = [];
    observer.on('player:left', (payload) => leftEvents.push(payload));
    player.emit('room:join', {
      roomId: PRIVATE_GALLERY.id,
      nickname: 'Stale switch',
    });
    await leaveStarted;

    const latestJoin = waitForEvent(player, 'room:joined');
    watchLatestLookup = true;
    player.emit('room:join', {
      roomId: PUBLIC_GALLERY.id,
      nickname: 'Latest',
    });
    await latestLookupStarted;
    releaseLeave();

    const joined = await latestJoin;
    expect(joined).toMatchObject({ roomId: PUBLIC_GALLERY.id });
    expect(joined.players).toContainEqual(expect.objectContaining({
      id: player.id,
      nickname: 'Latest',
    }));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(leftEvents).toEqual([{
      roomId: PUBLIC_GALLERY.id,
      id: player.id,
    }]);
    expect(serverSocket.rooms.has(PUBLIC_GALLERY.id)).toBe(true);
    expect(serverSocket.rooms.has(PRIVATE_GALLERY.id)).toBe(false);
    expect(serverSocket.data).toMatchObject({
      galleryId: PUBLIC_GALLERY.id,
      player: { id: player.id, nickname: 'Latest' },
    });
  });

  it('cleans a stale delayed switch join without ghost presence events', async () => {
    let watchLatestLookup = false;
    let markLatestLookup;
    const latestLookupStarted = new Promise((resolve) => {
      markLatestLookup = resolve;
    });
    const server = await startServer({
      getGalleryById: async (id) => {
        if (watchLatestLookup && id === PUBLIC_GALLERY.id) {
          markLatestLookup();
        }
        return galleries.get(id) || null;
      },
    });
    const observerA = await connect(server, 'owner-token');
    const observerB = await connect(server, 'owner-token');
    const player = await connect(server, 'owner-token');
    await join(observerA);
    await join(observerB, { roomId: PRIVATE_GALLERY.id });
    await join(player, { nickname: 'Initial' });

    const serverSocket = server.io.of('/').sockets.get(player.id);
    const originalJoin = serverSocket.join.bind(serverSocket);
    let releaseJoin;
    let markJoinStarted;
    const joinStarted = new Promise((resolve) => {
      markJoinStarted = resolve;
    });
    const joinReleased = new Promise((resolve) => {
      releaseJoin = resolve;
    });
    let delaySwitchJoin = true;
    serverSocket.join = async (roomId) => {
      if (delaySwitchJoin && roomId === PRIVATE_GALLERY.id) {
        delaySwitchJoin = false;
        markJoinStarted();
        await joinReleased;
      }
      return originalJoin(roomId);
    };

    const noGhostJoin = expectNoEvent(observerB, 'player:joined', 250);
    const noGhostLeave = expectNoEvent(observerB, 'player:left', 250);
    player.emit('room:join', {
      roomId: PRIVATE_GALLERY.id,
      nickname: 'Stale switch',
    });
    await joinStarted;

    const latestJoin = waitForEvent(player, 'room:joined');
    watchLatestLookup = true;
    player.emit('room:join', {
      roomId: PUBLIC_GALLERY.id,
      nickname: 'Latest',
    });
    await latestLookupStarted;
    releaseJoin();

    await expect(latestJoin).resolves.toMatchObject({
      roomId: PUBLIC_GALLERY.id,
    });
    await Promise.all([noGhostJoin, noGhostLeave]);

    const roomAPlayers = await fetchRoomPlayers(server.io, PUBLIC_GALLERY.id);
    const roomBPlayers = await fetchRoomPlayers(server.io, PRIVATE_GALLERY.id);
    expect(roomAPlayers.filter(({ id }) => id === player.id)).toEqual([
      expect.objectContaining({ nickname: 'Latest' }),
    ]);
    expect(roomBPlayers.some(({ id }) => id === player.id)).toBe(false);
    expect(serverSocket.data).toMatchObject({
      galleryId: PUBLIC_GALLERY.id,
      player: { id: player.id, nickname: 'Latest' },
    });
  });

  it('hides adapter-joined transient presence from another joining socket', async () => {
    const server = await startServer();
    const observer = await connect(server);
    const transient = await connect(server);
    const newcomer = await connect(server);
    await join(observer, { nickname: 'Observer' });

    const transientId = transient.id;
    const serverSocket = server.io.of('/').sockets.get(transientId);
    const originalJoin = serverSocket.join.bind(serverSocket);
    let releaseJoin;
    let markAdapterJoined;
    const adapterJoined = new Promise((resolve) => {
      markAdapterJoined = resolve;
    });
    const joinReleased = new Promise((resolve) => {
      releaseJoin = resolve;
    });
    serverSocket.join = async (roomId) => {
      const result = await originalJoin(roomId);
      markAdapterJoined();
      await joinReleased;
      return result;
    };

    const joinedEvents = [];
    const leftEvents = [];
    observer.on('player:joined', (payload) => joinedEvents.push(payload));
    observer.on('player:left', (payload) => leftEvents.push(payload));
    transient.emit('room:join', {
      roomId: PUBLIC_GALLERY.id,
      nickname: 'Transient',
    });
    await adapterJoined;

    expect(serverSocket.rooms.has(PUBLIC_GALLERY.id)).toBe(true);
    expect(serverSocket.data).toMatchObject({
      galleryId: PUBLIC_GALLERY.id,
      playerAnnounced: false,
      player: { id: transientId, nickname: 'Transient' },
    });

    const newcomerSnapshot = await join(newcomer, { nickname: 'Newcomer' });
    expect(newcomerSnapshot.players.some(({ id }) => id === transientId))
      .toBe(false);
    expect(newcomerSnapshot.players).toContainEqual(expect.objectContaining({
      id: newcomer.id,
      nickname: 'Newcomer',
    }));

    const disconnecting = waitForEvent(serverSocket, 'disconnecting');
    transient.disconnect();
    await disconnecting;
    releaseJoin();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(joinedEvents.some(({ player }) => player.id === transientId))
      .toBe(false);
    expect(leftEvents.some(({ id }) => id === transientId)).toBe(false);
    expect(serverSocket.data).toMatchObject({
      galleryId: null,
      player: null,
      playerAnnounced: false,
      membershipClosed: true,
    });
    const finalSnapshot = await fetchRoomPlayers(server.io, PUBLIC_GALLERY.id);
    expect(finalSnapshot.some(({ id }) => id === transientId)).toBe(false);
  });

  it('returns stable errors for missing galleries, invalid shares, and events before joining', async () => {
    const server = await startServer();
    const client = await connect(server);

    await expect(joinError(client, {
      roomId: 'missing-gallery',
      nickname: 'Missing',
    })).resolves.toMatchObject({ code: 'NOT_FOUND' });
    await expect(joinError(client, {
      roomId: PRIVATE_GALLERY.id,
      nickname: 'Bad share',
      shareToken: 'not-a-share',
    })).resolves.toMatchObject({ code: 'INVALID_SHARE' });

    const notJoined = waitForEvent(client, 'room:error');
    client.emit('player:move', {
      roomId: PUBLIC_GALLERY.id,
      seq: 1,
      t: Date.now(),
      yaw: 0,
      position: { x: 0, y: 0, z: 0 },
    });
    await expect(notJoined).resolves.toMatchObject({ code: 'NOT_JOINED' });
  });

  it('rejects viewer scene operations without ack, broadcast, or mutation', async () => {
    const server = await startServer();
    const viewer = await connect(server);
    const owner = await connect(server, 'owner-token');
    await join(viewer);
    await join(owner);

    const forbidden = waitForEvent(viewer, 'room:error');
    const noAck = expectNoEvent(viewer, 'scene:op:ack');
    const noBroadcast = expectNoEvent(owner, 'scene:oped');
    viewer.emit('scene:op', {
      roomId: PUBLIC_GALLERY.id,
      clientOpId: 'viewer-op',
      op: { kind: 'add-item', item: makeValidItem('forbidden-item') },
    });

    await expect(forbidden).resolves.toMatchObject({
      code: 'FORBIDDEN',
      roomId: PUBLIC_GALLERY.id,
      clientOpId: 'viewer-op',
    });
    await Promise.all([noAck, noBroadcast]);

    const observer = await connect(server);
    await join(observer);
    await expectNoEvent(observer, 'scene:synced');
  });

  it('broadcasts participant chat and rejects anonymous viewer chat', async () => {
    const server = await startServer();
    const viewer = await connect(server);
    const participant = await connect(server, 'participant-token');
    await join(viewer);
    await join(participant);

    const chat = waitForEvent(viewer, 'chat:new');
    const senderChat = waitForEvent(participant, 'chat:new');
    participant.emit('chat:send', {
      roomId: PUBLIC_GALLERY.id,
      nickname: 'Participant',
      message: 'hello',
    });
    await expect(chat).resolves.toMatchObject({ message: 'hello' });
    await senderChat;

    const forbidden = waitForEvent(viewer, 'room:error');
    const noChat = expectNoEvent(participant, 'chat:new');
    viewer.emit('chat:send', {
      roomId: PUBLIC_GALLERY.id,
      nickname: 'Viewer',
      message: 'blocked',
    });
    await expect(forbidden).resolves.toMatchObject({ code: 'FORBIDDEN' });
    await noChat;
  });

  it.each([
    ['owner', 'owner-token', PUBLIC_GALLERY.id, undefined],
    ['editor', undefined, EDITOR_SHARE.id, EDITOR_SHARE.share_token],
  ])('acknowledges and broadcasts %s scene operations', async (
    _role,
    token,
    roomId,
    shareToken,
  ) => {
    const server = await startServer();
    const editor = await connect(server, token);
    const observer = await connect(server, token === 'owner-token' ? 'participant-token' : undefined);
    await join(editor, { roomId, shareToken });
    await join(observer, { roomId, shareToken });

    const ack = waitForEvent(editor, 'scene:op:ack');
    const broadcast = waitForEvent(observer, 'scene:oped');
    editor.emit('scene:op', {
      roomId,
      clientOpId: `${_role}-op`,
      op: {
        kind: 'add-item',
        item: makeValidItem(`${_role}-item`, { title: 'Item' }),
      },
    });

    await expect(ack).resolves.toMatchObject({ clientOpId: `${_role}-op` });
    await expect(broadcast).resolves.toMatchObject({
      clientOpId: `${_role}-op`,
      op: { kind: 'add-item' },
    });
  });

  it('synchronizes floor-plan and wall-material operations', async () => {
    const server = await startServer();
    const owner = await connect(server, 'owner-token');
    const observer = await connect(server, 'participant-token');
    await join(owner);
    await join(observer);

    const floorAck = waitForEvent(owner, 'scene:op:ack');
    const floorBroadcast = waitForEvent(observer, 'scene:oped');
    owner.emit('scene:op', {
      roomId: PUBLIC_GALLERY.id,
      clientOpId: 'floor-plan',
      op: { kind: 'set-floor-plan', floorPlanElements: [makeValidFloorElement('wall-1')] },
    });
    await expect(floorAck).resolves.toMatchObject({ clientOpId: 'floor-plan' });
    await expect(floorBroadcast).resolves.toMatchObject({
      op: { kind: 'set-floor-plan', floorPlanElements: [{ id: 'wall-1' }] },
    });

    const wallAck = waitForEvent(owner, 'scene:op:ack');
    const wallBroadcast = waitForEvent(observer, 'scene:oped');
    owner.emit('scene:op', {
      roomId: PUBLIC_GALLERY.id,
      clientOpId: 'wall-material',
      op: { kind: 'set-wall-material-overrides', wallMaterialOverrides: { 'wall-1': 'wood' } },
    });
    await expect(wallAck).resolves.toMatchObject({ clientOpId: 'wall-material' });
    await expect(wallBroadcast).resolves.toMatchObject({
      op: { kind: 'set-wall-material-overrides', wallMaterialOverrides: { 'wall-1': 'wood' } },
    });
  });

  it('rejects invalid and oversized scenes without broadcasting them', async () => {
    const server = await startServer({
      maxBytes: 256,
      maxItems: 1,
      maxFloorPlanElements: 1,
      operationLimit: 20,
      operationWindowMs: 1000,
    });
    const owner = await connect(server, 'owner-token');
    const observer = await connect(server, 'participant-token');
    await join(owner);
    await join(observer);

    for (const scene of [
      { items: [{ id: 'one' }, { id: 'two' }], floorPlanElements: [] },
      { items: [{ id: 'one', text: 'x'.repeat(300) }], floorPlanElements: [] },
      { roomSize: { width: Number.NaN, height: 3, depth: 4 }, items: [], floorPlanElements: [] },
    ]) {
      const invalid = waitForEvent(owner, 'room:error');
      const noBroadcast = expectNoEvent(observer, 'scene:synced');
      owner.emit('scene:sync', { roomId: PUBLIC_GALLERY.id, scene });
      await expect(invalid).resolves.toMatchObject({ code: 'INVALID_PAYLOAD' });
      await noBroadcast;
    }
  });

  it('rejects malformed and duplicate item or floor element IDs', async () => {
    const server = await startServer();
    const owner = await connect(server, 'owner-token');
    await join(owner);

    const invalidScenes = [
      { items: [{}], floorPlanElements: [] },
      { items: [{ id: 'same' }, { id: 'same' }], floorPlanElements: [] },
      { items: [null], floorPlanElements: [] },
      { items: [], floorPlanElements: [{}] },
      { items: [], floorPlanElements: [{ id: 'same' }, { id: 'same' }] },
      { items: [], floorPlanElements: [null] },
    ];

    for (const scene of invalidScenes) {
      const invalid = waitForEvent(owner, 'room:error');
      owner.emit('scene:sync', { roomId: PUBLIC_GALLERY.id, scene });
      await expect(invalid).resolves.toMatchObject({ code: 'INVALID_PAYLOAD' });
    }
  });

  it('rejects payload structures deeper than the traversal limit', async () => {
    const server = await startServer();
    const owner = await connect(server, 'owner-token');
    await join(owner);

    let nested = { value: 'leaf' };
    for (let depth = 0; depth < 25; depth += 1) {
      nested = { child: nested };
    }

    const invalid = waitForEvent(owner, 'room:error');
    owner.emit('scene:op', {
      roomId: PUBLIC_GALLERY.id,
      clientOpId: 'too-deep',
      op: {
        kind: 'add-item',
        item: makeValidItem('deep-item', { nested }),
      },
    });
    await expect(invalid).resolves.toMatchObject({ code: 'INVALID_PAYLOAD' });
    await expectNoEvent(owner, 'scene:op:ack');
  });

  it('rejects unsafe movement sequence, time, yaw, and coordinates', async () => {
    const server = await startServer({
      movementLimits: {
        maxCoordinateAbs: 10,
        maxYawAbs: Math.PI * 2,
        maxTimestamp: Number.MAX_SAFE_INTEGER,
      },
    });
    const mover = await connect(server);
    const observer = await connect(server);
    await join(mover);
    await join(observer);

    const base = {
      roomId: PUBLIC_GALLERY.id,
      seq: 1,
      t: Date.now(),
      yaw: 0,
      position: { x: 0, y: 0, z: 0 },
    };
    const invalidMoves = [
      { ...base, seq: -1 },
      { ...base, seq: 1.5 },
      { ...base, t: -1 },
      { ...base, t: Number.MAX_SAFE_INTEGER + 1 },
      { ...base, yaw: Math.PI * 3 },
      { ...base, position: { x: 11, y: 0, z: 0 } },
    ];

    for (const payload of invalidMoves) {
      const invalid = waitForEvent(mover, 'room:error');
      const noMove = expectNoEvent(observer, 'player:moved');
      mover.emit('player:move', payload);
      await expect(invalid).resolves.toMatchObject({ code: 'INVALID_PAYLOAD' });
      await noMove;
    }
  });

  it('rejects unsupported, prototype-polluting, and oversized scene operations', async () => {
    const server = await startServer({
      maxBytes: 256,
      maxItems: 10,
      maxFloorPlanElements: 10,
      operationLimit: 20,
      operationWindowMs: 1000,
    });
    const owner = await connect(server, 'owner-token');
    await join(owner);

    const operations = [
      { kind: 'unknown' },
      { kind: 'update-item', id: 'item', updates: { constructor: { polluted: true } } },
      {
        kind: 'add-item',
        item: makeValidItem('huge', { content: 'x'.repeat(300) }),
      },
    ];

    for (const [index, op] of operations.entries()) {
      const invalid = waitForEvent(owner, 'room:error');
      owner.emit('scene:op', {
        roomId: PUBLIC_GALLERY.id,
        clientOpId: `invalid-${index}`,
        op,
      });
      await expect(invalid).resolves.toMatchObject({ code: 'INVALID_PAYLOAD' });
      await expectNoEvent(owner, 'scene:op:ack');
    }
  });

  it('rate limits scene operations per socket', async () => {
    const server = await startServer({
      maxBytes: 1024,
      maxItems: 10,
      maxFloorPlanElements: 10,
      operationLimit: 1,
      operationWindowMs: 60_000,
    });
    const owner = await connect(server, 'owner-token');
    await join(owner);

    const firstAck = waitForEvent(owner, 'scene:op:ack');
    owner.emit('scene:op', {
      roomId: PUBLIC_GALLERY.id,
      clientOpId: 'first',
      op: { kind: 'add-item', item: makeValidItem('first') },
    });
    await firstAck;

    const limited = waitForEvent(owner, 'room:error');
    owner.emit('scene:op', {
      roomId: PUBLIC_GALLERY.id,
      clientOpId: 'second',
      op: { kind: 'add-item', item: makeValidItem('second') },
    });
    await expect(limited).resolves.toMatchObject({
      code: 'RATE_LIMITED',
      roomId: PUBLIC_GALLERY.id,
      clientOpId: 'second',
    });
  });

  it('correlates a rate-limited recovery scene sync', async () => {
    const server = await startServer({
      maxBytes: 1024 * 1024,
      operationLimit: 1,
      operationWindowMs: 60_000,
    });
    const owner = await connect(server, 'owner-token');
    await join(owner);

    const firstSynced = waitForEvent(owner, 'scene:synced');
    owner.emit('scene:sync', {
      roomId: PUBLIC_GALLERY.id,
      expectedVersion: 1,
      scene: makeValidScene({ items: [makeValidItem('consume-token')] }),
    });
    await firstSynced;

    const limited = waitForEvent(owner, 'room:error');
    owner.emit('scene:sync', {
      roomId: PUBLIC_GALLERY.id,
      clientSyncId: 'rate-limited-recovery',
      expectedVersion: 2,
      scene: makeValidScene(),
    });
    await expect(limited).resolves.toMatchObject({
      code: 'RATE_LIMITED',
      roomId: PUBLIC_GALLERY.id,
      clientSyncId: 'rate-limited-recovery',
    });
  });

  it('prevents scene operations from growing room state past the item limit', async () => {
    const server = await startServer({
      maxBytes: 1024,
      maxItems: 1,
      maxFloorPlanElements: 10,
      operationLimit: 10,
      operationWindowMs: 1000,
    });
    const owner = await connect(server, 'owner-token');
    await join(owner);

    const firstAck = waitForEvent(owner, 'scene:op:ack');
    owner.emit('scene:op', {
      roomId: PUBLIC_GALLERY.id,
      clientOpId: 'within-limit',
      op: { kind: 'add-item', item: makeValidItem('first') },
    });
    await firstAck;

    const invalid = waitForEvent(owner, 'room:error');
    owner.emit('scene:op', {
      roomId: PUBLIC_GALLERY.id,
      clientOpId: 'past-limit',
      op: { kind: 'add-item', item: makeValidItem('second') },
    });
    await expect(invalid).resolves.toMatchObject({ code: 'INVALID_PAYLOAD' });
    await expectNoEvent(owner, 'scene:op:ack');
  });

  it('atomically rejects scene operations that grow stored scene past the byte limit', async () => {
    const server = await startServer({
      maxBytes: 800,
      maxItems: 10,
      maxFloorPlanElements: 10,
      operationLimit: 10,
      operationWindowMs: 1000,
    });
    const owner = await connect(server, 'owner-token');
    const observer = await connect(server, 'participant-token');
    await join(owner);
    await join(observer);

    const firstAck = waitForEvent(owner, 'scene:op:ack');
    const firstBroadcast = waitForEvent(observer, 'scene:oped');
    owner.emit('scene:op', {
      roomId: PUBLIC_GALLERY.id,
      clientOpId: 'byte-within-limit',
      op: {
        kind: 'add-item',
        item: makeValidItem('first', { content: 'a'.repeat(120) }),
      },
    });
    await firstAck;
    await firstBroadcast;

    const invalid = waitForEvent(owner, 'room:error');
    const noAck = expectNoEvent(owner, 'scene:op:ack');
    const noBroadcast = expectNoEvent(observer, 'scene:oped');
    owner.emit('scene:op', {
      roomId: PUBLIC_GALLERY.id,
      clientOpId: 'byte-past-limit',
      op: {
        kind: 'add-item',
        item: makeValidItem('second', { content: 'b'.repeat(120) }),
      },
    });

    await expect(invalid).resolves.toMatchObject({ code: 'INVALID_PAYLOAD' });
    await Promise.all([noAck, noBroadcast]);

    const lateObserver = await connect(server, 'participant-token');
    const synced = waitForEvent(lateObserver, 'scene:synced');
    await join(lateObserver);
    await expect(synced).resolves.toMatchObject({
      scene: {
        items: [makeValidItem('first', { content: 'a'.repeat(120) })],
      },
    });
  });

  it('enforces the TypeScript minimum scene schemas and accepts the current default scene', async () => {
    const server = await startServer();
    const owner = await connect(server, 'owner-token');
    const observer = await connect(server, 'participant-token');
    await join(owner);
    await join(observer);

    const invalidScenes = [
      {},
      makeValidScene({ items: [{ id: 'id-only' }] }),
      makeValidScene({ floorPlanElements: [{ id: 'floor-id-only' }] }),
      makeValidScene({
        items: [makeValidItem('bad-vector', { position: [0, 1] })],
      }),
      makeValidScene({
        items: [makeValidItem('bad-type', { type: 'unknown' })],
      }),
      makeValidScene({
        floorPlanElements: [
          makeValidFloorElement('bad-floor-vector', { scale: [1, 2] }),
        ],
      }),
      makeValidScene({
        floorPlanElements: [
          makeValidFloorElement('bad-floor-type', { type: 'ceiling' }),
        ],
      }),
      makeValidScene({ roomSize: {} }),
    ];

    for (const scene of invalidScenes) {
      const invalid = waitForEvent(owner, 'room:error');
      owner.emit('scene:sync', { roomId: PUBLIC_GALLERY.id, scene });
      await expect(invalid).resolves.toMatchObject({ code: 'INVALID_PAYLOAD' });
    }

    const synced = waitForEvent(observer, 'scene:synced');
    owner.emit('scene:sync', {
      roomId: PUBLIC_GALLERY.id,
      expectedVersion: 1,
      scene: structuredClone(defaultGalleryScene),
    });
    await expect(synced).resolves.toMatchObject({
      scene: {
        roomSize: { wallMaterialPreset: 'paint' },
        items: expect.any(Array),
        floorPlanElements: expect.any(Array),
      },
    });
  });

  it('validates the complete resulting item after update-item', async () => {
    const server = await startServer();
    const owner = await connect(server, 'owner-token');
    await join(owner);

    const added = waitForEvent(owner, 'scene:op:ack');
    owner.emit('scene:op', {
      roomId: PUBLIC_GALLERY.id,
      clientOpId: 'add-valid-item',
      op: {
        kind: 'add-item',
        item: makeValidItem('update-target'),
      },
    });
    await added;

    const invalid = waitForEvent(owner, 'room:error');
    owner.emit('scene:op', {
      roomId: PUBLIC_GALLERY.id,
      clientOpId: 'invalidate-item',
      op: {
        kind: 'update-item',
        id: 'update-target',
        updates: { rotation: [0, 1] },
      },
    });
    await expect(invalid).resolves.toMatchObject({ code: 'INVALID_PAYLOAD' });
    await expectNoEvent(owner, 'scene:op:ack');
  });

  it('accepts and broadcasts workContext update-item operations while rejecting invalid nested updates', async () => {
    const server = await startServer();
    const owner = await connect(server, 'owner-token');
    const observer = await connect(server, 'participant-token');
    await join(owner);
    await join(observer);

    const addAck = waitForEvent(owner, 'scene:op:ack');
    const addBroadcast = waitForEvent(observer, 'scene:oped');
    owner.emit('scene:op', {
      roomId: PUBLIC_GALLERY.id,
      clientOpId: 'add-work-context-item',
      op: { kind: 'add-item', item: makeValidItem('work-context-target') },
    });
    // Drain the add event before waiting for the update broadcast below. The
    // owner's ack can arrive before the observer processes its room broadcast.
    await Promise.all([addAck, addBroadcast]);

    const workContext = {
      contribution: 'I made the display.',
      sources: [{ label: 'Project note', url: 'https://example.com/note', excerpt: 'A supplied excerpt.' }],
    };
    const updateAck = waitForEvent(owner, 'scene:op:ack');
    const updateBroadcast = waitForEvent(observer, 'scene:oped');
    owner.emit('scene:op', {
      roomId: PUBLIC_GALLERY.id,
      clientOpId: 'update-work-context',
      op: { kind: 'update-item', id: 'work-context-target', updates: { workContext } },
    });
    const [ack, broadcast] = await Promise.all([updateAck, updateBroadcast]);
    expect(ack).toMatchObject({ clientOpId: 'update-work-context' });
    expect(broadcast.op).toMatchObject({ kind: 'update-item', id: 'work-context-target', updates: { workContext } });

    const invalid = waitForEvent(owner, 'room:error');
    const noBroadcast = expectNoEvent(observer, 'scene:oped');
    owner.emit('scene:op', {
      roomId: PUBLIC_GALLERY.id,
      clientOpId: 'invalid-work-context-update',
      op: {
        kind: 'update-item', id: 'work-context-target',
        updates: { workContext: { sources: [{ label: 'Bad URL', url: 'javascript:alert(1)' }] } },
      },
    });
    await expect(invalid).resolves.toMatchObject({ code: 'INVALID_PAYLOAD' });
    await noBroadcast;
  });

  it('validates optional ExhibitItem and FloorPlanElement fields when present', async () => {
    const server = await startServer();
    const owner = await connect(server, 'owner-token');
    const observer = await connect(server, 'participant-token');
    await join(owner);
    await join(observer);

    const invalidScenes = [
      makeValidScene({
        items: [makeValidItem('bad-string', { title: 123 })],
      }),
      makeValidScene({
        items: [makeValidItem('bad-boolean', { videoAutoplay: 'true' })],
      }),
      makeValidScene({
        items: [makeValidItem('bad-number', { frameWidth: '2' })],
      }),
      makeValidScene({
        items: [makeValidItem('bad-model-offset', { modelOffset: [0, 1] })],
      }),
      makeValidScene({
        items: [makeValidItem('bad-font', { textFontFamily: 'comic' })],
      }),
      makeValidScene({
        items: [makeValidItem('bad-status', { uploadStatus: 'complete' })],
      }),
      makeValidScene({
        items: [makeValidItem('bad-progress', { uploadProgress: 101 })],
      }),
      makeValidScene({
        floorPlanElements: [
          makeValidFloorElement('bad-floor-lock', { isLocked: 'false' }),
        ],
      }),
      makeValidScene({
        floorPlanElements: [
          makeValidFloorElement('bad-door-width', { doorWidth: '1.2' }),
        ],
      }),
    ];

    for (const scene of invalidScenes) {
      const invalid = waitForEvent(owner, 'room:error');
      owner.emit('scene:sync', { roomId: PUBLIC_GALLERY.id, scene });
      await expect(invalid).resolves.toMatchObject({ code: 'INVALID_PAYLOAD' });
    }

    const validOptionalItem = makeValidItem('valid-optionals', {
      fileName: 'art.png',
      fileMimeType: 'image/png',
      videoThumbnailUrl: '/thumb.png',
      videoAutoplay: true,
      videoLoop: false,
      videoMuted: true,
      frameWidth: 2,
      frameHeight: 1.5,
      modelOffset: [0, 0.25, 0],
      title: 'Title',
      artist: 'Artist',
      description: '',
      externalUrl: 'https://example.com',
      textFontFamily: 'serif',
      textColor: '#ffffff',
      textFontSize: 24,
      textIsBold: true,
      textBackboardEnabled: false,
      textBackboardColor: '#000000',
      lightIntensity: 0,
      isLocked: false,
      uploadStatus: 'done',
      uploadProgress: 100,
      assetId: 'asset-1',
      assetUrl: '/asset.glb',
      thumbnailUrl: '/asset-thumb.png',
    });
    const validFloor = makeValidFloorElement('valid-floor-optionals', {
      color: '#abcdef',
      isLocked: true,
      doorOffset: 0,
      doorWidth: 1.2,
    });

    const synced = waitForEvent(observer, 'scene:synced');
    owner.emit('scene:sync', {
      roomId: PUBLIC_GALLERY.id,
      expectedVersion: 1,
      scene: makeValidScene({
        items: [validOptionalItem],
        floorPlanElements: [validFloor],
      }),
    });
    await expect(synced).resolves.toMatchObject({
      scene: {
        items: [{ id: 'valid-optionals', uploadStatus: 'done' }],
        floorPlanElements: [{ id: 'valid-floor-optionals', doorWidth: 1.2 }],
      },
    });
  });

  it('preserves valid public work context and rejects invalid nested context over sockets', async () => {
    const server = await startServer();
    const owner = await connect(server, 'owner-token');
    const observer = await connect(server, 'participant-token');
    await join(owner);
    await join(observer);

    const workContext = {
      contribution: 'I designed the public installation.',
      process: 'I built a paper prototype.',
      outcome: 'The final piece uses recycled paper.',
      reflection: 'I would test the lighting earlier.',
      sources: [{ label: 'Project note', url: 'https://example.com/note', excerpt: 'A short supplied excerpt.' }],
    };
    const synced = waitForEvent(observer, 'scene:synced');
    owner.emit('scene:sync', {
      roomId: PUBLIC_GALLERY.id,
      expectedVersion: 1,
      scene: makeValidScene({ items: [makeValidItem('with-work-context', { workContext })] }),
    });
    await expect(synced).resolves.toMatchObject({
      scene: { items: [expect.objectContaining({ workContext })] },
    });

    const invalidScenes = [
      makeValidScene({ items: [makeValidItem('bad-source-url', { workContext: { sources: [{ label: 'No', url: 'javascript:alert(1)' }] } })] }),
      makeValidScene({ items: [makeValidItem('too-many-sources', { workContext: { sources: Array.from({ length: 6 }, (_, index) => ({ label: `Source ${index}` })) } })] }),
      makeValidScene({ items: [makeValidItem('oversized-reflection', { workContext: { reflection: 'x'.repeat(2001) } })] }),
    ];
    for (const scene of invalidScenes) {
      const invalid = waitForEvent(owner, 'room:error');
      owner.emit('scene:sync', { roomId: PUBLIC_GALLERY.id, scene });
      await expect(invalid).resolves.toMatchObject({ code: 'INVALID_PAYLOAD' });
    }
  });

  it('cleans up sockets and rooms when close is called', async () => {
    const server = await startServer();
    const client = await connect(server);
    await join(client);

    const disconnected = waitForEvent(client, 'disconnect');
    await server.close();
    await disconnected;
    servers.delete(server);

    expect(server.httpServer.listening).toBe(false);
    expect(client.connected).toBe(false);
  });

  it('initializes the first valid scene sync at version one when no saved scene exists', async () => {
    const server = await startServer({ withPersistedScene: false });
    const owner = await connect(server, 'owner-token');
    await join(owner);

    const synced = waitForEvent(owner, 'scene:synced');
    owner.emit('scene:sync', {
      roomId: PUBLIC_GALLERY.id,
      scene: makeValidScene({ items: [makeValidItem('first-scene')] }),
    });

    await expect(synced).resolves.toMatchObject({
      by: owner.id,
      version: 1,
      scene: { items: [{ id: 'first-scene' }] },
    });
  });

  it('correlates the authoritative snapshot when a concurrent initializer loses', async () => {
    let current = null;
    const sceneStore = {
      initialize: vi.fn(async (_roomId, scene) => {
        if (!current) {
          current = {
            scene,
            version: 1,
            updatedAt: Date.now(),
          };
        }
        return current;
      }),
      get: vi.fn().mockResolvedValue(null),
      replace: vi.fn(),
      applyOperation: vi.fn(),
      delete: vi.fn(),
      checkReadiness: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const server = await startServer({
      sceneStore,
      withPersistedScene: false,
    });
    const winner = await connect(server, 'owner-token');
    const loser = await connect(server, 'owner-token');
    await join(winner);
    await join(loser);

    const winningScene = makeValidScene({
      items: [makeValidItem('winning-initializer')],
    });
    const winnerSynced = waitForEvent(winner, 'scene:synced');
    const winnerBroadcast = waitForEvent(loser, 'scene:synced');
    winner.emit('scene:sync', {
      roomId: PUBLIC_GALLERY.id,
      clientSyncId: 'winner-sync',
      scene: winningScene,
    });
    await expect(winnerSynced).resolves.toMatchObject({
      clientSyncId: 'winner-sync',
      version: 1,
      scene: { items: [{ id: 'winning-initializer' }] },
    });
    // Drain the initial broadcast before waiting for the conflict response.
    await expect(winnerBroadcast).resolves.toMatchObject({
      by: winner.id,
      version: 1,
      scene: { items: [{ id: 'winning-initializer' }] },
    });

    const conflict = waitForEvent(loser, 'room:error');
    const authoritative = waitForEvent(loser, 'scene:synced');
    loser.emit('scene:sync', {
      roomId: PUBLIC_GALLERY.id,
      clientSyncId: 'loser-sync',
      scene: makeValidScene({
        items: [makeValidItem('losing-initializer')],
      }),
    });

    await expect(conflict).resolves.toMatchObject({
      code: 'SCENE_CONFLICT',
      roomId: PUBLIC_GALLERY.id,
      clientSyncId: 'loser-sync',
    });
    await expect(authoritative).resolves.toMatchObject({
      by: 'server',
      clientSyncId: 'loser-sync',
      version: 1,
      scene: { items: [{ id: 'winning-initializer' }] },
    });
  });

  it('initializes a room from a valid persisted gallery scene without overwriting it', async () => {
    const persistedScene = makeValidScene({
      items: [makeValidItem('persisted-item')],
    });
    const server = await startServer({
      getGalleryById: async (id) => (
        id === PUBLIC_GALLERY.id
          ? { ...PUBLIC_GALLERY, scene_json: JSON.stringify(persistedScene) }
          : null
      ),
    });
    const viewer = await connect(server);
    const synced = waitForEvent(viewer, 'scene:synced');

    await join(viewer);

    await expect(synced).resolves.toMatchObject({
      version: 1,
      scene: { items: [{ id: 'persisted-item' }] },
    });
  });

  it('rejects a stale scene replacement and returns the authoritative snapshot', async () => {
    const server = await startServer();
    const owner = await connect(server, 'owner-token');
    await join(owner);

    const conflict = waitForEvent(owner, 'room:error');
    const authoritative = waitForEvent(owner, 'scene:synced');
    owner.emit('scene:sync', {
      roomId: PUBLIC_GALLERY.id,
      expectedVersion: 99,
      scene: makeValidScene({ items: [makeValidItem('must-not-win')] }),
    });

    await expect(conflict).resolves.toMatchObject({ code: 'SCENE_CONFLICT' });
    await expect(authoritative).resolves.toMatchObject({
      by: 'server',
      version: 1,
      scene: { items: [] },
    });
  });

  it('correlates a scene operation conflict with its client operation', async () => {
    const inner = createMemorySceneStore();
    const sceneStore = {
      initialize: (...args) => inner.initialize(...args),
      get: (...args) => inner.get(...args),
      replace: (...args) => inner.replace(...args),
      applyOperation: vi.fn().mockResolvedValue({
        accepted: false,
        reason: 'conflict',
      }),
      delete: (...args) => inner.delete(...args),
      checkReadiness: (...args) => inner.checkReadiness(...args),
      close: (...args) => inner.close(...args),
    };
    const server = await startServer({ sceneStore });
    const owner = await connect(server, 'owner-token');
    await join(owner);

    const conflict = waitForEvent(owner, 'room:error');
    const authoritative = waitForEvent(owner, 'scene:synced');
    owner.emit('scene:op', {
      roomId: PUBLIC_GALLERY.id,
      clientOpId: 'conflicting-op',
      op: { kind: 'add-item', item: makeValidItem('conflict') },
    });

    await expect(conflict).resolves.toMatchObject({
      code: 'SCENE_CONFLICT',
      roomId: PUBLIC_GALLERY.id,
      clientOpId: 'conflicting-op',
    });
    await expect(authoritative).resolves.toMatchObject({
      by: 'server',
      version: 1,
    });
  });

  it('includes consecutive versions in operation acknowledgement and broadcast', async () => {
    const server = await startServer();
    const owner = await connect(server, 'owner-token');
    const observer = await connect(server);
    await join(owner);
    await join(observer);

    const ack = waitForEvent(owner, 'scene:op:ack');
    const broadcast = waitForEvent(observer, 'scene:oped');
    owner.emit('scene:op', {
      roomId: PUBLIC_GALLERY.id,
      clientOpId: 'versioned-op',
      op: { kind: 'add-item', item: makeValidItem('versioned-item') },
    });

    await expect(ack).resolves.toMatchObject({ version: 2 });
    await expect(broadcast).resolves.toMatchObject({ version: 2 });
  });

  it('returns scene sync correlation only to the requesting editor', async () => {
    const server = await startServer();
    const owner = await connect(server, 'owner-token');
    const observer = await connect(server);
    await join(owner);
    await join(observer);

    const ownerSynced = waitForEvent(owner, 'scene:synced');
    const observerSynced = waitForEvent(observer, 'scene:synced');
    owner.emit('scene:sync', {
      roomId: PUBLIC_GALLERY.id,
      clientSyncId: 'recovery-sync-1',
      expectedVersion: 1,
      scene: makeValidScene({ items: [makeValidItem('recovered')] }),
    });

    await expect(ownerSynced).resolves.toMatchObject({
      clientSyncId: 'recovery-sync-1',
      version: 2,
    });
    const observerPayload = await observerSynced;
    expect(observerPayload).toMatchObject({ version: 2 });
    expect(observerPayload).not.toHaveProperty('clientSyncId');
  });

  it('broadcasts an accepted replacement after the sender switches rooms', async () => {
    const deferredStore = createDeferredSceneStore('replace');
    const server = await startServer({ sceneStore: deferredStore.store });
    const owner = await connect(server, 'owner-token');
    const observer = await connect(server);
    await join(owner);
    await join(observer);

    deferredStore.deferNext();
    owner.emit('scene:sync', {
      roomId: PUBLIC_GALLERY.id,
      expectedVersion: 1,
      scene: makeValidScene({ items: [makeValidItem('committed-sync')] }),
    });
    await deferredStore.started;
    await join(owner, { roomId: PRIVATE_GALLERY.id });

    const broadcast = waitForEvent(observer, 'scene:synced');
    const noStaleSnapshot = expectNoEvent(owner, 'scene:synced');
    deferredStore.release();

    await expect(broadcast).resolves.toMatchObject({
      version: 2,
      scene: { items: [{ id: 'committed-sync' }] },
    });
    await noStaleSnapshot;
  });

  it('scopes a stale scene sync error to the room captured before the store read', async () => {
    const deferredStore = createDeferredSceneStore('get');
    const server = await startServer({ sceneStore: deferredStore.store });
    const owner = await connect(server, 'owner-token');
    await join(owner);

    deferredStore.deferNext();
    owner.emit('scene:sync', {
      roomId: PUBLIC_GALLERY.id,
      clientSyncId: 'stale-public-sync',
      expectedVersion: 1,
      scene: makeValidScene({ items: [makeValidItem('stale')] }),
    });
    await deferredStore.started;
    await join(owner, { roomId: PRIVATE_GALLERY.id });

    const stale = waitForEvent(owner, 'room:error');
    deferredStore.release();
    await expect(stale).resolves.toMatchObject({
      code: 'FORBIDDEN',
      roomId: PUBLIC_GALLERY.id,
      clientSyncId: 'stale-public-sync',
    });
  });

  it('broadcasts an accepted operation but suppresses stale sender acknowledgement', async () => {
    const deferredStore = createDeferredSceneStore('applyOperation');
    const server = await startServer({ sceneStore: deferredStore.store });
    const owner = await connect(server, 'owner-token');
    const observer = await connect(server);
    await join(owner);
    await join(observer);

    deferredStore.deferNext();
    owner.emit('scene:op', {
      roomId: PUBLIC_GALLERY.id,
      clientOpId: 'committed-stale-op',
      op: { kind: 'add-item', item: makeValidItem('committed-op') },
    });
    await deferredStore.started;
    await join(owner, { roomId: PRIVATE_GALLERY.id });

    const broadcast = waitForEvent(observer, 'scene:oped');
    const noAck = expectNoEvent(owner, 'scene:op:ack');
    deferredStore.release();

    await expect(broadcast).resolves.toMatchObject({
      clientOpId: 'committed-stale-op',
      version: 2,
    });
    await noAck;
  });

  it('delivers a committed operation to a same-room rejoin without an old acknowledgement', async () => {
    const deferredStore = createDeferredSceneStore('applyOperation');
    const server = await startServer({ sceneStore: deferredStore.store });
    const owner = await connect(server, 'owner-token');
    await join(owner);

    deferredStore.deferNext();
    owner.emit('scene:op', {
      roomId: PUBLIC_GALLERY.id,
      clientOpId: 'same-room-rejoin-op',
      op: { kind: 'add-item', item: makeValidItem('after-rejoin-snapshot') },
    });
    await deferredStore.started;
    await join(owner, { roomId: PUBLIC_GALLERY.id });

    const committed = waitForEvent(owner, 'scene:oped');
    const noOldAck = expectNoEvent(owner, 'scene:op:ack');
    deferredStore.release();

    await expect(committed).resolves.toMatchObject({
      clientOpId: 'same-room-rejoin-op',
      version: 2,
      op: { item: { id: 'after-rejoin-snapshot' } },
    });
    await noOldAck;
  });

  it('does not emit an old-room snapshot when request-sync becomes stale', async () => {
    const deferredStore = createDeferredSceneStore('get');
    const server = await startServer({ sceneStore: deferredStore.store });
    const owner = await connect(server, 'owner-token');
    await join(owner);

    deferredStore.deferNext();
    owner.emit('scene:request-sync', { roomId: PUBLIC_GALLERY.id });
    await deferredStore.started;
    await join(owner, { roomId: PRIVATE_GALLERY.id });

    const noOldSnapshot = expectNoEvent(owner, 'scene:synced');
    deferredStore.release();
    await noOldSnapshot;
  });

  it('reports SCENE_MISSING for operations after live scene expiry', async () => {
    const server = await startServer({ withPersistedScene: false });
    const owner = await connect(server, 'owner-token');
    await join(owner);

    const missing = waitForEvent(owner, 'room:error');
    owner.emit('scene:op', {
      roomId: PUBLIC_GALLERY.id,
      clientOpId: 'missing-scene-op',
      op: { kind: 'add-item', item: makeValidItem('cannot-apply') },
    });

    await expect(missing).resolves.toMatchObject({
      code: 'SCENE_MISSING',
      roomId: PUBLIC_GALLERY.id,
      clientOpId: 'missing-scene-op',
    });
  });

  it('reports SCENE_MISSING when a scene expires between sync get and replace', async () => {
    const inner = createMemorySceneStore();
    const sceneStore = {
      initialize: (...args) => inner.initialize(...args),
      get: (...args) => inner.get(...args),
      replace: vi.fn(async (roomId, ...args) => {
        await inner.delete(roomId);
        return inner.replace(roomId, ...args);
      }),
      applyOperation: (...args) => inner.applyOperation(...args),
      delete: (...args) => inner.delete(...args),
      checkReadiness: (...args) => inner.checkReadiness(...args),
      close: (...args) => inner.close(...args),
    };
    const server = await startServer({ sceneStore });
    const owner = await connect(server, 'owner-token');
    await join(owner);

    const missing = waitForEvent(owner, 'room:error');
    owner.emit('scene:sync', {
      roomId: PUBLIC_GALLERY.id,
      expectedVersion: 1,
      scene: makeValidScene({ items: [makeValidItem('expired-replace')] }),
    });

    await expect(missing).resolves.toMatchObject({
      code: 'SCENE_MISSING',
      roomId: PUBLIC_GALLERY.id,
    });
    expect(sceneStore.replace).toHaveBeenCalledOnce();
  });

  it('reports SCENE_MISSING when request-sync has no live snapshot', async () => {
    const server = await startServer({ withPersistedScene: false });
    const owner = await connect(server, 'owner-token');
    await join(owner);

    const missing = waitForEvent(owner, 'room:error');
    owner.emit('scene:request-sync', { roomId: PUBLIC_GALLERY.id });

    await expect(missing).resolves.toMatchObject({
      code: 'SCENE_MISSING',
      roomId: PUBLIC_GALLERY.id,
    });
  });

  it('reports store failures without falling back to process-local scene state', async () => {
    const failure = new Error('shared store unavailable');
    const sceneStore = {
      initialize: vi.fn().mockRejectedValue(failure),
      get: vi.fn().mockRejectedValue(failure),
      replace: vi.fn(),
      applyOperation: vi.fn(),
      checkReadiness: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const server = await startServer({ sceneStore });
    const owner = await connect(server, 'owner-token');
    const unavailable = waitForEvent(owner, 'room:error');

    owner.emit('room:join', {
      roomId: PUBLIC_GALLERY.id,
      nickname: 'Tester',
    });

    await expect(unavailable).resolves.toMatchObject({
      code: 'COLLABORATION_UNAVAILABLE',
    });
    expect(sceneStore.initialize).toHaveBeenCalledOnce();
  });

  it('correlates scene operation store failures with the rejected client operation', async () => {
    const inner = createMemorySceneStore();
    const failure = new Error('shared store unavailable');
    const sceneStore = {
      initialize: (...args) => inner.initialize(...args),
      get: (...args) => inner.get(...args),
      replace: (...args) => inner.replace(...args),
      applyOperation: vi.fn().mockRejectedValue(failure),
      delete: (...args) => inner.delete(...args),
      checkReadiness: (...args) => inner.checkReadiness(...args),
      close: (...args) => inner.close(...args),
    };
    const server = await startServer({ sceneStore });
    const owner = await connect(server, 'owner-token');
    await join(owner);

    const unavailable = waitForEvent(owner, 'room:error');
    owner.emit('scene:op', {
      roomId: PUBLIC_GALLERY.id,
      clientOpId: 'store-failure-op',
      op: { kind: 'add-item', item: makeValidItem('store-failure') },
    });

    await expect(unavailable).resolves.toMatchObject({
      code: 'COLLABORATION_UNAVAILABLE',
      roomId: PUBLIC_GALLERY.id,
      clientOpId: 'store-failure-op',
    });
  });

  it('correlates recovery scene sync store failures with the sync request', async () => {
    const inner = createMemorySceneStore();
    const failure = new Error('shared store unavailable');
    const sceneStore = {
      initialize: (...args) => inner.initialize(...args),
      get: vi.fn().mockRejectedValue(failure),
      replace: (...args) => inner.replace(...args),
      applyOperation: (...args) => inner.applyOperation(...args),
      delete: (...args) => inner.delete(...args),
      checkReadiness: (...args) => inner.checkReadiness(...args),
      close: (...args) => inner.close(...args),
    };
    const server = await startServer({ sceneStore });
    const owner = await connect(server, 'owner-token');
    await join(owner);

    const unavailable = waitForEvent(owner, 'room:error');
    owner.emit('scene:sync', {
      roomId: PUBLIC_GALLERY.id,
      clientSyncId: 'recovery-store-failure',
      scene: makeValidScene(),
    });

    await expect(unavailable).resolves.toMatchObject({
      code: 'COLLABORATION_UNAVAILABLE',
      roomId: PUBLIC_GALLERY.id,
      clientSyncId: 'recovery-store-failure',
    });
  });

  it('returns an authoritative versioned snapshot on scene:request-sync', async () => {
    const server = await startServer();
    const viewer = await connect(server);
    await join(viewer);

    const synced = waitForEvent(viewer, 'scene:synced');
    viewer.emit('scene:request-sync', { roomId: PUBLIC_GALLERY.id });

    await expect(synced).resolves.toMatchObject({
      by: 'server',
      version: 1,
      scene: { items: [] },
    });
  });

  it('attaches collaboration and checks the store before listening', async () => {
    let finishAttach;
    const attachBarrier = new Promise((resolve) => {
      finishAttach = resolve;
    });
    const order = [];
    const collaboration = {
      attach: vi.fn(async () => {
        order.push('attach');
        await attachBarrier;
      }),
      checkReadiness: vi.fn(async () => order.push('collaboration-ready')),
      close: vi.fn(async () => order.push('collaboration-close')),
    };
    const sceneStore = {
      initialize: vi.fn(),
      get: vi.fn(),
      replace: vi.fn(),
      applyOperation: vi.fn(),
      checkReadiness: vi.fn(async () => order.push('store-ready')),
      close: vi.fn(async () => order.push('store-close')),
    };
    const server = startMultiplayerServer({
      initialPort: 0,
      corsOrigin: 'http://localhost',
      allowMissingOrigin: true,
      verifyToken: () => null,
      getGalleryById: async () => null,
      getGalleryByShareToken: async () => null,
      collaboration,
      sceneStore,
    });
    servers.add(server);

    await Promise.resolve();
    expect(server.httpServer.listening).toBe(false);
    finishAttach();
    await server.ready;

    expect(order.slice(0, 3)).toEqual([
      'attach',
      'collaboration-ready',
      'store-ready',
    ]);
  });

  it('cleans collaboration resources when startup attachment fails', async () => {
    const startupError = new Error('adapter attach failed');
    const collaboration = {
      attach: vi.fn().mockRejectedValue(startupError),
      checkReadiness: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const sceneStore = {
      initialize: vi.fn(),
      get: vi.fn(),
      replace: vi.fn(),
      applyOperation: vi.fn(),
      checkReadiness: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const server = startMultiplayerServer({
      initialPort: 0,
      corsOrigin: 'http://localhost',
      allowMissingOrigin: true,
      verifyToken: () => null,
      getGalleryById: async () => null,
      getGalleryByShareToken: async () => null,
      collaboration,
      sceneStore,
    });
    servers.add(server);

    await expect(server.ready).rejects.toBe(startupError);
    expect(server.httpServer.listening).toBe(false);
    expect(sceneStore.checkReadiness).not.toHaveBeenCalled();
    expect(sceneStore.close).toHaveBeenCalledOnce();
    expect(collaboration.close).toHaveBeenCalledOnce();
  });

  it('keeps same-process memory scene stores isolated when another server closes', async () => {
    const first = await startServer();
    const second = await startServer();
    const secondOwner = await connect(second, 'owner-token');
    await join(secondOwner);

    const ack = waitForEvent(secondOwner, 'scene:op:ack');
    secondOwner.emit('scene:op', {
      roomId: PUBLIC_GALLERY.id,
      clientOpId: 'isolated-op',
      op: { kind: 'add-item', item: makeValidItem('survives-other-close') },
    });
    await ack;

    await first.close();
    servers.delete(first);
    const synced = waitForEvent(secondOwner, 'scene:synced');
    secondOwner.emit('scene:request-sync', { roomId: PUBLIC_GALLERY.id });
    await expect(synced).resolves.toMatchObject({
      version: 2,
      scene: { items: [{ id: 'survives-other-close' }] },
    });
  });
});
