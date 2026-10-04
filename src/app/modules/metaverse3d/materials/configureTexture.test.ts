import { describe, expect, it } from "vitest";
import {
  LinearSRGBColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
} from "three";
import { configureColorTexture, configureDataTexture } from "./configureTexture";

describe("gallery texture configuration", () => {
  it("configures color maps as repeated sRGB textures", () => {
    const texture = new Texture();

    configureColorTexture(texture, 3, 5, 8);

    expect(texture.colorSpace).toBe(SRGBColorSpace);
    expect(texture.wrapS).toBe(RepeatWrapping);
    expect(texture.wrapT).toBe(RepeatWrapping);
    expect(texture.repeat.toArray()).toEqual([3, 5]);
    expect(texture.anisotropy).toBe(8);
    expect(texture.generateMipmaps).toBe(true);
  });

  it("keeps data maps out of sRGB", () => {
    const texture = new Texture();

    configureDataTexture(texture, 2, 2, 4);

    expect(texture.colorSpace).toBe(LinearSRGBColorSpace);
    expect(texture.wrapS).toBe(RepeatWrapping);
    expect(texture.wrapT).toBe(RepeatWrapping);
    expect(texture.repeat.toArray()).toEqual([2, 2]);
    expect(texture.anisotropy).toBe(4);
  });
});
