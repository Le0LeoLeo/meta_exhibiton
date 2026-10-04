# 3D Gallery Realism Phase 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the first-pass PBR gallery into a credible occupied exhibition space by replacing warehouse-like illumination, reducing floor glare, enriching the ceiling, varying wall UVs, and curating the default sightline.

**Architecture:** Extend the existing `GallerySurfaceMaterial`, `GalleryLighting`, and room topology without adding a second scene system. Keep one shadow-casting hero light, use a small number of non-shadow area lights, and keep all new detail quality-gated through the existing render profile.

**Tech Stack:** React 18, TypeScript, React Three Fiber, Three.js 0.183, Drei, Vitest, Playwright CLI.

---

## Acceptance criteria

- The default wood floor no longer produces a blown-out mirror-like white patch.
- The ceiling contains visible rails, fixtures, panel joints, and a restrained PBR response.
- Quality mode uses no more than three non-shadow area lights plus one shadow hero light.
- Balanced mode uses fewer fixtures/lights; performance mode keeps only inexpensive fill/key lighting.
- Adjacent wall segments do not begin at the same texture offset.
- At least three exhibits and one seating/plant scale cue are visible within the first ten seconds from spawn.
- Desktop and 390px visual captures load with zero console errors.
- Targeted tests, typecheck, and build pass.

### Task 1: Control floor reflectance and wall UV repetition

**Files:**

- Modify: `src/app/modules/metaverse3d/materials/galleryMaterialPresets.ts`
- Modify: `src/app/modules/metaverse3d/materials/galleryMaterialPresets.test.ts`
- Modify: `src/app/modules/metaverse3d/components/GallerySurfaceMaterial.tsx`
- Modify: `src/app/modules/metaverse3d/components/GallerySurfaceMaterial.test.tsx`
- Modify: `src/app/modules/metaverse3d/components/Room.tsx`

**Step 1:** Add failing tests for stable per-surface UV offsets and the oak floor's minimum roughness policy.

**Step 2:** Run:

```bash
npm run test -- src/app/modules/metaverse3d/components/GallerySurfaceMaterial.test.tsx src/app/modules/metaverse3d/materials/galleryMaterialPresets.test.ts
```

Expected: FAIL because offset helpers/preset policy do not exist.

**Step 3:** Add `textureOffset?: [number, number]` and `textureRotation?: number` to `GallerySurfaceMaterial`; apply them to every cloned PBR texture after repeat configuration.

**Step 4:** Export a deterministic helper:

```ts
export function getSurfaceTextureTransform(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return {
    offset: [((hash & 255) / 255) * 0.5, (((hash >>> 8) & 255) / 255) * 0.5] as [number, number],
    rotation: ((hash >>> 16) & 1) === 0 ? 0 : Math.PI,
  };
}
```

**Step 5:** Add a preset flag such as `useRoughnessMap`. Set it to `false` for the polished oak preset and render oak with a stable scalar roughness around `0.82–0.88`; keep roughness maps enabled for concrete/plaster.

**Step 6:** Pass the deterministic transform from each wall segment in `Room.tsx`. Keep floors aligned and unrotated.

**Step 7:** Run targeted tests, typecheck, and commit checkpoint.

---

### Task 2: Build a quality-gated gallery ceiling system

**Files:**

- Create: `src/app/modules/metaverse3d/components/GalleryCeiling.tsx`
- Create: `src/app/modules/metaverse3d/components/galleryCeiling.test.ts`
- Modify: `src/app/modules/metaverse3d/components/Room.tsx`

**Step 1:** Write a failing test for `getCeilingFixtureLayout(width, length, mode)` asserting fewer fixtures in balanced/performance modes.

**Step 2:** Implement ceiling geometry with:

- Warm-neutral `MeshStandardMaterial`, roughness at least `0.88`, metalness `0`.
- Shallow 1.2m panel joints or shadow lines.
- Two dark track rails, each 30–40mm thick.
- Small cylindrical or beveled fixture bodies with emissive lens faces.
- Geometry reuse and no collision bodies.

**Step 3:** Replace the plain ceiling mesh in `Room.tsx` with `GalleryCeiling` for view/edit modes. Use the existing room width, length, height, and performance profile.

**Step 4:** Run the ceiling test, typecheck, and build.

---

### Task 3: Replace warehouse highlights with gallery area lighting

**Files:**

- Modify: `src/app/modules/metaverse3d/components/GalleryLighting.tsx`
- Modify: `src/app/modules/metaverse3d/components/galleryLighting.test.ts`
- Modify: `src/app/modules/metaverse3d/components/CanvasScene.tsx`

**Step 1:** Extend tests so quality uses three area lights, balanced uses two, performance uses none, and only the hero light casts shadows.

**Step 2:** Add a reusable `GalleryAreaLight` component backed by `rectAreaLight`. Point each light downward/forward with a ref and `lookAt`.

**Step 3:** Use three warm-neutral area lights around `z = -8, 0, 8` in quality and two in balanced. Keep them non-shadow-casting.

**Step 4:** Reduce the directional hero light until it provides edge definition/shadows without creating a sun streak on the floor. Keep ambient/hemisphere fill low.

**Step 5:** Raise the bloom threshold or reduce bloom strength if fixture lenses create halos on white walls.

**Step 6:** Run lighting/post-processing tests, typecheck, and build.

---

### Task 4: Curate the default spawn sightline

**Files:**

- Create: `src/app/modules/metaverse3d/store/defaultGalleryScene.test.ts`
- Modify: `src/app/modules/metaverse3d/store/defaultGalleryScene.ts`

**Step 1:** Add a failing test asserting that default items include:

- At least three paintings/text exhibits within 12m of spawn.
- At least one bench or pedestal near the central path.
- At least one plant/flower scale cue.
- Artwork centre heights between 1.45m and 1.7m.

**Step 2:** Replace off-axis legacy demo items with a compact, visible arrangement inside the anchored 9m × 50m gallery:

- Two paintings on opposing side walls.
- One focal artwork or text panel on the forward wall/partition.
- One bench offset from the walking line.
- One pedestal/sculpture and one plant.
- Restrained light strips only above hero works.

**Step 3:** Keep the spawn corridor unobstructed with at least 1.2m clear width.

**Step 4:** Run the default-scene test and related store/import tests.

---

### Task 5: Visual and performance validation

**Files:**

- Update: `output/playwright/gallery-realism-desktop.png`
- Update: `output/playwright/gallery-realism-mobile.png`

**Step 1:** Use a temporary Vite visual harness that imports the real `CanvasScene` and default scene; remove the harness after capture.

**Step 2:** Capture 1440×900 quality and 390×844 balanced views.

**Step 3:** Confirm zero console errors and inspect floor highlight, fixture scale, ceiling repetition, wall UV variation, and exhibit visibility.

**Step 4:** Run:

```bash
npm run test -- src/app/modules/metaverse3d
npm run typecheck
npm run build
npm run check:bundle
```

**Step 5:** Record any pre-existing bundle-budget failure separately from functional validation.

