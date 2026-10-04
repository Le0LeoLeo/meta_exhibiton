import { describe, expect, it } from 'vitest';
import { addMediaShareTokenToScene, replaceMediaPreviewUrls, stripMediaAccessTokensFromScene } from './mediaSceneUrls';

describe('replaceMediaPreviewUrls', () => {
  it('replaces nested preview capabilities without changing unrelated URLs', () => {
    const scene = {
      items: [{ imageUrl: '/api/media/a?accessToken=secret', nested: ['/keep.jpg'] }],
    };
    const result = replaceMediaPreviewUrls(scene, [{
      id: 'a', fileName: 'a.jpg', status: 'succeeded',
      previewUrl: '/api/media/a?accessToken=secret', url: '/api/media/a',
    }]);

    expect(result).toEqual({ items: [{ imageUrl: '/api/media/a', nested: ['/keep.jpg'] }] });
    expect(scene.items[0].imageUrl).toContain('accessToken');
  });
});

describe('stripMediaAccessTokensFromScene', () => {
  it('prevents preview and share capabilities from being persisted', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(stripMediaAccessTokensFromScene({
      preview: `/api/media/${id}?accessToken=secret`,
      shared: `/api/media/${id}?shareToken=secret`,
    })).toEqual({ preview: `/api/media/${id}`, shared: `/api/media/${id}` });
  });
});

describe('addMediaShareTokenToScene', () => {
  it('adds a scoped share capability only to stable media API URLs', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(addMediaShareTokenToScene({ imageUrl: `/api/media/${id}`, other: '/image.jpg' }, 'a/b')).toEqual({
      imageUrl: `/api/media/${id}?shareToken=a%2Fb`,
      other: '/image.jpg',
    });
  });
});
