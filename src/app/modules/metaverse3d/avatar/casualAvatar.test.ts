import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { DEFAULT_AVATAR_APPEARANCE } from "./avatarAppearance";
import {
  createCasualAvatarScene,
  disposeCasualAvatarScene,
} from "./casualAvatar";

function createSource() {
  const source = new THREE.Group();
  const head = new THREE.Bone();
  head.name = "Head";
  source.add(head);
  const materials = ["Skin", "Shirt", "Pants", "Belt", "Face", "Hair"].map(
    (name) => {
      const material = new THREE.MeshStandardMaterial();
      material.name = name;
      return material;
    },
  );
  source.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), materials));
  return { source, materials };
}

describe("createCasualAvatarScene", () => {
  it("clones and recolors the complete source character", () => {
    const { source } = createSource();
    const configured = createCasualAvatarScene(
      source,
      DEFAULT_AVATAR_APPEARANCE,
    );
    const mesh = configured.scene.getObjectByProperty("type", "Mesh");
    const materials = (mesh as THREE.Mesh).material as THREE.Material[];
    const shirt = materials.find((material) => material.name === "Shirt");

    expect(configured.scene).not.toBe(source);
    expect(configured.scene.scale.x).toBeCloseTo(0.529);
    expect((shirt as THREE.MeshStandardMaterial).color.getHexString())
      .toBe("334c73");
  });

  it("adds a complete hair-bearing model without synthetic scalp pieces", () => {
    const { source } = createSource();
    const configured = createCasualAvatarScene(source, {
      ...DEFAULT_AVATAR_APPEARANCE,
      hair: "hair03",
    });

    expect(configured.scene.getObjectByName("Head")).toBeTruthy();
    expect(configured.scene.getObjectByName("Accessory_none")).toBeFalsy();
  });

  it("disposes only cloned materials and owned accessory geometry", () => {
    const { source, materials: sourceMaterials } = createSource();
    const configured = createCasualAvatarScene(source, {
      ...DEFAULT_AVATAR_APPEARANCE,
      accessory: "hat01",
    });
    const ownedSpies = configured.ownedMaterials.map((material) =>
      vi.spyOn(material, "dispose")
    );
    const sourceSpies = sourceMaterials.map((material) =>
      vi.spyOn(material, "dispose")
    );

    disposeCasualAvatarScene(configured);

    ownedSpies.forEach((spy) => expect(spy).toHaveBeenCalledOnce());
    sourceSpies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
  });
});
