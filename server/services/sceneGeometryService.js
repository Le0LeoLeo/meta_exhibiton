import { sanitizeSceneSnapshot } from '../schemas/sceneSchema.js';

const WALL_OFFSET = 0.35;
const FLOOR_CLEARANCE = 1.2;
const MIN_FLOOR_ITEM_DISTANCE = 1.2;

const FLOOR_ITEM_Y = {
  pedestal: 0,
  sculpture: 0,
  flower: 0,
  chandelier: null,
  bench: 0,
  rug: 0.01,
  vase: 0,
  spotlight: 0.2,
  plant: 0,
  column: 0,
  neon: 1.4,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value) {
  return Number(value.toFixed(4));
}

export function normalizeRoomSize(roomSize) {
  return sanitizeSceneSnapshot({
    roomSize,
    items: [],
    floorPlanElements: [],
    wallMaterialOverrides: {},
  }).roomSize;
}

function nearestWallFace(position, roomSize) {
  const [x, , z] = position;
  const halfWidth = roomSize.width / 2;
  const halfLength = roomSize.length / 2;

  if (x > halfWidth) return 'east';
  if (x < -halfWidth) return 'west';
  if (z > halfLength) return 'south';
  if (z < -halfLength) return 'north';

  const distances = [
    { face: 'east', value: Math.abs(halfWidth - x) },
    { face: 'west', value: Math.abs(-halfWidth - x) },
    { face: 'south', value: Math.abs(halfLength - z) },
    { face: 'north', value: Math.abs(-halfLength - z) },
  ];
  return distances.sort((a, b) => a.value - b.value)[0].face;
}

export function normalizePaintingPlacement(item, roomSize) {
  const face = nearestWallFace(item.position, roomSize);
  const halfWidth = roomSize.width / 2;
  const halfLength = roomSize.length / 2;
  const minX = -halfWidth + FLOOR_CLEARANCE;
  const maxX = halfWidth - FLOOR_CLEARANCE;
  const minZ = -halfLength + FLOOR_CLEARANCE;
  const maxZ = halfLength - FLOOR_CLEARANCE;
  const y = clamp(2.5, 2.2, Math.min(3, roomSize.height - 1));

  if (face === 'east') {
    return {
      ...item,
      position: [round(halfWidth - WALL_OFFSET), round(y), round(clamp(item.position[2], minZ, maxZ))],
      rotation: [0, -Math.PI / 2, 0],
    };
  }

  if (face === 'west') {
    return {
      ...item,
      position: [round(-halfWidth + WALL_OFFSET), round(y), round(clamp(item.position[2], minZ, maxZ))],
      rotation: [0, Math.PI / 2, 0],
    };
  }

  if (face === 'south') {
    return {
      ...item,
      position: [round(clamp(item.position[0], minX, maxX)), round(y), round(halfLength - WALL_OFFSET)],
      rotation: [0, Math.PI, 0],
    };
  }

  return {
    ...item,
    position: [round(clamp(item.position[0], minX, maxX)), round(y), round(-halfLength + WALL_OFFSET)],
    rotation: [0, 0, 0],
  };
}

export function normalizeFloorObjectPlacement(item, roomSize) {
  const halfWidth = roomSize.width / 2;
  const halfLength = roomSize.length / 2;
  const y = item.type === 'chandelier'
    ? Math.max(2.6, roomSize.height - 0.8)
    : FLOOR_ITEM_Y[item.type] ?? item.position[1] ?? 1;

  return {
    ...item,
    position: [
      round(clamp(item.position[0], -halfWidth + FLOOR_CLEARANCE, halfWidth - FLOOR_CLEARANCE)),
      round(clamp(y, 0, roomSize.height - 0.4)),
      round(clamp(item.position[2], -halfLength + FLOOR_CLEARANCE, halfLength - FLOOR_CLEARANCE)),
    ],
  };
}

function normalizeLightstrip(item, roomSize) {
  if (isWallMounted(item, roomSize)) {
    return {
      ...snapWallMountedItem(item, roomSize, {
        minY: 2.4,
        maxY: roomSize.height - 0.5,
        offset: 0.45,
      }),
      lightIntensity: clamp(item.lightIntensity ?? 0.5, 0.1, 1.2),
    };
  }

  return {
    ...item,
    position: [
      round(clamp(item.position[0], -roomSize.width / 2 + FLOOR_CLEARANCE, roomSize.width / 2 - FLOOR_CLEARANCE)),
      round(clamp(item.position[1], 2.4, roomSize.height - 0.5)),
      round(clamp(item.position[2], -roomSize.length / 2 + FLOOR_CLEARANCE, roomSize.length / 2 - FLOOR_CLEARANCE)),
    ],
    lightIntensity: clamp(item.lightIntensity ?? 0.5, 0.1, 1.2),
  };
}

function wallFaceFromRotation(item) {
  const rotationY = Array.isArray(item.rotation) ? item.rotation[1] || 0 : 0;
  const normalized = Math.atan2(Math.sin(rotationY), Math.cos(rotationY));
  if (Math.abs(normalized + Math.PI / 2) < 0.2) return 'east';
  if (Math.abs(normalized - Math.PI / 2) < 0.2) return 'west';
  if (Math.abs(Math.abs(normalized) - Math.PI) < 0.2) return 'south';
  if (Math.abs(normalized) < 0.2) return 'north';
  return null;
}

function isWallMounted(item, roomSize) {
  const [x = 0, , z = 0] = Array.isArray(item.position) ? item.position : [];
  const halfWidth = roomSize.width / 2;
  const halfLength = roomSize.length / 2;
  const nearWall = (
    Math.abs(Math.abs(x) - halfWidth) < FLOOR_CLEARANCE ||
    Math.abs(Math.abs(z) - halfLength) < FLOOR_CLEARANCE
  );
  const generatedWallItem = /^(ai-title|ai-curatorial-statement|section-\d+-(title|intro)|label-\d+|light-\d+)/.test(String(item.id || ''));
  return (
    nearWall ||
    (generatedWallItem && wallFaceFromRotation(item) !== null)
  );
}

function snapWallMountedItem(item, roomSize, { minY, maxY, offset }) {
  const preferredFace = wallFaceFromRotation(item);
  const face = preferredFace || nearestWallFace(item.position, roomSize);
  const halfWidth = roomSize.width / 2;
  const halfLength = roomSize.length / 2;
  const minX = -halfWidth + FLOOR_CLEARANCE;
  const maxX = halfWidth - FLOOR_CLEARANCE;
  const minZ = -halfLength + FLOOR_CLEARANCE;
  const maxZ = halfLength - FLOOR_CLEARANCE;
  const [x = 0, y = 2.5, z = 0] = Array.isArray(item.position) ? item.position : [];
  const nextY = round(clamp(y, minY, maxY));

  if (face === 'east') {
    return {
      ...item,
      position: [round(halfWidth - offset), nextY, round(clamp(z, minZ, maxZ))],
      rotation: [0, -Math.PI / 2, 0],
    };
  }
  if (face === 'west') {
    return {
      ...item,
      position: [round(-halfWidth + offset), nextY, round(clamp(z, minZ, maxZ))],
      rotation: [0, Math.PI / 2, 0],
    };
  }
  if (face === 'south') {
    return {
      ...item,
      position: [round(clamp(x, minX, maxX)), nextY, round(halfLength - offset)],
      rotation: [0, Math.PI, 0],
    };
  }
  return {
    ...item,
    position: [round(clamp(x, minX, maxX)), nextY, round(-halfLength + offset)],
    rotation: [0, 0, 0],
  };
}

function distance2d(a, b) {
  const dx = a.position[0] - b.position[0];
  const dz = a.position[2] - b.position[2];
  return Math.sqrt(dx * dx + dz * dz);
}

export function resolveItemCollisions(items, roomSize) {
  const warnings = [];
  const resolved = items.map((item, index, currentItems) => {
    const isFloorItem = item.type !== 'painting' && item.type !== 'text' && item.type !== 'lightstrip' && item.type !== 'partition';
    if (!isFloorItem) return item;

    let next = item;
    for (let previousIndex = 0; previousIndex < index; previousIndex++) {
      const previous = currentItems[previousIndex];
      const previousIsFloorItem = previous.type !== 'painting' && previous.type !== 'text' && previous.type !== 'lightstrip' && previous.type !== 'partition';
      if (!previousIsFloorItem) continue;

      if (distance2d(next, previous) < MIN_FLOOR_ITEM_DISTANCE) {
        next = normalizeFloorObjectPlacement({
          ...next,
          position: [
            next.position[0] + 1.6 + previousIndex * 0.3,
            next.position[1],
            next.position[2] + 1.6 + previousIndex * 0.3,
          ],
        }, roomSize);
        warnings.push(`Spread overlapping floor item ${next.id}.`);
      }
    }
    currentItems[index] = next;
    return next;
  });

  return { items: resolved, warnings };
}

function normalizeItem(item, roomSize, warnings) {
  if (item.type === 'painting') {
    const normalized = normalizePaintingPlacement(item, roomSize);
    if (JSON.stringify(normalized.position) !== JSON.stringify(item.position) || JSON.stringify(normalized.rotation) !== JSON.stringify(item.rotation)) {
      warnings.push(`Adjusted ${item.id} painting placement to the nearest wall.`);
    }
    return normalized;
  }

  if (item.type === 'lightstrip') {
    return normalizeLightstrip(item, roomSize);
  }

  if (item.type === 'partition') {
    return {
      ...item,
      position: [round(item.position[0]), round(roomSize.height / 2), round(item.position[2])],
      scale: [Math.abs(item.scale[0] || 1), roomSize.height, Math.abs(item.scale[2] || 0.2)],
    };
  }

  if (item.type === 'text') {
    if (isWallMounted(item, roomSize)) {
      return snapWallMountedItem(item, roomSize, {
        minY: 1.2,
        maxY: roomSize.height - 0.5,
        offset: WALL_OFFSET,
      });
    }

    return {
      ...item,
      position: [
        round(clamp(item.position[0], -roomSize.width / 2 + 0.8, roomSize.width / 2 - 0.8)),
        round(clamp(item.position[1], 1.2, roomSize.height - 0.5)),
        round(clamp(item.position[2], -roomSize.length / 2 + 0.8, roomSize.length / 2 - 0.8)),
      ],
    };
  }

  return normalizeFloorObjectPlacement(item, roomSize);
}

function syncPrimaryRoomFloorPlan(scene) {
  if (!scene.floorPlanElements.length) return scene;
  const firstRoomIndex = scene.floorPlanElements.findIndex((element) => element.type === 'room');
  if (firstRoomIndex < 0) return scene;

  const floorPlanElements = [...scene.floorPlanElements];
  floorPlanElements[firstRoomIndex] = {
    ...floorPlanElements[firstRoomIndex],
    scale: [scene.roomSize.width, 0.04, scene.roomSize.length],
    isLocked: true,
  };

  return { ...scene, floorPlanElements };
}

export function normalizeSceneGeometry(inputScene) {
  const scene = sanitizeSceneSnapshot(inputScene);
  const warnings = [];
  const roomSize = normalizeRoomSize(scene.roomSize);
  const normalizedItems = scene.items.map((item) => normalizeItem(item, roomSize, warnings));
  const collisionResult = resolveItemCollisions(normalizedItems, roomSize);

  return {
    scene: syncPrimaryRoomFloorPlan({
      ...scene,
      roomSize,
      items: collisionResult.items,
    }),
    warnings: [...warnings, ...collisionResult.warnings],
  };
}
