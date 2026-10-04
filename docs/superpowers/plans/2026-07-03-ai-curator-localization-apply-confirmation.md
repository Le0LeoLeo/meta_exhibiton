# AI Curator Localization and Apply Confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Localize the AI Curator panel to Traditional Chinese and require confirmation before applying generated plans.

**Architecture:** Keep all behavior in `AiCuratorPanel` local state. Reuse the existing plan preview and scene mapper; add only an inline confirmation summary before calling `importScene`.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, Tailwind CSS.

---

### Task 1: Panel Localization and Confirmation

**Files:**
- Modify: `src/app/modules/metaverse3d/components/UI/AiCuratorPanel.tsx`
- Test: `src/app/modules/metaverse3d/components/UI/AiCuratorPanel.test.tsx`

- [ ] **Step 1: Update the test expectations first**

Change the test to use Traditional Chinese labels and assert the two-step apply flow:

```tsx
fireEvent.change(screen.getByLabelText("展覽主題"), {
  target: { value: "澳門非遺文化展" },
});
fireEvent.click(screen.getByRole("button", { name: "生成策展方案" }));
await screen.findByText("澳門非遺文化展");

fireEvent.click(screen.getByRole("button", { name: "套用到展廳" }));
expect(importScene).not.toHaveBeenCalled();
expect(screen.getByText("即將取代目前展廳草稿")).toBeInTheDocument();

fireEvent.click(screen.getByRole("button", { name: "確認套用" }));
expect(importScene).toHaveBeenCalledTimes(1);
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm run test -- src/app/modules/metaverse3d/components/UI/AiCuratorPanel.test.tsx`

Expected: FAIL because the component still renders English copy and applies immediately.

- [ ] **Step 3: Implement the component changes**

Add `isConfirmingApply` state. Clear it when generating or discarding. Change the first apply click to show the confirmation summary, and add a second confirm button that calls the existing scene import.

- [ ] **Step 4: Run the panel test**

Run: `npm run test -- src/app/modules/metaverse3d/components/UI/AiCuratorPanel.test.tsx`

Expected: PASS with 2 tests.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/app/modules/metaverse3d/components/UI/AiCuratorPanel.tsx src/app/modules/metaverse3d/components/UI/AiCuratorPanel.test.tsx
git commit -m "feat: localize ai curator apply confirmation" -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```
