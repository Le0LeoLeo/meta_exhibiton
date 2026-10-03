# Builder Version Review Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep the current AI Builder version history synchronized with manual and automatic scene-review results without requiring a reload.

**Architecture:** Treat each review response as a version-scoped state update. Update the active review panel and merge the persisted review metadata into the matching in-memory version, while preserving session boundaries and existing immutable version records.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, i18n catalogs.

---

### Task 1: Capture the stale history behavior

**Files:**
- Modify: `src/app/modules/metaverse3d/components/UI/EditUI.test.tsx`

Add focused UI coverage proving that a completed manual review immediately replaces the version's “not reviewed” label, and that an unavailable review receives its own history status.

### Task 2: Synchronize review responses

**Files:**
- Modify: `src/app/modules/metaverse3d/components/UI/EditUI.tsx`

Add one version-scoped review application helper and use it for manual reviews and every automatic-agent review result.

### Task 3: Represent unavailable reviews accurately

**Files:**
- Modify: `src/app/modules/metaverse3d/components/UI/EditUI.tsx`
- Modify: `src/app/i18n/catalogs/en.ts`
- Modify: `src/app/i18n/catalogs/zh-CN.ts`
- Modify: `src/app/i18n/catalogs/zh-TW.ts`

Distinguish “review unavailable” from “not reviewed” in version history.

### Task 4: Verify the integration

Run the focused UI and catalog tests, the AI Builder regression suite, TypeScript and server checks, focused lint, and a production build.
