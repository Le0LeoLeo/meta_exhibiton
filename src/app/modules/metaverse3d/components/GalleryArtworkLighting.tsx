import { useLayoutEffect, useMemo, useRef } from "react";
import type { Object3D, SpotLight } from "three";

import type { RenderPerformanceProfile } from "../performanceProfile";
import type { ExhibitItem } from "../types";

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
): ArtworkLightTarget[] {
  const limit = ARTWORK_LIGHT_LIMIT[mode];
  if (limit === 0) return [];

  return items
    .filter((item) => item.type === "painting" || item.type === "text")
    .map((item, index) => ({
      item,
      index,
      distance: Math.hypot(
        item.position[0] - GALLERY_SPAWN_XZ[0],
        item.position[2] - GALLERY_SPAWN_XZ[1],
      ),
    }))
    .sort((a, b) => a.distance - b.distance || a.index - b.index)
    .slice(0, limit)
    .map(({ item }) => {
      const rotationY = item.rotation[1] || 0;
      const inwardX = Math.sin(rotationY);
      const inwardZ = Math.cos(rotationY);

      return {
        id: item.id,
        position: [
          item.position[0] + inwardX * 1.65,
          4.65,
          item.position[2] + inwardZ * 1.65,
        ],
        target: [
          item.position[0],
          Math.min(1.85, Math.max(1.35, item.position[1])),
          item.position[2],
        ],
      };
    });
}

function ArtworkSpotLight({
  position,
  target,
  intensity,
}: {
  position: [number, number, number];
  target: [number, number, number];
  intensity: number;
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
        color="#fff1dc"
        intensity={intensity}
        angle={0.38}
        penumbra={0.84}
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
}: {
  items: ExhibitItem[];
  mode: RenderPerformanceProfile["effectiveMode"];
  environmentBrightness?: number;
}) {
  const targets = useMemo(
    () => getArtworkLightTargets(items, mode),
    [items, mode],
  );
  const baseIntensity = mode === "quality" ? 2.4 : mode === "balanced" ? 1.8 : 0;
  const intensity = baseIntensity * Math.max(0.2, environmentBrightness);

  return (
    <>
      {targets.map((light) => (
        <ArtworkSpotLight
          key={light.id}
          position={light.position}
          target={light.target}
          intensity={intensity}
        />
      ))}
    </>
  );
}
