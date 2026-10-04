import { describe, expect, it } from "vitest";
import {
  calculateSurfaceRepeat,
  getSurfaceTextureTransform,
  shouldUseFloorSurfaceVariation,
} from "./GallerySurfaceMaterial";

describe("calculateSurfaceRepeat", () => {
  it("keeps material scale stable as room size changes", () => {
    expect(calculateSurfaceRepeat(10, 8, [2, 2])).toEqual([5, 4]);
    expect(calculateSurfaceRepeat(20, 8, [2, 2])).toEqual([10, 4]);
  });

  it("does not repeat a texture below one tile", () => {
    expect(calculateSurfaceRepeat(0.5, 0.25, [2, 2])).toEqual([1, 1]);
  });
});

describe("getSurfaceTextureTransform", () => {
  it("returns a stable transform for the same surface", () => {
    expect(getSurfaceTextureTransform("room:north:0")).toEqual(
      getSurfaceTextureTransform("room:north:0"),
    );
  });

  it("varies offsets between adjacent surface ids", () => {
    const first = getSurfaceTextureTransform("room:north:0");
    const second = getSurfaceTextureTransform("room:north:1");

    expect(second.offset).not.toEqual(first.offset);
    expect(first.offset[0]).toBeGreaterThanOrEqual(0);
    expect(first.offset[0]).toBeLessThanOrEqual(0.5);
    expect(first.offset[1]).toBeGreaterThanOrEqual(0);
    expect(first.offset[1]).toBeLessThanOrEqual(0.5);
    expect([0, Math.PI]).toContain(first.rotation);
  });
});

describe("shouldUseFloorSurfaceVariation", () => {
  it("enables procedural roughness only for subtle oak surfaces", () => {
    expect(shouldUseFloorSurfaceVariation("oak-floor", "subtle")).toBe(true);
    expect(shouldUseFloorSurfaceVariation("oak-floor", "none")).toBe(false);
  });

  it("does not replace the roughness maps of other presets", () => {
    expect(shouldUseFloorSurfaceVariation("concrete-floor", "subtle")).toBe(false);
    expect(shouldUseFloorSurfaceVariation("plaster-wall", "subtle")).toBe(false);
  });
});
