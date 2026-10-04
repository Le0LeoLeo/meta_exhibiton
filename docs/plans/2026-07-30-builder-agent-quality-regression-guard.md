# Builder Agent Quality Regression Guard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stop autonomous exhibition revisions when a new review reveals a material quality regression, even if another score improves.

**Architecture:** Classify consecutive reviews as improved, unchanged, or regressed using the existing three-point improvement threshold and a two-point noise tolerance. Treat new high-severity blockers or a score drop beyond that tolerance as regression, then surface a dedicated stop reason through the existing Agent status UI.

**Tech Stack:** TypeScript, React 18, Vitest, project i18n catalogs.

---

### Task 1: Specify quality-change behavior

**Files:**
- Modify: `src/app/modules/metaverse3d/aiBuilder/runExhibitionBuilderAgent.test.ts`

Add tests proving that a new high-severity blocker and a material score drop override an otherwise positive score change.

### Task 2: Classify consecutive reviews

**Files:**
- Modify: `src/app/modules/metaverse3d/aiBuilder/runExhibitionBuilderAgent.ts`

Add a small pure classifier with explicit thresholds. Preserve `didReviewImprove` as a compatibility wrapper.

### Task 3: Stop on regression

**Files:**
- Modify: `src/app/modules/metaverse3d/aiBuilder/runExhibitionBuilderAgent.ts`
- Modify: `src/app/modules/metaverse3d/components/UI/EditUI.tsx`

Return a distinct `quality_regression` stop reason and allow the existing preview-only status card to display it.

### Task 4: Localize and verify

**Files:**
- Modify: `src/app/i18n/catalogs/en.ts`
- Modify: `src/app/i18n/catalogs/zh-CN.ts`
- Modify: `src/app/i18n/catalogs/zh-TW.ts`

Add the three localized stop messages, then run focused tests, the AI Builder regression suite, typecheck, server syntax check, focused lint, and production build.
