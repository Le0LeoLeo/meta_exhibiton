import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RGBAFormat,
  RepeatWrapping,
  UnsignedByteType,
} from "three";

export const FLOOR_VARIATION_MIN = 232;
export const FLOOR_VARIATION_MAX = 252;
export const FLOOR_VARIATION_TEXTURE_SIZE = 64;

function hashSample(x: number, y: number, seed: number) {
  let value = (seed ^ Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263)) >>> 0;
  value = Math.imul(value ^ (value >>> 13), 1274126177) >>> 0;
  return ((value ^ (value >>> 16)) >>> 0) / 0xffffffff;
}

function smoothStep(value: number) {
  return value * value * (3 - 2 * value);
}

function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

/**
 * Creates subtle, low-frequency roughness values without relying on global random
 * state. A coarse interpolated grid keeps the map stable at oblique angles and
 * avoids the high-frequency sparkle produced by per-pixel noise.
 */
export function createFloorVariationData(width: number, height: number, seed: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new RangeError("Floor variation dimensions must be positive integers");
  }

  const data = new Uint8Array(width * height);
  const cellSize = 8;
  const amplitude = FLOOR_VARIATION_MAX - FLOOR_VARIATION_MIN;

  for (let y = 0; y < height; y += 1) {
    const gridY = y / cellSize;
    const y0 = Math.floor(gridY);
    const yBlend = smoothStep(gridY - y0);

    for (let x = 0; x < width; x += 1) {
      const gridX = x / cellSize;
      const x0 = Math.floor(gridX);
      const xBlend = smoothStep(gridX - x0);
      const top = lerp(hashSample(x0, y0, seed), hashSample(x0 + 1, y0, seed), xBlend);
      const bottom = lerp(
        hashSample(x0, y0 + 1, seed),
        hashSample(x0 + 1, y0 + 1, seed),
        xBlend,
      );
      const sample = lerp(top, bottom, yBlend);

      data[y * width + x] = Math.round(FLOOR_VARIATION_MIN + sample * amplitude);
    }
  }

  return data;
}

export function createFloorSurfaceVariationTexture(seed = 417) {
  const size = FLOOR_VARIATION_TEXTURE_SIZE;
  const grayscale = createFloorVariationData(size, size, seed);
  const rgba = new Uint8Array(size * size * 4);
  grayscale.forEach((value, index) => {
    const offset = index * 4;
    rgba[offset] = value;
    rgba[offset + 1] = value;
    rgba[offset + 2] = value;
    rgba[offset + 3] = 255;
  });
  const texture = new DataTexture(
    rgba,
    size,
    size,
    RGBAFormat,
    UnsignedByteType,
  );
  texture.name = `gallery-floor-roughness-${seed}`;
  texture.colorSpace = NoColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = true;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}
