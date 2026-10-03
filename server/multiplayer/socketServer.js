import { createServer } from 'node:http';
import { isDeepStrictEqual } from 'node:util';
import { Server } from 'socket.io';

import {
  DEFAULT_AVATAR_APPEARANCE,
  parseAvatarAppearance,
} from '../schemas/avatarAppearanceSchema.js';
import { exhibitWorkContextSchema } from '../schemas/sceneSchema.js';
import { resolveGalleryAccess } from '../security/galleryAccess.js';
import { createRateTokenConsumer } from '../security/rateLimit.js';
import { createMemorySceneStore } from './memorySceneStore.js';
import { normalizeNickname } from './rooms.js';

const MOVE_RATE_LIMIT_PER_SEC = 25;
const CHAT_RATE_LIMIT_PER_SEC = 3;
const CHAT_MAX_LENGTH = 300;
const APPEARANCE_MAX_BYTES = 1024;
const APPEARANCE_RATE_LIMIT_WINDOW_MS = 2000;
const AVATAR_EMOTES = new Set(['none', 'wave', 'cheer', 'clap', 'bow']);
const ROOM_ID_MAX_LENGTH = 128;
const CLIENT_OP_ID_MAX_LENGTH = 128;
const ITEM_ID_MAX_LENGTH = 256;
export const DEFAULT_SCENE_LIMITS = Object.freeze({
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
  'chair',
  'sofa',
  'floorlamp',
  'cabinet',
  'turntable',
  'fountain',
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
  SCENE_CONFLICT: 'scene state has changed; resync required',
  SCENE_MISSING: 'live scene is missing; send a full scene to rebuild it',
  COLLABORATION_UNAVAILABLE: 'collaboration service is unavailable',
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
    && (
      payload.pose === undefined
      || payload.pose === 'standing'
      || payload.pose === 'sitting'
    )
    && (
      payload.emote === undefined
      || AVATAR_EMOTES.has(payload.emote)
    )
    && (
      payload.emoteNonce === undefined
      || (Number.isSafeInteger(payload.emoteNonce) && payload.emoteNonce >= 0)
    )
    && !Object.prototype.hasOwnProperty.call(payload, 'appearance')
  );
}

function parseOptionalAvatarAppearance(value) {
  if (value === undefined) return undefined;
  if (serializedBytes(value) > APPEARANCE_MAX_BYTES) return null;
  try {
    return parseAvatarAppearance(value);
  } catch {
    return null;
  }
}

function defaultAvatarAppearance() {
  return parseAvatarAppearance(DEFAULT_AVATAR_APPEARANCE);
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
    && (
      item.workContext === undefined
      || exhibitWorkContextSchema.safeParse(item.workContext).success
    )
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

export function isValidScene(scene, limits, { allowNullRoomSize = false } = {}) {
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

export async function fetchRoomPlayers(io, roomId, { includeSocketId } = {}) {
  const candidates = await io.in(roomId).fetchSockets();
  return candidates.flatMap((candidate) => {
    const player = candidate.data?.player;
    if (
      candidate.data?.galleryId !== roomId
      || !player
      || player.id !== candidate.id
      || (
        candidate.data?.playerAnnounced !== true
        && candidate.id !== includeSocketId
      )
    ) {
      return [];
    }
    return [player];
  });
}

export function startMultiplayerServer({
  host,
  initialPort,
  corsOrigin,
  verifyToken,
  verifySessionToken = verifyToken,
  getGalleryById,
  getGalleryByShareToken,
  collaboration = null,
  sceneStore: injectedSceneStore,
  sceneTtlMs,
  sceneLimits,
  allowMissingOrigin = false,
  allowWildcardOrigin = process.env.NODE_ENV !== 'production',
  startupLimits,
  connectionLimits,
  joinLimits,
  movementLimits,
  appearanceRateLimitNow = Date.now,
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
  if (typeof appearanceRateLimitNow !== 'function') {
    throw new TypeError('appearanceRateLimitNow must be a function');
  }

  const limits = normalizeSceneLimits(sceneLimits);
  const sceneStore = injectedSceneStore || createMemorySceneStore({
    ...(sceneTtlMs === undefined ? {} : { ttlMs: sceneTtlMs }),
  });
  if (
    !sceneStore
    || typeof sceneStore.initialize !== 'function'
    || typeof sceneStore.get !== 'function'
    || typeof sceneStore.replace !== 'function'
    || typeof sceneStore.applyOperation !== 'function'
    || typeof sceneStore.checkReadiness !== 'function'
    || typeof sceneStore.close !== 'function'
  ) {
    throw new TypeError('sceneStore must implement the live scene store contract');
  }
  if (
    collaboration
    && (
      typeof collaboration.attach !== 'function'
      || typeof collaboration.checkReadiness !== 'function'
      || typeof collaboration.close !== 'function'
    )
  ) {
    throw new TypeError('collaboration must implement attach, checkReadiness, and close');
  }
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
  let closePromise = null;
  let cleanupPromise = null;
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
  const membershipTransitions = new WeakMap();

  function enqueueMembershipTransition(socket, transition) {
    const previous = membershipTransitions.get(socket) || Promise.resolve();
    const current = previous.then(transition, transition);
    membershipTransitions.set(socket, current.catch(() => {}));
    return current;
  }

  function emitRoomError(socket, code, metadata = {}) {
    socket.emit('room:error', {
      code,
      message: ERROR_MESSAGES[code],
      ...metadata,
    });
  }

  function parsePersistedScene(gallery) {
    if (gallery?.scene_json === null || gallery?.scene_json === undefined) {
      return null;
    }
    try {
      const scene = typeof gallery.scene_json === 'string'
        ? JSON.parse(gallery.scene_json)
        : gallery.scene_json;
      return isValidScene(scene, limits) ? scene : null;
    } catch {
      return null;
    }
  }

  async function emitAuthoritativeScene(
    socket,
    roomId,
    session,
    by = 'server',
    metadata = {},
  ) {
    const current = await sceneStore.get(roomId);
    if (!sessionIsCurrent(socket, session)) return { stale: true, current };
    if (!current) return { stale: false, current: null };
    socket.emit('scene:synced', {
      roomId,
      by,
      scene: scenePayload(current.scene),
      version: current.version,
      updatedAt: current.updatedAt,
      ...metadata,
    });
    return { stale: false, current };
  }

  async function reportSceneStoreFailure(socket, error, metadata = {}) {
    console.error('[multiplayer] scene store operation failed', error);
    emitRoomError(socket, 'COLLABORATION_UNAVAILABLE', metadata);
  }

  function requireJoined(socket, payload, metadata = {}) {
    if (!socket.data.galleryId) {
      emitRoomError(socket, 'NOT_JOINED', metadata);
      return false;
    }
    if (!isPlainObject(payload) || payload.roomId !== socket.data.galleryId) {
      emitRoomError(socket, 'INVALID_PAYLOAD', metadata);
      return false;
    }
    return true;
  }

  async function leaveCurrentRoomUnlocked(socket, {
    leaveAdapter = true,
    emitPresence = true,
  } = {}) {
    const roomId = socket.data.galleryId;
    const player = socket.data.player;
    const playerAnnounced = socket.data.playerAnnounced;
    if (!roomId) return false;

    socket.data.galleryId = null;
    socket.data.role = null;
    socket.data.shareToken = null;
    socket.data.player = null;
    socket.data.playerAnnounced = false;
    socket.data.sessionGeneration += 1;
    if (leaveAdapter) {
      await socket.leave(roomId);
    }
    if (
      emitPresence
      && playerAnnounced
      && player?.id === socket.id
    ) {
      io.to(roomId).except(socket.id).emit('player:left', {
        roomId,
        id: socket.id,
      });
      return true;
    }
    return false;
  }

  function denyJoin(socket, roomId, code, isCurrent) {
    return enqueueMembershipTransition(socket, async () => {
      if (
        socket.data.membershipClosed
        || !socket.connected
        || !isCurrent()
      ) {
        return;
      }
      if (socket.data.galleryId === roomId) {
        await leaveCurrentRoomUnlocked(socket);
      }
      emitRoomError(socket, code);
    });
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

  function rejectStaleSession(socket, emitError = true, errorMetadata = {}) {
    if (emitError) emitRoomError(socket, 'FORBIDDEN', errorMetadata);
    return null;
  }

  async function refreshRoomAccess(
    socket,
    session,
    { emitStaleError = true, errorMetadata = {} } = {},
  ) {
    if (!session?.galleryId || !sessionIsCurrent(socket, session)) {
      return rejectStaleSession(socket, emitStaleError, errorMetadata);
    }

    try {
      const auth = await verifySessionToken(socket.data.handshakeToken) || null;
      if (socket.data.handshakeToken && !auth) {
        await enqueueMembershipTransition(socket, () => leaveCurrentRoomUnlocked(socket));
        emitRoomError(socket, 'AUTH_REQUIRED', errorMetadata);
        socket.disconnect(true);
        return null;
      }
      const gallery = await getGalleryById(session.galleryId);
      if (!sessionIsCurrent(socket, session)) {
        return rejectStaleSession(socket, emitStaleError, errorMetadata);
      }
      const share = session.shareToken
        ? await getGalleryByShareToken(session.shareToken)
        : null;
      if (!sessionIsCurrent(socket, session)) {
        return rejectStaleSession(socket, emitStaleError, errorMetadata);
      }
      if (session.shareToken && !share) {
        return enqueueMembershipTransition(socket, async () => {
          if (!sessionIsCurrent(socket, session)) {
            return rejectStaleSession(socket, emitStaleError, errorMetadata);
          }
          await leaveCurrentRoomUnlocked(socket);
          emitRoomError(socket, 'INVALID_SHARE', errorMetadata);
          return null;
        });
      }
      const access = resolveGalleryAccess({
        gallery,
        auth,
        share,
        shareToken: session.shareToken,
      });

      socket.data.auth = auth;
      if (!access.allowed) {
        return enqueueMembershipTransition(socket, async () => {
          if (!sessionIsCurrent(socket, session)) {
            return rejectStaleSession(socket, emitStaleError, errorMetadata);
          }
          await leaveCurrentRoomUnlocked(socket);
          emitRoomError(socket, mapAccessReason(access.reason), errorMetadata);
          return null;
        });
      }

      if (access.role !== socket.data.role) {
        return enqueueMembershipTransition(socket, async () => {
          if (!sessionIsCurrent(socket, session)) {
            return rejectStaleSession(socket, emitStaleError, errorMetadata);
          }
          await leaveCurrentRoomUnlocked(socket);
          emitRoomError(socket, 'FORBIDDEN', errorMetadata);
          return null;
        });
      }

      return {
        access,
        galleryId: session.galleryId,
        generation: session.generation,
      };
    } catch (error) {
      console.error('[multiplayer] room authorization refresh failed', error);
      if (!sessionIsCurrent(socket, session)) {
        return rejectStaleSession(socket, emitStaleError, errorMetadata);
      }
      return enqueueMembershipTransition(socket, async () => {
        if (!sessionIsCurrent(socket, session)) {
          return rejectStaleSession(socket, emitStaleError, errorMetadata);
        }
        await leaveCurrentRoomUnlocked(socket);
        emitRoomError(socket, 'FORBIDDEN', errorMetadata);
        return null;
      });
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
    const consumeAppearanceToken = createRateTokenConsumer({
      limit: 1,
      windowMs: APPEARANCE_RATE_LIMIT_WINDOW_MS,
      maxKeys: 1,
      now: appearanceRateLimitNow,
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
    socket.data.player = null;
    socket.data.playerAnnounced = false;
    socket.data.membershipClosed = false;
    socket.data.sessionGeneration = 0;
    let joinSequence = 0;

    socket.on('room:join', async (payload) => {
      const sequence = ++joinSequence;
      const requestedAppearance = isPlainObject(payload)
        ? parseOptionalAvatarAppearance(payload.appearance)
        : null;
      if (
        !isPlainObject(payload)
        || !isSafeString(payload.roomId, ROOM_ID_MAX_LENGTH)
        || requestedAppearance === null
        || (
          payload.shareToken !== undefined
          && !isSafeString(payload.shareToken, ROOM_ID_MAX_LENGTH)
        )
      ) {
        const attemptedRoomId = typeof payload?.roomId === 'string'
          ? payload.roomId.trim()
          : null;
        await denyJoin(
          socket,
          attemptedRoomId,
          'INVALID_PAYLOAD',
          () => sequence === joinSequence,
        );
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
        await denyJoin(
          socket,
          roomId,
          'RATE_LIMITED',
          () => sequence === joinSequence,
        );
        return;
      }

      try {
        const currentAuth = await verifySessionToken(socket.data.handshakeToken) || null;
        if (socket.data.handshakeToken && !currentAuth) {
          await denyJoin(socket, roomId, 'AUTH_REQUIRED', () => sequence === joinSequence);
          socket.disconnect(true);
          return;
        }
        socket.data.auth = currentAuth;
        const gallery = await getGalleryById(roomId);
        if (sequence !== joinSequence || !socket.connected) return;
        if (!gallery) {
          await denyJoin(
            socket,
            roomId,
            'NOT_FOUND',
            () => sequence === joinSequence,
          );
          return;
        }

        const share = shareToken
          ? await getGalleryByShareToken(shareToken)
          : null;
        if (sequence !== joinSequence || !socket.connected) return;
        if (shareToken && !share) {
          await denyJoin(
            socket,
            roomId,
            'INVALID_SHARE',
            () => sequence === joinSequence,
          );
          return;
        }

        const access = resolveGalleryAccess({
          gallery,
          auth: currentAuth,
          share,
          shareToken,
        });
        if (!access.allowed) {
          await denyJoin(
            socket,
            roomId,
            mapAccessReason(access.reason),
            () => sequence === joinSequence,
          );
          return;
        }

        const nickname = normalizeNickname(payload.nickname);
        await enqueueMembershipTransition(socket, async () => {
          if (
            sequence !== joinSequence
            || !socket.connected
            || socket.data.membershipClosed
          ) {
            return;
          }

          const wasAlreadyJoined = socket.data.galleryId === roomId;
          const existing = wasAlreadyJoined ? socket.data.player : null;
          const existingRole = socket.data.role;
          const existingShareToken = socket.data.shareToken;
          const existingAnnounced = socket.data.playerAnnounced;
          if (socket.data.galleryId && !wasAlreadyJoined) {
            await leaveCurrentRoomUnlocked(socket);
            if (
              sequence !== joinSequence
              || !socket.connected
              || socket.data.membershipClosed
            ) {
              return;
            }
          }

          socket.data.galleryId = roomId;
          socket.data.role = access.role;
          socket.data.shareToken = shareToken;
          socket.data.sessionGeneration += 1;
          const generation = socket.data.sessionGeneration;
          socket.data.player = {
            ...(existing || {
              id: socket.id,
              position: { x: 0, y: 2.6, z: 5 },
              yaw: 0,
              pose: 'standing',
              emote: 'none',
              emoteNonce: 0,
              lastSeq: 0,
            }),
            nickname,
            appearance: requestedAppearance
              ?? existing?.appearance
              ?? defaultAvatarAppearance(),
            updatedAt: Date.now(),
          };
          socket.data.playerAnnounced = existingAnnounced && wasAlreadyJoined;
          await socket.join(roomId);
          if (
            sequence !== joinSequence
            || !socket.connected
            || socket.data.membershipClosed
            || socket.data.sessionGeneration !== generation
          ) {
            if (wasAlreadyJoined) {
              socket.data.role = existingRole;
              socket.data.shareToken = existingShareToken;
              socket.data.player = existing;
              socket.data.playerAnnounced = existingAnnounced;
              socket.data.sessionGeneration += 1;
            } else {
              await leaveCurrentRoomUnlocked(socket, { emitPresence: false });
            }
            return;
          }

          const players = await fetchRoomPlayers(io, roomId, {
            includeSocketId: socket.id,
          });
          if (
            sequence !== joinSequence
            || !socket.connected
            || socket.data.membershipClosed
            || socket.data.sessionGeneration !== generation
          ) {
            if (wasAlreadyJoined) {
              socket.data.role = existingRole;
              socket.data.shareToken = existingShareToken;
              socket.data.player = existing;
              socket.data.playerAnnounced = existingAnnounced;
              socket.data.sessionGeneration += 1;
            } else {
              await leaveCurrentRoomUnlocked(socket, { emitPresence: false });
            }
            return;
          }

          let currentScene;
          try {
            const persistedScene = parsePersistedScene(gallery);
            currentScene = persistedScene
              ? await sceneStore.initialize(roomId, persistedScene)
              : await sceneStore.get(roomId);
          } catch (error) {
            await reportSceneStoreFailure(socket, error);
            await leaveCurrentRoomUnlocked(socket, { emitPresence: false });
            return;
          }
          if (
            sequence !== joinSequence
            || !socket.connected
            || socket.data.membershipClosed
            || socket.data.sessionGeneration !== generation
          ) {
            if (wasAlreadyJoined) {
              socket.data.role = existingRole;
              socket.data.shareToken = existingShareToken;
              socket.data.player = existing;
              socket.data.playerAnnounced = existingAnnounced;
              socket.data.sessionGeneration += 1;
            } else {
              await leaveCurrentRoomUnlocked(socket, { emitPresence: false });
            }
            return;
          }

          socket.emit('room:joined', {
            selfId: socket.id,
            roomId,
            role: access.role,
            players,
          });
          socket.data.playerAnnounced = true;

          if (currentScene) {
            socket.emit('scene:synced', {
              roomId,
              by: 'server',
              scene: scenePayload(currentScene.scene),
              version: currentScene.version,
              updatedAt: currentScene.updatedAt,
            });
          }

          if (!wasAlreadyJoined) {
            socket.to(roomId).emit('player:joined', {
              roomId,
              player: socket.data.player,
            });
          }
        });
      } catch (error) {
        console.error('[multiplayer] room join failed', error);
        if (sequence === joinSequence && socket.connected) {
          await denyJoin(
            socket,
            roomId,
            'FORBIDDEN',
            () => sequence === joinSequence,
          );
        }
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
        rejectStaleSession(socket, true);
        return;
      }
      const currentPlayer = socket.data.player;
      if (!currentPlayer || payload.seq <= currentPlayer.lastSeq) return;
      const updated = {
        ...currentPlayer,
        position: payload.position,
        yaw: payload.yaw,
        pose: payload.pose === 'sitting' ? 'sitting' : 'standing',
        emote: AVATAR_EMOTES.has(payload.emote) ? payload.emote : 'none',
        emoteNonce: Number.isSafeInteger(payload.emoteNonce)
          ? payload.emoteNonce
          : currentPlayer.emoteNonce ?? 0,
        lastSeq: payload.seq,
        updatedAt: Date.now(),
      };
      socket.data.player = updated;
      socket.to(roomId).emit('player:moved', {
        roomId,
        id: socket.id,
        seq: payload.seq,
        t: payload.t,
        position: updated.position,
        yaw: updated.yaw,
        pose: updated.pose,
        emote: updated.emote,
        emoteNonce: updated.emoteNonce,
        updatedAt: updated.updatedAt,
      });
    });

    socket.on('player:appearance', async (payload) => {
      if (!requireJoined(socket, payload)) return;
      const session = captureSession(socket);
      const authorized = await refreshRoomAccess(socket, session);
      if (!authorized) return;
      const roomId = authorized.galleryId;
      const appearance = (
        serializedBytes(payload) <= APPEARANCE_MAX_BYTES
        && Object.prototype.hasOwnProperty.call(payload, 'appearance')
      )
        ? parseOptionalAvatarAppearance(payload.appearance)
        : null;
      if (payload.roomId !== roomId || appearance === null || appearance === undefined) {
        emitRoomError(socket, 'INVALID_PAYLOAD');
        return;
      }
      if (!consumeAppearanceToken('socket').allowed) {
        emitRoomError(socket, 'RATE_LIMITED');
        return;
      }
      if (!sessionIsCurrent(socket, session)) {
        rejectStaleSession(socket, true);
        return;
      }

      const currentPlayer = socket.data.player;
      if (!currentPlayer) {
        emitRoomError(socket, 'NOT_JOINED');
        return;
      }
      const updatedAt = Date.now();
      socket.data.player = {
        ...currentPlayer,
        appearance,
        updatedAt,
      };
      io.to(roomId).emit('player:appearance:changed', {
        roomId,
        id: socket.id,
        appearance,
        updatedAt,
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
        rejectStaleSession(socket, true);
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
      const clientSyncId = isPlainObject(payload)
        && isSafeString(payload.clientSyncId, CLIENT_OP_ID_MAX_LENGTH)
        ? payload.clientSyncId
        : undefined;
      const syncErrorMetadata = {
        ...(socket.data.galleryId ? { roomId: socket.data.galleryId } : {}),
        ...(clientSyncId ? { clientSyncId } : {}),
      };
      if (!requireJoined(socket, payload, syncErrorMetadata)) return;
      if (payload.clientSyncId !== undefined && !clientSyncId) {
        emitRoomError(socket, 'INVALID_PAYLOAD', syncErrorMetadata);
        return;
      }
      const session = captureSession(socket);
      const authorized = await refreshRoomAccess(socket, session, {
        errorMetadata: syncErrorMetadata,
      });
      if (!authorized || !EDIT_ROLES.has(authorized.access.role)) {
        if (authorized) emitRoomError(socket, 'FORBIDDEN', syncErrorMetadata);
        return;
      }
      const roomId = authorized.galleryId;
      if (payload.roomId !== roomId) {
        emitRoomError(socket, 'INVALID_PAYLOAD', syncErrorMetadata);
        return;
      }
      if (!isValidScene(payload.scene, limits)) {
        emitRoomError(socket, 'INVALID_PAYLOAD', syncErrorMetadata);
        return;
      }
      if (!consumeSceneOperationToken('socket').allowed) {
        emitRoomError(socket, 'RATE_LIMITED', syncErrorMetadata);
        return;
      }

      if (!sessionIsCurrent(socket, session)) {
        rejectStaleSession(socket, true, syncErrorMetadata);
        return;
      }
      try {
        const current = await sceneStore.get(roomId);
        if (!sessionIsCurrent(socket, session)) {
          rejectStaleSession(socket, true, syncErrorMetadata);
          return;
        }
        let result;
        if (!current) {
          const initialized = await sceneStore.initialize(roomId, payload.scene);
          if (!isDeepStrictEqual(initialized.scene, payload.scene)) {
            if (sessionIsCurrent(socket, session)) {
              emitRoomError(socket, 'SCENE_CONFLICT', syncErrorMetadata);
              socket.emit('scene:synced', {
                roomId,
                by: 'server',
                scene: scenePayload(initialized.scene),
                version: initialized.version,
                updatedAt: initialized.updatedAt,
                ...(clientSyncId ? { clientSyncId } : {}),
              });
            }
            return;
          }
          result = {
            accepted: true,
            ...initialized,
          };
        } else {
          if (
            !Number.isSafeInteger(payload.expectedVersion)
            || payload.expectedVersion < 1
          ) {
            emitRoomError(socket, 'INVALID_PAYLOAD', syncErrorMetadata);
            return;
          }
          result = await sceneStore.replace(
            roomId,
            payload.scene,
            (candidate) => isValidScene(candidate, limits),
            { expectedVersion: payload.expectedVersion },
          );
        }

        if (result.accepted) {
          const syncedEvent = {
            roomId,
            by: socket.id,
            scene: scenePayload(result.scene),
            version: result.version,
            updatedAt: result.updatedAt,
          };
          if (clientSyncId && sessionIsCurrent(socket, session)) {
            io.to(roomId).except(socket.id).emit('scene:synced', syncedEvent);
            socket.emit('scene:synced', { ...syncedEvent, clientSyncId });
          } else {
            io.to(roomId).emit('scene:synced', syncedEvent);
          }
          return;
        }
        if (!sessionIsCurrent(socket, session)) {
          rejectStaleSession(socket, true, syncErrorMetadata);
          return;
        }
        if (result.reason === 'conflict') {
          emitRoomError(socket, 'SCENE_CONFLICT', syncErrorMetadata);
          await emitAuthoritativeScene(
            socket,
            roomId,
            session,
            'server',
            clientSyncId ? { clientSyncId } : {},
          );
        } else if (result.reason === 'missing_scene') {
          emitRoomError(socket, 'SCENE_MISSING', syncErrorMetadata);
        } else {
          emitRoomError(socket, 'INVALID_PAYLOAD', syncErrorMetadata);
        }
      } catch (error) {
        if (sessionIsCurrent(socket, session)) {
          await reportSceneStoreFailure(socket, error, syncErrorMetadata);
        }
      }
    });

    socket.on('scene:op', async (payload) => {
      const clientOpId = isPlainObject(payload)
        && isSafeString(payload.clientOpId, CLIENT_OP_ID_MAX_LENGTH)
        ? payload.clientOpId
        : undefined;
      const operationErrorMetadata = {
        ...(socket.data.galleryId ? { roomId: socket.data.galleryId } : {}),
        ...(clientOpId ? { clientOpId } : {}),
      };
      if (!requireJoined(socket, payload, operationErrorMetadata)) return;
      const session = captureSession(socket);
      const authorized = await refreshRoomAccess(socket, session, {
        errorMetadata: operationErrorMetadata,
      });
      if (!authorized || !EDIT_ROLES.has(authorized.access.role)) {
        if (authorized) emitRoomError(socket, 'FORBIDDEN', operationErrorMetadata);
        return;
      }
      const roomId = authorized.galleryId;
      if (payload.roomId !== roomId) {
        emitRoomError(socket, 'INVALID_PAYLOAD', operationErrorMetadata);
        return;
      }
      if (
        !isSafeString(payload.clientOpId, CLIENT_OP_ID_MAX_LENGTH)
        || !isValidSceneOp(payload.op, limits)
      ) {
        emitRoomError(socket, 'INVALID_PAYLOAD', operationErrorMetadata);
        return;
      }
      if (!consumeSceneOperationToken('socket').allowed) {
        emitRoomError(socket, 'RATE_LIMITED', operationErrorMetadata);
        return;
      }

      if (!sessionIsCurrent(socket, session)) {
        rejectStaleSession(socket);
        return;
      }
      try {
        const result = await sceneStore.applyOperation(
          roomId,
          payload.op,
          (candidate) => isValidScene(
            candidate,
            limits,
            { allowNullRoomSize: true },
          ),
        );
        if (result.accepted) {
          const event = {
            roomId,
            by: socket.id,
            clientOpId: payload.clientOpId,
            op: payload.op,
            version: result.version,
            updatedAt: result.updatedAt,
          };
          if (sessionIsCurrent(socket, session)) {
            io.to(roomId).except(socket.id).emit('scene:oped', event);
            socket.emit('scene:op:ack', {
              roomId,
              clientOpId: payload.clientOpId,
              version: result.version,
              updatedAt: result.updatedAt,
            });
          } else {
            io.to(roomId).emit('scene:oped', event);
          }
          return;
        }
        if (!sessionIsCurrent(socket, session)) return;
        if (result.reason === 'conflict') {
          emitRoomError(socket, 'SCENE_CONFLICT', operationErrorMetadata);
          await emitAuthoritativeScene(socket, roomId, session);
        } else if (result.reason === 'missing_scene') {
          emitRoomError(socket, 'SCENE_MISSING', operationErrorMetadata);
        } else {
          emitRoomError(socket, 'INVALID_PAYLOAD', operationErrorMetadata);
        }
      } catch (error) {
        if (sessionIsCurrent(socket, session)) {
          await reportSceneStoreFailure(socket, error, operationErrorMetadata);
        }
      }
    });

    socket.on('scene:request-sync', async (payload) => {
      if (!requireJoined(socket, payload)) return;
      const session = captureSession(socket);
      const authorized = await refreshRoomAccess(socket, session);
      if (!authorized) return;
      try {
        const result = await emitAuthoritativeScene(
          socket,
          authorized.galleryId,
          session,
        );
        if (!result.stale && !result.current) {
          emitRoomError(socket, 'SCENE_MISSING', {
            roomId: authorized.galleryId,
          });
        }
      } catch (error) {
        if (sessionIsCurrent(socket, session)) {
          await reportSceneStoreFailure(socket, error);
        }
      }
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

    socket.on('disconnecting', () => {
      joinSequence += 1;
      socket.data.membershipClosed = true;
      socket.data.sessionGeneration += 1;
      void enqueueMembershipTransition(socket, () => (
        leaveCurrentRoomUnlocked(socket, { leaveAdapter: false })
      ));
    });

    socket.on('disconnect', () => {
      if (socket.data.connectionSlotReserved) {
        const ip = socket.data.connectionIp;
        const remaining = (connectionsByIp.get(ip) || 1) - 1;
        if (remaining > 0) connectionsByIp.set(ip, remaining);
        else connectionsByIp.delete(ip);
        activeConnectionCount = Math.max(0, activeConnectionCount - 1);
        socket.data.connectionSlotReserved = false;
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
    if (!closing) httpServer.listen(currentPort, host);
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

  function cleanupResources() {
    cleanupPromise ||= (async () => {
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

      const results = await Promise.allSettled([
        sceneStore.close(),
        collaboration?.close?.(),
      ]);
      const failures = results
        .filter((result) => result.status === 'rejected')
        .map((result) => result.reason);
      if (failures.length > 0) {
        throw new AggregateError(failures, 'multiplayer collaboration cleanup failed');
      }
    })();
    return cleanupPromise;
  }

  void (async () => {
    try {
      if (collaboration) {
        await collaboration.attach(io);
        await collaboration.checkReadiness();
      }
      await sceneStore.checkReadiness();
      if (closing) throw new Error('multiplayer server closed during startup');
      listen();
    } catch (error) {
      closing = true;
      await cleanupResources().catch(() => {});
      if (!readySettled) {
        readySettled = true;
        rejectReady(error);
      }
    }
  })();

  return {
    io,
    httpServer,
    ready,
    port: () => httpServer.address()?.port,
    revokeUserSessions: async (userId) => {
      // fetchSockets also reaches other instances through the Redis adapter.
      const sockets = await io.fetchSockets();
      for (const socket of sockets) {
        if (socket.data.auth?.sub !== userId) continue;
        socket.emit('room:error', { code: 'AUTH_REQUIRED', message: 'Please sign in again.' });
        socket.disconnect(true);
      }
    },
    checkReadiness: async () => {
      await sceneStore.checkReadiness();
      if (collaboration) await collaboration.checkReadiness();
    },
    close: () => {
      if (closePromise) return closePromise;
      closing = true;
      if (!readySettled) {
        readySettled = true;
        rejectReady(new Error('multiplayer server closed before becoming ready'));
      }
      closePromise = cleanupResources();
      return closePromise;
    },
  };
}
