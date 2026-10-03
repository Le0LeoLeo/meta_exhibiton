import { describe, expect, it } from "vitest";
import {
  AVATAR_LOOK_PRESETS,
  harmonizeAvatarColors,
} from "./avatarLooks";
import {
  DEFAULT_AVATAR_APPEARANCE,
  normalizeAvatarAppearance,
} from "@/app/modules/metaverse3d/avatar/avatarAppearance";
import { DEFAULT_AVATAR_FACIAL_PLACEMENT } from "@/app/modules/metaverse3d/avatar/avatarFacialPlacement";

describe("avatarLooks", () => {
  it("keeps every curated look inside the shared avatar contract", () => {
    for (const preset of AVATAR_LOOK_PRESETS) {
      expect(normalizeAvatarAppearance(preset.appearance)).toEqual(
        preset.appearance,
      );
    }
  });

  it("gives every preset an independent neutral facial placement", () => {
    for (const preset of AVATAR_LOOK_PRESETS) {
      expect(preset.appearance.facialPlacement).toEqual(
        DEFAULT_AVATAR_FACIAL_PLACEMENT,
      );
    }
    expect(AVATAR_LOOK_PRESETS[0].appearance.facialPlacement).not.toBe(
      AVATAR_LOOK_PRESETS[1].appearance.facialPlacement,
    );
    expect(AVATAR_LOOK_PRESETS[0].appearance.facialPlacement.eyes).not.toBe(
      AVATAR_LOOK_PRESETS[1].appearance.facialPlacement.eyes,
    );
  });

  it("coordinates bottoms and shoes without replacing chosen parts", () => {
    const appearance = {
      ...DEFAULT_AVATAR_APPEARANCE,
      top: "top03" as const,
      colors: {
        ...DEFAULT_AVATAR_APPEARANCE.colors,
        top: "mint" as const,
      },
    };

    expect(harmonizeAvatarColors(appearance)).toEqual({
      ...appearance,
      colors: {
        ...appearance.colors,
        bottom: "olive",
        shoes: "white",
      },
    });
  });
});
