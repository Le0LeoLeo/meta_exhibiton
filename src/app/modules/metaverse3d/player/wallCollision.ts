import type { WallTopology } from "../store/floorPlanGeometry";

/** Player collisions use the exact visible walls, excluding overhead lintels. */
export function getWallColliders(topology: WallTopology, playerHeight: number) {
  return topology.segments
    .filter((wall) => wall.position[1] - wall.size[1] / 2 < playerHeight)
    .map((wall) => ({
      position: wall.position,
      rotation: wall.rotation,
      halfX: wall.size[0] / 2,
      halfZ: wall.size[2] / 2,
    }));
}
