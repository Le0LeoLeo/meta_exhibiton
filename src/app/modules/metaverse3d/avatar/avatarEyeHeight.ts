import {
  DEFAULT_AVATAR_APPEARANCE,
  type AvatarAppearanceV1,
} from "./avatarAppearance";
import { normalizeAvatarFacialPlacement } from "./avatarFacialPlacement";

export const AVATAR_BASE_EYE_Y = 2.55;
export const AVATAR_ROOT_OFFSET_Y = 0.011;
export const AVATAR_BODY_SCALE = {
  body01: 0.529,
  body02: 0.549,
} as const satisfies Record<AvatarAppearanceV1["body"], number>;

export function getAvatarEyeHeight(appearance: AvatarAppearanceV1): number {
  const facialPlacement = normalizeAvatarFacialPlacement(
    appearance.facialPlacement,
  );
  return (
    (AVATAR_BASE_EYE_Y + facialPlacement.eyes.offsetY) *
      AVATAR_BODY_SCALE[appearance.body] +
    AVATAR_ROOT_OFFSET_Y
  );
}

export const DEFAULT_AVATAR_EYE_HEIGHT = getAvatarEyeHeight(
  DEFAULT_AVATAR_APPEARANCE,
);
