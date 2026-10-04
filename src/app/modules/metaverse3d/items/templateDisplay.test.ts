import { describe, expect, it } from 'vitest';
import { getTemplateDisplay, VEHICLE_PLATFORM_URL } from './templateDisplay';
import { exhibitItemSchema } from '../../../../../server/schemas/sceneSchema.js';
import { createWorldItemCollider, resolvePlayerCircle } from '../player/itemCollision';
import type { ExhibitItem } from '../types';

const car: ExhibitItem = { id: 'car', type: 'pedestal', content: '/templates/concept-car.glb', modelOffset: [0, 0, 0], position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };
describe('grounded template displays', () => {
  it('preserves the standalone low platform across serialization, with no vehicle and scaled collision', () => {
    const platform = { ...car, content: VEHICLE_PLATFORM_URL, scale: [2, 1, 1] as [number, number, number] };
    const restored = exhibitItemSchema.parse(JSON.parse(JSON.stringify(platform))) as ExhibitItem;
    expect(getTemplateDisplay(restored)).toMatchObject({ size: [5.4, 0.14, 2.6], modelSize: 0, totalHeight: 0.14 });
    const collider = createWorldItemCollider(restored);
    expect(collider.halfSize.x).toBe(5.4);
    expect(collider.maxY).toBeCloseTo(0.14);
  });
  it('uses a vehicle-sized low platform with collision at its outer edge', () => {
    expect(getTemplateDisplay(car)?.size).toEqual([5.4, 0.14, 2.6]);
    const collider = createWorldItemCollider(car);
    expect(collider.halfSize.x).toBe(2.7);
    expect(resolvePlayerCircle({ x: 2.5, z: 0, radius: 0.4, minY: 0, maxY: 1.7 }, [collider]).collided).toBe(true);
  });
  it('preserves previous offset scenes and unrelated uploads', () => {
    expect(getTemplateDisplay({ ...car, modelOffset: [0, -0.235, 0] })).toBeUndefined();
    expect(getTemplateDisplay({ ...car, content: '/api/media/my-model' })).toBeUndefined();
    expect(getTemplateDisplay({ ...car, type: 'painting' })).toBeUndefined();
    expect(createWorldItemCollider({ ...car, modelOffset: [0, -0.235, 0] }).halfSize.x).toBe(0.6);
  });
});
