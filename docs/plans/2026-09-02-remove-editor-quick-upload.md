# Remove Editor Quick Upload Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Completely retire the edit-mode quick upload feature while preserving normal artwork uploads and existing data.

**Architecture:** Remove the editor entry, dedicated page, route, translation keys, client methods, and upload-link server endpoints. Remove unused database helpers and fresh-schema creation without dropping existing tables or deleting uploaded media. Keep gallery sharing and cross-tab scene synchronization unchanged.

**Tech Stack:** React, React Router, TypeScript, Express, SQLite, Vitest, npm.

---

### Task 1: Lock down retired entry points

**Files:** `src/app/routes.test.ts`, `src/app/modules/metaverse3d/components/UI/EditUI.test.tsx`, `server/routes/galleryRoutes.test.js`, `src/app/i18n/catalogs/catalogs.test.ts`.

1. Assert the upload route and page import are absent.
2. Render edit mode; assert no quick-upload button and retain view/floor-plan controls and the painting file input.
3. Replace the upload-link mutation test with POST/GET/PATCH/DELETE retirement cases expecting 404 without gallery writes.
4. Assert all locales omit `editorQuickUpload` and `eup*` keys.
5. Run `npm run test -- src/app/routes.test.ts src/app/modules/metaverse3d/components/UI/EditUI.test.tsx server/routes/galleryRoutes.test.js src/app/i18n/catalogs/catalogs.test.ts`. Expect new retirement assertions to fail before removal.

### Task 2: Remove dedicated implementation

**Files:** `src/app/modules/metaverse3d/components/UI/EditorTopBar.tsx`, `src/app/pages/ExhibitionUploadPlatform.tsx`, `src/app/routes.ts`, `src/app/components/Layout.tsx`, `src/app/api/gallery.ts`, `src/app/i18n/catalogs/{en,zh-CN,zh-TW}.ts`, `server/routes/galleryRoutes.js`, `server/config/deps.js`, `server/db.js`, `doc/module-boundary-map.md`.

1. Preserve a recovery copy of the already-modified dedicated page outside the repository.
2. Remove the button, its navigation hook/icon imports, route, fullscreen exemption, and dedicated page.
3. Remove the dedicated client types/functions and translation block.
4. Remove upload-link schemas, endpoints, injected dependencies, database helpers, and fresh-schema creation. Do not issue a database migration or delete runtime data.
5. Remove the retired route from the current module map; retain historical design documents.
6. Search production source for `ExhibitionUploadPlatform`, `editorQuickUpload`, `eup`, `GalleryUploadLink`, `gallery_upload_links`, and retired route strings; expect no dedicated implementation references.

### Task 3: Verify retained workflows

**Files:** `server/dbInitialization.test.js` and existing gallery/media/editor test suites.

1. Test fresh database initialization omits the retired table and initialization preserves an existing legacy table and row, using in-memory databases only.
2. Repeat focused retirement tests plus `src/app/api/gallery.test.ts`, `src/app/pages/VirtualGalleryCreate.test.tsx`, `server/routes/mediaRoutes.test.js`, and `server/dbInitialization.test.js`; expect PASS.
3. Run `npm run check:server`, `npm run typecheck`, `npm run lint`, and `npm run build`; report unrelated baseline failures separately.
4. Review the task delta against the starting worktree, preserving other work. Do not commit unrelated in-progress changes.

Execution is local in the user-provided working tree; no new tasks or commits are required.

## Verification outcome

- Before removal: seven retirement assertions failed as expected; 69 existing assertions passed.
- After removal: eight focused suites passed, 119 tests total, including ordinary artwork upload input, editor mode navigation, gallery sharing, media routes, and legacy data preservation.
- `npm run check:server`, `npm run typecheck`, `npm run lint`, and `npm run build` passed.
- Scoped `git diff --check` passed. Production source contains no retired feature references; the build no longer emits an `ExhibitionUploadPlatform` chunk.
- No runtime data was deleted. Recovery copy of the removed page, including its pre-existing uncommitted changes: `C:/Users/Leo/AppData/Local/Temp/meta-exb-quick-upload-7d0d5576-0765-4c35-939b-ab1b5fde2067/ExhibitionUploadPlatform.tsx`.
