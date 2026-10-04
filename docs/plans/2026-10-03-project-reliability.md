# Project reliability implementation plan

**Goal:** Resolve the reviewed draft-loss, AI timeout, language preference and duplicated studio-state issues, and complete local browser acceptance.

**Architecture:** Reuse the existing unsaved-change guard and request timeout constants. Keep the active studio store as the behavior reference while consolidating its duplicated actions. Preserve saved-scene, authorization, evidence-selection and human-review boundaries.

**Tech Stack:** React 18, TypeScript, Zustand, Vite, Express, SQLite, Vitest and Playwright.

## Scope and execution

The user authorized implementation after the project analysis and then explicitly instructed **do not deploy**. Work continues locally in this session with independent file ownership. Preserve existing changes; do not commit, push or switch branches. Historical deployment and browser results are context only.

## Task 1: Protect teacher curation drafts

Files: `src/app/features/graduation/CurationPanel.tsx` and its focused tests.

1. Cover navigation/reload and replacement of unsaved edits, including a cancelled discard.
2. Register dirty or pending state with the existing `useUnsavedChanges` mechanism.
3. Confirm replacement before generating another suggestion; clear dirty state only after a successful save.
4. Run the focused curation and graduation component tests.

## Task 2: Give AI responses sufficient transport time

Files: `src/app/api/graduation.ts`, `src/app/api/skills.ts`, `src/app/api/cv.ts` and focused API tests.

1. Trace every graduation/CV AI generation call.
2. Use the existing long request deadline for those calls while keeping normal CRUD deadlines unchanged.
3. Verify a response after the normal deadline remains available, normal requests still time out, and cancellation/error handling is retained.

## Task 3: Preserve the visitor's chosen language

Files: `src/app/pages/CompetitionDemo.tsx` and its existing test.

1. Remove the global locale mutation from the English demonstration page.
2. Retain the page's English practice content and preserve navigation/authentication behavior.
3. Verify the surrounding application keeps the saved language preference.

## Task 4: Consolidate live studio actions

Files: `src/app/modules/metaverse3d/store/useMetaverseStudioStore.ts`, `agentSlice.ts`, `selectionSlice.ts`, related types and focused store tests.

1. Compare the live implementations and extracted actions, especially focus cleanup and tour lifecycle.
2. Use one implementation for each action without changing active behavior or saved-state format.
3. Test the composed live store, including focus cleanup, selection removal and tour transitions.
4. Run related agent, selection, history and multiplayer regressions.

## Task 5: Resolve and verify browser acceptance

Files: `e2e/editor-ai-builder.spec.ts`, relevant test infrastructure, and product code only when current failure evidence identifies a product defect.

1. Build the isolated browser candidate and rerun failed builder cases.
2. Inspect trace/network/rendered screenshots and distinguish fixture, transport, product and environment failures.
3. Fix demonstrated causes; preserve functional assertions and do not raise deadlines merely to obtain a pass.
4. Verify uploads, preview/apply/save, locked originals, rejected/no-op results, mobile viewing, curation draft protection, and the student/teacher workflow.

## Task 6: Local validation

1. Run server syntax, avatar, type, lint and all unit tests; retain failed attempts and resolve candidate failures.
2. Build into a fresh isolated directory and verify that directory's bundle budgets.
3. Record the final local change boundary, test results, browser screenshots and remaining evidence limits.
4. Do not package, upload or deploy a production release. The user's no-deployment instruction supersedes the earlier release step.

## Execution record

### Implemented and verified locally

- Curation registers dirty/pending state with the shared navigation/reload guard. Replacing a draft requires confirmation; cancellation and failed saves preserve it. Focused graduation/curation/demo checks: 41 passed.
- Graduation curation, skill suggestions and CV suggestions use the existing 60-second transport deadline. CRUD retains 15 seconds; cancellation and structured errors remain intact. Focused transport/CV checks: 33 passed.
- The English orientation page preserves the saved global locale and marks its own content as English.
- The live studio composes its agent and selection slices. Independent AST comparison confirmed all 107 state/action initializers and persistence configuration match the baseline. Related store checks: 120 passed.
- Two competition browser flows passed, including real local API/SQLite student-to-teacher publication, curation discard/save protection and mobile language preservation. The model response is a deterministic fixture.

### Additional failures found by complete validation

- The first broad browser run completed with 18 passed, 2 failed and 1 deliberately skipped live-provider case. All four offline builder cases and multiplayer recovery passed. The two failures were an empty scene after wizard publication and a student skill test that skipped the current workflow's first step.
- The student skill fixture now advances through the actual first step; its focused browser rerun passed.
- Wizard trace: the AI fixture returned one artwork, but the subsequent save request already contained no items. Three focused multiplayer tests reproduced a late initial room snapshot overwriting local layout changes. The saved-scene baseline fix and final browser acceptance are in progress.
- The first full unit run had 2,627 passed and 1 skipped, but exited unsuccessfully because discovery included two temporary backup test files from concurrent work. Those failed to load; no assertion failed. Vitest now excludes `**/.tmp/**`, and discovery confirms 320 source test files with no temporary paths. A clean full run is in progress.
- Other edits appeared in the shared checkout while this task ran. They remain untouched; the final change manifest distinguishes the files owned by this task.

Final build, bundle checks and verification results are pending. Logs and screenshots are under `.tmp/project-reliability-20261003/`; the pre-change source snapshot is outside the app at `../.codex_tmp/project-reliability-20261003/baseline/` so it cannot enter test discovery.

A read-only remote check before the no-deployment instruction found no running MetaEXB Compose project at the documented host; the public domain served Home Memory. No remote service or configuration was changed. Deployment documentation must be reconciled before any separately authorized future release.
