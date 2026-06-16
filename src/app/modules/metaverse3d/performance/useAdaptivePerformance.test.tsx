import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useAdaptivePerformance } from "./useAdaptivePerformance";
import type { FramePerformanceSample } from "./adaptivePerformance";

const lowSample = (sampledAt: number): FramePerformanceSample => ({
  averageFps: 42,
  lowPercentileFps: 28,
  longFrameRatio: 0.18,
  sampledAt,
  eligible: true,
});

describe("useAdaptivePerformance", () => {
  it("starts from browser signals and resolves auto to the adaptive mode", () => {
    const { result } = renderHook(() =>
      useAdaptivePerformance({
        requestedMode: "auto",
        signals: {
          isMobile: true,
          deviceMemoryGb: 4,
          hardwareConcurrency: 4,
          pixelRatio: 2,
        },
      }),
    );

    expect(result.current.adaptiveMode).toBe("performance");
    expect(result.current.effectiveMode).toBe("performance");
    expect(result.current.transitionReason).toBe("initial");
  });

  it("downgrades adaptive mode after sustained low eligible samples in auto", () => {
    const { result } = renderHook(() =>
      useAdaptivePerformance({
        requestedMode: "auto",
        signals: {
          isMobile: false,
          deviceMemoryGb: 8,
          hardwareConcurrency: 8,
          pixelRatio: 1,
        },
      }),
    );

    expect(result.current.adaptiveMode).toBe("quality");

    act(() => {
      result.current.reportSample(lowSample(2_000));
      result.current.reportSample(lowSample(4_000));
      result.current.reportSample(lowSample(5_000));
    });

    expect(result.current.adaptiveMode).toBe("balanced");
    expect(result.current.effectiveMode).toBe("balanced");
    expect(result.current.transitionReason).toBe("sustained-low-fps");
  });

  it("honors explicit requested modes and ignores adaptive samples", () => {
    const { result } = renderHook(() =>
      useAdaptivePerformance({
        requestedMode: "quality",
        signals: {
          isMobile: false,
          deviceMemoryGb: 8,
          hardwareConcurrency: 8,
          pixelRatio: 1,
        },
      }),
    );

    act(() => {
      result.current.reportSample(lowSample(2_000));
      result.current.reportSample(lowSample(4_000));
      result.current.reportSample(lowSample(5_000));
    });

    expect(result.current.adaptiveMode).toBe("quality");
    expect(result.current.effectiveMode).toBe("quality");
    expect(result.current.transitionReason).toBe("initial");
  });
});
