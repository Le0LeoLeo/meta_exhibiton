import { describe, expect, it } from "vitest";
import {
  getPaintingFrameAppearance,
  getPaintingFrameMaterial,
  PAINTING_FRAME_PRESETS,
} from "./paintingFrameAppearance";

describe("paintingFrameAppearance", () => {
  it("keeps legacy paintings visually compatible with the modern preset", () => {
    expect(getPaintingFrameAppearance({})).toEqual(
      PAINTING_FRAME_PRESETS[0].appearance,
    );
  });

  it("clamps imported dimensions to render-safe ranges", () => {
    const appearance = getPaintingFrameAppearance({
      frameThickness: 4,
      frameDepth: -1,
      frameMatWidth: 2,
    });

    expect(appearance.frameThickness).toBe(0.3);
    expect(appearance.frameDepth).toBe(0.02);
    expect(appearance.frameMatWidth).toBe(0.35);
  });

  it("gives metal and wood presets distinct physical material responses", () => {
    expect(getPaintingFrameMaterial("metal").metalness).toBeGreaterThan(0.8);
    expect(getPaintingFrameMaterial("natural").roughness).toBeGreaterThan(0.6);
  });
});
