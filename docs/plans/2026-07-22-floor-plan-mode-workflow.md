# Floor Plan Mode Workflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make floor-plan mode predictable by keeping the active edit tool, selected element, creation action, history status, and return-to-3D action in sync.

**Architecture:** Keep geometry mutations in the existing Zustand store and coordinate workflow-only behavior inside `FloorPlanUI`. Entering a mode is navigation, not a scene edit, so mode entry must not create history. UI copy will distinguish selecting an edit tool from creating a new element without changing the existing visual system.

**Tech Stack:** React 18, TypeScript, Zustand, React Three Fiber, Vitest, project i18n catalogs.

---

### Task 1: Prevent mode entry from creating a false dirty state

**Files:**
- Modify: `src/app/modules/metaverse3d/store/useMetaverseStudioStore.ts`
- Test: `src/app/modules/metaverse3d/store/useMetaverseStudioStore.test.ts`

**Step 1: Write the failing test**

Add a store test that calls `setMode("floor-plan")` and expects the synchronized floor plan to be available without increasing `undoStack.length`.

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/app/modules/metaverse3d/store/useMetaverseStudioStore.test.ts`

Expected: the new assertion fails because floor-plan entry currently calls `withHistory`.

**Step 3: Write minimal implementation**

Return `{ ...baseNextState, ...createSyncedFloorPlan(state) }` when entering floor-plan mode instead of wrapping the navigation transition with `withHistory`.

**Step 4: Run test to verify it passes**

Run the same focused test file and expect all tests to pass.

### Task 2: Keep edit target and selection synchronized

**Files:**
- Modify: `src/app/modules/metaverse3d/components/UI/FloorPlanUI.tsx`
- Test: `src/app/modules/metaverse3d/components/UI/FloorPlanUI.test.tsx`

**Step 1: Write the failing component tests**

Cover these behaviors:

1. Entering floor-plan mode with room edit active selects the first room when nothing is selected.
2. Switching to wall editing selects the first wall or clears selection when no wall exists.
3. Adding a room switches to room editing before creation; adding a wall switches to wall editing before creation.

**Step 2: Run tests to verify failure**

Run: `npm run test -- src/app/modules/metaverse3d/components/UI/FloorPlanUI.test.tsx`

Expected: selection and creation-tool assertions fail against the current independent callbacks.

**Step 3: Implement workflow handlers**

Add focused handlers in `FloorPlanUI`:

```ts
const selectEditTarget = (target: "room" | "wall") => {
  setFloorPlanEditTarget(target);
  const next = floorPlanElements.find((element) =>
    target === "room" ? element.type === "room" : element.type !== "room",
  );
  setSelectedFloorPlanElementId(next?.id ?? null);
};

const addElement = (type: "room" | "wall") => {
  setFloorPlanEditTarget(type);
  addFloorPlanElement(type);
};
```

Add an entry effect that selects the first element matching the active target only when no valid selection exists.

**Step 4: Run tests to verify pass**

Run the focused component and store tests.

### Task 3: Clarify edit tools versus creation actions

**Files:**
- Modify: `src/app/modules/metaverse3d/components/UI/FloorPlanTopBar.tsx`
- Modify: `src/app/i18n/catalogs/zh-TW.ts`
- Modify: `src/app/i18n/catalogs/zh-CN.ts`
- Modify: `src/app/i18n/catalogs/en.ts`

**Step 1: Add explicit labels**

Create separate translation keys for `Edit rooms`, `Edit walls`, `Add room`, and `Add wall`.

**Step 2: Update button semantics**

Use the edit labels in the target selector and add labels in creation actions. Add `aria-pressed` to the active edit tool and descriptive `title` attributes for keyboard/mouse users.

**Step 3: Verify accessible names**

Render the page and confirm the DOM exposes four distinct button names rather than two duplicated `Room` and `Wall` names.

### Task 4: Validate the complete workflow visually

**Files:**
- Update: `docs/testing/local-manual-test-account.md`

**Step 1: Run focused tests**

Run:

```text
npm run test -- src/app/modules/metaverse3d/store/useMetaverseStudioStore.test.ts src/app/modules/metaverse3d/components/UI/FloorPlanUI.test.tsx
```

**Step 2: Run production build**

Run: `npm run build`

Expected: Vite build exits successfully.

**Step 3: Browser verification**

Verify this sequence in the local editor:

1. Enter floor-plan mode and confirm a room is visibly selected without a false dirty warning.
2. Choose `Edit walls`; selection becomes a wall or a clear empty state.
3. Choose `Add wall`; the new wall is selected and editable immediately.
4. Apply and return to 3D; confirm the wall appears in the 3D editor.

**Step 4: Record the handoff**

Append the verified behavior and test commands to the ignored local QA handoff file.
