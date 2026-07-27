# 3D Performance and Fallback Batch Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce initial 3D loading cost and keep published exhibitions usable on weak, unsupported, or context-lost devices.

**Architecture:** Keep the full studio behind route and component boundaries, but make public exhibition metadata and a semantic 2D artwork list available without loading the renderer. Use a pure scene-budget analyzer for deterministic warnings, and change manual chunking only when build output proves a reduction or more useful cache boundary. Preserve the existing adaptive-performance store and WebGL recovery boundary.

**Tech Stack:** React 18, Vite/Rollup, React Three Fiber, Three.js, Zustand, Vitest.

---

### Task 1: Bundle composition and chunk boundaries

**Files:**
- Inspect/Modify: `config/manualChunks.ts`
- Modify if justified: renderer/physics import boundaries under `src/app/modules/metaverse3d/`
- Test: `config/manualChunks.test.ts`

**Steps:**
1. Record the current total JS, largest chunk, `VirtualGalleryCreate`, `ExhibitionView`, and renderer chunk sizes.
2. Trace which imports pull `@react-three/rapier`, Three.js loaders, and editor-only modules into public viewing.
3. Add a failing chunk-routing test for any proposed cache boundary.
4. Implement the smallest evidence-backed split; do not raise bundle limits.
5. Build and retain the change only if total size stays within budget and public-entry loading improves.

### Task 2: Semantic 2D exhibition mode

**Files:**
- Create: `src/app/features/exhibition-2d/Exhibition2DView.tsx`
- Create: `src/app/features/exhibition-2d/sceneToExhibits.ts`
- Test: matching component/helper tests
- Modify: `src/app/pages/ExhibitionView.tsx`

**Steps:**
1. Parse a sanitized scene snapshot into an ordered list of title, artist, description, image/video thumbnail, and accessible text.
2. Render a keyboard and screen-reader-friendly responsive list with lazy images and reserved aspect ratio.
3. Detect missing WebGL before loading `MetaverseStudioApp`; default to 2D when unavailable.
4. Add an explicit 2D/3D switch so motion-sensitive or low-power users can choose 2D even when WebGL works.
5. Ensure selecting 2D does not import the 3D chunk.

### Task 3: Scene material budget analyzer

**Files:**
- Create: `src/app/modules/metaverse3d/performance/sceneBudget.ts`
- Test: `src/app/modules/metaverse3d/performance/sceneBudget.test.ts`
- Modify: `src/app/pages/VirtualGalleryCreate.tsx` or a focused wizard preview component.

**Steps:**
1. Define conservative warning thresholds for item count, unique image/video/model URLs, lights, floor-plan elements, and estimated texture pressure.
2. Return structured `info`/`warning`/`critical` issues from a pure analyzer; do not block saving.
3. Show a compact warning before preview/publish with actionable reductions.
4. Add tests for normal, warning, and critical scenes.

### Task 4: Renderer/context recovery improvements

**Files:**
- Modify: `src/app/modules/metaverse3d/components/WebGLRecoveryOverlay.tsx`
- Modify: `src/app/modules/metaverse3d/components/WebGLCanvasBoundary.tsx`
- Test: their existing tests

**Steps:**
1. Add an `onUse2D` recovery action without removing reload.
2. Propagate context-loss recovery to public ExhibitionView so visitors can switch to 2D rather than loop on reload.
3. Keep editor recovery unchanged when no 2D handler is supplied.

### Task 5: Validation

**Steps:**
1. Run focused tests and typecheck.
2. Run production build and compare chunk measurements with the recorded baseline.
3. Run `npm run check` and `git diff --check`.
4. Report device/browser testing not covered by automated jsdom tests.
