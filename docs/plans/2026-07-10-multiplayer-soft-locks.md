# Multiplayer Soft Locks Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent editors from selecting or transforming an item another active editor is focusing.

**Architecture:** Reuse existing `scene:focus` presence events as advisory locks. The active exhibit component reads remote focuses, prevents local selection and transform controls for focused items, while the existing editor panel communicates who is editing.

**Tech Stack:** React, React Three Fiber, Zustand, Vitest.

---

### Task 1: Guard remote-focused exhibits

**Files:**
- Modify: `src/app/features/metaverse-studio/exhibits/ExhibitItem.tsx`
- Test: `src/app/features/metaverse-studio/exhibits/ExhibitItem.test.ts`

1. Add a pure helper that identifies remote focus for an item.
2. Block selection and transform controls when the helper reports a remote focus.
3. Test the helper with matching and nonmatching editor focuses.

### Task 2: Verify

**Files:**
- Test: `src/app/features/metaverse-studio/exhibits/ExhibitItem.test.ts`

1. Run the focused exhibit and multiplayer tests.
2. Build the frontend to verify the Three.js component types.
