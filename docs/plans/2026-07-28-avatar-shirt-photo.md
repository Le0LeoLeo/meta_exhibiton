# Avatar Shirt Photo Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let a signed-in user upload a JPG, PNG, or WebP image and display it as a persistent photo panel on the front of their avatar's shirt.

**Architecture:** Extend avatar appearance V1 with an optional, server-validated media URL. Reuse the sanitized media upload service with an explicit `avatar` usage so the resulting image is readable by multiplayer viewers while gallery media remains private. Render the image on a small plane attached to the animated torso instead of stretching it over the shirt UVs.

**Tech Stack:** React 18, TypeScript, Express, Zod, SQLite, Three.js, Vitest, Playwright.

---

### Task 1: Extend the avatar appearance contract

**Files:**
- Modify: `src/app/modules/metaverse3d/avatar/avatarAppearance.ts`
- Modify: `src/app/modules/metaverse3d/avatar/avatarAppearance.test.ts`
- Modify: `server/schemas/avatarAppearanceSchema.js`
- Modify: `server/schemas/avatarAppearanceSchema.test.js`

**Steps:**

1. Add failing tests that preserve only canonical `/api/media/<uuid>` shirt-photo URLs.
2. Run the client and server schema tests and confirm failure.
3. Add optional `topPhotoUrl` normalization and strict Zod validation.
4. Run the tests and confirm they pass.

### Task 2: Mark uploaded media for avatar use

**Files:**
- Modify: `server/db.js`
- Modify: `server/dbInitialization.test.js`
- Modify: `server/repositories/mediaRepository.js`
- Modify: `server/routes/mediaRoutes.js`
- Modify: `server/routes/mediaRoutes.test.js`
- Modify: `src/app/api/media.ts`

**Steps:**

1. Add failing database and route tests for an `avatar` media usage.
2. Add a `usage` column with a safe `gallery` default.
3. Accept only `gallery` or `avatar` upload usage and persist it.
4. Permit unauthenticated reads only for `avatar` assets.
5. Extend the frontend upload call with the avatar usage.
6. Run media and database tests.

### Task 3: Render the shirt photo

**Files:**
- Modify: `src/app/modules/metaverse3d/avatar/casualAvatar.ts`
- Modify: `src/app/modules/metaverse3d/avatar/casualAvatar.test.ts`

**Steps:**

1. Add a failing test for a photo plane attached to `Torso`.
2. Load the uploaded image as an sRGB texture with center-crop settings.
3. Attach a photo plane to the animated torso and track its texture for disposal.
4. Run avatar scene tests.

### Task 4: Add the upload controls

**Files:**
- Modify: `src/app/pages/AvatarCustomizer.tsx`
- Modify: `src/app/pages/AvatarCustomizer.test.tsx`
- Modify: `src/app/components/avatar/avatarLooks.ts`

**Steps:**

1. Add failing UI tests for upload and removal.
2. Add a hidden image input, upload progress state, validation messaging, and remove action under the Top tab.
3. Commit the returned media URL into appearance history so undo/redo and save work normally.
4. Run the customizer tests.

### Task 5: Validate the complete flow

**Files:**
- Create: `output/playwright/avatar-shirt-photo.png`

**Steps:**

1. Run focused frontend and backend tests.
2. Run `npm run check:server`.
3. Run `npm run build`.
4. Upload a fixture image in the avatar customizer and capture the rendered shirt photo.
