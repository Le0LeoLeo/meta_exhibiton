import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
  DEFAULT_AVATAR_APPEARANCE,
  DEFAULT_AVATAR_FACIAL_PLACEMENT,
  parseAvatarAppearance,
  parseStoredAvatarAppearance,
} from './avatarAppearanceSchema.js';

function createValidAppearance(overrides = {}) {
  return {
    version: 1,
    body: 'body01',
    head: 'head02',
    eyes: 'eyes03',
    eyebrows: 'eyebrows02',
    mouth: 'mouth01',
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
    facialPlacement: structuredClone(DEFAULT_AVATAR_FACIAL_PLACEMENT),
    ...overrides,
  };
}

describe('parseAvatarAppearance', () => {
  it('parses a valid V1 appearance', () => {
    expect(parseAvatarAppearance(createValidAppearance())).toEqual(createValidAppearance());
  });

  it.each([
    'sky',
    'cobalt',
    'emerald',
    'lime',
    'orange',
    'burgundy',
    'chocolate',
    'slate',
  ])('accepts the expanded built-in shirt color %s', (top) => {
    const appearance = createValidAppearance({
      colors: {
        ...createValidAppearance().colors,
        top,
      },
    });

    expect(parseAvatarAppearance(appearance)).toEqual(appearance);
  });

  it('accepts a six-digit custom shirt color and canonicalizes it to uppercase', () => {
    const appearance = createValidAppearance({
      colors: {
        ...createValidAppearance().colors,
        topCustom: '#3a7bd5',
      },
    });

    expect(parseAvatarAppearance(appearance)).toEqual({
      ...appearance,
      colors: {
        ...appearance.colors,
        topCustom: '#3A7BD5',
      },
    });
  });

  it.each([
    ['shorthand HEX', '#abc'],
    ['HEX with alpha', '#3a7bd5ff'],
    ['CSS color name', 'rebeccapurple'],
    ['leading whitespace', ' #3a7bd5'],
    ['trailing whitespace', '#3a7bd5 '],
  ])('rejects a custom shirt color using %s', (_label, topCustom) => {
    expect(() => parseAvatarAppearance(createValidAppearance({
      colors: {
        ...createValidAppearance().colors,
        topCustom,
      },
    }))).toThrow(ZodError);
  });

  it('rejects unknown fields in the strict color contract', () => {
    expect(() => parseAvatarAppearance(createValidAppearance({
      colors: {
        ...createValidAppearance().colors,
        topCustom: '#3A7BD5',
        unsupported: '#FFFFFF',
      },
    }))).toThrow(ZodError);
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

  it('accepts only canonical uploaded shirt photo URLs', () => {
    const topPhotoUrl = '/api/media/42f3be8d-1c5a-4a4a-8a53-9a98bc2bd144';

    expect(parseAvatarAppearance(createValidAppearance({ topPhotoUrl })))
      .toEqual(createValidAppearance({ topPhotoUrl }));
    expect(() => parseAvatarAppearance(createValidAppearance({
      topPhotoUrl: 'https://tracker.example/photo.jpg',
    }))).toThrow(ZodError);
  });

  it('parses valid facial placement unchanged', () => {
    const facialPlacement = {
      eyes: { offsetY: 0.075, spacing: -0.04, scale: 1.2 },
      eyebrows: { offsetY: -0.055, spacing: 0.065, rotation: -0.25 },
      mouth: { offsetX: 0.1, offsetY: -0.075, scaleX: 1.3, scaleY: 0.8 },
    };

    expect(parseAvatarAppearance(createValidAppearance({ facialPlacement })).facialPlacement)
      .toEqual(facialPlacement);
  });

  it.each([
    ['eyes.offsetY', 'eyes', 'offsetY', 0.101],
    ['eyes.spacing', 'eyes', 'spacing', -0.061],
    ['eyes.scale', 'eyes', 'scale', 1.351],
    ['eyebrows.offsetY', 'eyebrows', 'offsetY', -0.081],
    ['eyebrows.spacing', 'eyebrows', 'spacing', 0.081],
    ['eyebrows.rotation', 'eyebrows', 'rotation', -0.351],
    ['mouth.offsetX', 'mouth', 'offsetX', 0.121],
    ['mouth.offsetY', 'mouth', 'offsetY', -0.101],
    ['mouth.scaleX', 'mouth', 'scaleX', 0.699],
    ['mouth.scaleY', 'mouth', 'scaleY', 1.401],
  ])('rejects %s outside its safe range', (_label, group, field, value) => {
    const facialPlacement = structuredClone(DEFAULT_AVATAR_FACIAL_PLACEMENT);
    facialPlacement[group][field] = value;

    expect(() => parseAvatarAppearance(createValidAppearance({ facialPlacement })))
      .toThrow(ZodError);
  });

  it.each([
    ['NaN', Number.NaN],
    ['positive infinity', Number.POSITIVE_INFINITY],
    ['negative infinity', Number.NEGATIVE_INFINITY],
    ['numeric strings', '0'],
  ])('rejects %s facial values', (_label, value) => {
    const facialPlacement = structuredClone(DEFAULT_AVATAR_FACIAL_PLACEMENT);
    facialPlacement.eyes.offsetY = value;

    expect(() => parseAvatarAppearance(createValidAppearance({ facialPlacement })))
      .toThrow(ZodError);
  });

  it('rejects unknown facial placement fields and missing nested groups', () => {
    expect(() => parseAvatarAppearance(createValidAppearance({
      facialPlacement: {
        ...structuredClone(DEFAULT_AVATAR_FACIAL_PLACEMENT),
        eyes: {
          ...DEFAULT_AVATAR_FACIAL_PLACEMENT.eyes,
          unsupported: 0,
        },
      },
    }))).toThrow(ZodError);

    const missingMouth = structuredClone(DEFAULT_AVATAR_FACIAL_PLACEMENT);
    delete missingMouth.mouth;
    expect(() => parseAvatarAppearance(createValidAppearance({
      facialPlacement: missingMouth,
    }))).toThrow(ZodError);
  });
});

describe('parseStoredAvatarAppearance', () => {
  it('parses valid stored JSON', () => {
    const appearance = createValidAppearance();

    expect(parseStoredAvatarAppearance(JSON.stringify(appearance))).toEqual(appearance);
  });

  it('adds default facial features to legacy stored appearances', () => {
    const legacy = createValidAppearance();
    delete legacy.eyes;
    delete legacy.eyebrows;
    delete legacy.mouth;

    expect(parseStoredAvatarAppearance(JSON.stringify(legacy))).toEqual({
      ...legacy,
      eyes: 'eyes01',
      eyebrows: 'eyebrows01',
      mouth: 'mouth02',
      facialPlacement: DEFAULT_AVATAR_FACIAL_PLACEMENT,
    });
  });

  it('adds neutral facial placement to legacy stored appearances', () => {
    const legacy = createValidAppearance();
    delete legacy.facialPlacement;

    expect(parseStoredAvatarAppearance(JSON.stringify(legacy))).toEqual({
      ...legacy,
      facialPlacement: DEFAULT_AVATAR_FACIAL_PLACEMENT,
    });
  });

  it.each([
    ['malformed JSON', '{"version":1'],
    ['invalid stored appearance', JSON.stringify(createValidAppearance({ top: 'unknown' }))],
    ['missing stored appearance', null],
  ])('falls back to the default for %s', (_label, storedValue) => {
    expect(parseStoredAvatarAppearance(storedValue)).toEqual(DEFAULT_AVATAR_APPEARANCE);
  });
});
