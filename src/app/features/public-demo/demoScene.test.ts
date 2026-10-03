import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dictionaries } from '@/app/i18n/catalogs';
import { createDemoScene, demoExhibitions } from './demoScene';
import { getClassSampleCopy } from './classSample';

const museumExhibitions = demoExhibitions.filter((exhibition) => exhibition.id !== 'class');

describe('expanded official exhibitions', () => {
  it('opens with the sample class exhibition and its learning stories in every language', () => {
    const [classExhibition] = demoExhibitions;
    expect(classExhibition.id).toBe('class');
    expect(new Set(classExhibition.artworks.map(a => a.id)).size).toBe(classExhibition.artworks.length);
    for (const artwork of classExhibition.artworks) expect(existsSync(resolve('public/demo', `met-${artwork.id}.jpg`))).toBe(true);
    for (const locale of ['en', 'zh-TW', 'zh-CN'] as const) {
      const scene = createDemoScene(key => key, 'class', locale);
      const paintings = scene.items.filter(item => item.type === 'painting');
      expect(paintings).toHaveLength(classExhibition.artworks.length);
      expect(getClassSampleCopy(locale).works).toHaveLength(classExhibition.artworks.length);
      for (const item of paintings) expect(item.workContext?.contribution?.trim()).toBeTruthy();
      // The inquiry question is ordinary wall text, as a creator would add it.
      expect(scene.items.find(item => item.type === 'text')?.content).toBe(getClassSampleCopy(locale).inquiryWall);
    }
  });

  it.each(museumExhibitions)('$id contains eleven distinct, local and fully translated artworks', exhibition => {
    expect(exhibition.artworks).toHaveLength(11);
    expect(new Set(exhibition.artworks.map(a => a.id)).size).toBe(11);
    for (const artwork of exhibition.artworks) {
      expect(existsSync(resolve('public/demo', `met-${artwork.id}.jpg`))).toBe(true);
      for (const dictionary of Object.values(dictionaries)) {
        for (const field of ['Title', 'Artist', 'Description']) {
          expect(dictionary[`demoArtwork${artwork.key}${field}`]?.trim()).toBeTruthy();
        }
      }
    }
  });

  it.each(demoExhibitions)('$id keeps frames inside the room, facing inward and spaced apart', exhibition => {
    const scene = createDemoScene(key => key, exhibition.id);
    const paintings = scene.items.filter(item => item.type === 'painting');
    expect(paintings).toHaveLength(exhibition.artworks.length);
    for (const item of paintings) {
      const [x, y, z] = item.position;
      const angle = item.rotation[1];
      const halfWidth = item.frameWidth! / 2;
      expect(Math.abs(x) + Math.abs(Math.cos(angle)) * halfWidth).toBeLessThan(scene.roomSize.width / 2);
      expect(Math.abs(z) + Math.abs(Math.sin(angle)) * halfWidth).toBeLessThan(scene.roomSize.length / 2);
      expect(y - item.frameHeight! / 2).toBeGreaterThan(0);
      expect(y + item.frameHeight! / 2).toBeLessThan(scene.roomSize.height);
      expect(-x * Math.sin(angle) - z * Math.cos(angle)).toBeGreaterThan(0);
      for (const other of paintings) {
        if (other === item || other.rotation[1] !== angle) continue;
        const distance = Math.hypot(x - other.position[0], z - other.position[2]);
        expect(distance - halfWidth - other.frameWidth! / 2).toBeGreaterThan(0.5);
      }
    }
  });
});
