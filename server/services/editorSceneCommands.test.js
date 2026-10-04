import { describe, it, expect } from 'vitest';
import { applySceneOperationPlan } from './exhibitionSceneOperations.js';
const source = () => ({ roomSize: { width: 20, length: 20, height: 6, wallThickness: 0.1 },
  items: [{ id: 'original', type: 'painting', content: '/art.png', position: [0, 2.5, -9.8], rotation: [0, 0, 0], scale: [1, 1, 1] }], floorPlanElements: [], wallMaterialOverrides: {} });
const run = (scene, operations, options = {}) => applySceneOperationPlan(scene, { schemaVersion: 1, summary: 'Edit exhibition', operations }, { editMode: 'complete', ...options });
describe('complete editor commands', () => {
  it('rejects item fields that the selected renderer cannot use', () => {
    const scene = source(); scene.items.push({ id: 'ai-wall', type: 'partition', content: '#fff', position: [0, 3, 0], rotation: [0, 0, 0], scale: [6, 6, 0.2] });
    expect(() => run(scene, [{ type: 'edit-item', itemId: 'ai-wall', changes: { frameColor: '#fff' } }])).toThrow(/edit-wall-material/);
    expect(() => run(scene, [{ type: 'edit-item', itemId: 'original', changes: { textFontSize: 0.4 } }])).toThrow(/text item/);
  });
  it('supports legacy generated-item removal within a complete command plan', () => {
    const scene = source(); scene.items.push({ id: 'ai-sign', type: 'text', content: 'Temporary', position: [0, 3, 0], rotation: [0, 0, 0], scale: [1, 1, 1] });
    expect(run(scene, [{ type: 'remove-generated-item', itemId: 'ai-sign' }]).scene.items).toHaveLength(1);
  });
  it('keeps partition floor-plan geometry and locks consistent across item commands', () => {
    const result = run(source(), [{ type: 'add-editor-item', item: { id: 'ai-wall', type: 'partition', content: '#fff', position: [0, 3, 0], rotation: [0, 0, 0], scale: [6, 6, 0.2] } },
      { type: 'edit-item', itemId: 'ai-wall', changes: { position: [2, 3, 1] } },
      { type: 'set-items-locked', itemIds: ['ai-wall'], locked: true }]);
    expect(result.scene.floorPlanElements[0]).toMatchObject({ id: 'ai-wall', position: [2, 0.1, 1], isLocked: true });
    expect(() => run(result.scene, [{ type: 'edit-wall-material', targetId: 'ai-wall', changes: { wallColor: '#000' } }])).toThrow(/locked/);
    const removed = run(result.scene, [{ type: 'set-items-locked', itemIds: ['ai-wall'], locked: false }, { type: 'delete-items', itemIds: ['ai-wall'] }]);
    expect(removed.scene.floorPlanElements).toEqual([]);
  });
  it('rejects unsupported rotated rooms and initializes an empty editor room explicitly', () => {
    expect(() => run(source(), [{ type: 'add-floor-element', element: { id: 'ai-room', type: 'room', position: [0, 0, 0], rotation: [0, 1, 0], scale: [20, 0.2, 20] } }])).toThrow(/axis-aligned/);
    expect(run({ ...source(), roomSize: null, items: [] }, [{ type: 'edit-room', changes: { width: 30 } }]).scene.roomSize.width).toBe(30);
  });
  it('preserves exact editor transforms and only changes requested room/material fields', () => {
    const scene = source(); scene.roomSize.width = 55;
    const result = run(scene, [{ type: 'edit-room', changes: { wallRoughness: 0.9, floorTextureUrl: '/textures/wall-wood.svg' } },
      { type: 'edit-item', itemId: 'original', changes: { position: [1, 1.7, 2], frameStyle: 'borderless', frameGlassEnabled: false } }]);
    expect(result.scene.roomSize).toMatchObject({ width: 55, wallRoughness: 0.9 });
    expect(result.scene.items[0]).toMatchObject({ position: [1, 1.7, 2], frameStyle: 'borderless', content: '/art.png' });
    expect(scene.items[0].position).toEqual([0, 2.5, -9.8]);
  });
  it('edits existing text without treating it as replacement artwork', () => {
    const scene = source(); scene.items.push({ ...scene.items[0], id: 'title', type: 'text', content: 'Before' });
    expect(run(scene, [{ type: 'edit-item', itemId: 'title', changes: { content: 'After', textFontSize: 0.3, textBackboardEnabled: true } }]).scene.items[1].content).toBe('After');
  });
  it('requires explicit permission for original deletion/replacement and forbids media URL invention', () => {
    expect(() => run(source(), [{ type: 'delete-items', itemIds: ['original'] }])).toThrow(/permission/i);
    expect(() => run(source(), [{ type: 'edit-item', itemId: 'original', changes: { content: '/invented.png' } }])).toThrow(/asset/i);
    expect(run(source(), [{ type: 'delete-items', itemIds: ['original'] }], { allowDestructive: true }).scene.items).toEqual([]);
  });
  it('places and replaces selected images, videos and model assets without losing metadata', () => {
    const editorAssets = [{ key: 'video', kind: 'video', url: '/api/media/assets/video', assetId: 'video', mimeType: 'video/mp4', label: 'Film' },
      { key: 'model', kind: 'model', url: '/templates/concept-car.glb', label: 'Car' }];
    const result = run(source(), [{ type: 'place-asset', id: 'ai-film', assetKey: 'video', position: [3, 2, -9.7] },
      { type: 'place-asset', id: 'ai-car', assetKey: 'model', position: [0, 0, 0] },
      { type: 'replace-item-asset', itemId: 'original', assetKey: 'video' }], { editorAssets, allowDestructive: true });
    expect(result.scene.items[0]).toMatchObject({ assetId: 'video', fileMimeType: 'video/mp4' });
    expect(result.scene.items[2]).toMatchObject({ type: 'pedestal', content: '/templates/concept-car.glb', modelOffset: [0, 0, 0] });
    expect(() => run(source(), [{ type: 'place-asset', id: 'ai-bad', assetKey: 'absent', position: [0, 0, 0] }])).toThrow(/asset/i);
  });
  it('creates a partition, mounts a painting on its back, and changes its wall material', () => {
    const result = run(source(), [{ type: 'add-editor-item', item: { id: 'ai-wall', type: 'partition', position: [0, 3, 0], rotation: [0, Math.PI / 2, 0], scale: [6, 6, 0.2], content: '#fff' } },
      { type: 'mount-on-partition', itemId: 'original', partitionId: 'ai-wall', side: 'back', offset: 0, height: 2 },
      { type: 'edit-wall-material', targetId: 'ai-wall', changes: { wallColor: '#111111', wallMetalness: 0.6 } }]);
    expect(result.scene.items[0].position[0]).toBeLessThan(-0.1);
    expect(result.scene.items[0].position[1]).toBe(2);
    expect(result.scene.wallMaterialOverrides['ai-wall'].wallMetalness).toBe(0.6);
  });
  it('duplicates, aligns, distributes and snaps with stable generated IDs', () => {
    const result = run(source(), [{ type: 'duplicate-items', copies: [{ itemId: 'original', id: 'ai-copy1', offset: [3, 0, 1] }, { itemId: 'original', id: 'ai-copy2', offset: [7, 0, 2] }] },
      { type: 'batch-transform', itemIds: ['original', 'ai-copy1', 'ai-copy2'], mode: 'distribute', axis: 'x' },
      { type: 'batch-transform', itemIds: ['original', 'ai-copy1', 'ai-copy2'], mode: 'align', axis: 'z', anchorId: 'original' }]);
    expect(result.scene.items.map((item) => item.position[0])).toEqual([0, 3.5, 7]);
    expect(result.scene.items.every((item) => item.position[2] === -9.8)).toBe(true);
  });
  it('adds, edits and removes floor-plan elements without silently erasing unrelated partitions', () => {
    const result = run(source(), [{ type: 'add-floor-element', element: { id: 'ai-room', type: 'room', position: [22, 0.02, 0], rotation: [0, 0, 0], scale: [12, 0.04, 12] } },
      { type: 'edit-floor-element', elementId: 'ai-room', changes: { doorWidth: 2.4, doorOffset: 1 } }]);
    expect(result.scene.floorPlanElements[0].doorWidth).toBe(2.4);
    expect(result.scene.items).toEqual(source().items);
    expect(run(result.scene, [{ type: 'remove-floor-element', elementId: 'ai-room' }]).scene.floorPlanElements).toEqual([]);
  });
  it('locks are enforced on every mutation and failed batches are atomic', () => {
    const scene = source(); scene.items[0].isLocked = true;
    expect(() => run(scene, [{ type: 'edit-room', changes: { wallColor: '#000' } }, { type: 'move-item', itemId: 'original', position: [1, 2, 3] }])).toThrow(/locked/i);
    expect(scene.roomSize.wallColor).toBeUndefined();
    expect(run(scene, [{ type: 'set-items-locked', itemIds: ['original'], locked: false }, { type: 'edit-item', itemId: 'original', changes: { title: 'Updated' } }]).scene.items[0].title).toBe('Updated');
  });
});
