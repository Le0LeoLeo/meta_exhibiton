import { Box3, Vector3, type Camera, type PerspectiveCamera } from 'three';
import { getFloorPlanCenter, getFloorPlanRoomBounds } from '@/app/modules/metaverse3d/store/floorPlanGeometry';
import type { SceneSnapshot } from '@/app/modules/metaverse3d/store/metaverseStoreTypes';

export function getPreviewRoomBounds(scene: SceneSnapshot): Box3[] {
  const rooms = getFloorPlanRoomBounds(scene.floorPlanElements, scene.roomSize.width, scene.roomSize.length);
  const center = getFloorPlanCenter(rooms);
  const halfWall = Math.max(0.12, scene.roomSize.wallThickness) / 2;
  return rooms.map((room) => new Box3(
    new Vector3(room.minX - center.x + halfWall, 0, room.minZ - center.z + halfWall),
    new Vector3(room.maxX - center.x - halfWall, scene.roomSize.height, room.maxZ - center.z - halfWall),
  ));
}

// Project onto an actual room, not the union's bounding box (which can include outdoors).
function keepInRoom(point: Vector3, rooms: Box3[], clearance: number): boolean {
  let distance = Infinity;
  let x = point.x; let y = point.y; let z = point.z;
  for (const room of rooms) {
    const clamp = (value: number, min: number, max: number) => {
      const inset = Math.min(clearance, Math.max(0, (max - min) / 2));
      return Math.max(min + inset, Math.min(max - inset, value));
    };
    const cx = clamp(point.x, room.min.x, room.max.x);
    const cy = clamp(point.y, room.min.y, room.max.y);
    const cz = clamp(point.z, room.min.z, room.max.z);
    const candidate = (point.x - cx) ** 2 + (point.y - cy) ** 2 + (point.z - cz) ** 2;
    if (candidate < distance) { distance = candidate; x = cx; y = cy; z = cz; }
  }
  const changed = x !== point.x || y !== point.y || z !== point.z;
  point.set(x, y, z);
  return changed;
}

/** Apply after OrbitControls.update, before rendering, including damping and touch gestures. */
export function constrainPreviewCamera(camera: Camera, target: Vector3, rooms: Box3[]): void {
  const perspective = camera as PerspectiveCamera;
  // Keep the whole near plane inside, even on wide canvases or when looking diagonally.
  const nearRadius = perspective.isPerspectiveCamera
    ? perspective.near * Math.hypot(1, Math.tan(perspective.getEffectiveFOV() * Math.PI / 360) * Math.hypot(1, perspective.aspect))
    : 0;
  const movedTarget = keepInRoom(target, rooms, 0);
  const movedCamera = keepInRoom(camera.position, rooms, Math.max(0.35, nearRadius + 0.05));
  if (movedCamera || movedTarget) camera.lookAt(target);
}
