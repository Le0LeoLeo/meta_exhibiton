import { describe, expect, it } from "vitest";
import { defaultGalleryScene } from "./defaultGalleryScene";

const SPAWN: [number, number] = [0, 5];

function distanceFromSpawn(position: [number, number, number]) {
  return Math.hypot(position[0] - SPAWN[0], position[2] - SPAWN[1]);
}

describe("default gallery scene", () => {
  it("keeps every default exhibit compatible with multiplayer sync", () => {
    expect(
      defaultGalleryScene.items.every((item) => typeof item.content === "string"),
    ).toBe(true);
  });

  it("places at least three wall exhibits within 12m of spawn", () => {
    const nearbyWallExhibits = defaultGalleryScene.items.filter(
      (item) =>
        (item.type === "painting" || item.type === "text") &&
        distanceFromSpawn(item.position) <= 12,
    );

    expect(nearbyWallExhibits.length).toBeGreaterThanOrEqual(3);
  });

  it("includes seating or a pedestal near the central path", () => {
    expect(
      defaultGalleryScene.items.some(
        (item) =>
          (item.type === "bench" || item.type === "pedestal") &&
          distanceFromSpawn(item.position) <= 12,
      ),
    ).toBe(true);
  });

  it("includes a nearby plant or flower as a scale cue", () => {
    expect(
      defaultGalleryScene.items.some(
        (item) =>
          (item.type === "plant" || item.type === "flower") &&
          distanceFromSpawn(item.position) <= 12,
      ),
    ).toBe(true);
  });

  it("mounts artwork near gallery eye level", () => {
    const artworks = defaultGalleryScene.items.filter(
      (item) => item.type === "painting" || item.type === "text",
    );

    expect(artworks.length).toBeGreaterThanOrEqual(3);
    for (const artwork of artworks) {
      expect(artwork.position[1]).toBeGreaterThanOrEqual(1.45);
      expect(artwork.position[1]).toBeLessThanOrEqual(1.7);
    }
  });

  it("keeps the 1.2m-wide spawn corridor clear of floor exhibits", () => {
    const floorExhibits = defaultGalleryScene.items.filter((item) =>
      ["bench", "pedestal", "sculpture", "plant", "flower"].includes(item.type),
    );

    expect(floorExhibits.every((item) => Math.abs(item.position[0]) >= 1.2)).toBe(true);
  });
});
