# Builder Session Persistence And Preview Isolation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Persist AI exhibition Builder sessions and versions per user, and capture generated scenes without importing them into the official editor store.

**Architecture:** Store each Builder session in SQLite with immutable version snapshots serialized as JSON and an optimistic `current_version_id` guard. Route handlers authenticate ownership, use the persisted scene/input/review instead of trusting client copies, and expose a restore endpoint. A dedicated Zustand preview store temporarily swaps only the rendered scene consumed by the canvas; official scene state, undo history, autosave, and multiplayer state remain untouched.

**Tech Stack:** Express ESM, SQLite, Zod, React 18, Zustand, React Three Fiber, TypeScript, Vitest.

---

### Task 1: Builder Session Storage

**Files:**
- Modify: `server/db.js`
- Modify: `server/dbInitialization.test.js`
- Test: `server/exhibitionBuilderSessionStore.test.js`

**Steps:**
1. Add a failing schema test for `exhibition_builder_sessions`.
2. Add the table with user ownership, input JSON, version history JSON, current version, revision count, status, and timestamps.
3. Add DB functions to create, read, save a review under the expected version, and append a revision under the expected version.
4. Test JSON normalization, ownership fields, review persistence, revision append, and stale-version rejection.
5. Run the focused DB tests.

### Task 2: Authenticated And Versioned Builder Routes

**Files:**
- Modify: `server/config/deps.js`
- Modify: `server/routes/exhibitionSceneRoutes.js`
- Modify: `server/routes/exhibitionSceneRoutes.test.js`

**Steps:**
1. Add failing tests that start persists a session, GET restores the current session, foreign users receive 404, and stale review/revise requests receive 409.
2. Resolve the authenticated user id from `sub` or `id`.
3. Persist the generated start response.
4. Load and validate the stored session before review/revise.
5. Use persisted scene, input, review, and revision count rather than client-authoritative copies.
6. Persist review and revision results with optimistic version guards.
7. Run route tests.

### Task 3: Frontend Session Restore Contract

**Files:**
- Modify: `src/app/api/exhibitionScene.ts`
- Test: `src/app/api/exhibitionScene.test.ts`

**Steps:**
1. Add a `requestBuilderSessionById` client and version-history response types.
2. Add success and error tests using the existing API test conventions.
3. Run the API test.

### Task 4: Dedicated Preview Scene Store

**Files:**
- Create: `src/app/modules/metaverse3d/aiBuilder/builderPreviewStore.ts`
- Create: `src/app/modules/metaverse3d/aiBuilder/builderPreviewStore.test.ts`
- Modify: `src/app/modules/metaverse3d/components/Room.tsx`
- Modify: `src/app/modules/metaverse3d/components/EditCanvas.tsx`
- Modify: `src/app/modules/metaverse3d/components/CanvasScene.tsx`
- Modify: `src/app/features/metaverse-studio/canvas/StudioCanvasRoot.tsx`

**Steps:**
1. Add a failing store test for preview set/clear and `finally` cleanup.
2. Create the dedicated store and `captureBuilderPreviewScene` helper.
3. Let the canvas render the preview snapshot when present.
4. Pass room, floor-plan, item, and wall-material overrides into `Room`.
5. Keep all official editor actions and state unchanged.
6. Run preview-store and canvas tests.

### Task 5: Remove Official Store Import During Review

**Files:**
- Modify: `src/app/modules/metaverse3d/aiBuilder/runExhibitionBuilderAgent.ts`
- Modify: `src/app/modules/metaverse3d/aiBuilder/runExhibitionBuilderAgent.test.ts`
- Modify: `src/app/modules/metaverse3d/components/UI/EditUI.tsx`
- Modify: `src/app/modules/metaverse3d/components/UI/EditUI.test.tsx`

**Steps:**
1. Change the capture callback to receive the complete scene snapshot.
2. Remove `exportScene`/`importScene` from the orchestration capture loop.
3. Wrap screenshot capture with the dedicated preview helper.
4. Replace the existing test that expects temporary import with one proving no official import occurs.
5. Run Builder orchestration and UI tests.

### Task 6: Integrated Verification

**Steps:**
1. Run all Builder, route, DB, preview, canvas, and UI tests.
2. Run `npm run typecheck`.
3. Run `npm run check:server`.
4. Run `git diff --check` only for files touched by this plan.
5. Report remaining limitations without modifying unrelated dirty-worktree files.
