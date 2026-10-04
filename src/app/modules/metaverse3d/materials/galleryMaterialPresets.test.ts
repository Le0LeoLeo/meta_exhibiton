import { describe, expect, it } from "vitest";

import {
  GALLERY_MATERIAL_PRESETS,
  resolveGalleryMaterialPreset,
} from "./galleryMaterialPresets";

describe("resolveGalleryMaterialPreset", () => {
  it("resolves PBR directory URLs without treating them as image files", () => {
    expect(
      resolveGalleryMaterialPreset("/textures/pbr/plaster-wall", "wall"),
    ).toBe("plaster-wall");
    expect(resolveGalleryMaterialPreset("/textures/pbr/oak-floor", "floor")).toBe(
      "oak-floor",
    );
  });

  it("maps legacy defaults to the closest physical preset", () => {
    expect(resolveGalleryMaterialPreset("/textures/wall-paint.svg", "wall")).toBe(
      "plaster-wall",
    );
    expect(
      resolveGalleryMaterialPreset("/textures/wall-concrete.svg", "floor"),
    ).toBe("concrete-floor");
  });

  it("leaves custom images on the legacy path", () => {
    expect(resolveGalleryMaterialPreset("blob:custom-wall", "wall")).toBeNull();
  });

  it("uses stable scalar roughness for the polished oak floor", () => {
    const oak = GALLERY_MATERIAL_PRESETS["oak-floor"];

    expect(oak.useRoughnessMap).toBe(false);
    expect(oak.roughness).toBeGreaterThanOrEqual(0.82);
    expect(oak.roughness).toBeLessThanOrEqual(0.88);
    expect(GALLERY_MATERIAL_PRESETS["concrete-floor"].useRoughnessMap).toBe(true);
    expect(GALLERY_MATERIAL_PRESETS["plaster-wall"].useRoughnessMap).toBe(true);
  });

  it("keeps exhibition plaster matte with restrained surface response", () => {
    const plaster = GALLERY_MATERIAL_PRESETS["plaster-wall"];

    expect(plaster.roughness).toBeGreaterThanOrEqual(0.94);
    expect(plaster.metalness).toBe(0);
    expect(plaster.useColorMap).toBe(false);
    expect(plaster.useAoMap).toBe(false);
    expect(plaster.normalScale).toBeLessThanOrEqual(0.12);
    expect(plaster.envMapIntensity).toBeLessThanOrEqual(0.2);
  });
});
