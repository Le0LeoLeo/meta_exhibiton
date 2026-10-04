import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { OrbitControls } from 'three-stdlib';
import { createDemoScene } from '@/app/features/public-demo/demoScene';
import { constrainPreviewCamera, getPreviewRoomBounds } from './previewCameraBounds';

describe('gallery preview camera containment', () => {
  const scene = createDemoScene((key) => key);

  it('keeps the near-plane corners inside through rotation, extreme zoom and panning', () => {
    const rooms = getPreviewRoomBounds(scene);
    const camera = new PerspectiveCamera(52, 4, 0.08, 180);
    const controls = new OrbitControls(camera);
    controls.enableDamping = true;
    for (const artwork of scene.items) {
      for (let step = 0; step < 100; step++) {
        controls.target.fromArray(artwork.position).add(new Vector3(step % 3 === 0 ? 100 : 0, 0, 0));
        camera.position.set(Math.sin(step) * 100, (step % 3 - 1) * 100, Math.cos(step) * 100);
        controls.update();
        constrainPreviewCamera(camera, controls.target, rooms);
        camera.updateMatrixWorld();
        expect(rooms[0].containsPoint(camera.position)).toBe(true);
        for (const x of [-1, 1]) for (const y of [-1, 1]) {
          expect(rooms[0].containsPoint(new Vector3(x, y, -1).unproject(camera))).toBe(true);
        }
      }
    }
    controls.dispose();
  });

  it('preserves the initial artwork focus and ordinary interior movement', () => {
    const camera = new PerspectiveCamera(52, 1.5, 0.08, 180);
    const target = new Vector3(...scene.items[0].position);
    camera.position.copy(target).add(new Vector3(0, 0.2, 6));
    const before = camera.position.clone();
    constrainPreviewCamera(camera, target, getPreviewRoomBounds(scene));
    expect(camera.position).toEqual(before);
    expect(target.toArray()).toEqual(scene.items[0].position);
  });

  it('respects offset floor plans and excludes the gap between separate rooms', () => {
    const offsetScene = { ...scene, floorPlanElements: [
      { id: 'anchor', type: 'room' as const, position: [20, 0, 30] as [number, number, number], scale: [8, 1, 8] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], isLocked: true },
      { id: 'second', type: 'room' as const, position: [40, 0, 30] as [number, number, number], scale: [8, 1, 8] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] },
    ] };
    const rooms = getPreviewRoomBounds(offsetScene);
    const camera = new PerspectiveCamera(52, 1.5, 0.08, 180);
    camera.position.set(10, -20, 0);
    const target = new Vector3(10, 100, 0);
    constrainPreviewCamera(camera, target, rooms);
    expect(rooms.some((room) => room.containsPoint(camera.position))).toBe(true);
    expect(rooms.some((room) => room.containsPoint(target))).toBe(true);
    expect(camera.position.x).toBeLessThan(4);
    expect(camera.position.y).toBeGreaterThan(0);
    expect(target.y).toBeLessThanOrEqual(scene.roomSize.height);
  });
});
