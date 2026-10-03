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
} from "@/app/modules/metaverse3d/avatar/avatarManifest";
import type { AvatarAppearanceV1 } from "@/app/modules/metaverse3d/avatar/avatarAppearance";
import { DEFAULT_AVATAR_FACIAL_PLACEMENT } from "@/app/modules/metaverse3d/avatar/avatarFacialPlacement";

export type AvatarRandomSource = () => number;

function pickManifestKey<T extends string>(
  entries: Readonly<Record<T, string>>,
  random: AvatarRandomSource,
): T {
  const keys = Object.keys(entries) as T[];
  const sample = random();
  const normalizedSample = Number.isFinite(sample)
    ? Math.min(Math.max(sample, 0), 1 - Number.EPSILON)
    : 0;

  return keys[Math.floor(normalizedSample * keys.length)] ?? keys[0];
}

export function randomizeAvatar(
  random: AvatarRandomSource = Math.random,
): AvatarAppearanceV1 {
  return {
    version: 1,
    body: pickManifestKey<AvatarBodyId>(AVATAR_MANIFEST.nodes.body, random),
    head: pickManifestKey<AvatarHeadId>(AVATAR_MANIFEST.nodes.head, random),
    eyes: pickManifestKey<AvatarEyesId>(AVATAR_MANIFEST.features.eyes, random),
    eyebrows: pickManifestKey<AvatarEyebrowsId>(
      AVATAR_MANIFEST.features.eyebrows,
      random,
    ),
    mouth: pickManifestKey<AvatarMouthId>(
      AVATAR_MANIFEST.features.mouth,
      random,
    ),
    hair: pickManifestKey<AvatarHairId>(AVATAR_MANIFEST.nodes.hair, random),
    top: pickManifestKey<AvatarTopId>(AVATAR_MANIFEST.nodes.top, random),
    bottom: pickManifestKey<AvatarBottomId>(
      AVATAR_MANIFEST.nodes.bottom,
      random,
    ),
    shoes: pickManifestKey<AvatarShoesId>(
      AVATAR_MANIFEST.nodes.shoes,
      random,
    ),
    accessory: pickManifestKey<AvatarAccessoryId>(
      AVATAR_MANIFEST.nodes.accessory,
      random,
    ),
    facialPlacement: {
      eyes: { ...DEFAULT_AVATAR_FACIAL_PLACEMENT.eyes },
      eyebrows: { ...DEFAULT_AVATAR_FACIAL_PLACEMENT.eyebrows },
      mouth: { ...DEFAULT_AVATAR_FACIAL_PLACEMENT.mouth },
    },
    colors: {
      skin: pickManifestKey<AvatarSkinColorId>(
        AVATAR_MANIFEST.colors.skin,
        random,
      ),
      hair: pickManifestKey<AvatarHairColorId>(
        AVATAR_MANIFEST.colors.hair,
        random,
      ),
      top: pickManifestKey<AvatarTopColorId>(
        AVATAR_MANIFEST.colors.top,
        random,
      ),
      bottom: pickManifestKey<AvatarBottomColorId>(
        AVATAR_MANIFEST.colors.bottom,
        random,
      ),
      shoes: pickManifestKey<AvatarShoesColorId>(
        AVATAR_MANIFEST.colors.shoes,
        random,
      ),
    },
  };
}
