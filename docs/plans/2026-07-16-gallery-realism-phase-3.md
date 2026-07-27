# 3D Gallery Realism Phase 3 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move the gallery from a clean real-time render toward believable architectural visualization through artwork-directed lighting, restrained wall finishes, small-scale building services, and calibrated color finishing.

**Architecture:** Extend the existing quality-gated `GalleryLighting`, `GalleryCeiling`, `GallerySurfaceMaterial`, and `GalleryPostprocessing` systems. Derive a bounded set of light targets from scene items, keep static detail instanced where possible, and preserve performance/balanced/quality fallbacks.

**Tech Stack:** React 18, TypeScript, React Three Fiber, Three.js 0.183, Drei, react-three/postprocessing, Vitest, Playwright CLI.

---

## Acceptance criteria

- Quality mode aims up to four soft spotlights at visible paintings/text works; balanced uses two and performance uses none.
- Artwork spots use high penumbra, inverse-square decay, bounded distance, and never cast shadows.
- Default walls read as warm matte exhibition plaster rather than continuous raw concrete.
- Feature-wall tinting is deterministic and subtle, without overriding user-supplied wall colors or textures.
- Quality ceiling adds sparse vents, sprinklers, and sensors; balanced uses fewer details and performance uses none.
- Post-processing remains restrained: stable AO, low bloom, subtle warm color balance, and no gameplay-obscuring depth of field.
- Desktop 1440x900 and mobile 390x844 captures load with zero console errors.
- Targeted tests, typecheck, and production build pass.

### Task 1: Artwork-directed lighting

**Files:**

- Create: `src/app/modules/metaverse3d/components/GalleryArtworkLighting.tsx`
- Create: `src/app/modules/metaverse3d/components/galleryArtworkLighting.test.ts`
- Modify: `src/app/modules/metaverse3d/components/CanvasScene.tsx`

**Step 1:** Write tests for `getArtworkLightTargets(items, mode)`: quality returns at most four targets, balanced at most two, performance none, and non-artwork types are ignored.

**Step 2:** Run the focused test and confirm it fails before implementation.

**Step 3:** Rank paintings and text panels by distance from spawn. Derive a ceiling light position from each artwork position and wall rotation, with target height clamped to 1.35-1.85m.

**Step 4:** Render warm-neutral `spotLight` elements with angle about 0.32-0.42, penumbra at least 0.78, decay 2, bounded distance, and `castShadow={false}`. Add each target object explicitly to the scene graph.

**Step 5:** Integrate beside `GalleryLighting` only outside floor-plan mode.

**Step 6:** Run focused tests and typecheck.

---

### Task 2: Warm plaster zoning and surface restraint

**Files:**

- Create: `src/app/modules/metaverse3d/materials/galleryWallFinish.ts`
- Create: `src/app/modules/metaverse3d/materials/galleryWallFinish.test.ts`
- Modify: `src/app/modules/metaverse3d/materials/galleryMaterialPresets.ts`
- Modify: `src/app/modules/metaverse3d/materials/galleryMaterialPresets.test.ts`
- Modify: `src/app/modules/metaverse3d/components/Room.tsx`

**Step 1:** Test a deterministic `getGalleryWallFinish(segmentId, baseColor, allowFeatureTint)` helper.

**Step 2:** Ensure the helper produces a warm off-white base and only a small percentage of low-saturation feature tints. Selection/hover and explicit custom wall styling must win.

**Step 3:** Reduce plaster normal strength and environment intensity; retain high roughness and zero metalness.

**Step 4:** Apply finish colors in view mode only when the wall is using the built-in plaster/paint path. Do not alter uploaded textures, data/blob URLs, glass, or explicit per-wall overrides.

**Step 5:** Run material and Room-related tests plus typecheck.

---

### Task 3: Sparse ceiling services and micro-detail

**Files:**

- Modify: `src/app/modules/metaverse3d/components/GalleryCeiling.tsx`
- Modify: `src/app/modules/metaverse3d/components/galleryCeiling.test.ts`

**Step 1:** Add tests for `getCeilingServiceLayout(width, length, mode)`, asserting quality has sparse vents/sprinklers/sensors, balanced has fewer, and performance has none.

**Step 2:** Implement deterministic layouts with generous spacing and no random calls.

**Step 3:** Render vents as thin beveled boxes, sprinklers as tiny instanced cylinders, and sensors as small circular housings. Reuse geometry and materials through instancing.

**Step 4:** Reduce panel-joint density if services make the ceiling visually busy; keep the rail system dominant.

**Step 5:** Run ceiling tests, typecheck, and build.

---

### Task 4: Restrained architectural image finishing

**Files:**

- Modify: `src/app/modules/metaverse3d/components/GalleryPostprocessing.tsx`
- Modify: `src/app/modules/metaverse3d/components/GalleryPostprocessing.test.tsx`
- Modify: `src/app/modules/metaverse3d/components/CanvasScene.tsx`

**Step 1:** Extract and test `getGalleryPostprocessingSettings(profile)` for AO, bloom, vignette, and color controls.

**Step 2:** Add a subtle `BrightnessContrast` and warm `HueSaturation`/tone adjustment only when post-processing is enabled. Avoid depth of field during navigation.

**Step 3:** Keep bloom threshold above white-wall luminance and vignette darkness below 0.2.

**Step 4:** Tune ACES exposure and fog so distant walls remain readable without flattening contact shadows.

**Step 5:** Run post-processing tests and typecheck.

---

### Task 5: Integration and visual validation

**Files:**

- Update: `output/playwright/gallery-realism-phase3-desktop.png`
- Update: `output/playwright/gallery-realism-phase3-mobile.png`

**Step 1:** Integrate sub-agent changes without overwriting unrelated working-tree edits.

**Step 2:** Use a temporary Vite harness importing the real `CanvasScene`; remove it after capture.

**Step 3:** Capture 1440x900 quality and 390x844 balanced views. Inspect artwork light pools, wall warmth, service scale, clipping, noise, and navigation visibility.

**Step 4:** Run:

```bash
npm run test -- src/app/modules/metaverse3d
npm run typecheck
npm run build
npm run check:bundle
```

**Step 5:** Report bundle-budget results separately from functional validation. Do not create a commit unless the user requests one.
