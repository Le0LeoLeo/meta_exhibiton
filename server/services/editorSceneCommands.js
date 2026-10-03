import { z } from 'zod';
import { exhibitItemSchema, floorPlanElementSchema, persistentSceneSchema, roomSizeSchema, wallMaterialSettingsSchema } from '../schemas/sceneSchema.js';
import { transformEditorBatch } from './editorBatchTransforms.js';
import { editorWallSurfaces } from './editorFloorGeometry.js';
import { buildExhibitionZones } from './exhibitionZoneLayout.js';

export { editorWallSurfaces } from './editorFloorGeometry.js';

const vec = z.array(z.number().finite()).length(3);
const id = z.string().min(1).max(200);
const newId = id.regex(/^(ai-|section-|label-|light-)/);
const ids = z.array(id).min(1).max(500);
function patchShape(schema, omitted = []) {
  return z.object(Object.fromEntries(Object.entries(schema.shape).filter(([key]) => !omitted.includes(key)).map(([key, field]) =>
    [key, (field instanceof z.ZodDefault ? field.removeDefault() : field).optional()]))).strict();
}
const itemPatch = patchShape(exhibitItemSchema, ['id', 'type', 'assetId', 'assetUrl', 'thumbnailUrl', 'fileName', 'fileMimeType', 'uploadStatus', 'uploadProgress', 'isLocked']);
const roomPatch = patchShape(roomSizeSchema).extend({ width: z.number().min(6).max(500).optional(), length: z.number().min(6).max(500).optional(), height: z.number().min(3).max(50).optional(), wallThickness: z.number().min(0.05).max(2).optional() });
export const editorCommandSchemas = [
  z.object({ type: z.literal('build-exhibition-zones'), id: newId, zones: z.array(z.object({title:z.string().trim().min(1).max(24),count:z.number().int().min(1).max(30)}).strict()).min(2).max(8),assetKeys:z.array(id).max(200).default([]),decorate:z.boolean().default(true) }).strict(),
  z.object({ type: z.literal('edit-room'), changes: roomPatch }).strict(),
  z.object({ type: z.literal('edit-item'), itemId: id, changes: itemPatch }).strict(),
  z.object({ type: z.literal('add-editor-item'), item: exhibitItemSchema.omit({ assetId: true, assetUrl: true, thumbnailUrl: true }).extend({ id: newId }).strict() }).strict(),
  z.object({ type: z.literal('delete-items'), itemIds: ids }).strict(),
  z.object({ type: z.literal('duplicate-items'), copies: z.array(z.object({ itemId: id, id: newId, offset: vec }).strict()).min(1).max(100) }).strict(),
  z.object({ type: z.literal('batch-transform'), itemIds: ids, mode: z.enum(['align', 'distribute', 'snap']), axis: z.enum(['x', 'y', 'z']).default('x'), anchorId: id.optional(), step: z.number().positive().max(10).default(0.5) }).strict(),
  z.object({ type: z.literal('set-items-locked'), itemIds: ids, locked: z.boolean() }).strict(),
  z.object({ type: z.literal('edit-wall-material'), targetId: id, changes: wallMaterialSettingsSchema.strict() }).strict(),
  z.object({ type: z.literal('add-floor-element'), element: floorPlanElementSchema.extend({ id: newId }).strict() }).strict(),
  z.object({ type: z.literal('edit-floor-element'), elementId: id, changes: patchShape(floorPlanElementSchema, ['id', 'type']) }).strict(),
  z.object({ type: z.literal('remove-floor-element'), elementId: id }).strict(),
  z.object({ type: z.literal('place-asset'), id: newId, assetKey: id, position: vec, rotation: vec.default([0, 0, 0]), scale: vec.default([1, 1, 1]) }).strict(),
  z.object({ type: z.literal('replace-item-asset'), itemId: id, assetKey: id }).strict(),
  z.object({ type: z.literal('mount-on-partition'), itemId: id, partitionId: id, side: z.enum(['front', 'back']).default('front'), offset: z.number().finite().default(0), height: z.number().positive() }).strict(),
];
export const editorCommandTypes = editorCommandSchemas.map((schema) => schema.shape.type.value);
const generated = (itemId) => /^(ai-|section-|label-|light-)/.test(itemId);
const mediaTypes = new Set(['painting', 'pedestal', 'sculpture']);
const fail = (message) => { throw new Error(message); };
export function isEditorAssetUrl(value) {
  if (typeof value !== 'string' || value.length > 2000 || /[\s\\]/.test(value)) return false;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}
function validateUrls(changes) {
  for (const [key, value] of Object.entries(changes)) {
    if (key.endsWith('Url') && value && !isEditorAssetUrl(value)) fail(`Invalid ${key}`);
  }
}
function itemById(scene, itemId, allowLocked = false) {
  const item = scene.items.find((entry) => entry.id === itemId);
  if (!item) fail(`Unknown item: ${itemId}`);
  if (item.isLocked && !allowLocked) fail(`Item is locked: ${itemId}; explicitly unlock it first.`);
  return item;
}
function validateItemFields(item, changes) {
  for (const key of Object.keys(changes)) {
    if ((key.startsWith('frame') || key === 'imageAspectRatio') && item.type !== 'painting') fail('Frame settings apply only to paintings. Use edit-wall-material with wallColor/wallRoughness for partitions.');
    if (key.startsWith('text') && item.type !== 'text') fail('Text appearance settings require a text item.');
    if (key.startsWith('video') && item.type !== 'painting') fail('Video settings require a video painting.');
    if (key === 'modelOffset' && !['pedestal', 'sculpture'].includes(item.type)) fail('Model offsets require a model item.');
  }
}
function requireDestructive(itemId, options) {
  if (!generated(itemId) && !options.allowDestructive) fail('Original removal or media replacement requires permission.');
}
function chosenAsset(options, key) {
  const asset = (options.editorAssets || []).find((entry) => entry.key === key);
  if (!asset || !isEditorAssetUrl(asset.url)) fail(`Unknown or unusable asset: ${key}`);
  return asset;
}
function assetFields(asset) {
  return { content: asset.url, assetUrl: asset.url, assetId: asset.assetId, thumbnailUrl: asset.previewUrl,
    fileMimeType: asset.mimeType, fileName: asset.label, uploadStatus: 'done',
    ...(asset.kind === 'video' ? { videoMuted: true, videoLoop: true, videoAutoplay: false } : {}),
    ...(asset.kind === 'model' ? { modelOffset: [0, 0, 0] } : {}) };
}
function add(scene, item) {
  if (scene.items.some((entry) => entry.id === item.id)) fail(`Duplicate item: ${item.id}`);
  scene.items.push(item);
}
function validateScene(scene) {
  persistentSceneSchema.parse(scene); // Validation only: never default/clamp/strip the editor's snapshot.
  for (const item of [...scene.items, ...(scene.floorPlanElements || [])]) {
    for (const field of ['position', 'rotation', 'scale']) if (!item[field].every(Number.isFinite)) fail(`Invalid ${field}`);
    if (item.scale.some((value) => Math.abs(value) < 0.001 || Math.abs(value) > 1000)) fail(`Invalid scale: ${item.id}`);
  }
}
function syncPartition(scene, item) {
  if (item.type !== 'partition') return;
  const existing = scene.floorPlanElements.find((element) => element.id === item.id);
  const fields = { position: [item.position[0], 0.1, item.position[2]], rotation: [0, item.rotation[1], 0],
    scale: [Math.abs(item.scale[0]), 0.2, Math.abs(item.scale[2])], color: item.content, isLocked: item.isLocked };
  if (existing) Object.assign(existing, fields);
  else scene.floorPlanElements.push({ id: item.id, type: 'wall', ...fields });
}
function validateFloorTransform(element) {
  if (element.rotation[0] !== 0 || element.rotation[2] !== 0 || (element.type === 'room' && element.rotation[1] !== 0)) fail('Floor-plan rooms must be axis-aligned; walls support only horizontal rotation.');
  if (element.type === 'room' && [element.scale[0], element.scale[2]].some((value) => Math.abs(value) < 6 || Math.abs(value) > 500)) fail('Room width and length must be between 6 and 500 metres.');
}
export function applyCompleteEditorPlan(currentScene, operations, options, applyLegacy) {
  let scene = structuredClone(currentScene);
  scene.floorPlanElements ??= [];
  scene.wallMaterialOverrides ??= {};
  validateScene(scene);
  for (const operation of operations) {
    const { type } = operation;
    if (type === 'build-exhibition-zones') {
      for (const key of operation.assetKeys) chosenAsset(options, key);
      buildExhibitionZones(scene, operation, options);
    } else if (type === 'edit-room') {
      validateUrls(operation.changes);
      scene.roomSize ??= roomSizeSchema.parse({ width: 20, length: 20, height: 6, wallThickness: 0.1 });
      Object.assign(scene.roomSize, operation.changes);
      const primary = scene.floorPlanElements.find((el) => el.type === 'room' && el.isLocked) || scene.floorPlanElements.find((el) => el.type === 'room');
      if (primary && ('width' in operation.changes || 'length' in operation.changes)) primary.scale = [scene.roomSize.width, primary.scale[1], scene.roomSize.length];
    } else if (type === 'edit-item') {
      const item = itemById(scene, operation.itemId);
      validateItemFields(item, operation.changes);
      validateUrls(operation.changes);
      if ('content' in operation.changes && mediaTypes.has(item.type)) fail('Use a selected asset to replace artwork/model media.');
      Object.assign(item, operation.changes);
      syncPartition(scene, item);
    } else if (type === 'add-editor-item') {
      if (mediaTypes.has(operation.item.type) && operation.item.content && !/^#[0-9a-f]{3,8}$/i.test(operation.item.content)) fail('Use place-asset for image/video/model content.');
      validateUrls(operation.item);
      validateItemFields(operation.item, operation.item);
      add(scene, structuredClone(operation.item));
      syncPartition(scene, operation.item);
    } else if (type === 'delete-items') {
      for (const itemId of operation.itemIds) { itemById(scene, itemId); requireDestructive(itemId, options); }
      scene.items = scene.items.filter((item) => !operation.itemIds.includes(item.id));
      scene.floorPlanElements = scene.floorPlanElements.filter((element) => element.type !== 'wall' || !operation.itemIds.includes(element.id));
      for (const itemId of operation.itemIds) delete scene.wallMaterialOverrides[itemId];
    } else if (type === 'duplicate-items') {
      for (const copy of operation.copies) {
        const item = itemById(scene, copy.itemId);
        add(scene, { ...structuredClone(item), id: copy.id, position: item.position.map((value, index) => value + copy.offset[index]) });
        syncPartition(scene, scene.items.at(-1));
      }
    } else if (type === 'batch-transform') {
      for (const itemId of operation.itemIds) itemById(scene, itemId);
      if (operation.anchorId && !operation.itemIds.includes(operation.anchorId)) fail('Batch anchor must be selected.');
      scene.items = transformEditorBatch(scene.items, operation);
      for (const itemId of operation.itemIds) syncPartition(scene, itemById(scene, itemId));
    } else if (type === 'set-items-locked') {
      for (const itemId of operation.itemIds) { const item = itemById(scene, itemId, true); item.isLocked = operation.locked; syncPartition(scene, item); }
    } else if (type === 'edit-wall-material') {
      const surfaces = editorWallSurfaces(scene);
      const targets = surfaces.filter((wall) => wall.id === operation.targetId || wall.face === operation.targetId).map((wall) => wall.id);
      const partition = scene.items.find((item) => item.id === operation.targetId && item.type === 'partition');
      if (partition) { itemById(scene, partition.id); targets.push(partition.id); }
      if (!targets.length) fail('Unknown wall material target.');
      validateUrls(operation.changes);
      for (const target of targets) scene.wallMaterialOverrides[target] = { ...scene.wallMaterialOverrides[target], ...operation.changes };
    } else if (type === 'add-floor-element') {
      if (!scene.roomSize) fail('Create the room with edit-room before adding floor elements.');
      validateFloorTransform(operation.element);
      if (scene.floorPlanElements.some((el) => el.id === operation.element.id)) fail('Duplicate floor element.');
      scene.floorPlanElements.push(structuredClone(operation.element));
      if (operation.element.type === 'wall') add(scene, { id: operation.element.id, type: 'partition', content: operation.element.color || '#eeeeee',
        position: [operation.element.position[0], scene.roomSize.height / 2, operation.element.position[2]], rotation: [0, operation.element.rotation[1], 0],
        scale: [Math.abs(operation.element.scale[0]), scene.roomSize.height, Math.abs(operation.element.scale[2])], isLocked: operation.element.isLocked });
    } else if (type === 'edit-floor-element' || type === 'remove-floor-element') {
      const element = scene.floorPlanElements.find((el) => el.id === operation.elementId);
      if (!element) fail('Unknown floor element.');
      if (element.isLocked && !(type === 'edit-floor-element' && Object.keys(operation.changes).length === 1 && operation.changes.isLocked === false)) fail('Floor element is locked.');
      if (type === 'edit-floor-element') {
        Object.assign(element, operation.changes);
        validateFloorTransform(element);
        const primary = scene.floorPlanElements.find((entry) => entry.type === 'room' && entry.isLocked) || scene.floorPlanElements.find((entry) => entry.type === 'room');
        if (element === primary && operation.changes.scale) Object.assign(scene.roomSize, { width: Math.abs(element.scale[0]), length: Math.abs(element.scale[2]) });
        const partition = scene.items.find((item) => item.id === element.id && item.type === 'partition');
        if (element.type === 'wall' && partition) Object.assign(partition, { position: [element.position[0], scene.roomSize.height / 2, element.position[2]],
          rotation: [0, element.rotation[1], 0], scale: [Math.abs(element.scale[0]), scene.roomSize.height, Math.abs(element.scale[2])], content: element.color || partition.content, isLocked: element.isLocked });
      } else { requireDestructive(element.id, options); scene.floorPlanElements = scene.floorPlanElements.filter((el) => el !== element); delete scene.wallMaterialOverrides[element.id];
        scene.items = scene.items.filter((item) => item.id !== element.id || item.type !== 'partition'); }
    } else if (type === 'place-asset' || type === 'replace-item-asset') {
      const asset = chosenAsset(options, operation.assetKey);
      if (type === 'place-asset') add(scene, { id: operation.id, type: asset.kind === 'model' ? 'pedestal' : 'painting',
        ...assetFields(asset), title: asset.label, position: operation.position, rotation: operation.rotation, scale: operation.scale });
      else {
        const item = itemById(scene, operation.itemId); requireDestructive(item.id, options);
        if (asset.kind === 'model' ? !['pedestal', 'sculpture'].includes(item.type) : item.type !== 'painting') fail('Asset kind does not match the selected item.');
        for (const field of ['content', 'assetId', 'assetUrl', 'thumbnailUrl', 'videoThumbnailUrl', 'fileName', 'fileMimeType', 'imageAspectRatio']) delete item[field];
        Object.assign(item, assetFields(asset));
      }
    } else if (type === 'mount-on-partition') {
      const item = itemById(scene, operation.itemId); const partition = itemById(scene, operation.partitionId, true);
      if (partition.type !== 'partition' || !['painting', 'text', 'lightstrip'].includes(item.type)) fail('Unsupported partition mount.');
      if (Math.abs(partition.rotation[0]) > 0.001 || Math.abs(partition.rotation[2]) > 0.001) fail('Partition must be upright.');
      const halfWidth = (item.type === 'painting' ? (item.frameWidth || 2) / 2 + 0.1 : 0.8) * Math.abs(item.scale[0]);
      const halfHeight = (item.type === 'painting' ? (item.frameHeight || 1.5) / 2 + 0.3 : 0.6) * Math.abs(item.scale[1]);
      if (Math.abs(operation.offset) + halfWidth > Math.abs(partition.scale[0]) / 2 || Math.abs(operation.height - partition.position[1]) + halfHeight > Math.abs(partition.scale[1]) / 2) fail('Artwork exceeds partition bounds.');
      const angle = partition.rotation[1] + (operation.side === 'back' ? Math.PI : 0);
      const depth = Math.abs(partition.scale[2]) / 2 + (item.type === 'painting' ? 0.1 : item.type === 'text' ? 0.075 : 0.44) * Math.abs(item.scale[2]) + 0.01;
      item.position = [partition.position[0] + operation.offset * Math.cos(angle) + depth * Math.sin(angle), operation.height,
        partition.position[2] - operation.offset * Math.sin(angle) + depth * Math.cos(angle)];
      item.rotation = [0, angle, 0];
    } else {
      if (operation.itemId) itemById(scene, operation.itemId);
      if (type === 'update-item-display' && 'isLocked' in operation) fail('Use set-items-locked to explicitly change locks.');
      if (type === 'add-furniture' && operation.content && !/^#[0-9a-f]{3,8}$/i.test(operation.content)) fail('Use place-asset for model media.');
      scene = applyLegacy(scene, operation);
      if (operation.itemId) {
        const updated = scene.items.find((item) => item.id === operation.itemId);
        if (updated) syncPartition(scene, updated);
        else {
          scene.floorPlanElements = scene.floorPlanElements.filter((element) => element.type !== 'wall' || element.id !== operation.itemId);
          delete scene.wallMaterialOverrides[operation.itemId];
        }
      }
      for (const item of scene.items) if (!currentScene.items.some((original) => original.id === item.id)) syncPartition(scene, item);
    }
    validateScene(scene);
  }
  return { scene, warnings: [] };
}
