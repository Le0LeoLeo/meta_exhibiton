import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  Box3,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three';

export const AVATAR_KIT_PATH = resolve(
  process.cwd(),
  'public/models/avatars/v1/avatar-kit-v1.glb',
);

export const REQUIRED_NODES = [
  'AvatarRoot',
  'Armature',
  'Root',
  'Hips',
  'Spine',
  'Chest',
  'Neck',
  'Head',
  'Shoulder_L',
  'UpperArm_L',
  'LowerArm_L',
  'Hand_L',
  'Shoulder_R',
  'UpperArm_R',
  'LowerArm_R',
  'Hand_R',
  'UpperLeg_L',
  'LowerLeg_L',
  'Foot_L',
  'UpperLeg_R',
  'LowerLeg_R',
  'Foot_R',
  'Body_body01',
  'Body_body02',
  'Head_head01',
  'Head_head02',
  'Hair_hair01',
  'Hair_hair02',
  'Hair_hair03',
  'Top_top01',
  'Top_top02',
  'Top_top03',
  'Bottom_bottom01',
  'Bottom_bottom02',
  'Bottom_bottom03',
  'Shoes_shoes01',
  'Shoes_shoes02',
  'Accessory_none',
  'Accessory_glasses01',
  'Accessory_hat01',
];

export const REQUIRED_MATERIALS = [
  'MAT_SKIN',
  'MAT_HAIR',
  'MAT_TOP_PRIMARY',
  'MAT_TOP_SECONDARY',
  'MAT_BOTTOM',
  'MAT_SHOES',
  'MAT_ACCESSORY',
];

export const REQUIRED_CLIPS = ['Idle', 'Walk', 'Wave'];

export const DEFAULT_LIMITS = Object.freeze({
  maxTriangles: 30_000,
  maxTextures: 4,
  maxTextureDimension: 1024,
  footOriginTolerance: 0.01,
  minHeight: 1.72,
  maxHeight: 1.78,
  forwardTolerance: 0.01,
});

const CLIP_DURATION_LIMITS = Object.freeze({
  Idle: [2, 4],
  Walk: [0.8, 1.2],
  Wave: [1.5, 2.5],
});

function repeatedValues(values) {
  const seen = new Set();
  const repeated = new Set();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}

export function validateAvatarReport(report, limits = DEFAULT_LIMITS) {
  const errors = [];
  const nodeNames = report.nodes ?? [];
  const materialNames = report.materials ?? [];
  const clips = report.clips ?? [];
  const clipNames = clips.map((clip) => (
    typeof clip === 'string' ? clip : clip.name
  ));

  for (const nodeName of REQUIRED_NODES) {
    if (!nodeNames.includes(nodeName)) errors.push(`Missing required node: ${nodeName}`);
  }
  for (const nodeName of repeatedValues(nodeNames)) {
    errors.push(`Duplicate node name: ${nodeName}`);
  }
  for (const materialName of REQUIRED_MATERIALS) {
    if (!materialNames.includes(materialName)) {
      errors.push(`Missing required material: ${materialName}`);
    }
  }
  for (const clipName of REQUIRED_CLIPS) {
    if (!clipNames.includes(clipName)) errors.push(`Missing required clip: ${clipName}`);
  }
  for (const clip of clips) {
    if (typeof clip === 'string' || !CLIP_DURATION_LIMITS[clip.name]) continue;
    const [minimum, maximum] = CLIP_DURATION_LIMITS[clip.name];
    if (clip.duration < minimum || clip.duration > maximum) {
      errors.push(
        `Clip "${clip.name}" duration must be ${minimum}–${maximum}s: ${clip.duration}s`,
      );
    }
  }
  if ((report.skinCount ?? 0) < 1) {
    errors.push('Avatar kit must contain at least one skin');
  }
  for (const issue of report.skinningIssues ?? []) errors.push(issue);
  for (const clipName of report.rootMotionClips ?? []) {
    errors.push(`Clip "${clipName}" animates Root translation`);
  }

  const triangleCount = report.triangleCount ?? 0;
  if (triangleCount > limits.maxTriangles) {
    errors.push(
      `Triangle budget exceeded: ${triangleCount} > ${limits.maxTriangles}`,
    );
  }

  const textures = report.textures ?? [];
  if (textures.length > limits.maxTextures) {
    errors.push(`Texture count exceeded: ${textures.length} > ${limits.maxTextures}`);
  }
  for (const texture of textures) {
    if (
      texture.width > limits.maxTextureDimension
      || texture.height > limits.maxTextureDimension
    ) {
      errors.push(
        `Texture "${texture.name}" exceeds ${limits.maxTextureDimension}x`
        + `${limits.maxTextureDimension}: ${texture.width}x${texture.height}`,
      );
    }
  }

  const minY = report.bounds?.min?.[1];
  const maxY = report.bounds?.max?.[1];
  if (!Number.isFinite(minY) || !Number.isFinite(maxY)) {
    errors.push('Model bounds could not be determined');
  } else {
    if (Math.abs(minY) > limits.footOriginTolerance) {
      errors.push(
        `Feet must rest at Y=0 ±${limits.footOriginTolerance}: minY=${minY}`,
      );
    }
    const height = maxY - minY;
    if (height < limits.minHeight || height > limits.maxHeight) {
      errors.push(
        `Avatar height must be ${limits.minHeight}–${limits.maxHeight}m: ${height}m`,
      );
    }
  }

  const [forwardX, forwardY, forwardZ] = report.headForward ?? [];
  if (
    !Number.isFinite(forwardX)
    || !Number.isFinite(forwardY)
    || !Number.isFinite(forwardZ)
    || Math.abs(forwardX) > limits.forwardTolerance
    || Math.abs(forwardY) > limits.forwardTolerance
    || forwardZ > -1 + limits.forwardTolerance
  ) {
    errors.push('Head forward direction must align with -Z');
  }

  return {
    valid: errors.length === 0,
    errors,
    stats: {
      nodes: nodeNames.length,
      materials: materialNames.length,
      clips: clipNames.length,
      triangles: triangleCount,
      textures: textures.length,
      bounds: report.bounds,
    },
  };
}

function parseGlb(buffer) {
  if (buffer.length < 20 || buffer.readUInt32LE(0) !== 0x46546c67) {
    throw new Error('Asset is not a valid binary glTF (.glb) file');
  }
  if (buffer.readUInt32LE(4) !== 2) {
    throw new Error('Only glTF 2.0 assets are supported');
  }

  let offset = 12;
  let json;
  let binaryChunk;
  while (offset + 8 <= buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    const chunk = buffer.subarray(offset + 8, offset + 8 + chunkLength);
    if (chunkType === 0x4e4f534a) {
      json = JSON.parse(chunk.toString('utf8').replace(/\0+$/u, '').trim());
    } else if (chunkType === 0x004e4942) {
      binaryChunk = chunk;
    }
    offset += 8 + chunkLength;
  }

  if (!json) throw new Error('GLB does not contain a JSON chunk');
  return { json, binaryChunk };
}

function localMatrix(node) {
  if (node.matrix) return new Matrix4().fromArray(node.matrix);
  return new Matrix4().compose(
    new Vector3(...(node.translation ?? [0, 0, 0])),
    new Quaternion(...(node.rotation ?? [0, 0, 0, 1])),
    new Vector3(...(node.scale ?? [1, 1, 1])),
  );
}

function createWorldMatrices(nodes) {
  const parents = new Map();
  nodes.forEach((node, parentIndex) => {
    for (const childIndex of node.children ?? []) parents.set(childIndex, parentIndex);
  });
  const cache = new Map();

  function worldMatrix(index) {
    if (cache.has(index)) return cache.get(index);
    const local = localMatrix(nodes[index]);
    const parentIndex = parents.get(index);
    const world = parentIndex === undefined
      ? local
      : worldMatrix(parentIndex).clone().multiply(local);
    cache.set(index, world);
    return world;
  }

  nodes.forEach((_, index) => worldMatrix(index));
  return cache;
}

function primitiveTriangleCount(primitive, accessors) {
  const count = primitive.indices === undefined
    ? accessors[primitive.attributes?.POSITION]?.count ?? 0
    : accessors[primitive.indices]?.count ?? 0;
  const mode = primitive.mode ?? 4;
  if (mode === 4) return Math.floor(count / 3);
  if (mode === 5 || mode === 6) return Math.max(0, count - 2);
  return 0;
}

function calculateSceneStats(gltf) {
  const nodes = gltf.nodes ?? [];
  const meshes = gltf.meshes ?? [];
  const accessors = gltf.accessors ?? [];
  const worldMatrices = createWorldMatrices(nodes);
  const bounds = new Box3();
  const categoryTriangles = new Map();
  let commonTriangles = 0;

  nodes.forEach((node, nodeIndex) => {
    if (node.mesh === undefined) return;
    const mesh = meshes[node.mesh];
    let nodeTriangles = 0;
    for (const primitive of mesh?.primitives ?? []) {
      nodeTriangles += primitiveTriangleCount(primitive, accessors);
      const positionAccessor = accessors[primitive.attributes?.POSITION];
      if (!positionAccessor?.min || !positionAccessor?.max) continue;
      const primitiveBounds = new Box3(
        new Vector3(...positionAccessor.min),
        new Vector3(...positionAccessor.max),
      );
      primitiveBounds.applyMatrix4(worldMatrices.get(nodeIndex));
      bounds.union(primitiveBounds);
    }

    const category = /^(Body|Head|Hair|Top|Bottom|Shoes|Accessory)_/u
      .exec(node.name ?? '')?.[1];
    if (category) {
      categoryTriangles.set(
        category,
        Math.max(categoryTriangles.get(category) ?? 0, nodeTriangles),
      );
    } else {
      commonTriangles += nodeTriangles;
    }
  });

  const triangleCount = commonTriangles
    + [...categoryTriangles.values()].reduce((sum, count) => sum + count, 0);

  const headIndex = nodes.findIndex((node) => node.name === 'Head');
  const headForward = headIndex === -1
    ? undefined
    : new Vector3(0, 0, -1)
      .transformDirection(worldMatrices.get(headIndex))
      .toArray();

  return {
    triangleCount,
    bounds: bounds.isEmpty()
      ? undefined
      : { min: bounds.min.toArray(), max: bounds.max.toArray() },
    headForward,
  };
}

function imageDimensions(bytes) {
  if (
    bytes.length >= 24
    && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }

  if (bytes.length >= 30 && bytes.toString('ascii', 0, 4) === 'RIFF') {
    const kind = bytes.toString('ascii', 12, 16);
    if (kind === 'VP8X') {
      return {
        width: 1 + bytes.readUIntLE(24, 3),
        height: 1 + bytes.readUIntLE(27, 3),
      };
    }
    if (
      kind === 'VP8 '
      && bytes[23] === 0x9d
      && bytes[24] === 0x01
      && bytes[25] === 0x2a
    ) {
      return {
        width: bytes.readUInt16LE(26) & 0x3fff,
        height: bytes.readUInt16LE(28) & 0x3fff,
      };
    }
    if (kind === 'VP8L' && bytes[20] === 0x2f) {
      return {
        width: 1 + bytes[21] + ((bytes[22] & 0x3f) << 8),
        height: 1
          + (bytes[22] >> 6)
          + (bytes[23] << 2)
          + ((bytes[24] & 0x0f) << 10),
      };
    }
  }

  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1];
      const length = bytes.readUInt16BE(offset + 2);
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb].includes(marker)) {
        return {
          width: bytes.readUInt16BE(offset + 7),
          height: bytes.readUInt16BE(offset + 5),
        };
      }
      offset += 2 + length;
    }
  }

  throw new Error('Unsupported image format; use PNG, JPEG, or extended WebP');
}

async function imageBytes(image, gltf, binaryChunk, assetDirectory) {
  if (image.bufferView !== undefined) {
    if (!binaryChunk) throw new Error('Image references a missing GLB binary chunk');
    const view = gltf.bufferViews?.[image.bufferView];
    if (!view) throw new Error(`Image references missing bufferView ${image.bufferView}`);
    const start = view.byteOffset ?? 0;
    return binaryChunk.subarray(start, start + view.byteLength);
  }

  if (image.uri?.startsWith('data:')) {
    const commaIndex = image.uri.indexOf(',');
    const metadata = image.uri.slice(0, commaIndex);
    const payload = image.uri.slice(commaIndex + 1);
    return Buffer.from(payload, metadata.endsWith(';base64') ? 'base64' : 'utf8');
  }

  if (image.uri) return readFile(resolve(assetDirectory, image.uri));
  throw new Error('Image has neither bufferView nor URI');
}

function animationDuration(animation, accessors) {
  let minimum = Infinity;
  let maximum = -Infinity;
  for (const sampler of animation.samplers ?? []) {
    const input = accessors[sampler.input];
    const samplerMinimum = input?.min?.[0];
    const samplerMaximum = input?.max?.[0];
    if (Number.isFinite(samplerMinimum)) minimum = Math.min(minimum, samplerMinimum);
    if (Number.isFinite(samplerMaximum)) maximum = Math.max(maximum, samplerMaximum);
  }
  return Number.isFinite(minimum) && Number.isFinite(maximum)
    ? maximum - minimum
    : 0;
}

function inspectSkinning(gltf) {
  const issues = [];
  const accessors = gltf.accessors ?? [];
  const meshes = gltf.meshes ?? [];

  for (const node of gltf.nodes ?? []) {
    if (
      node.mesh === undefined
      || !/^(Body|Head|Hair|Top|Bottom|Shoes|Accessory)_/u.test(node.name ?? '')
    ) {
      continue;
    }
    const mesh = meshes[node.mesh];
    if (node.skin === undefined) {
      issues.push(`${node.name} is not bound to a skin`);
    }
    for (const [primitiveIndex, primitive] of (mesh?.primitives ?? []).entries()) {
      const label = `${node.name} primitive ${primitiveIndex}`;
      const jointsIndex = primitive.attributes?.JOINTS_0;
      const weightsIndex = primitive.attributes?.WEIGHTS_0;
      if (jointsIndex === undefined) issues.push(`${label} is missing JOINTS_0`);
      if (weightsIndex === undefined) issues.push(`${label} is missing WEIGHTS_0`);
      if (jointsIndex !== undefined && accessors[jointsIndex]?.type !== 'VEC4') {
        issues.push(`${label} JOINTS_0 accessor must use VEC4`);
      }
      if (weightsIndex !== undefined && accessors[weightsIndex]?.type !== 'VEC4') {
        issues.push(`${label} WEIGHTS_0 accessor must use VEC4`);
      }
    }
  }

  return issues;
}

function findRootMotionClips(gltf) {
  const rootIndex = (gltf.nodes ?? []).findIndex((node) => node.name === 'Root');
  if (rootIndex === -1) return [];
  return (gltf.animations ?? [])
    .filter((animation) => (animation.channels ?? []).some((channel) => (
      channel.target?.node === rootIndex && channel.target?.path === 'translation'
    )))
    .map((animation) => animation.name ?? '<unnamed>');
}

export async function createAvatarReport(assetPath) {
  const file = await readFile(assetPath);
  const { json: gltf, binaryChunk } = parseGlb(file);
  const assetDirectory = dirname(assetPath);
  const textures = await Promise.all((gltf.images ?? []).map(async (image, index) => {
    const bytes = await imageBytes(image, gltf, binaryChunk, assetDirectory);
    return {
      name: image.name ?? image.uri ?? `image-${index}`,
      ...imageDimensions(bytes),
    };
  }));
  const sceneStats = calculateSceneStats(gltf);

  return {
    nodes: (gltf.nodes ?? []).map((node) => node.name).filter(Boolean),
    materials: (gltf.materials ?? []).map((material) => material.name).filter(Boolean),
    clips: (gltf.animations ?? []).map((animation) => ({
      name: animation.name,
      duration: animationDuration(animation, gltf.accessors ?? []),
    })),
    skinCount: gltf.skins?.length ?? 0,
    skinningIssues: inspectSkinning(gltf),
    rootMotionClips: findRootMotionClips(gltf),
    textures,
    ...sceneStats,
  };
}

export async function runAvatarValidation({
  assetPath = AVATAR_KIT_PATH,
  mode = process.env.AVATAR_ASSET_VALIDATION ?? 'optional',
  log = console.log,
  error = console.error,
} = {}) {
  if (!['optional', 'required'].includes(mode)) {
    error(`FAIL avatar asset validation mode must be "optional" or "required", got "${mode}"`);
    return 1;
  }

  let report;
  try {
    report = await createAvatarReport(assetPath);
  } catch (cause) {
    if (cause?.code === 'ENOENT' && mode === 'optional') {
      log(`SKIP avatar asset validation: ${assetPath} has not been delivered`);
      return 0;
    }
    error(`FAIL avatar asset validation: ${cause.message}`);
    return 1;
  }

  const result = validateAvatarReport(report);
  log(
    `Avatar kit: ${result.stats.nodes} nodes, ${result.stats.materials} materials, `
    + `${result.stats.clips} clips, ${result.stats.triangles} triangles, `
    + `${result.stats.textures} textures`,
  );
  if (!result.valid) {
    for (const validationError of result.errors) error(`FAIL ${validationError}`);
    return 1;
  }
  log('PASS avatar asset validation');
  return 0;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.exitCode = await runAvatarValidation({
    mode: process.argv.includes('--required') ? 'required' : undefined,
  });
}
