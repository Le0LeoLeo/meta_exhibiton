import {
  copyFile,
  mkdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { EXTTextureWebP } from '@gltf-transform/extensions';
import {
  dedup,
  prune,
  resample,
  textureCompress,
} from '@gltf-transform/functions';
import sharp from 'sharp';

const BASE_ARCHIVE_FOLDER = 'Universal Base Characters[Standard]';
const ANIMATION_ARCHIVE_FOLDER = 'Universal Animation Library[Standard]';
const OUTFIT_ARCHIVE_FOLDER = 'Modular Character Outfits - Fantasy[Standard]';
const BODY_FOLDER = join(BASE_ARCHIVE_FOLDER, 'Base Characters', 'Godot - UE');
const HAIR_FOLDER = join(
  BASE_ARCHIVE_FOLDER,
  'Hairstyles',
  'Origin at 0',
  'glTF (Godot)',
);
const ANIMATION_FILE = join(
  ANIMATION_ARCHIVE_FOLDER,
  'Unreal-Godot',
  'UAL1_Standard.glb',
);
const OUTFIT_FOLDER = join(
  OUTFIT_ARCHIVE_FOLDER,
  'Exports',
  'glTF (Godot-Unreal)',
  'Outfits',
);
const BODY_ASSETS = [
  ['body01', 'Superhero_Male_FullBody.gltf'],
  ['body02', 'Superhero_Female_FullBody.gltf'],
];
const HAIR_ASSETS = [
  ['hair01', 'Hair_SimpleParted.gltf'],
  ['hair02', 'Hair_Buns.gltf'],
  ['hair03', 'Hair_Long.gltf'],
];
const OUTFIT_ASSETS = [
  ['body01', 'Male_Ranger.gltf'],
  ['body02', 'Female_Ranger.gltf'],
];
const CLIP_SELECTION = new Map([
  ['Idle_Loop', { name: 'Idle', duration: 2.5 }],
  ['Walk_Formal_Loop', { name: 'Walk', duration: 1 }],
  ['Interact', { name: 'Wave', duration: 2 }],
]);

function usage() {
  return [
    'Usage:',
    '  node scripts/prepare-quaternius-avatar.mjs',
    '    --base <extracted Universal Base Characters root>',
    '    --animations <extracted Universal Animation Library root>',
    '    --outfits <extracted Modular Character Outfits root>',
    '    [--output public/models/avatars/quaternius-v1]',
  ].join('\n');
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith('--') || !value) throw new Error(usage());
    values.set(flag.slice(2), value);
  }
  if (
    !values.has('base')
    || !values.has('animations')
    || !values.has('outfits')
  ) {
    throw new Error(usage());
  }
  return {
    base: resolve(values.get('base')),
    animations: resolve(values.get('animations')),
    outfits: resolve(values.get('outfits')),
    output: resolve(
      values.get('output') ?? 'public/models/avatars/quaternius-v1',
    ),
  };
}

async function optimizeAsset(io, input, output) {
  const document = await io.read(input);
  await document.transform(
    dedup(),
    prune(),
    textureCompress({
      encoder: sharp,
      targetFormat: 'webp',
      resize: [512, 512],
      effort: 80,
    }),
  );
  await io.write(output, document);
}

async function optimizeOutfitAsset(io, input, output) {
  const document = await io.read(input);
  const decorativePartPattern =
    /_(?:Acc_|Arms_Bracer|Body_Belt_|Head_Hood)/u;
  for (const node of document.getRoot().listNodes()) {
    if (decorativePartPattern.test(node.getName())) node.dispose();
  }
  await document.transform(
    dedup(),
    prune(),
    textureCompress({
      encoder: sharp,
      targetFormat: 'webp',
      resize: [512, 512],
      effort: 80,
    }),
  );
  await io.write(output, document);
}

async function ensureExportAliases(baseRoot) {
  const folder = join(baseRoot, BODY_FOLDER);
  const textures = join(baseRoot, BASE_ARCHIVE_FOLDER, 'Base Characters', 'Textures');
  await Promise.all([
    copyFile(
      join(folder, 'T_Eye_Normal.png'),
      join(folder, 'T_Eye_Normal_png.png'),
    ),
    copyFile(
      join(folder, 'T_Hair_1_Normal.png'),
      join(folder, 'T_Hair_1_Normal_png.png'),
    ),
    copyFile(
      join(textures, 'T_Superhero_Male_Ligh.png'),
      join(folder, 'T_Superhero_Male_Dark.png'),
    ),
    copyFile(
      join(textures, 'T_Superhero_Female_Light_BaseColor.png'),
      join(folder, 'T_Superhero_Female_Dark_BaseColor.png'),
    ),
  ]);
}

function scaleAnimationDuration(animation, targetDuration) {
  const sourceDuration = animation
    .listSamplers()
    .reduce((maximum, sampler) => {
      const times = sampler.getInput()?.getArray();
      if (!times?.length) return maximum;
      return Math.max(maximum, times[times.length - 1]);
    }, 0);
  if (!sourceDuration || sourceDuration === targetDuration) return;

  const scale = targetDuration / sourceDuration;
  const visited = new Set();
  for (const sampler of animation.listSamplers()) {
    const input = sampler.getInput();
    if (!input || visited.has(input)) continue;
    visited.add(input);
    const values = input.getArray();
    input.setArray(new Float32Array(Array.from(values, (value) => value * scale)));
  }
}

async function prepareAnimations(io, input, output) {
  const document = await io.read(input);
  for (const animation of document.getRoot().listAnimations()) {
    const selection = CLIP_SELECTION.get(animation.getName());
    if (!selection) {
      animation.dispose();
      continue;
    }
    animation.setName(selection.name);
    scaleAnimationDuration(animation, selection.duration);
  }
  const usedAccessors = new Set();
  for (const animation of document.getRoot().listAnimations()) {
    for (const sampler of animation.listSamplers()) {
      if (sampler.getInput()) usedAccessors.add(sampler.getInput());
      if (sampler.getOutput()) usedAccessors.add(sampler.getOutput());
    }
  }
  for (const accessor of document.getRoot().listAccessors()) {
    if (!usedAccessors.has(accessor)) accessor.dispose();
  }
  for (const mesh of document.getRoot().listMeshes()) mesh.dispose();
  await document.transform(resample(), dedup(), prune());
  await io.write(output, document);
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const io = new NodeIO().registerExtensions([EXTTextureWebP]);
  await rm(args.output, { recursive: true, force: true });
  await mkdir(args.output, { recursive: true });
  await ensureExportAliases(args.base);

  for (const [id, filename] of BODY_ASSETS) {
    await optimizeAsset(
      io,
      join(args.base, BODY_FOLDER, filename),
      join(args.output, `${id}.glb`),
    );
  }
  for (const [id, filename] of HAIR_ASSETS) {
    await optimizeAsset(
      io,
      join(args.base, HAIR_FOLDER, filename),
      join(args.output, `${id}.glb`),
    );
  }
  for (const [id, filename] of OUTFIT_ASSETS) {
    await optimizeOutfitAsset(
      io,
      join(args.outfits, OUTFIT_FOLDER, filename),
      join(args.output, `outfit-${id}.glb`),
    );
  }
  await prepareAnimations(
    io,
    join(args.animations, ANIMATION_FILE),
    join(args.output, 'animations.glb'),
  );

  const baseLicense = await readFile(
    join(args.base, BASE_ARCHIVE_FOLDER, 'License_Standard.txt'),
    'utf8',
  );
  const animationLicense = await readFile(
    join(args.animations, ANIMATION_ARCHIVE_FOLDER, 'License.txt'),
    'utf8',
  );
  const outfitLicense = await readFile(
    join(args.outfits, OUTFIT_ARCHIVE_FOLDER, 'License_Standard.txt'),
    'utf8',
  );
  await writeFile(
    join(args.output, 'LICENSE.txt'),
    [
      'Quaternius Universal Base Characters — Standard',
      baseLicense.trim(),
      '',
      'Quaternius Universal Animation Library — Standard',
      animationLicense.trim(),
      '',
      'Quaternius Modular Character Outfits — Fantasy Standard',
      outfitLicense.trim(),
      '',
      'Source pages:',
      'https://quaternius.com/packs/universalbasecharacters.html',
      'https://quaternius.com/packs/universalanimationlibrary.html',
      'https://quaternius.com/packs/modularcharacteroutfitsfantasy.html',
      '',
    ].join('\n'),
  );
  await writeFile(
    join(args.output, 'README.md'),
    [
      '# Quaternius Avatar Kit',
      '',
      'This generated directory contains two rigged bodies, three hairstyles,',
      'two optional ranger-derived source outfits, and Idle/Walk/Wave animations.',
      'Decorative fantasy parts such as hoods, pauldrons, bracers, and belts',
      'are removed during preparation. The runtime derives casual garment layers',
      'from the body skin so every clothing option follows the same skeleton.',
      '',
      'All source models are by Quaternius and released under CC0. See',
      '`LICENSE.txt` for the bundled license text and original source URLs.',
      '',
      'Run `npm run prepare:avatar -- --base <path> --animations <path>',
      '--outfits <path>` followed by `npm run check:avatar` to rebuild.',
      '',
    ].join('\n'),
  );

  console.log(`Prepared Quaternius avatar assets in ${args.output}`);
  console.log(
    [...BODY_ASSETS, ...HAIR_ASSETS]
      .map(([id, file]) => `${id}: ${basename(file)}`)
      .join('\n'),
  );
}

await main();
