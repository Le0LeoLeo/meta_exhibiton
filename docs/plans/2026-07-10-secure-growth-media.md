# Secure Growth Media Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use the local execution workflow to implement this plan task-by-task.

**Goal:** Prevent uploaded growth-memory media from being publicly readable or executable while preserving owner and share-link playback.

**Architecture:** Store validated media under the existing private runtime directory, remove direct static exposure, and issue short-lived asset-scoped signed URLs only after owner or share-link authorization. Validate decoded bytes against an explicit media allowlist and derive the stored extension and MIME type on the server.

**Tech Stack:** Express 5 ESM, SQLite, JSON Web Tokens, Zod, Vitest, React 18.

---

### Task 1: Add upload validation tests

**Files:**
- Create: `server/services/growthAssetService.js`
- Create: `server/services/growthAssetService.test.js`

1. Add failing tests for valid JPEG/PNG/WebP/MP4/WebM/MP3/WAV/Ogg signatures.
2. Add failing tests for HTML/SVG payloads, MIME mismatches, malformed Base64, and decoded files above the byte limit.
3. Run `npm run test -- server/services/growthAssetService.test.js` and confirm failure.
4. Implement a small validator that returns `{ buffer, mimeType, extension, type }` and never trusts the client filename extension.
5. Run the focused test and confirm it passes.

### Task 2: Add asset-scoped access tokens

**Files:**
- Modify: `server/auth/jwt.js`
- Test: `server/routes/growthRoutes.test.js`

1. Add failing route tests proving an asset token is scoped to one asset and expires.
2. Add `signGrowthAssetToken(assetId)` and `verifyGrowthAssetToken(token, assetId)` with a dedicated audience and a 15-minute lifetime.
3. Expose the helpers through `server/config/deps.js`.
4. Run the focused route tests.

### Task 3: Protect stored media and upload handling

**Files:**
- Modify: `server/index.js`
- Modify: `server/db.js`
- Modify: `server/routes/growthRoutes.js`
- Create: `server/routes/growthRoutes.test.js`

1. Add a DB lookup for a growth asset by ID.
2. Remove direct `/uploads` static exposure.
3. Change upload handling to validate decoded bytes, derive the extension/MIME/type server-side, and store only a private relative path.
4. Add `GET /api/growth/assets/:assetId/content?access=...` that verifies the scoped token, resolves only files below `server/uploads/growth`, sets `nosniff` and a safe Content-Type, and sends the file.
5. Make owner and share asset-list endpoints replace private stored paths with short-lived content API paths after their existing authorization checks.
6. Test unauthorized access, cross-asset token reuse, expired/invalid share links, valid owner access, valid share access, and malicious uploads.

### Task 4: Normalize media URLs in the frontend

**Files:**
- Modify: `src/app/api/growth.ts`
- Test: `src/app/api/growth.test.ts`

1. Add failing tests showing relative protected content paths are passed through `apiUrl`, while external `https:` URLs remain unchanged.
2. Normalize asset responses in `getGrowthAssetsByExhibit`, `getSharedGrowthAssets`, upload, and create calls.
3. Confirm existing Growth Memories, Share, and 3D pages continue to receive ordinary URL strings.

### Task 5: Validate the complete change

1. Run `npm run test -- server/services/growthAssetService.test.js server/routes/growthRoutes.test.js src/app/api/growth.test.ts`.
2. Run `npm run check:server`.
3. Run `npm run test` and require all tests to pass.
4. Inspect `git diff --check` and the scoped diff; do not alter unrelated existing worktree changes.

