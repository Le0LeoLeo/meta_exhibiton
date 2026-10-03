# Database Repository Separation Implementation Plan

**Goal:** Reduce the database facade's responsibilities by extracting competition and growth persistence with explicit database dependencies and regression coverage.

**Architecture:** Follow the existing user/media repository pattern. Keep `server/db.js` exports, defaults, SQL behavior and transaction boundaries compatible; leave schema initialization and production storage unchanged. Use the existing dirty workspace without Git operations, as required by the project.

**Tech Stack:** Express ESM, sqlite3, Vitest, Docker/Caddy.

## 1. Establish behavior
- Run existing competition/growth route and growth asset service tests before changes.
- Create `server/repositories/competitionRepository.test.js` and `growthRepository.test.js` using disposable in-memory SQLite connections. Cover visibility/ownership queries, sharing changes, vote counts, rollback and recovery after failed writes.

## 2. Extract cohesive modules
- Create `server/repositories/competitionRepository.js` and `growthRepository.js`.
- Move their persistence functions from `server/db.js`, passing the database explicitly as the last argument. Preserve the facade's public signatures and default behavior, including injected vote transactions.
- Compare moved function bodies to the pre-change snapshot; change only the database identifier. Run focused repository, route, initialization and data-integrity tests, followed by full `npm run check`.

## 3. Release and acceptance
- Build fresh HK assets with the existing public Google client ID and the HK wrapper. Package only whitelisted runtime files and verify the delta against the current production manifest.
- Reuse the verified production dependency layer only if package/lock files match. Validate isolated HK HTTPS, affected competition/growth workflows, restart persistence and independent restoration before production.
- Back up source/runtime and update the existing production project. Verify public HTTPS, readiness, redirect, file hashes, backend manifest and SQLite integrity; preserve data, secrets, certificates and volumes.
- Record exact results and remaining single-host, large-editor and physical-device limitations. This scoped refactor does not claim to resolve them.

## Execution
- Current production app verified as `sha256:540fcfbd7d991ee9c74d24b3aba6a25bfc054677f94e57547237311adaae757b` before work. Host has 14 GiB disk available. Existing release and deployment records match the previous task.
- Baseline: existing three route/service files, 50 tests passed. After extraction: seven focused files, 66 tests passed, including six new in-memory SQLite cases.
- Moved 17 competition functions and 15 growth functions into explicit-connection repositories. Main facade reduced from 1,837 to 1,369 lines. AST-based one-time comparison verified every original facade parameter list, all moved bodies/SQL (only database access identifier substituted), schema initialization and unrelated bodies.
- Only existing runtime file differing from the previous release is `server/db.js`; the two new repository modules are the only new runtime source files. Package and lock files are unchanged.
- The first full check identified the now-unused facade helper import; removed it, then restarted the full check. No lint suppression added.
- Prepared isolated HTTPS acceptance for child/exhibit/text/comment creation, sharing ownership and revocation, competition submission/owner review/voting, duplicate rejection, restart persistence and independent restoration of these exact records. No production test accounts will be created.
- Validation: syntax/avatar/typecheck/lint passed. Full suite completed in 752.86 seconds: 306 files / 2,358 tests passed, one file/test skipped, and one development proxy test hit its existing 3-second request deadline. That unchanged file then passed both tests in an isolated rerun (2.75 seconds overall); no timeout or assertion was relaxed. Thus all 2,359 runnable cases have passed across the full run and focused rerun, but the single `npm run check` invocation exited on that transient failure. Default production build and bundle checks were run separately afterward and passed.
- Fresh HK build/budgets and whitelist passed: 461 files, largest JS 707.7 KiB, total JS 3688.0 KiB, CSS 331.8 KiB. All frontend files are byte-identical to the previous HK release. Manifest comparison confirms exactly three runtime differences: the facade and two new repositories.
- Archive SHA256: `ed0c661ce4c8fd6c8fba0aa78a8d1dcdd320d1ad24bc48887c074244d439e687`; isolated release directory: `/home/admin/meta-exb-hk-repositories-20260914`.

## Production completion, 2026-09-14

- Isolated HK HTTPS/auth/CSRF/media/save-conflict/WebSocket checks passed. Added domain acceptance passed through the actual HTTPS routes: growth content/comments, ownership boundaries, sharing/revocation, competition submission/owner review, voting and duplicate rejection. All relevant saved records survived app/web restart.
- Bounded collaboration: 16 clients, 80 operations, p50 19ms / p95 32ms / max 36ms, reconnect verified. This does not establish production audience capacity.
- Independent stopped-volume restoration verified both synthetic accounts, scene and image hash, plus competition vote row/count and growth exhibit, share token, text asset and comment. The small snapshot check took 1 second; it does not establish production RTO. Restore volume `meta-exb-hk-repositories-restore-20260914` retained. Sharing revocation and entry deletion verified, exact synthetic accounts cleaned, staging stopped without public ports.
- Updated the existing production project after all individual validation stages had passed. Production environment checksum and mode 600 preserved; runtime/media/certificate volumes retained. No Git commit, push or branch operations.
- Prior source: `/home/admin/meta-exb-hk-production-20260904/source.pre-repositories-20260914`; consistent runtime backup: `/home/admin/meta-exb-hk-production-20260904/backup-repositories-20260914/runtime.tar.gz`. Previous images retained under `pre-repositories-20260914` tags.
- Final app image: `sha256:5434c5fa085f54883f04a5bf112a80ffdc5b341ca6d00b4ae349c73dcaeb203a`, matching staging. Web image unchanged: `sha256:bc66f16330240ca18a58d569430317ee37354cb34625dc61f572e414640fc5a8`.
- Public trusted HTTPS, readiness, www redirect, 345 exact file hashes, missing-exhibition metadata exclusion, running backend manifest and read-only SQLite integrity passed. Website host bindings remain only 80/443; app has no public host port.
- No new browser UI test was required for this backend-only extraction: the freshly built frontend is byte-identical to the previous verified release, and affected server workflows were exercised over isolated HTTPS. Physical-phone FPS remains unmeasured.
- Remaining work: single-host failure risk, further separation of schema/gallery/builder persistence and the large editor, and physical-device performance measurement. This refactor improves boundaries but does not claim failover or horizontal scaling.

Evidence logs are under `.tmp/repository-*-20260914.log`; one-time equivalence check is `.tmp/verify-repository-extraction-20260914.mjs`. Domain acceptance and independent restore helpers are `.tmp/repository-domain-20260914.mjs` and `.tmp/repository-restore-20260914.mjs`; they are guarded for isolated staging and were not packaged into the public runtime.
