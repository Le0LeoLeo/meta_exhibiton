# Adaptive Mobile Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add adaptive 3D quality, progressive scene entry, touch-first mobile controls, lifecycle throttling, and conservative site-wide loading improvements so typical mobile exhibitions target near-60 FPS without blocking core viewing.

**Architecture:** Keep `performanceProfile.ts` as the single mapping from an effective quality tier to renderer settings. Add pure adaptive-decision helpers plus a Canvas-local frame sampler that reports low-frequency summaries, and keep high-frequency input/FPS data outside React state. Extend the existing scene preloader into explicit core/background stages, then reuse the current Player collision path through a shared input intent.

**Tech Stack:** React 18, TypeScript, React Router 7, Zustand 5, React Three Fiber 8, Drei 9, Three.js 0.183, Vitest 4, Testing Library.

---

## File Map

- `src/app/modules/metaverse3d/performance/adaptivePerformance.ts`: pure initial-tier and hysteresis decisions.
- `src/app/modules/metaverse3d/performance/useAdaptivePerformance.ts`: low-frequency controller state and manual override behavior.
- `src/app/modules/metaverse3d/performance/FramePerformanceMonitor.tsx`: Canvas-local frame sampling.
- `src/app/modules/metaverse3d/performanceProfile.ts`: map the effective tier to render, physics, multiplayer, and lifecycle settings.
- `src/app/features/metaverse-studio/canvas/useScenePreloader.ts`: staged core/background resource loading.
- `src/app/features/metaverse-studio/canvas/PreloadOverlay.tsx`: real stage/progress display and early-entry action.
- `src/app/modules/metaverse3d/input/playerInput.ts`: shared keyboard/touch movement intent.
- `src/app/modules/metaverse3d/components/MobileControls.tsx`: virtual joystick, look surface, and interaction button.
- `src/app/modules/metaverse3d/components/Player.tsx`: consume shared intent without duplicating collision logic.
- `src/app/modules/metaverse3d/lifecycle/useSceneLifecycle.ts`: visibility, detail-modal, and viewport lifecycle state.
- `src/app/components/RouteLoadingFallback.tsx`: route-level skeleton instead of a blank transition.
- `src/app/routes.ts`, `src/app/App.tsx`, and selected media components: conservative site-wide loading behavior.

### Task 1: Define Adaptive Performance Decisions

**Files:**
- Create: `src/app/modules/metaverse3d/performance/adaptivePerformance.ts`
- Create: `src/app/modules/metaverse3d/performance/adaptivePerformance.test.ts`
- Modify: `src/app/modules/metaverse3d/types.ts`

- [ ] **Step 1: Write the failing decision tests**

```ts
import { describe, expect, it } from "vitest";
import {
  createInitialAdaptiveState,
  evaluateAdaptiveSample,
  normalizeStoredPerformanceMode,
} from "./adaptivePerformance";

describe("adaptive performance decisions", () => {
  it("starts coarse-pointer mobile devices in performance mode", () => {
    expect(createInitialAdaptiveState({
      isMobile: true,
      deviceMemoryGb: 8,
      hardwareConcurrency: 8,
      pixelRatio: 3,
    }).effectiveMode).toBe("performance");
  });

  it("uses conservative defaults when browser capacity signals are absent", () => {
    expect(createInitialAdaptiveState({ isMobile: true }).effectiveMode).toBe("performance");
    expect(createInitialAdaptiveState({ isMobile: false }).effectiveMode).toBe("balanced");
  });

  it("does not downgrade for one short frame sample", () => {
    const initial = createInitialAdaptiveState({ isMobile: false });
    const next = evaluateAdaptiveSample(initial, {
      averageFps: 38,
      lowPercentileFps: 25,
      longFrameRatio: 0.2,
      sampledAt: 1_000,
      eligible: true,
    });
    expect(next.effectiveMode).toBe(initial.effectiveMode);
  });

  it("downgrades one level after sustained low performance", () => {
    let state = createInitialAdaptiveState({ isMobile: false });
    for (let index = 0; index < 3; index += 1) {
      state = evaluateAdaptiveSample(state, {
        averageFps: 42,
        lowPercentileFps: 28,
        longFrameRatio: 0.18,
        sampledAt: 2_000 + index * 2_000,
        eligible: true,
      });
    }
    expect(state.effectiveMode).toBe("performance");
  });

  it("requires a longer stable period before upgrading", () => {
    let state = {
      ...createInitialAdaptiveState({ isMobile: true }),
      lastTransitionAt: 0,
    };
    for (let index = 0; index < 5; index += 1) {
      state = evaluateAdaptiveSample(state, {
        averageFps: 59,
        lowPercentileFps: 55,
        longFrameRatio: 0.01,
        sampledAt: 20_000 + index * 4_000,
        eligible: true,
      });
    }
    expect(state.effectiveMode).toBe("performance");

    state = evaluateAdaptiveSample(state, {
      averageFps: 59,
      lowPercentileFps: 56,
      longFrameRatio: 0.01,
      sampledAt: 45_000,
      eligible: true,
    });
    expect(state.effectiveMode).toBe("balanced");
  });

  it("ignores samples while hidden, loading, or viewing details", () => {
    const initial = createInitialAdaptiveState({ isMobile: true });
    const next = evaluateAdaptiveSample(initial, {
      averageFps: 10,
      lowPercentileFps: 5,
      longFrameRatio: 0.8,
      sampledAt: 10_000,
      eligible: false,
    });
    expect(next).toEqual(initial);
  });

  it("migrates the stored low value to performance", () => {
    expect(normalizeStoredPerformanceMode("low")).toBe("performance");
    expect(normalizeStoredPerformanceMode("quality")).toBe("quality");
    expect(normalizeStoredPerformanceMode("unknown")).toBe("auto");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/app/modules/metaverse3d/performance/adaptivePerformance.test.ts`

Expected: FAIL because `adaptivePerformance.ts` and the `"performance"` mode do not exist.

- [ ] **Step 3: Extend the public mode type**

In `src/app/modules/metaverse3d/types.ts`, replace:

```ts
export type PerformanceMode = "auto" | "quality" | "balanced" | "low";
```

with:

```ts
export type PerformanceMode = "auto" | "quality" | "balanced" | "performance";
export type LegacyPerformanceMode = PerformanceMode | "low";
```

- [ ] **Step 4: Implement the pure adaptive state machine**

Create `adaptivePerformance.ts` with:

```ts
import type {
  LegacyPerformanceMode,
  PerformanceMode,
} from "../types";

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

const order: EffectivePerformanceMode[] = [
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
  const index = order.indexOf(mode);
  return order[Math.max(0, Math.min(order.length - 1, index + direction))];
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

  return { ...state, lowSampleCount, stableSampleCount };
}

export function resolveRequestedMode(
  requestedMode: PerformanceMode,
  adaptiveMode: EffectivePerformanceMode,
): EffectivePerformanceMode {
  return requestedMode === "auto" ? adaptiveMode : requestedMode;
}
```

- [ ] **Step 5: Run the decision tests**

Run: `npm test -- src/app/modules/metaverse3d/performance/adaptivePerformance.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/metaverse3d/types.ts src/app/modules/metaverse3d/performance/adaptivePerformance.ts src/app/modules/metaverse3d/performance/adaptivePerformance.test.ts
git commit -m "feat: add adaptive performance decisions"
```

### Task 2: Persist the New Mode and Build Render Profiles

**Files:**
- Modify: `src/app/modules/metaverse3d/store/useMetaverseStudioStore.ts`
- Modify: `src/app/modules/metaverse3d/performanceProfile.ts`
- Modify: `src/app/modules/metaverse3d/components/UI/PerformanceModeControl.tsx`
- Create: `src/app/modules/metaverse3d/performanceProfile.test.ts`

- [ ] **Step 1: Write failing profile tests**

```ts
import { describe, expect, it } from "vitest";
import { createRenderPerformanceProfile } from "./performanceProfile";

describe("render performance profiles", () => {
  it("uses the adaptive effective mode for auto", () => {
    const profile = createRenderPerformanceProfile("auto", "performance");
    expect(profile.effectiveMode).toBe("performance");
    expect(profile.dpr).toEqual([0.75, 1]);
    expect(profile.enablePostprocessing).toBe(false);
    expect(profile.multiplayerMoveIntervalMs).toBe(160);
  });

  it("honors a manual quality override", () => {
    const profile = createRenderPerformanceProfile("quality", "performance");
    expect(profile.effectiveMode).toBe("quality");
    expect(profile.enableShadows).toBe(true);
    expect(profile.pauseWhenObscured).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/app/modules/metaverse3d/performanceProfile.test.ts`

Expected: FAIL because the profile function does not accept an adaptive mode and has no lifecycle/network settings.

- [ ] **Step 3: Update persisted-state migration**

In `useMetaverseStudioStore.ts`:

```ts
import { normalizeStoredPerformanceMode } from "../performance/adaptivePerformance";
```

Increment the persisted store version from `6` to `7`, and replace the performance-mode migration expression with:

```ts
performanceMode: normalizeStoredPerformanceMode(
  persistedState.performanceMode,
),
```

Keep `performanceMode` in `partialize`.

Add a non-persisted runtime field and setter to the store:

```ts
effectivePerformanceMode: "balanced",
setEffectivePerformanceMode: (mode) =>
  set({ effectivePerformanceMode: mode }),
```

Type the field as `EffectivePerformanceMode`. Do not include it in
`partialize`; it is recalculated for each browser session.

- [ ] **Step 4: Replace profile creation with explicit effective mode input**

Update `RenderPerformanceProfile` to include:

```ts
multiplayerMoveIntervalMs: number;
remoteInterpolationFps: number;
pauseWhenObscured: boolean;
idleFrameloop: "always" | "demand";
```

Use these tier values:

```ts
const qualityProfile = {
  dpr: [1, 1.35] as [number, number],
  shadowMapSize: 512,
  enableEnvironment: true,
  enableExtraAccentLights: true,
  enablePostprocessing: true,
  enableShadows: true,
  enableRemotePlayers: true,
  physicsUpdateLoop: "independent" as const,
  physicsTimeStep: "vary" as const,
  multiplayerMoveIntervalMs: 80,
  remoteInterpolationFps: 60,
  pauseWhenObscured: true,
  idleFrameloop: "demand" as const,
};

const balancedProfile = {
  dpr: [0.9, 1.1] as [number, number],
  shadowMapSize: 384,
  enableEnvironment: true,
  enableExtraAccentLights: false,
  enablePostprocessing: false,
  enableShadows: true,
  enableRemotePlayers: true,
  physicsUpdateLoop: "independent" as const,
  physicsTimeStep: 1 / 45,
  multiplayerMoveIntervalMs: 120,
  remoteInterpolationFps: 45,
  pauseWhenObscured: true,
  idleFrameloop: "demand" as const,
};

const performanceProfile = {
  dpr: [0.75, 1] as [number, number],
  shadowMapSize: 256,
  enableEnvironment: false,
  enableExtraAccentLights: false,
  enablePostprocessing: false,
  enableShadows: false,
  enableRemotePlayers: false,
  physicsUpdateLoop: "follow" as const,
  physicsTimeStep: 1 / 30,
  multiplayerMoveIntervalMs: 160,
  remoteInterpolationFps: 30,
  pauseWhenObscured: true,
  idleFrameloop: "demand" as const,
};
```

Change the public factory to:

```ts
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

  return { requestedMode, effectiveMode, ...profile };
}
```

Make the hook read the shared runtime tier:

```ts
export function useRenderPerformanceProfile(): RenderPerformanceProfile {
  const requestedMode = useStore((state) => state.performanceMode);
  const adaptiveMode = useStore(
    (state) => state.effectivePerformanceMode,
  );
  return useMemo(
    () => createRenderPerformanceProfile(requestedMode, adaptiveMode),
    [adaptiveMode, requestedMode],
  );
}
```

- [ ] **Step 5: Update the quality control labels**

Use these options in `PerformanceModeControl.tsx`:

```ts
const options = [
  { value: "auto", label: "自動", title: "依裝置與即時流暢度調整", Icon: MonitorCog },
  { value: "performance", label: "流暢", title: "手機流暢度優先", Icon: BatteryMedium },
  { value: "balanced", label: "平衡", title: "兼顧畫質與流暢度", Icon: Gauge },
  { value: "quality", label: "畫質", title: "高畫質效果優先", Icon: Sparkles },
] satisfies Array<{
  value: PerformanceMode;
  label: string;
  title: string;
  Icon: typeof Gauge;
}>;
```

The live adaptive tier is updated in Task 3. Until that controller mounts,
the shared runtime tier remains `"balanced"`.

- [ ] **Step 6: Run focused tests and build**

Run: `npm test -- src/app/modules/metaverse3d/performanceProfile.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: PASS with no `"low"` type errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/modules/metaverse3d/store/useMetaverseStudioStore.ts src/app/modules/metaverse3d/performanceProfile.ts src/app/modules/metaverse3d/components/UI/PerformanceModeControl.tsx src/app/modules/metaverse3d/performanceProfile.test.ts
git commit -m "feat: add mobile-first render profiles"
```

### Task 3: Sample Canvas FPS and Drive Auto Mode

**Files:**
- Create: `src/app/modules/metaverse3d/performance/useAdaptivePerformance.ts`
- Create: `src/app/modules/metaverse3d/performance/FramePerformanceMonitor.tsx`
- Create: `src/app/modules/metaverse3d/performance/useAdaptivePerformance.test.tsx`
- Modify: `src/app/modules/metaverse3d/performanceProfile.ts`
- Modify: `src/app/modules/metaverse3d/components/CanvasScene.tsx`

- [ ] **Step 1: Write the failing controller test**

```tsx
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PerformanceMode } from "../types";
import { useAdaptivePerformance } from "./useAdaptivePerformance";

describe("useAdaptivePerformance", () => {
  it("keeps manual mode fixed while auto mode accepts samples", () => {
    const { result, rerender } = renderHook(
      ({ requestedMode }: { requestedMode: PerformanceMode }) =>
        useAdaptivePerformance({
          requestedMode,
          signals: { isMobile: true },
        }),
      {
        initialProps: {
          requestedMode: "quality" as PerformanceMode,
        },
      },
    );

    act(() => {
      result.current.reportSample({
        averageFps: 10,
        lowPercentileFps: 5,
        longFrameRatio: 0.8,
        sampledAt: 10_000,
        eligible: true,
      });
    });
    expect(result.current.effectiveMode).toBe("quality");

    rerender({ requestedMode: "auto" });
    expect(result.current.effectiveMode).toBe("performance");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/app/modules/metaverse3d/performance/useAdaptivePerformance.test.tsx`

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement the controller hook**

```ts
import { useCallback, useMemo, useRef, useState } from "react";
import type { PerformanceMode } from "../types";
import {
  createInitialAdaptiveState,
  evaluateAdaptiveSample,
  resolveRequestedMode,
  type AdaptiveDeviceSignals,
  type FramePerformanceSample,
} from "./adaptivePerformance";

export function useAdaptivePerformance({
  requestedMode,
  signals,
}: {
  requestedMode: PerformanceMode;
  signals: AdaptiveDeviceSignals;
}) {
  const stateRef = useRef(createInitialAdaptiveState(signals));
  const [adaptiveMode, setAdaptiveMode] = useState(
    stateRef.current.effectiveMode,
  );

  const reportSample = useCallback(
    (sample: FramePerformanceSample) => {
      if (requestedMode !== "auto") return;
      const next = evaluateAdaptiveSample(stateRef.current, sample);
      stateRef.current = next;
      setAdaptiveMode((current) =>
        current === next.effectiveMode ? current : next.effectiveMode,
      );
    },
    [requestedMode],
  );

  return useMemo(
    () => ({
      adaptiveMode,
      effectiveMode: resolveRequestedMode(requestedMode, adaptiveMode),
      reportSample,
      transitionReason: stateRef.current.lastReason,
    }),
    [adaptiveMode, reportSample, requestedMode],
  );
}
```

- [ ] **Step 4: Implement Canvas-local frame aggregation**

Create `FramePerformanceMonitor.tsx`:

```tsx
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { FramePerformanceSample } from "./adaptivePerformance";

const SAMPLE_WINDOW_MS = 2_000;

export function FramePerformanceMonitor({
  eligible,
  onSample,
}: {
  eligible: boolean;
  onSample: (sample: FramePerformanceSample) => void;
}) {
  const frameTimesRef = useRef<number[]>([]);
  const windowStartedAtRef = useRef(0);

  useFrame((_, delta) => {
    const now = performance.now();
    if (windowStartedAtRef.current === 0) windowStartedAtRef.current = now;
    frameTimesRef.current.push(delta * 1_000);

    if (now - windowStartedAtRef.current < SAMPLE_WINDOW_MS) return;

    const frames = frameTimesRef.current;
    const sorted = [...frames].sort((a, b) => a - b);
    const averageMs =
      frames.reduce((sum, value) => sum + value, 0) /
      Math.max(1, frames.length);
    const lowIndex = Math.min(
      sorted.length - 1,
      Math.floor(sorted.length * 0.99),
    );
    const longFrames = frames.filter((value) => value > 25).length;

    onSample({
      averageFps: 1_000 / Math.max(1, averageMs),
      lowPercentileFps: 1_000 / Math.max(1, sorted[lowIndex] ?? averageMs),
      longFrameRatio: longFrames / Math.max(1, frames.length),
      sampledAt: now,
      eligible,
    });

    frameTimesRef.current = [];
    windowStartedAtRef.current = now;
  });

  return null;
}
```

- [ ] **Step 5: Wire the controller into `CanvasScene`**

In `CanvasScene`:

```ts
const requestedMode = useStore((state) => state.performanceMode);
const setEffectivePerformanceMode = useStore(
  (state) => state.setEffectivePerformanceMode,
);
const viewingItem = useStore((state) => state.viewingItem);
const signals = useMemo(() => getBrowserPerformanceSignals(), []);
const adaptive = useAdaptivePerformance({ requestedMode, signals });
const performanceProfile = useRenderPerformanceProfile();
const sampleEligible =
  mode === "view" &&
  !viewingItem &&
  document.visibilityState === "visible";
```

Publish only low-frequency tier changes:

```ts
useEffect(() => {
  setEffectivePerformanceMode(adaptive.effectiveMode);
}, [adaptive.effectiveMode, setEffectivePerformanceMode]);
```

Render inside `<Canvas>`:

```tsx
<FramePerformanceMonitor
  eligible={sampleEligible}
  onSample={adaptive.reportSample}
/>
```

- [ ] **Step 6: Run tests and build**

Run: `npm test -- src/app/modules/metaverse3d/performance/useAdaptivePerformance.test.tsx src/app/modules/metaverse3d/performance/adaptivePerformance.test.ts src/app/modules/metaverse3d/performanceProfile.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/modules/metaverse3d/performance src/app/modules/metaverse3d/performanceProfile.ts src/app/modules/metaverse3d/components/CanvasScene.tsx
git commit -m "feat: adapt 3d quality from frame performance"
```

### Task 4: Replace Blocking Preload with Progressive Scene Entry

**Files:**
- Modify: `src/app/features/metaverse-studio/canvas/useScenePreloader.ts`
- Modify: `src/app/features/metaverse-studio/canvas/PreloadOverlay.tsx`
- Modify: `src/app/features/metaverse-studio/canvas/StudioCanvasRoot.tsx`
- Create: `src/app/features/metaverse-studio/canvas/useScenePreloader.test.tsx`

- [ ] **Step 1: Write failing staged-loader tests**

```tsx
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useScenePreloader } from "./useScenePreloader";

describe("useScenePreloader", () => {
  it("marks the core scene ready before background assets finish", async () => {
    const loadAsset = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(() => new Promise(() => undefined));

    const { result } = renderHook(() =>
      useScenePreloader({
        mode: "view",
        roomSize: {
          wallTextureUrl: "/wall.svg",
          floorTextureUrl: "/floor.svg",
        } as never,
        items: [
          {
            id: "painting-1",
            type: "painting",
            content: "https://example.test/high.jpg",
          },
        ] as never,
        loadAsset,
      }),
    );

    await waitFor(() => expect(result.current.coreReady).toBe(true));
    expect(result.current.backgroundComplete).toBe(false);
    expect(result.current.canEnter).toBe(true);
  });

  it("continues when an optional asset rejects", async () => {
    const loadAsset = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("optional failed"));

    const { result } = renderHook(() =>
      useScenePreloader({
        mode: "view",
        roomSize: {
          wallTextureUrl: "/wall.svg",
          floorTextureUrl: "/floor.svg",
        } as never,
        items: [] as never,
        loadAsset,
      }),
    );

    await waitFor(() =>
      expect(result.current.backgroundComplete).toBe(true),
    );
    expect(result.current.failedAssets).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/app/features/metaverse-studio/canvas/useScenePreloader.test.tsx`

Expected: FAIL because the hook has no staged state or injectable loader.

- [ ] **Step 3: Split core and background asset queues**

Export:

```ts
export type SceneLoadStage =
  | "interface"
  | "core"
  | "nearby"
  | "complete";

export interface ScenePreloadState {
  stage: SceneLoadStage;
  progress: number;
  coreReady: boolean;
  canEnter: boolean;
  backgroundComplete: boolean;
  failedAssets: number;
}
```

Use room wall/floor textures as the core queue. Put exhibit media, thumbnails, GLB/GLTF files, and extra shared textures in the background queue. Run the core queue first with `Promise.allSettled`, set `coreReady` and `canEnter`, then start the background queue without hiding the Canvas.

The default `loadAsset` must:

```ts
async function defaultLoadAsset(url: string) {
  if (PRELOAD_MODEL_EXTENSIONS.test(url)) {
    useGLTF.preload(url);
    return;
  }
  if (PRELOAD_IMAGE_EXTENSIONS.test(url)) {
    await useTexture.preload(url);
  }
}
```

- [ ] **Step 4: Update the overlay contract**

Change `PreloadOverlayProps` to:

```ts
interface PreloadOverlayProps {
  stage: SceneLoadStage;
  progress: number;
  canEnter: boolean;
  failedAssets: number;
  onEnter: () => void;
  onBack?: () => void;
}
```

Render these Traditional Chinese stage labels:

```ts
const labels: Record<SceneLoadStage, string> = {
  interface: "準備展覽介面",
  core: "建立展館與操作空間",
  nearby: "載入附近作品與互動",
  complete: "展覽已準備完成",
};
```

When `canEnter` is true, show a 44px-high primary button labeled `先進入展覽`; keep progress visible while background assets continue.

- [ ] **Step 5: Let `StudioCanvasRoot` reveal the Canvas after core readiness**

Add local state:

```ts
const [enteredScene, setEnteredScene] = useState(false);
const showOverlay = !enteredScene && !backgroundComplete;
```

Render the Canvas at all times, but set:

```tsx
<div
  id="view-canvas-container"
  aria-busy={!backgroundComplete}
  className="absolute inset-0 h-full w-full"
>
```

Pass `onEnter={() => setEnteredScene(true)}`. Automatically enter after full completion, but never block on optional failures.

- [ ] **Step 6: Run tests and build**

Run: `npm test -- src/app/features/metaverse-studio/canvas/useScenePreloader.test.tsx`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/features/metaverse-studio/canvas/useScenePreloader.ts src/app/features/metaverse-studio/canvas/useScenePreloader.test.tsx src/app/features/metaverse-studio/canvas/PreloadOverlay.tsx src/app/features/metaverse-studio/canvas/StudioCanvasRoot.tsx
git commit -m "feat: allow progressive 3d scene entry"
```

### Task 5: Add Scene Lifecycle Throttling

**Files:**
- Create: `src/app/modules/metaverse3d/lifecycle/useSceneLifecycle.ts`
- Create: `src/app/modules/metaverse3d/lifecycle/useSceneLifecycle.test.tsx`
- Modify: `src/app/modules/metaverse3d/components/CanvasScene.tsx`
- Modify: `src/app/modules/metaverse3d/components/Player.tsx`

- [ ] **Step 1: Write failing lifecycle tests**

```tsx
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSceneLifecycle } from "./useSceneLifecycle";

describe("useSceneLifecycle", () => {
  it("marks hidden pages as obscured", () => {
    const { result } = renderHook(() =>
      useSceneLifecycle({ detailOpen: false }),
    );

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    act(() => document.dispatchEvent(new Event("visibilitychange")));

    expect(result.current.obscured).toBe(true);
    expect(result.current.allowMotion).toBe(false);
  });

  it("pauses motion while artwork details are open", () => {
    const { result } = renderHook(() =>
      useSceneLifecycle({ detailOpen: true }),
    );
    expect(result.current.allowMotion).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/app/modules/metaverse3d/lifecycle/useSceneLifecycle.test.tsx`

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement lifecycle state**

```ts
import { useEffect, useState } from "react";

export function useSceneLifecycle({
  detailOpen,
}: {
  detailOpen: boolean;
}) {
  const [visible, setVisible] = useState(
    () => document.visibilityState !== "hidden",
  );

  useEffect(() => {
    const onVisibilityChange = () => {
      setVisible(document.visibilityState !== "hidden");
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener(
        "visibilitychange",
        onVisibilityChange,
      );
  }, []);

  return {
    visible,
    obscured: !visible || detailOpen,
    allowMotion: visible && !detailOpen,
  };
}
```

- [ ] **Step 4: Apply lifecycle state to Canvas and Player**

In `CanvasScene`, derive lifecycle from `viewingItem`, pass `allowMotion` into `ViewCanvas`, and set:

```tsx
frameloop={
  lifecycle.obscured
    ? performanceProfile.idleFrameloop
    : "always"
}
```

Remove the artificial `pointermove` RAF pump. It creates continuous DOM events and defeats the intended demand loop.

In `ViewCanvas`, pass `allowMotion` to `Player` and `RemotePlayers`.

In `Player`, return early from movement, proximity, AI reminder, and local transform updates when `allowMotion` is false. Clear pressed-key refs when motion becomes disallowed.

- [ ] **Step 5: Run tests and build**

Run: `npm test -- src/app/modules/metaverse3d/lifecycle/useSceneLifecycle.test.tsx`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/metaverse3d/lifecycle src/app/modules/metaverse3d/components/CanvasScene.tsx src/app/modules/metaverse3d/components/ViewCanvas.tsx src/app/modules/metaverse3d/components/Player.tsx src/app/modules/metaverse3d/components/Multiplayer/RemotePlayers.tsx
git commit -m "feat: throttle obscured 3d scenes"
```

### Task 6: Add Shared Mobile Player Input

**Files:**
- Create: `src/app/modules/metaverse3d/input/playerInput.ts`
- Create: `src/app/modules/metaverse3d/input/playerInput.test.ts`
- Create: `src/app/modules/metaverse3d/components/MobileControls.tsx`
- Modify: `src/app/modules/metaverse3d/components/Player.tsx`
- Modify: `src/app/modules/metaverse3d/components/ViewCanvas.tsx`
- Modify: `src/app/features/metaverse-studio/canvas/StudioCanvasRoot.tsx`

- [ ] **Step 1: Write failing input tests**

```ts
import { describe, expect, it } from "vitest";
import {
  clampJoystick,
  createPlayerInputState,
  setKeyboardKey,
} from "./playerInput";

describe("player input", () => {
  it("normalizes diagonal keyboard movement", () => {
    const state = createPlayerInputState();
    setKeyboardKey(state, "KeyW", true);
    setKeyboardKey(state, "KeyD", true);
    expect(Math.hypot(state.moveX, state.moveY)).toBeCloseTo(1);
  });

  it("clamps joystick travel to the unit circle", () => {
    expect(clampJoystick(80, 80, 60)).toEqual({
      x: expect.closeTo(Math.SQRT1_2),
      y: expect.closeTo(Math.SQRT1_2),
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/app/modules/metaverse3d/input/playerInput.test.ts`

Expected: FAIL because the input module does not exist.

- [ ] **Step 3: Implement the shared mutable input state**

```ts
export interface PlayerInputState {
  moveX: number;
  moveY: number;
  lookDeltaX: number;
  lookDeltaY: number;
  interactRequested: boolean;
  pressedKeys: Set<string>;
}

export function createPlayerInputState(): PlayerInputState {
  return {
    moveX: 0,
    moveY: 0,
    lookDeltaX: 0,
    lookDeltaY: 0,
    interactRequested: false,
    pressedKeys: new Set(),
  };
}

export function clampJoystick(
  x: number,
  y: number,
  radius: number,
) {
  const length = Math.hypot(x, y);
  if (length === 0) return { x: 0, y: 0 };
  const scale = Math.min(1, radius / length) / radius;
  return { x: x * scale, y: y * scale };
}

export function setKeyboardKey(
  state: PlayerInputState,
  code: string,
  pressed: boolean,
) {
  if (pressed) state.pressedKeys.add(code);
  else state.pressedKeys.delete(code);

  const x =
    Number(state.pressedKeys.has("KeyD") || state.pressedKeys.has("ArrowRight")) -
    Number(state.pressedKeys.has("KeyA") || state.pressedKeys.has("ArrowLeft"));
  const y =
    Number(state.pressedKeys.has("KeyW") || state.pressedKeys.has("ArrowUp")) -
    Number(state.pressedKeys.has("KeyS") || state.pressedKeys.has("ArrowDown"));
  const length = Math.hypot(x, y) || 1;
  state.moveX = x / length;
  state.moveY = y / length;
}
```

- [ ] **Step 4: Implement touch controls**

`MobileControls` must:

- Render only when `(pointer: coarse)` matches.
- Use pointer capture for the left joystick and right look surface.
- Write movement and look deltas directly into a shared `PlayerInputState` ref.
- Use controls at least `44px` high.
- Render an interaction button only when `nearbyItemId` is non-null.
- Set `interactRequested = true` on interaction press.
- Reset movement on `pointercancel`, `pointerup`, and unmount.

Use this public contract:

```tsx
import {
  useEffect,
  useRef,
  type MutableRefObject,
  type PointerEvent,
} from "react";
import {
  clampJoystick,
  type PlayerInputState,
} from "../input/playerInput";

export function MobileControls({
  input,
  nearbyItemTitle,
}: {
  input: MutableRefObject<PlayerInputState>;
  nearbyItemTitle: string | null;
}) {
  const joystickOrigin = useRef({ x: 0, y: 0 });
  const lastLookPoint = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    return () => {
      input.current.moveX = 0;
      input.current.moveY = 0;
    };
  }, [input]);

  if (!(window.matchMedia?.("(pointer: coarse)").matches ?? false)) {
    return null;
  }

  const updateJoystick = (event: PointerEvent<HTMLDivElement>) => {
    const next = clampJoystick(
      event.clientX - joystickOrigin.current.x,
      event.clientY - joystickOrigin.current.y,
      56,
    );
    input.current.moveX = next.x;
    input.current.moveY = -next.y;
  };

  const resetJoystick = () => {
    input.current.moveX = 0;
    input.current.moveY = 0;
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <div
        aria-label="移動控制"
        className="pointer-events-auto absolute bottom-6 left-6 size-28 touch-none rounded-full border border-white/30 bg-slate-950/40"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          joystickOrigin.current = {
            x: event.clientX,
            y: event.clientY,
          };
          updateJoystick(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            updateJoystick(event);
          }
        }}
        onPointerUp={resetJoystick}
        onPointerCancel={resetJoystick}
      />
      <div
        aria-label="視角控制"
        className="pointer-events-auto absolute inset-y-0 right-0 w-1/2 touch-none"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          lastLookPoint.current = {
            x: event.clientX,
            y: event.clientY,
          };
        }}
        onPointerMove={(event) => {
          const previous = lastLookPoint.current;
          if (
            !previous ||
            !event.currentTarget.hasPointerCapture(event.pointerId)
          ) {
            return;
          }
          input.current.lookDeltaX += event.clientX - previous.x;
          input.current.lookDeltaY += event.clientY - previous.y;
          lastLookPoint.current = {
            x: event.clientX,
            y: event.clientY,
          };
        }}
        onPointerUp={() => {
          lastLookPoint.current = null;
        }}
        onPointerCancel={() => {
          lastLookPoint.current = null;
        }}
      />
      {nearbyItemTitle && (
        <button
          type="button"
          className="pointer-events-auto absolute bottom-8 left-1/2 min-h-11 -translate-x-1/2 rounded-full bg-white px-5 text-sm font-medium text-slate-950 shadow-xl"
          onClick={() => {
            input.current.interactRequested = true;
          }}
        >
          查看「{nearbyItemTitle}」
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Make Player consume one input ref**

Create the input ref in `StudioCanvasRoot`:

```ts
const playerInputRef = useRef(createPlayerInputState());
```

Pass it through `CanvasScene` and `ViewCanvas` into `Player`. Replace four movement booleans with `input.current.moveX` and `moveY`. Keyboard listeners call `setKeyboardKey`.

At the start of each frame:

```ts
const inputState = input.current;
yawRef.current -= inputState.lookDeltaX * LOOK_SENSITIVITY;
pitchRef.current -= inputState.lookDeltaY * LOOK_SENSITIVITY;
inputState.lookDeltaX = 0;
inputState.lookDeltaY = 0;
```

Keep all current collision resolution and camera updates unchanged after movement-vector creation.

After resolving the nearest item, consume interaction once:

```ts
if (input.current.interactRequested) {
  input.current.interactRequested = false;
  if (nearestItem && inIntroRange) {
    setViewingItem(nearestItem.item);
  }
}
```

In `StudioCanvasRoot`, add:

```ts
const [nearbyItemTitle, setNearbyItemTitle] =
  useState<string | null>(null);
```

Pass `onNearbyItemChange` through `CanvasScene` and `ViewCanvas` to
`Player`. In `Player`, retain the last reported item ID in a ref and call:

```ts
onNearbyItemChange(
  nearestItem
    ? getItemDisplayName(nearestItem.item)
    : null,
);
```

only when the nearest in-range item ID changes. Render:

```tsx
{mode === "view" && (
  <MobileControls
    input={playerInputRef}
    nearbyItemTitle={nearbyItemTitle}
  />
)}
```

above the Canvas from `StudioCanvasRoot`.

- [ ] **Step 6: Disable mobile Pointer Lock**

In the pointer-lock effect:

```ts
const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
if (coarsePointer) return;
```

Do not call `requestPointerLock` on mobile. Desktop behavior remains unchanged.

- [ ] **Step 7: Run tests and build**

Run: `npm test -- src/app/modules/metaverse3d/input/playerInput.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/modules/metaverse3d/input src/app/modules/metaverse3d/components/MobileControls.tsx src/app/modules/metaverse3d/components/Player.tsx src/app/modules/metaverse3d/components/ViewCanvas.tsx src/app/modules/metaverse3d/components/CanvasScene.tsx src/app/features/metaverse-studio/canvas/StudioCanvasRoot.tsx
git commit -m "feat: add touch-first gallery controls"
```

### Task 7: Throttle Multiplayer and Optional Systems by Profile

**Files:**
- Modify: `src/app/modules/metaverse3d/components/Multiplayer/MultiplayerBridge.tsx`
- Modify: `src/app/modules/metaverse3d/components/Multiplayer/RemotePlayers.tsx`
- Modify: `src/app/modules/metaverse3d/components/AgentSystem.tsx`
- Create: `src/app/modules/metaverse3d/components/Multiplayer/MultiplayerBridge.test.tsx`

- [ ] **Step 1: Add the failing interval test**

Extend `MultiplayerBridge.test.tsx`:

```tsx
it("uses the current profile interval for view movement", () => {
  vi.useFakeTimers();
  mockUseRenderPerformanceProfile.mockReturnValue({
    ...balancedProfile,
    multiplayerMoveIntervalMs: 160,
  });

  render(<MultiplayerBridge />);
  act(() => vi.advanceTimersByTime(480));

  expect(emitPlayerMove).toHaveBeenCalledTimes(3);
  vi.useRealTimers();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/app/modules/metaverse3d/components/Multiplayer/MultiplayerBridge.test.tsx`

Expected: FAIL because the bridge is hard-coded to `80ms`.

- [ ] **Step 3: Use profile network settings**

In `MultiplayerBridge`:

```ts
const performanceProfile = useRenderPerformanceProfile();
```

Replace the `80` interval with:

```ts
performanceProfile.multiplayerMoveIntervalMs
```

Include it in the effect dependency list.

- [ ] **Step 4: Throttle remote interpolation**

In `RemotePlayers`, accumulate delta and call `tickInterpolation` only when:

```ts
accumulatorRef.current >= 1 / performanceProfile.remoteInterpolationFps
```

Reset the accumulator after each interpolation update. Return `null` immediately when `enableRemotePlayers` is false.

- [ ] **Step 5: Skip optional agent work while obscured**

Pass `allowMotion` into `AgentSystem` and its behavior hook. The behavior hook must return before pathfinding, distance checks, and response requests when false. Do not unmount the agent and lose its state.

- [ ] **Step 6: Run focused tests**

Run: `npm test -- src/app/modules/metaverse3d/components/Multiplayer/MultiplayerBridge.test.tsx`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/modules/metaverse3d/components/Multiplayer src/app/modules/metaverse3d/components/AgentSystem.tsx src/app/modules/metaverse3d/agent/useAgentBehavior.ts
git commit -m "perf: throttle optional realtime systems"
```

### Task 8: Add Route Fallbacks and Pause Decorative Animations

**Files:**
- Create: `src/app/components/RouteLoadingFallback.tsx`
- Create: `src/app/components/RouteLoadingFallback.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/components/Gallery3D.tsx`
- Modify: `src/app/components/GrowthGalleryPreview.tsx`
- Modify: `src/app/components/Layout.tsx`

- [ ] **Step 1: Write the failing route-fallback test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RouteLoadingFallback } from "./RouteLoadingFallback";

describe("RouteLoadingFallback", () => {
  it("exposes a non-empty loading status", () => {
    render(<RouteLoadingFallback />);
    expect(screen.getByRole("status")).toHaveTextContent("載入頁面");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/app/components/RouteLoadingFallback.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the route loading skeleton**

```tsx
export function RouteLoadingFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto flex min-h-[50vh] w-full max-w-6xl items-center px-4 py-12"
    >
      <div className="w-full animate-pulse space-y-5">
        <div className="h-4 w-24 rounded-full bg-stone-200 dark:bg-stone-800" />
        <div className="h-10 w-2/3 rounded-2xl bg-stone-200 dark:bg-stone-800" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-40 rounded-3xl bg-stone-100 dark:bg-stone-900"
            />
          ))}
        </div>
        <span className="sr-only">載入頁面</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Apply RouterProvider fallback**

In `App.tsx`:

```tsx
<RouterProvider
  router={router}
  fallbackElement={<RouteLoadingFallback />}
/>
```

- [ ] **Step 5: Pause decorative RAF loops**

In `Gallery3D` and `MiniGallery3D`:

- Check `document.visibilityState`.
- Check `matchMedia("(prefers-reduced-motion: reduce)")`.
- Stop RAF while hidden or reduced motion is active.
- Restart after `visibilitychange` only when animation is allowed.

In `GrowthGalleryPreview`:

- Set Canvas DPR to `[0.75, 1]` on coarse-pointer devices and `[1, 1.25]` otherwise.
- Use `frameloop={document.visibilityState === "hidden" ? "demand" : "always"}` through a small visibility hook.
- Add `loading="lazy"` behavior to any HTML media added around the preview.

- [ ] **Step 6: Reduce expensive page transition effects on mobile**

In `Layout.tsx`, use `useReducedMotion()` from `motion/react` and coarse-pointer detection. Use opacity-only transitions when either condition is true; keep the existing blur/translate transition on desktop.

- [ ] **Step 7: Run tests and build**

Run: `npm test -- src/app/components/RouteLoadingFallback.test.tsx`

Expected: PASS.

Run: `npm run build`

Expected: PASS and route chunks remain split in Vite output.

- [ ] **Step 8: Commit**

```bash
git add src/app/components/RouteLoadingFallback.tsx src/app/components/RouteLoadingFallback.test.tsx src/app/App.tsx src/app/components/Gallery3D.tsx src/app/components/GrowthGalleryPreview.tsx src/app/components/Layout.tsx
git commit -m "perf: improve site loading and idle animations"
```

### Task 9: Add WebGL Recovery, Diagnostics, and End-to-End Verification

**Files:**
- Create: `src/app/modules/metaverse3d/components/WebGLRecoveryOverlay.tsx`
- Create: `src/app/modules/metaverse3d/components/WebGLRecoveryOverlay.test.tsx`
- Modify: `src/app/modules/metaverse3d/components/CanvasScene.tsx`
- Modify: `src/app/modules/metaverse3d/components/UI/PerformanceModeControl.tsx`
- Modify: `docs/optimize-points.markdown`

- [ ] **Step 1: Write the failing recovery UI test**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WebGLRecoveryOverlay } from "./WebGLRecoveryOverlay";

describe("WebGLRecoveryOverlay", () => {
  it("offers a scene reload after context loss", () => {
    const onReload = vi.fn();
    render(<WebGLRecoveryOverlay onReload={onReload} />);
    fireEvent.click(screen.getByRole("button", { name: "重新載入展覽" }));
    expect(onReload).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/app/modules/metaverse3d/components/WebGLRecoveryOverlay.test.tsx`

Expected: FAIL because the overlay does not exist.

- [ ] **Step 3: Implement context-loss recovery**

Create an overlay with:

- Heading: `3D 畫面暫時中斷`
- Body: `裝置已停止目前的繪圖工作。你可以重新載入展覽，作品資料不會被刪除。`
- Button: `重新載入展覽`
- Minimum 44px button height.

In `CanvasScene`, attach `webglcontextlost` and `webglcontextrestored` listeners to the actual canvas. Call `event.preventDefault()` on loss, show the overlay, and clear it after restoration. The reload button should increment a local Canvas key, not reload the whole browser page.

- [ ] **Step 4: Show concise auto-quality diagnostics**

In development only, show a title/tooltip on the automatic mode containing:

```ts
`${profile.effectiveMode} · ${Math.round(metrics.averageFps)} FPS · DPR ${currentDpr}`
```

In production, only show `自動：流暢／平衡／畫質`. Do not expose a permanent FPS panel to visitors.

- [ ] **Step 5: Document manual device verification**

Append a checklist to `docs/optimize-points.markdown`:

```md
## 行動效能驗收

- iPhone Safari：冷啟動、背景恢復、旋轉螢幕、開關作品詳情。
- Android Chrome：冷啟動、背景恢復、旋轉螢幕、開關作品詳情。
- 典型展館：連續移動 3 分鐘，記錄平均 FPS、低百分位 FPS、長幀比例、DPR 與畫質切換原因。
- 複雜展館：確認持續掉幀後逐級降畫質，且 30 秒內不反覆升降。
- 慢速網路：核心場景可先進入，單一貼圖或模型失敗不阻塞。
- AI、語音、留言、多人逐一失敗時，核心移動與作品詳情仍可使用。
```

- [ ] **Step 6: Run the complete verification suite**

Run: `npm run check`

Expected:

- Server syntax check passes.
- All Vitest tests pass.
- Vite production build passes.

Run: `git diff --check`

Expected: no whitespace errors in files changed by this plan. Existing unrelated whitespace warnings may be reported separately and must not be rewritten as part of this work.

- [ ] **Step 7: Verify in the in-app browser**

Run the development client and API server. Open:

- `/`
- `/exhibitions`
- One valid `/exhibitions/:exhibitionId`
- `/virtual-gallery/create`
- `/growth-memories/3d/:exhibitId` when fixture data exists

Test desktop keyboard/Pointer Lock and mobile emulation touch controls. Verify progressive entry, manual quality override, auto downgrade, detail-modal pause/resume, background/foreground recovery, and context-loss fallback.

- [ ] **Step 8: Commit**

```bash
git add src/app/modules/metaverse3d/components/WebGLRecoveryOverlay.tsx src/app/modules/metaverse3d/components/WebGLRecoveryOverlay.test.tsx src/app/modules/metaverse3d/components/CanvasScene.tsx src/app/modules/metaverse3d/components/UI/PerformanceModeControl.tsx docs/optimize-points.markdown
git commit -m "test: verify adaptive mobile performance"
```
