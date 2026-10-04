import { describe, expect, it } from "vitest";
import {
  DEFAULT_CAMERA_FOV,
  DEFAULT_EYE_HEIGHT,
  DEFAULT_ARTWORK_CENTER_HEIGHT,
} from "./sceneScale";

describe("scene scale", () => {
  it("uses a natural standing eye height", () => {
    expect(DEFAULT_EYE_HEIGHT).toBeGreaterThanOrEqual(1.35);
    expect(DEFAULT_EYE_HEIGHT).toBeLessThanOrEqual(1.45);
  });

  it("keeps artwork near gallery eye level", () => {
    expect(DEFAULT_ARTWORK_CENTER_HEIGHT).toBeCloseTo(1.55, 2);
  });

  it("uses a restrained architectural field of view", () => {
    expect(DEFAULT_CAMERA_FOV).toBeGreaterThanOrEqual(48);
    expect(DEFAULT_CAMERA_FOV).toBeLessThanOrEqual(55);
  });
});
