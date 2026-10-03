# Builder Agent Resume Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Continue autonomous review and improvement from the current persisted Builder version instead of always creating a new session.

**Architecture:** Allow the client orchestrator to accept an optional initial session. A resumed run skips generation, starts with capture/review, and computes its remaining revision budget from the server-owned `revisionCount`; all existing cancellation and stale-session recovery remains active.

**Tech Stack:** React 18, TypeScript, Fetch AbortSignal, Vitest.

---

### Task 1: Resumable Orchestrator

**Files:**
- Modify: `src/app/modules/metaverse3d/aiBuilder/runExhibitionBuilderAgent.ts`
- Test: `src/app/modules/metaverse3d/aiBuilder/runExhibitionBuilderAgent.test.ts`

**Steps:**
1. Add a failing test proving an initial session skips `requestBuilderSession`.
2. Derive remaining revisions as `3 - initialSession.revisionCount`.
3. Start the resumed run at capture/review and preserve cancellation checks.
4. Run orchestrator tests.

### Task 2: Resume From Builder UI

**Files:**
- Modify: `src/app/modules/metaverse3d/components/UI/EditUI.tsx`
- Modify: `src/app/modules/metaverse3d/components/UI/EditUI.test.tsx`

**Steps:**
1. Pass the current preview as `initialSession` when autonomous mode starts from an existing session.
2. Keep starting a new session when no preview exists.
3. Verify a restored session can continue without calling the start endpoint.

### Task 3: Localized Resume State

**Files:**
- Modify: `src/app/i18n/catalogs/zh-TW.ts`
- Modify: `src/app/i18n/catalogs/zh-CN.ts`
- Modify: `src/app/i18n/catalogs/en.ts`

**Steps:**
1. Add localized labels for starting and continuing autonomous Builder operation.
2. Keep the cancel/cancelling labels unchanged.

### Task 4: Integrated Verification

**Steps:**
1. Run Builder orchestration, EditUI, API, i18n, route, and persistence tests.
2. Run TypeScript, focused ESLint, server syntax check, and production build.
