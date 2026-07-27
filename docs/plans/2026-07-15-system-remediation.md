# System Remediation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the production-blocking release gates defined in `docs/System_Remediation_Plan_zh-TW.docx` with server-enforced controls and reproducible tests.

**Architecture:** Harden trust boundaries in focused services and route middleware, keep SQLite migrations explicit and awaitable, and reject non-persistent assets before they enter stored scene or competition payloads. Deliver in waves so competition, asset, startup, authentication, and quality-gate changes can be tested independently before full integration.

**Tech Stack:** Express 5 ESM, SQLite3, Zod, Vitest, React 18, TypeScript, Vite, npm.

---

### Task 1: P1 voting identity and state gate

**Files:**
- Modify: `server/routes/competitionRoutes.js`
- Modify: `server/routes/competitionRoutes.test.js`
- Modify only if required after preserving current edits: `server/db.js`, `server/dbMigrations.js`, `server/dbMigrations.test.js`

**Steps:**
1. Add failing tests for anonymous voting, completed/non-voting states, duplicate identity, and server-derived voter identity.
2. Run `npm run test -- server/routes/competitionRoutes.test.js server/dbMigrations.test.js` and confirm failures.
3. Require authenticated identity for voting and reject every state except the project's explicit voting state.
4. Persist a stable user identifier and enforce the selected uniqueness rule at SQLite level without trusting `voterEmail` from the request.
5. Return a deterministic conflict response for duplicate votes and keep vote totals derived from vote rows.
6. Re-run the targeted tests.

### Task 2: P2/P3 persistent asset safety gate

**Files:**
- Modify: `server/services/exhibitionSceneService.js`
- Modify: `server/services/exhibitionSceneService.test.js`
- Modify: `server/routes/competitionRoutes.js`
- Modify: `server/routes/competitionRoutes.test.js`

**Steps:**
1. Add failing tests proving `blob:` values cannot enter stored/published scene payloads.
2. Add failing competition tests for required file fields, unknown assets, and non-persistent URLs.
3. Add a recursive server-side scene validator that rejects browser-local URLs with a diagnostic 400 response.
4. Validate competition file requirements instead of skipping them; reject `blob:` and unrecognized asset structures.
5. Run `npm run test -- server/services/exhibitionSceneService.test.js server/routes/competitionRoutes.test.js`.

### Task 3: P4 awaitable migration barrier and readiness

**Files:**
- Preserve and complete current edits: `server/db.js`, `server/dbMigrations.js`, `server/dbMigrations.test.js`, `server/index.js`
- Create or modify focused readiness tests under `server/`

**Steps:**
1. Add failing tests for migration rejection, server startup not listening before initialization, and readiness 503 on schema failure.
2. Make `initDb()` return a Promise that settles only after required schema work finishes; propagate fatal errors.
3. Await initialization before starting HTTP and multiplayer listeners.
4. Keep liveness process-only and add `/api/ready` backed by a database/schema check with sanitized errors.
5. Run `npm run test -- server/dbMigrations.test.js` plus the new startup/readiness tests and `npm run check:server`.

### Task 4: P5A active account and session revocation

**Files:**
- Modify: `server/auth/jwt.js`, `server/auth/jwt.test.js`
- Modify: `server/routes/authRoutes.js`, `server/routes/authRoutes.test.js`
- Modify focused DB/session helpers under `server/`
- Modify route dependency wiring under `server/config/` and `server/index.js`

**Steps:**
1. Add failing tests for password-change, disabled/deleted account, and old-token rejection.
2. Introduce a server-side session or token-version record and include its identifier/version in short-lived access tokens.
3. Revoke all user sessions transactionally on password reset/change and account disable/delete.
4. Centralize active-user checks and apply them to billable AI, Agent, and TTS routes.
5. Run auth, AI, Agent, and TTS route tests.

### Task 5: P5B quality gate

**Files:**
- Modify: `package.json`
- Create or modify tracked TypeScript and ESLint configuration files
- Add focused E2E/bundle-budget configuration only where existing tooling supports it

**Steps:**
1. Inventory existing scripts and establish a non-increasing strictness baseline.
2. Add `typecheck` and `lint` scripts, then include them in `npm run check` with server syntax, tests, and build.
3. Add a deterministic bundle-size check for the current Vite output.
4. Run `npm run check`; record any remaining legacy baseline separately instead of hiding new violations.

### Task 6: Release-gate verification

**Files:**
- Verify: all files changed by Tasks 1-5

**Steps:**
1. Run every file-scoped regression test added above.
2. Run `npm run check:server`.
3. Run `npm run test`.
4. Run `npm run build` and the bundle budget check.
5. Review `git diff --check` and `git status --short`, preserving unrelated user changes.
