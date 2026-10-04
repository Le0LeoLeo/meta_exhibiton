import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { AVATAR_MANIFEST } from "./avatarManifest";
import { DEFAULT_AVATAR_APPEARANCE } from "./avatarAppearance";
import {
  createConfiguredAvatarScene,
  disposeConfiguredAvatarScene,
} from "./configureAvatarScene";

function createAvatarFixture() {
  const root = new THREE.Group();
  const sharedGeometry = new THREE.BoxGeometry(1, 1, 1);
  const materials = {
    skin: new THREE.MeshStandardMaterial({ color: "#ffffff" }),
    hair: new THREE.MeshStandardMaterial({ color: "#ffffff" }),
    top: new THREE.MeshStandardMaterial({ color: "#ffffff" }),
    bottom: new THREE.MeshStandardMaterial({ color: "#ffffff" }),
    shoes: new THREE.MeshStandardMaterial({ color: "#ffffff" }),
    accessory: new THREE.MeshStandardMaterial({ color: "#ffffff" }),
  };
  materials.skin.name = "MAT_SKIN";
  materials.hair.name = "MAT_HAIR";
  materials.top.name = "MAT_TOP_PRIMARY";
  materials.bottom.name = "MAT_BOTTOM";
  materials.shoes.name = "MAT_SHOES";
  materials.accessory.name = "MAT_ACCESSORY";

  const materialForCategory = {
    body: materials.skin,
    head: materials.skin,
    hair: materials.hair,
    top: materials.top,
    bottom: materials.bottom,
    shoes: materials.shoes,
    accessory: materials.accessory,
  };

  for (const [category, nodes] of Object.entries(AVATAR_MANIFEST.nodes)) {
    for (const nodeName of Object.values(nodes)) {
      const node = new THREE.Mesh(
        sharedGeometry,
        materialForCategory[category as keyof typeof materialForCategory],
      );
      node.name = nodeName;
      root.add(node);
    }
  }

  return { root, sharedGeometry, materials };
}

describe("configureAvatarScene", () => {
  it("shows exactly the selected node in every category", () => {
    const { root } = createAvatarFixture();
    const configured = createConfiguredAvatarScene(root, {
      ...DEFAULT_AVATAR_APPEARANCE,
      hair: "hair02",
      top: "top03",
      accessory: "glasses01",
    });

    expect(configured.scene.getObjectByName("Hair_hair02")?.visible).toBe(true);
    expect(configured.scene.getObjectByName("Hair_hair01")?.visible).toBe(false);
    expect(configured.scene.getObjectByName("Top_top03")?.visible).toBe(true);
    expect(configured.scene.getObjectByName("Accessory_glasses01")?.visible).toBe(true);
    expect(configured.scene.getObjectByName("Accessory_hat01")?.visible).toBe(false);
  });

  it("shares geometry while isolating recolored materials from the source", () => {
    const { root, sharedGeometry, materials } = createAvatarFixture();
    const configured = createConfiguredAvatarScene(root, {
      ...DEFAULT_AVATAR_APPEARANCE,
      colors: {
        ...DEFAULT_AVATAR_APPEARANCE.colors,
        skin: "skin05",
        top: "rose",
      },
    });
    const body = configured.scene.getObjectByName("Body_body01") as THREE.Mesh;

    expect(body.geometry).toBe(sharedGeometry);
    expect(body.material).not.toBe(materials.skin);
    expect((body.material as THREE.MeshStandardMaterial).color.getHexString()).toBe(
      "5f3c2d",
    );
    expect(materials.skin.color.getHexString()).toBe("ffffff");
  });

  it("warns for missing manifest nodes without throwing", () => {
    const warn = vi.fn();
    const configured = createConfiguredAvatarScene(
      new THREE.Group(),
      DEFAULT_AVATAR_APPEARANCE,
      { warn },
    );

    expect(configured.missingNodes.length).toBeGreaterThan(0);
    expect(warn).toHaveBeenCalled();
  });

  it("disposes only the materials owned by the configured clone", () => {
    const { root, materials } = createAvatarFixture();
    const sourceDispose = vi.spyOn(materials.skin, "dispose");
    const configured = createConfiguredAvatarScene(root, DEFAULT_AVATAR_APPEARANCE);
    const ownedDispose = vi.spyOn(configured.ownedMaterials[0], "dispose");

    disposeConfiguredAvatarScene(configured);

    expect(ownedDispose).toHaveBeenCalledOnce();
    expect(sourceDispose).not.toHaveBeenCalled();
  });
});
