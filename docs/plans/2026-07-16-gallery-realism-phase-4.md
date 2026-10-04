# 3D Gallery Realism Phase 4 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ground the gallery with believable indirect light, contact shadows, non-uniform floor response, architectural junctions, and restrained human scale cues.

**Architecture:** Build quality-gated, deterministic realism layers around the existing R3F scene instead of introducing a second renderer or costly real-time GI. Use a small indirect-light rig, screen-space/contact shadow support, procedural data textures, shared geometry, and minimal animation that pauses with the existing scene lifecycle.

**Tech Stack:** React 18, TypeScript, React Three Fiber, Drei, Three.js 0.183, react-three/postprocessing, Vitest, Playwright CLI.

---

## Acceptance criteria

- Benches, pedestals, plants, sculptures, and visitor scale cues visually contact the floor instead of floating.
- Quality mode uses subtle warm/cool bounce lights without adding shadow maps; balanced uses fewer and performance uses none.
- Oak floor roughness varies deterministically at low amplitude without visible noise shimmer.
- Architectural trims include floor transition strips and restrained vertical corner/shadow seams.
- Quality includes two neutral low-poly visitor silhouettes, balanced one, performance none.
- Visitor motion is extremely small, deterministic, and disabled when motion is not allowed.
- No extra network-loaded assets or new runtime texture downloads are introduced.
- Desktop quality and mobile balanced captures have zero console errors.
- Metaverse tests, typecheck, and production build pass.

### Task 1: Indirect bounce and contact grounding

**Files:**

- Create: `src/app/modules/metaverse3d/components/GalleryGrounding.tsx`
- Create: `src/app/modules/metaverse3d/components/galleryGrounding.test.ts`
- Modify: `src/app/modules/metaverse3d/components/ViewCanvas.tsx`

**Step 1:** Test `getGalleryGroundingSettings(mode)` for quality, balanced, and performance tiers.

**Step 2:** Quality should use a low-opacity contact-shadow plane, 512 resolution, two non-shadow bounce lights; balanced should use 256 resolution and one bounce light; performance should disable both.

**Step 3:** Use Drei `ContactShadows` with restrained opacity/radius/blur and a bounded scale around the main room. Keep the plane slightly above the floor to avoid z-fighting.

**Step 4:** Use `rectAreaLight` or low-intensity point/hemisphere sources for warm floor bounce and cool upper-wall return. Never cast shadows.

**Step 5:** Integrate outside `Physics` but inside the view scene, using the existing performance profile.

**Step 6:** Run focused tests and typecheck.

---

### Task 2: Deterministic floor roughness variation

**Files:**

- Create: `src/app/modules/metaverse3d/materials/floorSurfaceVariation.ts`
- Create: `src/app/modules/metaverse3d/materials/floorSurfaceVariation.test.ts`
- Modify: `src/app/modules/metaverse3d/components/GallerySurfaceMaterial.tsx`
- Modify: `src/app/modules/metaverse3d/components/GallerySurfaceMaterial.test.tsx`
- Modify: `src/app/modules/metaverse3d/components/Room.tsx`

**Step 1:** Test a pure `createFloorVariationData(width, height, seed)` helper for deterministic output, bounded values, and non-uniform samples.

**Step 2:** Generate a small repeatable grayscale `DataTexture` (64x64 maximum) with low-frequency plank-scale variation; no `Math.random`.

**Step 3:** Add `surfaceVariation?: "none" | "subtle"` to `GallerySurfaceMaterial`. For oak only, multiply scalar roughness with the procedural map; preserve existing normal/color maps.

**Step 4:** Enable variation for the view-mode oak floor in quality and balanced, disable in performance/edit mode.

**Step 5:** Dispose generated textures on unmount and run focused tests/typecheck.

---

### Task 3: Architectural junction details

**Files:**

- Modify: `src/app/modules/metaverse3d/components/ArchitecturalTrim.tsx`
- Create: `src/app/modules/metaverse3d/components/architecturalTrim.test.ts`

**Step 1:** Test pure layout helpers for vertical seams and door/floor thresholds.

**Step 2:** Add very thin dark vertical shadow seams at selected internal wall junctions only in detailed view mode.

**Step 3:** Add brushed-metal threshold strips at door openings and small floor transition strips where topology changes.

**Step 4:** Reuse pooled materials and beveled geometry; details must not participate in collision.

**Step 5:** Run focused tests and typecheck.

---

### Task 4: Human scale cues with restrained motion

**Files:**

- Create: `src/app/modules/metaverse3d/components/GalleryVisitors.tsx`
- Create: `src/app/modules/metaverse3d/components/galleryVisitors.test.ts`
- Modify: `src/app/modules/metaverse3d/components/ViewCanvas.tsx`

**Step 1:** Test `getGalleryVisitorLayout(mode)` for deterministic positions, central corridor clearance, and 2/1/0 tier counts.

**Step 2:** Build neutral silhouettes from shared capsule/sphere/box geometry with matte textile colors. Avoid facial detail and saturated colors.

**Step 3:** Add tiny breathing/weight-shift motion with `useFrame`; phase offset by visitor id, amplitude below 8mm and rotation below 0.015 radians.

**Step 4:** Respect `allowMotion`; visitor meshes cast shadows only in quality mode.

**Step 5:** Integrate with `ViewCanvas` and run focused tests/typecheck.

---

### Task 5: Integration and visual validation

**Files:**

- Update: `output/playwright/gallery-realism-phase4-desktop.png`
- Update: `output/playwright/gallery-realism-phase4-mobile.png`

**Step 1:** Integrate sub-agent changes without overwriting unrelated worktree edits.

**Step 2:** Use a temporary harness importing the real `CanvasScene`, then remove it.

**Step 3:** Capture desktop 1440x900 quality and mobile 390x844 balanced. Verify contact grounding, visitor scale, floor stability, junction scale, and zero console errors.

**Step 4:** Run:

```bash
npm run test -- src/app/modules/metaverse3d src/app/features/metaverse-studio/exhibits
npm run typecheck
npm run build
npm run check:bundle
```

**Step 5:** Report bundle-budget results separately. Do not create a commit unless requested.
