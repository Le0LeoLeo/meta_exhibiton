import { describe, expect, it } from "vitest";
import { NoColorSpace, RGBAFormat, RepeatWrapping } from "three";
import {
  FLOOR_VARIATION_MAX,
  FLOOR_VARIATION_MIN,
  FLOOR_VARIATION_TEXTURE_SIZE,
  createFloorVariationData,
  createFloorSurfaceVariationTexture,
} from "./floorSurfaceVariation";

describe("createFloorVariationData", () => {
  it("is deterministic for a given size and seed", () => {
    expect(createFloorVariationData(32, 16, 417)).toEqual(
      createFloorVariationData(32, 16, 417),
    );
  });

  it("keeps the subtle grayscale response within its bounds", () => {
    const values = createFloorVariationData(64, 64, 417);

    expect(values).toHaveLength(64 * 64);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(FLOOR_VARIATION_MIN);
    expect(Math.max(...values)).toBeLessThanOrEqual(FLOOR_VARIATION_MAX);
  });

  it("contains smooth, non-uniform low-frequency variation", () => {
    const values = createFloorVariationData(64, 64, 417);
    const uniqueValues = new Set(values);
    let adjacentDelta = 0;

    for (let y = 0; y < 64; y += 1) {
      for (let x = 1; x < 64; x += 1) {
        const index = y * 64 + x;
        adjacentDelta = Math.max(
          adjacentDelta,
          Math.abs(values[index] - values[index - 1]),
        );
      }
    }

    expect(uniqueValues.size).toBeGreaterThan(8);
    expect(adjacentDelta).toBeLessThanOrEqual(12);
  });

  it("changes the pattern when the seed changes", () => {
    expect(createFloorVariationData(16, 16, 417)).not.toEqual(
      createFloorVariationData(16, 16, 418),
    );
  });
});

describe("createFloorSurfaceVariationTexture", () => {
  it("creates a repeatable linear-data roughness texture", () => {
    const texture = createFloorSurfaceVariationTexture(417);

    expect(texture.image.width).toBe(FLOOR_VARIATION_TEXTURE_SIZE);
    expect(texture.image.height).toBe(FLOOR_VARIATION_TEXTURE_SIZE);
    expect(texture.format).toBe(RGBAFormat);
    expect(texture.image.data).toHaveLength(
      FLOOR_VARIATION_TEXTURE_SIZE * FLOOR_VARIATION_TEXTURE_SIZE * 4,
    );
    expect(texture.colorSpace).toBe(NoColorSpace);
    expect(texture.wrapS).toBe(RepeatWrapping);
    expect(texture.wrapT).toBe(RepeatWrapping);

    texture.dispose();
  });
});
