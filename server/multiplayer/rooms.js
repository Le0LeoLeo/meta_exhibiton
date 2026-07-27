import { applySceneOperation } from './sceneState.js';

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
  if (typeof validateSnapshot !== 'function') return null;

  const current = roomScenes.get(roomId) || {
    roomSize: null,
    items: [],
    floorPlanElements: [],
    wallMaterialOverrides: {},
    updatedAt: Date.now(),
  };
  const next = applySceneOperation(current, op);

  if (!next || !validateSnapshot(next)) return null;
  roomScenes.set(roomId, next);
  return next;
}

export function clearRooms() {
  roomScenes.clear();
}
