import { Edges } from "@react-three/drei";

import { useStore } from "../../store";
import type { ExhibitRendererProps } from "../exhibitRegistry";
import {
  GallerySurfaceMaterial,
  LegacySurfaceMaterial,
} from "@/app/modules/metaverse3d/components/GallerySurfaceMaterial";
import { resolveGalleryMaterialPreset } from "@/app/modules/metaverse3d/materials/galleryMaterialPresets";

export function PartitionExhibit({ item, isSelected }: ExhibitRendererProps) {
  const roomSize = useStore((state) => state.roomSize);
  const textureUrl = roomSize.wallTextureUrl || "/textures/wall-paint.svg";
  const preset = resolveGalleryMaterialPreset(textureUrl, "wall");
  const worldWidth = Math.max(0.1, Math.abs(item.scale[0] || 1));
  const worldHeight = Math.max(0.1, Math.abs(item.scale[1] || 1));

  return (
    <mesh castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      {preset ? (
        <GallerySurfaceMaterial
          preset={preset}
          worldWidth={worldWidth}
          worldHeight={worldHeight}
          color={item.content || roomSize.wallColor || "#f3f4f6"}
        />
      ) : (
        <LegacySurfaceMaterial
          textureUrl={textureUrl}
          repeat={[
            roomSize.wallTextureTiling ?? 3,
            roomSize.wallTextureTiling ?? 3,
          ]}
          color={item.content || roomSize.wallColor || "#f3f4f6"}
          roughness={roomSize.wallRoughness ?? 0.62}
          metalness={Math.min(0.06, roomSize.wallMetalness ?? 0)}
          envMapIntensity={roomSize.wallEnvIntensity ?? 0.35}
        />
      )}
      {isSelected && <Edges scale={1.001} color="#4f46e5" />}
    </mesh>
  );
}
