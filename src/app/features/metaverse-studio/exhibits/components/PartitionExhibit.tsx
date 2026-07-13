import { useEffect } from "react";
import { Edges, useTexture } from "@react-three/drei";
import * as THREE from "three";

import { useStore } from "../../store";
import type { ExhibitRendererProps } from "../exhibitRegistry";

export function PartitionExhibit({ item, isSelected }: ExhibitRendererProps) {
  const roomSize = useStore((state) => state.roomSize);
  const partitionTexture = useTexture(roomSize.wallTextureUrl || "/textures/wall-paint.svg");

  useEffect(() => {
    partitionTexture.wrapS = THREE.RepeatWrapping;
    partitionTexture.wrapT = THREE.RepeatWrapping;
    const tiling = roomSize.wallTextureTiling ?? 3;
    partitionTexture.repeat.set(tiling, tiling);
    partitionTexture.needsUpdate = true;
  }, [partitionTexture, roomSize.wallTextureTiling]);

  return (
    <mesh castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        map={partitionTexture}
        bumpMap={partitionTexture}
        color={item.content || roomSize.wallColor || "#f3f4f6"}
        roughness={roomSize.wallRoughness ?? 0.62}
        metalness={roomSize.wallMetalness ?? 0.02}
        bumpScale={roomSize.wallBumpScale ?? 0.05}
        envMapIntensity={roomSize.wallEnvIntensity ?? 0.35}
      />
      {isSelected && <Edges scale={1.001} color="#4f46e5" />}
    </mesh>
  );
}
