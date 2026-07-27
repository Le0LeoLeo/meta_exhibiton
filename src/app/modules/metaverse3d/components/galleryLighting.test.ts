import { describe, expect, it } from "vitest";

import { getGalleryLightingSettings } from "./GalleryLighting";

describe("gallery lighting tiers", () => {
  it("keeps the key light dominant in quality mode", () => {
    const settings = getGalleryLightingSettings("quality");

    expect(settings.keyIntensity).toBeGreaterThan(settings.ambientIntensity * 10);
    expect(settings.accentIntensity).toBe(0);
    expect(settings.areaLightCount).toBe(3);
  });

  it("leaves artwork accents to the targeted lighting system", () => {
    expect(getGalleryLightingSettings("quality").accentIntensity).toBe(0);
    expect(getGalleryLightingSettings("balanced").accentIntensity).toBe(0);
    expect(getGalleryLightingSettings("performance").accentIntensity).toBe(0);
    expect(getGalleryLightingSettings("balanced").areaLightCount).toBe(2);
    expect(getGalleryLightingSettings("performance").areaLightCount).toBe(0);
  });

  it("adds enough fallback fill when environment lighting is disabled", () => {
    const quality = getGalleryLightingSettings("quality");
    const performance = getGalleryLightingSettings("performance");

    expect(performance.ambientIntensity).toBeGreaterThan(quality.ambientIntensity);
    expect(performance.hemisphereIntensity).toBeGreaterThan(
      quality.hemisphereIntensity,
    );
  });
});
