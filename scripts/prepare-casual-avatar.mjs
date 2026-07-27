import {
  mkdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { EXTTextureWebP } from '@gltf-transform/extensions';
import {
  dedup,
  prune,
  resample,
  textureCompress,
} from '@gltf-transform/functions';
import sharp from 'sharp';

const CHARACTERS = [
  ['casual1-male', 'Casual_Male.gltf'],
  ['casual1-female', 'Casual_Female.gltf'],
  ['casual2-male', 'Casual2_Male.gltf'],
  ['casual2-female', 'Casual2_Female.gltf'],
  ['casual3-male', 'Casual3_Male.gltf'],
  ['casual3-female', 'Casual3_Female.gltf'],
];
const SELECTED_ANIMATIONS = new Map([
  ['Idle', 'Idle'],
  ['Walk', 'Walk'],
  ['Victory', 'Wave'],
]);

function usage() {
  return [
    'Usage:',
    '  node scripts/prepare-casual-avatar.mjs',
    '    --source <folder containing Casual*.gltf and License.txt>',
    '    [--output public/models/avatars/casual-v1]',
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
  if (!values.has('source')) throw new Error(usage());
  return {
    source: resolve(values.get('source')),
    output: resolve(
      values.get('output') ?? 'public/models/avatars/casual-v1',
    ),
  };
}

async function prepareCharacter(io, input, output) {
  const document = await io.read(input);
  for (const animation of document.getRoot().listAnimations()) {
    const outputName = SELECTED_ANIMATIONS.get(animation.getName());
    if (!outputName) {
      animation.dispose();
      continue;
    }
    animation.setName(outputName);
    for (const channel of animation.listChannels()) {
      if (
        channel.getTargetNode()?.getName() === 'Bone'
        && channel.getTargetPath() === 'translation'
      ) {
        channel.dispose();
      }
    }
  }
  await document.transform(
    dedup(),
    prune(),
    resample(),
    textureCompress({
      encoder: sharp,
      targetFormat: 'webp',
      resize: [512, 512],
      effort: 80,
    }),
  );
  await io.write(output, document);
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const io = new NodeIO().registerExtensions([EXTTextureWebP]);
  await rm(args.output, { recursive: true, force: true });
  await mkdir(args.output, { recursive: true });

  for (const [outputName, sourceName] of CHARACTERS) {
    await prepareCharacter(
      io,
      join(args.source, sourceName),
      join(args.output, `${outputName}.glb`),
    );
  }

  const license = await readFile(join(args.source, 'License.txt'), 'utf8');
  await writeFile(
    join(args.output, 'LICENSE.txt'),
    [
      'Quaternius Ultimate Animated Character Pack',
      license.trim(),
      '',
      'Source:',
      'https://quaternius.com/packs/ultimatedanimatedcharacter.html',
      '',
    ].join('\n'),
  );
  await writeFile(
    join(args.output, 'README.md'),
    [
      '# Quaternius Casual Avatar Kit',
      '',
      'Six complete rigged and clothed characters derived from the Casual,',
      'Casual2, and Casual3 models in the Quaternius Ultimate Animated',
      'Character Pack. Each GLB contains Idle, Walk, and Wave animations.',
      '',
      'The models are CC0. See `LICENSE.txt` for the bundled license.',
      '',
    ].join('\n'),
  );
  console.log(`Prepared casual avatar assets in ${args.output}`);
}

await main();
