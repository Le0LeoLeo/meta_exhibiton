import { z } from 'zod';

const ITEM_TYPES = [
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
];

const WALL_MATERIAL_PRESETS = ['paint', 'concrete', 'metal', 'wood', 'glass'];
const PAINTING_FRAME_STYLES = ['modern', 'classic', 'natural', 'metal', 'floating', 'borderless'];
const FLOOR_PLAN_TYPES = ['room', 'wall'];

const sourceUrlSchema = z.string().max(1000).refine((value) => {
  try {
    if (!/^https?:\/\//i.test(value)) return false;
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}, 'source URL must use http or https');

export const exhibitWorkContextSchema = z.object({
  contribution: z.string().max(2000).optional(),
  process: z.string().max(2000).optional(),
  outcome: z.string().max(2000).optional(),
  reflection: z.string().max(2000).optional(),
  sources: z.array(z.object({
    label: z.string().trim().min(1).max(200),
    url: sourceUrlSchema.optional(),
    excerpt: z.string().max(2000).optional(),
  }).strict()).max(5).optional(),
}).strict();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const vec3Schema = (fieldName) =>
  z.array(z.number({ error: `${fieldName} must contain numbers` })).length(3, `${fieldName} must have exactly 3 numbers`);

export const roomSizeSchema = z.object({
  width: z.number().positive().transform((value) => clamp(value, 8, 40)),
  length: z.number().positive().transform((value) => clamp(value, 8, 60)),
  height: z.number().positive().transform((value) => clamp(value, 4, 8)),
  wallThickness: z.number().positive().transform((value) => clamp(value, 0.08, 0.2)),
  wallColor: z.string().default('#f8fafc'),
  wallMaterialPreset: z.enum(WALL_MATERIAL_PRESETS).default('paint'),
  wallTextureUrl: z.string().default('/textures/wall-paint.svg'),
  wallTextureCustomPresets: z.array(z.object({
    label: z.string(),
    value: z.string(),
  })).optional(),
  wallTextureTiling: z.number().nonnegative().default(3),
  wallRoughness: z.number().min(0).max(1).default(0.35),
  wallMetalness: z.number().min(0).max(1).default(0.08),
  wallBumpScale: z.number().min(0).max(1).default(0.04),
  wallEnvIntensity: z.number().min(0).max(2).default(0.9),
  wallOpacity: z.number().min(0).max(1).default(0.98),
  wallTransmission: z.number().min(0).max(1).default(0),
  wallIor: z.number().min(1).max(2.5).default(1.45),
  floorColor: z.string().default('#0f172a'),
  floorTextureUrl: z.string().default('/textures/wall-concrete.svg'),
  floorTextureTiling: z.number().nonnegative().default(2.5),
  floorRoughness: z.number().min(0).max(1).default(0.55),
  floorMetalness: z.number().min(0).max(1).default(0.18),
  environmentBrightness: z.number().min(0).max(2).default(0.45),
});

export const exhibitItemSchema = z.object({
  id: z.string().trim().min(1),
  type: z.enum(ITEM_TYPES),
  position: vec3Schema('position'),
  rotation: vec3Schema('rotation'),
  scale: vec3Schema('scale'),
  content: z.string().default(''),
  fileName: z.string().optional(),
  fileMimeType: z.string().optional(),
  videoThumbnailUrl: z.string().optional(),
  videoAutoplay: z.boolean().optional(),
  videoLoop: z.boolean().optional(),
  videoMuted: z.boolean().optional(),
  frameWidth: z.number().positive().optional(),
  frameHeight: z.number().positive().optional(),
  imageAspectRatio: z.number().positive().optional(),
  frameStyle: z.enum(PAINTING_FRAME_STYLES).optional(),
  frameColor: z.string().optional(),
  frameInnerColor: z.string().optional(),
  frameThickness: z.number().min(0.02).max(0.3).optional(),
  frameDepth: z.number().min(0.02).max(0.2).optional(),
  frameMatEnabled: z.boolean().optional(),
  frameMatColor: z.string().optional(),
  frameMatWidth: z.number().min(0).max(0.35).optional(),
  frameGlassEnabled: z.boolean().optional(),
  modelOffset: vec3Schema('modelOffset').optional(),
  title: z.string().optional(),
  artist: z.string().optional(),
  description: z.string().optional(),
  workContext: exhibitWorkContextSchema.optional(),
  externalUrl: z.string().optional(),
  textFontFamily: z.enum(['sans', 'serif', 'mono']).optional(),
  textColor: z.string().optional(),
  textFontSize: z.number().positive().optional(),
  textIsBold: z.boolean().optional(),
  textBackboardEnabled: z.boolean().optional(),
  textBackboardColor: z.string().optional(),
  lightIntensity: z.number().optional(),
  isLocked: z.boolean().optional(),
  uploadStatus: z.enum(['pending', 'uploading', 'done', 'error']).optional(),
  uploadProgress: z.number().min(0).max(100).optional(),
  assetId: z.string().optional(),
  assetUrl: z.string().optional(),
  thumbnailUrl: z.string().optional(),
});

export const wallMaterialSettingsSchema = z.object({
  wallColor: z.string().optional(),
  wallMaterialPreset: z.enum(WALL_MATERIAL_PRESETS).optional(),
  wallTextureUrl: z.string().optional(),
  wallTextureTiling: z.number().nonnegative().optional(),
  wallRoughness: z.number().min(0).max(1).optional(),
  wallMetalness: z.number().min(0).max(1).optional(),
  wallBumpScale: z.number().min(0).max(1).optional(),
  wallEnvIntensity: z.number().min(0).max(2).optional(),
  wallOpacity: z.number().min(0).max(1).optional(),
  wallTransmission: z.number().min(0).max(1).optional(),
  wallIor: z.number().min(1).max(2.5).optional(),
}).partial();

export const floorPlanElementSchema = z.object({
  id: z.string().trim().min(1),
  type: z.enum(FLOOR_PLAN_TYPES),
  position: vec3Schema('position'),
  rotation: vec3Schema('rotation'),
  scale: vec3Schema('scale'),
  color: z.string().optional(),
  isLocked: z.boolean().optional(),
  doorOffset: z.number().optional(),
  doorWidth: z.number().positive().optional(),
});

export const sceneSnapshotSchema = z.object({
  roomSize: roomSizeSchema,
  items: z.array(exhibitItemSchema).default([]),
  floorPlanElements: z.array(floorPlanElementSchema).default([]),
  wallMaterialOverrides: z.record(z.string(), wallMaterialSettingsSchema).default({}),
});

export function sanitizeSceneSnapshot(scene) {
  return sceneSnapshotSchema.parse(scene);
}

// Validate saved editor snapshots without applying AI normalization or dropping
// legacy/extension fields. A null room is valid while drawing a floor plan.
export const persistentSceneSchema = sceneSnapshotSchema.extend({
  roomSize: roomSizeSchema.extend({
    width: z.number().positive().max(100_000),
    length: z.number().positive().max(100_000),
    height: z.number().positive().max(100_000),
    wallThickness: z.number().positive().max(1_000),
  }).nullable(),
  items: z.array(exhibitItemSchema).max(500),
  floorPlanElements: z.array(floorPlanElementSchema).max(500).optional(),
}).superRefine((scene, context) => {
  for (const field of ['items', 'floorPlanElements']) {
    const ids = new Set();
    for (const item of scene[field] ?? []) {
      if (ids.has(item.id)) context.addIssue({ code: 'custom', path: [field], message: 'duplicate item id' });
      ids.add(item.id);
    }
  }
});
