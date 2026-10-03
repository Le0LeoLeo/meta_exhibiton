import * as THREE from "three";

import type { EffectivePerformanceMode } from "../../../modules/metaverse3d/performance/adaptivePerformance";

export interface ExhibitModelQuality {
  radialSegments: number;
  sphereSegments: number;
  ringSegments: number;
  textureAnisotropy: number;
  environmentIntensity: number;
  castShadows: boolean;
  decorativeLights: boolean;
}

export interface ExhibitModelFit {
  scale: number;
  offset: [number, number, number];
}

export function getExhibitModelQuality(
  mode: EffectivePerformanceMode,
): ExhibitModelQuality {
  if (mode === "quality") {
    return {
      radialSegments: 32,
      sphereSegments: 24,
      ringSegments: 48,
      textureAnisotropy: 8,
      environmentIntensity: 1.15,
      castShadows: true,
      decorativeLights: true,
    };
  }

  if (mode === "performance") {
    return {
      radialSegments: 12,
      sphereSegments: 10,
      ringSegments: 16,
      textureAnisotropy: 1,
      environmentIntensity: 0.65,
      castShadows: false,
      decorativeLights: false,
    };
  }

  return {
    radialSegments: 20,
    sphereSegments: 16,
    ringSegments: 28,
    textureAnisotropy: 4,
    environmentIntensity: 0.9,
    castShadows: true,
    decorativeLights: true,
  };
}

function materialTextures(material: THREE.Material): THREE.Texture[] {
  const textures = new Set<THREE.Texture>();
  for (const value of Object.values(material)) {
    if (value instanceof THREE.Texture) textures.add(value);
  }
  return [...textures];
}

export function optimizeExhibitModel(
  root: THREE.Object3D,
  quality: ExhibitModelQuality,
  rendererMaxAnisotropy: number,
): void {
  const anisotropy = Math.max(
    1,
    Math.min(quality.textureAnisotropy, rendererMaxAnisotropy || 1),
  );

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;

    object.castShadow = quality.castShadows;
    object.receiveShadow = quality.castShadows;
    object.frustumCulled = true;

    const geometry = object.geometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (!geometry.boundingSphere) geometry.computeBoundingSphere();

    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of materials) {
      material.dithering = true;
      if (
        material instanceof THREE.MeshStandardMaterial ||
        material instanceof THREE.MeshPhysicalMaterial
      ) {
        material.envMapIntensity = quality.environmentIntensity;
        material.roughness = THREE.MathUtils.clamp(material.roughness, 0.08, 0.94);
        material.metalness = THREE.MathUtils.clamp(material.metalness, 0, 1);
      }
      for (const texture of materialTextures(material)) {
        if (texture.anisotropy !== anisotropy) {
          texture.anisotropy = anisotropy;
          texture.needsUpdate = true;
        }
      }
    }
  });
}

export function fitObjectToExhibit(
  object: THREE.Object3D,
  targetSize = 0.9,
): ExhibitModelFit {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return { scale: 1, offset: [0, 0, 0] };

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxAxis = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(maxAxis) || maxAxis <= 0) {
    return { scale: 1, offset: [0, 0, 0] };
  }

  const scale = targetSize / maxAxis;
  return {
    scale,
    offset: [
      -center.x * scale,
      -box.min.y * scale,
      -center.z * scale,
    ],
  };
}
