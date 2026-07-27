import { describe, expect, it } from "vitest";

import type { ExhibitItem } from "../types";
import { getArtworkLightTargets } from "./GalleryArtworkLighting";

function item(
  id: string,
  type: ExhibitItem["type"],
  position: ExhibitItem["position"],
  rotationY = 0,
): ExhibitItem {
  return {
    id,
    type,
    position,
    rotation: [0, rotationY, 0],
    scale: [1, 1, 1],
    content: "",
  };
}

describe("getArtworkLightTargets", () => {
  const items = [
    item("painting-near", "painting", [0, 1.55, 4]),
    item("text-near", "text", [1, 1.65, 3]),
    item("painting-mid", "painting", [-4, 1.6, 2], Math.PI / 2),
    item("text-mid", "text", [4, 1.5, 0], -Math.PI / 2),
    item("painting-far", "painting", [0, 1.45, -10]),
    item("bench-closest", "bench", [0, 0.5, 5]),
  ];

  it("ranks artwork by distance from spawn and caps quality at four", () => {
    const targets = getArtworkLightTargets(items, "quality");

    expect(targets).toHaveLength(4);
    expect(targets.map((target) => target.id)).toEqual([
      "painting-near",
      "text-near",
      "painting-mid",
      "text-mid",
    ]);
  });

  it("caps balanced at two and disables artwork lights in performance mode", () => {
    expect(getArtworkLightTargets(items, "balanced")).toHaveLength(2);
    expect(getArtworkLightTargets(items, "performance")).toEqual([]);
  });

  it("ignores every non-painting and non-text item", () => {
    const nonArtwork = items.filter(
      (candidate) => candidate.type !== "painting" && candidate.type !== "text",
    );

    expect(getArtworkLightTargets(nonArtwork, "quality")).toEqual([]);
  });

  it("derives an inward ceiling position from wall rotation and clamps target height", () => {
    const [target] = getArtworkLightTargets(
      [item("west-wall", "painting", [-4.4, 3.2, 2], Math.PI / 2)],
      "quality",
    );

    expect(target.target).toEqual([-4.4, 1.85, 2]);
    expect(target.position[0]).toBeGreaterThan(-4.4);
    expect(target.position[1]).toBeGreaterThan(target.target[1]);
    expect(target.position[2]).toBeCloseTo(2);
  });
});
