import { describeExhibitionWalls, inspectExhibitionDividers } from './exhibitionSpatialTools.js';
import { editorWallSurfaces } from './editorSceneCommands.js';
import { exhibitItemSchema, roomSizeSchema } from '../schemas/sceneSchema.js';

const MAX_CONTEXT_ITEMS = 100;
const GENERATED_ID_PATTERN = /^(ai-|label-|light-|section-)/;

function isUnsafeMedia(value) {
  return typeof value === 'string' && (
    /^(data|blob):/i.test(value.trim())
    || value.length > 500
    || /base64/i.test(value)
  );
}

function compactString(value, maxLength) {
  if (typeof value !== 'string') return undefined;
  const compact = value.trim();
  if (!compact) return undefined;
  return compact.slice(0, maxLength);
}

function buildMedia(item) {
  const candidates = [item.assetUrl, item.thumbnailUrl];
  if (candidates.some(isUnsafeMedia) || isUnsafeMedia(item.content)) {
    return 'embedded-content-omitted';
  }

  const media = {};
  const assetId = compactString(item.assetId, 200);
  const assetUrl = compactString(item.assetUrl, 500);
  const thumbnailUrl = compactString(item.thumbnailUrl, 500);
  if (assetId) media.assetId = assetId;
  if (assetUrl) media.assetUrl = assetUrl;
  if (thumbnailUrl) media.thumbnailUrl = thumbnailUrl;
  return Object.keys(media).length > 0 ? media : undefined;
}

function contextItem(item) {
  const result = {
    id: String(item.id),
    type: String(item.type),
    position: item.position,
    rotation: item.rotation,
    scale: item.scale,
    frameWidth: item.frameWidth,
    frameHeight: item.frameHeight,
    isLocked: item.isLocked,
  };
  const title = compactString(item.title, 300);
  const artist = compactString(item.artist, 300);
  const description = compactString(item.description, 1_000);
  const media = buildMedia(item);
  if (title) result.title = title;
  if (artist) result.artist = artist;
  if (description) result.description = description;
  if (media) result.media = media;
  return result;
}

export function buildSceneContext(currentScene, complete = false) {
  const items = Array.isArray(currentScene?.items) ? currentScene.items : [];
  const limit = complete ? 500 : MAX_CONTEXT_ITEMS;
  const includedItems = items.slice(0, limit);
  const countsByType = {};
  for (const item of items) {
    const type = String(item?.type || 'unknown');
    countsByType[type] = (countsByType[type] || 0) + 1;
  }

  const ids = includedItems.map((item) => String(item.id));
  const generatedItemIds = ids.filter((id) => GENERATED_ID_PATTERN.test(id));
  const generatedSet = new Set(generatedItemIds);

  return {
    room: {
      ...(complete ? Object.fromEntries(Object.entries(currentScene?.roomSize || {}).filter(([key]) => key in roomSizeSchema.shape)) : {}),
      width: currentScene?.roomSize?.width,
      length: currentScene?.roomSize?.length,
      height: currentScene?.roomSize?.height,
      wallColor: currentScene?.roomSize?.wallColor,
      wallMaterialPreset: currentScene?.roomSize?.wallMaterialPreset,
      floorColor: currentScene?.roomSize?.floorColor,
    },
    items: includedItems.map((item) => complete ? {
      ...Object.fromEntries(Object.entries(item).filter(([key]) => key in exhibitItemSchema.shape && !['content', 'assetId', 'assetUrl', 'thumbnailUrl', 'videoThumbnailUrl'].includes(key))),
      ...contextItem(item),
      ...(['text', 'partition', 'lightstrip', 'neon'].includes(item.type) ? { content: compactString(item.content, 2000) } : {}),
    } : contextItem(item)),
    countsByType,
    protectedItemIds: ids.filter((id) => !generatedSet.has(id)),
    generatedItemIds,
    wallLayout: currentScene?.roomSize ? describeExhibitionWalls({ ...currentScene, items: includedItems }) : [],
    spatialIssues: currentScene?.roomSize ? inspectExhibitionDividers({ ...currentScene, items: includedItems }) : [],
    floorPlanElements: (currentScene?.floorPlanElements || []).slice(0, limit),
    ...(complete ? { wallMaterialOverrides: currentScene?.wallMaterialOverrides || {}, wallSurfaces: editorWallSurfaces(currentScene) } : {}),
    truncated: items.length > limit,
  };
}
