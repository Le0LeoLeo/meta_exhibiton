import { describe, expect, it } from "vitest";
import { fitImageWithin, getPaintingImageFit } from "./paintingImageFit";

describe("fitImageWithin", () => {
  it.each([
    [1600, 900], [900, 1600], [800, 800], [10000, 1], [1, 10000],
  ])("contains a %s by %s image without changing its aspect", (width, height) => {
    const fit = fitImageWithin(width, height, 2.4, 1.8);
    expect(fit.width).toBeGreaterThan(0);
    expect(fit.height).toBeGreaterThan(0);
    expect(fit.width).toBeLessThanOrEqual(2.4);
    expect(fit.height).toBeLessThanOrEqual(1.8);
    expect(fit.width / fit.height).toBeCloseTo(width / height, 8);
    expect(fit.width === 2.4 || fit.height === 1.8).toBe(true);
  });

  it.each([0, -1, NaN, Infinity])("rejects invalid dimensions %s", (invalid) => {
    for (let index = 0; index < 4; index++) {
      const values: [number, number, number, number] = [100, 200, 2, 1];
      values[index] = invalid;
      expect(() => fitImageWithin(...values)).toThrow(/Invalid image or display bounds/);
    }
  });
});

describe("getPaintingImageFit", () => {
  it("keeps legacy canvas and outer frame dimensions when no ratio is supplied", () => {
    expect(getPaintingImageFit()).toEqual({
      frameWidth: 2, frameHeight: 1.5, frameBorder: 0.12,
      outerWidth: 2.24, outerHeight: 1.74,
      canvasWidth: 1.76, canvasHeight: 1.26,
      imageWidth: 1.76, imageHeight: 1.26,
    });
  });

  it.each([1 / 10000, 0.5, 1, 2, 10000])("fits ratio %s inside the existing frame opening", (aspect) => {
    const fit = getPaintingImageFit(2.4, 1.8, aspect);
    expect(fit.imageWidth).toBeLessThanOrEqual(fit.canvasWidth);
    expect(fit.imageHeight).toBeLessThanOrEqual(fit.canvasHeight);
    expect(fit.imageWidth / fit.imageHeight).toBeCloseTo(aspect, 8);
    expect(fit.imageWidth === fit.canvasWidth || fit.imageHeight === fit.canvasHeight).toBe(true);
  });

  it("retains the renderer's minimum frame sizes", () => {
    const fit = getPaintingImageFit(0.001, 0.001, 1000);
    expect(fit.frameWidth).toBe(0.8);
    expect(fit.frameHeight).toBe(0.6);
    expect(fit.imageWidth / fit.imageHeight).toBeCloseTo(1000);
  });

  it("uses the entire nominal frame for borderless artwork", () => {
    const fit = getPaintingImageFit(3.5, 2.8, 1.25, 0);
    expect(fit.frameBorder).toBe(0);
    expect(fit.outerWidth).toBe(3.5);
    expect(fit.canvasWidth).toBe(3.5);
    expect(fit.canvasHeight).toBe(2.8);
    expect(fit.imageWidth / fit.imageHeight).toBeCloseTo(1.25);
  });

  it("places half the visible rail thickness inside and half outside the nominal bounds", () => {
    const fit = getPaintingImageFit(3.5, 2.8, undefined, 0.045 / 2);
    expect(fit.frameBorder).toBe(0.0225);
    expect(fit.outerWidth).toBeCloseTo(3.545);
    expect(fit.canvasWidth).toBeCloseTo(3.455);
    expect((fit.outerWidth - fit.canvasWidth) / 2).toBeCloseTo(0.045);
  });

  it("clamps negative or excessive borders while preserving an image opening", () => {
    expect(getPaintingImageFit(2, 1.5, undefined, -1).frameBorder).toBe(0);
    const fit = getPaintingImageFit(0.8, 0.6, 2, 100);
    expect(fit.frameBorder).toBe(0.15);
    expect(fit.canvasHeight).toBeCloseTo(0.3);
    expect(fit.imageWidth / fit.imageHeight).toBeCloseTo(2);
    expect(getPaintingImageFit(20, 20, undefined, 100).frameBorder).toBe(0.5);
  });

  it.each([NaN, Infinity, -Infinity])("preserves the legacy border for malformed override %s", (border) => {
    expect(getPaintingImageFit(2, 1.5, undefined, border)).toEqual(getPaintingImageFit());
  });

  it.each([0, -1, NaN, Infinity])("falls back to legacy fill for a malformed old ratio %s", (ratio) => {
    const fit = getPaintingImageFit(2, 1.5, ratio);
    expect(fit.imageWidth).toBe(fit.canvasWidth);
    expect(fit.imageHeight).toBe(fit.canvasHeight);
  });
});
