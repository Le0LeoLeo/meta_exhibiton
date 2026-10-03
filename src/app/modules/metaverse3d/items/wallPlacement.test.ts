import { describe, expect, it } from "vitest";
import type { ExhibitItem, FloorPlanElement, RoomSize } from "../types";
import { getWallMountOffset, snapExhibitToWall } from "./wallPlacement";

const room = { width: 20, length: 20, height: 5, wallThickness: 0.2 } as RoomSize;
const painting: ExhibitItem = { id: "art", type: "painting", position: [0, 2, 0], rotation: [0, 0, 0], scale: [1, 1, 1], content: "" };

describe("automatic wall placement", () => {
  it.each([
    [[0, 2, -2], [0, 2, -9.79], 0],
    [[0, 2, 2], [0, 2, 9.79], Math.PI],
    [[2, 2, 0], [9.79, 2, 0], -Math.PI / 2],
    [[-2, 2, 0], [-9.79, 2, 0], Math.PI / 2],
  ])("mounts beyond the old proximity threshold: %j", (position, expected, yaw) => {
    const result = snapExhibitToWall(painting, position as [number, number, number], room, [], []);
    result!.position.forEach((value, i) => expect(value).toBeCloseTo((expected as number[])[i]));
    expect(result!.rotation).toEqual([0, yaw, 0]);
  });

  it.each([1, -1])("mounts on either side of a rotated partition (%s)", (side) => {
    const partition: ExhibitItem = { ...painting, id: "wall", type: "partition", position: [0, 2.5, 0], rotation: [0, Math.PI / 2, 0], scale: [6, 5, 0.4] };
    const result = snapExhibitToWall(painting, [side, 2, 0], room, [], [partition]);
    expect(result!.position[0]).toBeCloseTo(side * 0.31);
    expect(result!.position[2]).toBeCloseTo(0);
    expect(Math.sin(result!.rotation[1])).toBeCloseTo(side);
  });

  it("uses actual additional room walls", () => {
    const rooms: FloorPlanElement[] = [
      { id: "main", type: "room", position: [0, 0, 0], rotation: [0, 0, 0], scale: [20, 5, 20], isLocked: true },
      { id: "next", type: "room", position: [20, 0, 0], rotation: [0, 0, 0], scale: [20, 5, 20] },
    ];
    const result = snapExhibitToWall(painting, [28, 2, 0], room, rooms, []);
    expect(result!.position[0]).toBeCloseTo(29.79);
  });

  it("keeps scaled art inside the wall and accounts for its back depth", () => {
    const result = snapExhibitToWall({ ...painting, scale: [2, 2, 2] }, [9.8, 9, -9.9], room, [], []);
    expect(result!.position[1]).toBeCloseTo(3.28);
    expect(Math.abs(result!.position[0])).toBeLessThanOrEqual(9.69);
    expect(getWallMountOffset("painting", 2)).toBeCloseTo(0.21);
  });

  it("does not move free standing exhibits", () => {
    expect(snapExhibitToWall({ ...painting, type: "sculpture" }, [0, 0, 0], room, [], [])).toBeNull();
  });

  it("does not mount in a doorway or on a wall too small for the art", () => {
    const rooms: FloorPlanElement[] = [
      { id: "main", type: "room", position: [0, 0, 0], rotation: [0, 0, 0], scale: [20, 5, 20], isLocked: true },
      { id: "next", type: "room", position: [20, 0, 0], rotation: [0, 0, 0], scale: [20, 5, 20] },
    ];
    const result = snapExhibitToWall(painting, [9.5, 1.5, 0], room, rooms, []);
    expect(Math.abs(result!.position[2])).toBeGreaterThan(1.8 / 2 + 1);
    expect(snapExhibitToWall({ ...painting, scale: [100, 100, 1] }, [0, 2, 0], room, [], [])).toBeNull();
  });
});
