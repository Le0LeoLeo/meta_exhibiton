import { access, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createAvatarReport } from './validate-avatar-kit.mjs';

export const QUATERNIUS_ASSET_ROOT = resolve(
  process.cwd(),
  'public/models/avatars/quaternius-v1',
);

const BODY_FILES = ['body01.glb', 'body02.glb'];
const HAIR_FILES = ['hair01.glb', 'hair02.glb', 'hair03.glb'];
const OUTFIT_FILES = ['outfit-body01.glb', 'outfit-body02.glb'];
const ANIMATION_FILE = 'animations.glb';
const REQUIRED_BONES = [
  'root',
  'pelvis',
  'spine_01',
  'spine_02',
  'spine_03',
  'neck_01',
  'Head',
  'clavicle_l',
  'upperarm_l',
  'lowerarm_l',
  'hand_l',
  'clavicle_r',
  'upperarm_r',
  'lowerarm_r',
  'hand_r',
  'thigh_l',
  'calf_l',
  'foot_l',
  'thigh_r',
  'calf_r',
  'foot_r',
];
const EXPECTED_CLIPS = {
  Idle: [2, 3],
  Walk: [0.9, 1.1],
  Wave: [1.8, 2.2],
};
const MAX_TOTAL_BYTES = 9_000_000;

function validateRig(filename, report) {
  const errors = [];
  for (const bone of REQUIRED_BONES) {
    if (!report.nodes.includes(bone)) {
      errors.push(`${filename}: missing humanoid bone ${bone}`);
    }
  }
  if (report.skinCount !== 1) {
    errors.push(`${filename}: expected one skin, found ${report.skinCount}`);
  }
  if (report.textures.length > 7) {
    errors.push(`${filename}: texture budget exceeded (${report.textures.length})`);
  }
  for (const texture of report.textures) {
    if (texture.width > 512 || texture.height > 512) {
      errors.push(
        `${filename}: ${texture.name} exceeds 512x512 `
        + `(${texture.width}x${texture.height})`,
      );
    }
  }
  return errors;
}

function validateBody(filename, report) {
  const errors = validateRig(filename, report);
  if (report.triangleCount > 20_000) {
    errors.push(`${filename}: triangle budget exceeded (${report.triangleCount})`);
  }
  const minY = report.bounds?.min?.[1];
  const maxY = report.bounds?.max?.[1];
  if (typeof minY !== 'number' || Math.abs(minY) > 0.015) {
    errors.push(`${filename}: feet must remain at y=0 (found ${minY})`);
  }
  if (typeof maxY !== 'number' || maxY < 1.7 || maxY > 1.9) {
    errors.push(`${filename}: expected human-scale height, found ${maxY}`);
  }
  return errors;
}

function validateOutfit(filename, report) {
  const errors = validateRig(filename, report);
  if (report.triangleCount > 20_000) {
    errors.push(`${filename}: triangle budget exceeded (${report.triangleCount})`);
  }
  return errors;
}

function validateAnimations(report) {
  const errors = [];
  const clips = new Map(report.clips.map((clip) => [clip.name, clip]));
  for (const [name, [minimum, maximum]] of Object.entries(EXPECTED_CLIPS)) {
    const clip = clips.get(name);
    if (!clip) {
      errors.push(`animations.glb: missing ${name} clip`);
      continue;
    }
    if (clip.duration < minimum || clip.duration > maximum) {
      errors.push(
        `animations.glb: ${name} duration ${clip.duration}s `
        + `must be ${minimum}-${maximum}s`,
      );
    }
  }
  if (clips.size !== Object.keys(EXPECTED_CLIPS).length) {
    errors.push(`animations.glb: expected only Idle, Walk and Wave clips`);
  }
  if (report.rootMotionClips.length) {
    errors.push(
      `animations.glb: root translation found in `
      + report.rootMotionClips.join(', '),
    );
  }
  return errors;
}

export async function runQuaterniusAvatarValidation(
  assetRoot = QUATERNIUS_ASSET_ROOT,
) {
  const errors = [];
  let totalBytes = 0;
  const reports = {};
  const files = [
    ...BODY_FILES,
    ...HAIR_FILES,
    ...OUTFIT_FILES,
    ANIMATION_FILE,
    'LICENSE.txt',
  ];

  for (const filename of files) {
    const filePath = resolve(assetRoot, filename);
    await access(filePath);
    totalBytes += (await stat(filePath)).size;
    if (filename.endsWith('.glb')) {
      reports[filename] = await createAvatarReport(filePath);
    }
  }
  for (const filename of BODY_FILES) {
    errors.push(...validateBody(filename, reports[filename]));
  }
  for (const filename of OUTFIT_FILES) {
    errors.push(...validateOutfit(filename, reports[filename]));
  }
  for (const filename of HAIR_FILES) {
    const report = reports[filename];
    if (report.triangleCount > 8_000) {
      errors.push(`${filename}: triangle budget exceeded (${report.triangleCount})`);
    }
    if (report.textures.length > 2) {
      errors.push(`${filename}: texture budget exceeded (${report.textures.length})`);
    }
  }
  errors.push(...validateAnimations(reports[ANIMATION_FILE]));

  const license = await readFile(resolve(assetRoot, 'LICENSE.txt'), 'utf8');
  if (!license.includes('Creative Commons') && !license.includes('CC0')) {
    errors.push('LICENSE.txt: expected the Quaternius CC0 license text');
  }
  if (totalBytes > MAX_TOTAL_BYTES) {
    errors.push(`Total avatar package exceeds ${MAX_TOTAL_BYTES} bytes: ${totalBytes}`);
  }

  if (errors.length) {
    throw new Error(`Quaternius avatar validation failed:\n- ${errors.join('\n- ')}`);
  }
  return { reports, totalBytes };
}

async function main() {
  const result = await runQuaterniusAvatarValidation();
  console.log(
    `PASS Quaternius avatar package: ${result.totalBytes} bytes, `
    + `${Object.keys(result.reports).length} GLB files`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
