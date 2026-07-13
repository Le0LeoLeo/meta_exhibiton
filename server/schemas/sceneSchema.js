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
];

const WALL_MATERIAL_PRESETS = ['paint', 'concrete', 'metal', 'wood', 'glass'];
const FLOOR_PLAN_TYPES = ['room', 'wall'];

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
  modelOffset: vec3Schema('modelOffset').optional(),
  title: z.string().optional(),
  artist: z.string().optional(),
  description: z.string().optional(),
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
