import { describe, expect, it } from "vitest";

import { createRenderPerformanceProfile } from "../performanceProfile";
import {
  getAmbientOcclusionSettings,
  getGalleryPostprocessingSettings,
} from "./GalleryPostprocessing";

describe("ambient occlusion settings", () => {
  it("uses subtle high-quality AO", () => {
    expect(getAmbientOcclusionSettings("high")).toMatchObject({
      enabled: true,
      intensity: 0.65,
    });
  });

  it("uses a cheaper balanced preset", () => {
    const high = getAmbientOcclusionSettings("high");
    const low = getAmbientOcclusionSettings("low");

    expect(low.enabled).toBe(true);
    expect(low.samples).toBeLessThan(high.samples);
    expect(low.resolutionScale).toBeLessThan(high.resolutionScale);
  });

  it("fully disables AO in off mode", () => {
    expect(getAmbientOcclusionSettings("off").enabled).toBe(false);
  });
});

describe("gallery image finishing", () => {
  it("keeps quality finishing subtle enough for white gallery walls", () => {
    const profile = createRenderPerformanceProfile("quality", "quality");
    const settings = getGalleryPostprocessingSettings(profile);

    expect(settings.enabled).toBe(true);
    expect(settings.bloomThreshold).toBeGreaterThanOrEqual(1.05);
    expect(settings.bloomIntensity).toBeLessThanOrEqual(0.08);
    expect(settings.vignetteDarkness).toBeLessThan(0.2);
    expect(Math.abs(settings.saturation)).toBeLessThanOrEqual(0.08);
  });

  it("uses a lighter finish for balanced mode", () => {
    const quality = getGalleryPostprocessingSettings(
      createRenderPerformanceProfile("quality", "quality"),
    );
    const balanced = getGalleryPostprocessingSettings(
      createRenderPerformanceProfile("balanced", "balanced"),
    );

    expect(balanced.contrast).toBeLessThan(quality.contrast);
    expect(balanced.vignetteDarkness).toBeLessThanOrEqual(quality.vignetteDarkness);
  });

  it("disables every finishing pass in performance mode", () => {
    const settings = getGalleryPostprocessingSettings(
      createRenderPerformanceProfile("performance", "performance"),
    );

    expect(settings.enabled).toBe(false);
    expect(settings.bloomIntensity).toBe(0);
    expect(settings.vignetteDarkness).toBe(0);
  });
});
