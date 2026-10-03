# Reliability phase four

Protect same-page edits across interrupted collaboration sessions. Capture the baseline before unconfirmed edits, retain the local scene across disconnect, wait for the current remote snapshot, and offer an explicit choice to merge local changes or adopt the remote scene. Preserve a downloadable local copy. Pause new collaboration writes and queued/manual/autosave requests while this choice is pending. Already dispatched HTTP requests cannot be undone; existing revision conflicts remain enforced.

Scope recovery to the current room, share context and account; clear it on leaving the editor. Do not introduce offline disk storage or replay uncertain operations. Retain remote deletions when merging and disclose local precedence for fields changed on both sides. Validate interrupted edits, late/remote changes during review, clean reconnects, permission/account changes and persistence guards. Complete focused/full/browser checks and Hong Kong staging/deployment with the existing backend image and preserved runtime data.

Completed and deployed to Hong Kong; public verification 2026-09-10 18:04 HKT.

The bridge captures the baseline synchronously before connection state clears pending IDs. An unconfirmed batch retains its earliest baseline. Rejoining buffers the latest remote snapshot and subsequent operations separately from the editable scene. A second disconnect invalidates that remote snapshot. Clean sessions adopt the remote scene automatically; changed or uncertain sessions require a choice. A missing live scene requires an explicit rebuild choice. Viewer permissions prevent merging. Account, room, share-context changes and unmount clear the review.

The page blocks scheduled/manual/queued saves while review is active and ignores refresh responses that would overwrite local content. A new item accepted before its acknowledgement was lost is merged by ID without duplication, preserving subsequent local changes. Three-language UI explains local precedence and remote deletion behavior, and offers the existing sanitized scene-copy export.

Focused checks: 24 bridge cases passed, including sent/unsent edits, intervening remote operations, repeated disconnect, view-mode discard, permission loss, account/share/room changes and explicit missing-scene recovery. Five merge cases, four delivery UI cases and 25 gallery page cases passed. The broader browser suite exercises creation, publication, recovery and mobile 2D fallback; the new reconnect decisions are tested at the real bridge/store and component level, not claimed as a full 3D browser/network-outage test.

Limits: this is same-page memory protection, not persistent offline storage. Leaving/reloading requires downloading a copy first. Already dispatched HTTP requests cannot be undone; revision checks still reject stale saves. This does not claim maximum collaboration capacity or physical mobile-device validation.

## Validation and deployment

- `npm run check`: server syntax, avatar integrity, TypeScript, ESLint, 285 passed test files / 2,200 passed cases, one external Redis skip, build and bundle budgets passed. The subsequently added account/share regression passed in the 24-case bridge suite and file ESLint check. No application changes followed full validation.
- `npm run test:browser`: all five workflows passed in 18.8 seconds. Loopback test services stopped afterwards.
- Fresh HK build and whitelist: 288 files in `.tmp/hk-reconnect-release-20260910`; archive `.tmp/hk-reconnect-20260910.tar.gz`, SHA256 `59b07b7bf7e294ec6c2311ea2eca37688fbddd12cc91a5ebe3dbfdac20b86785`. Verified before extraction to `/home/admin/meta-exb-hk-reconnect-20260910`.
- JS maximum 707.7 / 800 KiB, JS total 3586.5 / 4800 KiB, CSS 219.5 / 220 KiB, GLB total 5563.2 / 11000 KiB. Budgets unchanged.
- Isolated staging passed TLS, sessions/CSRF, media permissions and withdrawal, stale revisions, WebSocket room/origin protections, reconnect, restart persistence, and independent backup restore. Bounded load: 16 sockets, two rooms, 80 accepted operations, 35 other-client broadcasts per socket, p50/p95/max acknowledgement 19/37/42 ms (internal staging only).
- Both staging runtime files and 113 served HTML/JS/CSS files matched the final manifest. The exact accepted images were promoted to production. Public HTTPS verified all 113 frontend hashes, readiness, SPA routes, www redirect, invalid-reset rejection, public summary pagination and media denial. Only TCP 80/443 publicly mapped. Environment checksums unchanged.
- Production app retained `sha256:542698bfbded216582915d4f789f025b328abb5b6b754e5d4e577552eb7ead7f`; no production backend restart (51-minute uptime at final check). Production web `sha256:b2f93033f4c35e8ba58db027920be48649380ae05611e19f8b1e24ce69b201d8`.
- Staging backup `/home/admin/meta-exb-hk-staging-20260904/backups/runtime-pre-reconnect-20260910.tar.gz`, SHA256 `750865757c629d12ee5bb24c9ae463b4a6e9ad9b0b9beaac6bd2b0a606df71ef`, 34,379 bytes, mode 600; independently restored volume retained. Previous verified production runtime backup remains untouched; no production runtime backup/restart was needed for this frontend-only release.
- Staging users/galleries/media_assets all zero after scoped cleanup; staging stopped. No synthetic production users, Git commit/push, secret changes or runtime-volume replacement.

## Rollback and evidence

The prior production source is `/home/admin/meta-exb-hk-production-20260904/source.pre-reconnect-20260910`; prior images use `meta-exb-hk-production-{app,web}:pre-reconnect-20260910`. Run `sh /home/admin/reconnect-rollback.sh production` only if rollback is required; it restores the prior source/images while retaining failed release files and leaving runtime data/env intact. The prior web image is `sha256:9125c250484be331d0655f1165e3f23132ba01893e2a9f0819d9ddd99054aa7a`.

Local evidence: `.tmp/reconnect-check.log`, `.tmp/reconnect-browser.log`, `.tmp/reconnect-hk-build.log`, `.tmp/reconnect-stage-deploy.log`, `.tmp/reconnect-stage-acceptance.log`, `.tmp/reconnect-production-deploy.log`, `.tmp/reconnect-public-verify.log`. Deployment/verification helpers retained under `.tmp/reconnect-20260910/` and `/home/admin/reconnect-*.sh`.
