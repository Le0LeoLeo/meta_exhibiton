import { describe, expect, it } from 'vitest';
import { buildSceneContext } from './exhibitionSceneContext.js';

function item(id, overrides = {}) {
  return {
    id, type: 'painting', position: [1, 2.5, -9], rotation: [0, 0, 0], scale: [1, 1, 1],
    content: '/private/content/not-for-prompt', title: 'Artwork', artist: 'Student', description: 'Label',
    ...overrides,
  };
}

describe('buildSceneContext', () => {
  it('includes compact room/item facts and safe persistent media references', () => {
    const context = buildSceneContext({
      roomSize: { width: 20, length: 30, height: 6, wallColor: '#fff', wallMaterialPreset: 'paint', floorColor: '#111' },
      items: [item('painting-user-1', {
        assetId: 'asset-1', assetUrl: '/api/media/assets/1', thumbnailUrl: '/api/media/assets/1/thumb',
        uploadToken: 'secret-token', unknown: 'do-not-send',
      }), item('ai-title', { type: 'text' })],
    });

    expect(context.room).toEqual({
      width: 20, length: 30, height: 6, wallColor: '#fff', wallMaterialPreset: 'paint', floorColor: '#111',
    });
    expect(context.items[0]).toMatchObject({
      id: 'painting-user-1', title: 'Artwork', artist: 'Student', description: 'Label',
      media: { assetId: 'asset-1', assetUrl: '/api/media/assets/1', thumbnailUrl: '/api/media/assets/1/thumb' },
    });
    expect(JSON.stringify(context)).not.toContain('secret-token');
    expect(JSON.stringify(context)).not.toContain('do-not-send');
    expect(JSON.stringify(context)).not.toContain('/private/content/not-for-prompt');
    expect(context.protectedItemIds).toEqual(['painting-user-1']);
    expect(context.generatedItemIds).toEqual(['ai-title']);
    expect(context.countsByType).toEqual({ painting: 1, text: 1 });
  });

  it.each(['data:image/png;base64,AAAA', 'blob:null/local-id', `data:text/plain,${'x'.repeat(600)}`])(
    'omits embedded media content: %s',
    (content) => {
      const context = buildSceneContext({ roomSize: {}, items: [item('painting-user-1', { content })] });
      expect(context.items[0].media).toBe('embedded-content-omitted');
      expect(JSON.stringify(context)).not.toContain(content);
    },
  );

  it('limits context to 100 items while counting the complete scene', () => {
    const context = buildSceneContext({
      roomSize: {},
      items: Array.from({ length: 105 }, (_, index) => item(`painting-${index}`)),
    });
    expect(context.items).toHaveLength(100);
    expect(context.countsByType.painting).toBe(105);
    expect(context.truncated).toBe(true);
  });
});
