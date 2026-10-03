# Builder Stale Session Recovery Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Recover the Builder UI automatically when another tab or collaborator advances the persisted session version.

**Architecture:** Preserve HTTP status on Builder API errors with a focused typed error. When review, revision, or restore receives `409`, reload the owned session, replace the preview/history/review with the server-authoritative state, and explain the recovery without retrying the original mutation.

**Tech Stack:** React 18, TypeScript, Fetch, Express optimistic version guards, Vitest.

---

### Task 1: Typed Builder API Errors

**Files:**
- Modify: `src/app/api/exhibitionScene.ts`
- Test: `src/app/api/exhibitionScene.test.ts`

**Steps:**
1. Add a failing test proving a Builder `409` error retains its HTTP status.
2. Add a minimal `BuilderApiError` and use it for Builder endpoints.
3. Run the focused API test.

### Task 2: Server-Authoritative Session Refresh

**Files:**
- Modify: `src/app/modules/metaverse3d/components/UI/EditUI.tsx`
- Modify: `src/app/modules/metaverse3d/components/UI/EditUI.test.tsx`

**Steps:**
1. Add a failing UI test where restore returns `409` and the latest session loads successfully.
2. Add one helper that loads a session and atomically refreshes preview, versions, selection, review, baseline, and remembered session.
3. Use the helper after `409` from review, revision, or restore.
4. Do not automatically retry the stale mutation.

### Task 3: Recovery Messaging

**Files:**
- Modify: `src/app/i18n/catalogs/zh-TW.ts`
- Modify: `src/app/i18n/catalogs/zh-CN.ts`
- Modify: `src/app/i18n/catalogs/en.ts`

**Steps:**
1. Add localized recovery success and failure messages.
2. Show an informational toast after synchronization.
3. Preserve the original stale error only if refresh fails.

### Task 4: Integrated Verification

**Steps:**
1. Run Builder API, EditUI, i18n, orchestration, route, and persistence tests.
2. Run TypeScript, focused ESLint, server syntax check, and production build.
