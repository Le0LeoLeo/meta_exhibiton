import { createServer } from 'node:http';
import { Server } from 'socket.io';

import { resolveGalleryAccess } from '../security/galleryAccess.js';
import { createRateTokenConsumer } from '../security/rateLimit.js';
import {
  addPlayer,
  applyRoomSceneOp,
  clearRooms,
  getPlayers,
  getRoomScene,
  normalizeNickname,
  removePlayer,
  setRoomScene,
  updatePlayerMove,
} from './rooms.js';

const MOVE_RATE_LIMIT_PER_SEC = 25;
const CHAT_RATE_LIMIT_PER_SEC = 3;
const CHAT_MAX_LENGTH = 300;
const ROOM_ID_MAX_LENGTH = 128;
const CLIENT_OP_ID_MAX_LENGTH = 128;
const ITEM_ID_MAX_LENGTH = 256;
const DEFAULT_SCENE_LIMITS = Object.freeze({
  maxBytes: 1024 * 1024,
  maxItems: 500,
  maxFloorPlanElements: 500,
  operationLimit: 60,
  operationWindowMs: 1000,
});
const DEFAULT_STARTUP_LIMITS = Object.freeze({
  maxPortRetries: 10,
  retryDelayMs: 200,
});
const DEFAULT_CONNECTION_LIMITS = Object.freeze({
  maxConnections: 1000,
  maxConnectionsPerIp: 50,
});
const DEFAULT_JOIN_LIMITS = Object.freeze({
  perSocketLimit: 10,
  perSocketWindowMs: 60_000,
  perIpLimit: 100,
  perIpWindowMs: 60_000,
  globalLimit: 5000,
  globalWindowMs: 60_000,
  maxIpKeys: 10_000,
});
const DEFAULT_MOVEMENT_LIMITS = Object.freeze({
  maxCoordinateAbs: 100_000,
  maxYawAbs: Math.PI * 4,
  maxTimestamp: Number.MAX_SAFE_INTEGER,
});
const MAX_TRAVERSAL_DEPTH = 20;
const ITEM_TYPES = new Set([
  'painting',
  'pedestal',
  'text',
  'partition',
  'lightstrip',
  'flower',
  'chandelier',
  'bench',
  'rug',
  'vase',
  'sculpture',
  'spotlight',
  'plant',
  'column',
  'neon',
]);
const FLOOR_PLAN_TYPES = new Set(['room', 'wall']);
const WALL_MATERIAL_PRESETS = new Set([
  'paint',
  'concrete',
  'metal',
  'wood',
  'glass',
]);
const ITEM_OPTIONAL_STRING_FIELDS = [
  'fileName',
  'fileMimeType',
  'videoThumbnailUrl',
  'title',
  'artist',
  'description',
  'externalUrl',
  'textColor',
  'textBackboardColor',
  'assetId',
  'assetUrl',
  'thumbnailUrl',
];
const ITEM_OPTIONAL_BOOLEAN_FIELDS = [
  'videoAutoplay',
  'videoLoop',
  'videoMuted',
  'textIsBold',
  'textBackboardEnabled',
  'isLocked',
];
const ITEM_OPTIONAL_NONNEGATIVE_NUMBER_FIELDS = [
  'frameWidth',
  'frameHeight',
  'textFontSize',
  'lightIntensity',
];
const TEXT_FONT_FAMILIES = new Set(['sans', 'serif', 'mono']);
const UPLOAD_STATUSES = new Set(['pending', 'uploading', 'done', 'error']);
const ROOM_NUMERIC_RULES = Object.freeze({
  width: { minExclusive: 0, max: 100_000 },
  length: { minExclusive: 0, max: 100_000 },
  height: { minExclusive: 0, max: 100_000 },
  wallThickness: { minExclusive: 0, max: 1_000 },
  wallTextureTiling: { minExclusive: 0, max: 10_000 },
  wallRoughness: { min: 0, max: 1 },
  wallMetalness: { min: 0, max: 1 },
  wallBumpScale: { min: 0, max: 100 },
  wallEnvIntensity: { min: 0, max: 100 },
  wallOpacity: { min: 0, max: 1 },
  wallTransmission: { min: 0, max: 1 },
  wallIor: { minExclusive: 0, max: 10 },
  floorTextureTiling: { minExclusive: 0, max: 10_000 },
  floorRoughness: { min: 0, max: 1 },
  floorMetalness: { min: 0, max: 1 },
  environmentBrightness: { min: 0, max: 100 },
});
const EDIT_ROLES = new Set(['editor', 'owner']);
const CHAT_ROLES = new Set(['participant', 'editor', 'owner']);
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const ERROR_MESSAGES = Object.freeze({
  NOT_FOUND: 'gallery not found',
  AUTH_REQUIRED: 'authentication required',
  FORBIDDEN: 'insufficient room permissions',
  INVALID_SHARE: 'invalid gallery share',
  SHARE_EXPIRED: 'gallery share has expired',
  NOT_JOINED: 'join a room before sending events',
  INVALID_PAYLOAD: 'invalid event payload',
  RATE_LIMITED: 'too many events',
});

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isSafeString(value, maxLength, { allowEmpty = false } = {}) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return (allowEmpty || trimmed.length > 0) && trimmed.length <= maxLength;
}

function serializedBytes(value) {
  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function isSafeStructure(value, maxDepth = MAX_TRAVERSAL_DEPTH) {
  const seen = new Set();
  const stack = [{ value, depth: 0 }];

  while (stack.length > 0) {
    const current = stack.pop();
    if (typeof current.value === 'number' && !Number.isFinite(current.value)) {
      return false;
    }
    if (!current.value || typeof current.value !== 'object') continue;
    if (current.depth > maxDepth || seen.has(current.value)) return false;
    seen.add(current.value);

    for (const key of Object.keys(current.value)) {
      if (DANGEROUS_KEYS.has(key)) return false;
      stack.push({
        value: current.value[key],
        depth: current.depth + 1,
      });
    }
  }

  return true;
}

function isFiniteVector3(value) {
  return Array.isArray(value)
    && value.length === 3
    && value.every(isFiniteNumber);
}

function isNumberWithinRule(value, rule) {
  if (!isFiniteNumber(value)) return false;
  if (rule.min !== undefined && value < rule.min) return false;
  if (rule.minExclusive !== undefined && value <= rule.minExclusive) return false;
  return value <= rule.max;
}

function optionalFieldsMatchType(value, fields, expectedType) {
  return fields.every((field) => (
    value[field] === undefined || typeof value[field] === expectedType
  ));
}

function optionalNumbersAreNonnegative(value, fields) {
  return fields.every((field) => (
    value[field] === undefined
    || (isFiniteNumber(value[field]) && value[field] >= 0)
  ));
}

function isValidRoomSize(roomSize) {
  if (!isPlainObject(roomSize) || !isSafeStructure(roomSize)) return false;

  for (const [field, rule] of Object.entries(ROOM_NUMERIC_RULES)) {
    if (!isNumberWithinRule(roomSize[field], rule)) return false;
  }

  return (
    isSafeString(roomSize.wallColor, 256)
    && WALL_MATERIAL_PRESETS.has(roomSize.wallMaterialPreset)
    && isSafeString(roomSize.wallTextureUrl, 2048)
    && isSafeString(roomSize.floorColor, 256)
    && isSafeString(roomSize.floorTextureUrl, 2048)
  );
}

function isValidMovePayload(payload, roomId, limits) {
  return (
    isPlainObject(payload)
    && payload.roomId === roomId
    && Number.isSafeInteger(payload.seq)
    && payload.seq >= 0
    && Number.isSafeInteger(payload.t)
    && payload.t >= 0
    && payload.t <= limits.maxTimestamp
    && isFiniteNumber(payload.yaw)
    && Math.abs(payload.yaw) <= limits.maxYawAbs
    && isPlainObject(payload.position)
    && isFiniteNumber(payload.position.x)
    && isFiniteNumber(payload.position.y)
    && isFiniteNumber(payload.position.z)
    && Math.abs(payload.position.x) <= limits.maxCoordinateAbs
    && Math.abs(payload.position.y) <= limits.maxCoordinateAbs
    && Math.abs(payload.position.z) <= limits.maxCoordinateAbs
  );
}

function isValidExhibitItem(item) {
  return (
    isPlainObject(item)
    && isSafeStructure(item)
    && isSafeString(item.id, ITEM_ID_MAX_LENGTH)
    && ITEM_TYPES.has(item.type)
    && isFiniteVector3(item.position)
    && isFiniteVector3(item.rotation)
    && isFiniteVector3(item.scale)
    && typeof item.content === 'string'
    && optionalFieldsMatchType(item, ITEM_OPTIONAL_STRING_FIELDS, 'string')
    && optionalFieldsMatchType(item, ITEM_OPTIONAL_BOOLEAN_FIELDS, 'boolean')
    && optionalNumbersAreNonnegative(
      item,
      ITEM_OPTIONAL_NONNEGATIVE_NUMBER_FIELDS,
    )
    && (
      item.modelOffset === undefined
      || isFiniteVector3(item.modelOffset)
    )
    && (
      item.textFontFamily === undefined
      || TEXT_FONT_FAMILIES.has(item.textFontFamily)
    )
    && (
      item.uploadStatus === undefined
      || UPLOAD_STATUSES.has(item.uploadStatus)
    )
    && (
      item.uploadProgress === undefined
      || (
        isFiniteNumber(item.uploadProgress)
        && item.uploadProgress >= 0
        && item.uploadProgress <= 100
      )
    )
  );
}

function isValidFloorPlanElement(element) {
  return (
    isPlainObject(element)
    && isSafeStructure(element)
    && isSafeString(element.id, ITEM_ID_MAX_LENGTH)
    && FLOOR_PLAN_TYPES.has(element.type)
    && isFiniteVector3(element.position)
    && isFiniteVector3(element.rotation)
    && isFiniteVector3(element.scale)
    && (
      element.color === undefined
      || typeof element.color === 'string'
    )
    && (
      element.isLocked === undefined
      || typeof element.isLocked === 'boolean'
    )
    && (
      element.doorOffset === undefined
      || isFiniteNumber(element.doorOffset)
    )
    && (
      element.doorWidth === undefined
      || (
        isFiniteNumber(element.doorWidth)
        && element.doorWidth >= 0
      )
    )
  );
}

function isValidEntityCollection(collection, maxLength, validateEntity) {
  if (!Array.isArray(collection) || collection.length > maxLength) return false;
  const ids = new Set();
  for (const entity of collection) {
    if (
      !validateEntity(entity)
      || ids.has(entity.id.trim())
    ) {
      return false;
    }
    ids.add(entity.id.trim());
  }
  return true;
}

function isValidScene(scene, limits, { allowNullRoomSize = false } = {}) {
  if (!isPlainObject(scene) || !isSafeStructure(scene)) return false;
  if (serializedBytes(scene) > limits.maxBytes) return false;
  if (!isValidEntityCollection(
    scene.items,
    limits.maxItems,
    isValidExhibitItem,
  )) return false;
  if (!isValidEntityCollection(
    scene.floorPlanElements,
    limits.maxFloorPlanElements,
    isValidFloorPlanElement,
  )) return false;
  if (scene.roomSize === null && allowNullRoomSize) {
    // Initial operation state has no room until the first set-room operation.
  } else if (!isValidRoomSize(scene.roomSize)) {
    return false;
  }
  if (
    scene.wallMaterialOverrides !== undefined
    && !isPlainObject(scene.wallMaterialOverrides)
  ) {
    return false;
  }
  return true;
}

function isValidSceneOp(op, limits) {
  if (!isPlainObject(op) || !isSafeStructure(op)) return false;
  if (serializedBytes(op) > limits.maxBytes) return false;

  if (op.kind === 'set-room') {
    return isValidRoomSize(op.roomSize);
  }
  if (op.kind === 'set-floor-plan') {
    return isValidEntityCollection(
      op.floorPlanElements,
      limits.maxFloorPlanElements,
      isValidFloorPlanElement,
    );
  }
  if (op.kind === 'set-wall-material-overrides') {
    return isPlainObject(op.wallMaterialOverrides);
  }
  if (op.kind === 'add-item') {
    return isValidExhibitItem(op.item);
  }
  if (op.kind === 'update-item') {
    return isSafeString(op.id, ITEM_ID_MAX_LENGTH)
      && isPlainObject(op.updates)
      && isSafeStructure(op.updates);
  }
  if (op.kind === 'remove-item') {
    return isSafeString(op.id, ITEM_ID_MAX_LENGTH);
  }
  return false;
}

function normalizeSceneLimits(sceneLimits = {}) {
  const limits = { ...DEFAULT_SCENE_LIMITS, ...sceneLimits };
  for (const [key, value] of Object.entries(limits)) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new TypeError(`sceneLimits.${key} must be a positive integer`);
    }
  }
  return limits;
}

function normalizeStartupLimits(startupLimits = {}) {
  const limits = { ...DEFAULT_STARTUP_LIMITS, ...startupLimits };
  if (!Number.isInteger(limits.maxPortRetries) || limits.maxPortRetries < 0) {
    throw new TypeError('startupLimits.maxPortRetries must be a nonnegative integer');
  }
  if (!Number.isInteger(limits.retryDelayMs) || limits.retryDelayMs < 0) {
    throw new TypeError('startupLimits.retryDelayMs must be a nonnegative integer');
  }
  return limits;
}

function normalizePositiveIntegerLimits(defaults, provided, prefix) {
  const limits = { ...defaults, ...provided };
  for (const [key, value] of Object.entries(limits)) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new TypeError(`${prefix}.${key} must be a positive integer`);
    }
  }
  return limits;
}

function normalizeMovementLimits(movementLimits = {}) {
  const limits = { ...DEFAULT_MOVEMENT_LIMITS, ...movementLimits };
  for (const [key, value] of Object.entries(limits)) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new TypeError(`movementLimits.${key} must be a positive finite number`);
    }
  }
  if (!Number.isSafeInteger(limits.maxTimestamp)) {
    throw new TypeError('movementLimits.maxTimestamp must be a safe integer');
  }
  return limits;
}

function socketIp(socket) {
  const address = socket?.handshake?.address;
  return typeof address === 'string' && address.trim()
    ? address.trim()
    : 'unknown';
}

function normalizeAllowedOrigins(corsOrigin, allowWildcardOrigin) {
  const origins = (Array.isArray(corsOrigin) ? corsOrigin : [corsOrigin])
    .map((origin) => String(origin || '').trim())
    .filter(Boolean);
  if (origins.length === 0) {
    throw new TypeError('corsOrigin must contain at least one origin');
  }
  if (origins.includes('*') && !allowWildcardOrigin) {
    throw new TypeError('wildcard corsOrigin is disabled');
  }
  return origins;
}

function mapAccessReason(reason) {
  if (reason === 'not_found') return 'NOT_FOUND';
  if (reason === 'authentication_required') return 'AUTH_REQUIRED';
  if (reason === 'share_expired') return 'SHARE_EXPIRED';
  if (reason === 'invalid_share') return 'INVALID_SHARE';
  return 'FORBIDDEN';
}

function scenePayload(snapshot) {
  return {
    roomSize: snapshot.roomSize,
    items: snapshot.items,
    floorPlanElements: snapshot.floorPlanElements,
    wallMaterialOverrides: snapshot.wallMaterialOverrides,
  };
}

export function startMultiplayerServer({
  initialPort,
  corsOrigin,
  verifyToken,
  getGalleryById,
  getGalleryByShareToken,
  sceneLimits,
  allowMissingOrigin = false,
  allowWildcardOrigin = process.env.NODE_ENV !== 'production',
  startupLimits,
  connectionLimits,
  joinLimits,
  movementLimits,
  authorizationSweepMs = 30_000,
}) {
  if (!Number.isInteger(initialPort) || initialPort < 0 || initialPort > 65535) {
    throw new TypeError('initialPort must be an integer from 0 to 65535');
  }
  if (typeof verifyToken !== 'function') {
    throw new TypeError('verifyToken must be a function');
  }
  if (typeof getGalleryById !== 'function') {
    throw new TypeError('getGalleryById must be a function');
  }
  if (typeof getGalleryByShareToken !== 'function') {
    throw new TypeError('getGalleryByShareToken must be a function');
  }
  if (!Number.isInteger(authorizationSweepMs) || authorizationSweepMs < 0) {
    throw new TypeError('authorizationSweepMs must be a nonnegative integer');
  }

  const limits = normalizeSceneLimits(sceneLimits);
  const startup = normalizeStartupLimits(startupLimits);
  const connections = normalizePositiveIntegerLimits(
    DEFAULT_CONNECTION_LIMITS,
    connectionLimits,
    'connectionLimits',
  );
  const joins = normalizePositiveIntegerLimits(
    DEFAULT_JOIN_LIMITS,
    joinLimits,
    'joinLimits',
  );
  const movement = normalizeMovementLimits(movementLimits);
  const allowedOrigins = normalizeAllowedOrigins(corsOrigin, allowWildcardOrigin);
  const originAllowed = (origin) => (
    allowedOrigins.includes('*') || allowedOrigins.includes(origin)
  );
  const httpServer = createServer();
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins.includes('*') ? '*' : allowedOrigins,
      credentials: false,
    },
    allowRequest: (request, callback) => {
      const origin = request.headers.origin;
      callback(null, origin ? originAllowed(origin) : Boolean(allowMissingOrigin));
    },
    transports: ['websocket', 'polling'],
  });
  let currentPort = initialPort;
  let retryTimer = null;
  let authorizationSweepTimer = null;
  let sweepRunning = false;
  let closing = false;
  let retryCount = 0;
  let readySettled = false;
  let resolveReady;
  let rejectReady;
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const connectionsByIp = new Map();
  let activeConnectionCount = 0;
  const consumeIpJoinToken = createRateTokenConsumer({
    limit: joins.perIpLimit,
    windowMs: joins.perIpWindowMs,
    maxKeys: joins.maxIpKeys,
  });
  const consumeGlobalJoinToken = createRateTokenConsumer({
    limit: joins.globalLimit,
    windowMs: joins.globalWindowMs,
    maxKeys: 1,
  });

  function emitRoomError(socket, code) {
    socket.emit('room:error', {
      code,
      message: ERROR_MESSAGES[code],
    });
  }

  function requireJoined(socket, payload) {
    if (!socket.data.galleryId) {
      emitRoomError(socket, 'NOT_JOINED');
      return false;
    }
    if (!isPlainObject(payload) || payload.roomId !== socket.data.galleryId) {
      emitRoomError(socket, 'INVALID_PAYLOAD');
      return false;
    }
    return true;
  }

  function leaveCurrentRoom(socket) {
    const roomId = socket.data.galleryId;
    if (!roomId) return;
    socket.leave(roomId);
    const removed = removePlayer(socket.id, roomId);
    if (removed?.removed) {
      socket.to(roomId).emit('player:left', { roomId, id: socket.id });
    }
    socket.data.galleryId = null;
    socket.data.role = null;
    socket.data.shareToken = null;
    socket.data.sessionGeneration += 1;
  }

  function denyJoin(socket, roomId, code) {
    if (socket.data.galleryId === roomId) {
      leaveCurrentRoom(socket);
    }
    emitRoomError(socket, code);
  }

  function captureSession(socket) {
    return {
      galleryId: socket.data.galleryId,
      role: socket.data.role,
      shareToken: socket.data.shareToken,
      generation: socket.data.sessionGeneration,
    };
  }

  function sessionIsCurrent(socket, session) {
    return (
      socket.connected
      && socket.data.galleryId === session.galleryId
      && socket.data.sessionGeneration === session.generation
    );
  }

  function rejectStaleSession(socket, emitError = true) {
    if (emitError) emitRoomError(socket, 'FORBIDDEN');
    return null;
  }

  async function refreshRoomAccess(socket, session, { emitStaleError = true } = {}) {
    if (!session?.galleryId || !sessionIsCurrent(socket, session)) {
      return rejectStaleSession(socket, emitStaleError);
    }

    try {
      const auth = verifyToken(socket.data.handshakeToken) || null;
      const gallery = await getGalleryById(session.galleryId);
      if (!sessionIsCurrent(socket, session)) {
        return rejectStaleSession(socket, emitStaleError);
      }
      const share = session.shareToken
        ? await getGalleryByShareToken(session.shareToken)
        : null;
      if (!sessionIsCurrent(socket, session)) {
        return rejectStaleSession(socket, emitStaleError);
      }
      if (session.shareToken && !share) {
        leaveCurrentRoom(socket);
        emitRoomError(socket, 'INVALID_SHARE');
        return null;
      }
      const access = resolveGalleryAccess({
        gallery,
        auth,
        share,
        shareToken: session.shareToken,
      });

      socket.data.auth = auth;
      if (!access.allowed) {
        leaveCurrentRoom(socket);
        emitRoomError(socket, mapAccessReason(access.reason));
        return null;
      }

      if (access.role !== socket.data.role) {
        leaveCurrentRoom(socket);
        emitRoomError(socket, 'FORBIDDEN');
        return null;
      }

      return {
        access,
        galleryId: session.galleryId,
        generation: session.generation,
      };
    } catch (error) {
      console.error('[multiplayer] room authorization refresh failed', error);
      leaveCurrentRoom(socket);
      emitRoomError(socket, 'FORBIDDEN');
      return null;
    }
  }

  io.use((socket, next) => {
    const ip = socketIp(socket);
    const ipCount = connectionsByIp.get(ip) || 0;
    if (
      activeConnectionCount >= connections.maxConnections
      || ipCount >= connections.maxConnectionsPerIp
    ) {
      next(new Error('connection limit exceeded'));
      return;
    }

    activeConnectionCount += 1;
    connectionsByIp.set(ip, ipCount + 1);
    socket.data.connectionIp = ip;
    socket.data.connectionSlotReserved = true;
    socket.conn.once('close', () => {
      if (!socket.data.connectionSlotReserved) return;
      const remaining = (connectionsByIp.get(ip) || 1) - 1;
      if (remaining > 0) connectionsByIp.set(ip, remaining);
      else connectionsByIp.delete(ip);
      activeConnectionCount = Math.max(0, activeConnectionCount - 1);
      socket.data.connectionSlotReserved = false;
    });
    next();
  });

  io.on('connection', (socket) => {
    const consumeSocketJoinToken = createRateTokenConsumer({
      limit: joins.perSocketLimit,
      windowMs: joins.perSocketWindowMs,
      maxKeys: 1,
    });
    const consumeMoveToken = createRateTokenConsumer({
      limit: MOVE_RATE_LIMIT_PER_SEC,
      windowMs: 1000,
      maxKeys: 1,
    });
    const consumeChatToken = createRateTokenConsumer({
      limit: CHAT_RATE_LIMIT_PER_SEC,
      windowMs: 1000,
      maxKeys: 1,
    });
    const consumeSceneOperationToken = createRateTokenConsumer({
      limit: limits.operationLimit,
      windowMs: limits.operationWindowMs,
      maxKeys: 1,
    });
    const handshakeToken = socket.handshake.auth?.token;
    socket.data.handshakeToken = typeof handshakeToken === 'string'
      ? handshakeToken
      : null;
    socket.data.auth = verifyToken(handshakeToken) || null;
    socket.data.galleryId = null;
    socket.data.role = null;
    socket.data.shareToken = null;
    socket.data.sessionGeneration = 0;
    let joinSequence = 0;

    socket.on('room:join', async (payload) => {
      const sequence = ++joinSequence;
      if (
        !isPlainObject(payload)
        || !isSafeString(payload.roomId, ROOM_ID_MAX_LENGTH)
        || (
          payload.shareToken !== undefined
          && !isSafeString(payload.shareToken, ROOM_ID_MAX_LENGTH)
        )
      ) {
        const attemptedRoomId = typeof payload?.roomId === 'string'
          ? payload.roomId.trim()
          : null;
        denyJoin(socket, attemptedRoomId, 'INVALID_PAYLOAD');
        return;
      }

      const roomId = payload.roomId.trim();
      const shareToken = typeof payload.shareToken === 'string'
        ? payload.shareToken.trim()
        : null;
      const socketJoin = consumeSocketJoinToken('socket');
      const ipJoin = consumeIpJoinToken(socket.data.connectionIp);
      const globalJoin = consumeGlobalJoinToken('global');
      if (!socketJoin.allowed || !ipJoin.allowed || !globalJoin.allowed) {
        denyJoin(socket, roomId, 'RATE_LIMITED');
        return;
      }

      try {
        const currentAuth = verifyToken(socket.data.handshakeToken) || null;
        socket.data.auth = currentAuth;
        const gallery = await getGalleryById(roomId);
        if (sequence !== joinSequence || !socket.connected) return;
        if (!gallery) {
          denyJoin(socket, roomId, 'NOT_FOUND');
          return;
        }

        const share = shareToken
          ? await getGalleryByShareToken(shareToken)
          : null;
        if (sequence !== joinSequence || !socket.connected) return;
        if (shareToken && !share) {
          denyJoin(socket, roomId, 'INVALID_SHARE');
          return;
        }

        const access = resolveGalleryAccess({
          gallery,
          auth: currentAuth,
          share,
          shareToken,
        });
        if (!access.allowed) {
          denyJoin(socket, roomId, mapAccessReason(access.reason));
          return;
        }

        const wasAlreadyJoined = socket.data.galleryId === roomId;
        if (socket.data.galleryId && socket.data.galleryId !== roomId) {
          leaveCurrentRoom(socket);
        }

        socket.data.galleryId = roomId;
        socket.data.role = access.role;
        socket.data.shareToken = shareToken;
        socket.data.sessionGeneration += 1;
        socket.join(roomId);

        const nickname = normalizeNickname(payload.nickname);
        const existing = getPlayers(roomId).find((player) => player.id === socket.id);
        const snapshot = addPlayer(roomId, {
          ...(existing || {
            id: socket.id,
            position: { x: 0, y: 2.6, z: 5 },
            yaw: 0,
            lastSeq: 0,
          }),
          nickname,
          updatedAt: Date.now(),
        });

        socket.emit('room:joined', {
          selfId: socket.id,
          roomId,
          role: access.role,
          players: snapshot.players,
        });

        const currentScene = getRoomScene(roomId);
        if (currentScene) {
          socket.emit('scene:synced', {
            roomId,
            by: 'server',
            scene: scenePayload(currentScene),
            updatedAt: currentScene.updatedAt,
          });
        }

        if (!wasAlreadyJoined) {
          socket.to(roomId).emit('player:joined', {
            roomId,
            player: snapshot.players.find((player) => player.id === socket.id),
          });
        }
      } catch (error) {
        console.error('[multiplayer] room join failed', error);
        denyJoin(socket, roomId, 'FORBIDDEN');
      }
    });

    socket.on('player:move', async (payload) => {
      if (!requireJoined(socket, payload)) return;
      const session = captureSession(socket);
      const authorized = await refreshRoomAccess(socket, session);
      if (!authorized) return;
      const roomId = authorized.galleryId;
      if (payload.roomId !== roomId || !isValidMovePayload(payload, roomId, movement)) {
        emitRoomError(socket, 'INVALID_PAYLOAD');
        return;
      }
      if (!consumeMoveToken('socket').allowed) {
        emitRoomError(socket, 'RATE_LIMITED');
        return;
      }

      if (!sessionIsCurrent(socket, session)) {
        rejectStaleSession(socket);
        return;
      }
      const updated = updatePlayerMove(socket.id, payload);
      if (!updated) return;
      socket.to(roomId).emit('player:moved', {
        roomId,
        id: socket.id,
        seq: payload.seq,
        t: payload.t,
        position: updated.position,
        yaw: updated.yaw,
        updatedAt: updated.updatedAt,
      });
    });

    socket.on('chat:send', async (payload) => {
      if (!requireJoined(socket, payload)) return;
      const session = captureSession(socket);
      const authorized = await refreshRoomAccess(socket, session);
      if (!authorized || !CHAT_ROLES.has(authorized.access.role)) {
        if (authorized) emitRoomError(socket, 'FORBIDDEN');
        return;
      }
      const roomId = authorized.galleryId;
      if (payload.roomId !== roomId) {
        emitRoomError(socket, 'INVALID_PAYLOAD');
        return;
      }
      if (typeof payload.message !== 'string' || !payload.message.trim()) {
        emitRoomError(socket, 'INVALID_PAYLOAD');
        return;
      }
      if (!consumeChatToken('socket').allowed) {
        emitRoomError(socket, 'RATE_LIMITED');
        return;
      }

      if (!sessionIsCurrent(socket, session)) {
        rejectStaleSession(socket);
        return;
      }
      io.to(roomId).emit('chat:new', {
        roomId,
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        by: socket.id,
        nickname: normalizeNickname(payload.nickname),
        message: payload.message.trim().slice(0, CHAT_MAX_LENGTH),
        createdAt: Date.now(),
        type: 'chat',
      });
    });

    socket.on('scene:sync', async (payload) => {
      if (!requireJoined(socket, payload)) return;
      const session = captureSession(socket);
      const authorized = await refreshRoomAccess(socket, session);
      if (!authorized || !EDIT_ROLES.has(authorized.access.role)) {
        if (authorized) emitRoomError(socket, 'FORBIDDEN');
        return;
      }
      const roomId = authorized.galleryId;
      if (payload.roomId !== roomId) {
        emitRoomError(socket, 'INVALID_PAYLOAD');
        return;
      }
      if (!isValidScene(payload.scene, limits)) {
        emitRoomError(socket, 'INVALID_PAYLOAD');
        return;
      }
      if (!consumeSceneOperationToken('socket').allowed) {
        emitRoomError(socket, 'RATE_LIMITED');
        return;
      }

      if (!sessionIsCurrent(socket, session)) {
        rejectStaleSession(socket);
        return;
      }
      const snapshot = setRoomScene(roomId, payload.scene);
      socket.to(roomId).emit('scene:synced', {
        roomId,
        by: socket.id,
        scene: scenePayload(snapshot),
        updatedAt: snapshot.updatedAt,
      });
    });

    socket.on('scene:op', async (payload) => {
      if (!requireJoined(socket, payload)) return;
      const session = captureSession(socket);
      const authorized = await refreshRoomAccess(socket, session);
      if (!authorized || !EDIT_ROLES.has(authorized.access.role)) {
        if (authorized) emitRoomError(socket, 'FORBIDDEN');
        return;
      }
      const roomId = authorized.galleryId;
      if (payload.roomId !== roomId) {
        emitRoomError(socket, 'INVALID_PAYLOAD');
        return;
      }
      if (
        !isSafeString(payload.clientOpId, CLIENT_OP_ID_MAX_LENGTH)
        || !isValidSceneOp(payload.op, limits)
      ) {
        emitRoomError(socket, 'INVALID_PAYLOAD');
        return;
      }
      if (!consumeSceneOperationToken('socket').allowed) {
        emitRoomError(socket, 'RATE_LIMITED');
        return;
      }

      if (!sessionIsCurrent(socket, session)) {
        rejectStaleSession(socket);
        return;
      }
      const snapshot = applyRoomSceneOp(
        roomId,
        payload.op,
        (candidate) => isValidScene(
          candidate,
          limits,
          { allowNullRoomSize: true },
        ),
      );
      if (!snapshot) {
        emitRoomError(socket, 'INVALID_PAYLOAD');
        return;
      }

      socket.emit('scene:op:ack', {
        roomId,
        clientOpId: payload.clientOpId,
        updatedAt: snapshot.updatedAt,
      });
      socket.to(roomId).emit('scene:oped', {
        roomId,
        by: socket.id,
        clientOpId: payload.clientOpId,
        op: payload.op,
        updatedAt: snapshot.updatedAt,
      });
    });

    socket.on('scene:focus', async (payload) => {
      if (!requireJoined(socket, payload)) return;
      const session = captureSession(socket);
      const authorized = await refreshRoomAccess(socket, session);
      if (!authorized || !EDIT_ROLES.has(authorized.access.role)) {
        if (authorized) emitRoomError(socket, 'FORBIDDEN');
        return;
      }
      const roomId = authorized.galleryId;
      if (payload.roomId !== roomId) {
        emitRoomError(socket, 'INVALID_PAYLOAD');
        return;
      }
      if (
        payload.itemId !== null
        && payload.itemId !== undefined
        && !isSafeString(payload.itemId, ITEM_ID_MAX_LENGTH)
      ) {
        emitRoomError(socket, 'INVALID_PAYLOAD');
        return;
      }
      if (!consumeSceneOperationToken('socket').allowed) {
        emitRoomError(socket, 'RATE_LIMITED');
        return;
      }

      if (!sessionIsCurrent(socket, session)) {
        rejectStaleSession(socket);
        return;
      }
      socket.to(roomId).emit('scene:focus', {
        roomId,
        by: socket.id,
        nickname: normalizeNickname(payload.nickname),
        itemId: typeof payload.itemId === 'string' ? payload.itemId.trim() : null,
        updatedAt: Date.now(),
      });
    });

    socket.on('disconnect', () => {
      joinSequence += 1;
      if (socket.data.connectionSlotReserved) {
        const ip = socket.data.connectionIp;
        const remaining = (connectionsByIp.get(ip) || 1) - 1;
        if (remaining > 0) connectionsByIp.set(ip, remaining);
        else connectionsByIp.delete(ip);
        activeConnectionCount = Math.max(0, activeConnectionCount - 1);
        socket.data.connectionSlotReserved = false;
      }
      const roomId = socket.data.galleryId;
      const removed = removePlayer(socket.id, roomId || undefined);
      if (removed?.removed) {
        socket.to(removed.roomId).emit('player:left', {
          roomId: removed.roomId,
          id: socket.id,
        });
      }
    });
  });

  if (authorizationSweepMs > 0) {
    authorizationSweepTimer = setInterval(async () => {
      if (sweepRunning || closing) return;
      sweepRunning = true;
      try {
        const sockets = Array.from(io.of('/').sockets.values());
        for (const socket of sockets) {
          if (!socket.data.galleryId) continue;
          const session = captureSession(socket);
          await refreshRoomAccess(socket, session, { emitStaleError: false });
        }
      } finally {
        sweepRunning = false;
      }
    }, authorizationSweepMs);
    authorizationSweepTimer.unref?.();
  }

  function listen() {
    if (!closing) httpServer.listen(currentPort);
  }

  httpServer.on('listening', () => {
    if (!readySettled) {
      readySettled = true;
      resolveReady();
    }
    console.log(`[multiplayer] socket server running on :${httpServer.address().port}`);
  });

  httpServer.on('error', (error) => {
    const canRetry = (
      !closing
      && error?.code === 'EADDRINUSE'
      && currentPort !== 0
      && retryCount < startup.maxPortRetries
      && currentPort < 65535
    );
    if (canRetry) {
      const occupiedPort = currentPort;
      currentPort += 1;
      retryCount += 1;
      console.warn(
        `[multiplayer] port ${occupiedPort} is in use, retrying on ${currentPort}...`,
      );
      retryTimer = setTimeout(listen, startup.retryDelayMs);
      return;
    }
    console.error('[multiplayer] failed to start socket server', error);
    if (!readySettled) {
      readySettled = true;
      rejectReady(error);
    }
  });

  listen();

  return {
    io,
    httpServer,
    ready,
    port: () => httpServer.address()?.port,
    close: async () => {
      if (closing) return;
      closing = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      if (authorizationSweepTimer) {
        clearInterval(authorizationSweepTimer);
        authorizationSweepTimer = null;
      }

      await new Promise((resolve) => {
        io.close(() => resolve());
      });
      if (httpServer.listening) {
        await new Promise((resolve, reject) => {
          httpServer.close((error) => (error ? reject(error) : resolve()));
        });
      }
      clearRooms();
    },
  };
}
