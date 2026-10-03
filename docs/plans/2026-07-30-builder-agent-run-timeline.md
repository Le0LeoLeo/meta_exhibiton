# Builder Agent Run Timeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show editors how the current autonomous Builder run progressed through generation, capture, review, revision, completion, or cancellation.

**Architecture:** Record the existing typed `BuilderAgentStep` callbacks in component-local state. Render a bounded, accessible timeline with phase, iteration, and available technical/curatorial scores; reset it for each new or resumed run and never transmit prompt or trace data.

**Tech Stack:** React 18, TypeScript, Vitest, existing i18n catalogs.

---

### Task 1: Record Typed Run Steps

**Files:**
- Modify: `src/app/modules/metaverse3d/components/UI/EditUI.tsx`

**Steps:**
1. Reuse `BuilderAgentStep` for current progress and timeline state.
2. Reset timeline at run start.
3. Append orchestrator callbacks and intentional cancellation.
4. Bound retained steps to the latest twelve entries.

### Task 2: Accessible Timeline UI

**Files:**
- Modify: `src/app/modules/metaverse3d/components/UI/EditUI.tsx`
- Modify: `src/app/i18n/catalogs/zh-TW.ts`
- Modify: `src/app/i18n/catalogs/zh-CN.ts`
- Modify: `src/app/i18n/catalogs/en.ts`

**Steps:**
1. Render a timeline below current progress only when steps exist.
2. Show localized phase, human-readable iteration, and review scores when available.
3. Use list semantics and keep the current live status unchanged.

### Task 3: UI Verification

**Files:**
- Modify: `src/app/modules/metaverse3d/components/UI/EditUI.test.tsx`

**Steps:**
1. Extend the resumed-run test to verify capture, review, completion, and scores remain visible.
2. Verify a new run clears the previous timeline through component behavior.

### Task 4: Integrated Verification

**Steps:**
1. Run Builder UI, orchestration, API, i18n, routes, and persistence tests.
2. Run TypeScript, focused ESLint, server syntax check, and production build.
