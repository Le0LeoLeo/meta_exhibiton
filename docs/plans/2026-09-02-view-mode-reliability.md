# View Mode Reliability Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the five reviewed viewing-mode integration defects and cover them with regression tests.

**Architecture:** Preserve the existing scene/editor architecture and uncommitted work. Guard history operations in view mode, give the app sole ownership of AI overlays, isolate keyboard input, and gate visitor-memory persistence on successful per-exhibition initialization. Obtain comment-deletion capability from the existing server owner policy rather than comparing display names.

**Tech Stack:** React 18, Zustand, TypeScript, Express, Vitest, Testing Library.

---

Execution note: the user authorized implementation in this task. The referenced executing-plans skill is unavailable; execute locally using Karpathy Guidelines, without creating another worktree, task, or commits over the user's existing changes.

### Task 1: Viewing history guard

Files: `src/app/features/metaverse-studio/canvas/useGlobalStudioShortcuts.ts`, its new `.test.tsx`, `src/app/modules/metaverse3d/store/useMetaverseStudioStore.ts`, and its `.test.ts`.

1. Add failing tests for Ctrl/Cmd+Z and redo in view mode; assert scene/history stay unchanged and editor history still works.
2. Run `npm run test -- src/app/features/metaverse-studio/canvas/useGlobalStudioShortcuts.test.tsx src/app/modules/metaverse3d/store/useMetaverseStudioStore.test.ts` (new cases should fail).
3. Guard shortcuts with `if (mode === "view") return;` and store actions with `if (state.mode === "view") return {};`.
4. Rerun the tests; expect pass.

### Task 2: Single AI overlay owner

Files: `src/app/features/metaverse-studio/app/MetaverseStudioApp.tsx`, `src/app/features/metaverse-studio/canvas/StudioCanvasRoot.tsx`, new `app/MetaverseStudioApp.view.test.tsx`.

1. Render the real app plus CanvasRoot with only rendering/network leaves mocked; assert one selector and one chat panel, and no chat panel in edit mode.
2. Run the integration test; expect duplicate-selector/chat failures.
3. Remove CanvasRoot's AI overlays; gate the app's chat panel on view mode, selected participation, and AI participation.
4. Rerun app and CanvasRoot tests; expect pass.

### Task 3: Keyboard and overlay input isolation

Files: `src/app/modules/metaverse3d/input/isTypingTarget.ts`, `input/usePlayerKeyboardInput.ts` and tests, `components/Player.tsx`, `components/UI/ViewUI.tsx`, `features/metaverse-studio/canvas/StudioCanvasRoot.tsx`.

1. Test typing targets, keyup after focus change, blur cleanup, disabled controls, and normal movement; test arrow keys in comment fields do not navigate.
2. Run tests to expose failures.
3. Share typing-target detection, gate/reset keyboard controls and player input during overlays, release pointer lock, hide mobile controls during blocking overlays. Preserve agent tour movement while chat is open.
4. Rerun input, view UI and CanvasRoot tests.

### Task 4: Exhibition-scoped visitor memory

Files: `src/app/modules/metaverse3d/components/UI/ViewUI.tsx` and `.test.tsx`; add a focused visitor-memory hook if required to keep ViewUI manageable.

1. Test A-to-B with null memory, delayed hydration, stale responses, failed reads, unmount, and edit mode (no persistence).
2. Run new cases; expect failures with the current eager-save implementation.
3. Reset exhibition-specific memory at scope changes, initialize from the matching response, and save only after successful hydration. A failed read must not overwrite server memory. Cancel stale loads and timers.
4. Rerun memory and agent tests; verify legitimate restored preferences and current-session visits survive.

### Task 5: Server-authoritative comment deletion capability

Files: `server/routes/galleryRoutes.js` and `.test.js`, `src/app/modules/metaverse3d/components/UI/ViewUI.tsx` and `.test.tsx`.

1. Test owner/non-owner capability and UI deletion of another author's comment by the owner only.
2. Run tests; expect failure before capability is exposed.
3. Return `canDelete: optionalAuth(req)?.sub === authorized.gallery.owner_id` with the comments response, send existing auth credentials when reading comments, and render/execute deletion only with that capability. Keep DELETE's owner check unchanged.
4. Run route and UI tests; expect pass.

### Final verification

Run the focused tests, then `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build`. Report unrelated baseline failures separately; do not broaden changes to repair them. Inspect the task's diff and retain all unrelated work.

### Execution record

- Completed all five fixes and their regression tests. Also guarded late AI replies/TTS by visitor-session ID and keyed the chat panel by session to prevent cross-exhibition state leakage.
- Added coverage for visits recorded during memory hydration and mobile controls behind blocking overlays.
- Type checking, lint, production build, server syntax checks (133 files), bundle-size gates, and the scoped whitespace check passed.
- In-app browser check: opened a public exhibition, confirmed a single participation selector and AI panel, typed in the chat field without submitting, and switched between 2D content and 3D. No browser errors were reported. Authenticated deletion and remote AI responses were tested with mocks, not live external writes.
- Focused regression checks passed: the six-file core run passed 91 tests; the later app/view/chat run passed all cases except the newly reproduced stale-AI-response case, which passed its isolated rerun after the fix. The added hydration-merge and mobile-overlay cases passed in that later run.
- The first full test attempt encountered default-timeout failures while other tests/builds were running. It was stopped and restarted with `npm run test -- --maxWorkers=2 --testTimeout=15000 --hookTimeout=15000`. The rerun finished normally with exit code 0: **191 files passed, 1 skipped; 1,527 tests passed, 1 skipped** in 1,025.67 seconds. The skipped multiplayer integration test requires `REDIS_TEST_URL`, which was not configured. A stop request sent during the final poll returned the already-completed successful result; the full suite did complete.
- The shared Vitest result cache contains outcomes from multiple runs, including old failures; it was not used as proof of this run's completion.
- No commits made; unrelated pre-existing and concurrent workspace edits were preserved.
