import {
  AVATAR_MANIFEST,
  type AvatarAccessoryId,
  type AvatarBodyId,
  type AvatarBottomColorId,
  type AvatarBottomId,
  type AvatarHairColorId,
  type AvatarHairId,
  type AvatarHeadId,
  type AvatarEyesId,
  type AvatarEyebrowsId,
  type AvatarMouthId,
  type AvatarShoesColorId,
  type AvatarShoesId,
  type AvatarSkinColorId,
  type AvatarTopColorId,
  type AvatarTopId,
} from "./avatarManifest";
import {
  DEFAULT_AVATAR_FACIAL_PLACEMENT,
  normalizeAvatarFacialPlacement,
  type AvatarFacialPlacement,
} from "./avatarFacialPlacement";

export type AvatarAppearanceV1 = {
  version: 1;
  body: AvatarBodyId;
  head: AvatarHeadId;
  eyes: AvatarEyesId;
  eyebrows: AvatarEyebrowsId;
  mouth: AvatarMouthId;
  hair: AvatarHairId;
  top: AvatarTopId;
  bottom: AvatarBottomId;
  shoes: AvatarShoesId;
  accessory: AvatarAccessoryId;
  topPhotoUrl?: string;
  facialPlacement: AvatarFacialPlacement;
  colors: {
    skin: AvatarSkinColorId;
    hair: AvatarHairColorId;
    top: AvatarTopColorId;
    topCustom?: string;
    bottom: AvatarBottomColorId;
    shoes: AvatarShoesColorId;
  };
};

const AVATAR_MEDIA_URL_PATTERN =
  /^\/api\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AVATAR_HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

export function normalizeAvatarHexColor(value: unknown): string | undefined {
  return typeof value === "string" && AVATAR_HEX_COLOR_PATTERN.test(value)
    ? value.toUpperCase()
    : undefined;
}

export const DEFAULT_AVATAR_APPEARANCE: AvatarAppearanceV1 = {
  version: 1,
  body: "body01",
  head: "head01",
  eyes: "eyes01",
  eyebrows: "eyebrows01",
  mouth: "mouth02",
  hair: "hair01",
  top: "top01",
  bottom: "bottom01",
  shoes: "shoes01",
  accessory: "none",
  facialPlacement: normalizeAvatarFacialPlacement(
    DEFAULT_AVATAR_FACIAL_PLACEMENT,
  ),
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
    facialPlacement: normalizeAvatarFacialPlacement(
      DEFAULT_AVATAR_APPEARANCE.facialPlacement,
    ),
    colors: { ...DEFAULT_AVATAR_APPEARANCE.colors },
  };
}

export function normalizeAvatarAppearance(value: unknown): AvatarAppearanceV1 {
  if (!isRecord(value) || value.version !== 1) {
    return createDefaultAppearance();
  }

  const colors = isRecord(value.colors) ? value.colors : {};
  const topCustom = normalizeAvatarHexColor(colors.topCustom);
  const topPhotoUrl =
    typeof value.topPhotoUrl === "string" &&
      AVATAR_MEDIA_URL_PATTERN.test(value.topPhotoUrl)
      ? value.topPhotoUrl
      : undefined;

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
    eyes: normalizeId(
      value.eyes,
      AVATAR_MANIFEST.features.eyes,
      DEFAULT_AVATAR_APPEARANCE.eyes,
    ),
    eyebrows: normalizeId(
      value.eyebrows,
      AVATAR_MANIFEST.features.eyebrows,
      DEFAULT_AVATAR_APPEARANCE.eyebrows,
    ),
    mouth: normalizeId(
      value.mouth,
      AVATAR_MANIFEST.features.mouth,
      DEFAULT_AVATAR_APPEARANCE.mouth,
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
    ...(topPhotoUrl ? { topPhotoUrl } : {}),
    facialPlacement: normalizeAvatarFacialPlacement(value.facialPlacement),
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
      ...(topCustom ? { topCustom } : {}),
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

export function resolveAvatarTopColor(
  appearance: Pick<AvatarAppearanceV1, "colors">,
): string {
  return normalizeAvatarHexColor(appearance.colors.topCustom) ??
    AVATAR_MANIFEST.colors.top[appearance.colors.top];
}
