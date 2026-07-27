import { describe, expect, it } from "vitest";

import { getGalleryWallFinish } from "./galleryWallFinish";

describe("getGalleryWallFinish", () => {
  it("returns the same finish for the same segment", () => {
    expect(getGalleryWallFinish("room:north:0", "#ffffff", true)).toEqual(
      getGalleryWallFinish("room:north:0", "#ffffff", true),
    );
  });

  it("uses a warm off-white matte base when feature tinting is disabled", () => {
    expect(getGalleryWallFinish("room:north:0", "#ffffff", false)).toEqual({
      color: "#e1ded6",
      isFeatureTint: false,
    });
  });

  it("applies feature tinting to only a small deterministic subset", () => {
    const finishes = Array.from({ length: 120 }, (_, index) =>
      getGalleryWallFinish(`room:segment:${index}`, "#ffffff", true),
    );
    const featureCount = finishes.filter((finish) => finish.isFeatureTint).length;

    expect(featureCount).toBeGreaterThanOrEqual(5);
    expect(featureCount).toBeLessThanOrEqual(15);
    expect(new Set(finishes.filter((finish) => finish.isFeatureTint).map((finish) => finish.color)).size).toBeGreaterThan(1);
  });

  it("keeps feature colors close to the untinted base", () => {
    const base = getGalleryWallFinish("room:north:0", "#f4f1ea", false);
    const feature = Array.from({ length: 120 }, (_, index) =>
      getGalleryWallFinish(`room:segment:${index}`, "#f4f1ea", true),
    ).find((finish) => finish.isFeatureTint);

    expect(feature).toBeDefined();
    const channelDelta = (left: string, right: string) =>
      [1, 3, 5].map((offset) =>
        Math.abs(
          Number.parseInt(left.slice(offset, offset + 2), 16) -
            Number.parseInt(right.slice(offset, offset + 2), 16),
        ),
      );
    expect(Math.max(...channelDelta(feature!.color, base.color))).toBeLessThanOrEqual(8);
  });
});
