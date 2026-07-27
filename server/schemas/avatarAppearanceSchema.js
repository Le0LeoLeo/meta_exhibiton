import { z } from 'zod';

const avatarColorsSchema = z.object({
  skin: z.enum(['skin01', 'skin02', 'skin03', 'skin04', 'skin05']),
  hair: z.enum(['hairBlack', 'hairBrown', 'hairBlonde', 'hairRed']),
  top: z.enum(['navy', 'teal', 'violet', 'rose', 'amber']),
  bottom: z.enum(['charcoal', 'navy', 'brown']),
  shoes: z.enum(['black', 'white', 'brown']),
}).strict();

export const avatarAppearanceSchema = z.object({
  version: z.literal(1),
  body: z.enum(['body01', 'body02']),
  head: z.enum(['head01', 'head02']),
  hair: z.enum(['hair01', 'hair02', 'hair03']),
  top: z.enum(['top01', 'top02', 'top03']),
  bottom: z.enum(['bottom01', 'bottom02', 'bottom03']),
  shoes: z.enum(['shoes01', 'shoes02']),
  accessory: z.enum(['none', 'glasses01', 'hat01']),
  colors: avatarColorsSchema,
}).strict();

export const DEFAULT_AVATAR_APPEARANCE = Object.freeze({
  version: 1,
  body: 'body01',
  head: 'head01',
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
