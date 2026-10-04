import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { DEFAULT_AVATAR_APPEARANCE } from "./avatarAppearance";
import { resolveAvatarFacialTransforms } from "./avatarFacialPlacement";
import {
  AVATAR_HEAD_SCALE,
  AVATAR_SHOE_HEIGHT,
  applyAvatarFacialFeatureMaterial,
  applyAvatarShirtPhotoMaterial,
  centerCropAvatarPhotoTexture,
  createCasualAvatarScene,
  disposeCasualAvatarScene,
  replaceCasualAvatarHairGeometry,
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
  it("preserves the authored facial transforms for neutral placement", () => {
    const neutral = resolveAvatarFacialTransforms(DEFAULT_AVATAR_APPEARANCE);

    expect(neutral.eyes.left.position).toEqual([-0.17, 2.55, 0.545]);
    expect(neutral.eyes.right.position).toEqual([0.17, 2.55, 0.545]);
    expect(neutral.eyebrows.left.position).toEqual([-0.17, 2.655, 0.545]);
    expect(neutral.eyebrows.right.position).toEqual([0.17, 2.655, 0.545]);
    expect(neutral.mouth.position).toEqual([0, 2.41, 0.57]);
  });

  it("resolves symmetrical placement while preserving style transforms", () => {
    const transforms = resolveAvatarFacialTransforms({
      ...DEFAULT_AVATAR_APPEARANCE,
      eyes: "eyes02",
      eyebrows: "eyebrows03",
      mouth: "mouth03",
      facialPlacement: {
        eyes: { offsetY: 0.1, spacing: 0.08, scale: 1.2 },
        eyebrows: { offsetY: 0.05, spacing: 0.04, rotation: 0.1 },
        mouth: { offsetX: 0.1, offsetY: -0.05, scaleX: 1.3, scaleY: 0.8 },
      },
    });

    expect(transforms.eyes.left.position).toEqual([-0.25, 2.65, 0.545]);
    expect(transforms.eyes.right.position).toEqual([0.25, 2.65, 0.545]);
    expect(transforms.eyes.left.scale).toEqual([0.0732, 0.0408, 0.024]);
    expect(transforms.eyes.right.scale).toEqual([0.0732, 0.0408, 0.024]);
    expect(transforms.eyebrows.left.position[0]).toBeCloseTo(-0.21);
    expect(transforms.eyebrows.left.position[1]).toBeCloseTo(2.705);
    expect(transforms.eyebrows.right.position[0]).toBeCloseTo(0.21);
    expect(transforms.eyebrows.right.position[1]).toBeCloseTo(2.705);
    expect(transforms.eyebrows.left.rotationZ).toBeCloseTo(-0.26);
    expect(transforms.eyebrows.right.rotationZ).toBeCloseTo(0.26);
    expect(transforms.mouth.position[0]).toBeCloseTo(0.1);
    expect(transforms.mouth.position[1]).toBeCloseTo(2.355);
    expect(transforms.mouth.scale[0]).toBeCloseTo(1.3);
    expect(transforms.mouth.scale[1]).toBeCloseTo(0.624);
  });

  it("center-crops landscape shirt photos without stretching them", () => {
    const texture = new THREE.Texture();
    texture.image = { width: 1600, height: 900 };

    centerCropAvatarPhotoTexture(texture);

    expect(texture.repeat.toArray()).toEqual([0.5625, 1]);
    expect(texture.offset.toArray()).toEqual([0.21875, 0]);
    expect(texture.version).toBe(1);
  });

  it("projects shirt photos into the skinned shirt material", () => {
    const material = new THREE.MeshStandardMaterial();
    const texture = new THREE.Texture();
    const shader = {
      uniforms: {},
      vertexShader: "#include <common>\n#include <begin_vertex>",
      fragmentShader: "#include <common>\n#include <map_fragment>",
    };

    applyAvatarShirtPhotoMaterial(material, texture);
    material.onBeforeCompile(
      shader as Parameters<THREE.Material["onBeforeCompile"]>[0],
      {} as THREE.WebGLRenderer,
    );

    expect(shader.uniforms).toMatchObject({
      shirtPhotoMap: { value: texture },
      shirtPhotoMatrix: { value: texture.matrix },
    });
    expect(shader.vertexShader).toContain("vShirtPhotoPosition = position");
    expect(shader.fragmentShader).toContain("shirtPhotoFacing");
    expect(shader.fragmentShader).toContain("diffuseColor.rgb = mix");
  });

  it("does not add a floating photo plane to the avatar", () => {
    const loadSpy = vi.spyOn(THREE.TextureLoader.prototype, "load")
      .mockReturnValue(new THREE.Texture());
    const { source } = createSource();
    const configured = createCasualAvatarScene(source, {
      ...DEFAULT_AVATAR_APPEARANCE,
      topPhotoUrl: "/api/media/123e4567-e89b-42d3-a456-426614174000",
    });

    expect(configured.scene.getObjectByName("ShirtPhoto")).toBeFalsy();
    expect(
      configured.ownedGeometries.some(
        (geometry) => geometry instanceof THREE.PlaneGeometry,
      ),
    ).toBe(false);
    expect(configured.ownedTextures).toHaveLength(1);
    loadSpy.mockRestore();
  });

  it("clones and recolors the complete source character", () => {
    const { source } = createSource();
    const configured = createCasualAvatarScene(
      source,
      DEFAULT_AVATAR_APPEARANCE,
    );
    let avatarMesh: THREE.Mesh | undefined;
    configured.scene.traverse((object) => {
      if (object instanceof THREE.Mesh && Array.isArray(object.material)) {
        avatarMesh = object;
      }
    });
    const materials = avatarMesh?.material as THREE.Material[];
    const shirt = materials.find((material) => material.name === "Shirt");
    const originalFace = materials.find((material) => material.name === "Face");

    expect(configured.scene).not.toBe(source);
    expect(configured.scene.scale.x).toBeCloseTo(0.529);
    expect((shirt as THREE.MeshStandardMaterial).color.getHexString())
      .toBe("334c73");
    expect(originalFace?.visible).toBe(false);
    expect(configured.scene.getObjectByName("FacialFeatures")).toBeFalsy();
  });

  it.each([
    ["top01", 1],
    ["top02", 0.82],
    ["top03", 1.12],
  ] as const)(
    "applies the custom shirt color to %s without mutating the shared source material",
    (top, brightness) => {
      const { source, materials: sourceMaterials } = createSource();
      const sourceShirt = sourceMaterials.find(
        (material) => material.name === "Shirt",
      ) as THREE.MeshStandardMaterial;
      sourceShirt.color.set("#f0e0d0");
      const configured = createCasualAvatarScene(source, {
        ...DEFAULT_AVATAR_APPEARANCE,
        top,
        colors: {
          ...DEFAULT_AVATAR_APPEARANCE.colors,
          topCustom: "#3A7BD5",
        },
      });
      let configuredShirt: THREE.MeshStandardMaterial | undefined;
      configured.scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        configuredShirt = materials.find(
          (material) => material.name === "Shirt",
        ) as THREE.MeshStandardMaterial | undefined;
      });
      const expected = new THREE.Color("#3A7BD5").multiplyScalar(brightness);

      expect(configuredShirt).not.toBe(sourceShirt);
      expect(configuredShirt?.color.getHexString())
        .toBe(expected.getHexString());
      expect(sourceShirt.color.getHexString()).toBe("f0e0d0");
    },
  );

  it("keeps the custom shirt color underneath a photo overlay", () => {
    const loadSpy = vi.spyOn(THREE.TextureLoader.prototype, "load")
      .mockReturnValue(new THREE.Texture());
    const { source } = createSource();
    const configured = createCasualAvatarScene(source, {
      ...DEFAULT_AVATAR_APPEARANCE,
      topPhotoUrl: "/api/media/123e4567-e89b-42d3-a456-426614174000",
      colors: {
        ...DEFAULT_AVATAR_APPEARANCE.colors,
        topCustom: "#3A7BD5",
      },
    });
    let shirt: THREE.MeshStandardMaterial | undefined;
    configured.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      shirt = materials.find(
        (material) => material.name === "Shirt",
      ) as THREE.MeshStandardMaterial | undefined;
    });

    expect(shirt?.color.getHexString()).toBe("3a7bd5");
    expect(shirt?.customProgramCacheKey())
      .toBe("avatar-shirt-photo-surface-v1");
    loadSpy.mockRestore();
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

  it("replaces only hair geometry while preserving the base outfit", () => {
    const source = new THREE.Group();
    const shirtGeometry = new THREE.BoxGeometry(1);
    const shirtMaterial = new THREE.MeshStandardMaterial();
    shirtMaterial.name = "Shirt";
    const shirt = new THREE.Mesh(shirtGeometry, shirtMaterial);
    source.add(shirt);
    const baseHairGeometry = new THREE.BoxGeometry(1);
    const baseHairMaterial = new THREE.MeshStandardMaterial();
    baseHairMaterial.name = "Hair";
    const baseHair = new THREE.Mesh(baseHairGeometry, baseHairMaterial);
    source.add(baseHair);
    const selectedHairGeometry = new THREE.SphereGeometry(2);
    const hairSource = new THREE.Group();
    const hairMaterial = new THREE.MeshStandardMaterial();
    hairMaterial.name = "Hair";
    hairSource.add(new THREE.Mesh(selectedHairGeometry, hairMaterial));

    const replaced = replaceCasualAvatarHairGeometry(source, hairSource);

    expect(replaced).toBe(true);
    expect(baseHair.geometry).toBe(selectedHairGeometry);
    expect(shirt.geometry).toBe(shirtGeometry);
  });

  it("keeps male body scale stable when the hairstyle changes", () => {
    const { source } = createSource();
    const configured = createCasualAvatarScene(source, {
      ...DEFAULT_AVATAR_APPEARANCE,
      hair: "hair03",
    });

    expect(configured.scene.scale.x).toBeCloseTo(0.529);
  });

  it("gives the two face options visibly distinct head proportions", () => {
    const { source } = createSource();
    const rounded = createCasualAvatarScene(source, {
      ...DEFAULT_AVATAR_APPEARANCE,
      head: "head01",
    });
    const elongated = createCasualAvatarScene(source, {
      ...DEFAULT_AVATAR_APPEARANCE,
      head: "head02",
    });

    const roundedHead = rounded.scene.getObjectByName("Head");
    const elongatedHead = elongated.scene.getObjectByName("Head");

    expect(roundedHead?.scale.toArray()).toEqual([...AVATAR_HEAD_SCALE.head01]);
    expect(elongatedHead?.scale.toArray()).toEqual([...AVATAR_HEAD_SCALE.head02]);
    expect((elongatedHead?.scale.y ?? 0) - (elongatedHead?.scale.x ?? 0))
      .toBeGreaterThan(0.15);
  });

  it("projects distinct eye, eyebrow, and mouth styles into the skin", () => {
    const appearance = {
      ...DEFAULT_AVATAR_APPEARANCE,
      eyes: "eyes02",
      eyebrows: "eyebrows03",
      mouth: "mouth03",
    } as const;
    const material = new THREE.MeshStandardMaterial();
    const shader = {
      uniforms: {},
      vertexShader: "#include <common>\n#include <begin_vertex>",
      fragmentShader: "#include <common>\n#include <map_fragment>",
    };

    applyAvatarFacialFeatureMaterial(material, appearance);
    material.onBeforeCompile(
      shader as Parameters<THREE.Material["onBeforeCompile"]>[0],
      {} as THREE.WebGLRenderer,
    );

    expect(shader.uniforms).toMatchObject({
      avatarBrowStyle: { value: 0 },
      avatarMouthStyle: { value: 2 },
    });
    const eyeLeft = shader.uniforms.avatarEyeLeft.value as THREE.Vector4;
    const eyeRight = shader.uniforms.avatarEyeRight.value as THREE.Vector4;
    const mouth = shader.uniforms.avatarMouth.value as THREE.Vector4;
    expect((eyeLeft.x + eyeRight.x) / 2).toBe(0);
    expect(mouth.x).toBe(0);
    expect(shader.fragmentShader).toContain("avatarOpenMouth");
    expect(shader.fragmentShader).toContain("avatarFaceFacing");
  });

  it("applies non-neutral facial placement to the skin shader", () => {
    const appearance = {
      ...DEFAULT_AVATAR_APPEARANCE,
      eyes: "eyes02" as const,
      eyebrows: "eyebrows03" as const,
      mouth: "mouth03" as const,
      facialPlacement: {
        eyes: { offsetY: 0.05, spacing: 0.04, scale: 1.2 },
        eyebrows: { offsetY: 0.03, spacing: 0.02, rotation: 0.1 },
        mouth: { offsetX: 0.06, offsetY: -0.04, scaleX: 1.25, scaleY: 0.8 },
      },
    };
    const expected = resolveAvatarFacialTransforms(appearance);
    const material = new THREE.MeshStandardMaterial();
    const shader = {
      uniforms: {},
      vertexShader: "#include <common>\n#include <begin_vertex>",
      fragmentShader: "#include <common>\n#include <map_fragment>",
    };

    applyAvatarFacialFeatureMaterial(material, appearance);
    material.onBeforeCompile(
      shader as Parameters<THREE.Material["onBeforeCompile"]>[0],
      {} as THREE.WebGLRenderer,
    );

    const eyeLeft = shader.uniforms.avatarEyeLeft.value as THREE.Vector4;
    const browRotation =
      shader.uniforms.avatarBrowRotation.value as THREE.Vector2;
    const mouth = shader.uniforms.avatarMouth.value as THREE.Vector4;
    expect(eyeLeft.toArray()).toEqual([
      expected.eyes.left.position[0],
      expected.eyes.left.position[1],
      expected.eyes.left.scale[0],
      expected.eyes.left.scale[1],
    ]);
    expect(browRotation.toArray()).toEqual([
      expected.eyebrows.left.rotationZ,
      expected.eyebrows.right.rotationZ,
    ]);
    expect(mouth.toArray()).toEqual([
      expected.mouth.position[0],
      expected.mouth.position[1],
      expected.mouth.scale[0],
      expected.mouth.scale[1],
    ]);
  });

  it("renders both footwear styles directly on the animated skin", () => {
    const createShader = (shoes: "shoes01" | "shoes02") => {
      const material = new THREE.MeshStandardMaterial();
      const shader = {
        uniforms: {},
        vertexShader: "#include <common>\n#include <begin_vertex>",
        fragmentShader: "#include <common>\n#include <map_fragment>",
      };
      applyAvatarFacialFeatureMaterial(material, {
        ...DEFAULT_AVATAR_APPEARANCE,
        shoes,
      });
      material.onBeforeCompile(
        shader as Parameters<THREE.Material["onBeforeCompile"]>[0],
        {} as THREE.WebGLRenderer,
      );
      return shader;
    };

    const lowShoes = createShader("shoes01");
    const highTopShoes = createShader("shoes02");

    expect(lowShoes.uniforms).toMatchObject({
      avatarShoeHeight: { value: AVATAR_SHOE_HEIGHT.shoes01 },
      avatarShoeStyle: { value: 0 },
    });
    expect(highTopShoes.uniforms).toMatchObject({
      avatarShoeHeight: { value: AVATAR_SHOE_HEIGHT.shoes02 },
      avatarShoeStyle: { value: 1 },
    });
    expect(highTopShoes.fragmentShader).toContain("avatarSneakerBand");
    expect(highTopShoes.fragmentShader).toContain("avatarSoleMask");
  });

  it("adds real skinned shoe geometry for both feet", () => {
    const { source } = createSource();
    const leftLeg = new THREE.Bone();
    leftLeg.name = "LowerLegL";
    source.add(leftLeg);
    const rightLeg = new THREE.Bone();
    rightLeg.name = "LowerLegR";
    source.add(rightLeg);
    const skinGeometry = new THREE.BufferGeometry();
    skinGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([
        0.3, 0.06, 0.04,
        -0.3, 0.06, 0.04,
        0.3, 0.12, 0.04,
      ], 3),
    );
    skinGeometry.setAttribute(
      "skinIndex",
      new THREE.Uint16BufferAttribute([
        0, 0, 0, 0,
        1, 0, 0, 0,
        0, 0, 0, 0,
      ], 4),
    );
    skinGeometry.setAttribute(
      "skinWeight",
      new THREE.Float32BufferAttribute([
        1, 0, 0, 0,
        1, 0, 0, 0,
        1, 0, 0, 0,
      ], 4),
    );
    const skinMaterial = new THREE.MeshStandardMaterial();
    skinMaterial.name = "Skin";
    const skin = new THREE.SkinnedMesh(skinGeometry, skinMaterial);
    skin.bind(new THREE.Skeleton([leftLeg, rightLeg]));
    source.add(skin);

    const lowShoes = createCasualAvatarScene(source, {
      ...DEFAULT_AVATAR_APPEARANCE,
      shoes: "shoes01",
    });
    const highTopShoes = createCasualAvatarScene(source, {
      ...DEFAULT_AVATAR_APPEARANCE,
      shoes: "shoes02",
    });

    expect(
      lowShoes.scene.getObjectByName("Footwear_shoes01"),
    ).toBeTruthy();
    expect(
      lowShoes.scene.getObjectByName("ShoeRightSole"),
    ).toBeTruthy();
    expect(
      highTopShoes.scene.getObjectByName("ShoeLeftCollar"),
    ).toBeTruthy();
    expect(
      highTopShoes.scene.getObjectByName("ShoeRightLace2"),
    ).toBeTruthy();
    expect(
      highTopShoes.scene.getObjectByName("ShoeLeftUpper"),
    ).toBeInstanceOf(THREE.SkinnedMesh);
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
