import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createAvatarReport,
  REQUIRED_MATERIALS,
  REQUIRED_NODES,
  runAvatarValidation,
  validateAvatarReport,
} from './validate-avatar-kit.mjs';

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    rm(directory, { recursive: true, force: true })
  )));
});

function validReport(overrides = {}) {
  return {
    nodes: REQUIRED_NODES,
    materials: REQUIRED_MATERIALS,
    clips: [
      { name: 'Idle', duration: 3 },
      { name: 'Walk', duration: 1 },
      { name: 'Wave', duration: 2 },
    ],
    skinCount: 1,
    skinningIssues: [],
    rootMotionClips: [],
    triangleCount: 29_500,
    textures: [{ name: 'atlas', width: 1024, height: 1024 }],
    bounds: { min: [-0.4, 0, -0.2], max: [0.4, 1.75, 0.2] },
    headForward: [0, 0, -1],
    ...overrides,
  };
}

function syntheticGltf({
  rootMotion = false,
  includeSkin = true,
  includeWeights = true,
} = {}) {
  const nodes = REQUIRED_NODES.map((name) => ({ name }));
  const rootIndex = REQUIRED_NODES.indexOf('Root');
  const headIndex = REQUIRED_NODES.indexOf('Head');
  const bodyIndex = REQUIRED_NODES.indexOf('Body_body01');
  nodes[bodyIndex].mesh = 0;
  if (includeSkin) nodes[bodyIndex].skin = 0;

  const attributes = { POSITION: 0, JOINTS_0: 1 };
  if (includeWeights) attributes.WEIGHTS_0 = 2;
  const animations = [
    ['Idle', 2, 5],
    ['Walk', 10, 11],
    ['Wave', 20, 22],
  ].map(([name, minimum, maximum], index) => ({
    name,
    samplers: [{ input: 4 + index, output: 0 }],
    channels: [{
      sampler: 0,
      target: {
        node: rootMotion && name === 'Walk' ? rootIndex : headIndex,
        path: rootMotion && name === 'Walk' ? 'translation' : 'rotation',
      },
    }],
    extras: { minimum, maximum },
  }));

  return {
    asset: { version: '2.0' },
    nodes,
    meshes: [{ primitives: [{ attributes, indices: 3 }] }],
    accessors: [
      { type: 'VEC3', count: 3, min: [-0.4, 0, -0.2], max: [0.4, 1.75, 0.2] },
      { type: 'VEC4', count: 3 },
      { type: 'VEC4', count: 3 },
      { type: 'SCALAR', count: 3 },
      ...animations.map(({ extras }) => ({
        type: 'SCALAR',
        count: 2,
        min: [extras.minimum],
        max: [extras.maximum],
      })),
    ],
    skins: includeSkin ? [{ joints: [rootIndex] }] : [],
    materials: REQUIRED_MATERIALS.map((name) => ({ name })),
    animations: animations.map(({ extras: _extras, ...animation }) => animation),
  };
}

function glbBuffer(gltf) {
  const json = Buffer.from(JSON.stringify(gltf), 'utf8');
  const padding = (4 - (json.length % 4)) % 4;
  const paddedJson = Buffer.concat([json, Buffer.alloc(padding, 0x20)]);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + paddedJson.length, 8);
  header.writeUInt32LE(paddedJson.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  return Buffer.concat([header, paddedJson]);
}

async function writeSyntheticGlb(gltf) {
  const directory = await mkdtemp(join(tmpdir(), 'avatar-validator-'));
  temporaryDirectories.push(directory);
  const assetPath = join(directory, 'fixture.glb');
  await writeFile(assetPath, glbBuffer(gltf));
  return assetPath;
}

describe('validateAvatarReport', () => {
  it('accepts an avatar kit at the contract limits', () => {
    expect(validateAvatarReport(validReport())).toMatchObject({
      valid: true,
      errors: [],
    });
  });

  it('reports missing required nodes and animation clips', () => {
    const result = validateAvatarReport(validReport({
      nodes: REQUIRED_NODES.filter((name) => name !== 'Head_head02'),
      clips: [{ name: 'Idle' }],
    }));

    expect(result.errors).toContain('Missing required node: Head_head02');
    expect(result.errors).toContain('Missing required clip: Walk');
    expect(result.errors).toContain('Missing required clip: Wave');
  });

  it('rejects triangle and texture budget overruns', () => {
    const result = validateAvatarReport(validReport({
      triangleCount: 30_001,
      textures: [
        { name: 'oversized-atlas', width: 2048, height: 1024 },
        { name: 'normal', width: 1024, height: 1024 },
        { name: 'orm', width: 1024, height: 1024 },
        { name: 'hair', width: 1024, height: 1024 },
        { name: 'extra', width: 1024, height: 1024 },
      ],
    }));

    expect(result.errors).toContain('Triangle budget exceeded: 30001 > 30000');
    expect(result.errors).toContain('Texture count exceeded: 5 > 4');
    expect(result.errors).toContain(
      'Texture "oversized-atlas" exceeds 1024x1024: 2048x1024',
    );
  });

  it('rejects an animation outside its duration contract', () => {
    const result = validateAvatarReport(validReport({
      clips: [
        { name: 'Idle', duration: 3 },
        { name: 'Walk', duration: 1.5 },
        { name: 'Wave', duration: 2 },
      ],
    }));

    expect(result.errors).toContain('Clip "Walk" duration must be 0.8–1.2s: 1.5s');
  });

  it('rejects feet above the origin and a head facing away from -Z', () => {
    const result = validateAvatarReport(validReport({
      bounds: { min: [-0.4, 0.02, -0.2], max: [0.4, 1.77, 0.2] },
      headForward: [0, 0, 1],
    }));

    expect(result.errors).toContain('Feet must rest at Y=0 ±0.01: minY=0.02');
    expect(result.errors).toContain('Head forward direction must align with -Z');
  });
});

describe('runAvatarValidation', () => {
  it('clearly skips a missing optional asset', async () => {
    const log = vi.fn();
    const error = vi.fn();

    const exitCode = await runAvatarValidation({
      assetPath: 'missing-avatar-kit.glb',
      mode: 'optional',
      log,
      error,
    });

    expect(exitCode).toBe(0);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('SKIP'));
    expect(error).not.toHaveBeenCalled();
  });

  it('fails a missing required asset', async () => {
    const log = vi.fn();
    const error = vi.fn();

    const exitCode = await runAvatarValidation({
      assetPath: 'missing-avatar-kit.glb',
      mode: 'required',
      log,
      error,
    });

    expect(exitCode).toBe(1);
    expect(log).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('FAIL'));
  });
});

describe('GLB fixture parsing', () => {
  it('derives animation durations from max-min and accepts skinned VEC4 data', async () => {
    const report = await createAvatarReport(
      await writeSyntheticGlb(syntheticGltf()),
    );

    expect(report.clips).toEqual([
      { name: 'Idle', duration: 3 },
      { name: 'Walk', duration: 1 },
      { name: 'Wave', duration: 2 },
    ]);
    expect(report.skinCount).toBe(1);
    expect(report.skinningIssues).toEqual([]);
    expect(report.rootMotionClips).toEqual([]);
    expect(validateAvatarReport(report).valid).toBe(true);
  });

  it('detects missing skin data and Root translation in a real GLB container', async () => {
    const report = await createAvatarReport(
      await writeSyntheticGlb(syntheticGltf({
        rootMotion: true,
        includeSkin: false,
        includeWeights: false,
      })),
    );
    const result = validateAvatarReport(report);

    expect(result.errors).toContain('Avatar kit must contain at least one skin');
    expect(result.errors).toContain('Body_body01 primitive 0 is missing WEIGHTS_0');
    expect(result.errors).toContain('Clip "Walk" animates Root translation');
  });
});
