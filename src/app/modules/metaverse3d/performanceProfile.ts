import { useMemo } from "react";

import {
  resolveRequestedMode,
  type EffectivePerformanceMode,
} from "./performance/adaptivePerformance";
import { useStore } from "./store/useStore";
import type { PerformanceMode } from "./types";

export interface RenderPerformanceProfile {
  requestedMode: PerformanceMode;
  effectiveMode: EffectivePerformanceMode;
  dpr: [number, number];
  shadowMapSize: number;
  enableEnvironment: boolean;
  enableExtraAccentLights: boolean;
  enablePostprocessing: boolean;
  enableShadows: boolean;
  enableRemotePlayers: boolean;
  physicsUpdateLoop: "independent" | "follow";
  physicsTimeStep: "vary" | number;
  multiplayerMoveIntervalMs: number;
  remoteInterpolationFps: number;
  pauseWhenObscured: boolean;
  idleFrameloop: "demand";
}

const qualityProfile: Omit<RenderPerformanceProfile, "requestedMode" | "effectiveMode"> = {
  dpr: [1, 1.35],
  shadowMapSize: 512,
  enableEnvironment: true,
  enableExtraAccentLights: true,
  enablePostprocessing: true,
  enableShadows: true,
  enableRemotePlayers: true,
  physicsUpdateLoop: "independent",
  physicsTimeStep: "vary",
  multiplayerMoveIntervalMs: 80,
  remoteInterpolationFps: 60,
  pauseWhenObscured: true,
  idleFrameloop: "demand",
};

const balancedProfile: Omit<RenderPerformanceProfile, "requestedMode" | "effectiveMode"> = {
  dpr: [0.9, 1.1],
  shadowMapSize: 384,
  enableEnvironment: true,
  enableExtraAccentLights: false,
  enablePostprocessing: false,
  enableShadows: true,
  enableRemotePlayers: true,
  physicsUpdateLoop: "independent",
  physicsTimeStep: 1 / 45,
  multiplayerMoveIntervalMs: 120,
  remoteInterpolationFps: 45,
  pauseWhenObscured: true,
  idleFrameloop: "demand",
};

const performanceProfile: Omit<RenderPerformanceProfile, "requestedMode" | "effectiveMode"> = {
  dpr: [0.75, 1],
  shadowMapSize: 256,
  enableEnvironment: false,
  enableExtraAccentLights: false,
  enablePostprocessing: false,
  enableShadows: false,
  enableRemotePlayers: false,
  physicsUpdateLoop: "follow",
  physicsTimeStep: 1 / 30,
  multiplayerMoveIntervalMs: 160,
  remoteInterpolationFps: 30,
  pauseWhenObscured: true,
  idleFrameloop: "demand",
};

export function createRenderPerformanceProfile(
  requestedMode: PerformanceMode,
  adaptiveMode: EffectivePerformanceMode,
): RenderPerformanceProfile {
  const effectiveMode = resolveRequestedMode(requestedMode, adaptiveMode);
  const profile =
    effectiveMode === "quality"
      ? qualityProfile
      : effectiveMode === "balanced"
        ? balancedProfile
        : performanceProfile;

  return {
    requestedMode,
    effectiveMode,
    ...profile,
  };
}

export function useRenderPerformanceProfile(): RenderPerformanceProfile {
  const requestedMode = useStore((state) => state.performanceMode);
  const effectivePerformanceMode = useStore(
    (state) => state.effectivePerformanceMode,
  );
  return useMemo(
    () =>
      createRenderPerformanceProfile(requestedMode, effectivePerformanceMode),
    [effectivePerformanceMode, requestedMode],
  );
}
