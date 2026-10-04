import { describe, expect, it } from "vitest";

import {
  DEFAULT_AVATAR_APPEARANCE,
  normalizeAvatarHexColor,
  normalizeAvatarAppearance,
  resolveAvatarTopColor,
  type AvatarAppearanceV1,
} from "./avatarAppearance";
import { DEFAULT_AVATAR_FACIAL_PLACEMENT } from "./avatarFacialPlacement";

const CUSTOM_APPEARANCE: AvatarAppearanceV1 = {
  version: 1,
  body: "body02",
  head: "head02",
  eyes: "eyes03",
  eyebrows: "eyebrows03",
  mouth: "mouth03",
  hair: "hair03",
  top: "top03",
  bottom: "bottom03",
  shoes: "shoes02",
  accessory: "glasses01",
  facialPlacement: {
    eyes: { ...DEFAULT_AVATAR_FACIAL_PLACEMENT.eyes },
    eyebrows: { ...DEFAULT_AVATAR_FACIAL_PLACEMENT.eyebrows },
    mouth: { ...DEFAULT_AVATAR_FACIAL_PLACEMENT.mouth },
  },
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

  it("normalizes a custom shirt color to canonical uppercase HEX", () => {
    expect(normalizeAvatarAppearance({
      ...CUSTOM_APPEARANCE,
      colors: {
        ...CUSTOM_APPEARANCE.colors,
        topCustom: "#3a7bd5",
      },
    }).colors.topCustom).toBe("#3A7BD5");
  });

  it.each([
    "#abc",
    "#11223344",
    "navy",
    " #112233",
    "#112233 ",
    "rgb(17, 34, 51)",
    "url(https://example.com/color)",
    null,
  ])("removes an invalid custom shirt color: %s", (topCustom) => {
    expect(normalizeAvatarAppearance({
      ...CUSTOM_APPEARANCE,
      colors: {
        ...CUSTOM_APPEARANCE.colors,
        topCustom,
      },
    }).colors).toEqual(CUSTOM_APPEARANCE.colors);
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

  it("adds neutral facial placement to legacy V1 appearances", () => {
    const legacy = { ...CUSTOM_APPEARANCE };
    delete (legacy as Partial<AvatarAppearanceV1>).facialPlacement;

    expect(normalizeAvatarAppearance(legacy).facialPlacement).toEqual(
      DEFAULT_AVATAR_FACIAL_PLACEMENT,
    );
  });

  it("clamps facial placement and replaces non-finite values", () => {
    const normalized = normalizeAvatarAppearance({
      ...CUSTOM_APPEARANCE,
      facialPlacement: {
        eyes: { offsetY: 99, spacing: -99, scale: Number.NaN },
        eyebrows: { offsetY: 0.02, spacing: 0.03, rotation: 99 },
        mouth: { offsetX: -99, offsetY: 99, scaleX: 10, scaleY: 0 },
      },
    });

    expect(normalized.facialPlacement.eyes.offsetY).toBe(0.1);
    expect(normalized.facialPlacement.eyes.spacing).toBe(-0.06);
    expect(normalized.facialPlacement.eyes.scale).toBe(1);
    expect(normalized.facialPlacement.eyebrows.rotation).toBe(0.35);
    expect(normalized.facialPlacement.mouth).toEqual({
      offsetX: -0.12,
      offsetY: 0.08,
      scaleX: 1.4,
      scaleY: 0.7,
    });
  });

  it("returns independent facial placement objects", () => {
    const first = normalizeAvatarAppearance(DEFAULT_AVATAR_APPEARANCE);
    const second = normalizeAvatarAppearance(DEFAULT_AVATAR_APPEARANCE);

    expect(first.facialPlacement).not.toBe(second.facialPlacement);
    expect(first.facialPlacement.eyes).not.toBe(second.facialPlacement.eyes);
    expect(first.facialPlacement.eyebrows).not.toBe(
      second.facialPlacement.eyebrows,
    );
    expect(first.facialPlacement.mouth).not.toBe(second.facialPlacement.mouth);
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

  it("preserves only canonical uploaded shirt photo URLs", () => {
    const topPhotoUrl =
      "/api/media/42f3be8d-1c5a-4a4a-8a53-9a98bc2bd144";

    expect(normalizeAvatarAppearance({
      ...CUSTOM_APPEARANCE,
      topPhotoUrl,
    })).toEqual({
      ...CUSTOM_APPEARANCE,
      topPhotoUrl,
    });
    expect(normalizeAvatarAppearance({
      ...CUSTOM_APPEARANCE,
      topPhotoUrl: "https://tracker.example/photo.jpg",
    })).toEqual(CUSTOM_APPEARANCE);
  });

  it("returns a fresh default for null and malformed values", () => {
    expect(normalizeAvatarAppearance(null)).toEqual(DEFAULT_AVATAR_APPEARANCE);
    expect(normalizeAvatarAppearance({ version: 1, colors: null })).toEqual(
      DEFAULT_AVATAR_APPEARANCE,
    );
  });
});

describe("normalizeAvatarHexColor", () => {
  it("accepts exactly six hexadecimal digits and canonicalizes the case", () => {
    expect(normalizeAvatarHexColor("#00aBc9")).toBe("#00ABC9");
  });

  it("rejects non-canonical CSS color formats", () => {
    expect(normalizeAvatarHexColor("#abc")).toBeUndefined();
    expect(normalizeAvatarHexColor("#001122ff")).toBeUndefined();
    expect(normalizeAvatarHexColor("rebeccapurple")).toBeUndefined();
  });
});

describe("resolveAvatarTopColor", () => {
  it("prefers the valid custom override", () => {
    expect(resolveAvatarTopColor({
      ...CUSTOM_APPEARANCE,
      colors: {
        ...CUSTOM_APPEARANCE.colors,
        topCustom: "#abcdef",
      },
    })).toBe("#ABCDEF");
  });

  it("falls back to the selected built-in palette color", () => {
    expect(resolveAvatarTopColor(CUSTOM_APPEARANCE)).toBe("#b85d73");
  });
});
