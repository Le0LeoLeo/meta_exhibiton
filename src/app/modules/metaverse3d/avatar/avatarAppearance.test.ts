import { describe, expect, it } from "vitest";

import {
  DEFAULT_AVATAR_APPEARANCE,
  normalizeAvatarAppearance,
  type AvatarAppearanceV1,
} from "./avatarAppearance";

const CUSTOM_APPEARANCE: AvatarAppearanceV1 = {
  version: 1,
  body: "body02",
  head: "head02",
  hair: "hair03",
  top: "top03",
  bottom: "bottom03",
  shoes: "shoes02",
  accessory: "glasses01",
  colors: {
    skin: "skin05",
    hair: "hairRed",
    top: "rose",
    bottom: "brown",
    shoes: "white",
  },
};

describe("normalizeAvatarAppearance", () => {
  it("preserves an allowed V1 appearance", () => {
    expect(normalizeAvatarAppearance(CUSTOM_APPEARANCE)).toEqual(CUSTOM_APPEARANCE);
  });

  it("falls back only invalid asset and palette IDs", () => {
    const value = {
      ...CUSTOM_APPEARANCE,
      hair: "https://example.com/untrusted-avatar.glb",
      colors: {
        ...CUSTOM_APPEARANCE.colors,
        top: "not-a-palette-color",
      },
    };

    expect(normalizeAvatarAppearance(value)).toEqual({
      ...CUSTOM_APPEARANCE,
      hair: DEFAULT_AVATAR_APPEARANCE.hair,
      colors: {
        ...CUSTOM_APPEARANCE.colors,
        top: DEFAULT_AVATAR_APPEARANCE.colors.top,
      },
    });
  });

  it("returns a fresh default appearance for unsupported versions", () => {
    const normalized = normalizeAvatarAppearance({
      ...CUSTOM_APPEARANCE,
      version: 2,
    });

    expect(normalized).toEqual(DEFAULT_AVATAR_APPEARANCE);
    expect(normalized).not.toBe(DEFAULT_AVATAR_APPEARANCE);
    expect(normalized.colors).not.toBe(DEFAULT_AVATAR_APPEARANCE.colors);
  });

  it("does not mutate the input object or its colors", () => {
    const value = {
      ...CUSTOM_APPEARANCE,
      hair: "invalid",
      colors: {
        ...CUSTOM_APPEARANCE.colors,
        shoes: "invalid",
      },
    };
    const snapshot = structuredClone(value);

    normalizeAvatarAppearance(value);

    expect(value).toEqual(snapshot);
  });

  it("returns a fresh default for null and malformed values", () => {
    expect(normalizeAvatarAppearance(null)).toEqual(DEFAULT_AVATAR_APPEARANCE);
    expect(normalizeAvatarAppearance({ version: 1, colors: null })).toEqual(
      DEFAULT_AVATAR_APPEARANCE,
    );
  });
});
