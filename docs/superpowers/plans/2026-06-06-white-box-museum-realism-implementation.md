# White Box Museum Realism Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade new and default 3D exhibitions into a credible contemporary white-box museum while preserving editing, floor-plan, persistence, multiplayer, and mobile behavior.

**Architecture:** Keep `Room` as the owner of topology and interaction, and add pure helpers plus scene-only modules for materials, environment, architectural trim, and exhibit-directed lighting. Normalize imported scene data at the store boundary so old exhibitions receive compatible defaults without rewriting their source payloads. Drive every visual feature from the existing performance profile so Quality, Balanced, and Low remain explicit and testable.

**Tech Stack:** React 18, TypeScript, Vite, React Three Fiber, Three.js, Drei, Zustand, Vitest, Testing Library, Playwright/browser verification.

---

## File Map

- Create `src/app/auth.test.tsx`: redirect regression coverage.
- Create `src/app/modules/metaverse3d/store/sceneCompatibility.test.ts`: imported-scene/default preservation coverage.
- Create `src/app/modules/metaverse3d/store/sceneCompatibility.ts`: normalize old and new `RoomSize` payloads.
- Create `src/app/modules/metaverse3d/materials/museumMaterials.ts`: texture descriptors, world-scale repeats, color-space setup, and neutral fallbacks.
- Create `src/app/modules/metaverse3d/materials/museumMaterials.test.ts`: pure material calculations.
- Create `src/app/modules/metaverse3d/components/MuseumEnvironment.tsx`: background, tone mapping coordination, and base illumination.
- Create `src/app/modules/metaverse3d/components/ArchitecturalDetails.tsx`: non-interactive skirting, cornice, doorway trim, ceiling recess, and tracks.
- Create `src/app/modules/metaverse3d/lighting/trackLighting.ts`: pure exhibit target and fixture calculation.
- Create `src/app/modules/metaverse3d/lighting/trackLighting.test.ts`: fixture limits and target coverage.
- Create `src/app/modules/metaverse3d/components/TrackLighting.tsx`: track meshes and spotlights.
- Modify `package.json`: add Vitest and test scripts.
- Modify `src/app/auth.tsx`: stable login redirect construction.
- Modify `src/app/pages/ExhibitionView.tsx`: one-shot import/view transition and retry-safe loading.
- Modify `src/app/features/metaverse-studio/store/index.ts`: stable selectors or shallow equality where object selectors remain.
- Modify `src/app/modules/metaverse3d/types.ts`: optional museum style fields.
- Modify `src/app/modules/metaverse3d/store/metaverseStoreUtils.ts`: persistence sanitization and compatibility defaults.
- Modify `src/app/modules/metaverse3d/store/useMetaverseStudioStore.ts`: normalize imports and defaults once.
- Modify `src/app/constants/gallerySceneTemplates.ts`: white-box defaults for newly created scenes.
- Modify `src/app/modules/metaverse3d/components/Room.tsx`: consume museum materials and expose stable topology data to decoration modules.
- Modify `src/app/modules/metaverse3d/components/CanvasScene.tsx`: compose environment, architecture, and track lighting.
- Modify `src/app/modules/metaverse3d/components/ViewCanvas.tsx`: replace bloom/vignette with restrained ambient occlusion/contact treatment.
- Modify `src/app/modules/metaverse3d/performanceProfile.ts`: museum-specific quality flags and limits.
- Modify `src/app/modules/metaverse3d/components/createRenderer.ts`: catch WebGPU initialization failures and fall back to WebGL.
- Modify `src/app/modules/metaverse3d/components/UI/WorkspaceRoomSettingsPanel.tsx`: expose style/floor options without overwriting custom values.
- Modify `ATTRIBUTIONS.md`: record any added CC0 assets.

### Task 1: Add The Test Harness

**Files:**
- Modify: `package.json`
- Create: `src/test/setup.ts`
- Create: `src/app/auth.test.tsx`

- [ ] **Step 1: Add test dependencies and scripts**

Add `vitest`, `jsdom`, `@testing-library/react`, and `@testing-library/jest-dom` as dev dependencies. Add:

```json
"test": "vitest run",
"test:watch": "vitest",
"check": "npm run check:server && npm run test && npm run build"
```

- [ ] **Step 2: Configure Vitest**

Extend `vite.config.ts` with:

```ts
test: {
  environment: "jsdom",
  setupFiles: ["./src/test/setup.ts"],
  restoreMocks: true,
},
```

and import `@testing-library/jest-dom/vitest` from `src/test/setup.ts`.

- [ ] **Step 3: Write the first failing auth test**

Render `RequireAuth` in a memory router at `/virtual-gallery/create?template=blank#editor` with no token and assert that the resulting location is exactly:

```text
/login?returnTo=%2Fvirtual-gallery%2Fcreate%3Ftemplate%3Dblank%23editor
```

Also start at `/login?returnTo=%2Fvirtual-gallery%2Fcreate` and assert that the location does not acquire a nested second `returnTo`.

- [ ] **Step 4: Verify RED**

Run:

```bash
npm test -- src/app/auth.test.tsx
```

Expected: the login-page case fails because `RequireAuth` currently redirects `/login` to another `/login?...`.

- [ ] **Step 5: Commit**

```bash
git add package.json vite.config.ts src/test/setup.ts src/app/auth.test.tsx
git commit -m "test: add frontend regression harness"
```

### Task 2: Fix Redirect And Public Exhibition Update Loops

**Files:**
- Modify: `src/app/auth.tsx`
- Modify: `src/app/pages/ExhibitionView.tsx`
- Modify: `src/app/features/metaverse-studio/store/index.ts`
- Test: `src/app/auth.test.tsx`
- Create: `src/app/pages/ExhibitionView.test.tsx`

- [ ] **Step 1: Implement a stable login destination helper**

Add and export:

```ts
export function createLoginDestination(pathname: string, search: string, hash: string): string {
  if (pathname === "/login") return `${pathname}${search}${hash}`;
  const returnTo = `${pathname}${search}${hash}`;
  return `/login?returnTo=${encodeURIComponent(returnTo)}`;
}
```

Use it from `RequireAuth`; when already on `/login`, render `<Outlet />` instead of another `<Navigate>`.

- [ ] **Step 2: Verify the auth tests pass**

Run:

```bash
npm test -- src/app/auth.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Write a failing public-view import test**

Mock `getPublishedGalleryById`, spy on `useStore.getState().importScene` and `setMode`, render `ExhibitionView`, then rerender with the same exhibition ID. Assert one fetch, one import, and one `setMode("view")`.

- [ ] **Step 4: Verify RED**

Run:

```bash
npm test -- src/app/pages/ExhibitionView.test.tsx
```

Expected: FAIL if the effect is retriggered by an unstable `importScene` selector reference or Strict Mode remount behavior.

- [ ] **Step 5: Make loading idempotent**

Select no action from React for this workflow. Inside the effect, call:

```ts
const store = useStore.getState();
store.importScene(parsed);
store.setMode("view");
```

Track the imported exhibition/scene identity in a module helper or component ref so the same resolved payload is not imported twice. Remove the zero-delay `setTimeout`.

- [ ] **Step 6: Stabilize object selectors**

Change object-returning hooks in `src/app/features/metaverse-studio/store/index.ts` to `useShallow` from `zustand/react/shallow`, or replace them with individual primitive/action selectors. Do not spread `state.agent` inside a selector without shallow equality.

- [ ] **Step 7: Verify**

Run:

```bash
npm test -- src/app/auth.test.tsx src/app/pages/ExhibitionView.test.tsx
npm run build
```

Expected: tests pass and Vite build completes without maximum-depth warnings.

- [ ] **Step 8: Commit**

```bash
git add src/app/auth.tsx src/app/auth.test.tsx src/app/pages/ExhibitionView.tsx src/app/pages/ExhibitionView.test.tsx src/app/features/metaverse-studio/store/index.ts
git commit -m "fix: stabilize public exhibition loading"
```

### Task 3: Add Backward-Compatible White-Box Scene Defaults

**Files:**
- Modify: `src/app/modules/metaverse3d/types.ts`
- Create: `src/app/modules/metaverse3d/store/sceneCompatibility.ts`
- Create: `src/app/modules/metaverse3d/store/sceneCompatibility.test.ts`
- Modify: `src/app/modules/metaverse3d/store/useMetaverseStudioStore.ts`
- Modify: `src/app/modules/metaverse3d/store/metaverseStoreUtils.ts`
- Modify: `src/app/constants/gallerySceneTemplates.ts`

- [ ] **Step 1: Write failing compatibility tests**

Cover these cases:

```ts
expect(normalizeRoomSize({ width: 20, length: 20, height: 6 })).toMatchObject({
  museumStyle: "white-box",
  floorMaterial: "light-oak",
  architecturalDetails: true,
  trackLighting: true,
});
```

Assert that explicit legacy/custom values such as `wallColor`, `floorColor`, `wallOpacity`, `wallTextureUrl`, and `floorTextureUrl` are unchanged.

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- src/app/modules/metaverse3d/store/sceneCompatibility.test.ts
```

Expected: FAIL because normalization and fields do not exist.

- [ ] **Step 3: Add optional scene fields**

Extend `RoomSize` with:

```ts
museumStyle?: "white-box" | "custom";
floorMaterial?: "light-oak" | "microcement" | "custom";
architecturalDetails?: boolean;
trackLighting?: boolean;
```

- [ ] **Step 4: Implement normalization**

Define `WHITE_BOX_ROOM_DEFAULTS` with warm white walls, light oak floor, neutral roughness/metalness, environment brightness, and enabled architecture/lighting. `normalizeRoomSize` must fill only missing keys:

```ts
return { ...WHITE_BOX_ROOM_DEFAULTS, ...input } as RoomSize;
```

Use the normalizer during initial state creation and `importScene`, not by mutating parsed API data.

- [ ] **Step 5: Update new-scene templates**

Change `createBaseRoom` to use the white-box defaults. Existing themed templates may explicitly set `museumStyle: "custom"` so their intentional colors survive.

- [ ] **Step 6: Verify**

Run:

```bash
npm test -- src/app/modules/metaverse3d/store/sceneCompatibility.test.ts
npm run build
```

Expected: PASS and no persistence type errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/modules/metaverse3d/types.ts src/app/modules/metaverse3d/store/sceneCompatibility.ts src/app/modules/metaverse3d/store/sceneCompatibility.test.ts src/app/modules/metaverse3d/store/useMetaverseStudioStore.ts src/app/modules/metaverse3d/store/metaverseStoreUtils.ts src/app/constants/gallerySceneTemplates.ts
git commit -m "feat: add compatible white box defaults"
```

### Task 4: Build The Museum Material System

**Files:**
- Create: `src/app/modules/metaverse3d/materials/museumMaterials.ts`
- Create: `src/app/modules/metaverse3d/materials/museumMaterials.test.ts`
- Modify: `src/app/modules/metaverse3d/components/Room.tsx`
- Modify: `ATTRIBUTIONS.md`

- [ ] **Step 1: Write failing pure calculation tests**

Test that a 24 m by 20 m room with a 2 m floor texture unit resolves to `[12, 10]`, wall repeats use segment length and room height, color maps use `SRGBColorSpace`, and normal/roughness/AO maps remain linear.

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- src/app/modules/metaverse3d/materials/museumMaterials.test.ts
```

Expected: FAIL because the helpers do not exist.

- [ ] **Step 3: Implement descriptors and helpers**

Export:

```ts
export type MuseumMaterialSet = {
  color?: Texture;
  normal?: Texture;
  roughness?: Texture;
  ao?: Texture;
};

export function calculateWorldRepeat(spanX: number, spanY: number, metersPerTile: number): [number, number];
export function configureMuseumTexture(texture: Texture, kind: "color" | "data", repeat: [number, number], anisotropy: number): Texture;
```

Provide neutral `MeshStandardMaterial` property objects for warm plaster, light oak, microcement, ceiling white, and matte black metal.

- [ ] **Step 4: Integrate without making asset failures fatal**

Replace the current single-map/bump-map reuse in `Room.tsx`. Load optional maps behind a localized Suspense/error boundary or use preloaded descriptors that return fallback material properties when any optional map is unavailable. Set floor direction from the room’s longest axis and cap anisotropy to `gl.capabilities.getMaxAnisotropy()`.

- [ ] **Step 5: Attribute assets**

For every added texture, record title, author/source URL, license, and local path in `ATTRIBUTIONS.md`. If no external asset is added in this pass, use procedural/fallback materials and state that explicitly.

- [ ] **Step 6: Verify**

Run:

```bash
npm test -- src/app/modules/metaverse3d/materials/museumMaterials.test.ts
npm run build
```

Expected: PASS; invalid optional texture URLs degrade only that surface.

- [ ] **Step 7: Commit**

```bash
git add src/app/modules/metaverse3d/materials src/app/modules/metaverse3d/components/Room.tsx ATTRIBUTIONS.md
git commit -m "feat: add world scale museum materials"
```

### Task 5: Replace The Game-Like Environment

**Files:**
- Create: `src/app/modules/metaverse3d/components/MuseumEnvironment.tsx`
- Modify: `src/app/modules/metaverse3d/components/CanvasScene.tsx`
- Modify: `src/app/modules/metaverse3d/components/ViewCanvas.tsx`
- Modify: `src/app/modules/metaverse3d/components/createRenderer.ts`
- Create: `src/app/modules/metaverse3d/components/createRenderer.test.ts`

- [ ] **Step 1: Write a failing renderer fallback test**

Mock WebGPU support and rejection from `WebGPURenderer.init()`. Assert `createRenderer()` resolves a `WebGLRenderer` rather than rejecting.

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- src/app/modules/metaverse3d/components/createRenderer.test.ts
```

Expected: FAIL because the WebGPU error currently escapes.

- [ ] **Step 3: Add WebGPU fallback**

Wrap import, construction, and `init()` in `try/catch`; dispose a partially initialized WebGPU renderer and then construct WebGL. Log one warning with the original error.

- [ ] **Step 4: Implement `MuseumEnvironment`**

Use neutral background `#f3f0e9`, no dense blue fog, low-intensity environment reflections, warm hemisphere/fill lighting, and one constrained key light. Set ACES exposure from a named constant calibrated for warm white walls.

- [ ] **Step 5: Remove decorative postprocessing**

Delete Bloom and Vignette from `ViewCanvas`. Quality may use restrained SSAO/contact shadows; Balanced and Low omit them according to the profile.

- [ ] **Step 6: Compose the environment**

Replace inline environment/light declarations in `CanvasScene` with `<MuseumEnvironment profile={performanceProfile} roomSize={roomSize} />`. Keep the floor-plan lighting path separate and simple.

- [ ] **Step 7: Verify**

Run:

```bash
npm test -- src/app/modules/metaverse3d/components/createRenderer.test.ts
npm run build
```

Expected: PASS, with no blue fog or bloom in the 3D scene.

- [ ] **Step 8: Commit**

```bash
git add src/app/modules/metaverse3d/components/MuseumEnvironment.tsx src/app/modules/metaverse3d/components/CanvasScene.tsx src/app/modules/metaverse3d/components/ViewCanvas.tsx src/app/modules/metaverse3d/components/createRenderer.ts src/app/modules/metaverse3d/components/createRenderer.test.ts
git commit -m "feat: add neutral museum environment"
```

### Task 6: Add Non-Interactive Architectural Details

**Files:**
- Create: `src/app/modules/metaverse3d/components/ArchitecturalDetails.tsx`
- Create: `src/app/modules/metaverse3d/components/ArchitecturalDetails.test.tsx`
- Modify: `src/app/modules/metaverse3d/components/Room.tsx`
- Modify: `src/app/modules/metaverse3d/components/CanvasScene.tsx`

- [ ] **Step 1: Extract stable topology input**

Export a pure `buildRoomPresentationTopology(roomSize, floorPlanElements)` helper returning room bounds, wall segments, center, and recognizable door openings. Make `Room` and `ArchitecturalDetails` consume the same result.

- [ ] **Step 2: Write failing geometry tests**

Assert skirting sits at `0.06 m`, cornice below the ceiling, doorway trim follows `doorOffset`/`doorWidth`, and generated detail meshes use `raycast={() => null}` or `pointerEvents`-equivalent behavior.

- [ ] **Step 3: Verify RED**

Run:

```bash
npm test -- src/app/modules/metaverse3d/components/ArchitecturalDetails.test.tsx
```

Expected: FAIL because the module does not exist.

- [ ] **Step 4: Implement detail geometry**

Generate skirting and cornice per visible wall span, trim around door cuts, a shallow ceiling perimeter recess, and matte-black track bars. Use fixed real-world dimensions and instancing where repeated geometry is identical.

- [ ] **Step 5: Preserve interaction**

Set `raycast={() => null}` on every decorative mesh and omit physics/collision wrappers. Mount only when `roomSize.architecturalDetails !== false` and the profile allows the selected detail level.

- [ ] **Step 6: Verify editor regressions**

Run:

```bash
npm test -- src/app/modules/metaverse3d/components/ArchitecturalDetails.test.tsx
npm run build
```

Then manually verify wall selection, floor placement, partition selection, and player collision.

- [ ] **Step 7: Commit**

```bash
git add src/app/modules/metaverse3d/components/ArchitecturalDetails.tsx src/app/modules/metaverse3d/components/ArchitecturalDetails.test.tsx src/app/modules/metaverse3d/components/Room.tsx src/app/modules/metaverse3d/components/CanvasScene.tsx
git commit -m "feat: add modular museum architecture"
```

### Task 7: Add Exhibit-Directed Track Lighting

**Files:**
- Create: `src/app/modules/metaverse3d/lighting/trackLighting.ts`
- Create: `src/app/modules/metaverse3d/lighting/trackLighting.test.ts`
- Create: `src/app/modules/metaverse3d/components/TrackLighting.tsx`
- Modify: `src/app/modules/metaverse3d/components/CanvasScene.tsx`

- [ ] **Step 1: Write failing fixture tests**

Given painting, text, pedestal, and sculpture items, assert stable targets, ceiling-safe fixture positions, limited angle/distance, and mode limits:

```ts
expect(fixturesFor("quality")).toHaveLength(4);
expect(fixturesFor("balanced").filter((light) => light.castShadow)).toHaveLength(2);
expect(fixturesFor("low").filter((light) => light.castShadow)).toHaveLength(1);
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- src/app/modules/metaverse3d/lighting/trackLighting.test.ts
```

Expected: FAIL because fixture calculation is missing.

- [ ] **Step 3: Implement pure fixture calculation**

Prioritize painting, text, sculpture, and pedestal items; derive target height from type/scale; choose the nearest valid ceiling track point; clamp fixture count; and sort by stable item ID so edits do not randomly reshuffle lights.

- [ ] **Step 4: Render tracks and spotlights**

`TrackLighting` receives `roomSize`, `items`, and the profile. Render matte-black track meshes plus spotlights with constrained angle, penumbra, decay, distance, map size, bias, and normal bias. Decoration must not receive pointer events.

- [ ] **Step 5: Recompute only when scene inputs change**

Memoize fixtures by `items`, room dimensions, and effective quality. Do not write calculated fixtures into Zustand or multiplayer payloads.

- [ ] **Step 6: Verify**

Run:

```bash
npm test -- src/app/modules/metaverse3d/lighting/trackLighting.test.ts
npm run build
```

Expected: PASS; moving an exhibit changes its calculated target without a render loop.

- [ ] **Step 7: Commit**

```bash
git add src/app/modules/metaverse3d/lighting src/app/modules/metaverse3d/components/TrackLighting.tsx src/app/modules/metaverse3d/components/CanvasScene.tsx
git commit -m "feat: add exhibit directed track lighting"
```

### Task 8: Expand Quality Profiles And Settings

**Files:**
- Modify: `src/app/modules/metaverse3d/performanceProfile.ts`
- Create: `src/app/modules/metaverse3d/performanceProfile.test.ts`
- Modify: `src/app/modules/metaverse3d/components/UI/WorkspaceRoomSettingsPanel.tsx`

- [ ] **Step 1: Write failing profile tests**

Assert Quality enables full architecture, high-resolution materials, SSAO/contact shadows, and multiple shadow spotlights; Balanced reduces those limits; Low disables optional details and postprocessing.

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- src/app/modules/metaverse3d/performanceProfile.test.ts
```

Expected: FAIL because the fields are absent.

- [ ] **Step 3: Extend the profile**

Add:

```ts
materialResolution: "high" | "medium" | "low";
architecturalDetailLevel: "full" | "reduced" | "minimal";
maxTrackLights: number;
maxShadowTrackLights: number;
enableSsao: boolean;
enableContactShadows: boolean;
```

Use shadow sizes of approximately 1024/512/256 and keep DPR caps finite.

- [ ] **Step 4: Add room-style controls**

Expose White Box/Custom and Light Oak/Microcement/Custom. Selecting White Box applies defaults only after explicit user action; initial normalization must not overwrite existing custom fields.

- [ ] **Step 5: Verify**

Run:

```bash
npm test -- src/app/modules/metaverse3d/performanceProfile.test.ts
npm run check
```

Expected: all tests and build pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/metaverse3d/performanceProfile.ts src/app/modules/metaverse3d/performanceProfile.test.ts src/app/modules/metaverse3d/components/UI/WorkspaceRoomSettingsPanel.tsx
git commit -m "feat: tune museum quality profiles"
```

### Task 9: Visual, Functional, And Performance Acceptance

**Files:**
- Create: `docs/superpowers/verification/2026-06-06-white-box-museum-results.md`
- Create screenshots under: `docs/superpowers/verification/assets/white-box-museum/`

- [ ] **Step 1: Run automated verification**

```bash
npm run check
```

Expected: server syntax check, Vitest suite, and Vite build all pass.

- [ ] **Step 2: Start the application**

```bash
npm run dev:all
```

Wait for both server and Vite URLs to report ready.

- [ ] **Step 3: Verify desktop at 1440 × 900**

Capture before/after or baseline/current screenshots for a blank new exhibition and the Macau Museum scene. Check warm detailed whites, floor scale, no blue cast, no bloom, contact, stable shadows, loading UI, editor controls, placement, movement, deletion, undo/redo, and relighting.

- [ ] **Step 4: Verify mobile at 390 × 844**

Confirm automatic Balanced mode, no UI/canvas clipping, stable 30 FPS-class interaction, reduced shadow-light count, and readable material detail.

- [ ] **Step 5: Verify compatibility and failures**

Load an old scene without museum fields, a customized scene, a broken optional texture URL, and a simulated WebGPU initialization failure. Record that each degrades or preserves values as specified.

- [ ] **Step 6: Record performance**

Document effective profile, DPR, texture resolutions, draw calls, active spotlights, shadow-casting spotlights, postprocessing passes, representative FPS, and any residual console warnings.

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers/verification/2026-06-06-white-box-museum-results.md docs/superpowers/verification/assets/white-box-museum
git commit -m "test: verify white box museum experience"
```

## Self-Review

- Spec coverage: stability, redirect behavior, compatibility, new-scene defaults, materials, fallbacks, neutral environment, architecture, track lighting, quality tiers, WebGPU fallback, desktop/mobile visual checks, and performance recording are each assigned to a task.
- Deliberate exclusions: no engine replacement, real-time GI, path tracing, heavy volumetrics, or multiplayer payload expansion.
- Type consistency: `museumStyle`, `floorMaterial`, `architecturalDetails`, `trackLighting`, and the performance-profile fields use the same names throughout.
- Existing-work protection: implementation must not reset or revert the current dirty worktree; commits should stage only files changed by the corresponding task.
