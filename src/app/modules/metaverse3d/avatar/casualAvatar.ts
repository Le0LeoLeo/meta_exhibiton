import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import type { AvatarAppearanceV1 } from "./avatarAppearance";
import { AVATAR_MANIFEST } from "./avatarManifest";

const ASSET_ROOT = "/models/avatars/casual-v1";

export const CASUAL_AVATAR_ASSETS = {
  body01: {
    hair01: `${ASSET_ROOT}/casual1-male.glb`,
    hair02: `${ASSET_ROOT}/casual2-male.glb`,
    hair03: `${ASSET_ROOT}/casual3-male.glb`,
  },
  body02: {
    hair01: `${ASSET_ROOT}/casual1-female.glb`,
    hair02: `${ASSET_ROOT}/casual2-female.glb`,
    hair03: `${ASSET_ROOT}/casual3-female.glb`,
  },
} as const;

export type ConfiguredCasualAvatar = {
  scene: THREE.Group;
  ownedMaterials: THREE.Material[];
  ownedGeometries: THREE.BufferGeometry[];
};

function targetColor(
  category: keyof AvatarAppearanceV1["colors"],
  appearance: AvatarAppearanceV1,
) {
  return new THREE.Color(
    AVATAR_MANIFEST.colors[category][appearance.colors[category]],
  );
}

function configureMaterial(
  source: THREE.Material,
  appearance: AvatarAppearanceV1,
) {
  const material = source.clone();
  if (!(material instanceof THREE.MeshStandardMaterial)) return material;

  material.map = null;
  material.metalness = 0;
  if (material.name === "Skin") {
    material.color.copy(targetColor("skin", appearance));
    material.roughness = 0.76;
  } else if (material.name === "Hair") {
    material.color.copy(targetColor("hair", appearance));
    material.roughness = 0.72;
  } else if (material.name === "Shirt") {
    material.color.copy(targetColor("top", appearance));
    material.roughness = appearance.top === "top03" ? 0.55 : 0.82;
    if (appearance.top === "top02") material.color.multiplyScalar(0.82);
    if (appearance.top === "top03") material.color.multiplyScalar(1.12);
  } else if (material.name === "Pants") {
    material.color.copy(targetColor("bottom", appearance));
    material.roughness = appearance.bottom === "bottom03" ? 0.58 : 0.86;
    if (appearance.bottom === "bottom02") material.color.multiplyScalar(0.78);
    if (appearance.bottom === "bottom03") material.color.multiplyScalar(1.12);
  } else if (material.name === "Belt") {
    material.color.copy(targetColor("shoes", appearance));
    material.roughness = appearance.shoes === "shoes02" ? 0.45 : 0.72;
  }
  material.needsUpdate = true;
  return material;
}

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

function createAccessory(
  appearance: AvatarAppearanceV1,
): {
  object: THREE.Group;
  materials: THREE.Material[];
  geometries: THREE.BufferGeometry[];
} {
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
    const leftGeometry = new THREE.TorusGeometry(0.075, 0.009, 8, 20);
    const rightGeometry = leftGeometry.clone();
    const bridgeGeometry = new THREE.BoxGeometry(0.045, 0.01, 0.01);
    geometries.push(leftGeometry, rightGeometry, bridgeGeometry);
    addAccessoryMesh(
      object,
      leftGeometry,
      frame,
      "GlassesLeft",
      [-0.09, 0, 0],
    );
    addAccessoryMesh(
      object,
      rightGeometry,
      frame,
      "GlassesRight",
      [0.09, 0, 0],
    );
    addAccessoryMesh(
      object,
      bridgeGeometry,
      frame,
      "GlassesBridge",
      [0, 0, 0],
    );
  } else if (appearance.accessory === "hat01") {
    const fabric = new THREE.MeshStandardMaterial({
      color: targetColor("top", appearance),
      roughness: 0.84,
    });
    materials.push(fabric);
    const crownGeometry = new THREE.SphereGeometry(
      0.44,
      24,
      12,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2,
    );
    const brimGeometry = new THREE.CylinderGeometry(0.46, 0.46, 0.04, 24);
    geometries.push(crownGeometry, brimGeometry);
    addAccessoryMesh(
      object,
      crownGeometry,
      fabric,
      "HatCrown",
      [0, 0, 0],
    );
    addAccessoryMesh(
      object,
      brimGeometry,
      fabric,
      "HatBrim",
      [0, -0.01, -0.045],
    );
  }
  return { object, materials, geometries };
}

export function createCasualAvatarScene(
  source: THREE.Object3D,
  appearance: AvatarAppearanceV1,
  castShadow = true,
): ConfiguredCasualAvatar {
  const scene = SkeletonUtils.clone(source) as THREE.Group;
  scene.name = "CasualAvatar";
  const ownedMaterials: THREE.Material[] = [];
  const ownedGeometries: THREE.BufferGeometry[] = [];
  const materialClones = new Map<THREE.Material, THREE.Material>();

  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = castShadow;
    const sourceMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    const materials = sourceMaterials.map((sourceMaterial) => {
      const cached = materialClones.get(sourceMaterial);
      if (cached) return cached;
      const material = configureMaterial(sourceMaterial, appearance);
      materialClones.set(sourceMaterial, material);
      ownedMaterials.push(material);
      return material;
    });
    object.material = Array.isArray(object.material) ? materials : materials[0];
  });

  const scale =
    appearance.body === "body01" && appearance.hair === "hair01"
      ? 0.529
      : 0.549;
  scene.scale.setScalar(scale);
  scene.position.y = 0.011;

  const head = scene.getObjectByName("Head");
  if (head) {
    if (appearance.head === "head02") {
      head.scale.set(1.04, 0.98, 1.03);
    }
    const accessory = createAccessory(appearance);
    if (appearance.accessory !== "none") {
      // Place the accessory in the model's authored coordinate space first,
      // then re-parent it to the animated head while preserving that transform.
      // The rig's head-local axes are rotated, so direct local offsets put
      // accessories inside the torso.
      scene.add(accessory.object);
      accessory.object.position.set(
        appearance.accessory === "glasses01" ? -0.17 : -0.06,
        appearance.accessory === "glasses01" ? 2.48 : 2.72,
        appearance.accessory === "glasses01" ? 0.59 : 0.05,
      );
      scene.updateMatrixWorld(true);
      head.attach(accessory.object);
    }
    ownedMaterials.push(...accessory.materials);
    ownedGeometries.push(...accessory.geometries);
  }

  return { scene, ownedMaterials, ownedGeometries };
}

export function disposeCasualAvatarScene(
  configured: ConfiguredCasualAvatar,
) {
  configured.ownedMaterials.forEach((material) => material.dispose());
  configured.ownedGeometries.forEach((geometry) => geometry.dispose());
}
