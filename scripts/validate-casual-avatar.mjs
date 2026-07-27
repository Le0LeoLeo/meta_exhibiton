import { access, readFile, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createAvatarReport } from './validate-avatar-kit.mjs';

export const CASUAL_ASSET_ROOT = resolve(
  process.cwd(),
  'public/models/avatars/casual-v1',
);
const REQUIRED_FILES = [
  'casual1-male.glb',
  'casual1-female.glb',
  'casual2-male.glb',
  'casual2-female.glb',
  'casual3-male.glb',
  'casual3-female.glb',
];
const REQUIRED_BONES = [
  'Bone',
  'Hips',
  'Abdomen',
  'Torso',
  'Neck',
  'Head',
  'Shoulder.L',
  'UpperArm.L',
  'LowerArm.L',
  'Fist.L',
  'Shoulder.R',
  'UpperArm.R',
  'LowerArm.R',
  'Fist.R',
  'UpperLeg.L',
  'LowerLeg.L',
  'Foot.L',
  'UpperLeg.R',
  'LowerLeg.R',
  'Foot.R',
];
const REQUIRED_MATERIALS = ['Skin', 'Shirt', 'Pants', 'Belt', 'Face', 'Hair'];
const EXPECTED_CLIPS = new Map([
  ['Idle', [4.1, 4.2]],
  ['Walk', [1.2, 1.3]],
  ['Wave', [1.8, 1.9]],
]);
const MAX_TOTAL_BYTES = 6_500_000;

export async function runCasualAvatarValidation(
  assetRoot = CASUAL_ASSET_ROOT,
) {
  const errors = [];
  let totalBytes = 0;
  const reports = {};

  for (const filename of REQUIRED_FILES) {
    const filePath = resolve(assetRoot, filename);
    await access(filePath);
    totalBytes += (await stat(filePath)).size;
    const report = await createAvatarReport(filePath);
    reports[filename] = report;

    for (const bone of REQUIRED_BONES) {
      if (!report.nodes.includes(bone)) {
        errors.push(`${filename}: missing bone ${bone}`);
      }
    }
    for (const material of REQUIRED_MATERIALS) {
      if (!report.materials.includes(material)) {
        errors.push(`${filename}: missing material ${material}`);
      }
    }
    if (report.skinCount !== 1) {
      errors.push(`${filename}: expected one skin, found ${report.skinCount}`);
    }
    if (report.triangleCount > 10_000) {
      errors.push(`${filename}: triangle budget exceeded (${report.triangleCount})`);
    }
    if (report.textures.length) {
      errors.push(`${filename}: expected color-only materials, found textures`);
    }
    const clips = new Map(report.clips.map((clip) => [clip.name, clip.duration]));
    for (const [name, [minimum, maximum]] of EXPECTED_CLIPS) {
      const duration = clips.get(name);
      if (duration === undefined) {
        errors.push(`${filename}: missing ${name} clip`);
      } else if (duration < minimum || duration > maximum) {
        errors.push(`${filename}: ${name} duration is ${duration}s`);
      }
    }
    if (clips.size !== EXPECTED_CLIPS.size) {
      errors.push(`${filename}: expected only Idle, Walk, and Wave clips`);
    }
    const minY = report.bounds?.min?.[1];
    const maxY = report.bounds?.max?.[1];
    if (typeof minY !== 'number' || Math.abs(minY) > 0.03) {
      errors.push(`${filename}: feet must remain at y=0 (found ${minY})`);
    }
    if (typeof maxY !== 'number' || maxY < 3.1 || maxY > 3.4) {
      errors.push(`${filename}: unexpected source height ${maxY}`);
    }
  }

  const licensePath = resolve(assetRoot, 'LICENSE.txt');
  const readmePath = resolve(assetRoot, 'README.md');
  await access(licensePath);
  await access(readmePath);
  totalBytes += (await stat(licensePath)).size + (await stat(readmePath)).size;
  const license = await readFile(licensePath, 'utf8');
  if (!license.includes('CC0 1.0')) {
    errors.push('LICENSE.txt: expected the Quaternius CC0 license');
  }
  if (totalBytes > MAX_TOTAL_BYTES) {
    errors.push(`Avatar package exceeds ${MAX_TOTAL_BYTES} bytes: ${totalBytes}`);
  }
  const unexpected = (await readdir(assetRoot))
    .filter((filename) => filename.endsWith('.glb'))
    .filter((filename) => !REQUIRED_FILES.includes(filename));
  if (unexpected.length) {
    errors.push(`Unexpected GLB files: ${unexpected.join(', ')}`);
  }
  if (errors.length) {
    throw new Error(`Casual avatar validation failed:\n- ${errors.join('\n- ')}`);
  }
  return { reports, totalBytes };
}

async function main() {
  const result = await runCasualAvatarValidation();
  console.log(
    `PASS casual avatar package: ${result.totalBytes} bytes, `
    + `${Object.keys(result.reports).length} complete characters`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
