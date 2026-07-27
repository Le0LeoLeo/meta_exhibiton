import {
  Bloom,
  BrightnessContrast,
  EffectComposer,
  HueSaturation,
  SMAA,
  SSAO,
  Vignette,
} from "@react-three/postprocessing";

import type { RenderPerformanceProfile } from "../performanceProfile";

export interface AmbientOcclusionSettings {
  enabled: boolean;
  intensity: number;
  radius: number;
  samples: number;
  resolutionScale: number;
}

export interface GalleryPostprocessingSettings {
  enabled: boolean;
  bloomIntensity: number;
  bloomThreshold: number;
  bloomSmoothing: number;
  vignetteOffset: number;
  vignetteDarkness: number;
  brightness: number;
  contrast: number;
  hue: number;
  saturation: number;
}

export function getGalleryPostprocessingSettings(
  profile: RenderPerformanceProfile,
): GalleryPostprocessingSettings {
  if (!profile.enablePostprocessing || profile.effectiveMode === "performance") {
    return {
      enabled: false,
      bloomIntensity: 0,
      bloomThreshold: 1.1,
      bloomSmoothing: 0.1,
      vignetteOffset: 0.3,
      vignetteDarkness: 0,
      brightness: 0,
      contrast: 0,
      hue: 0,
      saturation: 0,
    };
  }

  if (profile.effectiveMode === "balanced") {
    return {
      enabled: true,
      bloomIntensity: 0.025,
      bloomThreshold: 1.1,
      bloomSmoothing: 0.12,
      vignetteOffset: 0.28,
      vignetteDarkness: 0.1,
      brightness: 0.005,
      contrast: 0.018,
      hue: -0.004,
      saturation: -0.015,
    };
  }

  return {
    enabled: true,
    bloomIntensity: 0.04,
    bloomThreshold: 1.08,
    bloomSmoothing: 0.14,
    vignetteOffset: 0.26,
    vignetteDarkness: 0.13,
    brightness: 0.008,
    contrast: 0.035,
    hue: -0.006,
    saturation: -0.025,
  };
}

export function getAmbientOcclusionSettings(
  quality: RenderPerformanceProfile["ambientOcclusionQuality"],
): AmbientOcclusionSettings {
  if (quality === "high") {
    return {
      enabled: true,
      intensity: 0.65,
      radius: 1.2,
      samples: 16,
      resolutionScale: 0.75,
    };
  }

  if (quality === "low") {
    return {
      enabled: true,
      intensity: 0.4,
      radius: 0.7,
      samples: 8,
      resolutionScale: 0.5,
    };
  }

  return {
    enabled: false,
    intensity: 0,
    radius: 0,
    samples: 0,
    resolutionScale: 0.5,
  };
}

export function GalleryPostprocessing({
  profile,
}: {
  profile: RenderPerformanceProfile;
}) {
  const ao = getAmbientOcclusionSettings(profile.ambientOcclusionQuality);
  const finish = getGalleryPostprocessingSettings(profile);

  if (!finish.enabled && !ao.enabled) return null;

  return (
    <EffectComposer multisampling={0} enableNormalPass={ao.enabled}>
      {ao.enabled && (
        <SSAO
          samples={ao.samples}
          rings={4}
          radius={ao.radius}
          intensity={ao.intensity}
          luminanceInfluence={0.65}
          worldDistanceThreshold={1}
          worldDistanceFalloff={1}
          worldProximityThreshold={1}
          worldProximityFalloff={1}
          resolutionScale={ao.resolutionScale}
        />
      )}
      <Bloom
        intensity={finish.bloomIntensity}
        luminanceThreshold={finish.bloomThreshold}
        luminanceSmoothing={finish.bloomSmoothing}
        mipmapBlur
      />
      <BrightnessContrast
        brightness={finish.brightness}
        contrast={finish.contrast}
      />
      <HueSaturation hue={finish.hue} saturation={finish.saturation} />
      <Vignette
        eskil={false}
        offset={finish.vignetteOffset}
        darkness={finish.vignetteDarkness}
      />
      <SMAA />
    </EffectComposer>
  );
}
