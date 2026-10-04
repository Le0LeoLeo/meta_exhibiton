import { useCallback, useMemo, useState } from "react";

import type { PerformanceMode } from "../types";
import {
  createInitialAdaptiveState,
  evaluateAdaptiveSample,
  resolveRequestedMode,
  type AdaptiveDeviceSignals,
  type EffectivePerformanceMode,
  type FramePerformanceSample,
} from "./adaptivePerformance";

interface UseAdaptivePerformanceOptions {
  requestedMode: PerformanceMode;
  signals: AdaptiveDeviceSignals;
}

export interface AdaptivePerformanceResult {
  adaptiveMode: EffectivePerformanceMode;
  effectiveMode: EffectivePerformanceMode;
  reportSample: (sample: FramePerformanceSample) => void;
  transitionReason: "initial" | "sustained-low-fps" | "sustained-headroom";
}

export function getBrowserPerformanceSignals(): AdaptiveDeviceSignals {
  if (typeof window === "undefined") return {};

  const nav = window.navigator as Navigator & {
    deviceMemory?: number;
  };

  return {
    deviceMemoryGb: nav.deviceMemory,
    hardwareConcurrency: nav.hardwareConcurrency,
    isMobile: window.matchMedia?.("(pointer: coarse)").matches ?? false,
    prefersReducedMotion:
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
    pixelRatio: window.devicePixelRatio,
  };
}

export function useAdaptivePerformance({
  requestedMode,
  signals,
}: UseAdaptivePerformanceOptions): AdaptivePerformanceResult {
  const [adaptiveState, setAdaptiveState] = useState(() =>
    createInitialAdaptiveState(signals),
  );

  const reportSample = useCallback(
    (sample: FramePerformanceSample) => {
      if (requestedMode !== "auto") return;
      setAdaptiveState((state) => evaluateAdaptiveSample(state, sample));
    },
    [requestedMode],
  );

  const effectiveMode = resolveRequestedMode(
    requestedMode,
    adaptiveState.effectiveMode,
  );

  return useMemo(
    () => ({
      adaptiveMode: adaptiveState.effectiveMode,
      effectiveMode,
      reportSample,
      transitionReason: adaptiveState.lastReason,
    }),
    [
      adaptiveState.effectiveMode,
      adaptiveState.lastReason,
      effectiveMode,
      reportSample,
    ],
  );
}
