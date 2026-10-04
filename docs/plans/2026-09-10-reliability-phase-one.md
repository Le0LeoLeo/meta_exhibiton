# Reliability Phase One Implementation Plan

**Goal:** Deliver password recovery, safe recovery from obsolete frontend chunks, and repeatable browser acceptance of the exhibition lifecycle.

**Architecture:** Reuse the existing SMTP transport, persisted session version and single-instance SQLite deployment. Reset links are hashed, expire after 30 minutes and are consumed by one atomic conditional password update. Failed chunk loads prompt an explicit reload with a downloadable scene recovery copy; never force-refresh an editor. Browser acceptance uses isolated synthetic data and the actual application.

**Tech Stack:** React, TypeScript, Express, SQLite, Nodemailer, Vitest, Playwright, Vite, Docker Compose.

## Task 1 — Account recovery
- Add `server/services/passwordResetService.js` and its SQLite lifecycle tests. Add reset mail methods to `emailVerificationService.js`; keep existing SMTP configuration and verification behavior.
- Wire schema into `server/db.js`, dependencies into `server/index.js`/`server/config/deps.js`, and rate-limited request/confirm routes into `server/routes/authRoutes.js`.
- Test expiry, concurrent consumption, resend, delivery failure, password-change invalidation, account deletion, generic request replies and session revocation.
- Add `src/app/pages/ResetPassword.tsx`, API calls, three-language copy, login link and route; test mismatch, invalid link, network failure and success.

## Task 2 — Safe release recovery
- Add a small recovery registry and preload-error notification mounted above RouterProvider. Editor registers a current, sanitized scene export while mounted and retains it across a failed navigation.
- Offer a download before an explicit refresh when scene work exists; handle download failures and show offline copy. Extend RouteErrorPage for obsolete chunks; never loop automatic reloads.
- Test real failed lazy imports in the browser and component recovery behavior.

## Task 3 — Browser acceptance
- Add an npm browser-test command with isolated backend runtime, synthetic accounts and uploads. Cover create/upload/save/reopen/publish/anonymous view/withdrawal and stale saves, plus recovery UI.
- Add CI running npm checks and browser acceptance. Use no real accounts or production data.

## Task 4 — Release
- Run focused regressions, then npm run check, browser acceptance and fresh Hong Kong build/bundle whitelist validation.
- Compare release runtime files with current production before packaging. Preserve unrelated work, production secrets, data, volumes, backups and certificates. No Git commit/push/branch changes.
- Accept in isolated Hong Kong staging, verify a backup restore, promote accepted images, then verify trusted HTTPS, readiness, www redirect, served hashes and ports 80/443 only.
- Record exact validation and deployment outcomes here. No unsolicited mail to real recipients; test reset delivery in a controlled mail sink.

## References
- OWASP password recovery: https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
- Playwright web servers: https://playwright.dev/docs/test-webserver

## Execution status
Completed and deployed to Hong Kong production; public verification 2026-09-10 16:43:40 HKT.

### Implemented behavior
- Added `/reset-password`, localized request/confirmation/retry states, hashed 30-minute tokens, per-account send cooldown, bounded background delivery, generic request replies, atomic consumption and session revocation. Existing configured SMTP is reused without changing production secrets.
- Added Vite preload failure recovery and route error recovery. No automatic reload; active scenes are exported without media access tokens and retained in memory across the failing navigation, with a download required before the explicit reload action. Already-open pages from before this release cannot acquire this new handler without first loading the new version.
- Added `npm run test:browser`, isolated fresh databases, authenticated TLS mail capture through a local socket, and a GitHub Actions workflow. The browser workflow deliberately uses the supported no-WebGL/2D mode: CPU-rendered concurrent 3D contexts stalled this headless environment. No FPS/performance claim is made.
- Corrected two existing artwork-editing tests that assumed the official demo still contained three artworks; they now verify all unchanged artworks in the expanded eleven-artwork scene. Bounded Vitest parallelism and timeout for developer/CI machines.

### Validation so far
- Focused reset service, auth routes, UI recovery, SMTP, editor and schema checks passed.
- First aggregate run was stopped after resource-related delays and revealed the stale three-artwork assertions. The next run passed 280 files / 2,155 cases, skipped external Redis, and reported two worker-start timeouts. Those two files passed independently: 14 cases. A final aggregate rerun is in progress.
- Browser acceptance: 3 passed (15.7 seconds), including actual received TLS reset mail, one-time consumption, old HTTP session rejection, new-password login; upload/build/reload/publish/anonymous image viewing, stale save rejection and withdrawal; failed built lazy chunk and explicit recovery.
- Fresh HK frontend build and actual-directory bundle/whitelist gate passed. Production dependency entries in package-lock are unchanged; only browser-test development dependencies were added. App image layers the verified production runtime with the validated server files and package metadata, with no dependency download.
- Hong Kong isolated acceptance passed TLS/readiness, cookies/CSRF, cross-user denial, stale/missing save versions, conditional media withdrawal, two WebSocket clients, reconnect recovery, forbidden origins, restart persistence and exact synthetic cleanup.
- The accepted app image also passed a disposable network-isolated reset test with a memory mail sink: schema, register/verify, reset, old-password rejection, old HTTP/socket revocation, one-time consumption and new login. Initial helper runs targeted Nodemailer's separate CommonJS entry and therefore did not capture ESM sends; the standalone helper now targets the application's ESM entry. No product code changed for this correction.
- Staging backup: `/home/admin/meta-exb-hk-staging-20260904/backups/runtime-pre-reliability-20260910.tar.gz`, SHA256 `6bd400714b1acfdc0fed1a44b44fe815aa6597ade260413790e5f9a25325509b`, mode 600, 32,685 bytes. Independent restored volume matched archived files and passed SQLite integrity.
- Final r2 runtime files and all 113 served HTML/JS/CSS hashes match accepted staging. R2 differs from R1 only in the corrected standalone verification helper, not app/web runtime bytes.

### Accepted release
- Local package: `.tmp/hk-reliability-release-r2-20260910`, 285 files.
- Archive SHA256: `a1546724a2fcdb5e4918277fb006cc3683a482803b1d78ec3289e0f16616e961`.
- Remote package: `/home/admin/meta-exb-hk-reliability-r2-20260910`.
- App: `sha256:ea27008269a07f936a9f4cfb71a71445c3afe0da572975456dbf2fcbcfc19013`.
- Web: `sha256:4eb4a214dca83c2f36b0a13ec47c52aad5420a2b07964965096e574de923bdcf`.
- Logs: `.tmp/reliability-*.log`; deployment/backup/rollback helpers: `.tmp/reliability-20260910/`.
- No Git commit or push. CI workflow is prepared locally; no hosted CI run is claimed.

### Final validation and production
- Final `npm run check` exited 0: server syntax, avatar assets, TypeScript, ESLint, **282 suites / 2,169 tests passed**, one external Redis test skipped, fresh build and bundle gate passed. No unhandled errors in this final run. Aggregate log: `.tmp/reliability-check-final.log`.
- Final normal-build budgets: largest JS 707.7 KiB / 800; total JS 3,576.3 KiB / 4,800; CSS 219.5 KiB / 220; largest GLB 1,031.0 KiB / 1,800; total GLB 5,563.2 KiB / 11,000. The HK build separately passed its own actual-directory gate.
- Production pre-update backup: `/home/admin/meta-exb-hk-production-20260904/backups/runtime-pre-reliability-20260910.tar.gz`, SHA256 `ff3cd6e5dad4f2bc8f85c4120a195a69e71914aaab188064b8710e0a82332359`, mode 600, 28,777,743 bytes. Independent restore matched all files and passed SQLite integrity. Backup and restore volume retained privately.
- Promoted the exact accepted app and web images listed above to the existing `meta-exb-hk-production` project. Environment file checksum remained unchanged; runtime data, uploads, certificates and volumes were preserved. The migration only adds the password-reset table.
- Public verification over trusted HTTPS matched **113 HTML/JS/CSS hashes**. Homepage, gallery, boxes and `/reset-password` returned 200; `/api/ready` reported ready; `/api/auth/config` reports both email verification and password reset enabled. Invalid reset input returns 400 `INVALID_RESET_INPUT`, without modifying an account or sending mail. `www` redirects to the apex preserving the path.
- Production app publishes no host ports. Gateway publishes only TCP 80/443. App is healthy; web is running and verified by its public responses.
- Staging's synthetic accounts/assets were removed by the acceptance script. Both staging containers were stopped after final verification; backup and restore volumes remain intact.
- Previous source: `/home/admin/meta-exb-hk-production-20260904/source.pre-reliability-20260910`. Previous image tags: `meta-exb-hk-production-app:pre-reliability-20260910` and `meta-exb-hk-production-web:pre-reliability-20260910`. Rollback: `sh /home/admin/reliability-rollback.sh production`; restores prior source/images, retains failed files, and does not replace runtime volumes or secrets.
- Validation limits: external Redis was not exercised; browser workflow uses supported 2D fallback; no real recipient received an unsolicited reset test email; hosted CI awaits a user-requested Git push. Subsequent roadmap phases remain separate work.
