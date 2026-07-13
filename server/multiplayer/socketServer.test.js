// @vitest-environment node

import { once } from 'node:events';
import { createServer as createHttpServer } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { io as createClient } from 'socket.io-client';

import { defaultGalleryScene } from '../../src/app/modules/metaverse3d/store/defaultGalleryScene.ts';
import { startMultiplayerServer } from './socketServer.js';

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

async function startServer(options = {}) {
  const normalizedOptions = options && (
    Object.prototype.hasOwnProperty.call(options, 'maxBytes')
    || Object.prototype.hasOwnProperty.call(options, 'maxItems')
  )
    ? { sceneLimits: options }
    : options;
  const server = startMultiplayerServer({
    initialPort: 0,
    corsOrigin: normalizedOptions.corsOrigin || 'http://localhost',
    allowMissingOrigin: normalizedOptions.allowMissingOrigin ?? true,
    verifyToken: normalizedOptions.verifyToken || ((token) => {
      if (token === 'participant-token') return { sub: 'user-2', name: 'Participant' };
      if (token === 'owner-token') return { sub: 'owner-1', name: 'Owner' };
      return null;
    }),
    getGalleryById: normalizedOptions.getGalleryById
      || (async (id) => galleries.get(id) || null),
    getGalleryByShareToken: normalizedOptions.getGalleryByShareToken
      || (async (token) => shares.get(token) || null),
    sceneLimits: normalizedOptions.sceneLimits,
    connectionLimits: normalizedOptions.connectionLimits,
    joinLimits: normalizedOptions.joinLimits,
    startupLimits: normalizedOptions.startupLimits,
    movementLimits: normalizedOptions.movementLimits,
    authorizationSweepMs: normalizedOptions.authorizationSweepMs,
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
  return joined;
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
    const left = waitForEvent(observer, 'player:left');
    await expect(joinError(owner, {
      roomId: PRIVATE_GALLERY.id,
      nickname: 'Owner',
    })).resolves.toMatchObject({ code: 'AUTH_REQUIRED' });
    await expect(left).resolves.toMatchObject({ id: owner.id });
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

    await expect(forbidden).resolves.toMatchObject({ code: 'FORBIDDEN' });
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
    await expect(limited).resolves.toMatchObject({ code: 'RATE_LIMITED' });
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
      maxBytes: 500,
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
});
