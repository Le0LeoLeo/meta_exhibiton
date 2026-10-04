import { Component, useEffect, useMemo, type ErrorInfo, type ReactNode } from "react";
import { useTexture } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { Vector2, type ColorRepresentation, type Texture } from "three";
import {
  GALLERY_MATERIAL_PRESETS,
  type GalleryMaterialPresetId,
} from "../materials/galleryMaterialPresets";
import {
  configureColorTexture,
  configureDataTexture,
} from "../materials/configureTexture";
import { createFloorSurfaceVariationTexture } from "../materials/floorSurfaceVariation";

export type SurfaceVariation = "none" | "subtle";

interface MaterialAppearance {
  color?: ColorRepresentation;
  roughness?: number;
  metalness?: number;
  envMapIntensity?: number;
}

interface GallerySurfaceMaterialProps extends MaterialAppearance {
  preset: GalleryMaterialPresetId;
  worldWidth: number;
  worldHeight: number;
  textureOffset?: [number, number];
  textureRotation?: number;
  surfaceVariation?: SurfaceVariation;
}

interface LegacySurfaceMaterialProps extends MaterialAppearance {
  textureUrl: string;
  repeat: [number, number];
}

export function calculateSurfaceRepeat(
  worldWidth: number,
  worldHeight: number,
  metersPerTile: [number, number],
): [number, number] {
  return [
    Math.max(1, worldWidth / metersPerTile[0]),
    Math.max(1, worldHeight / metersPerTile[1]),
  ];
}

export function getSurfaceTextureTransform(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return {
    offset: [
      ((hash & 255) / 255) * 0.5,
      (((hash >>> 8) & 255) / 255) * 0.5,
    ] as [number, number],
    rotation: ((hash >>> 16) & 1) === 0 ? 0 : Math.PI,
  };
}

export function shouldUseFloorSurfaceVariation(
  preset: GalleryMaterialPresetId,
  surfaceVariation: SurfaceVariation,
) {
  return preset === "oak-floor" && surfaceVariation === "subtle";
}

function applyTextureTransform(
  texture: Texture,
  offset: [number, number],
  rotation: number,
) {
  texture.offset.set(offset[0], offset[1]);
  texture.center.set(0.5, 0.5);
  texture.rotation = rotation;
  texture.needsUpdate = true;
}

class MaterialErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[GallerySurfaceMaterial] Texture loading failed", error, info);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function disposeTextures(textures: Texture[]) {
  textures.forEach((texture) => texture.dispose());
}

function PbrSurfaceMaterial({
  preset,
  worldWidth,
  worldHeight,
  color = "#ffffff",
  textureOffset = [0, 0],
  textureRotation = 0,
  surfaceVariation = "none",
  roughness,
  metalness,
  envMapIntensity,
}: GallerySurfaceMaterialProps) {
  const definition = GALLERY_MATERIAL_PRESETS[preset];
  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());
  const [repeatX, repeatY] = calculateSurfaceRepeat(worldWidth, worldHeight, definition.metersPerTile);
  const [offsetX, offsetY] = textureOffset;
  const sourceTextures = useTexture([
    `${definition.basePath}/basecolor.jpg`,
    `${definition.basePath}/normal.jpg`,
    `${definition.basePath}/roughness.jpg`,
    `${definition.basePath}/ao.jpg`,
  ]);
  const textures = useMemo(() => {
    const [map, normalMap, roughnessMap, aoMap] = sourceTextures.map((texture) => texture.clone());
    configureColorTexture(map, repeatX, repeatY, maxAnisotropy);
    configureDataTexture(normalMap, repeatX, repeatY, maxAnisotropy);
    configureDataTexture(roughnessMap, repeatX, repeatY, maxAnisotropy);
    configureDataTexture(aoMap, repeatX, repeatY, maxAnisotropy);
    [map, normalMap, roughnessMap, aoMap].forEach((texture) => {
      applyTextureTransform(texture, [offsetX, offsetY], textureRotation);
    });
    return [map, normalMap, roughnessMap, aoMap] as const;
  }, [
    maxAnisotropy,
    repeatX,
    repeatY,
    sourceTextures,
    offsetX,
    offsetY,
    textureRotation,
  ]);
  const normalScale = useMemo(
    () => new Vector2(definition.normalScale, definition.normalScale),
    [definition.normalScale],
  );
  const floorVariationTexture = useMemo(() => {
    if (!shouldUseFloorSurfaceVariation(preset, surfaceVariation)) return undefined;

    const texture = createFloorSurfaceVariationTexture();
    texture.repeat.set(repeatX, repeatY);
    texture.anisotropy = maxAnisotropy;
    applyTextureTransform(texture, [offsetX, offsetY], textureRotation);
    return texture;
  }, [
    maxAnisotropy,
    preset,
    repeatX,
    repeatY,
    surfaceVariation,
    offsetX,
    offsetY,
    textureRotation,
  ]);

  useEffect(() => () => disposeTextures([...textures]), [textures]);
  useEffect(() => () => floorVariationTexture?.dispose(), [floorVariationTexture]);

  return (
    <meshStandardMaterial
      map={definition.useColorMap ? textures[0] : undefined}
      normalMap={textures[1]}
      roughnessMap={
        floorVariationTexture ?? (definition.useRoughnessMap ? textures[2] : undefined)
      }
      aoMap={definition.useAoMap ? textures[3] : undefined}
      color={color}
      roughness={roughness ?? definition.roughness}
      metalness={metalness ?? definition.metalness}
      normalScale={normalScale}
      aoMapIntensity={definition.aoIntensity}
      envMapIntensity={envMapIntensity ?? definition.envMapIntensity}
    />
  );
}

export function GallerySurfaceMaterial(props: GallerySurfaceMaterialProps) {
  const definition = GALLERY_MATERIAL_PRESETS[props.preset];

  return (
    <MaterialErrorBoundary
      key={props.preset}
      fallback={
        <meshStandardMaterial
          color={props.color ?? "#ffffff"}
          roughness={props.roughness ?? definition.roughness}
          metalness={props.metalness ?? definition.metalness}
          envMapIntensity={props.envMapIntensity ?? definition.envMapIntensity}
        />
      }
    >
      <PbrSurfaceMaterial {...props} />
    </MaterialErrorBoundary>
  );
}

function TexturedLegacyMaterial({
  textureUrl,
  repeat,
  color = "#ffffff",
  roughness = 0.8,
  metalness = 0,
  envMapIntensity = 0.35,
}: LegacySurfaceMaterialProps) {
  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());
  const sourceTexture = useTexture(textureUrl);
  const [repeatX, repeatY] = repeat;
  const texture = useMemo(() => {
    const clone = sourceTexture.clone();
    return configureColorTexture(clone, repeatX, repeatY, maxAnisotropy);
  }, [maxAnisotropy, repeatX, repeatY, sourceTexture]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <meshStandardMaterial
      map={texture}
      color={color}
      roughness={roughness}
      metalness={metalness}
      envMapIntensity={envMapIntensity}
    />
  );
}

export function LegacySurfaceMaterial(props: LegacySurfaceMaterialProps) {
  return (
    <MaterialErrorBoundary
      key={props.textureUrl}
      fallback={
        <meshStandardMaterial
          color={props.color ?? "#ffffff"}
          roughness={props.roughness ?? 0.8}
          metalness={props.metalness ?? 0}
          envMapIntensity={props.envMapIntensity ?? 0.35}
        />
      }
    >
      <TexturedLegacyMaterial {...props} />
    </MaterialErrorBoundary>
  );
}
