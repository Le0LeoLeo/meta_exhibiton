const roomPlayers = new Map();
const roomScenes = new Map();

const NICKNAME_MIN = 2;
const NICKNAME_MAX = 20;

function copyObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...value }
    : {};
}

export function normalizeNickname(input) {
  const trimmed = typeof input === 'string' ? input.trim() : '';
  if (!trimmed) return 'Guest';
  const clipped = trimmed.slice(0, NICKNAME_MAX);
  return clipped.length >= NICKNAME_MIN ? clipped : 'Guest';
}

export function addPlayer(roomId, player) {
  let players = roomPlayers.get(roomId);
  if (!players) {
    players = new Map();
    roomPlayers.set(roomId, players);
  }
  players.set(player.id, player);
  return { roomId, players: Array.from(players.values()) };
}

export function getPlayers(roomId) {
  return Array.from(roomPlayers.get(roomId)?.values() || []);
}

export function updatePlayerMove(socketId, payload) {
  const players = roomPlayers.get(payload.roomId);
  const current = players?.get(socketId);
  if (!current || payload.seq <= current.lastSeq) return null;

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

export function removePlayer(socketId, roomId) {
  if (roomId) {
    const players = roomPlayers.get(roomId);
    if (!players) return { roomId, removed: false };
    const removed = players.delete(socketId);
    if (players.size === 0) {
      roomPlayers.delete(roomId);
      roomScenes.delete(roomId);
    }
    return { roomId, removed };
  }

  for (const [candidateRoomId, players] of roomPlayers.entries()) {
    if (!players.delete(socketId)) continue;
    if (players.size === 0) {
      roomPlayers.delete(candidateRoomId);
      roomScenes.delete(candidateRoomId);
    }
    return { roomId: candidateRoomId, removed: true };
  }

  return null;
}

export function getRoomScene(roomId) {
  return roomScenes.get(roomId) || null;
}

export function setRoomScene(roomId, scene) {
  if (!scene || typeof scene !== 'object') return null;
  const snapshot = {
    roomSize: scene.roomSize,
    items: Array.isArray(scene.items) ? [...scene.items] : [],
    floorPlanElements: Array.isArray(scene.floorPlanElements)
      ? [...scene.floorPlanElements]
      : [],
    wallMaterialOverrides: copyObject(scene.wallMaterialOverrides),
    updatedAt: Date.now(),
  };
  roomScenes.set(roomId, snapshot);
  return snapshot;
}

export function applyRoomSceneOp(roomId, op, validateSnapshot = () => true) {
  if (!op || typeof op !== 'object') return null;
  if (typeof validateSnapshot !== 'function') return null;

  const current = roomScenes.get(roomId) || {
    roomSize: null,
    items: [],
    floorPlanElements: [],
    wallMaterialOverrides: {},
    updatedAt: Date.now(),
  };

  const next = {
    roomSize: current.roomSize,
    items: Array.isArray(current.items) ? [...current.items] : [],
    floorPlanElements: Array.isArray(current.floorPlanElements)
      ? [...current.floorPlanElements]
      : [],
    wallMaterialOverrides: copyObject(current.wallMaterialOverrides),
    updatedAt: Date.now(),
  };

  if (op.kind === 'set-room') {
    next.roomSize = op.roomSize;
  } else if (op.kind === 'set-floor-plan') {
    next.floorPlanElements = [...op.floorPlanElements];
  } else if (op.kind === 'set-wall-material-overrides') {
    next.wallMaterialOverrides = copyObject(op.wallMaterialOverrides);
  } else if (op.kind === 'add-item') {
    next.items.push(op.item);
  } else if (op.kind === 'update-item') {
    next.items = next.items.map((item) => (
      item?.id === op.id ? { ...item, ...op.updates } : item
    ));
  } else if (op.kind === 'remove-item') {
    next.items = next.items.filter((item) => item?.id !== op.id);
  } else {
    return null;
  }

  if (!validateSnapshot(next)) return null;
  roomScenes.set(roomId, next);
  return next;
}

export function clearRooms() {
  roomPlayers.clear();
  roomScenes.clear();
}
