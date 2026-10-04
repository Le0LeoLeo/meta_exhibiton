import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sceneSnapshotSchema } from '../../../server/schemas/sceneSchema.js';
import { GALLERY_TEMPLATES, CREATE_GALLERY_TEMPLATE_TITLES } from './galleryTemplates';
import { getDefaultGalleryAtmosphere, getTemplateSceneJson, type GalleryAtmosphere, type SceneSnapshot } from './gallerySceneTemplates';

describe('complete exhibition templates', () => {
  it('offers the entire catalogue when creating an exhibition', () => {
    expect(CREATE_GALLERY_TEMPLATE_TITLES).toEqual(GALLERY_TEMPLATES.map((template) => template.title));
  });

  it.each(GALLERY_TEMPLATES.slice(1))('$title is a complete, self-contained, editable scene', ({ title }) => {
    const json = getTemplateSceneJson(title);
    expect(json).toBeDefined();
    const scene = JSON.parse(json!);
    expect(sceneSnapshotSchema.safeParse(scene).success).toBe(true);
    expect(scene.items.filter((item: { type: string }) => item.type === 'painting').length).toBeGreaterThanOrEqual(6);
    expect(new Set(scene.items.map((item: { id: string }) => item.id)).size).toBe(scene.items.length);
    for (const item of scene.items) {
      expect(item.isLocked).not.toBe(true);
      expect(Math.abs(item.position[0])).toBeLessThan(scene.roomSize.width / 2);
      expect(Math.abs(item.position[2])).toBeLessThan(scene.roomSize.length / 2);
      if (item.type === 'painting' || item.type === 'pedestal') {
        expect(item.content).toMatch(/^\//);
        expect(existsSync(resolve('public', item.content.slice(1)))).toBe(true);
        expect(item.title).toBeTruthy();
        expect(item.description).toBeTruthy();
      }
      if (item.type === 'painting') {
        // Check the whole frame, not just its centre: taller cover compositions must
        // still fit the actual editable room without clipping the floor or ceiling.
        expect(item.position[1] - item.frameHeight / 2).toBeGreaterThan(0.3);
        expect(item.position[1] + item.frameHeight / 2).toBeLessThan(scene.roomSize.height);
        const onSideWall = Math.abs(item.rotation[1]) > 1;
        const wallPosition = onSideWall ? item.position[2] : item.position[0];
        const wallLength = onSideWall ? scene.roomSize.length : scene.roomSize.width;
        expect(Math.abs(wallPosition) + item.frameWidth / 2).toBeLessThan(wallLength / 2);
      }
      // Keep the south entrance and its approach free for the visitor and guide.
      expect(Math.abs(item.position[0]) < 2 && item.position[2] > scene.roomSize.length / 2 - 4).toBe(false);
    }
    const next = JSON.parse(getTemplateSceneJson(title)!);
    expect(next.items[0].id).not.toBe(scene.items[0].id);
    scene.items[0].position[0] = 100;
    expect(next.items[0].position[0]).not.toBe(100);
  });

  it('keeps blank creation empty and does not substitute an unknown theme', () => {
    expect(getTemplateSceneJson('空白展覽')).toBeUndefined();
    expect(getTemplateSceneJson('unknown')).toBeUndefined();
  });

  const atmospheres: GalleryAtmosphere[] = ['bright', 'spotlight', 'warm'];
  it.each(GALLERY_TEMPLATES.slice(1).flatMap(({ title }) => atmospheres.map((atmosphere) => ({ title, atmosphere }))))(
    '$title / $atmosphere preserves all editable works and their layout', ({ title, atmosphere }) => {
      const original: SceneSnapshot = JSON.parse(getTemplateSceneJson(title, 'bright')!);
      const scene: SceneSnapshot = JSON.parse(getTemplateSceneJson(title, atmosphere)!);
      expect(sceneSnapshotSchema.safeParse(scene).success).toBe(true);
      const layout = (snapshot: SceneSnapshot) => snapshot.items.map(({ type, content, position, rotation, scale, frameWidth, frameHeight }) => ({
        type, content: type === 'lightstrip' ? undefined : content, position, rotation, scale, frameWidth, frameHeight,
      }));
      expect(layout(scene)).toEqual(layout(original));
      expect(scene.items.filter((item) => item.type === 'painting')).toHaveLength(6);
      expect([scene.roomSize.width, scene.roomSize.length, scene.roomSize.height]).toEqual(
        [original.roomSize.width, original.roomSize.length, original.roomSize.height],
      );
      expect(existsSync(resolve('public', scene.roomSize.floorTextureUrl!.slice(1)))).toBe(true);
      if (atmosphere === 'bright') {
        expect(scene.roomSize).toEqual(original.roomSize);
      } else {
        expect(scene.roomSize.environmentBrightness).toBeGreaterThanOrEqual(0.3);
        expect(scene.roomSize.environmentBrightness).toBeLessThanOrEqual(0.4);
        expect(scene.roomSize.wallTextureUrl).toBe(`/textures/template-wall-${atmosphere}.svg`);
        expect(scene.roomSize.floorRoughness).toBeGreaterThan(0.9);
        expect(scene.roomSize.wallColor).not.toBe(original.roomSize.wallColor);
      }
      // Generating another mood must not modify the factory's subsequent bright scene.
      expect(JSON.parse(getTemplateSceneJson(title, 'bright')!).roomSize).toEqual(original.roomSize);
    },
  );

  it.each(atmospheres)('keeps blank and unknown templates empty in %s atmosphere', (atmosphere) => {
    expect(getTemplateSceneJson('空白展覽', atmosphere)).toBeUndefined();
    expect(getTemplateSceneJson('unknown', atmosphere)).toBeUndefined();
  });

  it.each([
    ['現代藝術畫廊', 'bright'], ['汽車展示廳', 'bright'],
    ['科技展示廳', 'spotlight'], ['攝影作品展', 'spotlight'],
    ['歷史博物館', 'warm'], ['時尚展示間', 'warm'],
  ] as const)('%s starts in its curated %s atmosphere and still allows bright override', (title, atmosphere) => {
    expect(getDefaultGalleryAtmosphere(title)).toBe(atmosphere);
    expect(JSON.parse(getTemplateSceneJson(title)!).roomSize).toEqual(JSON.parse(getTemplateSceneJson(title, atmosphere)!).roomSize);
    expect(JSON.parse(getTemplateSceneJson(title, 'bright')!).roomSize.wallTextureUrl).toBe('/textures/template-wall.svg');
  });
});
