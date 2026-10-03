import { z } from 'zod';
import { sanitizeSceneSnapshot } from '../schemas/sceneSchema.js';
import { normalizeSceneGeometry } from './sceneGeometryService.js';
import { arrangeExhibitionSections, createExhibitionDivider } from './exhibitionSpatialTools.js';
import { editorCommandSchemas, editorCommandTypes, applyCompleteEditorPlan } from './editorSceneCommands.js';

export const operationTypes = [
  ...editorCommandTypes,
  'arrange-exhibition-sections',
  'create-exhibition-divider',
  'update-room-style',
  'move-item',
  'update-item-copy',
  'update-item-display',
  'add-text',
  'add-light',
  'add-furniture',
  'remove-generated-item',
];

const vec3Schema = z.array(z.number().finite()).length(3);
const generatedIdSchema = z.string().trim().min(1).refine(
  (id) => /^(ai-|label-|light-|section-)/.test(id),
  'new item IDs must use an AI-generated prefix',
);
const baseItemFields = {
  id: generatedIdSchema,
  position: vec3Schema,
  rotation: vec3Schema.default([0, 0, 0]),
  scale: vec3Schema.default([1, 1, 1]),
  content: z.string().max(2_000).default(''),
};

const operationSchemas = [
  ...editorCommandSchemas,
  z.object({
    type: z.literal('arrange-exhibition-sections'),
    gap: z.number().min(0.3).max(3).default(0.5),
    sections: z.array(z.object({
      title: z.string().trim().min(1).max(24),
      wall: z.enum(['north', 'west', 'east']),
      itemIds: z.array(z.string().trim().min(1)).min(1).max(30),
    }).strict()).min(1).max(3),
  }).strict(),
  z.object({
    type: z.literal('create-exhibition-divider'),
    id: z.string().regex(/^ai-divider-[a-zA-Z0-9-]{1,60}$/),
    atZ: z.number().finite(),
    aisleWidth: z.number().min(2).max(6).default(2),
  }).strict(),
  z.object({
    type: z.literal('update-room-style'),
    wallColor: z.string().max(100).optional(),
    wallMaterialPreset: z.enum(['paint', 'concrete', 'metal', 'wood', 'glass']).optional(),
    floorColor: z.string().max(100).optional(),
    environmentBrightness: z.number().min(0).max(2).optional(),
  }).strict(),
  z.object({
    type: z.literal('move-item'),
    itemId: z.string().trim().min(1),
    position: vec3Schema,
    rotation: vec3Schema.optional(),
    scale: vec3Schema.optional(),
  }).strict(),
  z.object({
    type: z.literal('update-item-copy'),
    itemId: z.string().trim().min(1),
    title: z.string().max(300).optional(),
    artist: z.string().max(300).optional(),
    description: z.string().max(2_000).optional(),
    externalUrl: z.string().max(2_000).optional(),
  }).strict(),
  z.object({
    type: z.literal('update-item-display'),
    itemId: z.string().trim().min(1),
    frameWidth: z.number().positive().max(20).optional(),
    frameHeight: z.number().positive().max(20).optional(),
    isLocked: z.boolean().optional(),
  }).strict(),
  z.object({
    type: z.literal('add-text'),
    ...baseItemFields,
    textFontFamily: z.enum(['sans', 'serif', 'mono']).optional(),
    textColor: z.string().max(100).optional(),
    textFontSize: z.number().positive().max(5).optional(),
    textIsBold: z.boolean().optional(),
    textBackboardEnabled: z.boolean().optional(),
    textBackboardColor: z.string().max(100).optional(),
  }).strict(),
  z.object({
    type: z.literal('add-light'),
    ...baseItemFields,
    lightIntensity: z.number().min(0).max(2).optional(),
  }).strict(),
  z.object({
    type: z.literal('add-furniture'),
    ...baseItemFields,
    itemType: z.enum([
      'pedestal', 'flower', 'chandelier', 'bench', 'rug', 'vase',
      'sculpture', 'spotlight', 'plant', 'column', 'neon', 'chair',
      'sofa', 'floorlamp', 'cabinet', 'turntable', 'fountain',
    ]),
  }).strict(),
  z.object({
    type: z.literal('remove-generated-item'),
    itemId: z.string().trim().min(1),
  }).strict(),
];

export const sceneOperationSchema = z.discriminatedUnion('type', operationSchemas);
export const sceneOperationPlanSchema = z.object({
  schemaVersion: z.literal(1),
  summary: z.string().trim().min(1).max(500),
  operations: z.array(sceneOperationSchema).max(100),
}).strict();

export const sceneOperationJsonSchema = z.toJSONSchema(sceneOperationPlanSchema);

export class SceneOperationError extends Error {
  constructor(message, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = 'SceneOperationError';
    this.code = 'INVALID_SCENE_OPERATION';
  }
}

function requireItem(items, itemId) {
  const index = items.findIndex((item) => item.id === itemId);
  if (index < 0) throw new SceneOperationError(`Unknown scene item: ${itemId}`);
  return index;
}

function addItem(scene, item) {
  if (scene.items.some((candidate) => candidate.id === item.id)) {
    throw new SceneOperationError(`Duplicate scene item ID: ${item.id}`);
  }
  return { ...scene, items: [...scene.items, item] };
}

function applyOneOperation(scene, operation) {
  if (operation.type === 'arrange-exhibition-sections') return arrangeExhibitionSections(scene, operation);
  if (operation.type === 'create-exhibition-divider') return createExhibitionDivider(scene, operation);
  if (operation.type === 'update-room-style') {
    const { type: _type, ...style } = operation;
    return { ...scene, roomSize: { ...scene.roomSize, ...style } };
  }

  if (operation.type === 'remove-generated-item') {
    requireItem(scene.items, operation.itemId);
    if (!/^(ai-|label-|light-|section-)/.test(operation.itemId)) {
      throw new SceneOperationError(`Cannot remove protected scene item: ${operation.itemId}`);
    }
    return { ...scene, items: scene.items.filter((item) => item.id !== operation.itemId) };
  }

  if (operation.type === 'add-text') {
    const { type: _type, ...item } = operation;
    return addItem(scene, { ...item, type: 'text' });
  }
  if (operation.type === 'add-light') {
    const { type: _type, ...item } = operation;
    return addItem(scene, { ...item, type: 'lightstrip' });
  }
  if (operation.type === 'add-furniture') {
    const { type: _type, itemType, ...item } = operation;
    return addItem(scene, { ...item, type: itemType });
  }

  const itemIndex = requireItem(scene.items, operation.itemId);
  const item = scene.items[itemIndex];
  const { type: _type, itemId: _itemId, ...changes } = operation;
  const items = [...scene.items];
  items[itemIndex] = { ...item, ...changes };
  return { ...scene, items };
}

export function applySceneOperationPlan(currentScene, plan, options = {}) {
  try {
    if (options.editMode === 'complete') return applyCompleteEditorPlan(currentScene, sceneOperationPlanSchema.parse(plan).operations, options, applyOneOperation);
    const source = sanitizeSceneSnapshot(structuredClone(currentScene));
    const parsedPlan = sceneOperationPlanSchema.parse(plan);
    const validatedPlacements = new Map();
    const next = parsedPlan.operations.reduce((scene, operation) => {
      const updated = applyOneOperation(scene, operation);
      if (['arrange-exhibition-sections', 'create-exhibition-divider'].includes(operation.type)) {
        for (const item of updated.items) {
          if (!scene.items.includes(item)) validatedPlacements.set(item.id, item);
        }
      }
      return updated;
    }, source);
    if (parsedPlan.operations.some((op) => ['arrange-exhibition-sections', 'create-exhibition-divider'].includes(op.type))) {
      // Semantic batches must not silently move unrelated works through legacy normalization.
      const preserved = new Map(source.items.filter((item) => next.items.includes(item)).map((item) => [item.id, item]));
      for (const [id, item] of validatedPlacements) if (next.items.includes(item)) preserved.set(id, item);
      // Normalize only legacy edits, so restored poses never produce misleading adjustment warnings.
      const result = normalizeSceneGeometry(sanitizeSceneSnapshot({ ...next, items: next.items.filter((item) => !preserved.has(item.id)) }));
      const normalized = new Map(result.scene.items.map((item) => [item.id, item]));
      result.scene.items = next.items.map((item) => preserved.get(item.id) || normalized.get(item.id));
      result.scene.floorPlanElements = source.floorPlanElements;
      return result;
    }
    return normalizeSceneGeometry(sanitizeSceneSnapshot(next));
  } catch (error) {
    if (error instanceof SceneOperationError) throw error;
    throw new SceneOperationError(error instanceof Error ? error.message : 'Invalid scene operation', error);
  }
}
