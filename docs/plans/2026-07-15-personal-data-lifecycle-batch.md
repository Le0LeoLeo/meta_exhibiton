# Personal Data Lifecycle Batch Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give authenticated users reliable media deletion and data export while ensuring account/gallery deletion and retention maintenance remove private files from disk.

**Architecture:** Keep SQLite as the ownership source of truth and perform authorization before any filesystem operation. Read storage filenames before deleting rows, remove files after the database mutation, and use a reconciliation service to recover from filesystem cleanup failures. Data export returns a password-hash-free JSON snapshot assembled by owner-scoped repository queries.

**Tech Stack:** Express ESM, SQLite, Node filesystem APIs, Zod, React 18, Vitest.

---

### Task 1: Media lifecycle repositories

**Files:**
- Modify: `server/db.js`
- Modify: `server/config/deps.js`
- Test: `server/mediaAssetsDb.test.js`

**Steps:**
1. Add failing tests for owner-scoped asset deletion, listing owner/gallery storage filenames, listing all media filenames, and listing/deleting stale unbound assets.
2. Implement repository functions without exposing filesystem paths or deleting another owner's rows.
3. Run `npm run test -- server/mediaAssetsDb.test.js`.

### Task 2: Owner media deletion and UI removal

**Files:**
- Modify: `server/routes/mediaRoutes.js`
- Modify: `server/routes/mediaRoutes.test.js`
- Modify: `src/app/api/media.ts`
- Modify: `src/app/features/exhibition-wizard/steps/UploadStep.tsx`
- Test: focused route and wizard tests.

**Steps:**
1. Test `DELETE /api/media/:id` for owner success, cross-owner 404, and recoverable filesystem cleanup failure.
2. Delete the owner-scoped database row first, then attempt safe file removal; report cleanup failures without leaking paths.
3. Add an accessible remove action to uploaded and failed wizard assets; call the API for persisted assets and retain the asset on API failure.
4. Run focused server/frontend tests.

### Task 3: Account export and complete deletion

**Files:**
- Modify: `server/db.js`
- Modify: `server/config/deps.js`
- Modify: `server/routes/authRoutes.js`
- Modify: `server/routes/authRoutes.test.js`
- Test: owner data export repository tests.

**Steps:**
1. Add `GET /api/users/me/export` tests proving password hashes, tokens, and other users' rows are absent.
2. Assemble an owner-scoped JSON export covering profile, galleries/scenes, media metadata, growth records, competition entries, comments owned through the user's galleries, and visitor memories.
3. Before account deletion, collect both growth and media filenames; delete the user transactionally, then perform best-effort filesystem cleanup for both stores.
4. Return JSON as an attachment with `Cache-Control: no-store`.

### Task 4: Retention and orphan reconciliation

**Files:**
- Create: `server/services/mediaRetentionService.js`
- Create: `server/services/mediaRetentionService.test.js`
- Create: `scripts/cleanup-media.mjs`
- Modify: `package.json`

**Steps:**
1. Test dry-run reconciliation against a temporary upload directory: identify unreferenced files and stale unbound rows without deleting anything.
2. Add an explicit apply mode that deletes only generated filenames under the configured media root and removes only unbound rows older than the supplied cutoff.
3. Add an npm script whose default is dry-run; require `--apply` for mutation.
4. Do not schedule automatic deletion until the product owner has selected and published a retention period.

### Task 5: Integration validation

**Steps:**
1. Run all focused tests, `npm run check`, and `git diff --check`.
2. Confirm runtime uploads, databases, environment files, and cleanup reports are not tracked.
3. Report the remaining policy decision: retention duration and whether gallery deletion should permanently delete or detach reusable assets.
