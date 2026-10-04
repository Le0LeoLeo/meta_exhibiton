import { describe, expect, it } from "vitest";
import * as THREE from "three";

import {
  fitObjectToExhibit,
  getExhibitModelQuality,
  optimizeExhibitModel,
} from "./exhibitModelOptimization";

describe("getExhibitModelQuality", () => {
  it("reduces geometry and light cost in performance mode", () => {
    const quality = getExhibitModelQuality("quality");
    const performance = getExhibitModelQuality("performance");

    expect(performance.radialSegments).toBeLessThan(quality.radialSegments);
    expect(performance.sphereSegments).toBeLessThan(quality.sphereSegments);
    expect(performance.castShadows).toBe(false);
    expect(performance.decorativeLights).toBe(false);
  });
});

describe("optimizeExhibitModel", () => {
  it("configures meshes, bounds, shadows, and texture filtering", () => {
    const texture = new THREE.Texture();
    const geometry = new THREE.BoxGeometry();
    geometry.boundingBox = null;
    geometry.boundingSphere = null;
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ map: texture }),
    );
    const root = new THREE.Group();
    root.add(mesh);

    optimizeExhibitModel(root, getExhibitModelQuality("balanced"), 16);

    expect(mesh.castShadow).toBe(true);
    expect(mesh.receiveShadow).toBe(true);
    expect(mesh.frustumCulled).toBe(true);
    expect(
      (mesh.material as THREE.MeshStandardMaterial).envMapIntensity,
    ).toBe(0.9);
    expect(mesh.material.dithering).toBe(true);
    expect(geometry.boundingBox).not.toBeNull();
    expect(geometry.boundingSphere).not.toBeNull();
    expect(texture.anisotropy).toBe(4);
  });
});

describe("fitObjectToExhibit", () => {
  it("centers a model horizontally and grounds it on the pedestal", () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 2));
    mesh.position.set(4, 5, -3);

    const fit = fitObjectToExhibit(mesh, 1);

    expect(fit.scale).toBeCloseTo(0.25);
    expect(fit.offset).toEqual([-1, -0.75, 0.75]);
  });

  it("returns a stable transform for an empty model", () => {
    expect(fitObjectToExhibit(new THREE.Group())).toEqual({
      scale: 1,
      offset: [0, 0, 0],
    });
  });
});
