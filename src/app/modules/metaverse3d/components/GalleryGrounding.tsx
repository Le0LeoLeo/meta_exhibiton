import { ContactShadows } from "@react-three/drei";

import type { RenderPerformanceProfile } from "../performanceProfile";

type GroundingMode = RenderPerformanceProfile["effectiveMode"];

interface ContactShadowSettings {
  enabled: boolean;
  resolution: 0 | 256 | 512;
  opacity: number;
  blur: number;
  far: number;
}

interface BounceLightSettings {
  id: "floor-warmth" | "upper-return";
  kind: "ambient" | "hemisphere";
  color: string;
  intensity: number;
  castShadow: false;
}

export interface GalleryGroundingSettings {
  contactShadow: ContactShadowSettings;
  bounceLights: BounceLightSettings[];
}

const floorBounce: BounceLightSettings = {
  id: "floor-warmth",
  kind: "ambient",
  color: "#ffd7ae",
  intensity: 0.025,
  castShadow: false,
};

const upperReturn: BounceLightSettings = {
  id: "upper-return",
  kind: "hemisphere",
  color: "#d6e5f5",
  intensity: 0.035,
  castShadow: false,
};

export function getGalleryGroundingSettings(
  mode: GroundingMode,
): GalleryGroundingSettings {
  if (mode === "performance") {
    return {
      contactShadow: {
        enabled: false,
        resolution: 0,
        opacity: 0,
        blur: 0,
        far: 0,
      },
      bounceLights: [],
    };
  }

  if (mode === "balanced") {
    return {
      contactShadow: {
        enabled: true,
        resolution: 256,
        opacity: 0.16,
        blur: 3,
        far: 4,
      },
      bounceLights: [{ ...floorBounce, intensity: 0.018 }],
    };
  }

  return {
    contactShadow: {
      enabled: true,
      resolution: 512,
      opacity: 0.23,
      blur: 2.6,
      far: 4.5,
    },
    bounceLights: [floorBounce, upperReturn],
  };
}

export function GalleryGrounding({ mode }: { mode: GroundingMode }) {
  const settings = getGalleryGroundingSettings(mode);

  return (
    <>
      {settings.contactShadow.enabled && (
        <ContactShadows
          position={[0, 0.012, 0]}
          width={11}
          height={46}
          opacity={settings.contactShadow.opacity}
          blur={settings.contactShadow.blur}
          far={settings.contactShadow.far}
          resolution={settings.contactShadow.resolution}
          frames={1}
          color="#171717"
          depthWrite={false}
        />
      )}
      {settings.bounceLights.map((light) =>
        light.kind === "hemisphere" ? (
          <hemisphereLight
            key={light.id}
            skyColor={light.color}
            groundColor="#b99472"
            intensity={light.intensity}
          />
        ) : (
          <ambientLight
            key={light.id}
            color={light.color}
            intensity={light.intensity}
          />
        ),
      )}
    </>
  );
}
