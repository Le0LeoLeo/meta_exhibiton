import { describe, expect, it } from 'vitest';
import { exhibitionCover } from './exhibitionCover';

describe('public exhibition covers', () => {
  it('prefers the chosen cover over scene artwork', () => {
    expect(exhibitionCover({ templateImage: '/chosen.jpg', sceneJson: '{"items":[]}' })).toBe('/chosen.jpg');
  });
  it('uses the first image artwork, preferring its thumbnail and skipping non-image content', () => {
    const sceneJson = JSON.stringify({ items: [
      { type: 'text', content: 'Introduction' },
      { type: 'painting', content: '/video.mp4', fileMimeType: 'video/mp4' },
      { type: 'painting', content: '/api/media/art/file', thumbnailUrl: '/api/media/art/thumb' },
    ] });
    expect(exhibitionCover({ templateImage: '', sceneJson })).toBe('/api/media/art/thumb');
  });
  it.each([null, 'broken', '{"items":[]}', '{"items":[{"type":"painting","content":"javascript:alert(1)"}]}'])('leaves an honest missing cover for %s', sceneJson => {
    expect(exhibitionCover({ templateImage: '', sceneJson })).toBe('');
  });
});
