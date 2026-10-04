import { describe, expect, it } from 'vitest';
import { inspectEditorScene } from './editorScenePreflight.js';
import { applySceneOperationPlan } from './exhibitionSceneOperations.js';
const scene = () => ({ roomSize: { width: 20, length: 20, height: 6, wallThickness: 0.1 }, items: [], floorPlanElements: [], wallMaterialOverrides: {} });
const item = (id, position) => ({ id, type: 'painting', content: '/demo/harbour.svg', position, rotation: [0, 0, 0], scale: [1, 1, 1] });
describe('complete editor geometry review', () => {
  it('uses actual room topology and accepts artwork in a second room', () => {
    const input = scene(); input.floorPlanElements = [{ id: 'main', type: 'room', position: [0, 0.02, 0], rotation: [0, 0, 0], scale: [20, 0.04, 20], isLocked: true },
      { id: 'second', type: 'room', position: [20, 0.02, 0], rotation: [0, 0, 0], scale: [20, 0.04, 20] }];
    input.items = [item('work', [20, 2.5, -9.7])];
    expect(inspectEditorScene(input)).toEqual([]);
    input.items[0].position[0] = 60;
    expect(inspectEditorScene(input)[0].message).toContain('outside');
  });
  it('accepts front/back partition mounts and rejects overlapping displays', () => {
    const input = scene(); input.items = [item('front', [0, 2.5, -9.7]), item('back', [3, 2.5, -9.7])];
    const result = applySceneOperationPlan(input, { schemaVersion: 1, summary: 'Mount', operations: [
      { type: 'add-editor-item', item: { id: 'ai-wall', type: 'partition', content: '#eee', position: [0, 3, 0], rotation: [0, 0, 0], scale: [6, 6, 0.2] } },
      { type: 'mount-on-partition', itemId: 'front', partitionId: 'ai-wall', side: 'front', height: 2.5 },
      { type: 'mount-on-partition', itemId: 'back', partitionId: 'ai-wall', side: 'back', height: 2.5 },
    ] }, { editMode: 'complete' });
    expect(inspectEditorScene(result.scene)).toEqual([]);
    result.scene.items[1] = { ...result.scene.items[0], id: 'back' };
    expect(inspectEditorScene(result.scene).some((issue) => issue.message.includes('overlaps'))).toBe(true);
  });
});
