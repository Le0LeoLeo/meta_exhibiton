import { describe, expect, it } from "vitest";

import type { RoomSize } from "../types";
import { MOUSE } from "three";
import { EDIT_CAMERA_LIMITS, EDIT_MOUSE_BUTTONS, getEditCameraPosition } from "./EditCanvas";

function roomSize(overrides: Partial<RoomSize> = {}): RoomSize {
  return {
    width: 24,
    length: 20,
    height: 6,
    wallThickness: 0.1,
    wallColor: "#f8fafc",
    floorColor: "#0f172a",
    ...overrides,
  };
}

describe("getEditCameraPosition", () => {
  it("starts comfortably inside a 20 metre room instead of intersecting its wall", () => {
    const position = getEditCameraPosition(roomSize());

    expect(position[0]).toBe(0);
    expect(position[1]).toBeCloseTo(4.2);
    expect(position[2]).toBe(5);
    expect(position[2]).toBeLessThan(10 - 1);
  });

  it("keeps the camera inside shorter rooms", () => {
    const position = getEditCameraPosition(roomSize({ length: 8, height: 4 }));

    expect(position).toEqual([0, 2.8, 2]);
    expect(position[2]).toBeLessThan(4 - 1);
  });
});

describe("edit camera controls", () => {
  it("allows ordinary left-drag rotation for discoverable multi-angle inspection", () => {
    expect(EDIT_MOUSE_BUTTONS.LEFT).toBe(MOUSE.ROTATE);
    expect(EDIT_MOUSE_BUTTONS.RIGHT).toBe(MOUSE.ROTATE);
  });


  it("keeps low-angle inspection above the floor plane", () => {
    expect(EDIT_CAMERA_LIMITS.maxPolarAngle).toBeLessThan(Math.PI / 2);
    expect(EDIT_CAMERA_LIMITS.minDistance).toBeGreaterThanOrEqual(2);
  });
});
