# Project Analysis Fixes Implementation Plan

**Goal:** Correct the confirmed translation, audit, release-validation and documentation defects; remove idle scene serialization and make media withdrawal revalidate access.

**Architecture:** Preserve the current application, gallery revision checks, serialized saves, single-instance deployment and existing runtime data. Use focused scene subscriptions through the studio facade, comprehensive static translation discovery, and validation of the exact release directory. Do not expand phone editing, artwork limits or graduation deployment scope.

**Tech Stack:** React, Zustand, TypeScript, Vitest, Express, Python unittest, Vite, Docker Compose.

## Tasks

1. Frontend: translate StudioCanvasRoot notices in all three catalogs; replace VirtualGalleryCreate's 120ms serialization polling with scene-change observation. Add regression tests for idle work, saves, conflicts and remote updates.
2. Audit: discover production source recursively in audit_i18n.py; add regression cases in test_audit_i18n.py and regenerate i18n_audit_report.md without deleting translation keys.
3. Release: let check-bundle-budget.mjs validate a specified directory; enforce this on stageRelease's actual builtDist and test rejection. Correct Hong Kong README's current/historical state and commands.
4. Media: require revalidation of access-controlled media, test withdrawal and conditional requests without touching stored assets. Document that previously cached responses cannot be remotely erased.
5. Validation: run focused regressions, then npm run check and Python tests. Exercise isolated Hong Kong staging, including persistence/conflicts and media withdrawal. Compare release runtime files against production before choosing the deployment delta so local-only graduation work is not promoted.
6. Deployment: deploy only validated task changes to the existing Hong Kong project, preserve secrets/data/volumes/certificates/backups, verify public HTTPS/readiness/redirect and actual release hashes; record results here and in HK_DEPLOYMENT.md. No Git commit/push.

## Verification status

## Implemented

- Studio notices now use all three catalogs; corrected ten additional QR-sharing keys missing from English and Simplified Chinese.
- Scene subscriptions through the studio facade replace the 120ms full-scene serialization loop. UI-only state changes do not schedule saves; saving remains serialized, retains the 350ms wait, handles edits during a pending save, and pauses for revision conflicts.
- Translation discovery now recursively scans 389 production files and reads the actual composed catalogs. All 1,554 static keys exist in all three locales. The 660 unreferenced candidates explicitly exclude any inference that dynamic keys can be deleted.
- Bundle checks accept a directory, and release staging checks its actual builtDist before creating a destination. Both helpers are packaged. Deployment/current-state docs are corrected without rewriting historical records.
- Published gallery media requires application-layer revalidation; unauthorized responses are non-cacheable. Hong Kong Caddy already adds no-store, so the prior application-level one-hour policy was not proof that public Hong Kong responses were cacheable. Gateway protections are preserved.
- Staging acceptance now covers conditional media withdrawal, stale/missing save revisions and recovery of a distinct unsaved live scene after reconnect. Partial preparation cleanup is independent of successful verification and only removes the recorded synthetic accounts.

## Local validation

- Server syntax, avatar assets, TypeScript and ESLint passed. The initial full command picked up this task's backup named `.test.js`; it was renamed to `.txt`. The complete rerun passed 277 suites / 2,130 tests, with one external Redis test skipped; build and bundle gates then passed. No product test failed in that initial run.
- Python audit: 17 tests passed, including reproducible report output. Final release-support regressions: 41 tests passed.
- Both normal and Hong Kong builds passed the actual-directory budgets: largest JS 707.7 KiB, total JS 3,544.3 KiB, CSS 212.0 KiB, largest GLB 1,031.0 KiB, total GLB 5,563.2 KiB.
- Local browser: English placement prompt displayed; a synthetic text/light placement was edited, automatically saved without clicking Save, and reloaded with X=8.75 preserved. The only synthetic exhibition was deleted through the UI; the temporary server was stopped. AI waiting copy has component-test coverage; QR and multiplayer were not manually verified in this browser session.

## Isolated Hong Kong acceptance

- Authentication/CSRF, cross-user access denial, stale/missing revisions, published image ETag revalidation, withdrawal, owner access preservation, foreign origins, two Socket.IO clients, reconnect recovery and restart persistence passed. Synthetic accounts/assets were cleaned.
- Initial staging was stopped and had to be started before runtime inspection. The first acceptance attempt rejected Caddy's combined `no-store, private, no-cache` header; assertions now check directives, and the partial-preparation cleanup successfully removed only that attempt's synthetic data.
- An independent restore volume matched every archived file and passed SQLite integrity. Staging backup SHA256: `faafe06c5ae05f466a0be50811fc71d166ffa3defdadc451476726de9d176277`; mode 600, 33,107 bytes. This synthetic restore volume is retained privately and is not production seed data.
- Final release r2 source matches accepted staging; the running backend and 108 served HTML/JS/CSS hashes match its manifest. Only `server/routes/mediaRoutes.js` changes the running backend, layered over the verified existing production image; runtime dependencies and schema are unchanged.

## Release

- Final local release: `.tmp/hk-analysis-fixes-release-r2-20260910`; 250 whitelisted files / 282 archive entries, no prohibited paths.
- Final archive SHA256: `9fdbfc96a6d1363ce1ac87281badee790d3cb7bb9e103577347ca1b74d934b68`.
- Remote release: `/home/admin/meta-exb-hk-analysis-fixes-r2-20260910`.
- Accepted app: `sha256:badcd2f7df8427a6abf0a86254deae93182a31054acde15dba2e11f70cd30090`.
- Accepted web: `sha256:946d9eb6aa192cb7adeec6a799e08a527b7a4d4e859a65645bff00136e667e7d`.
- Logs and recovery helpers: `.tmp/analysis-fixes-20260910/`.

## Production completed — 2026-09-10 13:25:58 HKT

- Promoted the exact accepted app/web images above to the existing `meta-exb-hk-production` project. Both services are healthy; public `/api/ready` returns ready.
- All 108 public HTML/JS/CSS hashes match the final r2 release over trusted HTTPS. Homepage, virtual gallery and boxes entry routes return 200; `www` redirects to the apex preserving `/boxes`. The new nonexistent-media probe returns 404 with no-store. No synthetic accounts or exhibits were created in production.
- App publishes no host ports; gateway publishes only TCP 80/443. Existing production environment hashes matched before/after the update; data, uploads, certificates and volumes were preserved.
- Production backup: `/home/admin/meta-exb-hk-production-20260904/backups/runtime-pre-analysis-fixes-20260910.tar.gz`; SHA256 `ae2d5797c5e0ff9e4b647f1cada504d6069f43c91737efe898e4f5fc03c64e3d`, mode 600, 28,387,643 bytes. Independent restore matched every archived file and passed SQLite integrity; backup and restore volume retained privately.
- Prior source: `/home/admin/meta-exb-hk-production-20260904/source.pre-analysis-fixes-20260910`. Prior app/web tags: `meta-exb-hk-production-app:pre-analysis-fixes-20260910` and `meta-exb-hk-production-web:pre-analysis-fixes-20260910`. Recovery helper: `/home/admin/analysis-fixes-rollback.sh production`; it restores only the backed-up source/images and preserves failed source separately, without changing runtime volumes or secrets.
- Staging stopped after verification; its synthetic test accounts/assets were removed and existing backup/restore volumes retained. Local browser test servers were also stopped. No Git commit/push.

## Scope boundaries

Phone viewing mode, the deterministic 30-image quick layout, persisted-scene conflict resolution and the single-instance deployment remain deliberate product/architecture limits. The 9/10 pre-change production manifest already included graduation code; this task does not claim a new graduation rollout or complete business acceptance. No Git commit/push.
