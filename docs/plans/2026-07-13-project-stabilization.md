# Project Stabilization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the current large, partially refactored workspace into a reproducible, secure baseline, then enforce a stable public boundary around the Metaverse Studio without a risky big-bang rewrite.

**Architecture:** Stabilize the repository before moving code. Protect runtime data, make validation deterministic, repair only audit-confirmed localization gaps, and introduce executable module-boundary checks. Migrate consumers through `src/app/features/metaverse-studio/index.ts` first; legacy internals remain behind that facade until later vertical slices can be moved independently.

**Tech Stack:** npm, Vite 6, React 18, React Router, Vitest, Tailwind CSS 4, React Three Fiber, Three.js, Zustand, Express 5, SQLite, Socket.IO.

---

## Execution prerequisites

- The current workspace contains many modified and untracked files. Do not stash, discard, or auto-commit them.
- Before executing Task 1, the owner must review and checkpoint the current work on its existing branch. The stabilization work should then run in a dedicated worktree created from that reviewed checkpoint.
- Run all npm commands from `D:\meta_exb\web_ui_new`. Run the root Python audit from `D:\meta_exb`.
- Every AI-authored commit must include `Co-Authored-By: GPT-5 Codex <noreply@openai.com>`.

## Definition of done

- `server/app.db`, uploads, environment secrets, logs, and generated output are not tracked.
- `npm run check` completes successfully twice from a clean checkout.
- The root i18n audit test passes and the generated report contains no missing locale keys.
- Page code imports Metaverse Studio capabilities only through `@/app/features/metaverse-studio`.
- Existing editor, viewer, floor-plan, multiplayer, Agent, scene import/export, and WebGL fallback tests remain green.
- Production documentation states the supported single-process deployment topology and the trigger for adopting shared state.

---

### Task 1: Capture a reproducible validation baseline

**Files:**
- Modify only if a failure is proven: `package.json`
- Modify only if a failure is proven: `vite.config.ts`
- Modify only if a failure is proven: the exact failing `*.test.*` file or its production dependency
- Record results: `docs/plans/2026-07-13-project-stabilization.md`

**Step 1: Confirm the reviewed checkpoint is clean**

Run:

```powershell
git status --short
git branch --show-current
git rev-parse --short HEAD
```

Expected: no unreviewed changes in the dedicated worktree; record branch and commit in the execution notes.

**Step 2: Run validation stages separately with visible progress**

Run:

```powershell
npm run check:server
npm run test -- --reporter=verbose
npm run build
```

Expected: each command exits `0`. Do not use a single short outer timeout as evidence of failure.

**Step 3: If Vitest does not exit, isolate the responsible file**

Run test directories independently:

```powershell
npm run test -- server --reporter=verbose
npm run test -- src/app/api --reporter=verbose
npm run test -- src/app/modules/metaverse3d --reporter=verbose
npm run test -- src/app/features/metaverse-studio --reporter=verbose
npm run test -- src/app/pages --reporter=verbose
```

Expected: one group identifies the last test reached. Bisect that group file-by-file. Fix the leaked timer, socket, server, listener, or un-restored mock in the owning test; do not hide the leak with `process.exit`.

**Step 4: Add a regression test before fixing any discovered defect**

Use the nearest existing test file. The regression must reproduce the exact open handle or behavior and fail before the production fix.

**Step 5: Run the complete gate twice**

Run:

```powershell
npm run check
npm run check
```

Expected: both runs exit `0`; the second run proves that generated state from the first run does not affect validation.

**Step 6: Commit only proven baseline fixes**

```powershell
git add package.json vite.config.ts src server
git commit -m "test: stabilize project validation baseline" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

Expected: skip this commit if no code change was required.

---

### Task 2: Prevent runtime data from entering Git

**Files:**
- Create: `scripts/check-runtime-artifacts.mjs`
- Create: `scripts/check-runtime-artifacts.test.mjs`
- Modify: `package.json`
- Verify: `.gitignore`
- Untrack without deleting locally: `server/app.db`

**Step 1: Write the failing checker test**

Create `scripts/check-runtime-artifacts.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { findForbiddenTrackedPaths } from './check-runtime-artifacts.mjs';

test('rejects tracked runtime and secret files', () => {
  assert.deepEqual(
    findForbiddenTrackedPaths([
      'src/app/App.tsx',
      'server/app.db',
      'server/uploads/image.png',
      '.env',
      '.env.example',
    ]),
    ['server/app.db', 'server/uploads/image.png', '.env'],
  );
});
```

**Step 2: Run the test and verify it fails**

Run:

```powershell
node --test scripts/check-runtime-artifacts.test.mjs
```

Expected: FAIL because `check-runtime-artifacts.mjs` does not exist.

**Step 3: Implement the checker**

Create `scripts/check-runtime-artifacts.mjs`:

```js
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const forbiddenPatterns = [
  /^server\/uploads\//,
  /\.db(?:-shm|-wal)?$/,
  /^\.env(?:\..+)?$/,
  /\.log$/,
  /^(?:dist|build)\//,
];

export function findForbiddenTrackedPaths(paths) {
  return paths
    .map((path) => path.replaceAll('\\', '/'))
    .filter((path) => path !== '.env.example')
    .filter((path) => forbiddenPatterns.some((pattern) => pattern.test(path)))
    .sort();
}

function main() {
  const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
  const forbidden = findForbiddenTrackedPaths(tracked);

  if (forbidden.length > 0) {
    console.error(`Tracked runtime artifacts:\n${forbidden.join('\n')}`);
    process.exitCode = 1;
    return;
  }

  console.log('No runtime artifacts are tracked.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
```

**Step 4: Add the checker to declared scripts**

Add to `package.json`:

```json
"check:runtime": "node scripts/check-runtime-artifacts.mjs",
"check": "npm run check:runtime && npm run check:server && npm run test && npm run build"
```

**Step 5: Untrack the database without deleting the local file**

Run:

```powershell
git rm --cached -- server/app.db
```

Expected: Git stages deletion of `server/app.db`; the local database remains on disk because `.gitignore` already covers `*.db`.

**Step 6: Verify the checker and full gate**

Run:

```powershell
node --test scripts/check-runtime-artifacts.test.mjs
npm run check:runtime
npm run check
```

Expected: PASS; `git ls-files server/app.db` prints nothing.

**Step 7: Commit**

```powershell
git add .gitignore package.json scripts/check-runtime-artifacts.mjs scripts/check-runtime-artifacts.test.mjs server/app.db
git commit -m "chore: prevent runtime artifacts from being tracked" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

---

### Task 3: Make localization completeness an executable gate

**Files:**
- Modify only for current audit findings: `src/app/components/I18nProvider.tsx`
- Modify only for hard-coded UI found by the audit: `src/app/pages/MyExhibitions.tsx`
- Modify only for hard-coded UI found by the audit: `src/app/pages/Register.tsx`
- Modify only for hard-coded UI found by the audit: `src/app/pages/Support.tsx`
- Modify: `package.json`
- Verify: `D:\meta_exb\audit_i18n.py`
- Verify: `D:\meta_exb\test_audit_i18n.py`
- Regenerate: `D:\meta_exb\i18n_audit_report.md`

**Step 1: Regenerate evidence instead of relying on the old report**

Run from `D:\meta_exb`:

```powershell
python audit_i18n.py
python -m unittest test_audit_i18n.py -v
```

Expected: the audit writes the current report. If the unittest already passes, do not edit translations merely because an older report listed gaps.

**Step 2: For each current missing key, write a provider test first**

Extend `src/app/components/I18nProvider.test.tsx` with one representative assertion per affected locale group. Follow its existing render helper and assert that `t(key)` returns translated text instead of the key itself.

**Step 3: Add only the audit-confirmed translations**

Add each key to all three dictionaries in `I18nProvider.tsx`:

```ts
'zh-TW': { exampleKey: '繁體中文文字' },
'zh-CN': { exampleKey: '简体中文文字' },
en: { exampleKey: 'English text' },
```

Keep interpolation placeholders identical across locales. Replace hard-coded page text with `t('key')` only where the current audit identifies it.

**Step 4: Add an npm script for the repository-level audit**

Add to `web_ui_new/package.json`:

```json
"check:i18n": "python ../audit_i18n.py && python -m unittest ../test_audit_i18n.py -v",
"check": "npm run check:runtime && npm run check:i18n && npm run check:server && npm run test && npm run build"
```

**Step 5: Verify targeted tests and the report**

Run:

```powershell
npm run test -- src/app/components/I18nProvider.test.tsx
npm run check:i18n
npm run check
```

Expected: all exit `0`; the report has no missing-key section.

**Step 6: Commit**

```powershell
git add package.json src/app/components/I18nProvider.tsx src/app/components/I18nProvider.test.tsx src/app/pages/MyExhibitions.tsx src/app/pages/Register.tsx src/app/pages/Support.tsx ..\i18n_audit_report.md
git commit -m "fix: enforce complete application localization" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

---

### Task 4: Establish the Metaverse Studio public boundary

**Files:**
- Create: `src/app/features/metaverse-studio/multiplayer/index.ts`
- Modify: `src/app/features/metaverse-studio/index.ts`
- Modify: `src/app/pages/VirtualGalleryCreate.tsx`
- Modify: `src/app/pages/VirtualGalleryCreate.test.tsx`
- Create: `scripts/check-module-boundaries.mjs`
- Create: `scripts/check-module-boundaries.test.mjs`
- Modify: `package.json`

**Step 1: Write a failing facade import test**

Add to `VirtualGalleryCreate.test.tsx` a test or mock setup that imports multiplayer dependencies from:

```ts
import {
  MultiplayerRoomError,
  useMultiplayerStore,
} from '@/app/features/metaverse-studio';
```

Expected: the test fails until those symbols are exposed by the facade.

**Step 2: Export multiplayer capabilities through one public module**

Create `src/app/features/metaverse-studio/multiplayer/index.ts`:

```ts
export { useMultiplayerStore } from '../../../modules/metaverse3d/network/multiplayerStore';
export type { MultiplayerRole } from '../../../modules/metaverse3d/network/protocol';
export {
  connectMultiplayer,
  disconnectMultiplayer,
  joinMultiplayerRoom,
  leaveMultiplayerRoom,
} from '../../../modules/metaverse3d/network/socketClient';
export { MultiplayerRoomError } from '../../../modules/metaverse3d/components/Multiplayer/MultiplayerRoomError';
```

Before committing, match the socket export names to the actual named exports in `socketClient.ts`; expose only the symbols used by page code.

Append to `src/app/features/metaverse-studio/index.ts`:

```ts
export * from './multiplayer';
```

**Step 3: Move page imports to the facade**

Replace every `../modules/metaverse3d/...` import in `VirtualGalleryCreate.tsx` and its test with:

```ts
import {
  MultiplayerRoomError,
  useMultiplayerStore,
  type MultiplayerRole,
} from '@/app/features/metaverse-studio';
```

Import socket functions from the same facade declaration.

**Step 4: Write the failing boundary-checker test**

Create `scripts/check-module-boundaries.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { findLegacyStudioImports } from './check-module-boundaries.mjs';

test('flags page imports that bypass the studio facade', () => {
  const source = "import { useStore } from '../modules/metaverse3d/store/useStore';";
  assert.deepEqual(findLegacyStudioImports('src/app/pages/Create.tsx', source), [
    'src/app/pages/Create.tsx',
  ]);
});
```

**Step 5: Implement the boundary checker**

Create `scripts/check-module-boundaries.mjs` that scans `src/app/pages/**/*.{ts,tsx}` and returns an error for source containing `/modules/metaverse3d/` or `../modules/metaverse3d`. Keep `src/app/features/metaverse-studio/**` temporarily exempt because it is the strangler facade around legacy internals.

**Step 6: Add the boundary gate to `package.json`**

```json
"check:boundaries": "node scripts/check-module-boundaries.mjs",
"check": "npm run check:runtime && npm run check:i18n && npm run check:boundaries && npm run check:server && npm run test && npm run build"
```

**Step 7: Verify**

Run:

```powershell
node --test scripts/check-module-boundaries.test.mjs
npm run test -- src/app/pages/VirtualGalleryCreate.test.tsx
npm run check:boundaries
npm run check
```

Expected: all exit `0`; `rg -n "modules/metaverse3d" src/app/pages` returns no production-page match.

**Step 8: Commit**

```powershell
git add package.json scripts/check-module-boundaries.mjs scripts/check-module-boundaries.test.mjs src/app/features/metaverse-studio src/app/pages/VirtualGalleryCreate.tsx src/app/pages/VirtualGalleryCreate.test.tsx
git commit -m "refactor: enforce metaverse studio public boundary" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

---

### Task 5: Move remaining page and shared-component consumers behind facades

**Files:**
- Modify: `src/app/pages/ExhibitionUploadPlatform.tsx`
- Modify: `src/app/components/Gallery3D.tsx`
- Modify: `src/app/features/metaverse-studio/store/index.ts`
- Create: `src/app/features/metaverse-studio/platform/index.ts`
- Modify: `src/app/features/metaverse-studio/index.ts`
- Modify nearest tests: `src/app/components/Gallery3D.test.tsx`, page tests if present

**Step 1: Add failing tests using facade imports**

Update mocks and imports so consumers request `useStore` and `canCreateWebGLContext` from `@/app/features/metaverse-studio`.

**Step 2: Export the existing compatibility store**

Confirm `src/app/features/metaverse-studio/store/index.ts` exports `useStore`; retain the current alias until all legacy consumers are migrated.

**Step 3: Export the platform check**

Create `src/app/features/metaverse-studio/platform/index.ts`:

```ts
export { canCreateWebGLContext } from '../../../modules/metaverse3d/components/webglSupport';
```

Append to the feature index:

```ts
export * from './platform';
```

**Step 4: Update consumers**

Use:

```ts
import { canCreateWebGLContext, useStore } from '@/app/features/metaverse-studio';
```

No page or shared marketing component should know the legacy module path.

**Step 5: Tighten the checker**

Extend `check-module-boundaries.mjs` to scan both `src/app/pages` and `src/app/components`, allowing only a short explicit allowlist if a shared component is genuinely part of the legacy implementation.

**Step 6: Verify**

Run:

```powershell
npm run test -- src/app/components/Gallery3D.test.tsx
npm run check:boundaries
npm run check
```

Expected: all pass; production consumers outside the feature no longer import `modules/metaverse3d`.

**Step 7: Commit**

```powershell
git add src/app/components/Gallery3D.tsx src/app/components/Gallery3D.test.tsx src/app/pages/ExhibitionUploadPlatform.tsx src/app/features/metaverse-studio scripts/check-module-boundaries.mjs
git commit -m "refactor: route studio consumers through feature facade" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

---

### Task 6: Continue the 3D refactor as tested vertical slices

**Files:**
- Existing target map: `doc/module-boundary-map.md`
- Existing target design: `doc/refactor-module-plan.md`
- Move one slice at a time from: `src/app/modules/metaverse3d/`
- Move into: `src/app/features/metaverse-studio/`

**Step 1: Select only one slice per commit**

Use this order because it follows the dependency graph:

1. `canvas` orchestration and platform boundaries
2. `exhibits` renderers and registry
3. `room` geometry/material/placement helpers
4. `editor` UI and inspectors
5. `floor-plan` UI and pure geometry helpers
6. `multiplayer` client/store/components
7. `agent` behavior/UI
8. Zustand store selectors, then individual slices

**Step 2: Lock current behavior with tests before moving a slice**

Run the existing nearest test and add missing behavior coverage. Examples:

```powershell
npm run test -- src/app/features/metaverse-studio/canvas
npm run test -- src/app/features/metaverse-studio/exhibits
npm run test -- src/app/modules/metaverse3d/store/useMetaverseStudioStore.test.ts
npm run test -- src/app/modules/metaverse3d/network
```

Expected: green before moving files.

**Step 3: Move implementation without redesigning behavior**

For the selected slice:

- Move the implementation into the mapped feature directory.
- Update internal feature imports to `@/app/features/metaverse-studio/...` or relative paths within the feature.
- Leave a temporary re-export at the old path if tests or untouched legacy slices still depend on it.
- Do not combine visual changes, state-schema changes, and file movement in one commit.

Compatibility facade pattern:

```ts
export { MovedSymbol } from '@/app/features/metaverse-studio/<slice>';
export type { MovedType } from '@/app/features/metaverse-studio/<slice>';
```

**Step 4: Run slice tests and the complete gate**

Run:

```powershell
npm run test -- <exact-slice-test-path>
npm run check:boundaries
npm run check
```

Expected: all pass, with no snapshot or scene-schema changes unless explicitly planned.

**Step 5: Commit the one slice**

```powershell
git add src/app/features/metaverse-studio src/app/modules/metaverse3d
git commit -m "refactor(studio): move <slice> behind feature boundary" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

Repeat Steps 1–5 for the next slice. Delete legacy re-exports only after `rg` proves there are no remaining consumers.

---

### Task 7: Document and verify the supported deployment topology

**Files:**
- Modify: `doc/README.md`
- Modify: `.env.example`
- Verify: `server/config/env.js`
- Verify: `server/security/rateLimit.js`
- Verify: `server/multiplayer/rooms.js`
- Verify: `server/multiplayer/socketServer.js`

**Step 1: Add a deployment topology section**

Document these supported constraints in `doc/README.md`:

```md
### Supported topology

The current release supports one Express process and one multiplayer Socket.IO
process per environment. Rate-limit counters and multiplayer rooms are held in
memory. Do not place multiple application instances behind a load balancer until
both are moved to shared storage.

Before scaling horizontally:

1. Move rate-limit counters to Redis or an equivalent shared store.
2. Use the Socket.IO Redis adapter and shared room/session state.
3. Configure sticky sessions or connection-state recovery as required.
4. Run multiplayer consistency and rate-limit integration tests against two instances.
```

**Step 2: Verify production variables are represented safely**

Ensure `.env.example` documents explicit HTTP/WebSocket origins, strong JWT-secret requirements, body limits, and rate-limit settings without real credentials.

**Step 3: Run security-focused tests**

Run:

```powershell
npm run test -- server/security
npm run test -- server/multiplayer
npm run check:server
npm run check
```

Expected: all pass.

**Step 4: Commit**

```powershell
git add doc/README.md .env.example
git commit -m "docs: define supported deployment topology" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

---

## Release checkpoints

### Checkpoint A: Safe baseline

Complete Tasks 1–3. This is the minimum shippable stabilization release: clean validation, no tracked runtime data, and verified localization.

### Checkpoint B: Enforced architecture boundary

Complete Tasks 4–5. All page-level consumers use the Metaverse Studio facade, so internal migration can continue without repeated page rewrites.

### Checkpoint C: Incremental modularization

Execute Task 6 one slice at a time. Stop after any slice; the facade keeps the application functional.

### Checkpoint D: Production readiness statement

Complete Task 7. Horizontal scaling remains deliberately out of scope until there is a real multi-instance requirement; at that point create a separate Redis/Socket.IO adapter implementation plan.

## Final verification

Run from `D:\meta_exb\web_ui_new`:

```powershell
git status --short
npm ci
npm run check
npm run dev:server
```

In a second terminal:

```powershell
npm run dev
```

Manually smoke-test:

- register, login, logout, and protected-route redirect;
- create, save, reopen, publish, share, and view an exhibition;
- editor selection, placement, undo/redo, floor-plan mode, and scene import/export;
- WebGL unsupported/recovery state;
- multiplayer join/leave and scene consistency;
- Agent personality selection, response fallback, recommendation, and TTS;
- growth-memory upload/share and competition vote limits;
- locale switching across Traditional Chinese, Simplified Chinese, and English.

Expected: no console errors, no secrets in responses, no runtime artifacts in Git, and a clean `npm run check` after the smoke test.
