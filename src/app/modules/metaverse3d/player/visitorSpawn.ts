import type { ExhibitItem } from '../types';
import { getFloorPlanCenter, type RoomBounds } from '../store/floorPlanGeometry';
import { createWorldItemColliders, resolvePlayerCircle } from './itemCollision';

/** Visitors closer than this to another visitor's spawn would see only that avatar. */
export const VISITOR_SPAWN_SPACING = 1.4;

/** Choose a clear point inside a real room, in the same centered coordinates as Room. */
export function getVisitorSpawn(
  rooms: RoomBounds[],
  items: ExhibitItem[],
  wallThickness: number,
  eyeHeight: number,
  occupied: ReadonlyArray<{ x: number; z: number }> = [],
) {
  const center = getFloorPlanCenter(rooms);
  const clearance = Math.max(0.8, wallThickness / 2 + 0.45);
  const colliders = createWorldItemColliders(items);
  const orderedRooms = [...rooms].sort((a, b) => Number(b.isLocked) - Number(a.isLocked));
  for (const room of orderedRooms) {
    const minX = room.minX - center.x + clearance;
    const maxX = room.maxX - center.x - clearance;
    const minZ = room.minZ - center.z + clearance;
    const maxZ = room.maxZ - center.z - clearance;
    if (minX > maxX || minZ > maxZ) continue;
    const artwork = items.find((item) => item.type === 'painting'
      && item.position[0] >= room.minX - center.x && item.position[0] <= room.maxX - center.x
      && item.position[2] >= room.minZ - center.z && item.position[2] <= room.maxZ - center.z);
    const middle = { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };
    const candidates = [middle];
    // When others are already standing at the entrance, try spots just beside it first.
    if (occupied.length) {
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [2, 0], [-2, 0], [1, 1], [-1, 1]]) {
        candidates.push({
          x: Math.min(maxX, Math.max(minX, middle.x + dx * VISITOR_SPAWN_SPACING)),
          z: Math.min(maxZ, Math.max(minZ, middle.z + dz * VISITOR_SPAWN_SPACING)),
        });
      }
    }
    for (const z of [0.25, 0.75, 0, 1]) {
      for (const x of [0.5, 0.25, 0.75, 0, 1]) candidates.push({ x: minX + (maxX - minX) * x, z: minZ + (maxZ - minZ) * z });
    }
    for (const point of candidates) {
      if (resolvePlayerCircle({ ...point, radius: 0.4, minY: 0, maxY: eyeHeight }, colliders).collided) continue;
      if (occupied.some((other) => Math.hypot(other.x - point.x, other.z - point.z) < VISITOR_SPAWN_SPACING - 0.01)) continue;
      const targetX = artwork?.position[0] ?? point.x;
      const targetZ = artwork?.position[2] ?? minZ;
      return { position: { ...point, y: eyeHeight }, yaw: Math.atan2(point.x - targetX, point.z - targetZ) };
    }
  }
  // A completely obstructed room has no navigable spawn; keep the camera inside its bounds.
  return { position: { x: 0, y: eyeHeight, z: 0 }, yaw: 0 };
}
