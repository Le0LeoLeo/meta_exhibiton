import type { PerformanceMode } from "../types";

export type EffectivePerformanceMode = Exclude<PerformanceMode, "auto">;

export interface AdaptiveDeviceSignals {
  deviceMemoryGb?: number;
  hardwareConcurrency?: number;
  isMobile?: boolean;
  prefersReducedMotion?: boolean;
  pixelRatio?: number;
}

export interface FramePerformanceSample {
  averageFps: number;
  lowPercentileFps: number;
  longFrameRatio: number;
  sampledAt: number;
  eligible: boolean;
}

export interface AdaptivePerformanceState {
  effectiveMode: EffectivePerformanceMode;
  lowSampleCount: number;
  stableSampleCount: number;
  lastTransitionAt: number;
  lastReason: "initial" | "sustained-low-fps" | "sustained-headroom";
}

const modeOrder: EffectivePerformanceMode[] = [
  "performance",
  "balanced",
  "quality",
];

export function normalizeStoredPerformanceMode(
  value: unknown,
): PerformanceMode {
  if (value === "low") return "performance";
  if (
    value === "auto" ||
    value === "quality" ||
    value === "balanced" ||
    value === "performance"
  ) {
    return value;
  }
  return "auto";
}

export function resolveInitialMode(
  signals: AdaptiveDeviceSignals,
): EffectivePerformanceMode {
  const memory = signals.deviceMemoryGb;
  const cores = signals.hardwareConcurrency;
  const highPixelDensity = (signals.pixelRatio ?? 1) >= 2.5;

  if (
    signals.isMobile ||
    signals.prefersReducedMotion ||
    (memory !== undefined && memory <= 4) ||
    (cores !== undefined && cores <= 4)
  ) {
    return "performance";
  }

  if (
    memory === undefined ||
    cores === undefined ||
    highPixelDensity ||
    memory <= 6 ||
    cores <= 6
  ) {
    return "balanced";
  }

  return "quality";
}

export function createInitialAdaptiveState(
  signals: AdaptiveDeviceSignals,
): AdaptivePerformanceState {
  return {
    effectiveMode: resolveInitialMode(signals),
    lowSampleCount: 0,
    stableSampleCount: 0,
    lastTransitionAt: 0,
    lastReason: "initial",
  };
}

function moveMode(
  mode: EffectivePerformanceMode,
  direction: -1 | 1,
): EffectivePerformanceMode {
  const index = modeOrder.indexOf(mode);
  const nextIndex = Math.max(
    0,
    Math.min(modeOrder.length - 1, index + direction),
  );
  return modeOrder[nextIndex];
}

export function evaluateAdaptiveSample(
  state: AdaptivePerformanceState,
  sample: FramePerformanceSample,
): AdaptivePerformanceState {
  if (!sample.eligible) return state;

  const low =
    sample.averageFps < 48 ||
    sample.lowPercentileFps < 35 ||
    sample.longFrameRatio > 0.12;
  const stable =
    sample.averageFps >= 57 &&
    sample.lowPercentileFps >= 52 &&
    sample.longFrameRatio <= 0.03;

  const lowSampleCount = low ? state.lowSampleCount + 1 : 0;
  const stableSampleCount = stable ? state.stableSampleCount + 1 : 0;
  const sinceTransition = sample.sampledAt - state.lastTransitionAt;

  if (
    lowSampleCount >= 3 &&
    sinceTransition >= 4_000 &&
    state.effectiveMode !== "performance"
  ) {
    return {
      effectiveMode: moveMode(state.effectiveMode, -1),
      lowSampleCount: 0,
      stableSampleCount: 0,
      lastTransitionAt: sample.sampledAt,
      lastReason: "sustained-low-fps",
    };
  }

  if (
    stableSampleCount >= 6 &&
    sinceTransition >= 30_000 &&
    state.effectiveMode !== "quality"
  ) {
    return {
      effectiveMode: moveMode(state.effectiveMode, 1),
      lowSampleCount: 0,
      stableSampleCount: 0,
      lastTransitionAt: sample.sampledAt,
      lastReason: "sustained-headroom",
    };
  }

  return {
    ...state,
    lowSampleCount,
    stableSampleCount,
  };
}

export function resolveRequestedMode(
  requestedMode: PerformanceMode,
  adaptiveMode: EffectivePerformanceMode,
): EffectivePerformanceMode {
  return requestedMode === "auto" ? adaptiveMode : requestedMode;
}
