import { sanitizeSceneSnapshot } from '../schemas/sceneSchema.js';

// Match sceneScale.ts, the current Painting renderer, and the wall inset contract.
// These are local frame dimensions, with item.scale left at [1, 1, 1].
const ARTWORK_CENTER_HEIGHT = 1.55;
const FRAME_BACK_DEPTH = 0.1;
const WALL_MOUNT_GAP = 0.002;
const LEGACY_WALL_OFFSET = 0.35;
export const AUTOMATIC_EXHIBITION_LAYOUT_VERSION = 2;
const CORNER_CLEARANCE = 1.2;
const ARTWORK_GAP = 0.5;
const ENTRANCE_HALF_WIDTH = 1.2;
const EPSILON = 1e-8;
const ROOM_CANDIDATES = [
  [8, 8], [10, 10], [12, 12], [16, 12], [16, 16], [20, 16], [20, 20],
  [24, 20], [24, 24], [28, 24], [32, 28], [36, 32], [40, 40], [40, 60],
];
const DEFAULT_TITLES = { 'zh-TW': '我的作品展', 'zh-CN': '我的作品展', en: 'My Art Exhibition' };
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ASSET_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

function layoutError(code, message) {
  return Object.assign(new Error(`${code}: ${message}`), { code, status: 422 });
}

/** Reject duplicates and substitutions even when the total number is unchanged. */
export function assertAssetCoverage(expectedIds, placedIds) {
  const expected = new Set(expectedIds);
  const placed = new Set(placedIds);
  if (expected.size !== expectedIds.length || placed.size !== placedIds.length
    || expected.size !== placed.size || [...expected].some((id) => !placed.has(id))) {
    throw layoutError('ASSET_COVERAGE_MISMATCH', 'Every uploaded asset must be placed exactly once.');
  }
}

function validateInput(input) {
  if (!input || typeof input.language !== 'string' || !Object.hasOwn(DEFAULT_TITLES, input.language) || !['white-box', 'warm-gallery', 'dark-gallery'].includes(input.style)
    || !Array.isArray(input.assets) || (input.title !== undefined && typeof input.title !== 'string')) {
    throw layoutError('INVALID_EXHIBITION_INPUT', 'A supported language, white-box style and asset list are required.');
  }
  if (input.assets.length === 0) throw layoutError('EMPTY_EXHIBITION', 'At least one artwork is required.');
  if (input.assets.length > 30) throw layoutError('TOO_MANY_ASSETS', 'At most 30 artworks are supported.');
  for (const asset of input.assets) {
    if (!asset || typeof asset.assetId !== 'string' || !ASSET_ID.test(asset.assetId)
      || !Number.isSafeInteger(asset.order) || asset.order < 0
      || typeof asset.fileName !== 'string' || !asset.fileName.trim()
      || !IMAGE_MIME_TYPES.has(asset.mimeType)
      || ['title', 'artist', 'description'].some((key) => asset[key] !== undefined && typeof asset[key] !== 'string')) {
      throw layoutError('INVALID_EXHIBITION_INPUT', 'Each artwork needs a valid asset ID, order, image type and filename.');
    }
    if (![asset.width, asset.height].every((value) => Number.isSafeInteger(value) && value > 0)) {
      throw layoutError('ASSET_DIMENSIONS_UNAVAILABLE', `Missing or invalid image dimensions for ${asset.assetId}.`);
    }
  }
  const ids = input.assets.map((asset) => asset.assetId);
  assertAssetCoverage(ids, ids);
  // Stable sort preserves selection order when two assets have the same order.
  return [...input.assets].sort((a, b) => a.order - b.order);
}

export function createPainting(asset) {
  const imageAspectRatio = asset.width / asset.height;
  const frameWidth = Math.max(0.8, Math.min(2.4, 1.8 * imageAspectRatio));
  const frameHeight = Math.max(0.6, Math.min(1.8, 2.4 / imageAspectRatio));
  const url = `/api/media/${asset.assetId}`;
  return {
    id: `artwork-${asset.assetId}`,
    type: 'painting',
    assetId: asset.assetId,
    assetUrl: url,
    content: url,
    fileName: asset.fileName,
    fileMimeType: asset.mimeType,
    title: asset.title?.trim() || asset.fileName.replace(/\.[^.]+$/, '') || asset.fileName,
    artist: asset.artist ?? '',
    description: asset.description ?? '',
    position: [0, ARTWORK_CENTER_HEIGHT, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    frameWidth,
    frameHeight,
    imageAspectRatio,
  };
}

function paintingBounds(item) {
  const width = Math.max(0.8, item.frameWidth ?? 2);
  const height = Math.max(0.6, item.frameHeight ?? 1.5);
  const border = Math.max(0.08, Math.min(0.16, Math.min(width, height) * 0.08));
  return {
    // The current caption plaque is 1.7 wide, 0.32 high and 0.35 below the frame.
    width: Math.max(width + 2 * border, 1.7),
    top: (height + 2 * border) / 2,
    bottom: -height / 2 - 0.35 - 0.16,
  };
}

function paintingWallOffset(room) {
  // Room.tsx renders walls at least 0.12m thick; the frame extends 0.1m behind its origin.
  return Math.max(0.12, room.wallThickness) / 2 + FRAME_BACK_DEPTH + WALL_MOUNT_GAP;
}

export function wallSegments(room, wallOffset = paintingWallOffset(room)) {
  const x = room.width / 2 - CORNER_CLEARANCE;
  const z = room.length / 2 - CORNER_CLEARANCE;
  // Walk clockwise from the north wall, splitting the south wall at the entry.
  return [
    { face: 'north', start: -x, end: x, direction: 1, axis: 0, cross: 2, fixed: -room.length / 2 + wallOffset, yaw: 0 },
    { face: 'east', start: -z, end: z, direction: 1, axis: 2, cross: 0, fixed: room.width / 2 - wallOffset, yaw: -Math.PI / 2 },
    { face: 'south', start: ENTRANCE_HALF_WIDTH, end: x, direction: -1, axis: 0, cross: 2, fixed: room.length / 2 - wallOffset, yaw: Math.PI },
    { face: 'south', start: -x, end: -ENTRANCE_HALF_WIDTH, direction: -1, axis: 0, cross: 2, fixed: room.length / 2 - wallOffset, yaw: Math.PI },
    { face: 'west', start: -z, end: z, direction: -1, axis: 2, cross: 0, fixed: -room.width / 2 + wallOffset, yaw: Math.PI / 2 },
  ];
}

function packPaintings(paintings, room) {
  const items = [];
  for (const segment of wallSegments(room)) {
    const startIndex = items.length;
    let used = 0;
    let count = 0;
    while (startIndex + count < paintings.length) {
      const width = paintingBounds(paintings[startIndex + count]).width;
      const next = used + (count ? ARTWORK_GAP : 0) + width;
      if (next > segment.end - segment.start + EPSILON) break;
      used = next;
      count++;
    }
    let cursor = (segment.start + segment.end - segment.direction * used) / 2;
    for (let index = 0; index < count; index++) {
      const item = paintings[startIndex + index];
      const width = paintingBounds(item).width;
      const position = [0, ARTWORK_CENTER_HEIGHT, 0];
      position[segment.axis] = cursor + segment.direction * width / 2;
      position[segment.cross] = segment.fixed;
      items.push({ ...item, position, rotation: [0, segment.yaw, 0] });
      cursor += segment.direction * (width + ARTWORK_GAP);
    }
  }
  return items.length === paintings.length ? items : null;
}

/** Validate a generated candidate without moving, scaling or normalizing it. */
export function assertAutomaticExhibitionLayout(scene, expectedAssetIds, layoutVersion = AUTOMATIC_EXHIBITION_LAYOUT_VERSION) {
  if (![1, AUTOMATIC_EXHIBITION_LAYOUT_VERSION].includes(layoutVersion)) {
    throw layoutError('LAYOUT_NOT_POSSIBLE', 'Unsupported automatic layout version.');
  }
  const paintings = scene.items.filter((item) => item.type === 'painting');
  assertAssetCoverage(expectedAssetIds, paintings.map((item) => item.assetId));
  for (const item of paintings) {
    const url = `/api/media/${item.assetId}`;
    if (item.id !== `artwork-${item.assetId}` || item.content !== url || item.assetUrl !== url) {
      throw layoutError('ASSET_COVERAGE_MISMATCH', `Artwork identity or source changed for ${item.assetId}.`);
    }
  }
  const room = scene.roomSize;
  const parsed = sanitizeSceneSnapshot(scene);
  if (['width', 'length', 'height', 'wallThickness'].some((key) => parsed.roomSize[key] !== room[key])) {
    throw layoutError('LAYOUT_NOT_POSSIBLE', 'Room dimensions exceed the scene schema bounds.');
  }
  const wallOffset = layoutVersion === 1 ? LEGACY_WALL_OFFSET : paintingWallOffset(room);
  const segments = wallSegments(room, wallOffset);
  const placed = [];
  for (const item of paintings) {
    const bounds = paintingBounds(item);
    const [x, y, z] = item.position;
    const segment = segments.find((candidate) => (
      item.rotation[0] === 0 && item.rotation[2] === 0
      && Math.abs(item.rotation[1] - candidate.yaw) < EPSILON
      && Math.abs(item.position[candidate.cross] - candidate.fixed) < EPSILON
      && item.position[candidate.axis] - bounds.width / 2 >= candidate.start - EPSILON
      && item.position[candidate.axis] + bounds.width / 2 <= candidate.end + EPSILON
    ));
    if (!segment || item.scale.some((value) => value !== 1)
      || !Number.isFinite(item.imageAspectRatio) || item.imageAspectRatio <= 0
      || Math.abs(y - ARTWORK_CENTER_HEIGHT) > EPSILON
      || y + bounds.bottom < 0 || y + bounds.top > room.height
      || wallOffset - FRAME_BACK_DEPTH < Math.max(0.12, room.wallThickness) / 2) {
      throw layoutError('LAYOUT_NOT_POSSIBLE', `Artwork ${item.id} does not fit its wall segment.`);
    }
    // Conservatively include the frame back (-0.1) and caption/text front (+0.05).
    const box = segment.axis === 0
      ? { minX: x - bounds.width / 2, maxX: x + bounds.width / 2, minZ: z - 0.1, maxZ: z + 0.1 }
      : { minX: x - 0.1, maxX: x + 0.1, minZ: z - bounds.width / 2, maxZ: z + bounds.width / 2 };
    for (const other of placed) {
      const dx = Math.max(0, box.minX - other.maxX, other.minX - box.maxX);
      const dz = Math.max(0, box.minZ - other.maxZ, other.minZ - box.maxZ);
      if (Math.hypot(dx, dz) < ARTWORK_GAP - EPSILON) {
        throw layoutError('LAYOUT_NOT_POSSIBLE', `Artwork ${item.id} overlaps another artwork's clearance.`);
      }
    }
    placed.push(box);
  }
}

/** Pure, deterministic layout for trusted, dimensioned media records (no I/O or AI). */
export function buildAutomaticExhibition(input) {
  const assets = validateInput(input);
  const paintings = assets.map(createPainting);
  const includedAssetIds = assets.map((asset) => asset.assetId);
  for (const [width, length] of ROOM_CANDIDATES) {
    const roomSize = {
      width, length, height: 6, wallThickness: 0.1,
      wallColor: input.style === 'warm-gallery' ? '#e9dccb' : input.style === 'dark-gallery' ? '#253039' : '#f8fafc', wallOpacity: 1, wallMetalness: 0, wallRoughness: 0.8,
      floorColor: input.style === 'warm-gallery' ? '#b99a76' : input.style === 'dark-gallery' ? '#39434a' : '#e7e5e4', floorMetalness: 0, floorRoughness: 0.8,
      environmentBrightness: 1,
    };
    const items = packPaintings(paintings, roomSize);
    if (!items) continue;
    // Schema defaults only: the legacy geometry normalizer resets the eye height.
    const scene = sanitizeSceneSnapshot({
      roomSize,
      items,
      floorPlanElements: [{
        id: 'automatic-room', type: 'room', position: [0, 0.02, 0], rotation: [0, 0, 0],
        scale: [width, 0.04, length], color: roomSize.floorColor, isLocked: true, doorOffset: 0, doorWidth: 1.2,
      }],
      wallMaterialOverrides: {},
    });
    assertAutomaticExhibitionLayout(scene, includedAssetIds);
    return {
      scene,
      title: input.title?.trim() || DEFAULT_TITLES[input.language],
      layoutVersion: AUTOMATIC_EXHIBITION_LAYOUT_VERSION,
      includedAssetIds,
      uploadedCount: assets.length,
      placedCount: scene.items.length,
      warnings: [],
    };
  }
  throw layoutError('LAYOUT_NOT_POSSIBLE', 'The artworks cannot fit within supported room sizes.');
}
