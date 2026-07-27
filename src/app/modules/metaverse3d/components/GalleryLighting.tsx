import { useLayoutEffect, useRef } from "react";
import type { RectAreaLight } from "three";

import type { RenderPerformanceProfile } from "../performanceProfile";

export interface GalleryLightingSettings {
  ambientIntensity: number;
  hemisphereIntensity: number;
  keyIntensity: number;
  accentIntensity: number;
  areaLightCount: 0 | 2 | 3;
  areaLightIntensity: number;
}

export function getGalleryLightingSettings(
  mode: RenderPerformanceProfile["effectiveMode"],
): GalleryLightingSettings {
  if (mode === "performance") {
    return {
      ambientIntensity: 0.16,
      hemisphereIntensity: 0.18,
      keyIntensity: 0.65,
      accentIntensity: 0,
      areaLightCount: 0,
      areaLightIntensity: 0,
    };
  }

  if (mode === "balanced") {
    return {
      ambientIntensity: 0.04,
      hemisphereIntensity: 0.08,
      keyIntensity: 0.7,
      accentIntensity: 0,
      areaLightCount: 2,
      areaLightIntensity: 1.2,
    };
  }

  return {
    ambientIntensity: 0.028,
    hemisphereIntensity: 0.06,
    keyIntensity: 0.32,
    accentIntensity: 0,
    areaLightCount: 3,
    areaLightIntensity: 1.65,
  };
}

function GalleryAreaLight({
  position,
  target,
  intensity,
}: {
  position: [number, number, number];
  target: [number, number, number];
  intensity: number;
}) {
  const lightRef = useRef<RectAreaLight>(null);

  useLayoutEffect(() => {
    lightRef.current?.lookAt(...target);
  }, [target]);

  return (
    <rectAreaLight
      ref={lightRef}
      position={position}
      width={2.6}
      height={0.7}
      intensity={intensity}
      color="#fff2df"
    />
  );
}

export function GalleryLighting({
  profile,
  environmentBrightness,
}: {
  profile: RenderPerformanceProfile;
  environmentBrightness: number;
}) {
  const settings = getGalleryLightingSettings(profile.effectiveMode);
  const brightness = Math.max(0.2, environmentBrightness);
  const areaLightPositions: Array<{
    position: [number, number, number];
    target: [number, number, number];
  }> = [
    { position: [-1.6, 4.6, -8], target: [-3.8, 1.6, -9.5] },
    { position: [1.6, 4.6, 0], target: [3.8, 1.6, -1.5] },
    { position: [-1.6, 4.6, 8], target: [-3.8, 1.6, 6.5] },
  ];

  return (
    <>
      <ambientLight
        intensity={settings.ambientIntensity * brightness}
        color="#c7d2e8"
      />
      <hemisphereLight
        skyColor="#dbeafe"
        groundColor="#263244"
        intensity={settings.hemisphereIntensity * brightness}
      />
      <directionalLight
        castShadow={profile.enableShadows}
        position={[7, 11, 5]}
        intensity={settings.keyIntensity * brightness}
        color="#fffaf0"
        shadow-mapSize={[profile.shadowMapSize, profile.shadowMapSize]}
        shadow-camera-near={0.5}
        shadow-camera-far={45}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
        shadow-bias={-0.0001}
        shadow-normalBias={0.025}
      />
      {areaLightPositions.slice(0, settings.areaLightCount).map((light, index) => (
        <GalleryAreaLight
          key={index}
          position={light.position}
          target={light.target}
          intensity={settings.areaLightIntensity * brightness}
        />
      ))}
    </>
  );
}
