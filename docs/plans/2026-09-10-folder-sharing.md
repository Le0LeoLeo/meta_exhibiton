# Folder sharing implementation plan

**Goal:** Give owners a revocable read-only folder link covering that folder and its descendants, with a visitor folder browser and 3D exhibition preview.

**Architecture:** Independent random folder tokens grant access only through dedicated read-only folder routes. Every folder/gallery/media request checks current ancestry and owner. Share creation explicitly explains scope, including unpublished exhibitions and future additions. Existing individual gallery publication/share settings remain unchanged.

## Tasks
1. Add owner-only share read/create/revoke and independent folder-share table; descendant scope queries and public folder/gallery/media reads. Test foreign ownership, outside-scope IDs, moved content, pending media, revocation, deletion and token rotation.
2. Add translated share dialog in folder menu and visitor `/folders/share/:token` browser with child folders, breadcrumbs, read-only exhibit detail/3D and protected media URLs. Test share lifecycle and browser UI.
3. Run relevant tests and full validation, build whitelist release with verified existing dependencies, stage auth/persistence/media/revocation/backup restore, deploy exact images after production backup, verify HTTPS and preserve secrets/volumes.

## Semantics
- Owner must deliberately create the link; visiting the share dialog alone grants no access.
- Link grants read-only access to current contents of the selected folder and descendants, including unpublished exhibits. Future additions join the scope; moved-out exhibits leave it.
- Revoking this link does not revoke independent gallery/child-folder links. Tokens are never included in public JSON or public gallery metadata. No editing or multiplayer access is granted.
- No Google integration, editor role, invitation emails or permission changes to existing galleries.

## Status
Implemented, tested and deployed to Hong Kong production on 2026-09-10 at approximately 11:39 HKT.

## Implementation
- Folder menu now offers Share folder. Opening the dialog only reads settings; creating a link is an explicit action after the scope explanation. Stable random 256-bit token, copy/selectable URL, visitor preview, revoke confirmation and new token after re-enabling.
- Dedicated share table cascades on folder/account deletion. Public reads recompute current owner-scoped descendant membership; ancestors/siblings/foreign galleries and unplaced or foreign media are rejected. Public responses omit owner IDs and independent gallery tokens, use no-store caching, and expose no write endpoints.
- `/folders/share/:token` supports nested navigation, exhibition image viewing and read-only 3D. Media URLs use the folder's scope directly rather than exposing independent exhibition share tokens. A focus/visibility refresh detects revoked links or moved-out content.
- Sharing applies to unpublished exhibits and future additions as explained before link creation. Revoking one folder link does not affect independent gallery/child-folder links. Existing exhibition publication settings and content revisions remain unchanged.
- Traditional Chinese, Simplified Chinese and English. No new dependencies.

## Validation
- Full `npm run check` passed: 269 suites passed, 1 skipped; 2090 tests passed, 1 skipped. Typecheck, lint, server syntax, avatar, build and bundle gates passed. Redis integration is skipped without REDIS_TEST_URL. Log `.tmp/folder-share-full-check.log`.
- Focused folder and UI coverage verifies owner-only creation/read/revoke, stable tokens and rotation, private descendant visibility, no outside metadata, moved-folder/gallery denial, placed-only media, foreign asset denial, independent child shares, account cascade, no access on dialog open, revoke confirmation and visitor scope/focus refresh.
- Local browser used synthetic data only: owner share creation, child-folder browsing, exhibition opening, eight of eight images loaded and actual 3D preview visually inspected. Reopening settings retained the same link. Revoke confirmation and unavailable-link flow checked separately.
- Isolated Hong Kong acceptance passed baseline TLS/session/CSRF/CORS/media/WebSocket/persistence checks and folder-specific sharing, pending/placed media, foreign owner denial, restart persistence, revoke/rotate, moved-out denial, deleted-folder revocation and unchanged independent scene/share access. Exact synthetic accounts removed; staging containers stopped with volumes retained.

## Release and deployment evidence
- Whitelist release `.tmp/hk-folder-share-release-20260910`, 248 files. Archive SHA256 `2b32aa074e65609bbcac868eca80009537443028579839831bd850a2fdc359bb`, remotely verified and extracted at `/home/admin/meta-exb-hk-folder-share-20260910`.
- Runtime dependencies and lock entries compared to the actual previous production source. Reused its verified dependencies with the same pinned Node base; no new dependency installation. Promoted exact accepted staging images: app `sha256:b544daba84765baa6ac553cad267e24b2f82048319ef089d2c1a0d9d9d96a3c2`, web `sha256:868894bda66718bfc68dddc8ae518a1b4a210fe40906e6881a97b83cf979d37c`.
- Staging backup `/home/admin/meta-exb-hk-staging-20260904/backups/runtime-pre-folder-share-20260910.tar.gz`, SHA256 `6116b4792339d8ebd8802145f35732bd0922c38641a28d9b45437665df4685d8`, 25317 bytes, mode 600. Restored separately to `meta-exb-hk-staging-20260904-restore-folder-share-20260910`; SQLite integrity, folder ancestry/owner, membership and exact share token verified.
- Production backup `/home/admin/meta-exb-hk-production-20260904/backups/runtime-pre-folder-share-20260910.tar.gz`, SHA256 `bef751324113195464ac37eacdb832f10b58b4fbb715a490f727637bfaddf075`, 28408012 bytes, mode 600. Separate restore volume `meta-exb-hk-production-restore-folder-share-20260910` passed SQLite integrity and required table readability. Live data was never replaced with a restored copy.
- Previous source retained as each project's `source.pre-folder-share-20260910`; previous production app/web image tags `meta-exb-hk-production-app:pre-folder-share-20260910` and `meta-exb-hk-production-web:pre-folder-share-20260910` retained.
- Existing environment hash and mode 600 preserved, along with production runtime/Caddy volumes. Public ready endpoint healthy; only website TCP 80/443 published, private API/multiplayer ports unchanged. Final available memory approximately 612 MiB.
- Public share SPA HTML and main JavaScript exactly match the release: HTML SHA256 `2d58899b7198eeded1d795a0483b7abd71f7f106ece332f74410ed538d52eb7d`; `/assets/index-DtEbHG3V.js` SHA256 `d0d5b0a6dfe957dc6a3210534b353f8e86e275733887ff3d85ca7886a4fb928c`. Trusted HTTPS and www-to-apex 301 redirect verified.
- Final Hong Kong bundle gates: JS total 3528.4 KiB, largest JS 707.7 KiB, CSS 208.6 KiB, GLBs within limits.
- Logs `.tmp/folder-share-staging-deploy.log`, `.tmp/folder-share-staging-acceptance.log`, `.tmp/folder-share-production-backup.log`, `.tmp/folder-share-production-deploy.log`. No Git commit/push, cloud account/network changes, production test shares, volume removal or secret export.

