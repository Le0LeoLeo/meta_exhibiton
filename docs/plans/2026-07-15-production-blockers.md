# Production Blockers Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Preserve competition entries across database initialization and honor the configured frontend origin in HTTP CORS responses.

**Architecture:** Extract the competition-entry schema initialization into a focused SQLite helper so it can be exercised against an in-memory database. Pass the already validated `FRONTEND_ORIGIN` value from server startup into the existing middleware configuration instead of retaining a localhost-only constant.

**Tech Stack:** Express 5, SQLite3, Vitest, npm.

---

### Task 1: Preserve competition entries across repeated initialization

**Files:**
- Create: `server/dbMigrations.js`
- Create: `server/dbMigrations.test.js`
- Modify: `server/db.js:257-334`

**Steps:**
1. Add an in-memory SQLite regression test that initializes the schema, inserts an entry, initializes it again, and expects the entry to remain in `competition_entries` with no legacy table created.
2. Run `npm run test -- server/dbMigrations.test.js` and confirm the current behavior is represented by the new helper contract.
3. Move only the competition-entry and vote schema setup into the helper, remove the unconditional table rename, and add missing columns after `CREATE TABLE IF NOT EXISTS`.
4. Run the targeted migration test and `npm run test -- server/routes/competitionRoutes.test.js`.

### Task 2: Use the production frontend origin for CORS

**Files:**
- Modify: `server/config/middleware.test.js`
- Modify: `server/config/middleware.js:4-15`
- Modify: `server/index.js:28-63`

**Steps:**
1. Add tests proving the configured origin receives `Access-Control-Allow-Origin` and a different origin does not.
2. Pass `FRONTEND_ORIGIN` from `loadEnv()` through `applyAppMiddleware()`.
3. Run `npm run test -- server/config/middleware.test.js server/security/env.test.js`.

### Task 3: Validate the complete project

**Files:**
- Verify: `package.json`

**Steps:**
1. Run `npm run check:server`.
2. Run `npm run test`.
3. Run `npm run build`.
4. Confirm `git status --short` contains only the intended files plus the user's pre-existing `docs/optimize-points.markdown` change.

