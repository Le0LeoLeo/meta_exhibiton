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
  outfits: {
    body01: `${ASSET_ROOT}/outfit-body01.glb`,
    body02: `${ASSET_ROOT}/outfit-body02.glb`,
  },
  animations: `${ASSET_ROOT}/animations.glb`,
} as const;

export type ConfiguredQuaterniusAvatar = {
  scene: THREE.Group;
  ownedMaterials: THREE.Material[];
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
  const skin = targetColor("skin", appearance);
  const top = targetColor("top", appearance);
  const bottom = targetColor("bottom", appearance);
  const shoes = targetColor("shoes", appearance);

  material.onBeforeCompile = (shader) => {
    const sourceShader = shader as unknown as ShaderSource;
    sourceShader.uniforms.avatarSkinColor = { value: skin };
    sourceShader.uniforms.avatarTopColor = { value: top };
    sourceShader.uniforms.avatarBottomColor = { value: bottom };
    sourceShader.uniforms.avatarShoesColor = { value: shoes };
    sourceShader.vertexShader = sourceShader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying float vAvatarBindY;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvAvatarBindY = position.y;",
      );
    sourceShader.fragmentShader = sourceShader.fragmentShader
      .replace(
        "#include <common>",
        [
          "#include <common>",
          "varying float vAvatarBindY;",
          "uniform vec3 avatarSkinColor;",
          "uniform vec3 avatarTopColor;",
          "uniform vec3 avatarBottomColor;",
          "uniform vec3 avatarShoesColor;",
        ].join("\n"),
      )
      .replace(
        "#include <map_fragment>",
        [
          "#include <map_fragment>",
          "float avatarMax = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b));",
          "float avatarMin = min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b));",
          "float avatarSat = avatarMax - avatarMin;",
          "float avatarShade = clamp(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)) * 1.35, 0.32, 1.05);",
          "if (avatarSat < 0.13) {",
          "  vec3 garment = vAvatarBindY < 0.16 ? avatarShoesColor : (vAvatarBindY < 0.88 ? avatarBottomColor : avatarTopColor);",
          "  diffuseColor.rgb = garment * avatarShade;",
          "} else {",
          "  diffuseColor.rgb = mix(diffuseColor.rgb, avatarSkinColor * avatarShade, 0.72);",
          "}",
        ].join("\n"),
      );
  };
  material.customProgramCacheKey = () => [
    "quaternius-avatar-v1",
    appearance.colors.skin,
    appearance.colors.top,
    appearance.colors.bottom,
    appearance.colors.shoes,
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

function configureOutfitMaterial(
  source: THREE.MeshStandardMaterial,
  meshName: string,
  appearance: AvatarAppearanceV1,
) {
  const material = source.clone();
  material.map = null;
  const category =
    source.name.includes("Regular")
      ? "skin"
      : meshName.includes("Feet")
        ? "shoes"
        : meshName.includes("Legs")
          ? "bottom"
          : "top";
  material.color.copy(targetColor(category, appearance));
  material.roughness = category === "shoes" ? 0.62 : 0.78;
  material.metalness = 0;
  material.needsUpdate = true;
  return material;
}

function rebindOutfitToBody(
  outfit: THREE.Object3D,
  body: THREE.Object3D,
  scene: THREE.Group,
  appearance: AvatarAppearanceV1,
  castShadow: boolean,
  ownedMaterials: THREE.Material[],
) {
  const bodyBones = new Map<string, THREE.Bone>();
  body.traverse((object) => {
    if (object instanceof THREE.Bone) bodyBones.set(object.name, object);
  });
  const outfitMeshes: THREE.SkinnedMesh[] = [];
  outfit.traverse((object) => {
    if (object instanceof THREE.SkinnedMesh) outfitMeshes.push(object);
  });
  outfit.updateMatrixWorld(true);

  for (const mesh of outfitMeshes) {
    const bones = mesh.skeleton.bones.map((bone) => bodyBones.get(bone.name));
    if (bones.some((bone) => !bone)) continue;
    mesh.bind(
      new THREE.Skeleton(
        bones as THREE.Bone[],
        mesh.skeleton.boneInverses.map((matrix) => matrix.clone()),
      ),
      mesh.bindMatrix.clone(),
    );
    const sourceMaterials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    const materials = sourceMaterials.map((source) => {
      const material =
        source instanceof THREE.MeshStandardMaterial
          ? configureOutfitMaterial(source, mesh.name, appearance)
          : source.clone();
      ownedMaterials.push(material);
      return material;
    });
    mesh.material = Array.isArray(mesh.material) ? materials : materials[0];
    mesh.castShadow = castShadow;
    scene.attach(mesh);
  }
}

export function createQuaterniusAvatarScene(
  bodySource: THREE.Object3D,
  hairSource: THREE.Object3D,
  outfitSource: THREE.Object3D,
  appearance: AvatarAppearanceV1,
  castShadow = true,
): ConfiguredQuaterniusAvatar {
  const scene = new THREE.Group();
  scene.name = "QuaterniusAvatar";
  const body = SkeletonUtils.clone(bodySource);
  const hair = hairSource.clone(true);
  const outfit = SkeletonUtils.clone(outfitSource);
  const ownedMaterials: THREE.Material[] = [];
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
  rebindOutfitToBody(
    outfit,
    body,
    scene,
    appearance,
    castShadow,
    ownedMaterials,
  );
  scene.updateMatrixWorld(true);
  const head = body.getObjectByName("Head");
  if (head) head.attach(hair);

  return { scene, ownedMaterials };
}

export function disposeQuaterniusAvatarScene(
  configured: ConfiguredQuaterniusAvatar,
) {
  configured.ownedMaterials.forEach((material) => material.dispose());
}
