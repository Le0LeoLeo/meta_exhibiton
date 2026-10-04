import { describe, it, expect } from 'vitest';
import { sanitizeSceneSnapshot } from '../schemas/sceneSchema.js';
import { applySceneOperationPlan, sceneOperationJsonSchema } from './exhibitionSceneOperations.js';
import { inspectWallClearance } from './exhibitionScenePreflight.js';
import { describeExhibitionWalls, inspectExhibitionDividers, textDisplaySize } from './exhibitionSpatialTools.js';

const scene = () => sanitizeSceneSnapshot({ roomSize: { width: 20, length: 20, height: 6, wallThickness: 0.1 },
  items: Array.from({ length: 9 }, (_, index) => ({ id: `work-${index}`, type: 'painting',
    position: [0, 2.5, -9.65], rotation: [0, 0, 0], scale: [1, 1, 1],
    content: `/art/${index}.png`, assetId: `asset-${index}`, frameWidth: 2, frameHeight: 1.5 })),
  floorPlanElements: [], wallMaterialOverrides: {} });
const arrange = () => ({ type: 'arrange-exhibition-sections', gap: 0.5,
  sections: ['north', 'west', 'east'].map((wall, index) => ({ wall, title: ['歷史', '當代', '未來'][index],
    itemIds: Array.from({ length: 3 }, (_, i) => `work-${index * 3 + i}`) })) });
const run = (source, operations) => applySceneOperationPlan(source, { schemaVersion: 1, summary: 'Arrange three sections', operations });

describe('semantic exhibition spatial tools', () => {
  it('reserves the rendered default text font and full backboard without an 8 metre truncation', () => {
    expect(textDisplaySize({ content: 'Existing exhibition title' }).width).toBeCloseTo(8.69);
    expect(textDisplaySize({ content: 'History', textFontSize: 0.18 }).width).toBeCloseTo(1.4828);
    const source = scene();
    source.items = [{ id: 'existing', type: 'text', content: 'Existing exhibition title', position: [0, 4, -9.65], rotation: [0, 0, 0], scale: [1, 1, 1] },
      { id: 'section-1-title', type: 'text', content: 'History', textFontSize: 0.18, position: [-3.5, 4, -9.65], rotation: [0, 0, 0], scale: [1, 1, 1] }];
    expect(inspectWallClearance(source)).toHaveLength(1);
  });
  it('arranges three sections with real frame bounds, intact media and no overlapping captions', () => {
    const source = scene(); const before = structuredClone(source);
    source.items[0].frameWidth = 3;
    const result = run(source, [arrange()]);
    expect(inspectWallClearance(result.scene)).toEqual([]);
    expect(result.scene.items.filter((item) => item.type === 'text')).toHaveLength(3);
    expect(result.scene.items.filter((item) => item.type === 'painting').map((item) => item.content)).toEqual(before.items.map((item) => item.content));
    expect(source.items[1].position).toEqual(before.items[1].position);
    expect(describeExhibitionWalls(result.scene).map((wall) => wall.occupiedDisplays.length)).toEqual([4, 4, 4]);
    expect(JSON.stringify(sceneOperationJsonSchema)).toContain('arrange-exhibition-sections');
  });

  it.each(['Existing exhibition title', '現有展覽總覽'])('places new headings around an existing locked sign (%s) and preserves it on repeat arrangements', (content) => {
    const source = scene();
    const sign = { id: 'user-sign', type: 'text', content, position: [0, 4, -9.65], rotation: [0, 0, 0], scale: [1, 1, 1], isLocked: true };
    source.items.push(sign);
    const result = run(source, [arrange()]);
    expect(result.scene.items.find((item) => item.id === sign.id)).toEqual(sign);
    expect(result.warnings).toEqual([]);
    expect(result.scene.items.find((item) => item.id === 'section-1-title').position).not.toEqual(sign.position);
    expect(run(result.scene, [arrange()]).scene).toEqual(result.scene);
    expect(inspectWallClearance(result.scene)).toEqual([]);
  });

  it.each(['duplicate', 'missing', 'locked', 'wide', 'tall', 'wall', 'room', 'sign'])(
    'rejects %s targets without partial mutation', (kind) => {
      const source = scene(); const operation = arrange();
      if (kind === 'duplicate') operation.sections[1].itemIds[0] = 'work-0';
      if (kind === 'missing') operation.sections[0].itemIds[0] = 'missing';
      if (kind === 'locked') source.items[0].isLocked = true;
      if (kind === 'wide') source.items[0].scale = [10, 1, 1];
      if (kind === 'tall') source.items[0].scale = [1, 4, 1];
      if (kind === 'wall') operation.sections[1].wall = 'north';
      if (kind === 'room') source.floorPlanElements = [{ id: 'wall-1', type: 'wall', position: [0, 0, 0], rotation: [0, 0, 0], scale: [3, 1, 0.2] }];
      if (kind === 'sign') source.items.push({ id: 'user-sign', type: 'text', content: 'Existing', position: [0, 4, -9.65], rotation: [0, 0, 0], scale: [20, 20, 1] });
      const before = structuredClone(source);
      expect(() => run(source, [{ type: 'update-room-style', wallColor: '#123456' }, operation])).toThrow();
      expect(source).toEqual(before);
    },
  );

  it('creates split partitions with an exact central aisle and preserves arranged works', () => {
    const result = run(scene(), [arrange(), { type: 'create-exhibition-divider', id: 'ai-divider-one', atZ: 6, aisleWidth: 2.4 }]);
    const partitions = result.scene.items.filter((item) => item.type === 'partition');
    expect(partitions).toHaveLength(2);
    expect(partitions[1].position[0] - partitions[1].scale[0] / 2).toBeCloseTo(1.2);
    expect(partitions[0].position[0] + partitions[0].scale[0] / 2).toBeCloseTo(-1.2);
    expect(partitions.every((item) => item.position[1] === 3 && item.scale[1] === 6)).toBe(true);
    expect(inspectExhibitionDividers(result.scene)).toEqual([]);
    partitions[0].position[0] = 0;
    expect(inspectExhibitionDividers(result.scene)[0]).toMatchObject({ severity: 'high', resolution: 'automatic' });
  });

  it.each([0, 9])('rejects divider at occupied or out-of-bounds z=%s', (atZ) => {
    expect(() => run(scene(), [arrange(), { type: 'create-exhibition-divider', id: 'ai-divider-one', atZ }])).toThrow(/DIVIDER/);
  });

  it('rejects a narrow aisle at the schema boundary', () => {
    expect(() => run(scene(), [{ type: 'create-exhibition-divider', id: 'ai-divider-one', atZ: 6, aisleWidth: 0.5 }])).toThrow();
  });
});
