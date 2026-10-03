import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { PaintingFrameStyle } from "../types";
import { getPaintingFrameMaterial } from "../paintingFrameAppearance";

// Small, seamless maps shared by every frame for the lifetime of the module.
// Grain follows local X, so vertical rails rotate as a whole, including their UVs.
const surfaces = new Map<string, THREE.DataTexture>();
function getSurface(wood: boolean) {
  const key = wood ? "wood" : "finish";
  const cached = surfaces.get(key);
  if (cached) return cached;
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size * Math.PI * 2;
      const v = y / size * Math.PI * 2;
      const grain = Math.sin(v * 12 + 0.8 * Math.sin(u) + 0.25 * Math.sin(u * 3));
      const pores = Math.sin(v * 39 + Math.sin(u * 2));
      const noise = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      const value = wood
        ? 211 + grain * 23 + pores * 8 + (noise - Math.floor(noise)) * 8
        : 235 + Math.sin(v * 51) * 9 + (noise - Math.floor(noise)) * 10;
      const offset = (y * size + x) * 4;
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = value;
      pixels[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  surfaces.set(key, texture);
  return texture;
}

export function PaintingRailGeometry({ args }: { args: [number, number, number] }) {
  const [width, height, depth] = args;
  const geometry = useMemo(
    () => new RoundedBoxGeometry(width, height, depth, 2, Math.min(height, depth) * 0.08),
    [width, height, depth],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <primitive object={geometry} attach="geometry" />;
}

export function PaintingRailMaterial({ style, color }: { style: PaintingFrameStyle; color: string }) {
  const wood = style === "natural" || style === "floating";
  const texture = getSurface(wood);
  return (
    <meshPhysicalMaterial
      color={color}
      {...getPaintingFrameMaterial(style)}
      map={wood ? texture : null}
      bumpMap={texture}
      bumpScale={wood ? 0.0007 : 0.00012}
      roughnessMap={texture}
      clearcoatRoughness={wood ? 0.45 : 0.32}
      envMapIntensity={0.85}
    />
  );
}
