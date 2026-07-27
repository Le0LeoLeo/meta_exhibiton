import { describe, expect, it } from "vitest";
import {
  getAvatarAnimationPhase,
  getWalkAnimationTimeScale,
} from "./AvatarModel";

describe("AvatarModel animation helpers", () => {
  it("creates a stable per-player animation phase", () => {
    const first = getAvatarAnimationPhase("visitor-42");

    expect(first).toBe(getAvatarAnimationPhase("visitor-42"));
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(1);
    expect(first).not.toBe(getAvatarAnimationPhase("visitor-43"));
  });

  it("clamps walk animation time scale to a natural range", () => {
    expect(getWalkAnimationTimeScale(0)).toBe(0.7);
    expect(getWalkAnimationTimeScale(1.4)).toBe(1);
    expect(getWalkAnimationTimeScale(20)).toBe(1.35);
    expect(getWalkAnimationTimeScale(Number.NaN)).toBe(0.7);
  });
});
