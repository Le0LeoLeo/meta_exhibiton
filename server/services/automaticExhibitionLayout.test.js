import { describe, expect, it } from 'vitest';
import { buildAutomaticExhibition, assertAssetCoverage, assertAutomaticExhibitionLayout } from './automaticExhibitionLayout.js';
import { sanitizeSceneSnapshot } from '../schemas/sceneSchema.js';
import { getPaintingImageFit } from '../../src/app/modules/metaverse3d/paintingImageFit';
import { DEFAULT_ARTWORK_CENTER_HEIGHT } from '../../src/app/modules/metaverse3d/sceneScale';
import { buildWallTopology, getFloorPlanRoomBounds } from '../../src/app/modules/metaverse3d/store/floorPlanGeometry';

const ASPECTS = {
  landscape: [[1600, 900]],
  portrait: [[900, 1600]],
  square: [[1200, 1200]],
  panorama: [[10000, 1]],
  narrow: [[1, 10000]],
  mixed: [[1600, 900], [900, 1600], [1200, 1200], [10000, 1], [1, 10000]],
};

function createInput(count = 5, shape = 'mixed') {
  return {
    language: 'en', style: 'white-box',
    assets: Array.from({ length: count }, (_, order) => {
      const [width, height] = ASPECTS[shape][order % ASPECTS[shape].length];
      return {
        assetId: `asset-${order}`, order, fileName: `art.${order}.jpg`, mimeType: 'image/jpeg', width, height,
      };
    }),
  };
}

// Use the renderer's actual frame opening and plaque footprint, independently
// of the server's packing/validation implementation.
function renderedBounds(item) {
  const fit = getPaintingImageFit(item.frameWidth, item.frameHeight, item.imageAspectRatio);
  const horizontal = Math.abs(Math.sin(item.rotation[1])) < 0.5;
  const halfWidth = Math.max(fit.outerWidth, 1.7) / 2;
  return {
    fit,
    minX: item.position[0] - (horizontal ? halfWidth : 0.1),
    maxX: item.position[0] + (horizontal ? halfWidth : 0.1),
    minZ: item.position[2] - (horizontal ? 0.1 : halfWidth),
    maxZ: item.position[2] + (horizontal ? 0.1 : halfWidth),
    minY: item.position[1] - item.frameHeight / 2 - 0.35 - 0.16,
    maxY: item.position[1] + fit.outerHeight / 2,
  };
}

function assertRenderedLayout(scene) {
  const { width, length, height, wallThickness } = scene.roomSize;
  expect(width).toBeGreaterThanOrEqual(8);
  expect(width).toBeLessThanOrEqual(40);
  expect(length).toBeGreaterThanOrEqual(8);
  expect(length).toBeLessThanOrEqual(60);
  const boxes = scene.items.map(renderedBounds);
  const halfWall = Math.max(0.12, wallThickness) / 2;
  for (const [index, box] of boxes.entries()) {
    expect(box.minX).toBeGreaterThanOrEqual(-width / 2 + wallThickness / 2);
    expect(box.maxX).toBeLessThanOrEqual(width / 2 - wallThickness / 2);
    expect(box.minZ).toBeGreaterThanOrEqual(-length / 2 + wallThickness / 2);
    expect(box.maxZ).toBeLessThanOrEqual(length / 2 - wallThickness / 2);
    expect(box.minY).toBeGreaterThan(0);
    expect(box.maxY).toBeLessThan(height);
    // The frame back should sit 2mm off an actual rendered wall, including Room's minimum thickness.
    expect(Math.min(
      box.minX + width / 2 - halfWall, width / 2 - halfWall - box.maxX,
      box.minZ + length / 2 - halfWall, length / 2 - halfWall - box.maxZ,
    )).toBeCloseTo(0.002, 8);
    expect(scene.items[index].position[1]).toBe(DEFAULT_ARTWORK_CENTER_HEIGHT);
    expect(scene.items[index].scale).toEqual([1, 1, 1]);
    // Reserve the south-side entry and approach, including all frame/plaque edges.
    expect(box.maxZ <= length / 2 - 1.2 || box.maxX <= -1.2 || box.minX >= 1.2).toBe(true);
    for (const other of boxes.slice(0, index)) {
      const dx = Math.max(0, box.minX - other.maxX, other.minX - box.maxX);
      const dz = Math.max(0, box.minZ - other.maxZ, other.minZ - box.maxZ);
      expect(Math.hypot(dx, dz)).toBeGreaterThanOrEqual(0.5 - 1e-8);
    }
  }
}

describe('buildAutomaticExhibition', () => {
  for (const count of [1, 5, 15, 30]) {
    it.each(Object.keys(ASPECTS))(`places all ${count} %s artworks deterministically inside valid geometry`, (shape) => {
      const input = createInput(count, shape);
      const original = structuredClone(input);
      const result = buildAutomaticExhibition(input);
      expect(input).toEqual(original);
      expect(buildAutomaticExhibition(input)).toEqual(result);
      expect(result).toMatchObject({ layoutVersion: 2, uploadedCount: count, placedCount: count, warnings: [] });
      expect(result.includedAssetIds).toEqual(input.assets.map((asset) => asset.assetId));
      expect(result.scene.items).toHaveLength(count);
      result.scene.items.forEach((item, index) => {
        const asset = input.assets[index];
        expect(item).toMatchObject({
          id: `artwork-${asset.assetId}`, assetId: asset.assetId, type: 'painting',
          content: `/api/media/${asset.assetId}`, assetUrl: `/api/media/${asset.assetId}`,
          fileName: asset.fileName, fileMimeType: asset.mimeType,
          imageAspectRatio: asset.width / asset.height, artist: '', description: '',
        });
        const fit = renderedBounds(item).fit;
        expect(fit.imageWidth / fit.imageHeight).toBeCloseTo(asset.width / asset.height, 8);
        expect(fit.imageWidth).toBeLessThanOrEqual(fit.canvasWidth);
        expect(fit.imageHeight).toBeLessThanOrEqual(fit.canvasHeight);
      });
      assertRenderedLayout(result.scene);
      expect(sanitizeSceneSnapshot(JSON.parse(JSON.stringify(result.scene)))).toEqual(result.scene);
      const [room] = result.scene.floorPlanElements;
      expect(room).toMatchObject({ type: 'room', position: [0, 0.02, 0], scale: [result.scene.roomSize.width, 0.04, result.scene.roomSize.length] });
      const topology = buildWallTopology(
        getFloorPlanRoomBounds(result.scene.floorPlanElements, result.scene.roomSize.width, result.scene.roomSize.length),
        result.scene.roomSize.height, result.scene.roomSize.wallThickness, { x: 0, z: 0 },
      );
      expect(topology.segments.map((segment) => segment.face)).toEqual(['north', 'south', 'east', 'west']);
    });
  }

  it('supports every count from 1 through 30', () => {
    for (let count = 1; count <= 30; count++) {
      const result = buildAutomaticExhibition(createInput(count));
      expect(result.scene.items).toHaveLength(count);
      assertRenderedLayout(result.scene);
    }
  });

  it('orders by selection order, keeps ties stable and preserves distinct assets with identical names', () => {
    const input = createInput(4);
    input.assets.forEach((asset) => { asset.fileName = 'same.name.png'; asset.mimeType = 'image/png'; });
    input.assets[2].order = 1;
    [input.assets[0], input.assets[3]] = [input.assets[3], input.assets[0]];
    expect(buildAutomaticExhibition(input).includedAssetIds).toEqual(['asset-0', 'asset-1', 'asset-2', 'asset-3']);
  });

  it.each([['zh-TW', '我的作品展'], ['zh-CN', '我的作品展'], ['en', 'My Art Exhibition']])('defaults the title for %s', (language, title) => {
    expect(buildAutomaticExhibition({ ...createInput(1), language, title: '  ' }).title).toBe(title);
  });

  it('keeps supplied text and uses only the filename stem for missing artwork titles', () => {
    const input = createInput(2);
    input.title = '  An exhibition  ';
    Object.assign(input.assets[0], { title: 'A supplied title', artist: 'A real artist', description: 'Supplied context' });
    const result = buildAutomaticExhibition(input);
    expect(result.title).toBe('An exhibition');
    expect(result.scene.items[0]).toMatchObject({ title: 'A supplied title', artist: 'A real artist', description: 'Supplied context' });
    expect(result.scene.items[1].title).toBe('art.1');
  });

  it('derives canonical URLs only from the unchanged ID, ignoring supplied URLs', () => {
    const input = createInput(1);
    Object.assign(input.assets[0], {
      assetId: 'A12_B-345', mimeType: 'image/webp', fileName: '作品.webp',
      assetUrl: 'blob:preview', content: 'https://example.com/replacement?accessToken=temporary',
    });
    expect(buildAutomaticExhibition(input).scene.items[0]).toMatchObject({
      id: 'artwork-A12_B-345', assetId: 'A12_B-345',
      content: '/api/media/A12_B-345', assetUrl: '/api/media/A12_B-345', title: '作品',
    });
  });

  it.each([[0, 'EMPTY_EXHIBITION'], [31, 'TOO_MANY_ASSETS']])('rejects %s artworks explicitly', (count, code) => {
    expect(() => buildAutomaticExhibition(createInput(count))).toThrow(expect.objectContaining({ code, status: 422 }));
  });

  it('rejects duplicate IDs without deduplicating the list', () => {
    const input = createInput(2);
    input.assets[1].assetId = input.assets[0].assetId;
    expect(() => buildAutomaticExhibition(input)).toThrow(/ASSET_COVERAGE_MISMATCH/);
  });

  it.each([undefined, null, 0, -1, NaN, Infinity, '1200', 1.2])('rejects missing or invalid pixel dimensions %s', (value) => {
    for (const key of ['width', 'height']) {
      const input = createInput(1);
      input.assets[0][key] = value;
      expect(() => buildAutomaticExhibition(input)).toThrow(/ASSET_DIMENSIONS_UNAVAILABLE/);
    }
  });

  it.each([
    { assetId: '' }, { assetId: '../other' }, { assetId: 'id?accessToken=secret' }, { assetId: 'id#other' },
    { assetId: ' id ' }, { order: -1 }, { order: NaN }, { order: 0.5 }, { fileName: '' },
    { mimeType: 'image/gif' }, { mimeType: 'video/mp4' }, { title: 23 }, { artist: null },
  ])('rejects invalid asset input %j', (patch) => {
    const input = createInput(1);
    Object.assign(input.assets[0], patch);
    expect(() => buildAutomaticExhibition(input)).toThrow(/INVALID_EXHIBITION_INPUT/);
  });

  it.each([null, undefined, {}])('rejects incomplete exhibition input %j', (input) => {
    expect(() => buildAutomaticExhibition(input)).toThrow(/INVALID_EXHIBITION_INPUT/);
  });

  it.each([{ style: 'museum' }, { language: 'fr' }, { language: ['en'] }, { assets: null }, { title: 123 }])('rejects invalid exhibition input %j', (patch) => {
    expect(() => buildAutomaticExhibition({ ...createInput(1), ...patch })).toThrow(/INVALID_EXHIBITION_INPUT/);
  });
});

describe('automatic exhibition validation', () => {
  it('validates saved legacy layouts by version without moving them or accepting floating new layouts', () => {
    const result = buildAutomaticExhibition(createInput(30));
    const scene = structuredClone(result.scene);
    const shift = 0.35 - (Math.max(0.12, scene.roomSize.wallThickness) / 2 + 0.1 + 0.002);
    for (const item of scene.items) {
      item.position[0] += Math.sin(item.rotation[1]) * shift;
      item.position[2] += Math.cos(item.rotation[1]) * shift;
    }
    const saved = structuredClone(scene);
    expect(() => assertAutomaticExhibitionLayout(scene, result.includedAssetIds, 1)).not.toThrow();
    expect(scene).toEqual(saved);
    expect(() => assertAutomaticExhibitionLayout(scene, result.includedAssetIds, 2)).toThrow(/LAYOUT_NOT_POSSIBLE/);
    expect(() => assertAutomaticExhibitionLayout(result.scene, result.includedAssetIds, 3)).toThrow(/LAYOUT_NOT_POSSIBLE/);
  });

  it('checks sets and duplicates, not just counts', () => {
    expect(() => assertAssetCoverage(['a', 'b'], ['b', 'a'])).not.toThrow();
    for (const [expected, actual] of [[['a', 'b'], ['a', 'c']], [['a', 'b'], ['a', 'a']], [['a', 'a'], ['a']], [['a'], []]]) {
      expect(() => assertAssetCoverage(expected, actual)).toThrow(/ASSET_COVERAGE_MISMATCH/);
    }
  });

  it.each(['content', 'assetUrl', 'id', 'assetId'])('rejects a replaced %s even with unchanged artwork count', (field) => {
    const result = buildAutomaticExhibition(createInput(2));
    result.scene.items[0][field] = 'replacement';
    expect(() => assertAutomaticExhibitionLayout(result.scene, result.includedAssetIds)).toThrow(/ASSET_COVERAGE_MISMATCH/);
  });

  it.each(['content', 'assetUrl'])('rejects temporary credentials in %s', (field) => {
    const result = buildAutomaticExhibition(createInput(1));
    result.scene.items[0][field] += '?accessToken=temporary';
    expect(() => assertAutomaticExhibitionLayout(result.scene, result.includedAssetIds)).toThrow(/ASSET_COVERAGE_MISMATCH/);
  });

  it('rejects collisions, entry obstruction, oversized rooms and frames instead of repairing them', () => {
    const result = buildAutomaticExhibition(createInput(15));
    const mutations = [
      (scene) => { scene.items[1].position = [...scene.items[0].position]; scene.items[1].rotation = [...scene.items[0].rotation]; },
      (scene) => { scene.items[0].position = [0, 1.55, scene.roomSize.length / 2 - 0.162]; scene.items[0].rotation = [0, Math.PI, 0]; },
      (scene) => { scene.roomSize.width = 41; },
      (scene) => { scene.items[0].frameWidth = 100; },
      (scene) => { scene.items[0].frameHeight = 10; },
      (scene) => { scene.items[0].position[1] = 2.5; },
      (scene) => { scene.items[0].scale = [2, 2, 2]; },
    ];
    for (const mutate of mutations) {
      const scene = structuredClone(result.scene);
      mutate(scene);
      const original = structuredClone(scene);
      expect(() => assertAutomaticExhibitionLayout(scene, result.includedAssetIds)).toThrow(/LAYOUT_NOT_POSSIBLE/);
      expect(scene).toEqual(original);
    }
  });
});
