import { describe, expect, it } from "vitest";

import {
  createInitialAdaptiveState,
  evaluateAdaptiveSample,
  normalizeStoredPerformanceMode,
  resolveInitialMode,
  resolveRequestedMode,
  type AdaptivePerformanceState,
  type FramePerformanceSample,
} from "./adaptivePerformance";

const lowSample = (
  sampledAt: number,
  eligible = true,
): FramePerformanceSample => ({
  averageFps: 42,
  lowPercentileFps: 28,
  longFrameRatio: 0.18,
  sampledAt,
  eligible,
});

const stableSample = (sampledAt: number): FramePerformanceSample => ({
  averageFps: 59,
  lowPercentileFps: 55,
  longFrameRatio: 0.01,
  sampledAt,
  eligible: true,
});

describe("adaptive performance decisions", () => {
  it("normalizes current modes and migrates stored low to performance", () => {
    expect(normalizeStoredPerformanceMode("low")).toBe("performance");
    expect(normalizeStoredPerformanceMode("auto")).toBe("auto");
    expect(normalizeStoredPerformanceMode("quality")).toBe("quality");
    expect(normalizeStoredPerformanceMode("balanced")).toBe("balanced");
    expect(normalizeStoredPerformanceMode("performance")).toBe("performance");
    expect(normalizeStoredPerformanceMode("unknown")).toBe("auto");
    expect(normalizeStoredPerformanceMode(null)).toBe("auto");
  });

  it("starts mobile, reduced-motion, and low-capacity devices in performance mode", () => {
    expect(resolveInitialMode({ isMobile: true })).toBe("performance");
    expect(resolveInitialMode({ prefersReducedMotion: true })).toBe("performance");
    expect(resolveInitialMode({
      isMobile: false,
      deviceMemoryGb: 4,
      hardwareConcurrency: 8,
    })).toBe("performance");
    expect(resolveInitialMode({
      isMobile: false,
      deviceMemoryGb: 8,
      hardwareConcurrency: 4,
    })).toBe("performance");
  });

  it("uses balanced for missing or constrained desktop capacity", () => {
    expect(resolveInitialMode({ isMobile: false })).toBe("balanced");
    expect(resolveInitialMode({
      isMobile: false,
      deviceMemoryGb: 8,
    })).toBe("balanced");
    expect(resolveInitialMode({
      isMobile: false,
      deviceMemoryGb: 8,
      hardwareConcurrency: 8,
      pixelRatio: 3,
    })).toBe("balanced");
    expect(resolveInitialMode({
      isMobile: false,
      deviceMemoryGb: 6,
      hardwareConcurrency: 8,
    })).toBe("balanced");
  });

  it("uses quality for a capable desktop", () => {
    expect(resolveInitialMode({
      isMobile: false,
      deviceMemoryGb: 8,
      hardwareConcurrency: 8,
      pixelRatio: 2,
    })).toBe("quality");
  });

  it("creates an initial state with cleared counters", () => {
    expect(createInitialAdaptiveState({ isMobile: true })).toEqual({
      effectiveMode: "performance",
      lowSampleCount: 0,
      stableSampleCount: 0,
      lastTransitionAt: 0,
      lastReason: "initial",
    });
  });

  it("does not downgrade for one short low sample", () => {
    const initial = createInitialAdaptiveState({ isMobile: false });
    const next = evaluateAdaptiveSample(initial, lowSample(1_000));

    expect(next.effectiveMode).toBe(initial.effectiveMode);
    expect(next.lowSampleCount).toBe(1);
  });

  it.each([
    [
      "average FPS",
      {
        averageFps: 47,
        lowPercentileFps: 52,
        longFrameRatio: 0.03,
      },
    ],
    [
      "low-percentile FPS",
      {
        averageFps: 57,
        lowPercentileFps: 34,
        longFrameRatio: 0.03,
      },
    ],
    [
      "long-frame ratio",
      {
        averageFps: 57,
        lowPercentileFps: 52,
        longFrameRatio: 0.13,
      },
    ],
  ])("counts %s independently as a low sample", (_criterion, metrics) => {
    const initial = createInitialAdaptiveState({ isMobile: false });
    const next = evaluateAdaptiveSample(initial, {
      ...metrics,
      sampledAt: 1_000,
      eligible: true,
    });

    expect(next.lowSampleCount).toBe(1);
    expect(next.stableSampleCount).toBe(0);
  });

  it.each([
    [
      "average FPS",
      {
        averageFps: 56,
        lowPercentileFps: 52,
        longFrameRatio: 0.03,
      },
    ],
    [
      "low-percentile FPS",
      {
        averageFps: 57,
        lowPercentileFps: 51,
        longFrameRatio: 0.03,
      },
    ],
    [
      "long-frame ratio",
      {
        averageFps: 57,
        lowPercentileFps: 52,
        longFrameRatio: 0.04,
      },
    ],
  ])("does not count stable when %s misses its threshold", (_criterion, metrics) => {
    const initial = {
      ...createInitialAdaptiveState({ isMobile: true }),
      stableSampleCount: 2,
    };
    const next = evaluateAdaptiveSample(initial, {
      ...metrics,
      sampledAt: 1_000,
      eligible: true,
    });

    expect(next.stableSampleCount).toBe(0);
  });

  it("does not count exact low thresholds as low", () => {
    const initial = createInitialAdaptiveState({ isMobile: false });
    const next = evaluateAdaptiveSample(initial, {
      averageFps: 48,
      lowPercentileFps: 35,
      longFrameRatio: 0.12,
      sampledAt: 1_000,
      eligible: true,
    });

    expect(next.lowSampleCount).toBe(0);
  });

  it("counts exact stable thresholds as stable", () => {
    const initial = createInitialAdaptiveState({ isMobile: true });
    const next = evaluateAdaptiveSample(initial, {
      averageFps: 57,
      lowPercentileFps: 52,
      longFrameRatio: 0.03,
      sampledAt: 1_000,
      eligible: true,
    });

    expect(next.stableSampleCount).toBe(1);
    expect(next.lowSampleCount).toBe(0);
  });

  it("downgrades one tier after three sustained low eligible samples", () => {
    let state: AdaptivePerformanceState = {
      ...createInitialAdaptiveState({
        isMobile: false,
        deviceMemoryGb: 8,
        hardwareConcurrency: 8,
      }),
      lastTransitionAt: 1_000,
    };

    state = evaluateAdaptiveSample(state, lowSample(2_000));
    state = evaluateAdaptiveSample(state, lowSample(4_000));
    state = evaluateAdaptiveSample(state, lowSample(5_000));

    expect(state).toEqual({
      effectiveMode: "balanced",
      lowSampleCount: 0,
      stableSampleCount: 0,
      lastTransitionAt: 5_000,
      lastReason: "sustained-low-fps",
    });
  });

  it("respects the four-second transition cooldown", () => {
    let state: AdaptivePerformanceState = {
      ...createInitialAdaptiveState({ isMobile: false }),
      effectiveMode: "balanced",
      lastTransitionAt: 10_000,
    };

    state = evaluateAdaptiveSample(state, lowSample(11_000));
    state = evaluateAdaptiveSample(state, lowSample(12_000));
    state = evaluateAdaptiveSample(state, lowSample(13_000));
    expect(state.effectiveMode).toBe("balanced");

    state = evaluateAdaptiveSample(state, lowSample(14_000));
    expect(state.effectiveMode).toBe("performance");
  });

  it("upgrades one tier only after six stable samples and thirty seconds", () => {
    let state: AdaptivePerformanceState = {
      ...createInitialAdaptiveState({ isMobile: true }),
      lastTransitionAt: 10_000,
    };

    for (const sampledAt of [15_000, 20_000, 25_000, 30_000, 35_000]) {
      state = evaluateAdaptiveSample(state, stableSample(sampledAt));
    }
    expect(state.effectiveMode).toBe("performance");

    state = evaluateAdaptiveSample(state, stableSample(40_000));
    expect(state.effectiveMode).toBe("balanced");
    expect(state.lastReason).toBe("sustained-headroom");
  });

  it("leaves state unchanged for ineligible samples", () => {
    const initial = createInitialAdaptiveState({ isMobile: true });
    const next = evaluateAdaptiveSample(initial, lowSample(10_000, false));

    expect(next).toBe(initial);
  });

  it("uses adaptive mode for auto and honors explicit requested modes", () => {
    expect(resolveRequestedMode("auto", "performance")).toBe("performance");
    expect(resolveRequestedMode("quality", "performance")).toBe("quality");
    expect(resolveRequestedMode("balanced", "quality")).toBe("balanced");
    expect(resolveRequestedMode("performance", "quality")).toBe("performance");
  });
});
