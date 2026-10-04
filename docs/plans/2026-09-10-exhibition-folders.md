# Exhibition folders implementation plan

**Goal:** Add account-persistent, Drive-like folders to My Exhibitions management.

**Architecture:** Separate owner-scoped folder and gallery-membership tables keep organization private and leave gallery scenes, publishing and share links untouched. Transactions validate all moves, prevent cycles, and promote children to the deleted folder's parent without deleting exhibitions.

**Tech Stack:** Existing React, Radix dialogs, SQLite, Express and Vitest; no dependencies added.

## Tasks
1. Add `server/repositories/galleryFolderRepository.js` and `server/routes/galleryFolderRoutes.js`, register schema in `server/db.js` and routes in `server/index.js`. Cover ownership, atomic batch moves, nesting/cycles, durable rename and safe deletion in `server/routes/galleryFolderRoutes.test.js`.
2. Add `src/app/api/galleryFolders.ts` and `src/app/features/exhibition-folders/ExhibitionFolders.tsx`. Integrate only the management list in `src/app/pages/MyExhibitions.tsx`. Include breadcrumbs, create/rename/delete, nested folders, selection/move dialog and desktop drag-to-folder with keyboard/mobile button alternatives. Translate zh-TW, zh-CN and en.
3. Run focused tests, typecheck/lint and full `npm run check`. Exercise actual UI with local synthetic accounts and responsive layout.
4. Build Hong Kong whitelist release, reuse verified current runtime dependencies to avoid another memory-pressure incident. Validate isolated staging persistence/ownership/backup restore, then fresh production backup/restore and exact-image promotion. Preserve all secrets/data/volumes. Verify public HTTPS and record deployment evidence here.

## Scope decisions
- Root contains unfiled exhibitions. Folders can nest and move; gallery movement does not change sharing or content revision.
- Deleting a folder moves its direct children and exhibitions to its parent; confirmation explains this before deletion.
- No Google connection, uploads to Google, shared-folder permissions or trash system.
- No Git commit/push or subagents required; execute directly under existing user authorization.

## Status
Complete and deployed to https://metaexb.com/virtual-gallery/my-exhibitions on 2026-09-10, final public verification at 11:16 HKT.

## Delivered
- Nested, account-persistent folders with create/rename/move/delete, breadcrumbs and direct folder URLs.
- Single/batch exhibition movement, checkbox selection and desktop drag from the move button onto a folder or breadcrumb. Button/select alternatives work on mobile and keyboard.
- Transactional ownership validation, cycle prevention and safe deletion promoting children/exhibitions to the parent. Scene revisions, publication settings and share tokens are unchanged by organization.
- Folder data is included in account export and cascades on account deletion. Existing exhibitions start at the root; no data rewrite was required.
- Traditional Chinese, Simplified Chinese and English translations. No Google integration or new dependencies.

## Validation
- Full `npm run check` passed: 265 suites passed, 1 skipped; 2073 tests passed, 1 skipped. Typecheck/lint/build/bundle gates passed. Redis integration is skipped without REDIS_TEST_URL. Log: `.tmp/folders-final-check.log`.
- After final UI corrections, focused component tests passed (5), typecheck and lint passed. The folder API integration suite passed (5), including mixed-owner batch rollback and concurrent opposing moves. No runtime backend changes followed staging acceptance.
- Real browser, isolated local user: create folder, move existing exhibition, enter folder, refresh persistence, return to parent, rename, confirm delete and verify the exhibition remains in root. Inspected desktop and 390px iframe layout; this is not a physical-device test. Temporary responsive HTML removed.
- The final browser check exposed a Radix trigger anchoring issue: the shared motion Button does not forward its DOM ref, placing the menu outside the viewport. The folder menu now uses a native button with existing button styles and preserves dialog focus. Rename and deletion were re-exercised successfully; added menu/dialog regression coverage. No change to the shared Button component.
- Isolated Hong Kong acceptance passed: trusted TLS, auth/session/CSRF, media and owner protection, CORS, WebSockets and restart persistence; folder create/nesting/rename/move, foreign-owner rejection, cycle rejection, restart persistence, safe deletion to parent/root, and unchanged scene/share access. Exact synthetic users cleaned; staging app/web stopped with volumes retained.

## Release and production evidence
- Initial whitelist release: 245 files, archive SHA256 `47242b39cc2f0eac4ce3ffe721040e87af69d3952927f0a45a13e3a397533ef5`.
- Final whitelist release after menu correction: `.tmp/hk-folders-final-release-20260910`, 245 files; archive SHA256 `a6417f227eec767eaa1f9d5ef4d485311b14743b9ce4701a8cc7007da76f1beb`, uploaded and verified under `/home/admin/meta-exb-hk-folders-final-20260910`.
- Reused the verified existing production dependency image after comparing runtime dependency definitions and lock entries. No fresh dependency install. Final app image `sha256:32ae9e23cecadb131783c4eaa3e68431b0e9f713de40f55860ed1087ad32d834`; final web image `sha256:cb32f7690283a09a34322c7a0c5e177053f55cff51c22f2e72ab98d10e60eba5`.
- The last correction changed only frontend artifacts: verified every non-dist file against deployed source, built only the staging web image, checked trusted staging HTTPS and exact HTML/JavaScript hashes, then promoted that exact web image to production without restarting the app.
- Staging backup `/home/admin/meta-exb-hk-staging-20260904/backups/runtime-pre-folders-20260910.tar.gz`: SHA256 `fd6b2d8ded1e81ecce9f054291e8ea28dd85c44b9c2012d9af7379daeb93d57c`, 24383 bytes, mode 600. Separate restore volume `meta-exb-hk-staging-20260904-restore-folders-20260910`: SQLite integrity, folder name/parent/owner and exhibition membership verified.
- Production backup `/home/admin/meta-exb-hk-production-20260904/backups/runtime-pre-folders-20260910.tar.gz`: SHA256 `c5eb2a8c80d2dfd7b1a2ede2b9b621cc19032c5f9f11e17fa50db4f6a06fe93e`, 24192166 bytes, mode 600. Separate restore volume `meta-exb-hk-production-restore-folders-20260910`: SQLite integrity and required tables readable. Live data was never replaced with a restore.
- Previous source retained at each project's `source.pre-folders-20260910`; intermediate frontend retained at `source.pre-folders-menu-final-20260910`. Prior production app/web tags `meta-exb-hk-production-app:pre-folders-20260910` and `meta-exb-hk-production-web:pre-folders-20260910` retained.
- Final public `/api/ready` ready; management URL returns 200 with trusted TLS and expected login/return flow; www redirects 301 to apex. Public HTML SHA256 `7927175c527d31f5c24f0867befb5709e67f28b0f382374c0dfa8298f3cf34eb`; `/assets/index-Lt1WxEvF.js` SHA256 `17ba435da49665b21e295c509c5a93932e160a4f3e157cd3a6a43bf525945ca3`; both match final release.
- Existing production environment hash/mode 600 and runtime/Caddy volumes preserved. Website exposes only TCP 80/443; API/multiplayer remain private. Final app healthy, approximately 724 MiB available memory. No cloud setting changes, force reboot, production test accounts, Git commit/push or volume deletion.
- Logs: `.tmp/folders-staging-deploy.log`, `.tmp/folders-staging-acceptance.log`, `.tmp/folders-production-backup.log`, `.tmp/folders-production-deploy.log`, `.tmp/folders-final-staging.log`, `.tmp/folders-final-production.log`.
