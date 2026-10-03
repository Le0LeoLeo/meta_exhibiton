import type { UploadedMediaAsset } from '@/app/api/media';
import type { SceneSnapshot } from '@/app/modules/metaverse3d/store/metaverseStoreTypes';
import type { ExhibitItem } from '@/app/modules/metaverse3d/types';
import { buildWallTopology, getFloorPlanCenter, getFloorPlanRoomBounds } from '@/app/modules/metaverse3d/store/floorPlanGeometry';

const vector = (value: unknown): value is [number, number, number] => Array.isArray(value)
  && value.length === 3 && value.every((entry) => typeof entry === 'number' && Number.isFinite(entry));
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** Validate the editable structure without normalizing away custom scene properties. */
export function parseEditableScene(sceneJson: string | null): SceneSnapshot {
  let value: unknown;
  try { value = JSON.parse(sceneJson || 'null'); } catch { throw new Error('INVALID_SCENE'); }
  if (!record(value) || !record(value.roomSize)) throw new Error('INVALID_SCENE');
  const room = value.roomSize;
  if (!Array.isArray(value.items)
    || !Array.isArray(value.floorPlanElements) || !record(value.wallMaterialOverrides)
    || !['width', 'length', 'height', 'wallThickness'].every((key) => typeof room[key] === 'number'
      && Number.isFinite(room[key]) && (room[key] as number) > 0)
    || !value.items.every((item) => record(item) && typeof item.id === 'string' && item.id.length > 0
      && typeof item.type === 'string' && typeof item.content === 'string'
      && vector(item.position) && vector(item.rotation) && vector(item.scale))
    || new Set(value.items.map((item) => item.id)).size !== value.items.length
    || !value.floorPlanElements.every((element) => record(element) && typeof element.id === 'string'
      && typeof element.type === 'string' && vector(element.position) && vector(element.scale))) {
    throw new Error('INVALID_SCENE');
  }
  return value as unknown as SceneSnapshot;
}

function mediaFields(media: UploadedMediaAsset) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(media.mimeType)
    || !media.width || !media.height || !Number.isFinite(media.width) || !Number.isFinite(media.height)
    || media.width <= 0 || media.height <= 0 || !media.id) throw new Error('INVALID_ARTWORK_IMAGE');
  const url = `/api/media/${encodeURIComponent(media.id)}`;
  return { assetId: media.id, content: url, assetUrl: url, thumbnailUrl: url,
    fileName: media.originalFileName, fileMimeType: media.mimeType,
    imageAspectRatio: media.width / media.height, uploadStatus: 'done' as const, uploadProgress: 100 };
}

export function replacePainting(scene: SceneSnapshot, itemId: string, media: UploadedMediaAsset): SceneSnapshot {
  const item = scene.items.find((entry) => entry.id === itemId && entry.type === 'painting');
  if (!item) throw new Error('ARTWORK_NOT_FOUND');
  const fields = mediaFields(media);
  return { ...scene, items: scene.items.map((entry) => entry.id === itemId ? { ...entry, ...fields } : entry) };
}

/** Add to a free solid back-wall segment; never rearrange the saved exhibition. */
export function addPainting(scene: SceneSnapshot, media: UploadedMediaAsset, id: string): SceneSnapshot {
  if (!id || scene.items.some((item) => item.id === id)) throw new Error('DUPLICATE_ARTWORK_ID');
  const fields = mediaFields(media);
  const height = Math.min(1.8, 3.6 / fields.imageAspectRatio);
  const width = height * fields.imageAspectRatio;
  const halfWidth = width / 2 + 0.1;
  const halfHeight = height / 2 + 0.1;
  const y = Math.min(2, scene.roomSize.height - halfHeight - 0.25);
  if (y - halfHeight < 0.25) throw new Error('NO_ARTWORK_SPACE');
  const rooms = getFloorPlanRoomBounds(scene.floorPlanElements, scene.roomSize.width, scene.roomSize.length);
  const thickness = Math.max(0.12, scene.roomSize.wallThickness);
  const topology = buildWallTopology(rooms, scene.roomSize.height, thickness, getFloorPlanCenter(rooms));
  for (const wall of topology.segments.filter((segment) => segment.face === 'north')) {
    const z = wall.position[2] + thickness / 2 + 0.08;
    const left = wall.position[0] - wall.size[0] / 2 + halfWidth + 0.25;
    const right = wall.position[0] + wall.size[0] / 2 - halfWidth - 0.25;
    for (let x = left; x <= right + 0.0001; x += 0.25) {
      const overlaps = scene.items.some((item) => {
        const yaw = item.rotation[1];
        const itemWidth = (item.type === 'painting' ? (item.frameWidth ?? 2) + 0.3 : 2) * Math.abs(item.scale[0]);
        const itemDepth = (item.type === 'painting' ? 0.3 : 2) * Math.abs(item.scale[2]);
        const extentX = (Math.abs(Math.cos(yaw)) * itemWidth + Math.abs(Math.sin(yaw)) * itemDepth) / 2;
        const extentZ = (Math.abs(Math.sin(yaw)) * itemWidth + Math.abs(Math.cos(yaw)) * itemDepth) / 2;
        const extentY = (item.type === 'painting' ? (item.frameHeight ?? 1.4) + 0.3 : 2) * Math.abs(item.scale[1]) / 2;
        return Math.abs(item.position[0] - x) < halfWidth + extentX + 0.2
          && Math.abs(item.position[2] - z) < extentZ + 0.2
          && Math.abs(item.position[1] - y) < halfHeight + extentY + 0.2;
      });
      if (!overlaps) {
        const painting: ExhibitItem = { id, type: 'painting', position: [x, y, z], rotation: [0, 0, 0],
          scale: [1, 1, 1], frameWidth: width, frameHeight: height, frameStyle: 'modern',
          frameThickness: 0.09, frameDepth: 0.08, title: media.originalFileName.replace(/\.[^.]+$/, ''),
          artist: '', description: '', ...fields };
        return { ...scene, items: [...scene.items, painting] };
      }
    }
  }
  throw new Error('NO_ARTWORK_SPACE');
}
