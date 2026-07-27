import { describe, expect, it } from 'vitest';
import { applySceneOperationPlan, sceneOperationPlanSchema } from './exhibitionSceneOperations.js';

function createScene() {
  return {
    roomSize: {
      width: 20, length: 20, height: 6, wallThickness: 0.1,
      wallColor: '#fff', wallMaterialPreset: 'paint', wallTextureUrl: '/wall.svg',
      wallTextureTiling: 3, wallRoughness: 0.35, wallMetalness: 0.08,
      wallBumpScale: 0.04, wallEnvIntensity: 0.9, wallOpacity: 0.98,
      wallTransmission: 0, wallIor: 1.45, floorColor: '#111',
      floorTextureUrl: '/floor.svg', floorTextureTiling: 2.5, floorRoughness: 0.55,
      floorMetalness: 0.18, environmentBrightness: 0.45,
    },
    items: [{
      id: 'painting-user-1', type: 'painting', position: [0, 2.5, -9.8],
      rotation: [0, 0, 0], scale: [1, 1, 1], content: '/api/media/assets/one',
      assetId: 'asset-one', assetUrl: '/api/media/assets/one', title: 'Original',
    }, {
      id: 'ai-title', type: 'text', position: [0, 4, -9.8], rotation: [0, 0, 0],
      scale: [1, 1, 1], content: 'Old title',
    }],
    floorPlanElements: [],
    wallMaterialOverrides: {},
  };
}

const plan = (operations) => ({ schemaVersion: 1, summary: 'Improve the layout', operations });

describe('sceneOperationPlanSchema', () => {
  it('rejects unknown operations and more than 100 operations', () => {
    expect(() => sceneOperationPlanSchema.parse(plan([{ type: 'replace-scene' }]))).toThrow();
    expect(() => sceneOperationPlanSchema.parse(plan(Array.from({ length: 101 }, () => ({
      type: 'update-room-style', wallColor: '#fff',
    }))))).toThrow();
  });

  it('rejects media fields in copy operations', () => {
    expect(() => applySceneOperationPlan(createScene(), plan([{
      type: 'update-item-copy', itemId: 'painting-user-1', content: 'https://attacker.test/replacement',
    }]))).toThrow(expect.objectContaining({ code: 'INVALID_SCENE_OPERATION' }));
  });
});

describe('applySceneOperationPlan', () => {
  it('immutably moves an existing item and preserves its media metadata', () => {
    const current = createScene();
    const result = applySceneOperationPlan(current, plan([{
      type: 'move-item', itemId: 'painting-user-1', position: [-8, 2.5, 0], rotation: [0, Math.PI / 2, 0],
    }]));

    expect(current.items[0].position).toEqual([0, 2.5, -9.8]);
    expect(result.scene.items[0]).toMatchObject({
      id: 'painting-user-1', content: '/api/media/assets/one', assetId: 'asset-one', assetUrl: '/api/media/assets/one',
    });
    expect(result.scene.items[0].position).not.toEqual(current.items[0].position);
  });

  it('rejects unknown IDs, duplicate IDs, and removal of protected items', () => {
    expect(() => applySceneOperationPlan(createScene(), plan([{
      type: 'move-item', itemId: 'missing', position: [0, 0, 0],
    }]))).toThrow(expect.objectContaining({ code: 'INVALID_SCENE_OPERATION' }));
    expect(() => applySceneOperationPlan(createScene(), plan([{
      type: 'add-text', id: 'ai-title', position: [0, 2, 0], content: 'Duplicate',
    }]))).toThrow(/Duplicate/);
    expect(() => applySceneOperationPlan(createScene(), plan([{
      type: 'remove-generated-item', itemId: 'painting-user-1',
    }]))).toThrow(/protected/);
  });

  it('adds and removes allowlisted generated items', () => {
    const added = applySceneOperationPlan(createScene(), plan([{
      type: 'add-furniture', id: 'ai-bench-2', itemType: 'bench', position: [2, 0, 2], content: '#333',
    }, {
      type: 'remove-generated-item', itemId: 'ai-title',
    }]));

    expect(added.scene.items.some((item) => item.id === 'ai-bench-2' && item.type === 'bench')).toBe(true);
    expect(added.scene.items.some((item) => item.id === 'ai-title')).toBe(false);
  });
});
