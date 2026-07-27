import { describe, expect, it } from "vitest";

import { getGalleryGroundingSettings } from "./GalleryGrounding";

describe("gallery grounding tiers", () => {
  it("uses a 512px contact shadow and two shadow-free bounce lights in quality", () => {
    const settings = getGalleryGroundingSettings("quality");

    expect(settings.contactShadow).toMatchObject({
      enabled: true,
      resolution: 512,
    });
    expect(settings.bounceLights).toHaveLength(2);
    expect(settings.bounceLights.every((light) => !light.castShadow)).toBe(true);
  });

  it("reduces grounding work in balanced mode", () => {
    const quality = getGalleryGroundingSettings("quality");
    const balanced = getGalleryGroundingSettings("balanced");

    expect(balanced.contactShadow).toMatchObject({
      enabled: true,
      resolution: 256,
    });
    expect(balanced.contactShadow.opacity).toBeLessThan(
      quality.contactShadow.opacity,
    );
    expect(balanced.bounceLights).toHaveLength(1);
    expect(balanced.bounceLights[0]?.castShadow).toBe(false);
  });

  it("disables contact shadows and bounce lights in performance mode", () => {
    const settings = getGalleryGroundingSettings("performance");

    expect(settings.contactShadow.enabled).toBe(false);
    expect(settings.contactShadow.resolution).toBe(0);
    expect(settings.bounceLights).toEqual([]);
  });
});
