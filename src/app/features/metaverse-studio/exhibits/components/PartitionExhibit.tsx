import { Edges } from "@react-three/drei";

import { useStore } from "../../store";
import type { ExhibitRendererProps } from "../exhibitRegistry";
import {
  GallerySurfaceMaterial,
  LegacySurfaceMaterial,
} from "@/app/modules/metaverse3d/components/GallerySurfaceMaterial";
import { resolveGalleryMaterialPreset } from "@/app/modules/metaverse3d/materials/galleryMaterialPresets";

export function PartitionExhibit({ item, isSelected, quality, sceneOverride }: ExhibitRendererProps) {
  const storedRoom = useStore((state) => state.roomSize);
  const storedOverride = useStore((state) => state.wallMaterialOverrides[item.id]);
  const roomSize = sceneOverride?.roomSize ?? storedRoom;
  const override = sceneOverride ? sceneOverride.wallMaterialOverrides?.[item.id] : storedOverride;
  const material = { ...roomSize, ...override };
  const textureUrl = material.wallTextureUrl || "/textures/wall-paint.svg";
  const preset = resolveGalleryMaterialPreset(textureUrl, "wall");
  const color = override?.wallColor || item.content || material.wallColor || "#f3f4f6";
  const worldWidth = Math.max(0.1, Math.abs(item.scale[0] || 1));
  const worldHeight = Math.max(0.1, Math.abs(item.scale[1] || 1));

  return (
    <mesh castShadow={quality.castShadows} receiveShadow={quality.castShadows}>
      <boxGeometry args={[1, 1, 1]} />
      {material.wallMaterialPreset === "glass" ? (
        <meshPhysicalMaterial color={color} roughness={material.wallRoughness}
          metalness={0} envMapIntensity={material.wallEnvIntensity}
          transparent opacity={material.wallOpacity} transmission={material.wallTransmission}
          ior={material.wallIor} />
      ) : preset ? (
        <GallerySurfaceMaterial
          preset={preset}
          worldWidth={worldWidth}
          worldHeight={worldHeight}
          color={color}
          roughness={override?.wallRoughness}
          metalness={override?.wallMetalness}
          envMapIntensity={override?.wallEnvIntensity}
        />
      ) : (
        <LegacySurfaceMaterial
          textureUrl={textureUrl}
          repeat={[
            material.wallTextureTiling ?? 3,
            material.wallTextureTiling ?? 3,
          ]}
          color={color}
          roughness={material.wallRoughness ?? 0.62}
          metalness={material.wallMetalness ?? 0}
          envMapIntensity={material.wallEnvIntensity ?? 0.35}
        />
      )}
      {isSelected && <Edges scale={1.001} color="#4f46e5" />}
    </mesh>
  );
}
