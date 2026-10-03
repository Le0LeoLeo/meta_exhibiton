import { describe, expect, it } from 'vitest';
import { sceneToExhibits } from './sceneToExhibits';

describe('sceneToExhibits', () => {
  it('returns an ordered, sanitized list of meaningful exhibits', () => {
    expect(sceneToExhibits({
      items: [
        { id: 'decor', type: 'bench', content: '#fff' },
        {
          id: 'photo',
          type: 'painting',
          title: '海邊',
          artist: '小明',
          description: '夏日作品',
          assetUrl: '/api/media/photo',
        },
        { id: 'label', type: 'text', content: '第一展區介紹' },
      ],
    })).toEqual([
      expect.objectContaining({
        id: 'photo',
        title: '海邊',
        artist: '小明',
        kind: 'image',
        mediaUrl: '/api/media/photo',
        thumbnailUrl: '/api/media/photo',
        accessibleText: '海邊。作者：小明。夏日作品',
      }),
      expect.objectContaining({
        id: 'label',
        title: '展覽文字',
        kind: 'text',
        description: '第一展區介紹',
      }),
    ]);
  });

  it('uses a video thumbnail without treating it as the playable source', () => {
    const [video] = sceneToExhibits({
      items: [{
        id: 'film',
        type: 'painting',
        title: '短片',
        content: '/media/film.mp4',
        fileMimeType: 'video/mp4',
        videoThumbnailUrl: '/media/film-poster.jpg',
      }],
    });

    expect(video).toMatchObject({
      kind: 'video',
      mediaUrl: '/media/film.mp4',
      thumbnailUrl: '/media/film-poster.jpg',
    });
  });

  it('uses localized fallback labels and accessible text when supplied', () => {
    const [artwork] = sceneToExhibits({ items: [{ type: 'painting', artist: 'Student', description: 'Process note' }] }, {
      textTitle: 'Exhibition text',
      artworkTitle: (number) => `Artwork ${number}`,
      author: (artist) => `Artist: ${artist}`,
      separator: '. ',
    });
    expect(artwork).toMatchObject({ title: 'Artwork 1', accessibleText: 'Artwork 1. Artist: Student. Process note' });
  });

  it('includes pedestal-hosted 3D models in the accessible exhibit list', () => {
    const [model] = sceneToExhibits({
      items: [{
        id: 'model-on-pedestal',
        type: 'pedestal',
        title: 'Student sculpture',
        content: '/media/sculpture.glb',
      }],
    });

    expect(model).toMatchObject({
      id: 'model-on-pedestal',
      kind: 'model',
      mediaUrl: '/media/sculpture.glb',
    });
  });

  it('rejects malformed snapshots and unsafe media schemes', () => {
    expect(sceneToExhibits([])).toEqual([]);
    expect(sceneToExhibits({ items: [{
      id: 'unsafe',
      type: 'painting',
      content: 'javascript:alert(1)',
    }] })).toEqual([
      expect.objectContaining({ mediaUrl: null, thumbnailUrl: null }),
    ]);
  });
});
