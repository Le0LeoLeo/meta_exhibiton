import {
  AVATAR_MANIFEST,
  type AvatarAccessoryId,
  type AvatarBodyId,
  type AvatarBottomColorId,
  type AvatarBottomId,
  type AvatarHairColorId,
  type AvatarHairId,
  type AvatarHeadId,
  type AvatarShoesColorId,
  type AvatarShoesId,
  type AvatarSkinColorId,
  type AvatarTopColorId,
  type AvatarTopId,
} from "./avatarManifest";

export type AvatarAppearanceV1 = {
  version: 1;
  body: AvatarBodyId;
  head: AvatarHeadId;
  hair: AvatarHairId;
  top: AvatarTopId;
  bottom: AvatarBottomId;
  shoes: AvatarShoesId;
  accessory: AvatarAccessoryId;
  colors: {
    skin: AvatarSkinColorId;
    hair: AvatarHairColorId;
    top: AvatarTopColorId;
    bottom: AvatarBottomColorId;
    shoes: AvatarShoesColorId;
  };
};

export const DEFAULT_AVATAR_APPEARANCE: AvatarAppearanceV1 = {
  version: 1,
  body: "body01",
  head: "head01",
  hair: "hair01",
  top: "top01",
  bottom: "bottom01",
  shoes: "shoes01",
  accessory: "none",
  colors: {
    skin: "skin02",
    hair: "hairBlack",
    top: "navy",
    bottom: "charcoal",
    shoes: "black",
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeId<T extends string>(
  value: unknown,
  allowed: Readonly<Record<T, string>>,
  fallback: T,
): T {
  return typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(allowed, value)
    ? (value as T)
    : fallback;
}

function createDefaultAppearance(): AvatarAppearanceV1 {
  return {
    ...DEFAULT_AVATAR_APPEARANCE,
    colors: { ...DEFAULT_AVATAR_APPEARANCE.colors },
  };
}

export function normalizeAvatarAppearance(value: unknown): AvatarAppearanceV1 {
  if (!isRecord(value) || value.version !== 1) {
    return createDefaultAppearance();
  }

  const colors = isRecord(value.colors) ? value.colors : {};

  return {
    version: 1,
    body: normalizeId(
      value.body,
      AVATAR_MANIFEST.nodes.body,
      DEFAULT_AVATAR_APPEARANCE.body,
    ),
    head: normalizeId(
      value.head,
      AVATAR_MANIFEST.nodes.head,
      DEFAULT_AVATAR_APPEARANCE.head,
    ),
    hair: normalizeId(
      value.hair,
      AVATAR_MANIFEST.nodes.hair,
      DEFAULT_AVATAR_APPEARANCE.hair,
    ),
    top: normalizeId(
      value.top,
      AVATAR_MANIFEST.nodes.top,
      DEFAULT_AVATAR_APPEARANCE.top,
    ),
    bottom: normalizeId(
      value.bottom,
      AVATAR_MANIFEST.nodes.bottom,
      DEFAULT_AVATAR_APPEARANCE.bottom,
    ),
    shoes: normalizeId(
      value.shoes,
      AVATAR_MANIFEST.nodes.shoes,
      DEFAULT_AVATAR_APPEARANCE.shoes,
    ),
    accessory: normalizeId(
      value.accessory,
      AVATAR_MANIFEST.nodes.accessory,
      DEFAULT_AVATAR_APPEARANCE.accessory,
    ),
    colors: {
      skin: normalizeId(
        colors.skin,
        AVATAR_MANIFEST.colors.skin,
        DEFAULT_AVATAR_APPEARANCE.colors.skin,
      ),
      hair: normalizeId(
        colors.hair,
        AVATAR_MANIFEST.colors.hair,
        DEFAULT_AVATAR_APPEARANCE.colors.hair,
      ),
      top: normalizeId(
        colors.top,
        AVATAR_MANIFEST.colors.top,
        DEFAULT_AVATAR_APPEARANCE.colors.top,
      ),
      bottom: normalizeId(
        colors.bottom,
        AVATAR_MANIFEST.colors.bottom,
        DEFAULT_AVATAR_APPEARANCE.colors.bottom,
      ),
      shoes: normalizeId(
        colors.shoes,
        AVATAR_MANIFEST.colors.shoes,
        DEFAULT_AVATAR_APPEARANCE.colors.shoes,
      ),
    },
  };
}
