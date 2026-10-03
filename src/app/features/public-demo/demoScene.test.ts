import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dictionaries } from '@/app/i18n/catalogs';
import { createDemoScene, demoExhibitions } from './demoScene';

describe('expanded official exhibitions', () => {
  it.each(demoExhibitions)('$id contains eleven distinct, local and fully translated artworks', exhibition => {
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
    expect(scene.items).toHaveLength(11);
    for (const item of scene.items) {
      const [x, y, z] = item.position;
      const angle = item.rotation[1];
      const halfWidth = item.frameWidth! / 2;
      expect(Math.abs(x) + Math.abs(Math.cos(angle)) * halfWidth).toBeLessThan(scene.roomSize.width / 2);
      expect(Math.abs(z) + Math.abs(Math.sin(angle)) * halfWidth).toBeLessThan(scene.roomSize.length / 2);
      expect(y - item.frameHeight! / 2).toBeGreaterThan(0);
      expect(y + item.frameHeight! / 2).toBeLessThan(scene.roomSize.height);
      expect(-x * Math.sin(angle) - z * Math.cos(angle)).toBeGreaterThan(0);
      for (const other of scene.items) {
        if (other === item || other.rotation[1] !== angle) continue;
        const distance = Math.hypot(x - other.position[0], z - other.position[2]);
        expect(distance - halfWidth - other.frameWidth! / 2).toBeGreaterThan(0.5);
      }
    }
  });
});
