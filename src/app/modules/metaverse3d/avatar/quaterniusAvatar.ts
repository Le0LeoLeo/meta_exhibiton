import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import type { AvatarAppearanceV1 } from "./avatarAppearance";
import { AVATAR_MANIFEST } from "./avatarManifest";

const ASSET_ROOT = "/models/avatars/quaternius-v1";

export const QUATERNIUS_AVATAR_ASSETS = {
  bodies: {
    body01: `${ASSET_ROOT}/body01.glb`,
    body02: `${ASSET_ROOT}/body02.glb`,
  },
  hair: {
    hair01: `${ASSET_ROOT}/hair01.glb`,
    hair02: `${ASSET_ROOT}/hair02.glb`,
    hair03: `${ASSET_ROOT}/hair03.glb`,
  },
  animations: `${ASSET_ROOT}/animations.glb`,
} as const;

export type ConfiguredQuaterniusAvatar = {
  scene: THREE.Group;
  ownedMaterials: THREE.Material[];
  ownedGeometries: THREE.BufferGeometry[];
};

type ShaderSource = {
  uniforms: Record<string, { value: unknown }>;
  vertexShader: string;
  fragmentShader: string;
};

function targetColor(
  category: keyof AvatarAppearanceV1["colors"],
  appearance: AvatarAppearanceV1,
) {
  return new THREE.Color(
    AVATAR_MANIFEST.colors[category][appearance.colors[category]],
  );
}

function configureBodyMaterial(
  source: THREE.MeshStandardMaterial,
  appearance: AvatarAppearanceV1,
) {
  const material = source.clone();
  material.map = null;
  material.color.copy(targetColor("skin", appearance));
  material.roughness = 0.76;
  material.metalness = 0;
  material.customProgramCacheKey = () => [
    "quaternius-avatar-skin-v2",
    appearance.colors.skin,
  ].join(":");
  material.needsUpdate = true;
  return material;
}

function configureHairMaterial(
  source: THREE.MeshStandardMaterial,
  appearance: AvatarAppearanceV1,
) {
  const material = source.clone();
  material.map = null;
  material.color.copy(targetColor("hair", appearance));
  material.roughness = 0.72;
  material.metalness = 0;
  material.needsUpdate = true;
  return material;
}

type GarmentLayer = "top" | "bottom" | "shoes";

function garmentClipExpression(
  layer: GarmentLayer,
  appearance: AvatarAppearanceV1,
) {
  if (layer === "top") {
    if (appearance.top === "top01") {
      return "((abs(vAvatarBindPosition.x) < 0.43 && vAvatarBindPosition.y > 0.82 && vAvatarBindPosition.y < 1.43 + 0.24 * abs(vAvatarBindPosition.x)) || (abs(vAvatarBindPosition.x) >= 0.38 && abs(vAvatarBindPosition.x) < 0.67 && vAvatarBindPosition.y > 1.34 && vAvatarBindPosition.y < 1.6))";
    }
    if (appearance.top === "top02") {
      return "((abs(vAvatarBindPosition.x) < 0.43 && vAvatarBindPosition.y > 0.82 && vAvatarBindPosition.y < 1.43 + 0.24 * abs(vAvatarBindPosition.x)) || (abs(vAvatarBindPosition.x) >= 0.38 && abs(vAvatarBindPosition.x) < 0.67 && vAvatarBindPosition.y > 0.86 && vAvatarBindPosition.y < 1.48))";
    }
    return "((abs(vAvatarBindPosition.x) < 0.44 && vAvatarBindPosition.y > 0.8 && vAvatarBindPosition.y < 1.46 + 0.2 * abs(vAvatarBindPosition.x)) || (abs(vAvatarBindPosition.x) >= 0.38 && abs(vAvatarBindPosition.x) < 0.67 && vAvatarBindPosition.y > 0.86 && vAvatarBindPosition.y < 1.5))";
  }
  if (layer === "bottom") {
    if (appearance.bottom === "bottom02") {
      return "abs(vAvatarBindPosition.x) < 0.44 && vAvatarBindPosition.y > 0.58 && vAvatarBindPosition.y < 0.94";
    }
    return "abs(vAvatarBindPosition.x) < 0.44 && vAvatarBindPosition.y > 0.17 && vAvatarBindPosition.y < 0.94";
  }
  const maximumY = appearance.shoes === "shoes02" ? "0.26" : "0.19";
  return `abs(vAvatarBindPosition.x) < 0.38 && vAvatarBindPosition.y < ${maximumY}`;
}

function createGarmentMaterial(
  layer: GarmentLayer,
  appearance: AvatarAppearanceV1,
  handBoneIndices: [number, number],
) {
  const material = new THREE.MeshStandardMaterial({
    color: targetColor(layer, appearance),
    roughness:
      layer === "shoes"
        ? appearance.shoes === "shoes02" ? 0.4 : 0.66
        : layer === "top" && appearance.top === "top03" ? 0.54 : 0.8,
    metalness: layer === "shoes" && appearance.shoes === "shoes02" ? 0.04 : 0,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  if (layer === "bottom" && appearance.bottom === "bottom03") {
    material.color.multiplyScalar(1.15);
  }
  if (layer === "top" && appearance.top === "top03") {
    material.color.multiplyScalar(0.78);
  }
  const clipExpression = garmentClipExpression(layer, appearance);
  const handWeightVertex = layer === "top"
    ? [
        "vAvatarHandWeight = 0.0;",
        `vAvatarHandWeight += (skinIndex.x == ${handBoneIndices[0]}.0 || skinIndex.x == ${handBoneIndices[1]}.0) ? skinWeight.x : 0.0;`,
        `vAvatarHandWeight += (skinIndex.y == ${handBoneIndices[0]}.0 || skinIndex.y == ${handBoneIndices[1]}.0) ? skinWeight.y : 0.0;`,
        `vAvatarHandWeight += (skinIndex.z == ${handBoneIndices[0]}.0 || skinIndex.z == ${handBoneIndices[1]}.0) ? skinWeight.z : 0.0;`,
        `vAvatarHandWeight += (skinIndex.w == ${handBoneIndices[0]}.0 || skinIndex.w == ${handBoneIndices[1]}.0) ? skinWeight.w : 0.0;`,
      ].join("\n")
    : "vAvatarHandWeight = 0.0;";
  material.onBeforeCompile = (shader) => {
    const sourceShader = shader as unknown as ShaderSource;
    sourceShader.vertexShader = sourceShader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vAvatarBindPosition;\nvarying float vAvatarHandWeight;",
      )
      .replace(
        "#include <begin_vertex>",
        [
          "#include <begin_vertex>",
          "vAvatarBindPosition = position;",
          handWeightVertex,
        ].join("\n"),
      );
    sourceShader.fragmentShader = sourceShader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vAvatarBindPosition;\nvarying float vAvatarHandWeight;",
      )
      .replace(
        "#include <clipping_planes_fragment>",
        [
          "#include <clipping_planes_fragment>",
          `if (!(${clipExpression}) || vAvatarHandWeight > 0.22) discard;`,
        ].join("\n"),
      );
  };
  material.customProgramCacheKey = () =>
    [
      "quaternius-garment-v2",
      layer,
      clipExpression,
      ...handBoneIndices,
    ].join(":");
  material.needsUpdate = true;
  return material;
}

type AvatarAccessoryResources = {
  object: THREE.Group;
  materials: THREE.Material[];
  geometries: THREE.BufferGeometry[];
};

function addAccessoryMesh(
  group: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  name: string,
  position: [number, number, number],
) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  group.add(mesh);
  return mesh;
}

export function createAvatarAccessory(
  appearance: AvatarAppearanceV1,
): AvatarAccessoryResources {
  const object = new THREE.Group();
  object.name = AVATAR_MANIFEST.nodes.accessory[appearance.accessory];
  const materials: THREE.Material[] = [];
  const geometries: THREE.BufferGeometry[] = [];

  if (appearance.accessory === "glasses01") {
    const frame = new THREE.MeshStandardMaterial({
      color: "#25272c",
      roughness: 0.34,
      metalness: 0.18,
    });
    materials.push(frame);
    const leftGeometry = new THREE.TorusGeometry(0.02, 0.0035, 8, 20);
    const rightGeometry = leftGeometry.clone();
    const bridgeGeometry = new THREE.BoxGeometry(0.012, 0.004, 0.004);
    const leftTempleGeometry = new THREE.BoxGeometry(0.055, 0.004, 0.004);
    const rightTempleGeometry = leftTempleGeometry.clone();
    geometries.push(
      leftGeometry,
      rightGeometry,
      bridgeGeometry,
      leftTempleGeometry,
      rightTempleGeometry,
    );
    addAccessoryMesh(
      object,
      leftGeometry,
      frame,
      "GlassesLeft",
      [-0.024, 0.105, 0.13],
    );
    addAccessoryMesh(
      object,
      rightGeometry,
      frame,
      "GlassesRight",
      [0.024, 0.105, 0.13],
    );
    addAccessoryMesh(
      object,
      bridgeGeometry,
      frame,
      "GlassesBridge",
      [0, 0.105, 0.13],
    );
    const leftTemple = addAccessoryMesh(
      object,
      leftTempleGeometry,
      frame,
      "GlassesTempleLeft",
      [-0.042, 0.108, 0.095],
    );
    leftTemple.rotation.y = Math.PI / 2;
    const rightTemple = addAccessoryMesh(
      object,
      rightTempleGeometry,
      frame,
      "GlassesTempleRight",
      [0.042, 0.108, 0.095],
    );
    rightTemple.rotation.y = Math.PI / 2;
  }

  if (appearance.accessory === "hat01") {
    const fabric = new THREE.MeshStandardMaterial({
      color: targetColor("top", appearance),
      roughness: 0.82,
      metalness: 0,
    });
    const bandMaterial = fabric.clone();
    bandMaterial.color.multiplyScalar(0.72);
    materials.push(fabric, bandMaterial);
    const crownGeometry = new THREE.SphereGeometry(
      0.13,
      24,
      12,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2,
    );
    const bandGeometry = new THREE.TorusGeometry(0.12, 0.012, 8, 24);
    geometries.push(crownGeometry, bandGeometry);
    addAccessoryMesh(
      object,
      crownGeometry,
      fabric,
      "HatCrown",
      [0, 0.13, 0],
    );
    const band = addAccessoryMesh(
      object,
      bandGeometry,
      bandMaterial,
      "HatBand",
      [0, 0.13, 0],
    );
    band.rotation.x = Math.PI / 2;
  }

  return { object, materials, geometries };
}

function addGarmentLayers(
  body: THREE.Object3D,
  appearance: AvatarAppearanceV1,
  castShadow: boolean,
  ownedMaterials: THREE.Material[],
) {
  const bodyMeshes: THREE.SkinnedMesh[] = [];
  body.traverse((object) => {
    if (!(object instanceof THREE.SkinnedMesh)) return;
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    if (
      materials.some((material) =>
        material.name.startsWith("MI_Superhero")
      )
    ) {
      bodyMeshes.push(object);
    }
  });

  for (const source of bodyMeshes) {
    const handBoneIndices: [number, number] = [
      source.skeleton.bones.findIndex((bone) => bone.name === "hand_l"),
      source.skeleton.bones.findIndex((bone) => bone.name === "hand_r"),
    ];
    for (const layer of ["top", "bottom", "shoes"] as const) {
      const material = createGarmentMaterial(
        layer,
        appearance,
        handBoneIndices,
      );
      const mesh = new THREE.SkinnedMesh(source.geometry, material);
      mesh.name = `AvatarGarment_${layer}`;
      mesh.position.copy(source.position);
      mesh.quaternion.copy(source.quaternion);
      mesh.scale.copy(source.scale).multiplyScalar(1.006);
      mesh.bind(source.skeleton, source.bindMatrix.clone());
      mesh.castShadow = castShadow;
      mesh.renderOrder = source.renderOrder + 1;
      source.parent?.add(mesh);
      ownedMaterials.push(material);
    }
  }
}

export function createQuaterniusAvatarScene(
  bodySource: THREE.Object3D,
  hairSource: THREE.Object3D,
  appearance: AvatarAppearanceV1,
  castShadow = true,
): ConfiguredQuaterniusAvatar {
  const scene = new THREE.Group();
  scene.name = "QuaterniusAvatar";
  const body = SkeletonUtils.clone(bodySource);
  const hair = hairSource.clone(true);
  const ownedMaterials: THREE.Material[] = [];
  const ownedGeometries: THREE.BufferGeometry[] = [];
  const materialClones = new Map<THREE.Material, THREE.Material>();

  body.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = castShadow;
    const sourceMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    const materials = sourceMaterials.map((source) => {
      const cached = materialClones.get(source);
      if (cached) return cached;
      const material =
        source instanceof THREE.MeshStandardMaterial &&
        source.name.startsWith("MI_Superhero")
          ? configureBodyMaterial(source, appearance)
          : source instanceof THREE.MeshStandardMaterial &&
              source.name.startsWith("MI_Hair")
            ? configureHairMaterial(source, appearance)
            : source.clone();
      materialClones.set(source, material);
      ownedMaterials.push(material);
      return material;
    });
    object.material = Array.isArray(object.material) ? materials : materials[0];
  });

  hair.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = castShadow;
    const sourceMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    const materials = sourceMaterials.map((source) => {
      const material =
        source instanceof THREE.MeshStandardMaterial
          ? configureHairMaterial(source, appearance)
          : source.clone();
      ownedMaterials.push(material);
      return material;
    });
    object.material = Array.isArray(object.material) ? materials : materials[0];
  });

  scene.add(body, hair);
  addGarmentLayers(
    body,
    appearance,
    castShadow,
    ownedMaterials,
  );
  scene.updateMatrixWorld(true);
  const head = body.getObjectByName("Head");
  if (head) {
    head.attach(hair);
    if (appearance.head === "head02") {
      head.scale.set(1.045, 0.975, 1.025);
    }
    const accessory = createAvatarAccessory(appearance);
    head.add(accessory.object);
    ownedMaterials.push(...accessory.materials);
    ownedGeometries.push(...accessory.geometries);
  }

  return { scene, ownedMaterials, ownedGeometries };
}

export function disposeQuaterniusAvatarScene(
  configured: ConfiguredQuaterniusAvatar,
) {
  configured.ownedMaterials.forEach((material) => material.dispose());
  configured.ownedGeometries.forEach((geometry) => geometry.dispose());
}
