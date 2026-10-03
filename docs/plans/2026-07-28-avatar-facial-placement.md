# Avatar Facial Placement Controls Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users safely adjust the vertical position, spacing, scale, and rotation of their avatar's eyes, eyebrows, and mouth while preserving a valid face, undo/redo behavior, persistence, and multiplayer synchronization.

**Architecture:** Extend `AvatarAppearanceV1` with a normalized `facialPlacement` value whose offsets are relative to the existing authored facial coordinates. Keep the first release slider-based and symmetrical, calculate final transforms in a pure helper before creating Three.js meshes, and validate the same bounded values in the Express server. Reuse the current appearance save and multiplayer payload instead of introducing a separate facial-layout endpoint or event.

**Tech Stack:** React 18, TypeScript, Zustand, Radix Slider, Three.js, Express, Zod, SQLite JSON persistence, Socket.IO, Vitest, Testing Library, Playwright.

---

## Product Contract

The first release provides bounded adjustments:

- Eyes: vertical offset, spacing, and uniform size.
- Eyebrows: vertical offset, spacing, and tilt.
- Mouth: horizontal offset, vertical offset, width, and height.
- Both eyes remain symmetrical around the face center.
- Both eyebrows remain symmetrical; tilt is mirrored left/right.
- Every adjustment updates the preview immediately.
- One continuous slider gesture creates one undo-history entry, not one entry per pointer movement.
- Resetting the avatar restores all facial placement values to their neutral defaults.
- Saved placement appears on the user's avatar after reload and on multiplayer peers.
- Legacy appearances without `facialPlacement` normalize to the neutral defaults.
- Invalid or out-of-range network values are rejected rather than silently accepted.

Suggested normalized contract:

```ts
export type AvatarFacialPlacement = {
  eyes: {
    offsetY: number;
    spacing: number;
    scale: number;
  };
  eyebrows: {
    offsetY: number;
    spacing: number;
    rotation: number;
  };
  mouth: {
    offsetX: number;
    offsetY: number;
    scaleX: number;
    scaleY: number;
  };
};
```

Neutral defaults and accepted ranges:

```ts
export const DEFAULT_AVATAR_FACIAL_PLACEMENT = {
  eyes: { offsetY: 0, spacing: 0, scale: 1 },
  eyebrows: { offsetY: 0, spacing: 0, rotation: 0 },
  mouth: { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 },
} as const;

export const AVATAR_FACIAL_PLACEMENT_LIMITS = {
  eyes: {
    offsetY: { min: -0.1, max: 0.1, step: 0.005 },
    spacing: { min: -0.06, max: 0.08, step: 0.005 },
    scale: { min: 0.75, max: 1.35, step: 0.01 },
  },
  eyebrows: {
    offsetY: { min: -0.08, max: 0.1, step: 0.005 },
    spacing: { min: -0.06, max: 0.08, step: 0.005 },
    rotation: { min: -0.35, max: 0.35, step: 0.01 },
  },
  mouth: {
    offsetX: { min: -0.12, max: 0.12, step: 0.005 },
    offsetY: { min: -0.1, max: 0.08, step: 0.005 },
    scaleX: { min: 0.7, max: 1.4, step: 0.01 },
    scaleY: { min: 0.7, max: 1.4, step: 0.01 },
  },
} as const;
```

## Non-Goals

- Do not add free 3D pointer dragging in this release.
- Do not allow independent left/right eye movement or intentional asymmetry.
- Do not add nose customization; the primary casual-avatar renderer does not currently expose a procedural nose.
- Do not change the GLB skeleton, animation clips, or head bone.
- Do not introduce `AvatarAppearanceV2`; this is a backward-compatible addition to V1.
- Do not save preview-only slider updates to the API or emit them to multiplayer peers before the user presses the existing save action.

## Important Implementation Invariants

1. Facial values are offsets from the existing authored coordinates, not absolute head-local positions.
2. Construct the facial group in the model's authored coordinate system, then retain the existing `head.attach(...)` flow. The rig's head-local axes are rotated, so replacing this with direct local coordinates will misplace features.
3. Frontend normalization clamps finite values for legacy/local recovery; the server rejects malformed and out-of-range request values.
4. `normalizeAvatarAppearance()` must return fresh nested objects so history snapshots cannot share mutable placement references.
5. Slider previews may call the Zustand setter, but undo history must capture the appearance from the start of the gesture exactly once.
6. The current avatar appearance payload remains the only source for REST persistence and Socket.IO presence.

---

### Task 1: Extend the frontend appearance contract

**Files:**

- Create: `src/app/modules/metaverse3d/avatar/avatarFacialPlacement.ts`
- Modify: `src/app/modules/metaverse3d/avatar/avatarAppearance.ts`
- Modify: `src/app/modules/metaverse3d/avatar/avatarAppearance.test.ts`
- Modify: `src/app/modules/metaverse3d/avatar/avatarPreferenceStore.test.ts`

**Step 1: Write failing normalization tests**

Add tests proving:

```ts
it("adds neutral facial placement to legacy V1 appearances", () => {
  const legacy = { ...VALID_APPEARANCE };
  delete (legacy as Partial<AvatarAppearanceV1>).facialPlacement;

  expect(normalizeAvatarAppearance(legacy).facialPlacement)
    .toEqual(DEFAULT_AVATAR_FACIAL_PLACEMENT);
});

it("clamps facial placement and replaces non-finite values", () => {
  const normalized = normalizeAvatarAppearance({
    ...VALID_APPEARANCE,
    facialPlacement: {
      eyes: { offsetY: 99, spacing: -99, scale: Number.NaN },
      eyebrows: { offsetY: 0.02, spacing: 0.03, rotation: 99 },
      mouth: { offsetX: -99, offsetY: 99, scaleX: 10, scaleY: 0 },
    },
  });

  expect(normalized.facialPlacement.eyes.offsetY).toBe(0.1);
  expect(normalized.facialPlacement.eyes.spacing).toBe(-0.06);
  expect(normalized.facialPlacement.eyes.scale).toBe(1);
  expect(normalized.facialPlacement.eyebrows.rotation).toBe(0.35);
});

it("returns independent facial placement objects", () => {
  const first = normalizeAvatarAppearance(DEFAULT_AVATAR_APPEARANCE);
  const second = normalizeAvatarAppearance(DEFAULT_AVATAR_APPEARANCE);
  expect(first.facialPlacement).not.toBe(second.facialPlacement);
  expect(first.facialPlacement.eyes).not.toBe(second.facialPlacement.eyes);
});
```

Extend the preference-store test to prove guest hydration preserves normalized placement.

**Step 2: Run the tests and verify failure**

Run:

```powershell
npm run test -- src/app/modules/metaverse3d/avatar/avatarAppearance.test.ts src/app/modules/metaverse3d/avatar/avatarPreferenceStore.test.ts
```

Expected: FAIL because `facialPlacement` and its normalizer do not exist.

**Step 3: Add the placement module**

In `avatarFacialPlacement.ts`:

- Export `AvatarFacialPlacement`.
- Export the neutral defaults and limits from the Product Contract.
- Add a finite-number clamp helper.
- Add `normalizeAvatarFacialPlacement(value: unknown)`.
- Always return newly allocated `eyes`, `eyebrows`, and `mouth` objects.
- Use the neutral value when a field is missing, not numeric, `NaN`, or infinite.

Suggested helper shape:

```ts
function normalizeNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}
```

**Step 4: Integrate with `AvatarAppearanceV1`**

- Add required `facialPlacement: AvatarFacialPlacement` to normalized `AvatarAppearanceV1`.
- Add a fresh neutral placement to `DEFAULT_AVATAR_APPEARANCE`.
- Normalize `value.facialPlacement` in `normalizeAvatarAppearance()`.
- Do not alter `version: 1`.

**Step 5: Run the focused tests**

Run the command from Step 2.

Expected: PASS.

**Step 6: Commit**

```powershell
git add src/app/modules/metaverse3d/avatar/avatarFacialPlacement.ts src/app/modules/metaverse3d/avatar/avatarAppearance.ts src/app/modules/metaverse3d/avatar/avatarAppearance.test.ts src/app/modules/metaverse3d/avatar/avatarPreferenceStore.test.ts
git commit -m "feat: add bounded avatar facial placement contract" -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

---

### Task 2: Add strict server validation and legacy defaults

**Files:**

- Modify: `server/schemas/avatarAppearanceSchema.js`
- Modify: `server/schemas/avatarAppearanceSchema.test.js`
- Modify: `server/schemas/avatarAppearanceParity.test.js`

**Step 1: Write failing server-schema tests**

Add tests that prove:

- A valid facial placement parses unchanged.
- A legacy stored appearance receives the neutral defaults.
- REST input outside any limit throws a Zod error.
- `NaN`, infinity, strings, unknown nested keys, and missing nested groups are rejected when `facialPlacement` is supplied.
- The frontend and backend defaults have the same serialized shape.

Example:

```js
it('rejects facial values outside their safe range', () => {
  expect(() => parseAvatarAppearance(createValidAppearance({
    facialPlacement: {
      ...DEFAULT_AVATAR_FACIAL_PLACEMENT,
      eyes: {
        ...DEFAULT_AVATAR_FACIAL_PLACEMENT.eyes,
        offsetY: 0.101,
      },
    },
  }))).toThrow();
});
```

**Step 2: Run the tests and verify failure**

Run:

```powershell
npm run test -- server/schemas/avatarAppearanceSchema.test.js server/schemas/avatarAppearanceParity.test.js
```

Expected: FAIL because the strict server schema does not accept `facialPlacement`.

**Step 3: Add the Zod schema**

- Define frozen server-side neutral defaults matching the frontend values.
- Use `z.number().finite().min(...).max(...)`.
- Mark the top-level `facialPlacement` as defaulted for legacy payloads.
- Keep every nested object `.strict()`.
- Keep `avatarAppearanceSchema` itself `.strict()`.
- Freeze nested defaults or return parsed copies so callers cannot mutate the shared default.

Suggested structure:

```js
const facialPlacementSchema = z.object({
  eyes: z.object({
    offsetY: z.number().finite().min(-0.1).max(0.1),
    spacing: z.number().finite().min(-0.06).max(0.08),
    scale: z.number().finite().min(0.75).max(1.35),
  }).strict(),
  eyebrows: z.object({
    offsetY: z.number().finite().min(-0.08).max(0.1),
    spacing: z.number().finite().min(-0.06).max(0.08),
    rotation: z.number().finite().min(-0.35).max(0.35),
  }).strict(),
  mouth: z.object({
    offsetX: z.number().finite().min(-0.12).max(0.12),
    offsetY: z.number().finite().min(-0.1).max(0.08),
    scaleX: z.number().finite().min(0.7).max(1.4),
    scaleY: z.number().finite().min(0.7).max(1.4),
  }).strict(),
}).strict();
```

**Step 4: Run the schema tests**

Run the command from Step 2.

Expected: PASS.

**Step 5: Commit**

```powershell
git add server/schemas/avatarAppearanceSchema.js server/schemas/avatarAppearanceSchema.test.js server/schemas/avatarAppearanceParity.test.js
git commit -m "feat: validate avatar facial placement on the server" -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

---

### Task 3: Calculate and render facial transforms

**Files:**

- Modify: `src/app/modules/metaverse3d/avatar/avatarFacialPlacement.ts`
- Modify: `src/app/modules/metaverse3d/avatar/casualAvatar.ts`
- Modify: `src/app/modules/metaverse3d/avatar/casualAvatar.test.ts`

**Step 1: Write failing transform tests**

Test a pure `resolveAvatarFacialTransforms(appearance)` helper rather than relying only on Three.js scene traversal.

The neutral transform must preserve the current authored coordinates:

```ts
expect(neutral.eyes.left.position).toEqual([-0.17, 2.55, 0.545]);
expect(neutral.eyes.right.position).toEqual([0.17, 2.55, 0.545]);
expect(neutral.eyebrows.left.position).toEqual([-0.17, 2.655, 0.545]);
expect(neutral.mouth.position).toEqual([0, 2.41, 0.57]);
```

Add a non-neutral case proving:

- Eye spacing expands both sides symmetrically.
- Eye scale multiplies the selected eye style's base scale.
- Eyebrow tilt adds to the style's existing angle and mirrors left/right.
- Mouth offsets and scale multiply the selected mouth style's existing scale.

**Step 2: Run the avatar scene test and verify failure**

Run:

```powershell
npm run test -- src/app/modules/metaverse3d/avatar/casualAvatar.test.ts
```

Expected: FAIL because the transform resolver does not exist.

**Step 3: Implement the pure transform resolver**

Use these formulas:

```ts
const eyeX = 0.17 + placement.eyes.spacing;
const eyeY = 2.55 + placement.eyes.offsetY;

const browX = 0.17 + placement.eyebrows.spacing;
const browY = 2.655 + placement.eyebrows.offsetY;

const mouthX = placement.mouth.offsetX;
const mouthY = baseMouthY + placement.mouth.offsetY;
```

For scale, multiply component-wise:

```ts
const eyeScale = baseEyeScale.map(
  (component) => component * placement.eyes.scale,
);
```

For eyebrows, preserve the style angle:

```ts
const finalTilt = baseStyleTilt + placement.eyebrows.rotation;
left.rotationZ = -finalTilt;
right.rotationZ = finalTilt;
```

For mouth scale, preserve the existing `mouth03` vertical factor:

```ts
mouth.scale = [
  placement.mouth.scaleX,
  baseMouthScaleY * placement.mouth.scaleY,
  1,
];
```

**Step 4: Replace hardcoded mesh transforms**

- Keep `createFacialFeatures()` and `addFacialMesh()`.
- Resolve transforms once per avatar build.
- Pass the resolved positions, scales, and rotations into each mesh.
- Keep the group authored in scene space and retain `head.attach(facialFeatures.object)`.
- Do not change accessory attachment or head scaling.

**Step 5: Add an integration assertion**

Traverse the configured scene and verify `EyeLeft`, `EyeRight`, `EyebrowLeft`, `EyebrowRight`, and `Mouth` receive the expected non-neutral values.

**Step 6: Run the focused tests**

Run the command from Step 2.

Expected: PASS.

**Step 7: Commit**

```powershell
git add src/app/modules/metaverse3d/avatar/avatarFacialPlacement.ts src/app/modules/metaverse3d/avatar/casualAvatar.ts src/app/modules/metaverse3d/avatar/casualAvatar.test.ts
git commit -m "feat: render adjustable avatar facial placement" -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

---

### Task 4: Add one-entry slider gesture history

**Files:**

- Modify: `src/app/pages/AvatarCustomizer.tsx`
- Modify: `src/app/pages/AvatarCustomizer.test.tsx`

**Step 1: Write failing history tests**

Add tests that simulate:

1. Pointer/focus begins on a placement slider.
2. Several `onValueChange` preview updates occur.
3. One `onValueCommit` ends the gesture.
4. A single Undo restores the complete pre-gesture appearance.
5. Redo reapplies the final slider value.

Also test keyboard changes, because Radix sliders can commit without pointer events.

**Step 2: Run the customizer test and verify failure**

Run:

```powershell
npm run test -- src/app/pages/AvatarCustomizer.test.tsx
```

Expected: FAIL because no gesture-aware appearance update API exists.

**Step 3: Add gesture lifecycle helpers**

Inside `AvatarCustomizer`:

- Add `appearanceGestureStartRef`.
- `beginAppearanceGesture()` captures the normalized current appearance only if no gesture is active.
- `previewAppearance(next)` calls `setAppearance(normalizeAvatarAppearance(next))` without writing history.
- `commitAppearanceGesture(finalValue)`:
  - Uses the captured start appearance.
  - Normalizes the final value.
  - Pushes exactly the captured start snapshot when the final value differs.
  - Clears the redo stack.
  - Applies the final value.
  - Clears the gesture ref.
- `cancelAppearanceGesture()` restores the captured snapshot and clears the ref.
- Clear an active gesture when changing tabs, resetting, undoing, redoing, or unmounting.

Do not modify the existing one-shot `commitAppearance()` semantics used by option buttons.

**Step 4: Run the customizer tests**

Run the command from Step 2.

Expected: PASS.

**Step 5: Commit**

```powershell
git add src/app/pages/AvatarCustomizer.tsx src/app/pages/AvatarCustomizer.test.tsx
git commit -m "feat: preserve avatar slider gestures in undo history" -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

---

### Task 5: Build accessible facial placement controls

**Files:**

- Create: `src/app/components/avatar/FacialPlacementControls.tsx`
- Create: `src/app/components/avatar/FacialPlacementControls.test.tsx`
- Modify: `src/app/pages/AvatarCustomizer.tsx`
- Modify: `src/app/pages/AvatarCustomizer.test.tsx`
- Modify: `src/app/i18n/catalogs/en.ts`
- Modify: `src/app/i18n/catalogs/zh-CN.ts`
- Modify: `src/app/i18n/catalogs/zh-TW.ts`

**Step 1: Write failing component tests**

Cover:

- All ten controls render with localized labels.
- Each slider has an accessible name, current value, minimum, maximum, and step.
- Slider movement calls preview without committing immediately.
- Slider commit calls the gesture commit callback once.
- Reset-face-placement restores neutral values without resetting clothes or colors.
- Display values are rounded consistently and do not expose floating-point noise.

**Step 2: Run the component tests and verify failure**

Run:

```powershell
npm run test -- src/app/components/avatar/FacialPlacementControls.test.tsx src/app/pages/AvatarCustomizer.test.tsx
```

Expected: FAIL because the control component and translation keys do not exist.

**Step 3: Implement the control component**

Use the existing `Slider` primitive from `src/app/components/ui/slider.tsx`.

Recommended prop contract:

```ts
type FacialPlacementControlsProps = {
  value: AvatarFacialPlacement;
  labels: FacialPlacementLabels;
  onGestureStart: () => void;
  onPreview: (value: AvatarFacialPlacement) => void;
  onCommit: (value: AvatarFacialPlacement) => void;
  onReset: () => void;
};
```

For each slider:

- Read min/max/step from `AVATAR_FACIAL_PLACEMENT_LIMITS`.
- Use a single-value array.
- Call `onGestureStart` on pointer down and focus if no gesture is active.
- Call `onPreview` from `onValueChange`.
- Call `onCommit` from `onValueCommit`.
- Include a visible numeric value.
- Use percentage display for scale and signed display for offsets/rotation.
- Ensure a minimum 44px touch target around the slider row.

**Step 4: Add a dedicated tab**

Add a `facial-placement` tab after the existing mouth tab. Keep style selection and placement separate:

- Eyes/eyebrows/mouth tabs continue selecting visual styles.
- Facial placement tab controls positions and proportions.
- The reset button in this tab resets only `facialPlacement`.
- The existing global avatar reset still restores the entire default appearance.

**Step 5: Add translations**

Add matching keys to all three catalogs for:

- Facial placement tab.
- Eye height, eye spacing, eye size.
- Eyebrow height, eyebrow spacing, eyebrow tilt.
- Mouth horizontal position, mouth height, mouth width, mouth height scale.
- Reset face placement.
- Short help text explaining that limits keep features on the face.

Run the root i18n audit after implementation:

```powershell
Set-Location ..
python audit_i18n.py
Set-Location web_ui_new
```

Expected: no new missing or inconsistent keys.

**Step 6: Run the UI tests**

Run the command from Step 2.

Expected: PASS.

**Step 7: Commit**

```powershell
git add src/app/components/avatar/FacialPlacementControls.tsx src/app/components/avatar/FacialPlacementControls.test.tsx src/app/pages/AvatarCustomizer.tsx src/app/pages/AvatarCustomizer.test.tsx src/app/i18n/catalogs/en.ts src/app/i18n/catalogs/zh-CN.ts src/app/i18n/catalogs/zh-TW.ts
git commit -m "feat: add avatar facial placement controls" -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

---

### Task 6: Verify persistence and multiplayer synchronization

**Files:**

- Modify: `src/app/api/auth.test.ts`
- Modify: `server/routes/authRoutes.test.js`
- Modify: `server/multiplayer/socketServer.test.js`
- Modify: `src/app/modules/metaverse3d/network/socketClient.test.ts`

**Step 1: Add failing REST persistence tests**

Prove that:

- `updateMyAvatar()` sends normalized facial placement.
- `PUT /api/users/me/avatar` persists valid placement.
- A following `/api/auth/me` returns the same placement.
- Out-of-range placement returns HTTP 400 and does not overwrite the saved appearance.
- Legacy database JSON returns neutral defaults.

**Step 2: Add failing multiplayer tests**

Prove that:

- `player:appearance` accepts a valid bounded facial placement.
- Observers receive the placement in `player:appearance:changed`.
- A later room join sees it in the presence snapshot.
- Out-of-range, non-finite, or oversized placement is rejected without mutating player state.
- The socket client forwards the saved normalized appearance without adding a second event type.

**Step 3: Run the focused tests and verify failure**

Run:

```powershell
npm run test -- src/app/api/auth.test.ts server/routes/authRoutes.test.js server/multiplayer/socketServer.test.js src/app/modules/metaverse3d/network/socketClient.test.ts
```

Expected: FAIL until the shared appearance fixtures and assertions include facial placement.

**Step 4: Make the smallest fixture and integration updates**

- Reuse `avatarAppearanceSchema`; do not duplicate validation inside Socket.IO handlers.
- Update valid appearance fixtures to include non-neutral placement where the test is specifically checking propagation.
- Leave unrelated fixtures on neutral defaults.
- Do not add database columns; the existing avatar appearance JSON column already persists the full contract.

**Step 5: Run the focused tests**

Run the command from Step 3.

Expected: PASS.

**Step 6: Commit**

```powershell
git add src/app/api/auth.test.ts server/routes/authRoutes.test.js server/multiplayer/socketServer.test.js src/app/modules/metaverse3d/network/socketClient.test.ts
git commit -m "test: cover facial placement persistence and multiplayer" -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

---

### Task 7: Complete release and visual validation

**Files:**

- Modify if needed: `doc/README.md`
- Create: `output/playwright/avatar-facial-placement-desktop.png`
- Create: `output/playwright/avatar-facial-placement-mobile.png`

**Step 1: Run all focused avatar tests**

```powershell
npm run test -- src/app/modules/metaverse3d/avatar src/app/components/avatar src/app/pages/AvatarCustomizer.test.tsx src/app/api/auth.test.ts server/schemas/avatarAppearanceSchema.test.js server/schemas/avatarAppearanceParity.test.js server/routes/authRoutes.test.js src/app/modules/metaverse3d/network/socketClient.test.ts
```

Expected: all selected test files pass.

**Step 2: Run server syntax and type checks**

```powershell
npm run check:server
npm run typecheck
```

Expected: PASS.

**Step 3: Run lint**

```powershell
npm run lint
```

Expected: PASS with zero warnings. Fix the existing unused `_topPhotoUrl` issue in `AvatarCustomizer.tsx` if it is still present before claiming completion.

**Step 4: Run the full test suite**

```powershell
npm run test
```

Expected: all non-environmental tests pass; the Redis multi-instance integration test may only skip when `REDIS_TEST_URL` is not configured.

**Step 5: Run production build and bundle checks**

```powershell
npm run build
npm run check:bundle
```

Expected: PASS within all existing bundle budgets.

**Step 6: Perform desktop manual acceptance**

1. Open `/avatar`.
2. Select every facial style once.
3. Move every facial placement slider to its minimum and maximum.
4. Confirm features remain visible and attached during idle/walk animation.
5. Confirm one Undo reverses one complete slider gesture.
6. Confirm Redo reapplies it.
7. Save, reload, and confirm placement persists.
8. Open a second multiplayer client and confirm the saved appearance matches.
9. Capture `output/playwright/avatar-facial-placement-desktop.png`.

**Step 7: Perform mobile manual acceptance**

1. Use a 390x844 viewport.
2. Confirm the tab row remains scrollable.
3. Confirm every slider can be operated without moving the whole page horizontally.
4. Confirm labels and numeric values do not overlap.
5. Confirm touch targets are at least 44px.
6. Capture `output/playwright/avatar-facial-placement-mobile.png`.

**Step 8: Update documentation**

Add a short avatar customization section to `doc/README.md` describing:

- Supported facial placement controls.
- Safe bounds and symmetric first-release behavior.
- REST persistence and multiplayer propagation.
- Direct 3D dragging remains a future enhancement.

**Step 9: Run the complete release gate**

```powershell
npm run check
```

Expected: PASS.

**Step 10: Commit**

```powershell
git add doc/README.md output/playwright/avatar-facial-placement-desktop.png output/playwright/avatar-facial-placement-mobile.png
git commit -m "docs: document avatar facial placement controls" -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

---

## Definition of Done

- Legacy avatar JSON loads with neutral facial placement.
- The frontend always works with a complete normalized placement object.
- The server strictly rejects malformed and out-of-range values.
- Neutral placement produces the same visual coordinates as before this feature.
- Slider interaction previews continuously and creates one undo entry per gesture.
- All controls are keyboard accessible, localized, and usable on mobile.
- Saving and reloading preserves placement.
- Multiplayer peers receive the saved placement through the existing appearance event.
- Focused tests, full tests, lint, typecheck, server syntax, production build, bundle budget, and `npm run check` pass.
- Desktop and mobile screenshots demonstrate the accepted result.

## Phase 2 Candidate: Direct 3D Dragging

Only begin this after the slider release is stable.

Direct dragging requires:

- Raycasting against a dedicated invisible facial interaction plane.
- Converting the ray intersection from world space through the animated head's inverse world matrix.
- Mapping head-local coordinates back to bounded placement offsets.
- Pointer capture and OrbitControls suppression during drag.
- Touch hit targets larger than the visible facial meshes.
- Symmetry rules for paired eyes and eyebrows.
- Keyboard and slider alternatives for accessibility.
- Tests for animation, camera rotation, mobile touch, and model variants.

Do not store raw world or head-local coordinates. Convert every drag result back into the same bounded `facialPlacement` contract so REST persistence, undo/redo, and multiplayer behavior remain unchanged.
