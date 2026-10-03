import { useLayoutEffect, useRef } from "react";
import type { RectAreaLight } from "three";
import { RectAreaLightUniformsLib } from "three-stdlib";

import type { RenderPerformanceProfile } from "../performanceProfile";
import type { MuseumAtmosphere } from '../galleryAtmosphere';

RectAreaLightUniformsLib.init();

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
      // Replace the missing HDR environment and area/spot lights with cheap fill.
      // Ambient reaches every wall, including faces opposite the key light.
      ambientIntensity: 1.2,
      hemisphereIntensity: 0.8,
      keyIntensity: 0.65,
      accentIntensity: 0,
      areaLightCount: 0,
      areaLightIntensity: 0,
    };
  }

  if (mode === "balanced") {
    return {
      ambientIntensity: 0.08,
      hemisphereIntensity: 0.22,
      keyIntensity: 0.9,
      accentIntensity: 0,
      areaLightCount: 2,
      areaLightIntensity: 1.2,
    };
  }

  return {
    ambientIntensity: 0.07,
    hemisphereIntensity: 0.2,
    keyIntensity: 0.85,
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
  atmosphere = 'bright',
}: {
  profile: RenderPerformanceProfile;
  environmentBrightness: number;
  atmosphere?: MuseumAtmosphere;
}) {
  const settings = getGalleryLightingSettings(profile.effectiveMode);
  const brightness = Math.max(0.2, environmentBrightness) * (atmosphere === 'bright' ? 1 : 0.8);
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
        color="#f1f3f5"
      />
      <hemisphereLight
        color="#edf3ff"
        groundColor="#79716a"
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
        shadow-radius={2}
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
