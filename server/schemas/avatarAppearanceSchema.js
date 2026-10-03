import { z } from 'zod';

const avatarColorsSchema = z.object({
  skin: z.enum(['skin01', 'skin02', 'skin03', 'skin04', 'skin05', 'skin06']),
  hair: z.enum(['hairBlack', 'hairBrown', 'hairBlonde', 'hairRed', 'hairGray', 'hairBlue', 'hairPink']),
  top: z.enum([
    'navy',
    'teal',
    'violet',
    'rose',
    'amber',
    'black',
    'ivory',
    'mint',
    'crimson',
    'sky',
    'cobalt',
    'emerald',
    'lime',
    'orange',
    'burgundy',
    'chocolate',
    'slate',
  ]),
  topCustom: z.string()
    .regex(/^#[0-9a-f]{6}$/i, 'invalid custom shirt color')
    .transform((value) => value.toUpperCase())
    .optional(),
  bottom: z.enum(['charcoal', 'navy', 'brown', 'black', 'olive', 'sand', 'denim']),
  shoes: z.enum(['black', 'white', 'brown', 'navy', 'red']),
}).strict();

const avatarMediaUrlSchema = z.string().regex(
  /^\/api\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  'invalid avatar media URL',
);

export const DEFAULT_AVATAR_FACIAL_PLACEMENT = Object.freeze({
  eyes: Object.freeze({
    offsetY: 0,
    spacing: 0,
    scale: 1,
  }),
  eyebrows: Object.freeze({
    offsetY: 0,
    spacing: 0,
    rotation: 0,
  }),
  mouth: Object.freeze({
    offsetX: 0,
    offsetY: 0,
    scaleX: 1,
    scaleY: 1,
  }),
});

const facialPlacementSchema = z.object({
  eyes: z.object({
    offsetY: z.number().finite().min(-0.1).max(0.1),
    spacing: z.number().finite().min(-0.06).max(0.08),
    scale: z.number().finite().min(0.75).max(1.35),
  }).strict(),
  eyebrows: z.object({
    offsetY: z.number().finite().min(-0.08).max(0.1),
    spacing: z.number().finite().min(-0.06).max(0.08),
    rotation: z.number().finite().min(-0.35).max(0.35),
  }).strict(),
  mouth: z.object({
    offsetX: z.number().finite().min(-0.12).max(0.12),
    offsetY: z.number().finite().min(-0.1).max(0.08),
    scaleX: z.number().finite().min(0.7).max(1.4),
    scaleY: z.number().finite().min(0.7).max(1.4),
  }).strict(),
}).strict();

export const avatarAppearanceSchema = z.object({
  version: z.literal(1),
  body: z.enum(['body01', 'body02']),
  head: z.enum(['head01', 'head02']),
  eyes: z.enum(['eyes01', 'eyes02', 'eyes03']).default('eyes01'),
  eyebrows: z.enum(['eyebrows01', 'eyebrows02', 'eyebrows03']).default('eyebrows01'),
  mouth: z.enum(['mouth01', 'mouth02', 'mouth03']).default('mouth02'),
  hair: z.enum(['hair01', 'hair02', 'hair03']),
  top: z.enum(['top01', 'top02', 'top03']),
  bottom: z.enum(['bottom01', 'bottom02', 'bottom03']),
  shoes: z.enum(['shoes01', 'shoes02']),
  accessory: z.enum(['none', 'glasses01', 'hat01']),
  topPhotoUrl: avatarMediaUrlSchema.optional(),
  colors: avatarColorsSchema,
  facialPlacement: facialPlacementSchema.default(DEFAULT_AVATAR_FACIAL_PLACEMENT),
}).strict();

export const DEFAULT_AVATAR_APPEARANCE = Object.freeze({
  version: 1,
  body: 'body01',
  head: 'head01',
  eyes: 'eyes01',
  eyebrows: 'eyebrows01',
  mouth: 'mouth02',
  hair: 'hair01',
  top: 'top01',
  bottom: 'bottom01',
  shoes: 'shoes01',
  accessory: 'none',
  colors: Object.freeze({
    skin: 'skin02',
    hair: 'hairBlack',
    top: 'navy',
    bottom: 'charcoal',
    shoes: 'black',
  }),
  facialPlacement: DEFAULT_AVATAR_FACIAL_PLACEMENT,
});

/**
 * Parse an untrusted request payload.
 *
 * Invalid input deliberately throws a ZodError so HTTP handlers can return a
 * client error instead of silently replacing a user's submitted appearance.
 */
export function parseAvatarAppearance(value) {
  return avatarAppearanceSchema.parse(value);
}

/**
 * Parse the database representation, recovering safely from legacy or damaged
 * rows. Returning a parsed copy keeps the exported default immutable.
 */
export function parseStoredAvatarAppearance(json) {
  try {
    const value = typeof json === 'string' ? JSON.parse(json) : undefined;
    return parseAvatarAppearance(value);
  } catch {
    return parseAvatarAppearance(DEFAULT_AVATAR_APPEARANCE);
  }
}
