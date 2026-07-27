# Secure Media Delivery Batch Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make wizard-uploaded artwork persistently owned, gallery-bindable, and retrievable only by the owner or through an allowed published/share gallery context, while reducing the wizard bundle cost.

**Architecture:** Store media metadata separately from files, using an owner-bound `media_assets` row created at upload time. Bind assets to a gallery before scene persistence, then serve bytes through an API route that resolves owner, published-gallery, or valid share-token access instead of exposing the upload directory. Keep image decoding isolated from authorization and lazy-load the wizard UI from the create page.

**Tech Stack:** Express ESM, SQLite, Zod, React 18, Vite dynamic imports, Vitest.

---

### Task 1: Media asset persistence

**Files:**
- Modify: `server/db.js`
- Modify: `server/config/deps.js`
- Test: `server/dbInitialization.test.js`
- Test: `server/routes/mediaRoutes.test.js`

**Steps:**
1. Add failing schema and repository tests for an owner-bound `media_assets` row with optional `gallery_id`, storage filename, MIME type, byte size, and timestamps.
2. Run `npm run test -- server/dbInitialization.test.js server/routes/mediaRoutes.test.js` and verify the new assertions fail.
3. Add `media_assets` schema, indexes, insert/get/bind repository functions, and inject them into the media route dependencies.
4. Re-run the focused tests and verify they pass.

### Task 2: Authorized upload, binding, and byte delivery

**Files:**
- Modify: `server/routes/mediaRoutes.js`
- Modify: `server/routes/mediaRoutes.test.js`
- Modify: `server/services/mediaIngestService.js`
- Modify: `src/app/api/media.ts`
- Modify: `src/app/pages/VirtualGalleryCreate.tsx`

**Steps:**
1. Add route tests proving upload records the authenticated owner, another user receives 404, an unbound asset is owner-only, and a bound asset is readable for its owner or a published gallery.
2. Change upload responses to an API URL (`/api/media/:id`) and persist the returned storage metadata.
3. Add an owner-only `POST /api/media/bind` endpoint that verifies gallery ownership before assigning asset IDs.
4. Add a `GET /api/media/:id` endpoint that returns bytes only after owner, published gallery, or valid share-token access is resolved; set `nosniff`, private/public cache policy as appropriate, and never accept a filesystem path from the request.
5. Bind uploaded assets before gallery scene publication and replace scene URLs with the stable API URL.
6. Run focused server and frontend tests.

### Task 3: Safe PNG and WebP normalization

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `server/services/mediaMetadataService.js`
- Modify: `server/services/mediaIngestService.js`
- Test: `server/services/mediaMetadataService.test.js`
- Test: `server/services/mediaIngestService.test.js`

**Steps:**
1. Add failing tests for decoder-validated PNG/WebP input and metadata-free normalized output.
2. Select an existing or minimal maintained image decoder supported by the project runtime; do not implement a custom parser.
3. Re-encode PNG/WebP with bounded dimensions and preserved alpha, reject animated or malformed inputs, and retain the 15 MB input limit.
4. Run the focused service tests.

### Task 4: Lazy-load the wizard

**Files:**
- Modify: `src/app/pages/VirtualGalleryCreate.tsx`
- Test: `src/app/pages/VirtualGalleryCreate.test.tsx` (create if absent)

**Steps:**
1. Add a test asserting the editor shell remains available while the wizard chunk loads.
2. Replace eager wizard imports with `React.lazy` and a compact accessible loading fallback.
3. Run the page test, typecheck, and build; compare the create-page chunk and total JavaScript budget.

### Task 5: Integration validation

**Files:**
- Modify only files required by failures found above.

**Steps:**
1. Run `npm run check`.
2. Run `git diff --check`.
3. Confirm no `server/uploads/`, database files, or environment files appear in `git status --short`.
4. Report any remaining security boundary or unsupported media case; do not create a commit unless explicitly requested.
