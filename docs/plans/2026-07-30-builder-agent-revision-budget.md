# Builder Agent Revision Budget Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let editors choose how many automatic scene revisions the Builder Agent may perform in the next run.

**Architecture:** Add a local 0–3 revision budget control and pass it to the existing orchestrator. The runner already clamps requested revisions against both the client maximum and a resumed session's server-owned remaining revisions, so no server contract changes are required.

**Tech Stack:** React 18, TypeScript, Vitest, existing i18n catalogs.

---

### Task 1: Revision Budget Control

**Files:**
- Modify: `src/app/modules/metaverse3d/components/UI/EditUI.tsx`
- Modify: `src/app/i18n/catalogs/zh-TW.ts`
- Modify: `src/app/i18n/catalogs/zh-CN.ts`
- Modify: `src/app/i18n/catalogs/en.ts`

**Steps:**
1. Add local state defaulting to three revisions.
2. Render a labeled select for zero through three.
3. Explain that zero performs review without automatic modification.
4. Disable the control while an autonomous run is active.

### Task 2: Orchestrator Integration

**Files:**
- Modify: `src/app/modules/metaverse3d/components/UI/EditUI.tsx`

**Steps:**
1. Pass the selected value as `maxRevisions`.
2. Keep the runner's existing clamp against resumed-session remaining revisions.

### Task 3: UI Verification

**Files:**
- Modify: `src/app/modules/metaverse3d/components/UI/EditUI.test.tsx`

**Steps:**
1. Configure a review that requests changes.
2. Select a zero-revision budget and start the Agent.
3. Verify review runs, revision does not, and the revision-limit stop state appears.

### Task 4: Integrated Verification

**Steps:**
1. Run Builder UI, orchestrator, API, i18n, route, and persistence tests.
2. Run TypeScript, focused ESLint, server syntax check, and production build.
