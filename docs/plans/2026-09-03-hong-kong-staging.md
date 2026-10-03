# Hong Kong Staging Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a current, data-free Hong Kong release and verify it behind an isolated gateway before any public exposure.

**Architecture:** Build Vite locally with environment-file loading disabled and fixed public origin `https://metaexb.com`. Build Linux production dependencies sequentially on the existing Hong Kong host using pinned official images. Default Compose has no published ports; a staging overlay supplies an internal-only network and a test CA. A separate, unapplied public overlay is the only file that publishes 80/443.

**Tech Stack:** Vite/React, Node 24, Express/SQLite/Socket.IO, Docker Compose, Caddy, npm/Vitest.

---

## Scope and workflow

The user requested the next step after base-runtime preparation. This authorizes preparation, source upload and isolated testing, not DNS changes, public access, OS reboot, data migration, purchases, account/VPN changes or Shenzhen operations. Preserve the dirty checkout; do not create a worktree, commit, push or delegate. The generic execution sub-skill is unavailable; execute this plan sequentially in the current task.

## Task 1: Add tested release preparation

Create `scripts/hongkong-deployment.test.mjs` before implementation. Test a fresh secret, fixed HTTPS origins, single process, no paid integrations, no environment overwrite, safe file selection, no symlink traversal and exclusion of databases/uploads/secrets/tests. Test that default/staging Compose has no host ports, while the separate public overlay has only gateway ports.

Create `scripts/prepare-hongkong-release.mjs` with narrowly scoped environment generation and copying of only package metadata, runtime server JS, deployment files and freshly built static output. Refuse existing destinations. Record a SHA256 manifest. No `.env` contents are printed or copied from development.

Run `npm run test -- scripts/hongkong-deployment.test.mjs`, first failing, then passing.

## Task 2: Add independent Hong Kong deployment files

Create under `deploy/hongkong/`:

- `vite.config.ts`: extend the current required React/Tailwind configuration; `envDir: false`, disabled ambient env prefix, explicit API/sockets/Google values. Build locally through the declared npm build script into an isolated output folder.
- `Dockerfile` and `Dockerfile.dockerignore`: pinned official Node/Caddy images, production-only dependencies, serial native compilation, verify sqlite3/sharp imports, no remote frontend build, non-root app and persistent `/data`.
- `compose.yaml`: one app, one gateway; no published ports, read-only roots, dropped capabilities, bounded memory/logs, persistent data, health check.
- `compose.staging.yaml`: isolated internal Docker network, staging-only TLS config and non-public service alias. Dedicated Compose project and volumes.
- `compose.public.yaml`: unapplied public gateway ports only; deployment requires a separate confirmation and fresh production data/secret/CA volumes.
- `Caddyfile`, `Caddyfile.staging`, `routes.caddy`: same API/uploads/Socket.IO/SPA routing; only staging uses an internal CA. Public Caddy uses automatic trusted HTTPS with internal high ports.
- `README.md`: precise setup/testing commands and public-launch gates.

Validate the actual Caddy and Compose configuration on the host, without applying the public overlay. Keep existing private deployment files unchanged.

## Task 3: Build and stage

Run server syntax, avatar, typecheck, lint and tests. Build via `npm run build -- --config deploy/hongkong/vite.config.ts --outDir .tmp/hk-build-20260903/dist`; run the existing bundle-budget checker with its working directory set to `.tmp/hk-build-20260903`.

Stage a fresh `.tmp/hk-release-20260903` from the reviewed whitelist and new build. Inspect archive members and verify manifest hashes; upload only this archive over the verified Hong Kong SSH connection. Use a new `/home/admin/meta-exb-hk-staging-20260903/source` directory and compare archive hashes before extraction. Build app and web sequentially; do not add swap or resize the host without a separate decision.

Generate a new `.env.hongkong` on the host, exclusively for this staging project. Never read or print its secret. Start only base+staging Compose with project `meta-exb-hk-staging`. Confirm zero host port bindings before tests.

## Task 4: Isolated acceptance

Create `deploy/hongkong/verify-staging.mjs`, invoked only in the staged app container with a publicly exportable test CA and internal gateway alias. All request credentials stay in memory or an explicitly private test state file; print only assertion labels, never tokens/passwords. Use synthetic accounts belonging to this run; never reuse prior accounts.

Verify trusted TLS to the staging hostname, readiness, SPA deep routes, secure cookies, signup/login/logout/stale sessions, CSRF, cross-user gallery/media authorization, uploaded image bytes, gallery/scene persistence and two Socket.IO clients through the gateway. Restart only this staging project and verify saved data persists. Clean up only the exact synthetic accounts/media created by the test and verify they are gone. Do not delete volumes.

Backup/restore: stop only the staging project, archive its runtime volume read-only outside source, restart it, restore the archive into a separate new verification volume, and check SQLite integrity and expected synthetic records/files without ever touching production or Shenzhen. Retain artifacts privately and record the result; if deferred, state that clearly rather than claiming a verified backup.

Browser UI acceptance is not possible through the current restricted SSH key without expanding access. Do not change key restrictions, open ports, launch a tunnel or bypass a prior policy block. Mark UI acceptance as pending until a separately approved preview/public path exists.

## Task 5: Handoff

Update this plan and the main handoff with exact tests/results, deployment directory/image hashes, whether staging remains running, and remaining gates. Public launch still needs system security updates/reboot planning, domain verification/DNS approval, normally trusted public TLS and browser/network acceptance. Never promote staging data or its internal CA to production.

## Outcome

Completed 2026-09-03, final environment check at 19:12 HKT and final backup-verifier check shortly afterward. This is **isolated acceptance**, not public launch or full browser acceptance.

### Implemented with no application-source edits

- Added independent `deploy/hongkong/` files plus the tested environment/whitelist helper. Existing private deployment files, frontend/backend application files and user changes were preserved.
- Kept required Vite React/Tailwind plugins; `envDir: false`, `envPrefix: []` and explicit build constants prevent loading local development configuration. Public API is same-origin; sockets use `https://metaexb.com`; Google is disabled.
- Default Compose has no host port bindings. Staging adds an internal-only network and a staging-only guard. The separate public overlay publishes gateway TCP 80/443 only but was never applied.
- App runs as Node user with read-only root, 640 MiB limit, 384 MiB JS heap, 128 PID limit, no Linux capabilities and one persistent runtime volume. Gateway root is read-only, capabilities dropped, 128 MiB limit; CA/data/config persist separately.
- No OS upgrade/reboot, DNS/hosts-file changes, public access, SSH relaxation, VPN change, Shenzhen operation, commit, push or delegation.

### Local verification

- Failing-first deployment test confirmed missing implementation, then passed. Final focused run: **40 tests passed** across new Hong Kong (31) and existing private (9) deployment support tests, including a Windows junction/symlink rejection check.
- Full application test run: **211 files / 1728 tests passed**, **1 file / 1 Redis integration test skipped** because `REDIS_TEST_URL` was not set. That full run preceded adding the last symlink test; the subsequent focused run covers the final helper version.
- Typecheck, lint, 135-file server syntax check and avatar package validation passed. Both final acceptance helpers passed Node syntax checks. Lint was rerun after release-helper changes.
- Dedicated public-origin build succeeded (Vite 6.4.3). Bundle budgets passed: largest JS 706.1 KiB / 800, total JS 3020.7 / 4800, CSS 205.8 / 220, largest GLB 1621.0 / 1800, all GLB 10356.5 / 11000 KiB.
- Existing unrelated trailing whitespace at `src/main.tsx:7` from the earlier environment check was not changed.

### Exact release and build

- Remote base directory: `/home/admin/meta-exb-hk-staging-20260903`; original runtime source at `source`.
- Original uploaded release: `.tmp/hk-release-20260903.tar.gz`, 11,578,854 bytes, SHA256 `f7c9b1282bf7d904b31eb8c47e539ffe1faa19d7b0ce7ac77872fc5aac3fad9a`.
- Its 220 archive entries passed a forbidden-path check; 192 release-file hashes were independently verified on the host. A private-key/AWS-key marker scan reported no matches. Databases, uploads, `.env`, node_modules, Git, tests and source maps were excluded.
- Final local release (not uploaded): `.tmp/hk-release-20260903-final.tar.gz`, 11,580,302 bytes, SHA256 `39c347cee1acd7d6d9cd171b7722968c89a72f1d40de92a2b2276015ba2a4f11`; 193 manifest files. It differs from the uploaded package only in documentation/acceptance helpers; application and runtime configuration hashes are unchanged.
- Fresh `.env.hongkong` generated **only on the host**, owned by admin, mode 600. This is a staging secret, not a production secret. Never archive the remote source directory wholesale after this file has been added.
- App image ID: `sha256:6b1a4272874e69f8bf0e90d7a37309a21f0754537e773307e29d720fc392f322`.
- Web image ID: `sha256:fc9ec2790215f998156b60015a77bd887fdd01e2f061820eca75dd4c23373ca6`.
- Official Node/Caddy base digests are pinned in the Dockerfile. Production dependency installation/native compilation took about 96 seconds. A spot check during compilation showed ~398 MiB available RAM; no swap was added and container OOM flags were false. The frontend was built locally.
- Gateway build began after native compilation but before the app image export finished. An initial no-build start therefore found the app image not yet registered; no app ran from an incomplete image. After the original build returned success, a normal start succeeded. Future execution should wait for the complete app build/export result before the gateway build/start.

### Isolated live acceptance passed

The only website was inside Docker network `meta-exb-hk-staging_default`, verified `internal=true`, with host port bindings `{}` for both containers. The `metaexb.com` alias existed only in Docker DNS, not public DNS or the user's hosts file.

- Public and staging Caddy configurations both validated. Only staging Caddy was run; no public certificate was requested and no CA was installed on the user's computer.
- Staging TLS certificate validation with its explicit public CA, readiness 200 and SPA `/profile` deep-route HTML passed.
- Two freshly generated synthetic accounts registered; session cookies had Secure, HttpOnly and SameSite=Lax. Session refresh, valid-CSRF changes and missing-CSRF denial passed.
- Synthetic 64×64 PNG upload and binding to a private gallery passed. Anonymous/other-user media reads, other-user gallery reads and writes were denied as expected.
- Foreign HTTP origin received no CORS access; foreign WebSocket origin was rejected.
- Two real Socket.IO clients connected through Caddy TLS, joined the owner room, exchanged movement and synchronized scene state. A different account was denied room access.
- Logout removed the session, unauthenticated identity access was denied, and login recovered from an invalid stale cookie. This live check did **not** create a correctly signed expired token; expiry behavior is covered by local tests rather than this live run.
- After restarting staging app and gateway, account login, exact saved scene JSON and uploaded image hash still matched.

Acceptance helper `/home/admin/meta-exb-hk-staging-20260903/verify-staging.mjs` SHA256: `25f03a9d2542535c8648ae1924f2373dd07d2f3f3a817145f1c7bfd2274ca314`.

### Backup, restore and cleanup

- Stopped both staging services before backing up the entire runtime volume, including database and uploaded files. The app was restarted for subsequent checks, then stopped at completion.
- Remote backup: `/home/admin/meta-exb-hk-staging-20260903/backups/runtime-precleanup-20260903.tar.gz` (8124 bytes, admin:admin, mode 600, parent mode 700).
- Backup SHA256: `5a542fe356f40fe6380182cda2fcf80092ba9ac59c769d0d590c6f8c8195ab8c`.
- Restored into the new, independent volume `meta-exb-hk-restore-check-20260903`, never over the original data. A network-disabled container read this copy read-only: SQLite integrity `ok`, both synthetic account records, the saved gallery scene and the exact PNG hash passed.
- SQLite WAL-mode snapshots need care on read-only mounts. The final verifier requires a checkpointed snapshot with no non-empty WAL and uses [SQLite immutable URI mode](https://www.sqlite.org/uri.html), only for this stopped, restored copy. It does not disable locking for any live database.
- Final backup helper SHA256: `0b6f5e7fce0e4e6305de9a0232b1823a655b46033176662e6edf33cfcc30f167`, kept beside source on the host. Its final guarded version was rerun successfully.
- Downloaded the same backup to `D:/meta_exb/web_ui_new/.tmp/hk-staging-backups-20260903/runtime-precleanup-20260903.tar.gz` in an ACL-protected directory, and matched the SHA256.
- Deleted only the two accounts generated by this acceptance run through the normal account API, checked prior identity tokens now receive 401, and verified staging DB counts: **users=0, galleries=0, media=0**. The private temporary test-state file was removed. No user or old Shenzhen data was touched.
- The **pre-cleanup backup and restored verification volume still contain synthetic test records**, intentionally retained privately as restoration evidence. They are not production seed data, and should not be described as empty. No volumes were deleted.

### Final state and remaining gates

- `meta-exb-hk-staging-app-1` and `meta-exb-hk-staging-web-1` are **stopped**, not removed. Their app/runtime/Caddy volumes and images remain; the restored verification volume also remains. Docker reported no running containers.
- Final host listeners: SSH 22 and local DNS 53 only. No website listener, no DNS modification, no publicly shareable Hong Kong site yet.
- Final resources: ~921 MiB available RAM, no swap; root filesystem ~6.6 GiB used / 31 GiB available.
- Public launch remains gated on OS/security updates and any needed reboot, domain verification/ClientHold/DNS checks, a fresh production project/data/secret/CA, explicit public-access confirmation, normal publicly trusted TLS, browser UI acceptance, and actual mainland-network testing. AI and Google login remain unconfigured.
- Browser UI was not tested remotely because no preview/public access exists and the dedicated SSH key intentionally disallows forwarding. Do not bypass that restriction or reinterpret internal API acceptance as full visual/browser acceptance.
- To reuse final helpers, take them from the current local checkout or their explicit standalone remote paths, not from the old uploaded source archive. Never rerun `prepare` against unknown or real accounts.
