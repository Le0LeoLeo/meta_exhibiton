const roomPlayers = new Map();
const roomScenes = new Map();

const NICKNAME_MIN = 2;
const NICKNAME_MAX = 20;

export function normalizeNickname(input) {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return "訪客";
  const clipped = trimmed.slice(0, NICKNAME_MAX);
  if (clipped.length < NICKNAME_MIN) return "訪客";
  return clipped;
}

export function ensureRoom(roomIdInput) {
  const roomId = (roomIdInput || "main-gallery").trim() || "main-gallery";
  if (!roomPlayers.has(roomId)) roomPlayers.set(roomId, new Map());
  return roomId;
}

export function addPlayer(roomIdInput, player) {
  const roomId = ensureRoom(roomIdInput);
  const players = roomPlayers.get(roomId);
  players.set(player.id, player);
  return { roomId, players: Array.from(players.values()) };
}

export function getPlayers(roomIdInput) {
  const roomId = ensureRoom(roomIdInput);
  return Array.from(roomPlayers.get(roomId).values());
}

export function updatePlayerMove(socketId, payload) {
  const roomId = ensureRoom(payload.roomId);
  const players = roomPlayers.get(roomId);
  const current = players.get(socketId);
  if (!current) return null;
  if (payload.seq <= current.lastSeq) return null;

  const updated = {
    ...current,
    position: payload.position,
    yaw: payload.yaw,
    lastSeq: payload.seq,
    updatedAt: Date.now(),
  };

  players.set(socketId, updated);
  return updated;
}

export function removePlayer(socketId, roomIdInput) {
  if (roomIdInput) {
    const roomId = ensureRoom(roomIdInput);
    const players = roomPlayers.get(roomId);
    const removed = players.delete(socketId);
    if (players.size === 0) {
      roomPlayers.delete(roomId);
      roomScenes.delete(roomId);
    }
    return { roomId, removed };
  }

  for (const [roomId, players] of roomPlayers.entries()) {
    if (players.delete(socketId)) {
      if (players.size === 0) {
        roomPlayers.delete(roomId);
        roomScenes.delete(roomId);
      }
      return { roomId, removed: true };
    }
  }

  return null;
}

export function getRoomScene(roomIdInput) {
  const roomId = ensureRoom(roomIdInput);
  return roomScenes.get(roomId) || null;
}

export function setRoomScene(roomIdInput, scene) {
  const roomId = ensureRoom(roomIdInput);
  if (!scene || typeof scene !== 'object') return null;
  const snapshot = {
    roomSize: scene.roomSize,
    items: Array.isArray(scene.items) ? scene.items : [],
    floorPlanElements: Array.isArray(scene.floorPlanElements) ? scene.floorPlanElements : [],
    wallMaterialOverrides:
      scene.wallMaterialOverrides && typeof scene.wallMaterialOverrides === 'object'
        ? scene.wallMaterialOverrides
        : {},
    updatedAt: Date.now(),
  };
  roomScenes.set(roomId, snapshot);
  return snapshot;
}

export function applyRoomSceneOp(roomIdInput, op) {
  const roomId = ensureRoom(roomIdInput);
  if (!op || typeof op !== 'object') return null;

  const current =
    roomScenes.get(roomId) || {
      roomSize: null,
      items: [],
      floorPlanElements: [],
      wallMaterialOverrides: {},
      updatedAt: Date.now(),
    };

  const next = {
    roomSize: current.roomSize,
    items: Array.isArray(current.items) ? [...current.items] : [],
    floorPlanElements: Array.isArray(current.floorPlanElements) ? current.floorPlanElements : [],
    wallMaterialOverrides:
      current.wallMaterialOverrides && typeof current.wallMaterialOverrides === 'object'
        ? current.wallMaterialOverrides
        : {},
    updatedAt: Date.now(),
  };

  if (op.kind === 'set-room') {
    next.roomSize = op.roomSize;
  } else if (op.kind === 'add-item' && op.item) {
    next.items.push(op.item);
  } else if (op.kind === 'update-item' && typeof op.id === 'string') {
    next.items = next.items.map((item) => (item?.id === op.id ? { ...item, ...(op.updates || {}) } : item));
  } else if (op.kind === 'remove-item' && typeof op.id === 'string') {
    next.items = next.items.filter((item) => item?.id !== op.id);
  } else {
    return null;
  }

  roomScenes.set(roomId, next);
  return next;
}
