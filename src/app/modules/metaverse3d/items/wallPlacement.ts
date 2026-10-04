import type { ExhibitItem, FloorPlanElement, RoomSize } from "../types";
import { buildWallTopology, getFloorPlanCenter, getFloorPlanRoomBounds } from "../store/floorPlanGeometry";

export function isWallMountedItem(type: ExhibitItem["type"]) {
  return type === "painting" || type === "text" || type === "lightstrip";
}

// Distance from the item's origin to its back, plus a small mounting gap.
export function getWallMountOffset(type: ExhibitItem["type"], scaleZ?: number) {
  const depth = type === "painting" ? 0.1 : type === "text" ? 0.075 : 0.44;
  return depth * Math.abs(scaleZ ?? (type === "lightstrip" ? 0.12 : 1)) + 0.01;
}

export function snapExhibitToWall(
  item: ExhibitItem,
  position: [number, number, number],
  roomSize: RoomSize,
  floorPlanElements: FloorPlanElement[],
  items: ExhibitItem[],
) {
  if (!isWallMountedItem(item.type)) return null;
  const bounds = getFloorPlanRoomBounds(floorPlanElements, roomSize.width, roomSize.length);
  const walls = buildWallTopology(bounds, roomSize.height, Math.max(0.12, roomSize.wallThickness), getFloorPlanCenter(bounds)).segments;
  const surfaces = walls.map((wall) => ({
    position: wall.position,
    rotationY: wall.rotationY,
    width: wall.size[0], height: wall.size[1], depth: wall.size[2],
  }));
  for (const partition of items.filter((entry) => entry.type === "partition" && entry.id !== item.id)) {
    for (const side of [0, Math.PI]) {
      surfaces.push({
        position: partition.position,
        rotationY: partition.rotation[1] + side,
        width: Math.abs(partition.scale[0]), height: Math.abs(partition.scale[1]), depth: Math.abs(partition.scale[2]),
      });
    }
  }
  const halfWidth = (item.type === "painting" ? (item.frameWidth ?? 2) / 2 + 0.1 : item.type === "lightstrip" ? 0.5 : 0.8) * Math.abs(item.scale[0]);
  const halfHeight = (item.type === "painting" ? (item.frameHeight ?? 1.5) / 2 + 0.1 : item.type === "lightstrip" ? 0.41 : 0.6) * Math.abs(item.scale[1]);
  let closest: { position: [number, number, number]; rotation: [number, number, number] } | null = null;
  let distance = Infinity;
  for (const surface of surfaces) {
    const limit = surface.width / 2 - halfWidth - 0.02;
    const verticalLimit = surface.height / 2 - halfHeight - 0.02;
    if (limit < 0 || verticalLimit < 0) continue;
    const nx = Math.sin(surface.rotationY), nz = Math.cos(surface.rotationY);
    const dx = position[0] - surface.position[0], dz = position[2] - surface.position[2];
    // Do not choose the far side of a partition or a wall behind the exhibit.
    if (dx * nx + dz * nz < -0.01) continue;
    const along = Math.max(-limit, Math.min(limit, dx * nz - dz * nx));
    const y = surface.position[1] + Math.max(-verticalLimit, Math.min(verticalLimit, position[1] - surface.position[1]));
    const offset = surface.depth / 2 + getWallMountOffset(item.type, item.scale[2]);
    const next: [number, number, number] = [surface.position[0] + along * nz + offset * nx, y, surface.position[2] - along * nx + offset * nz];
    const nextDistance = Math.hypot(next[0] - position[0], next[1] - position[1], next[2] - position[2]);
    if (nextDistance < distance) {
      distance = nextDistance;
      closest = { position: next, rotation: [0, surface.rotationY, 0] };
    }
  }
  return closest;
}
