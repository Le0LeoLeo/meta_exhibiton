import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
  DEFAULT_AVATAR_APPEARANCE,
  parseAvatarAppearance,
  parseStoredAvatarAppearance,
} from './avatarAppearanceSchema.js';

function createValidAppearance(overrides = {}) {
  return {
    version: 1,
    body: 'body01',
    head: 'head02',
    hair: 'hair03',
    top: 'top02',
    bottom: 'bottom03',
    shoes: 'shoes02',
    accessory: 'glasses01',
    colors: {
      skin: 'skin04',
      hair: 'hairBrown',
      top: 'teal',
      bottom: 'navy',
      shoes: 'white',
    },
    ...overrides,
  };
}

describe('parseAvatarAppearance', () => {
  it('parses a valid V1 appearance', () => {
    expect(parseAvatarAppearance(createValidAppearance())).toEqual(createValidAppearance());
  });

  it('rejects unsupported asset IDs and unknown fields for HTTP callers', () => {
    expect(() => parseAvatarAppearance(createValidAppearance({ hair: 'remote-url' })))
      .toThrow(ZodError);
    expect(() => parseAvatarAppearance(createValidAppearance({ modelUrl: 'https://example.com/avatar.glb' })))
      .toThrow(ZodError);
  });

  it('rejects unsupported versions for HTTP callers', () => {
    expect(() => parseAvatarAppearance(createValidAppearance({ version: 2 })))
      .toThrow(ZodError);
  });
});

describe('parseStoredAvatarAppearance', () => {
  it('parses valid stored JSON', () => {
    const appearance = createValidAppearance();

    expect(parseStoredAvatarAppearance(JSON.stringify(appearance))).toEqual(appearance);
  });

  it.each([
    ['malformed JSON', '{"version":1'],
    ['invalid stored appearance', JSON.stringify(createValidAppearance({ top: 'unknown' }))],
    ['missing stored appearance', null],
  ])('falls back to the default for %s', (_label, storedValue) => {
    expect(parseStoredAvatarAppearance(storedValue)).toEqual(DEFAULT_AVATAR_APPEARANCE);
  });
});
