import { describe, expect, it } from 'vitest';
import { createMemorySceneStore } from './memorySceneStore.js';
import { applySceneOperation } from './sceneState.js';

function makeScene(overrides = {}) {
  return {
    roomSize: { width: 10, height: 3, depth: 10 },
    items: [],
    floorPlanElements: [],
    wallMaterialOverrides: {},
    ...overrides,
  };
}

const isValidScene = (scene) => (
  Array.isArray(scene.items)
  && scene.items.every((item) => typeof item?.id === 'string')
);

describe('createMemorySceneStore', () => {
  it('initializes at version one and applies operations in order', async () => {
    const store = createMemorySceneStore({ ttlMs: 60_000 });
    const initial = await store.initialize('gallery-1', makeScene());

    const first = await store.applyOperation(
      'gallery-1',
      { kind: 'add-item', item: { id: 'item-1', title: 'Initial' } },
      isValidScene,
    );
    const second = await store.applyOperation(
      'gallery-1',
      { kind: 'update-item', id: 'item-1', updates: { title: 'Updated' } },
      isValidScene,
    );

    expect(initial.version).toBe(1);
    expect(first).toMatchObject({ accepted: true, version: 2 });
    expect(second).toMatchObject({ accepted: true, version: 3 });
    expect((await store.get('gallery-1')).scene.items[0].title).toBe('Updated');
  });

  it('does not overwrite an existing scene during initialization', async () => {
    const store = createMemorySceneStore();
    await store.initialize('gallery-1', makeScene({
      items: [{ id: 'first' }],
    }));

    const result = await store.initialize('gallery-1', makeScene({
      items: [{ id: 'replacement' }],
    }));

    expect(result).toMatchObject({
      version: 1,
      scene: { items: [{ id: 'first' }] },
    });
  });

  it('rejects unsupported operations and invalid resulting scenes', async () => {
    const store = createMemorySceneStore();
    await store.initialize('gallery-1', makeScene());

    await expect(store.applyOperation(
      'gallery-1',
      { kind: 'unsupported' },
      isValidScene,
    )).resolves.toEqual({ accepted: false, reason: 'invalid_scene' });

    await expect(store.applyOperation(
      'gallery-1',
      { kind: 'add-item', item: { title: 'Missing id' } },
      isValidScene,
    )).resolves.toEqual({ accepted: false, reason: 'invalid_scene' });

    expect((await store.get('gallery-1')).version).toBe(1);
  });

  it('isolates stored state from a validator that mutates a rejected candidate', async () => {
    const store = createMemorySceneStore();
    await store.initialize('gallery-1', makeScene({
      items: [{
        id: 'item-1',
        title: 'Original',
        metadata: { label: 'Untouched' },
      }],
    }));

    const result = await store.applyOperation(
      'gallery-1',
      { kind: 'update-item', id: 'item-1', updates: { title: 'Candidate' } },
      (candidate) => {
        candidate.items[0].metadata.label = 'Mutated by validator';
        return false;
      },
    );

    expect(result).toEqual({ accepted: false, reason: 'invalid_scene' });
    expect(await store.get('gallery-1')).toMatchObject({
      version: 1,
      scene: {
        items: [{
          title: 'Original',
          metadata: { label: 'Untouched' },
        }],
      },
    });
  });

  it('serializes concurrent operations without losing either write', async () => {
    const store = createMemorySceneStore();
    await store.initialize('gallery-1', makeScene());

    const [first, second] = await Promise.all([
      store.applyOperation(
        'gallery-1',
        { kind: 'add-item', item: { id: 'first' } },
        isValidScene,
      ),
      store.applyOperation(
        'gallery-1',
        { kind: 'add-item', item: { id: 'second' } },
        isValidScene,
      ),
    ]);

    expect([first.version, second.version]).toEqual([2, 3]);
    expect((await store.get('gallery-1')).scene.items).toEqual([
      { id: 'first' },
      { id: 'second' },
    ]);
  });

  it('increments the version on replace and rejects invalid replacements', async () => {
    const store = createMemorySceneStore();
    await store.initialize('gallery-1', makeScene());

    await expect(store.replace(
      'gallery-1',
      makeScene({ items: [{ id: 'replacement' }] }),
      isValidScene,
      { expectedVersion: 1 },
    )).resolves.toMatchObject({ accepted: true, version: 2 });

    await expect(store.replace(
      'gallery-1',
      makeScene({ items: [{ title: 'Missing id' }] }),
      isValidScene,
      { expectedVersion: 2 },
    )).resolves.toEqual({ accepted: false, reason: 'invalid_scene' });
    expect((await store.get('gallery-1')).version).toBe(2);
  });

  it('requires a current expected version and reports missing scenes', async () => {
    const store = createMemorySceneStore();

    for (const options of [
      undefined,
      { expectedVersion: 0 },
      { expectedVersion: 1.5 },
      { expectedVersion: Number.MAX_SAFE_INTEGER + 1 },
    ]) {
      await expect(store.replace(
        'gallery-1',
        makeScene(),
        isValidScene,
        options,
      )).resolves.toEqual({ accepted: false, reason: 'invalid_version' });
    }

    await expect(store.replace(
      'gallery-1',
      makeScene(),
      isValidScene,
      { expectedVersion: 1 },
    )).resolves.toEqual({ accepted: false, reason: 'missing_scene' });
  });

  it('does not let a stale full snapshot overwrite an accepted operation', async () => {
    const store = createMemorySceneStore();
    await store.initialize('gallery-1', makeScene());
    const stale = await store.get('gallery-1');

    await expect(store.applyOperation(
      'gallery-1',
      { kind: 'add-item', item: { id: 'concurrent-item' } },
      isValidScene,
    )).resolves.toMatchObject({ accepted: true, version: 2 });

    await expect(store.replace(
      'gallery-1',
      stale.scene,
      isValidScene,
      { expectedVersion: stale.version },
    )).resolves.toEqual({ accepted: false, reason: 'conflict' });
    await expect(store.get('gallery-1')).resolves.toMatchObject({
      version: 2,
      scene: { items: [{ id: 'concurrent-item' }] },
    });
  });

  it('expires entries lazily without a background timer', async () => {
    let time = 1_000;
    const store = createMemorySceneStore({
      ttlMs: 100,
      now: () => time,
    });
    await store.initialize('gallery-1', makeScene());

    time = 1_101;

    await expect(store.get('gallery-1')).resolves.toBeNull();
    await expect(store.initialize('gallery-1', makeScene())).resolves.toMatchObject({
      version: 1,
    });
  });

  it('drains writes queued before close and rejects writes once closing begins', async () => {
    const store = createMemorySceneStore();
    await store.initialize('gallery-1', makeScene());

    const pendingWrite = store.applyOperation(
      'gallery-1',
      { kind: 'add-item', item: { id: 'queued' } },
      isValidScene,
    );
    const closing = store.close();

    await expect(pendingWrite).resolves.toMatchObject({
      accepted: true,
      version: 2,
    });
    await expect(store.replace(
      'gallery-1',
      makeScene(),
      isValidScene,
    )).rejects.toThrow('Memory scene store is closed');
    await closing;
    await expect(store.get('gallery-1')).resolves.toBeNull();
  });

  it('makes close idempotent and rejects lifecycle operations after close', async () => {
    const store = createMemorySceneStore();
    await store.initialize('gallery-1', makeScene());

    await store.delete('gallery-1');
    await store.delete('gallery-1');
    await expect(store.get('gallery-1')).resolves.toBeNull();

    await store.close();
    await store.close();

    await expect(store.initialize('gallery-1', makeScene()))
      .rejects.toThrow('Memory scene store is closed');
    await expect(store.replace('gallery-1', makeScene(), isValidScene))
      .rejects.toThrow('Memory scene store is closed');
    await expect(store.applyOperation(
      'gallery-1',
      { kind: 'add-item', item: { id: 'late' } },
      isValidScene,
    )).rejects.toThrow('Memory scene store is closed');
    await expect(store.delete('gallery-1'))
      .rejects.toThrow('Memory scene store is closed');
    await expect(store.checkReadiness())
      .rejects.toThrow('Memory scene store is closed');
  });
});

describe('applySceneOperation', () => {
  it('does not share nested current-scene state with the returned transition', () => {
    const current = makeScene({
      roomSize: { width: 10, metadata: { label: 'Room' } },
      items: [{ id: 'item-1', metadata: { label: 'Item' } }],
      floorPlanElements: [{ id: 'wall-1', metadata: { label: 'Wall' } }],
    });

    const operation = {
      kind: 'update-item',
      id: 'item-1',
      updates: { title: 'Updated', config: { label: 'Operation' } },
    };
    const next = applySceneOperation(current, operation);
    next.roomSize.metadata.label = 'Changed room';
    next.items[0].metadata.label = 'Changed item';
    next.items[0].config.label = 'Changed operation';
    next.floorPlanElements[0].metadata.label = 'Changed wall';

    expect(current).toEqual(makeScene({
      roomSize: { width: 10, metadata: { label: 'Room' } },
      items: [{ id: 'item-1', metadata: { label: 'Item' } }],
      floorPlanElements: [{ id: 'wall-1', metadata: { label: 'Wall' } }],
    }));
    expect(operation.updates.config.label).toBe('Operation');
  });
});
