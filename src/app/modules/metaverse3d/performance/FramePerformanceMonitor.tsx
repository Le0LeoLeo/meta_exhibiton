import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";

import type { FramePerformanceSample } from "./adaptivePerformance";

interface FramePerformanceMonitorProps {
  eligible: boolean;
  onSample: (sample: FramePerformanceSample) => void;
}

const SAMPLE_WINDOW_MS = 2_000;
const LONG_FRAME_SECONDS = 1 / 30;

function percentile(sortedValues: number[], percentileValue: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.floor((sortedValues.length - 1) * percentileValue);
  return sortedValues[index] ?? 0;
}

export function FramePerformanceMonitor({
  eligible,
  onSample,
}: FramePerformanceMonitorProps) {
  const deltasRef = useRef<number[]>([]);
  const elapsedMsRef = useRef(0);

  useEffect(() => {
    deltasRef.current = [];
    elapsedMsRef.current = 0;
  }, [eligible]);

  useFrame((state, delta) => {
    if (!eligible) return;

    deltasRef.current.push(delta);
    elapsedMsRef.current += delta * 1_000;

    if (elapsedMsRef.current < SAMPLE_WINDOW_MS) return;

    const deltas = deltasRef.current;
    const totalSeconds = deltas.reduce((total, value) => total + value, 0);
    const averageFps = totalSeconds > 0 ? deltas.length / totalSeconds : 0;
    const frameFps = deltas
      .map((value) => (value > 0 ? 1 / value : 0))
      .sort((a, b) => a - b);
    const longFrames = deltas.filter(
      (value) => value >= LONG_FRAME_SECONDS,
    ).length;

    onSample({
      averageFps,
      lowPercentileFps: percentile(frameFps, 0.1),
      longFrameRatio: deltas.length > 0 ? longFrames / deltas.length : 0,
      sampledAt:
        typeof performance === "undefined"
          ? state.clock.elapsedTime * 1_000
          : performance.now(),
      eligible: true,
    });

    deltasRef.current = [];
    elapsedMsRef.current = 0;
  });

  return null;
}
