# 3D Gallery Realism Upgrade Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve the gallery from visibly primitive real-time 3D to a convincing architectural visualization while preserving browser performance and the existing editor workflow.

**Architecture:** Keep the existing React Three Fiber scene/store split. Introduce small, testable rendering helpers for camera scale, texture configuration, and quality profiles; then consume them from `CanvasScene`, `Room`, and `ViewCanvas`. Use physically based materials and restrained screen-space effects, with explicit quality fallbacks rather than applying expensive effects unconditionally.

**Tech Stack:** React 18, TypeScript, React Three Fiber, Three.js, Drei, `@react-three/postprocessing`, Vitest, Vite.

---

## Scope and visual target

The first release must fix the strongest synthetic cues without rebuilding the whole gallery:

1. Bring the visitor camera and exhibit placement back to human scale.
2. Replace flat/single-map architectural surfaces with correctly configured PBR texture sets.
3. Add small bevels and architectural trim so edges catch light.
4. Improve key shadows and add quality-gated ambient occlusion.
5. Keep balanced mode usable and preserve a low-cost performance mode.

Out of scope for this release:

- Path tracing or offline rendering.
- Rebuilding every decorative exhibit as a bespoke GLB.
- Dynamic global illumination.
- WebGPU-only rendering features.
- Adding film grain, heavy depth of field, chromatic aberration, or stronger bloom.

## Acceptance criteria

- First-person eye height is between 1.65m and 1.75m.
- Default artwork centre height is visually aligned to approximately 1.55m.
- Floor and wall presets support independent base-color, normal, roughness, and AO maps.
- Color textures use sRGB; data maps remain linear; anisotropic filtering is enabled.
- Floorboards/material patterns have a stable world-scale appearance across different room sizes.
- Major walls, floor boundaries, frames, partitions, and pedestals have visible but subtle edge highlights.
- Quality mode uses high-resolution, tightly bounded hero-light shadows and ambient occlusion.
- Balanced mode retains environment lighting and shadows, but uses reduced AO/shadow resolution.
- Performance mode renders without AO, post-processing, environment maps, or realtime shadows.
- `npm run typecheck`, targeted tests, and `npm run build` pass.
- A before/after capture is produced from the same camera position on desktop and a mobile-sized viewport.

## Asset policy

- Add only CC0 or project-owned PBR textures.
- Record source, author, license, and download date in `public/textures/pbr/ATTRIBUTION.md`.
- Use 2K textures for desktop source assets; create 1K KTX2 variants before shipping if bundle/network budgets require them.
- Do not use the base-color image as a normal, roughness, AO, or bump map.
- Do not commit temporary downloads, PSD files, Blender source files, or uncompressed 4K/8K maps.

---

### Task 1: Establish human-scale camera constants

**Files:**

- Create: `src/app/modules/metaverse3d/sceneScale.ts`
- Create: `src/app/modules/metaverse3d/sceneScale.test.ts`
- Modify: `src/app/modules/metaverse3d/components/Player.tsx:16`
- Modify: `src/app/modules/metaverse3d/components/CanvasScene.tsx:135`

**Step 1: Write the failing scale test**

Create `sceneScale.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  DEFAULT_CAMERA_FOV,
  DEFAULT_EYE_HEIGHT,
  DEFAULT_ARTWORK_CENTER_HEIGHT,
} from "./sceneScale";

describe("scene scale", () => {
  it("uses a natural standing eye height", () => {
    expect(DEFAULT_EYE_HEIGHT).toBeGreaterThanOrEqual(1.65);
    expect(DEFAULT_EYE_HEIGHT).toBeLessThanOrEqual(1.75);
  });

  it("keeps artwork near gallery eye level", () => {
    expect(DEFAULT_ARTWORK_CENTER_HEIGHT).toBeCloseTo(1.55, 2);
  });

  it("uses a restrained architectural field of view", () => {
    expect(DEFAULT_CAMERA_FOV).toBeGreaterThanOrEqual(48);
    expect(DEFAULT_CAMERA_FOV).toBeLessThanOrEqual(55);
  });
});
```

**Step 2: Run the test and verify it fails**

Run:

```bash
npm run test -- src/app/modules/metaverse3d/sceneScale.test.ts
```

Expected: FAIL because `sceneScale.ts` does not exist.

**Step 3: Add the scale constants**

Create `sceneScale.ts`:

```ts
export const DEFAULT_EYE_HEIGHT = 1.7;
export const DEFAULT_ARTWORK_CENTER_HEIGHT = 1.55;
export const DEFAULT_CAMERA_FOV = 52;
export const DEFAULT_CAMERA_NEAR = 0.08;
export const DEFAULT_CAMERA_FAR = 180;
```

Replace the local `EYE_HEIGHT = 2.6` in `Player.tsx` with an import of `DEFAULT_EYE_HEIGHT` and use that constant for initial/reset/frame positions.

In `CanvasScene.tsx`, replace the view camera object with:

```tsx
{
  position: [0, DEFAULT_EYE_HEIGHT, 5],
  fov: DEFAULT_CAMERA_FOV,
  near: DEFAULT_CAMERA_NEAR,
  far: DEFAULT_CAMERA_FAR,
}
```

Do not change the orthographic floor-plan camera.

**Step 4: Run the targeted tests**

Run:

```bash
npm run test -- src/app/modules/metaverse3d/sceneScale.test.ts src/app/modules/metaverse3d/components/CanvasScene.performance.test.ts
```

Expected: PASS.

**Step 5: Manually verify scale**

Open view mode at the default spawn. Confirm that the camera feels like a standing adult, paintings no longer sit below the viewer, and nearby pedestals do not look miniature.

If legacy saved scenes were authored around the former 2.6m eye height, add a one-time scene migration rather than raising the camera again.

**Step 6: Commit**

```bash
git add src/app/modules/metaverse3d/sceneScale.ts src/app/modules/metaverse3d/sceneScale.test.ts src/app/modules/metaverse3d/components/Player.tsx src/app/modules/metaverse3d/components/CanvasScene.tsx
git commit -m "fix: restore human scale to gallery camera" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

---

### Task 2: Add a testable PBR texture configuration layer

**Files:**

- Create: `src/app/modules/metaverse3d/materials/configureTexture.ts`
- Create: `src/app/modules/metaverse3d/materials/configureTexture.test.ts`
- Create: `src/app/modules/metaverse3d/materials/galleryMaterialPresets.ts`
- Create: `public/textures/pbr/ATTRIBUTION.md`
- Add: `public/textures/pbr/oak-floor/{basecolor,normal,roughness,ao}.jpg`
- Add: `public/textures/pbr/plaster-wall/{basecolor,normal,roughness,ao}.jpg`
- Add: `public/textures/pbr/concrete-floor/{basecolor,normal,roughness,ao}.jpg`

**Step 1: Write failing texture configuration tests**

Create `configureTexture.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  LinearSRGBColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
} from "three";
import { configureDataTexture, configureColorTexture } from "./configureTexture";

describe("gallery texture configuration", () => {
  it("configures color maps as repeated sRGB textures", () => {
    const texture = new Texture();
    configureColorTexture(texture, 3, 5, 8);

    expect(texture.colorSpace).toBe(SRGBColorSpace);
    expect(texture.wrapS).toBe(RepeatWrapping);
    expect(texture.wrapT).toBe(RepeatWrapping);
    expect(texture.repeat.toArray()).toEqual([3, 5]);
    expect(texture.anisotropy).toBe(8);
  });

  it("keeps data maps out of sRGB", () => {
    const texture = new Texture();
    configureDataTexture(texture, 2, 2, 4);

    expect(texture.colorSpace).toBe(LinearSRGBColorSpace);
    expect(texture.repeat.toArray()).toEqual([2, 2]);
  });
});
```

If Three.js reports `NoColorSpace` rather than `LinearSRGBColorSpace` for data textures in the installed version, assert and set that exact value consistently.

**Step 2: Run the test and verify it fails**

Run:

```bash
npm run test -- src/app/modules/metaverse3d/materials/configureTexture.test.ts
```

Expected: FAIL because the helper does not exist.

**Step 3: Implement the texture helpers**

Create `configureTexture.ts`:

```ts
import {
  LinearSRGBColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from "three";

function configureShared(
  texture: Texture,
  repeatX: number,
  repeatY: number,
  anisotropy: number,
) {
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = anisotropy;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export function configureColorTexture(
  texture: Texture,
  repeatX: number,
  repeatY: number,
  anisotropy: number,
) {
  texture.colorSpace = SRGBColorSpace;
  return configureShared(texture, repeatX, repeatY, anisotropy);
}

export function configureDataTexture(
  texture: Texture,
  repeatX: number,
  repeatY: number,
  anisotropy: number,
) {
  texture.colorSpace = LinearSRGBColorSpace;
  return configureShared(texture, repeatX, repeatY, anisotropy);
}
```

**Step 4: Define explicit material presets**

Create `galleryMaterialPresets.ts` with serializable data only:

```ts
export type GalleryMaterialPresetId =
  | "oak-floor"
  | "concrete-floor"
  | "plaster-wall";

export interface GalleryMaterialPreset {
  basePath: string;
  metersPerTile: [number, number];
  roughness: number;
  metalness: number;
  normalScale: number;
  aoIntensity: number;
  envMapIntensity: number;
}

export const GALLERY_MATERIAL_PRESETS: Record<
  GalleryMaterialPresetId,
  GalleryMaterialPreset
> = {
  "oak-floor": {
    basePath: "/textures/pbr/oak-floor",
    metersPerTile: [2.4, 2.4],
    roughness: 0.62,
    metalness: 0,
    normalScale: 0.45,
    aoIntensity: 0.7,
    envMapIntensity: 0.65,
  },
  "concrete-floor": {
    basePath: "/textures/pbr/concrete-floor",
    metersPerTile: [2, 2],
    roughness: 0.78,
    metalness: 0,
    normalScale: 0.35,
    aoIntensity: 0.55,
    envMapIntensity: 0.45,
  },
  "plaster-wall": {
    basePath: "/textures/pbr/plaster-wall",
    metersPerTile: [2.5, 2.5],
    roughness: 0.88,
    metalness: 0,
    normalScale: 0.2,
    aoIntensity: 0.35,
    envMapIntensity: 0.3,
  },
};
```

**Step 5: Add and document texture assets**

Each preset directory must contain exactly:

```text
basecolor.jpg
normal.jpg
roughness.jpg
ao.jpg
```

Add a row per asset set to `ATTRIBUTION.md`:

```markdown
| Preset | Source URL | Author | License | Downloaded |
| --- | --- | --- | --- | --- |
| oak-floor | ... | ... | CC0 | 2026-07-16 |
```

**Step 6: Run the test and typecheck**

Run:

```bash
npm run test -- src/app/modules/metaverse3d/materials/configureTexture.test.ts
npm run typecheck
```

Expected: PASS.

**Step 7: Commit**

```bash
git add src/app/modules/metaverse3d/materials public/textures/pbr
git commit -m "feat: add gallery PBR material pipeline" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

---

### Task 3: Apply PBR presets to room surfaces

**Files:**

- Create: `src/app/modules/metaverse3d/components/GallerySurfaceMaterial.tsx`
- Create: `src/app/modules/metaverse3d/components/GallerySurfaceMaterial.test.tsx`
- Modify: `src/app/modules/metaverse3d/components/Room.tsx:573-611`
- Modify: `src/app/modules/metaverse3d/components/Room.tsx:726-769`
- Modify: `src/app/modules/metaverse3d/components/Room.tsx:831-911`
- Modify: `src/app/modules/metaverse3d/store/defaultGalleryScene.ts:1`

**Step 1: Write a failing preset-resolution test**

Test the pure preset-selection and repeat calculation rather than mounting WebGL:

```ts
import { describe, expect, it } from "vitest";
import { calculateSurfaceRepeat } from "./GallerySurfaceMaterial";

describe("calculateSurfaceRepeat", () => {
  it("keeps material scale stable as room size changes", () => {
    expect(calculateSurfaceRepeat(10, 8, [2, 2])).toEqual([5, 4]);
    expect(calculateSurfaceRepeat(20, 8, [2, 2])).toEqual([10, 4]);
  });
});
```

**Step 2: Run the test and verify it fails**

Run:

```bash
npm run test -- src/app/modules/metaverse3d/components/GallerySurfaceMaterial.test.tsx
```

Expected: FAIL because the component/helper does not exist.

**Step 3: Implement `GallerySurfaceMaterial`**

The component must:

- Load `basecolor.jpg`, `normal.jpg`, `roughness.jpg`, and `ao.jpg` with `useTexture`.
- Read `gl.capabilities.getMaxAnisotropy()` with `useThree`.
- Clone textures before changing repeat values so wall segments do not mutate one shared texture instance.
- Configure the base-color map with `configureColorTexture`.
- Configure normal/roughness/AO with `configureDataTexture`.
- Calculate repeat from surface world width/height and `metersPerTile`.
- Render `meshStandardMaterial`; use `meshPhysicalMaterial` only for actual glass or clear-coated surfaces.
- Set `metalness={0}` for wood, plaster, concrete, fabric, ceramic, and painted walls.
- Keep normal intensity subtle; do not use displacement on walls/floors in the first release.

Export this pure helper:

```ts
export function calculateSurfaceRepeat(
  worldWidth: number,
  worldHeight: number,
  metersPerTile: [number, number],
): [number, number] {
  return [
    Math.max(1, worldWidth / metersPerTile[0]),
    Math.max(1, worldHeight / metersPerTile[1]),
  ];
}
```

Remember that `aoMap` requires a valid second UV channel. For generated box geometry, verify `uv1`/`uv2` expectations against Three.js 0.183 and copy the primary UV attribute only if the installed API still requires it.

**Step 4: Replace floor and wall materials**

In `Room.tsx`:

- Replace the shared `textureMap` mutation loop.
- Render `GallerySurfaceMaterial preset="oak-floor"` for the default floor.
- Render `GallerySurfaceMaterial preset="plaster-wall"` for default painted walls.
- Preserve custom uploaded texture behavior as a legacy fallback.
- Stop using a color/base map as `bumpMap`.
- Keep the existing glass branch separate; do not run glass through opaque PBR presets.

Change the default gallery data so material intent is internally consistent. Do not specify `wall-wood.svg` while declaring the wall preset as paint. Use explicit PBR preset IDs or the plaster-wall file set.

**Step 5: Run focused tests**

Run:

```bash
npm run test -- src/app/modules/metaverse3d/components/GallerySurfaceMaterial.test.tsx src/app/modules/metaverse3d/components/CanvasScene.performance.test.ts
npm run typecheck
```

Expected: PASS.

**Step 6: Visually inspect texture scale**

Verify:

- No stretched floorboards.
- No visible texture seam at the default spawn.
- The same preset looks the same physical size in small and large rooms.
- Wall normal detail is visible only under grazing light.
- Wood and concrete do not produce metallic reflections.

**Step 7: Commit**

```bash
git add src/app/modules/metaverse3d/components/GallerySurfaceMaterial.tsx src/app/modules/metaverse3d/components/GallerySurfaceMaterial.test.tsx src/app/modules/metaverse3d/components/Room.tsx src/app/modules/metaverse3d/store/defaultGalleryScene.ts
git commit -m "feat: apply physical materials to gallery architecture" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

---

### Task 4: Add bevels and architectural scale cues

**Files:**

- Create: `src/app/modules/metaverse3d/components/geometry/BeveledBox.tsx`
- Create: `src/app/modules/metaverse3d/components/geometry/beveledBoxGeometry.ts`
- Create: `src/app/modules/metaverse3d/components/geometry/beveledBoxGeometry.test.ts`
- Create: `src/app/modules/metaverse3d/components/ArchitecturalTrim.tsx`
- Modify: `src/app/modules/metaverse3d/components/Room.tsx`
- Modify: `src/app/features/metaverse-studio/exhibits/ExhibitItem.tsx`

**Step 1: Write a failing bevel normalization test**

Create a pure helper test:

```ts
import { describe, expect, it } from "vitest";
import { normalizeBevelSize } from "./beveledBoxGeometry";

describe("normalizeBevelSize", () => {
  it("caps bevels below half the smallest dimension", () => {
    expect(normalizeBevelSize([1, 0.1, 2], 0.08)).toBeLessThan(0.05);
  });

  it("preserves a subtle architectural bevel", () => {
    expect(normalizeBevelSize([2, 1, 1], 0.012)).toBeCloseTo(0.012);
  });
});
```

**Step 2: Run the test and verify it fails**

Run:

```bash
npm run test -- src/app/modules/metaverse3d/components/geometry/beveledBoxGeometry.test.ts
```

Expected: FAIL.

**Step 3: Implement reusable beveled geometry**

Use `RoundedBoxGeometry` from `three-stdlib` or Drei's `RoundedBox`, but isolate creation behind `BeveledBox` so geometry/material reuse remains possible.

Requirements:

- Default bevel radius: `0.008m` for frames and small props.
- Architectural trim/beams: `0.012m`.
- Pedestals and benches: `0.015–0.025m`.
- Maximum 2–3 bevel segments.
- Clamp bevel radius using `normalizeBevelSize`.
- Memoize geometry by dimensions/radius/segments and dispose it when no longer used.

**Step 4: Apply bevels only where they matter**

Replace sharp boxes on:

- Painting frames.
- Pedestals.
- Benches.
- Partitions.
- Columns.
- Exposed floor edges and door/window trim.

Do not bevel hidden collision geometry or invisible selection meshes.

**Step 5: Add architectural trim**

`ArchitecturalTrim.tsx` should add inexpensive scale cues:

- 80mm high, 12mm deep baseboard along visible wall segments.
- Optional 30–40mm ceiling shadow gap.
- Door reveal/trim where openings exist.

Use the wall topology already produced in `Room.tsx`; do not create a second room-layout system.

**Step 6: Run tests and inspect draw calls**

Run:

```bash
npm run test -- src/app/modules/metaverse3d/components/geometry/beveledBoxGeometry.test.ts
npm run typecheck
```

During manual inspection, compare `gl.info.render.calls` before and after. Reuse geometry/materials or instance repeated trim if draw calls increase by more than 20% in the default scene.

**Step 7: Commit**

```bash
git add src/app/modules/metaverse3d/components/geometry src/app/modules/metaverse3d/components/ArchitecturalTrim.tsx src/app/modules/metaverse3d/components/Room.tsx src/app/features/metaverse-studio/exhibits/ExhibitItem.tsx
git commit -m "feat: add realistic bevels and gallery trim" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

---

### Task 5: Upgrade lighting and shadow quality by performance tier

**Files:**

- Modify: `src/app/modules/metaverse3d/performanceProfile.ts`
- Modify: `src/app/modules/metaverse3d/performanceProfile.test.ts`
- Create: `src/app/modules/metaverse3d/components/GalleryLighting.tsx`
- Create: `src/app/modules/metaverse3d/components/galleryLighting.test.ts`
- Modify: `src/app/modules/metaverse3d/components/CanvasScene.tsx:120-145`

**Step 1: Extend failing profile expectations**

Update `performanceProfile.test.ts` to assert:

```ts
expect(quality.shadowMapSize).toBe(2048);
expect(quality.enableAmbientOcclusion).toBe(true);
expect(quality.ambientOcclusionQuality).toBe("high");

expect(balanced.shadowMapSize).toBe(1024);
expect(balanced.enableAmbientOcclusion).toBe(true);
expect(balanced.ambientOcclusionQuality).toBe("low");

expect(performance.enableShadows).toBe(false);
expect(performance.enableAmbientOcclusion).toBe(false);
```

**Step 2: Run the tests and verify they fail**

Run:

```bash
npm run test -- src/app/modules/metaverse3d/performanceProfile.test.ts
```

Expected: FAIL because AO fields do not exist and current shadow sizes are 512/384/256.

**Step 3: Extend `RenderPerformanceProfile`**

Add:

```ts
enableAmbientOcclusion: boolean;
ambientOcclusionQuality: "off" | "low" | "high";
```

Use these values:

| Mode | DPR | Hero shadow | AO | Accent shadow lights |
| --- | ---: | ---: | --- | ---: |
| Quality | `[1, 1.5]` | 2048 | high | 1 |
| Balanced | `[0.9, 1.2]` | 1024 | low | 0 |
| Performance | `[0.75, 1]` | off | off | 0 |

Use one shadow-casting hero light. Other lights may illuminate but must not cast realtime shadows.

**Step 4: Extract `GalleryLighting`**

Move non-floor-plan lights out of `CanvasScene.tsx` into `GalleryLighting.tsx`.

Lighting target:

- HDR environment provides broad indirect illumination.
- One warm-neutral directional or spot key light casts shadows.
- Exhibition accent lights use non-shadow-casting spots/rect area lights.
- Ambient light remains very low; do not flatten the PBR response.
- Do not let the hidden warehouse HDR dominate reflections on plaster.

Configure the key shadow explicitly:

```tsx
<directionalLight
  castShadow={profile.enableShadows}
  position={[7, 11, 5]}
  intensity={1.8 * environmentBrightness}
  shadow-mapSize={[profile.shadowMapSize, profile.shadowMapSize]}
  shadow-camera-near={0.5}
  shadow-camera-far={45}
  shadow-camera-left={-18}
  shadow-camera-right={18}
  shadow-camera-top={18}
  shadow-camera-bottom={-18}
  shadow-bias={-0.0001}
  shadow-normalBias={0.025}
/>
```

Tune intensity in the running application because physically correct light units and the HDR preset affect the final exposure. Preserve `ACESFilmicToneMapping`; keep exposure between `0.9` and `1.15`.

**Step 5: Run tests**

Run:

```bash
npm run test -- src/app/modules/metaverse3d/performanceProfile.test.ts src/app/modules/metaverse3d/components/CanvasScene.performance.test.ts src/app/modules/metaverse3d/components/galleryLighting.test.ts
npm run typecheck
```

Expected: PASS.

**Step 6: Inspect shadows**

Verify at the default spawn and at the far end of the gallery:

- No severe shadow acne.
- No detached/peter-panning shadows under pedestals.
- Shadow edges are not pixelated in quality mode.
- Balanced mode remains readable.
- Performance mode contains no black unlit PBR surfaces.

**Step 7: Commit**

```bash
git add src/app/modules/metaverse3d/performanceProfile.ts src/app/modules/metaverse3d/performanceProfile.test.ts src/app/modules/metaverse3d/components/GalleryLighting.tsx src/app/modules/metaverse3d/components/galleryLighting.test.ts src/app/modules/metaverse3d/components/CanvasScene.tsx
git commit -m "feat: improve gallery lighting and shadow tiers" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

---

### Task 6: Add restrained ambient occlusion and anti-aliasing

**Files:**

- Create: `src/app/modules/metaverse3d/components/GalleryPostprocessing.tsx`
- Create: `src/app/modules/metaverse3d/components/GalleryPostprocessing.test.tsx`
- Modify: `src/app/modules/metaverse3d/components/ViewCanvas.tsx:1-55`

**Step 1: Write a failing post-processing configuration test**

Keep quality selection pure:

```ts
import { describe, expect, it } from "vitest";
import { getAmbientOcclusionSettings } from "./GalleryPostprocessing";

describe("ambient occlusion settings", () => {
  it("uses subtle high-quality AO", () => {
    expect(getAmbientOcclusionSettings("high")).toMatchObject({
      enabled: true,
      intensity: 0.65,
    });
  });

  it("fully disables AO in off mode", () => {
    expect(getAmbientOcclusionSettings("off").enabled).toBe(false);
  });
});
```

**Step 2: Run the test and verify it fails**

Run:

```bash
npm run test -- src/app/modules/metaverse3d/components/GalleryPostprocessing.test.tsx
```

Expected: FAIL.

**Step 3: Implement restrained post-processing**

Use `N8AO` if it is supported by the installed `@react-three/postprocessing` version. Otherwise use the package's supported SSAO component without upgrading dependencies in the same task.

Recommended starting point:

```tsx
<EffectComposer multisampling={0} enableNormalPass>
  <N8AO
    aoRadius={quality === "high" ? 1.2 : 0.7}
    intensity={quality === "high" ? 0.65 : 0.4}
    distanceFalloff={1}
    quality={quality === "high" ? "medium" : "performance"}
    color="black"
  />
  <Bloom
    intensity={0.05}
    luminanceThreshold={1.05}
    luminanceSmoothing={0.15}
    mipmapBlur
  />
  <Vignette eskil={false} offset={0.25} darkness={0.18} />
</EffectComposer>
```

If the exact prop API differs, follow the installed package's TypeScript types. Do not suppress errors with `any`.

AO must darken contact points and corners, not dirty the entire image. Bloom should affect emissive strips only and must not create halos around white walls.

**Step 4: Replace inline effects in `ViewCanvas`**

Render one `GalleryPostprocessing` component based on `performanceProfile`. Do not mount a composer when both post-processing and AO are disabled.

**Step 5: Run tests and build**

Run:

```bash
npm run test -- src/app/modules/metaverse3d/components/GalleryPostprocessing.test.tsx src/app/modules/metaverse3d/performanceProfile.test.ts
npm run typecheck
npm run build
```

Expected: PASS.

**Step 6: Commit**

```bash
git add src/app/modules/metaverse3d/components/GalleryPostprocessing.tsx src/app/modules/metaverse3d/components/GalleryPostprocessing.test.tsx src/app/modules/metaverse3d/components/ViewCanvas.tsx
git commit -m "feat: add subtle ambient occlusion to gallery view" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

---

### Task 7: Final visual and performance validation

**Files:**

- Create: `docs/visual-validation/gallery-realism-2026-07-16.md`
- Create: `docs/visual-validation/gallery-realism-before-desktop.png`
- Create: `docs/visual-validation/gallery-realism-after-desktop.png`
- Create: `docs/visual-validation/gallery-realism-after-mobile.png`
- Modify if necessary: only files changed by Tasks 1–6

**Step 1: Record a repeatable capture position**

Use the same scene data, viewport, camera position, yaw, pitch, performance mode, and exposure for before/after captures. Record those values in the validation Markdown.

Suggested desktop viewport: `1440x900`. Suggested mobile viewport: `390x844`.

**Step 2: Capture the baseline and final frames**

Capture:

- Default spawn looking toward the main exhibition axis.
- A close view of a pedestal meeting the floor.
- A grazing-angle view along a plaster wall.
- Mobile default spawn in balanced mode.

**Step 3: Validate visual criteria**

Record pass/fail for:

- Human scale.
- Material differentiation.
- Texture scale and seams.
- Edge highlights.
- Contact shadows.
- Shadow acne/peter-panning.
- Bloom restraint.
- Mobile readability.

**Step 4: Validate performance**

Use the existing frame performance monitor and record average FPS and low-percentile FPS after a 30-second walk through the default scene.

Targets:

- Desktop quality: average >= 55 FPS, low percentile >= 42 FPS on the reference machine.
- Desktop balanced: average >= 58 FPS, low percentile >= 48 FPS.
- Mobile balanced: average >= 30 FPS.
- No WebGL context loss and no sustained long-frame ratio above 12%.

If quality misses target, reduce AO resolution/radius before reducing material quality. If balanced misses target, disable AO in balanced mode before removing environment lighting.

**Step 5: Run full validation**

Run from `web_ui_new/`:

```bash
npm run check
```

Expected: server syntax, typecheck, lint, tests, build, and bundle budget all PASS.

**Step 6: Review the diff for runtime data**

Run:

```bash
git status --short
git diff --check
```

Confirm no `.env`, database, upload, temporary capture, or dev-server log files are staged.

**Step 7: Commit validation artifacts**

```bash
git add docs/visual-validation
git commit -m "docs: validate gallery realism upgrade" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

---

## Phase 2 backlog

Only begin after the first release passes visual and performance acceptance:

1. Replace primitive plants, benches, chandeliers, and sculptures with optimized GLB assets.
2. Add KTX2/Basis texture compression and Draco/Meshopt model compression.
3. Add baked lightmaps for static architecture.
4. Add reflection probes for glass/metal hero objects.
5. Add LOD or instancing for repeated decorative props.
6. Add scene-specific lighting presets rather than one warehouse HDR for every gallery.
7. Add a visual quality debug panel for exposure, AO, environment intensity, and shadow bounds in development only.

## Rollback strategy

- Every visual feature is controlled through the existing performance profile.
- Performance mode remains the safe fallback with no environment, realtime shadows, AO, or composer.
- Keep legacy custom-color/custom-upload material support while PBR presets are introduced.
- If a new texture fails to load, render a neutral `MeshStandardMaterial` fallback rather than suspending the entire room.
- Keep scale migration separate from rendering upgrades so legacy-scene compatibility can be reverted independently.

