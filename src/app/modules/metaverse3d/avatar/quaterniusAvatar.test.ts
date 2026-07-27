import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_AVATAR_APPEARANCE,
  type AvatarAppearanceV1,
} from "./avatarAppearance";
import {
  createAvatarAccessory,
  disposeQuaterniusAvatarScene,
} from "./quaterniusAvatar";

function appearance(
  overrides: Partial<AvatarAppearanceV1>,
): AvatarAppearanceV1 {
  return {
    ...DEFAULT_AVATAR_APPEARANCE,
    ...overrides,
    colors: {
      ...DEFAULT_AVATAR_APPEARANCE.colors,
      ...overrides.colors,
    },
  };
}

describe("createAvatarAccessory", () => {
  it("creates no GPU resources for the none option", () => {
    const accessory = createAvatarAccessory(
      appearance({ accessory: "none" }),
    );

    expect(accessory.object.name).toBe("Accessory_none");
    expect(accessory.object.children).toHaveLength(0);
    expect(accessory.materials).toHaveLength(0);
    expect(accessory.geometries).toHaveLength(0);
  });

  it("creates glasses positioned in front of the head", () => {
    const accessory = createAvatarAccessory(
      appearance({ accessory: "glasses01" }),
    );

    expect(accessory.object.name).toBe("Accessory_glasses01");
    expect(accessory.object.children).toHaveLength(5);
    expect(accessory.geometries).toHaveLength(5);
    expect(accessory.object.children.every((child) => child.position.z > 0))
      .toBe(true);
  });

  it("uses the selected top color for the hat", () => {
    const accessory = createAvatarAccessory(
      appearance({
        accessory: "hat01",
        colors: { ...DEFAULT_AVATAR_APPEARANCE.colors, top: "rose" },
      }),
    );

    expect(accessory.object.name).toBe("Accessory_hat01");
    expect(accessory.object.children).toHaveLength(2);
    expect(accessory.materials).toHaveLength(2);
  });
});

describe("disposeQuaterniusAvatarScene", () => {
  it("disposes only owned materials and accessory geometries", () => {
    const accessory = createAvatarAccessory(
      appearance({ accessory: "hat01" }),
    );
    const materialSpies = accessory.materials.map((material) =>
      vi.spyOn(material, "dispose")
    );
    const geometrySpies = accessory.geometries.map((geometry) =>
      vi.spyOn(geometry, "dispose")
    );

    disposeQuaterniusAvatarScene({
      scene: accessory.object,
      ownedMaterials: accessory.materials,
      ownedGeometries: accessory.geometries,
    });

    materialSpies.forEach((spy) => expect(spy).toHaveBeenCalledOnce());
    geometrySpies.forEach((spy) => expect(spy).toHaveBeenCalledOnce());
  });
});
