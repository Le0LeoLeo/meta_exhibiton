import { describe, expect, it } from "vitest";

import { getGalleryVisitorLayout } from "./GalleryVisitors";

describe("getGalleryVisitorLayout", () => {
  it("uses two, one, and zero visitors across quality tiers", () => {
    expect(getGalleryVisitorLayout("quality")).toHaveLength(2);
    expect(getGalleryVisitorLayout("balanced")).toHaveLength(1);
    expect(getGalleryVisitorLayout("performance")).toEqual([]);
  });

  it("is deterministic and keeps the central walking corridor clear", () => {
    const first = getGalleryVisitorLayout("quality");
    const second = getGalleryVisitorLayout("quality");

    expect(second).toEqual(first);
    for (const visitor of first) {
      expect(Math.abs(visitor.position[0])).toBeGreaterThanOrEqual(1.4);
      expect(visitor.position[1]).toBe(0);
    }
  });

  it("keeps motion amplitudes below perceptible idle-shift limits", () => {
    for (const visitor of getGalleryVisitorLayout("quality")) {
      expect(visitor.motionPhase).toBeGreaterThanOrEqual(0);
      expect(visitor.motionPhase).toBeLessThan(Math.PI * 2);
    }
  });
});
