# Request Body Limits Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use the local execution workflow to implement this plan task-by-task.

**Goal:** Reduce memory-exhaustion exposure by limiting ordinary request bodies to 1 MB while preserving explicitly authorized media upload and AI screenshot review flows.

**Architecture:** Register exact-path JSON parsers for the two legitimate large-payload endpoints before the default parser. Require a valid bearer token before those parsers consume the request body, use route-specific limits, and return a consistent JSON 413 response for parser rejections.

**Tech Stack:** Express 5 ESM, JSON Web Tokens, Vitest.

---

### Task 1: Add middleware security tests

**Files:**
- Create: `server/config/middleware.test.js`
- Modify: `server/config/middleware.js`

1. Add a failing test showing an ordinary JSON endpoint rejects a payload above the default limit.
2. Add a failing test showing a valid JWT can use the larger growth-upload limit.
3. Add a failing test showing missing or invalid JWTs are rejected before a large body is parsed.
4. Add a failing test showing the AI review path receives its dedicated larger limit.
5. Add a failing test showing an oversized special-route payload returns JSON 413.
6. Run `npm run test -- server/config/middleware.test.js` and confirm failure.

### Task 2: Implement differentiated parsers

**Files:**
- Modify: `server/config/middleware.js`

1. Add exact `POST` pre-routes for `/api/growth/assets/upload` and `/api/ai/exhibition-builder/review`.
2. Verify bearer JWTs before invoking either large parser.
3. Apply the normal JSON and URL-encoded parser to all remaining requests.
4. Convert `entity.too.large` parser errors to `{ message: "request body too large" }` with status 413.
5. Run the focused middleware tests.

### Task 3: Wire secure defaults

**Files:**
- Modify: `server/config/env.js`
- Modify: `server/index.js`
- Modify: `.env.example`

1. Change `REQUEST_BODY_LIMIT` default from `50mb` to `1mb`.
2. Add `GROWTH_UPLOAD_BODY_LIMIT=22mb` and `AI_REVIEW_BODY_LIMIT=50mb`.
3. Create JWT helpers before applying middleware so large parsers can verify tokens before reading bodies.
4. Pass the three limits and `verifyToken` into `applyAppMiddleware`.

### Task 4: Validate

1. Run `npm run test -- server/config/middleware.test.js server/routes/growthRoutes.test.js server/routes/exhibitionSceneRoutes.test.js`.
2. Run `npm run check`.
3. Run `git diff --check` on the scoped files.
4. Confirm the default parser no longer uses 50 MB and no unrelated worktree changes were altered.

