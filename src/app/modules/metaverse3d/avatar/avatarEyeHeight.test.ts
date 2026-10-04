import { describe, expect, it } from "vitest";

import { DEFAULT_AVATAR_APPEARANCE } from "./avatarAppearance";
import {
  AVATAR_BODY_SCALE,
  AVATAR_ROOT_OFFSET_Y,
  DEFAULT_AVATAR_EYE_HEIGHT,
  getAvatarEyeHeight,
} from "./avatarEyeHeight";

describe("avatar eye height", () => {
  it("matches the authored eye position for the default body", () => {
    expect(DEFAULT_AVATAR_EYE_HEIGHT).toBeCloseTo(
      2.55 * AVATAR_BODY_SCALE.body01 + AVATAR_ROOT_OFFSET_Y,
    );
  });

  it("tracks body scale and the user's facial eye offset", () => {
    const appearance = {
      ...DEFAULT_AVATAR_APPEARANCE,
      body: "body02" as const,
      facialPlacement: {
        ...DEFAULT_AVATAR_APPEARANCE.facialPlacement,
        eyes: {
          ...DEFAULT_AVATAR_APPEARANCE.facialPlacement.eyes,
          offsetY: 0.1,
        },
      },
    };

    expect(getAvatarEyeHeight(appearance)).toBeCloseTo(
      2.65 * AVATAR_BODY_SCALE.body02 + AVATAR_ROOT_OFFSET_Y,
    );
  });
});
