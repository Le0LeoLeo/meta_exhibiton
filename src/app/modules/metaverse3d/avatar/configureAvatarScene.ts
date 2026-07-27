import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import type { AvatarAppearanceV1 } from "./avatarAppearance";
import { AVATAR_MANIFEST } from "./avatarManifest";

type ConfiguredAvatarScene = {
  scene: THREE.Object3D;
  ownedMaterials: THREE.Material[];
  missingNodes: string[];
};

type ConfigureAvatarOptions = {
  warn?: (message: string) => void;
};

const MATERIAL_COLOR_KEYS = {
  MAT_SKIN: "skin",
  MAT_HAIR: "hair",
  MAT_TOP_PRIMARY: "top",
  MAT_TOP_SECONDARY: "top",
  MAT_BOTTOM: "bottom",
  MAT_SHOES: "shoes",
} as const;

export function createConfiguredAvatarScene(
  source: THREE.Object3D,
  appearance: AvatarAppearanceV1,
  options: ConfigureAvatarOptions = {},
): ConfiguredAvatarScene {
  const scene = SkeletonUtils.clone(source);
  const missingNodes: string[] = [];
  const warn = options.warn ?? console.warn;

  for (const [category, nodeMap] of Object.entries(AVATAR_MANIFEST.nodes)) {
    const selectedId = appearance[category as keyof typeof AVATAR_MANIFEST.nodes];
    const selectedNodeName = nodeMap[selectedId as keyof typeof nodeMap];

    for (const nodeName of Object.values(nodeMap)) {
      const node = scene.getObjectByName(nodeName);
      if (!node) {
        missingNodes.push(nodeName);
        warn(`[avatar] required node is missing: ${nodeName}`);
        continue;
      }
      node.visible = nodeName === selectedNodeName;
    }
  }

  const materialClones = new Map<THREE.Material, THREE.Material>();
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const sourceMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    const configuredMaterials = sourceMaterials.map((material) => {
      const existing = materialClones.get(material);
      if (existing) return existing;

      const clone = material.clone();
      const colorKey =
        MATERIAL_COLOR_KEYS[material.name as keyof typeof MATERIAL_COLOR_KEYS];
      if (colorKey && "color" in clone && clone.color instanceof THREE.Color) {
        clone.color.set(AVATAR_MANIFEST.colors[colorKey][appearance.colors[colorKey]]);
      }
      materialClones.set(material, clone);
      return clone;
    });
    object.material = Array.isArray(object.material)
      ? configuredMaterials
      : configuredMaterials[0];
  });

  return {
    scene,
    ownedMaterials: [...materialClones.values()],
    missingNodes,
  };
}

export function disposeConfiguredAvatarScene(configured: ConfiguredAvatarScene) {
  configured.ownedMaterials.forEach((material) => material.dispose());
}
