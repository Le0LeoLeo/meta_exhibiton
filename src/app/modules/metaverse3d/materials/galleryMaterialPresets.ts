export type GalleryMaterialPresetId =
  | "oak-floor"
  | "concrete-floor"
  | "plaster-wall";

export interface GalleryMaterialPreset {
  basePath: string;
  metersPerTile: [number, number];
  roughness: number;
  useColorMap: boolean;
  useRoughnessMap: boolean;
  useAoMap: boolean;
  metalness: number;
  normalScale: number;
  aoIntensity: number;
  envMapIntensity: number;
}

export const GALLERY_MATERIAL_PRESETS: Record<
  GalleryMaterialPresetId,
  GalleryMaterialPreset
> = {
  "oak-floor": {
    basePath: "/textures/pbr/oak-floor",
    metersPerTile: [2.4, 2.4],
    roughness: 0.86,
    useColorMap: true,
    useRoughnessMap: false,
    useAoMap: true,
    metalness: 0,
    normalScale: 0.45,
    aoIntensity: 0.7,
    envMapIntensity: 0.2,
  },
  "concrete-floor": {
    basePath: "/textures/pbr/concrete-floor",
    metersPerTile: [2, 2],
    roughness: 0.9,
    useColorMap: true,
    useRoughnessMap: true,
    useAoMap: true,
    metalness: 0,
    normalScale: 0.35,
    aoIntensity: 0.55,
    envMapIntensity: 0.45,
  },
  "plaster-wall": {
    basePath: "/textures/pbr/plaster-wall",
    metersPerTile: [2.5, 2.5],
    roughness: 0.95,
    useColorMap: false,
    useRoughnessMap: true,
    useAoMap: false,
    metalness: 0,
    normalScale: 0.1,
    aoIntensity: 0.35,
    envMapIntensity: 0.16,
  },
};

export function resolveGalleryMaterialPreset(
  textureUrl: string,
  surface: "floor" | "wall",
): GalleryMaterialPresetId | null {
  if (textureUrl.includes("/textures/pbr/oak-floor")) return "oak-floor";
  if (textureUrl.includes("/textures/pbr/concrete-floor")) return "concrete-floor";
  if (textureUrl.includes("/textures/pbr/plaster-wall")) return "plaster-wall";
  if (textureUrl.endsWith("/wall-wood.svg")) return "oak-floor";
  if (textureUrl.endsWith("/wall-concrete.svg")) {
    return surface === "floor" ? "concrete-floor" : "plaster-wall";
  }
  if (textureUrl.endsWith("/wall-paint.svg")) return "plaster-wall";
  return null;
}
