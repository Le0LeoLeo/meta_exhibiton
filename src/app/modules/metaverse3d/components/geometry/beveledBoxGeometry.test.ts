import { describe, expect, it } from "vitest";
import { RoundedBoxGeometry } from "three-stdlib";
import {
  createBeveledBoxGeometry,
  normalizeBevelSize,
} from "./beveledBoxGeometry";

describe("normalizeBevelSize", () => {
  it("caps bevels below half the smallest dimension", () => {
    expect(normalizeBevelSize([1, 0.1, 2], 0.08)).toBeLessThan(0.05);
  });

  it("preserves a subtle architectural bevel", () => {
    expect(normalizeBevelSize([2, 1, 1], 0.012)).toBeCloseTo(0.012);
  });

  it("does not allow a negative bevel", () => {
    expect(normalizeBevelSize([1, 1, 1], -0.01)).toBe(0);
  });
});

describe("createBeveledBoxGeometry", () => {
  it("creates a rounded box geometry", () => {
    const geometry = createBeveledBoxGeometry([2, 1, 0.2], 0.012);

    expect(geometry).toBeInstanceOf(RoundedBoxGeometry);
    expect(geometry.getAttribute("position").count).toBeGreaterThan(0);

    geometry.dispose();
  });

  it("caps bevel detail at two segments", () => {
    const twoSegments = createBeveledBoxGeometry([1, 1, 1], 0.01, 2);
    const excessiveSegments = createBeveledBoxGeometry([1, 1, 1], 0.01, 20);

    expect(excessiveSegments.getAttribute("position").count).toBe(
      twoSegments.getAttribute("position").count,
    );

    twoSegments.dispose();
    excessiveSegments.dispose();
  });
});
