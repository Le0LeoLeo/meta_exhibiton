# Builder Agent Evaluation Summary Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Summarize measurable score changes and work performed during the current Builder Agent run.

**Architecture:** Derive a pure summary from the existing bounded `BuilderAgentStep` timeline. Use only completed review scores and revision events to report first/latest technical and curatorial scores, deltas, review count, and revision count; do not add AI calls or invent a composite score.

**Tech Stack:** TypeScript, React 18, Vitest, existing i18n catalogs.

---

### Task 1: Pure Run Summary

**Files:**
- Create: `src/app/modules/metaverse3d/aiBuilder/summarizeBuilderAgentRun.ts`
- Create: `src/app/modules/metaverse3d/aiBuilder/summarizeBuilderAgentRun.test.ts`

**Steps:**
1. Add a failing test with two scored reviews and one revision.
2. Return first/latest scores, signed deltas, scored review count, and revision count.
3. Return `null` when no completed review score exists.
4. Run the focused helper test.

### Task 2: Evaluation Summary UI

**Files:**
- Modify: `src/app/modules/metaverse3d/components/UI/EditUI.tsx`
- Modify: `src/app/i18n/catalogs/zh-TW.ts`
- Modify: `src/app/i18n/catalogs/zh-CN.ts`
- Modify: `src/app/i18n/catalogs/en.ts`

**Steps:**
1. Derive the summary from the current run timeline.
2. Render review/revision counts and technical/curatorial score movement.
3. Keep raw timeline details available beneath the summary.

### Task 3: UI Verification

**Files:**
- Modify: `src/app/modules/metaverse3d/components/UI/EditUI.test.tsx`

**Steps:**
1. Verify a completed run shows the evaluation title, counts, and score movement.
2. Ensure the summary is absent before any scored review.

### Task 4: Integrated Verification

**Steps:**
1. Run helper, Builder UI, orchestration, API, i18n, route, and persistence tests.
2. Run TypeScript, focused ESLint, server syntax check, and production build.
