import { describe, expect, it, vi } from 'vitest';
import { createExhibitionPassportService } from './exhibitionPassportService.js';

function createHarness({ items = [], memory = null } = {}) {
  let passport = null;
  const gallery = {
    id: 'g1', title: 'Gallery', owner_name: 'Curator', is_published: 1,
    scene_json: JSON.stringify({ items }),
  };
  const deps = {
    getPublishedGalleryById: vi.fn(async () => gallery),
    getVisitorMemory: vi.fn(async () => memory),
    getExhibitionPassport: vi.fn(async () => passport),
    insertExhibitionPassport: vi.fn(async (value) => { passport = value; }),
    completeExhibitionPassport: vi.fn(async ({ souvenir, completedAt }) => {
      passport = { ...passport, status: 'completed', souvenir, completedAt };
    }),
    publishExhibitionPassport: vi.fn(async ({ souvenirToken }) => {
      passport = { ...passport, souvenirToken };
    }),
    getPublishedSouvenirByToken: vi.fn(async () => passport?.souvenir || null),
    listRecentPublishedSouvenirs: vi.fn(async () => []),
    createId: vi.fn().mockReturnValueOnce('passport-id').mockReturnValueOnce('share-token'),
    now: vi.fn(() => '2026-07-22T00:00:00.000Z'),
  };
  return { service: createExhibitionPassportService(deps), deps, get passport() { return passport; } };
}

const items = [
  { id: 'a', type: 'painting', title: 'A', thumbnailUrl: 'data:image/png,x' },
  { id: 'b', type: 'pedestal', title: 'B', thumbnailUrl: '/thumb-b.jpg' },
  { id: 'c', type: 'text', title: 'C' },
];
const completeMemory = {
  visitedExhibitIds: ['a', 'b', 'c'], engagedExhibitIds: ['b'],
  dwellSecondsByExhibit: { a: 10, b: 30, c: 20 },
};

describe('exhibition passport service', () => {
  it('lazily creates one passport and preserves its tasks', async () => {
    const harness = createHarness({ items, memory: completeMemory });
    const first = await harness.service.getOrCreatePassport('u1', 'g1');
    const second = await harness.service.getOrCreatePassport('u1', 'g1');
    expect(first.tasks).toEqual(second.tasks);
    expect(harness.deps.insertExhibitionPassport).toHaveBeenCalledTimes(1);
  });

  it('rejects a gallery without eligible exhibits', async () => {
    const { service } = createHarness({ items: [{ id: 'x', type: 'light' }] });
    await expect(service.getOrCreatePassport('u1', 'g1')).rejects.toMatchObject({
      code: 'PASSPORT_UNAVAILABLE',
    });
  });

  it('rejects completion based on persisted progress', async () => {
    const { service } = createHarness({ items, memory: { visitedExhibitIds: ['a'] } });
    await service.getOrCreatePassport('u1', 'g1');
    await expect(service.completePassport('u1', 'g1', 'hello')).rejects.toMatchObject({
      code: 'PASSPORT_INCOMPLETE', progress: { complete: false },
    });
  });

  it('creates one immutable bounded souvenir and publishes idempotently', async () => {
    const harness = createHarness({ items, memory: completeMemory });
    await harness.service.getOrCreatePassport('u1', 'g1');
    const first = await harness.service.completePassport('u1', 'g1', ` ${'x'.repeat(300)} `);
    const second = await harness.service.completePassport('u1', 'g1', 'changed');
    expect(first.souvenir).toEqual(second.souvenir);
    expect(first.souvenir).toMatchObject({
      galleryOwnerName: 'Curator', favoriteExhibit: { id: 'b', thumbnailUrl: '/thumb-b.jpg' },
      totalDwellSeconds: 60,
    });
    expect(first.souvenir.reflection).toHaveLength(280);
    expect(first.souvenir).not.toHaveProperty('userId');
    expect(harness.deps.completeExhibitionPassport).toHaveBeenCalledTimes(1);
    expect(await harness.service.sharePassport('u1', 'g1')).toEqual({
      token: 'share-token', sharePath: '/souvenirs/share-token',
    });
    await harness.service.sharePassport('u1', 'g1');
    expect(harness.deps.publishExhibitionPassport).toHaveBeenCalledTimes(1);
  });
});
