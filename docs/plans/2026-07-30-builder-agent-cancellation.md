# Builder Agent Cancellation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let editors cancel an in-progress autonomous Builder run without showing a failure or allowing stale results to replace the preview.

**Architecture:** Use one browser `AbortController` per autonomous run. Thread its signal through the Builder orchestrator and existing API transport, check cancellation between screenshot/review/revision phases, and treat the typed transport abort as an intentional stop in the UI. Cancellation is client-scoped; persisted versions already completed by the server remain available through session history.

**Tech Stack:** React 18, TypeScript, Fetch AbortSignal, Vitest.

---

### Task 1: Abort-Aware Builder API

**Files:**
- Modify: `src/app/api/exhibitionScene.ts`
- Test: `src/app/api/exhibitionScene.test.ts`

**Steps:**
1. Add a failing test proving the Builder start request forwards a caller signal.
2. Add an optional `AbortSignal` argument to start, review, and revision requests.
3. Run the focused API tests.

### Task 2: Abort-Aware Agent Orchestration

**Files:**
- Modify: `src/app/modules/metaverse3d/aiBuilder/runExhibitionBuilderAgent.ts`
- Test: `src/app/modules/metaverse3d/aiBuilder/runExhibitionBuilderAgent.test.ts`

**Steps:**
1. Add a failing test proving cancellation after capture prevents review.
2. Accept a signal, pass it to all network dependencies, and check it between phases.
3. Run the orchestrator tests.

### Task 3: Cancel Control And Intentional Stop Handling

**Files:**
- Modify: `src/app/modules/metaverse3d/components/UI/EditUI.tsx`
- Modify: `src/app/modules/metaverse3d/components/UI/EditUI.test.tsx`
- Modify: `src/app/i18n/catalogs/zh-TW.ts`
- Modify: `src/app/i18n/catalogs/zh-CN.ts`
- Modify: `src/app/i18n/catalogs/en.ts`

**Steps:**
1. Add a run-scoped controller and cancel action.
2. Abort on explicit cancellation and component unmount.
3. Keep the latest completed preview/version, mark progress stopped, and avoid failure toast for intentional cancellation.
4. Render a localized cancel button only while the autonomous agent is active.
5. Add a UI test covering the cancel interaction.

### Task 4: Integrated Verification

**Steps:**
1. Run API, orchestrator, EditUI, and catalog tests.
2. Run TypeScript, focused ESLint, server syntax check, and production build.
