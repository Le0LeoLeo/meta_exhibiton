import { beforeEach, describe, expect, it } from "vitest";

import { createRenderPerformanceProfile } from "./performanceProfile";
import { useMetaverseStudioStore } from "./store/useMetaverseStudioStore";

const sharedSettings = {
  pauseWhenObscured: true,
  idleFrameloop: "demand",
} as const;

describe("render performance profiles", () => {
  it("creates the exact quality profile", () => {
    expect(createRenderPerformanceProfile("quality", "performance")).toEqual({
      requestedMode: "quality",
      effectiveMode: "quality",
      dpr: [1, 1.5],
      shadowMapSize: 2048,
      enableEnvironment: true,
      enableExtraAccentLights: true,
      enablePostprocessing: true,
      enableAmbientOcclusion: true,
      ambientOcclusionQuality: "high",
      enableShadows: true,
      enableRemotePlayers: true,
      physicsUpdateLoop: "independent",
      physicsTimeStep: "vary",
      multiplayerMoveIntervalMs: 80,
      remoteInterpolationFps: 60,
      ...sharedSettings,
    });
  });

  it("creates the exact balanced profile", () => {
    expect(createRenderPerformanceProfile("balanced", "quality")).toEqual({
      requestedMode: "balanced",
      effectiveMode: "balanced",
      dpr: [0.9, 1.2],
      shadowMapSize: 1024,
      enableEnvironment: true,
      enableExtraAccentLights: false,
      enablePostprocessing: true,
      enableAmbientOcclusion: true,
      ambientOcclusionQuality: "low",
      enableShadows: true,
      enableRemotePlayers: true,
      physicsUpdateLoop: "independent",
      physicsTimeStep: 1 / 45,
      multiplayerMoveIntervalMs: 120,
      remoteInterpolationFps: 45,
      ...sharedSettings,
    });
  });

  it("creates the exact performance profile", () => {
    expect(createRenderPerformanceProfile("performance", "quality")).toEqual({
      requestedMode: "performance",
      effectiveMode: "performance",
      dpr: [0.75, 1],
      shadowMapSize: 256,
      enableEnvironment: false,
      enableExtraAccentLights: false,
      enablePostprocessing: false,
      enableAmbientOcclusion: false,
      ambientOcclusionQuality: "off",
      enableShadows: false,
      enableRemotePlayers: true,
      physicsUpdateLoop: "follow",
      physicsTimeStep: 1 / 30,
      multiplayerMoveIntervalMs: 160,
      remoteInterpolationFps: 30,
      ...sharedSettings,
    });
  });

  it("uses the adaptive mode only when auto is requested", () => {
    expect(createRenderPerformanceProfile("auto", "performance").effectiveMode).toBe(
      "performance",
    );
    expect(createRenderPerformanceProfile("quality", "performance").effectiveMode).toBe(
      "quality",
    );
  });
});

describe("performance mode store state", () => {
  beforeEach(() => {
    useMetaverseStudioStore.setState({
      performanceMode: "auto",
      effectivePerformanceMode: "balanced",
    });
  });

  it("keeps a shared runtime effective mode with a setter", () => {
    expect(
      useMetaverseStudioStore.getInitialState().effectivePerformanceMode,
    ).toBe("balanced");

    useMetaverseStudioStore.getState().setEffectivePerformanceMode("quality");

    expect(useMetaverseStudioStore.getState().effectivePerformanceMode).toBe("quality");
  });

  it("uses persistence version 7 and migrates stored low mode", () => {
    const options = useMetaverseStudioStore.persist.getOptions();

    expect(options.version).toBe(7);
    expect(options.migrate?.({ performanceMode: "low" }, 6)).toMatchObject({
      performanceMode: "performance",
    });
  });

  it("persists requested mode but excludes runtime effective mode", () => {
    const partialize = useMetaverseStudioStore.persist.getOptions().partialize;
    const state = {
      ...useMetaverseStudioStore.getState(),
      performanceMode: "quality" as const,
      effectivePerformanceMode: "performance" as const,
    };

    expect(partialize?.(state)).toMatchObject({ performanceMode: "quality" });
    expect(partialize?.(state)).not.toHaveProperty("effectivePerformanceMode");
  });
});
