import { describe, expect, it } from 'vitest';
import { buildGuideTtsText } from './tts';

describe('buildGuideTtsText', () => {
  it('joins only non-empty exhibit metadata', () => {
    expect(buildGuideTtsText({
      title: ' 作品名稱 ',
      artist: ' ',
      description: '作品描述',
    })).toBe('作品名稱。作品描述');
  });

  it('returns an empty string when there is nothing to narrate', () => {
    expect(buildGuideTtsText({})).toBe('');
  });
});
