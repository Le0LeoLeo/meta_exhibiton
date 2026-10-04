import { describe, expect, it } from "vitest";
import { buildWallTopology, getFloorPlanCenter, getFloorPlanRoomBounds, type RoomBounds } from "./floorPlanGeometry";
import { getWallColliders } from "../player/wallCollision";

const room = (id: string, x: number, z: number, overrides: Partial<RoomBounds> = {}): RoomBounds => ({
  id, isLocked: false, doorWidth: 1.8, doorOffset: 0,
  minX: x - 4, maxX: x + 4, minZ: z - 4, maxZ: z + 4, ...overrides,
});
const topology = (rooms: RoomBounds[], height = 5) => buildWallTopology(rooms, height, 0.2, getFloorPlanCenter(rooms));

describe("gallery room entrances", () => {
  it.each([[8, 0], [-8, 0], [0, 8], [0, -8]])("creates a framed opening with an overhead wall towards %s,%s", (x, z) => {
    const result = topology([room("a", 0, 0), room("b", x, z)]);
    expect(result.doorOpenings).toHaveLength(1);
    const door = result.doorOpenings[0];
    expect(door.width).toBeCloseTo(1.8);
    expect(door.height).toBe(2.6);
    expect(door.depth).toBe(0.2);
    const lintel = result.segments.find((wall) => wall.id === `${door.id}:lintel`)!;
    expect(lintel.position[1] - lintel.size[1] / 2).toBeCloseTo(door.height!);
    expect(lintel.position[1] + lintel.size[1] / 2).toBeCloseTo(5);
    expect(lintel.size[0]).toBeCloseTo(door.width);
  });

  it("defaults new rooms to a wider passage while respecting saved widths", () => {
    const bounds = getFloorPlanRoomBounds([
      { id: "a", type: "room", position: [0, 0, 0], rotation: [0, 0, 0], scale: [8, 0.04, 8] },
      { id: "b", type: "room", position: [8, 0, 0], rotation: [0, 0, 0], scale: [8, 0.04, 8], doorWidth: 1.2 },
    ], 8, 8);
    expect(bounds.map((entry) => entry.doorWidth)).toEqual([1.8, 1.2]);
    const result = topology([room("a", 0, 0, { doorWidth: 1.2 }), room("b", 8, 0, { doorWidth: 1.2 })]);
    expect(result.doorOpenings[0].width).toBeCloseTo(1.2);
  });

  it.each([-100, 100])("keeps an extreme offset %s inside the shared wall without clipping the door", (offset) => {
    const result = topology([room("a", 0, 0, { doorOffset: offset }), room("b", 8, 0)]);
    const door = result.doorOpenings[0];
    expect(door.width).toBeCloseTo(1.8);
    expect(door.position[2] - door.width / 2).toBeGreaterThanOrEqual(-3.901);
    expect(door.position[2] + door.width / 2).toBeLessThanOrEqual(3.901);
  });

  it("caps the opening to a short shared edge and a low ceiling", () => {
    const result = topology([room("a", 0, 0), room("b", 8, 6.5)], 2.4);
    expect(result.doorOpenings[0].width).toBeCloseTo(1.3);
    expect(result.doorOpenings[0].height).toBe(2.4);
    expect(result.segments.some((wall) => wall.id.endsWith(":lintel"))).toBe(false);
    expect(result.segments.every((wall) => wall.size.every((size) => size > 0))).toBe(true);
  });

  it("does not invent entrances for a standalone room or disconnected rooms", () => {
    expect(topology([room("a", 0, 0)]).doorOpenings).toEqual([]);
    expect(topology([room("a", 0, 0), room("b", 10, 0)]).doorOpenings).toEqual([]);
  });

  it("merges overlapping openings before adding their lintels and trim metadata", () => {
    const result = topology([room("a", 0, 0), room("b", 8, 0), room("c", 8, 0.2)]);
    expect(result.doorOpenings).toHaveLength(1);
    expect(result.segments.filter((wall) => wall.id.endsWith(":lintel"))).toHaveLength(1);
  });
});

describe("entrance collision alignment", () => {
  it.each([[8, 0], [0, 8]])("allows both directions through an offset door at %s,%s and blocks its jambs", (dx, dz) => {
    // The anchor is deliberately away from the origin: rendering and movement must recenter identically.
    const rooms = [room("a", 15, 20, { isLocked: true, doorOffset: 1.5, doorWidth: 1.2 }), room("b", 15 + dx, 20 + dz, { doorWidth: 1.2 })];
    const result = topology(rooms);
    const door = result.doorOpenings[0];
    const colliders = getWallColliders(result, 1.9);
    const blocked = (x: number, z: number) => colliders.some((wall) => {
      const cos = Math.cos(wall.rotation[1]);
      const sin = Math.sin(wall.rotation[1]);
      const rx = x - wall.position[0];
      const rz = z - wall.position[2];
      return Math.abs(rx * cos - rz * sin) < wall.halfX + 0.35
        && Math.abs(rx * sin + rz * cos) < wall.halfZ + 0.35;
    });
    for (const normal of [-0.6, -0.3, 0, 0.3, 0.6]) {
      expect(blocked(door.position[0] + Math.sin(door.rotationY) * normal, door.position[2] + Math.cos(door.rotationY) * normal)).toBe(false);
    }
    const jamb = door.width / 2 + 0.1;
    expect(blocked(door.position[0] + Math.cos(door.rotationY) * jamb, door.position[2] - Math.sin(door.rotationY) * jamb)).toBe(true);
    expect(colliders).toHaveLength(result.segments.length - 1);
  });
});
