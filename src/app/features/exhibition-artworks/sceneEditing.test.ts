import { describe, expect, it } from 'vitest';
import type { UploadedMediaAsset } from '@/app/api/media';
import { defaultGalleryScene } from '@/app/modules/metaverse3d/store/defaultGalleryScene';
import type { SceneSnapshot } from '@/app/modules/metaverse3d/store/metaverseStoreTypes';
import { addPainting, parseEditableScene, replacePainting } from './sceneEditing';

const media: UploadedMediaAsset = { id: 'asset-2', fileName: 'stored.jpg', originalFileName: 'New artwork.jpg',
  mimeType: 'image/jpeg', size: 100, width: 800, height: 600, metadataSanitized: true,
  url: '/api/media/asset-2', previewUrl: '/api/media/asset-2?accessToken=private' };
const scene = () => structuredClone(defaultGalleryScene) as SceneSnapshot;

describe('existing exhibition artwork editing', () => {
  it('preserves custom scene, room, and artwork data when parsing and replacing an image', () => {
    const original = { ...scene(), customLighting: { enabled: true } };
    const painting = original.items.find((item) => item.type === 'painting')!;
    painting.description = 'Keep the curatorial description';
    painting.frameStyle = 'classic';
    const saved = JSON.stringify(original);
    const parsed = parseEditableScene(saved);
    expect(parsed).toEqual(original);
    const replaced = replacePainting(parsed, painting.id, media);
    expect(replaced.items.find((item) => item.id === painting.id)).toMatchObject({ ...painting,
      assetId: media.id, assetUrl: media.url, content: media.url, thumbnailUrl: media.url,
      fileName: media.originalFileName, fileMimeType: media.mimeType, imageAspectRatio: 4 / 3 });
    expect(replaced.roomSize).toEqual(original.roomSize);
    expect(replaced.floorPlanElements).toEqual(original.floorPlanElements);
    expect(replaced).toHaveProperty('customLighting', { enabled: true });
    expect(JSON.stringify(replaced)).not.toContain('accessToken');
    expect(JSON.stringify(parsed)).toBe(saved);
  });

  it.each([null, '{', '{}', '{"items":[]}'])('rejects invalid saved data rather than replacing it with a default scene: %s', (json) => {
    expect(() => parseEditableScene(json)).toThrow('INVALID_SCENE');
  });

  it('rejects broken transforms and duplicate item identities', () => {
    const original = scene();
    original.items.push(original.items[0]);
    expect(() => parseEditableScene(JSON.stringify(original))).toThrow('INVALID_SCENE');
    original.items.pop();
    original.items[0].position[0] = Infinity;
    expect(() => parseEditableScene(JSON.stringify(original))).toThrow('INVALID_SCENE');
  });

  it('places additions separately against the actual offset room without moving existing items', () => {
    const original = scene();
    original.items = [];
    original.floorPlanElements = [{ id: 'offset-room', type: 'room', position: [20, 0, 30], scale: [12, 1, 12],
      rotation: [0, 0, 0], isLocked: true }];
    const first = addPainting(original, media, 'new-1');
    const second = addPainting(first, media, 'new-2');
    expect(original.items).toEqual([]);
    expect(second.items[0]).toEqual(first.items[0]);
    expect(second.items[1].position[0] - second.items[0].position[0]).toBeGreaterThan(2.4);
    for (const item of second.items) {
      expect(item.position[2]).toBeGreaterThan(-6);
      expect(item.position[2]).toBeLessThan(-5.7);
      expect(item.position[0]).toBeGreaterThan(-6);
      expect(item.position[0]).toBeLessThan(6);
      expect(item.frameWidth! / item.frameHeight!).toBeCloseTo(4 / 3);
    }
  });

  it('fails safely when the back wall is full and leaves existing layout unchanged', () => {
    const original = scene();
    original.floorPlanElements = [];
    original.roomSize.width = 2;
    const saved = JSON.stringify(original);
    expect(() => addPainting(original, media, 'new')).toThrow('NO_ARTWORK_SPACE');
    expect(JSON.stringify(original)).toBe(saved);
    expect(() => replacePainting(original, 'missing', media)).toThrow('ARTWORK_NOT_FOUND');
    expect(() => addPainting(original, { ...media, width: 0 }, 'new')).toThrow('INVALID_ARTWORK_IMAGE');
  });
});
