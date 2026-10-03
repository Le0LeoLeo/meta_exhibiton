# Avatar Shirt Custom Colors Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand the built-in shirt palette and let users apply a safe custom HEX color to every existing shirt style.

**Architecture:** Keep the existing palette ID in `appearance.colors.top` for backward compatibility and add an optional `appearance.colors.topCustom` override. Normalize untrusted client data to canonical uppercase `#RRGGBB`, validate the same contract on the server, and resolve the effective shirt color through one shared frontend helper before it reaches either the GLB material or procedural preview. Selecting a built-in swatch removes the override.

**Tech Stack:** React 18, TypeScript, Zustand, React Three Fiber, Three.js, Express, Zod, Vitest, Testing Library, Tailwind CSS v4.

---

## Scope and constraints

- Add several visually distinct built-in shirt colors without changing existing IDs.
- Accept custom colors only in the form `#RRGGBB`; do not accept CSS names, alpha, shorthand, URLs, gradients, or arbitrary CSS.
- Canonicalize valid custom colors to uppercase.
- Preserve V1 and legacy appearances that do not contain `topCustom`.
- Apply the custom color to all three existing shirt meshes and to procedural/preview fallbacks.
- Keep shirt photo overlays working; the chosen color remains the underlying shirt material.
- Do not invent additional shirt styles because the repository has no matching GLB mesh assets.
- Do not commit changes unless the user explicitly asks.

## Task 1: Frontend appearance contract and palette

**Files:**

- Modify: `src/app/modules/metaverse3d/avatar/avatarManifest.ts`
- Modify: `src/app/modules/metaverse3d/avatar/avatarAppearance.ts`
- Test: `src/app/modules/metaverse3d/avatar/avatarAppearance.test.ts`

1. Add tests proving valid lowercase HEX is normalized to uppercase, invalid values are removed, legacy appearances remain unchanged, and the effective color resolver prefers `topCustom`.
2. Add distinct built-in palette entries.
3. Add optional `topCustom` to the color contract.
4. Implement `normalizeAvatarHexColor` and `resolveAvatarTopColor`.
5. Run the focused appearance tests.

## Task 2: Server validation and persistence contract

**Files:**

- Modify: `server/schemas/avatarAppearanceSchema.js`
- Modify: `server/schemas/avatarAppearanceSchema.test.js`
- Modify if parity requires it: `server/schemas/avatarAppearanceParity.test.js`
- Modify if documentation requires it: `server/multiplayer/protocol.js`

1. Add tests accepting canonical six-digit HEX values and the new built-in palette IDs.
2. Add rejection cases for shorthand, alpha, CSS names, whitespace, and unknown fields.
3. Add optional `topCustom` to the strict color schema and canonicalize it to uppercase.
4. Run the focused server schema and parity tests.

## Task 3: Custom color control and customizer integration

**Files:**

- Add: `src/app/components/avatar/AvatarCustomColorControl.tsx`
- Add: `src/app/components/avatar/AvatarCustomColorControl.test.tsx`
- Modify: `src/app/pages/AvatarCustomizer.tsx`
- Modify: `src/app/pages/AvatarCustomizer.test.tsx`
- Modify: `src/app/i18n/catalogs/en.ts`
- Modify: `src/app/i18n/catalogs/zh-CN.ts`
- Modify: `src/app/i18n/catalogs/zh-TW.ts`
- Modify: `src/app/i18n/catalogs/catalogs.test.ts`

1. Build an accessible control containing a native color picker, a text field, validation feedback, and a clear/reset action.
2. Keep an invalid draft local; only commit a valid normalized value.
3. Render the control below the shirt palette.
4. Clear `topCustom` whenever a built-in shirt swatch is selected.
5. Mark the custom picker as selected whenever an override exists.
6. Add Traditional Chinese, Simplified Chinese, and English copy.
7. Test keyboard entry, invalid input, picker selection, clearing, built-in swatch behavior, and undo history.

## Task 4: Three.js material and fallback resolution

**Files:**

- Modify: `src/app/modules/metaverse3d/avatar/casualAvatar.ts`
- Modify: `src/app/modules/metaverse3d/avatar/casualAvatar.test.ts`
- Modify: `src/app/components/avatar/AvatarPreviewCanvas.tsx`
- Modify related fallback tests if present.

1. Replace direct top palette lookup with `resolveAvatarTopColor`.
2. Confirm cloned `MeshStandardMaterial` instances receive the resolved color without mutating shared GLB materials.
3. Apply the same resolver to procedural preview colors and accents.
4. Verify a shirt photo overlay does not disable the underlying custom color.
5. Run focused material and preview tests.

## Task 5: Integration validation

1. Run all focused frontend and server tests touched above.
2. Run `npm run lint`.
3. Run `npm run typecheck`.
4. Run `npm run check:server`.
5. Run `npm run check:avatar`.
6. Run the full test suite.
7. Run `npm run build` and `npm run check:bundle`.
8. Review the diff for unrelated edits, unsafe CSS injection, schema drift, and accidental generated files.

## Acceptance criteria

- Existing saved avatars render exactly as before.
- Every current shirt style supports the expanded palette and custom HEX colors.
- Valid custom input is canonicalized and survives API/Socket round trips.
- Invalid custom input is rejected by the server and never committed by the UI.
- Built-in swatch selection clears the custom override.
- GLB and procedural fallback renders use the same effective color.
- Undo/redo treats a committed color change as one history entry.
- Focused tests, full tests, lint, typecheck, server/avatar checks, build, and bundle checks pass.
