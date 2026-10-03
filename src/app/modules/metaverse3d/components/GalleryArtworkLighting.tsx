import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Object3D, SpotLight } from "three";

import type { RenderPerformanceProfile } from "../performanceProfile";
import type { ExhibitItem } from "../types";
import type { MuseumAtmosphere } from '../galleryAtmosphere';

const GALLERY_SPAWN_XZ = [0, 5] as const;
const ARTWORK_LIGHT_LIMIT = {
  quality: 4,
  balanced: 2,
  performance: 0,
} as const;

export interface ArtworkLightTarget {
  id: string;
  position: [number, number, number];
  target: [number, number, number];
}

export function getArtworkLightTargets(
  items: ExhibitItem[],
  mode: RenderPerformanceProfile["effectiveMode"],
  viewerXZ: readonly [number, number] = GALLERY_SPAWN_XZ,
  atmosphere: MuseumAtmosphere = 'bright',
): ArtworkLightTarget[] {
  const museum = atmosphere !== 'bright';
  const limit = museum ? (mode === 'performance' ? 2 : 8) : ARTWORK_LIGHT_LIMIT[mode];
  if (limit === 0) return [];

  return items
    .filter((item) => item.type === 'painting' || (museum ? item.type === 'pedestal' : item.type === 'text'))
    .map((item, index) => ({
      item,
      index,
      distance: Math.hypot(
        item.position[0] - viewerXZ[0],
        item.position[2] - viewerXZ[1],
      ),
    }))
    .sort((a, b) => a.distance - b.distance || a.index - b.index)
    .slice(0, limit)
    .map(({ item }) => {
      const rotationY = item.rotation[1] || 0;
      const inwardX = Math.sin(rotationY);
      const inwardZ = Math.cos(rotationY);
      const targetHeight = item.position[1] + (item.type === 'pedestal' ? 1 : 0);

      return {
        id: item.id,
        position: [
          item.position[0] + inwardX * 1.65,
          targetHeight + 2.1,
          item.position[2] + inwardZ * 1.65,
        ],
        target: [
          item.position[0],
          targetHeight,
          item.position[2],
        ],
      };
    });
}

function ArtworkSpotLight({
  position,
  target,
  intensity,
  atmosphere,
}: {
  position: [number, number, number];
  target: [number, number, number];
  intensity: number;
  atmosphere: MuseumAtmosphere;
}) {
  const lightRef = useRef<SpotLight>(null);
  const targetRef = useRef<Object3D>(null);

  useLayoutEffect(() => {
    if (!lightRef.current || !targetRef.current) return;
    lightRef.current.target = targetRef.current;
    targetRef.current.updateMatrixWorld();
  }, [target]);

  return (
    <>
      <spotLight
        ref={lightRef}
        position={position}
        color={atmosphere === 'warm' ? '#ffd6a0' : '#fff6eb'}
        intensity={intensity}
        angle={atmosphere === 'bright' ? 0.65 : 0.72}
        penumbra={atmosphere === 'bright' ? 0.84 : 0.65}
        distance={8}
        decay={2}
        castShadow={false}
      />
      <object3D ref={targetRef} position={target} />
    </>
  );
}

export function GalleryArtworkLighting({
  items,
  mode,
  environmentBrightness = 1,
  atmosphere = 'bright',
}: {
  items: ExhibitItem[];
  mode: RenderPerformanceProfile["effectiveMode"];
  environmentBrightness?: number;
  atmosphere?: MuseumAtmosphere;
}) {
  const camera = useThree((state) => state.camera);
  const [viewerXZ, setViewerXZ] = useState<readonly [number, number]>(
    () => [camera.position.x, camera.position.z],
  );
  // Re-rank only after meaningful movement, never sort the collection every frame.
  useFrame(() => {
    if (mode === "performance" && atmosphere === 'bright') return;
    if (Math.hypot(camera.position.x - viewerXZ[0], camera.position.z - viewerXZ[1]) < 2) return;
    setViewerXZ([camera.position.x, camera.position.z]);
  });
  const targets = useMemo(
    () => getArtworkLightTargets(items, mode, viewerXZ, atmosphere),
    [items, mode, viewerXZ, atmosphere],
  );
  const baseIntensity = mode === "quality" ? 7 : mode === "balanced" ? 6 : 0;
  const intensity = atmosphere === 'bright' ? baseIntensity * Math.max(0.2, environmentBrightness) : 32;

  return (
    <>
      {targets.map((light) => (
        <ArtworkSpotLight
          key={light.id}
          position={light.position}
          target={light.target}
          intensity={intensity}
          atmosphere={atmosphere}
        />
      ))}
    </>
  );
}
