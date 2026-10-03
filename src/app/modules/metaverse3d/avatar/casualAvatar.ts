import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import { apiUrl } from "@/app/api/base";
import {
  resolveAvatarTopColor,
  type AvatarAppearanceV1,
} from "./avatarAppearance";
import { resolveAvatarFacialTransforms } from "./avatarFacialPlacement";
import { AVATAR_MANIFEST } from "./avatarManifest";
import {
  AVATAR_BODY_SCALE,
  AVATAR_ROOT_OFFSET_Y,
} from "./avatarEyeHeight";

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

export const CASUAL_AVATAR_BASE_ASSETS = {
  body01: CASUAL_AVATAR_ASSETS.body01.hair01,
  body02: CASUAL_AVATAR_ASSETS.body02.hair01,
} as const;

export type ConfiguredCasualAvatar = {
  scene: THREE.Group;
  ownedMaterials: THREE.Material[];
  ownedGeometries: THREE.BufferGeometry[];
  ownedTextures: THREE.Texture[];
};

export const AVATAR_HEAD_SCALE = {
  head01: [1.04, 0.98, 1.02],
  head02: [0.82, 1.14, 0.9],
} as const satisfies Record<
  AvatarAppearanceV1["head"],
  readonly [number, number, number]
>;

export const AVATAR_SHOE_HEIGHT = {
  shoes01: 0.17,
  shoes02: 0.3,
} as const satisfies Record<AvatarAppearanceV1["shoes"], number>;

export function centerCropAvatarPhotoTexture(texture: THREE.Texture) {
  const image = texture.image as { width?: number; height?: number } | undefined;
  const width = Number(image?.width);
  const height = Number(image?.height);
  if (!(width > 0) || !(height > 0)) return;

  texture.repeat.set(1, 1);
  texture.offset.set(0, 0);
  if (width > height) {
    texture.repeat.x = height / width;
    texture.offset.x = (1 - texture.repeat.x) / 2;
  } else if (height > width) {
    texture.repeat.y = width / height;
    texture.offset.y = (1 - texture.repeat.y) / 2;
  }
  texture.updateMatrix();
  texture.needsUpdate = true;
}

type AvatarShirtPhotoShader = {
  uniforms: Record<string, { value: unknown }>;
  vertexShader: string;
  fragmentShader: string;
};

export function applyAvatarShirtPhotoMaterial(
  material: THREE.MeshStandardMaterial,
  texture: THREE.Texture,
) {
  material.onBeforeCompile = (shader) => {
    const photoShader = shader as AvatarShirtPhotoShader;
    photoShader.uniforms.shirtPhotoMap = { value: texture };
    photoShader.uniforms.shirtPhotoMatrix = { value: texture.matrix };
    photoShader.vertexShader = photoShader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vShirtPhotoPosition;
varying vec3 vShirtPhotoNormal;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vShirtPhotoPosition = position;
vShirtPhotoNormal = normal;`,
      );
    photoShader.fragmentShader = photoShader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform sampler2D shirtPhotoMap;
uniform mat3 shirtPhotoMatrix;
varying vec3 vShirtPhotoPosition;
varying vec3 vShirtPhotoNormal;`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
vec2 shirtPhotoUv = vec2(
  vShirtPhotoPosition.x / 0.42 + 0.5,
  (vShirtPhotoPosition.y - 1.65) / 0.42 + 0.5
);
float shirtPhotoBounds =
  step(0.0, shirtPhotoUv.x) *
  step(shirtPhotoUv.x, 1.0) *
  step(0.0, shirtPhotoUv.y) *
  step(shirtPhotoUv.y, 1.0);
float shirtPhotoFacing = smoothstep(0.12, 0.5, vShirtPhotoNormal.z);
vec2 croppedShirtPhotoUv =
  (shirtPhotoMatrix * vec3(shirtPhotoUv, 1.0)).xy;
vec4 shirtPhotoColor = texture2D(shirtPhotoMap, croppedShirtPhotoUv);
float shirtPhotoMix =
  shirtPhotoBounds * shirtPhotoFacing * shirtPhotoColor.a;
diffuseColor.rgb = mix(
  diffuseColor.rgb,
  shirtPhotoColor.rgb,
  shirtPhotoMix
);`,
      );
  };
  material.customProgramCacheKey = () => "avatar-shirt-photo-surface-v1";
  material.needsUpdate = true;
}

export function applyAvatarFacialFeatureMaterial(
  material: THREE.MeshStandardMaterial,
  appearance: AvatarAppearanceV1,
) {
  const transforms = resolveAvatarFacialTransforms(appearance);
  const eyeLeft = transforms.eyes.left;
  const eyeRight = transforms.eyes.right;
  const browLeft = transforms.eyebrows.left;
  const browRight = transforms.eyebrows.right;
  const mouth = transforms.mouth;
  const browSize =
    appearance.eyebrows === "eyebrows03"
      ? [0.145, 0.028] as const
      : appearance.eyebrows === "eyebrows02"
        ? [0.13, 0.024] as const
        : [0.12, 0.018] as const;

  material.onBeforeCompile = (shader) => {
    const faceShader = shader as AvatarShirtPhotoShader;
    faceShader.uniforms.avatarFaceInk = {
      value: new THREE.Color("#30231f"),
    };
    faceShader.uniforms.avatarShoeColor = {
      value: targetColor("shoes", appearance),
    };
    faceShader.uniforms.avatarShoeHeight = {
      value: AVATAR_SHOE_HEIGHT[appearance.shoes],
    };
    faceShader.uniforms.avatarShoeStyle = {
      value: appearance.shoes === "shoes02" ? 1 : 0,
    };
    faceShader.uniforms.avatarEyeLeft = {
      value: new THREE.Vector4(
        eyeLeft.position[0],
        eyeLeft.position[1],
        eyeLeft.scale[0],
        eyeLeft.scale[1],
      ),
    };
    faceShader.uniforms.avatarEyeRight = {
      value: new THREE.Vector4(
        eyeRight.position[0],
        eyeRight.position[1],
        eyeRight.scale[0],
        eyeRight.scale[1],
      ),
    };
    faceShader.uniforms.avatarBrowLeft = {
      value: new THREE.Vector4(
        browLeft.position[0],
        browLeft.position[1],
        browSize[0],
        browSize[1],
      ),
    };
    faceShader.uniforms.avatarBrowRight = {
      value: new THREE.Vector4(
        browRight.position[0],
        browRight.position[1],
        browSize[0],
        browSize[1],
      ),
    };
    faceShader.uniforms.avatarBrowRotation = {
      value: new THREE.Vector2(
        browLeft.rotationZ,
        browRight.rotationZ,
      ),
    };
    faceShader.uniforms.avatarBrowStyle = {
      value: appearance.eyebrows === "eyebrows02" ? 1 : 0,
    };
    faceShader.uniforms.avatarMouth = {
      value: new THREE.Vector4(
        mouth.position[0],
        mouth.position[1],
        mouth.scale[0],
        mouth.scale[1],
      ),
    };
    faceShader.uniforms.avatarMouthStyle = {
      value:
        appearance.mouth === "mouth02"
          ? 1
          : appearance.mouth === "mouth03"
            ? 2
            : 0,
    };
    faceShader.vertexShader = faceShader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vAvatarFacePosition;
varying vec3 vAvatarFaceNormal;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vAvatarFacePosition = position;
vAvatarFaceNormal = normal;`,
      );
    faceShader.fragmentShader = faceShader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform vec3 avatarFaceInk;
uniform vec3 avatarShoeColor;
uniform float avatarShoeHeight;
uniform float avatarShoeStyle;
uniform vec4 avatarEyeLeft;
uniform vec4 avatarEyeRight;
uniform vec4 avatarBrowLeft;
uniform vec4 avatarBrowRight;
uniform vec2 avatarBrowRotation;
uniform float avatarBrowStyle;
uniform vec4 avatarMouth;
uniform float avatarMouthStyle;
varying vec3 vAvatarFacePosition;
varying vec3 vAvatarFaceNormal;

vec2 avatarRotate2d(vec2 point, float angle) {
  float sine = sin(angle);
  float cosine = cos(angle);
  return mat2(cosine, -sine, sine, cosine) * point;
}

float avatarEllipse(vec2 point, vec2 center, vec2 radius) {
  float distanceToEdge = length((point - center) / radius);
  return 1.0 - smoothstep(0.88, 1.0, distanceToEdge);
}

float avatarBox(vec2 point, vec2 center, vec2 halfSize, float rotation) {
  vec2 localPoint = avatarRotate2d(point - center, -rotation);
  vec2 edge = abs(localPoint) - halfSize;
  float signedDistance =
    length(max(edge, vec2(0.0))) + min(max(edge.x, edge.y), 0.0);
  return 1.0 - smoothstep(0.0, 0.006, signedDistance);
}

float avatarSoftBrow(vec2 point, vec4 brow) {
  vec2 localPoint = point - brow.xy;
  float curve = 0.012 - 1.5 * localPoint.x * localPoint.x;
  float stroke = 1.0 - smoothstep(
    brow.w * 0.42,
    brow.w * 0.72,
    abs(localPoint.y - curve)
  );
  return stroke * (1.0 - step(brow.z * 0.5, abs(localPoint.x)));
}

float avatarSmile(vec2 point, vec4 mouth) {
  vec2 localPoint = (point - mouth.xy) / mouth.zw;
  float curve = -0.026 + 3.1 * localPoint.x * localPoint.x;
  float stroke = 1.0 - smoothstep(
    0.01,
    0.017,
    abs(localPoint.y - curve)
  );
  return stroke * (1.0 - step(0.086, abs(localPoint.x)));
}

float avatarOpenMouth(vec2 point, vec4 mouth) {
  vec2 localPoint = (point - mouth.xy) / mouth.zw;
  float outer = avatarEllipse(
    localPoint,
    vec2(0.0),
    vec2(0.052, 0.052)
  );
  float inner = avatarEllipse(
    localPoint,
    vec2(0.0),
    vec2(0.031, 0.031)
  );
  return outer * (1.0 - inner);
}`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
vec2 avatarFacePoint = vAvatarFacePosition.xy;
float avatarFaceMask = max(
  avatarEllipse(
    avatarFacePoint,
    avatarEyeLeft.xy,
    avatarEyeLeft.zw
  ),
  avatarEllipse(
    avatarFacePoint,
    avatarEyeRight.xy,
    avatarEyeRight.zw
  )
);
float avatarLeftBrow = mix(
  avatarBox(
    avatarFacePoint,
    avatarBrowLeft.xy,
    avatarBrowLeft.zw * 0.5,
    avatarBrowRotation.x
  ),
  avatarSoftBrow(avatarFacePoint, avatarBrowLeft),
  step(0.5, avatarBrowStyle)
);
float avatarRightBrow = mix(
  avatarBox(
    avatarFacePoint,
    avatarBrowRight.xy,
    avatarBrowRight.zw * 0.5,
    avatarBrowRotation.y
  ),
  avatarSoftBrow(avatarFacePoint, avatarBrowRight),
  step(0.5, avatarBrowStyle)
);
avatarFaceMask = max(
  avatarFaceMask,
  max(avatarLeftBrow, avatarRightBrow)
);
float avatarNeutralMouth = avatarBox(
  avatarFacePoint,
  avatarMouth.xy,
  vec2(0.07, 0.012) * avatarMouth.zw,
  0.0
);
float avatarMouthMask = mix(
  avatarNeutralMouth,
  avatarSmile(avatarFacePoint, avatarMouth),
  step(0.5, avatarMouthStyle)
);
avatarMouthMask = mix(
  avatarMouthMask,
  avatarOpenMouth(avatarFacePoint, avatarMouth),
  step(1.5, avatarMouthStyle)
);
avatarFaceMask = max(avatarFaceMask, avatarMouthMask);
float avatarFaceFacing = smoothstep(
  0.08,
  0.5,
  vAvatarFaceNormal.z
);
avatarFaceMask *= avatarFaceFacing;
diffuseColor.rgb = mix(
  diffuseColor.rgb,
  avatarFaceInk,
  clamp(avatarFaceMask, 0.0, 1.0)
);

float avatarShoeMask = 1.0 - smoothstep(
  avatarShoeHeight - 0.018,
  avatarShoeHeight + 0.018,
  vAvatarFacePosition.y
);
float avatarSoleMask = avatarShoeMask * (
  1.0 - smoothstep(0.035, 0.065, vAvatarFacePosition.y)
);
float avatarSneakerBand = avatarShoeStyle * avatarShoeMask * (
  smoothstep(0.105, 0.125, vAvatarFacePosition.y) -
  smoothstep(0.145, 0.165, vAvatarFacePosition.y)
);
vec3 avatarSoleColor = mix(
  avatarShoeColor * 0.58,
  vec3(0.88),
  avatarShoeStyle
);
diffuseColor.rgb = mix(
  diffuseColor.rgb,
  avatarShoeColor,
  avatarShoeMask
);
diffuseColor.rgb = mix(
  diffuseColor.rgb,
  avatarSoleColor,
  max(avatarSoleMask, avatarSneakerBand)
);`,
      );
  };
  material.customProgramCacheKey = () => "avatar-skin-details-surface-v2";
  material.needsUpdate = true;
}

function targetColor(
  category: Exclude<keyof AvatarAppearanceV1["colors"], "topCustom">,
  appearance: AvatarAppearanceV1,
) {
  if (category === "top") {
    return new THREE.Color(resolveAvatarTopColor(appearance));
  }
  const palette: Readonly<Record<string, string>> = AVATAR_MANIFEST.colors[category];
  return new THREE.Color(palette[appearance.colors[category]]);
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
    material.color.copy(targetColor("bottom", appearance)).multiplyScalar(0.58);
    material.roughness = 0.72;
  } else if (material.name === "Face") {
    // The source kit bakes one fixed set of features into this material group.
    // Hide it so the procedural eyes, eyebrows, and mouth can replace it.
    material.visible = false;
  }
  material.needsUpdate = true;
  return material;
}

function usesMaterial(object: THREE.Mesh, materialName: string) {
  const materials = Array.isArray(object.material)
    ? object.material
    : [object.material];
  return materials.some((material) => material.name === materialName);
}

function findMeshByMaterial(
  source: THREE.Object3D,
  materialName: string,
) {
  let result: THREE.Mesh | undefined;
  source.traverse((object) => {
    if (
      !result &&
      object instanceof THREE.Mesh &&
      usesMaterial(object, materialName)
    ) {
      result = object;
    }
  });
  return result;
}

function findSkinnedMeshByMaterial(
  source: THREE.Object3D,
  materialName: string,
) {
  let result: THREE.SkinnedMesh | undefined;
  source.traverse((object) => {
    if (
      !result &&
      object instanceof THREE.SkinnedMesh &&
      usesMaterial(object, materialName)
    ) {
      result = object;
    }
  });
  return result;
}

export function replaceCasualAvatarHairGeometry(
  avatar: THREE.Object3D,
  hairSource: THREE.Object3D,
) {
  const avatarHair = findMeshByMaterial(avatar, "Hair");
  const selectedHair = findMeshByMaterial(hairSource, "Hair");
  if (!avatarHair || !selectedHair) return false;

  // The casual avatar files share the same rig and authored coordinate space.
  // Keep the base character and its skeleton, replacing only the selected
  // hairstyle geometry so clothes and body proportions remain unchanged.
  avatarHair.geometry = selectedHair.geometry;
  return true;
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

function createFootwear(
  appearance: AvatarAppearanceV1,
  skin: THREE.SkinnedMesh,
): {
  object: THREE.Group;
  materials: THREE.Material[];
  geometries: THREE.BufferGeometry[];
} {
  const object = new THREE.Group();
  object.name = `Footwear_${appearance.shoes}`;
  const shoeColor = targetColor("shoes", appearance);
  const upperMaterial = new THREE.MeshStandardMaterial({
    name: "ShoeUpper",
    color: shoeColor,
    roughness: appearance.shoes === "shoes02" ? 0.58 : 0.72,
  });
  const soleMaterial = new THREE.MeshStandardMaterial({
    name: "ShoeSole",
    color:
      appearance.shoes === "shoes02"
        ? new THREE.Color("#e8e6df")
        : shoeColor.clone().multiplyScalar(0.55),
    roughness: 0.78,
  });
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [upperMaterial, soleMaterial];

  const sourcePosition = skin.geometry.getAttribute("position");
  const sourceSkinIndex = skin.geometry.getAttribute("skinIndex");
  const sourceSkinWeight = skin.geometry.getAttribute("skinWeight");

  const addSkinnedPart = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    name: string,
    skinningTarget: THREE.Vector3,
  ) => {
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < sourcePosition.count; index += 1) {
      const dx = sourcePosition.getX(index) - skinningTarget.x;
      const dy = sourcePosition.getY(index) - skinningTarget.y;
      const dz = sourcePosition.getZ(index) - skinningTarget.z;
      const distance = dx * dx + dy * dy + dz * dz;
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    }

    const position = geometry.getAttribute("position");
    const indices = new Uint16Array(position.count * 4);
    const weights = new Float32Array(position.count * 4);
    const nearestIndices = [
      sourceSkinIndex.getX(nearestIndex),
      sourceSkinIndex.getY(nearestIndex),
      sourceSkinIndex.getZ(nearestIndex),
      sourceSkinIndex.getW(nearestIndex),
    ];
    const nearestWeights = [
      sourceSkinWeight.getX(nearestIndex),
      sourceSkinWeight.getY(nearestIndex),
      sourceSkinWeight.getZ(nearestIndex),
      sourceSkinWeight.getW(nearestIndex),
    ];
    for (let index = 0; index < position.count; index += 1) {
      indices.set(nearestIndices, index * 4);
      weights.set(nearestWeights, index * 4);
    }
    geometry.setAttribute(
      "skinIndex",
      new THREE.Uint16BufferAttribute(indices, 4),
    );
    geometry.setAttribute(
      "skinWeight",
      new THREE.Float32BufferAttribute(weights, 4),
    );
    geometries.push(geometry);

    const mesh = new THREE.SkinnedMesh(geometry, material);
    mesh.name = name;
    mesh.bind(skin.skeleton, skin.bindMatrix);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    object.add(mesh);
  };

  for (const [side, x] of [
    ["Left", 0.3],
    ["Right", -0.3],
  ] as const) {
    const skinningTarget = new THREE.Vector3(x, 0.06, 0.04);
    const sole = new THREE.BoxGeometry(0.24, 0.055, 0.38);
    sole.translate(x, 0.035, 0.075);
    addSkinnedPart(sole, soleMaterial, `Shoe${side}Sole`, skinningTarget);

    const upper = new THREE.SphereGeometry(0.14, 10, 6);
    upper.scale(0.86, 0.56, 1.28);
    upper.translate(x, 0.12, 0.085);
    addSkinnedPart(upper, upperMaterial, `Shoe${side}Upper`, skinningTarget);

    if (appearance.shoes === "shoes02") {
      const collar = new THREE.CylinderGeometry(0.115, 0.135, 0.22, 10);
      collar.translate(x, 0.19, -0.015);
      addSkinnedPart(
        collar,
        upperMaterial,
        `Shoe${side}Collar`,
        skinningTarget,
      );

      for (const [index, z] of [0.105, 0.16].entries()) {
        const lace = new THREE.BoxGeometry(0.17, 0.018, 0.035);
        lace.rotateX(-0.18);
        lace.translate(x, 0.2 - index * 0.018, z);
        addSkinnedPart(
          lace,
          soleMaterial,
          `Shoe${side}Lace${index + 1}`,
          skinningTarget,
        );
      }
    }
  }

  return { object, materials, geometries };
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
  hairSource: THREE.Object3D = source,
): ConfiguredCasualAvatar {
  const scene = SkeletonUtils.clone(source) as THREE.Group;
  scene.name = "CasualAvatar";
  replaceCasualAvatarHairGeometry(scene, hairSource);
  const ownedMaterials: THREE.Material[] = [];
  const ownedGeometries: THREE.BufferGeometry[] = [];
  const ownedTextures: THREE.Texture[] = [];
  const materialClones = new Map<THREE.Material, THREE.Material>();
  const shirtPhotoTexture = appearance.topPhotoUrl
    ? new THREE.TextureLoader().load(
        apiUrl(appearance.topPhotoUrl),
        centerCropAvatarPhotoTexture,
      )
    : undefined;

  if (shirtPhotoTexture) {
    shirtPhotoTexture.colorSpace = THREE.SRGBColorSpace;
    shirtPhotoTexture.minFilter = THREE.LinearMipmapLinearFilter;
    shirtPhotoTexture.magFilter = THREE.LinearFilter;
    ownedTextures.push(shirtPhotoTexture);
  }

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
      if (
        shirtPhotoTexture &&
        material instanceof THREE.MeshStandardMaterial &&
        material.name === "Shirt"
      ) {
        applyAvatarShirtPhotoMaterial(material, shirtPhotoTexture);
      }
      if (
        material instanceof THREE.MeshStandardMaterial &&
        material.name === "Skin"
      ) {
        applyAvatarFacialFeatureMaterial(material, appearance);
      }
      materialClones.set(sourceMaterial, material);
      ownedMaterials.push(material);
      return material;
    });
    object.material = Array.isArray(object.material) ? materials : materials[0];
  });

  const scale = AVATAR_BODY_SCALE[appearance.body];
  scene.scale.setScalar(scale);
  scene.position.y = AVATAR_ROOT_OFFSET_Y;

  const skin = findSkinnedMeshByMaterial(scene, "Skin");
  if (skin) {
    const footwear = createFootwear(appearance, skin);
    scene.add(footwear.object);
    ownedMaterials.push(...footwear.materials);
    ownedGeometries.push(...footwear.geometries);
  }

  const head = scene.getObjectByName("Head");
  if (head) {
    head.scale.fromArray(AVATAR_HEAD_SCALE[appearance.head]);
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

  return { scene, ownedMaterials, ownedGeometries, ownedTextures };
}

export function disposeCasualAvatarScene(
  configured: ConfiguredCasualAvatar,
) {
  configured.ownedMaterials.forEach((material) => material.dispose());
  configured.ownedGeometries.forEach((geometry) => geometry.dispose());
  configured.ownedTextures.forEach((texture) => texture.dispose());
}
