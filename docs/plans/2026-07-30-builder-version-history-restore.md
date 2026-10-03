# Builder Version History And Restore Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users inspect persisted Builder versions, compare them with the current scene, and safely restore an earlier version.

**Architecture:** Restoring never mutates an existing version. The server validates session ownership and the expected current version, clones the selected historical snapshot into a newly identified current version, and appends it using the existing optimistic SQLite update. The frontend presents persisted versions, review scores, a scene-diff summary, and a restore action that refreshes the active preview.

**Tech Stack:** Express ESM, SQLite, Zod, React 18, TypeScript, Vitest.

---

### Task 1: Immutable Restore Service

**Files:**
- Modify: `server/services/exhibitionBuilderAgentService.js`
- Modify: `server/services/exhibitionBuilderAgentService.test.js`

**Steps:**
1. Add a failing test proving restore clones the selected snapshot with a new version id.
2. Preserve exhibition, scene, source, warnings, and review while retaining the session's current AI revision count.
3. Run the focused service test.

### Task 2: Guarded Restore Route

**Files:**
- Modify: `server/routes/exhibitionSceneRoutes.js`
- Modify: `server/routes/exhibitionSceneRoutes.test.js`
- Modify: `server/config/deps.js`

**Steps:**
1. Add failing route tests for success, unknown target, foreign owner, and stale expected version.
2. Add `POST /api/ai/exhibition-builder/sessions/:sessionId/restore`.
3. Validate `expectedVersionId` and `targetVersionId`.
4. Load the owned session, find the historical version, clone it, and append via the existing optimistic guard.
5. Run route tests.

### Task 3: Frontend Restore Client

**Files:**
- Modify: `src/app/api/exhibitionScene.ts`
- Modify: `src/app/api/exhibitionScene.test.ts`

**Steps:**
1. Add the restore request function and payload.
2. Test URL, auth header, and request body.
3. Run API tests.

### Task 4: Version Comparison And Restore UI

**Files:**
- Modify: `src/app/modules/metaverse3d/components/UI/EditUI.tsx`
- Modify: `src/app/modules/metaverse3d/components/UI/EditUI.test.tsx`
- Modify: `src/app/i18n/catalogs/zh-TW.ts`
- Modify: `src/app/i18n/catalogs/zh-CN.ts`
- Modify: `src/app/i18n/catalogs/en.ts`

**Steps:**
1. Preserve restored version history in component state.
2. Render each version with status, revision number, and review scores.
3. Let the user select a version and display its scene diff against the current preview.
4. Restore a non-current version through the guarded endpoint and refresh the active preview/history.
5. Disable restore while running or for the current version.
6. Run EditUI and catalog tests.

### Task 5: Integrated Verification

**Steps:**
1. Run service, route, API, EditUI, i18n, and existing Builder tests.
2. Run `npm run typecheck`.
3. Run focused ESLint and `npm run check:server`.
4. Run `git diff --check` for this plan's files.
