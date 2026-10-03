# Reliability phase three

Scope: detect missing edit-operation and recovery-snapshot confirmations, preserve the local scene and pending identities, pause new edit operations after 20 seconds, show localized waiting/delayed feedback with a sanitized scene download, and resume after late acknowledgements. Do not replay uncertain operations or imply that live collaboration acknowledgements are durable database saves.

Add repeatable, bounded staging concurrency acceptance and record latency/results without production load or synthetic production users. Preserve existing ordering, authorization and reconnect logic. Run focused monitor/UI/bridge tests, complete checks, existing browser acceptance, isolated Hong Kong acceptance and exact production release verification. No Git commit/push; preserve secrets, data and backups.

Implementation and local evidence:
- Each pending edit/recovery identity retains its original deadline; subsequent edits do not restart the timer. Fast confirmations remain quiet, waits over one second show status, and 20-second delays pause new edit operations without removing pending IDs or modifying the exported scene.
- Late acknowledgements clear the delay and the bridge sends changes made during the pause. Cross-room acknowledgements cannot settle local pending work. Disconnect, room/session changes, permission loss and component cleanup remove obsolete timer state.
- The status appears across studio modes. Its download uses the existing live, sanitized recovery reader; export failures keep the page open. Existing save and reconnect behavior is preserved; uncertain operations are never replayed automatically.
- `npm run check` passed: 2,191 tests across 285 files, one external Redis test skipped; typecheck, lint, syntax, assets and build passed. Largest JavaScript 707.7 KiB; total JS 3582.4 KiB; CSS 219.5 KiB, all within unchanged budgets.
- No existing backend application files or dependencies changed. Production will retain the existing App image. The new staging helper is bounded to 16 clients, two synthetic rooms and 80 edits, reporting acknowledgement latency rather than claiming maximum capacity.

Acceptance and deployment, 2026-09-10 17:40 HKT:
- Five browser workflows passed in 20.5 seconds, including full mobile device emulation, constrained-network 2D viewing, publication/withdrawal, password recovery and catalogue retry.
- Fresh Hong Kong build passed budgets; whitelist contains 288 files. Archive `.tmp/hk-confirmation-release-20260910.tar.gz` SHA256 `2fa828f8d48ef7b971a699c593627e2cbac5ba3c7c3d615dcd2db13c207a876d`; host hash verified before extraction to `/home/admin/meta-exb-hk-confirmation-20260910`.
- Isolated staging: 16 connections, two rooms, 80 acknowledged operations, 35 unique other-editor broadcasts per client and 40 distinct versions per room observer. No cross-room delivery or room errors. Reconnection retrieved all 40 added items in its room. Acknowledgement latency: p50 20 ms, p95 31 ms, maximum 46 ms. This is a small internal TLS-network sample, not an internet latency or capacity guarantee.
- Existing staging auth, CSRF, private media, revision conflict, multiplayer and restart persistence checks passed. Staging backup restored into a separate volume with matching files and valid SQLite integrity; SHA256 `4e4bbd75c026b11eccb492a738380ad6bd329089ff1fb58814d6953a4a02356c`, 34,258 bytes, mode 600.
- Actual staging runtime and all 113 served HTML/JS/CSS hashes matched the release. Production uses the same accepted Web image `sha256:9125c250484be331d0655f1165e3f23132ba01893e2a9f0819d9ddd99054aa7a`.
- App image remains `sha256:542698bfbded216582915d4f789f025b328abb5b6b754e5d4e577552eb7ead7f`. It was not restarted for this frontend-only production update (28-minute uptime at final check). Production environment checksums, runtime data, certificates and previous verified backups were preserved.
- Public HTTPS, `/api/ready`, www redirect, all 113 HTML/JS/CSS hashes, reset validation and bounded public summaries passed. Only website TCP 80/443 published; app healthy. Staging users/galleries/media counts are all zero, its containers are stopped, and local browser-test listeners are closed.
- Rollback source: `/home/admin/meta-exb-hk-production-20260904/source.pre-confirmation-20260910`; prior image tags `meta-exb-hk-production-{app,web}:pre-confirmation-20260910`; helper `sh /home/admin/confirmation-rollback.sh production`. No production database restore is needed for this frontend-only change.
- Logs: `.tmp/confirmation-check.log`, `.tmp/confirmation-browser.log`, `.tmp/confirmation-hk-build.log`, `.tmp/confirmation-stage-acceptance.log`, `.tmp/confirmation-production-deploy.log`, `.tmp/confirmation-public-verify.log`. No Git commit/push.

Operational interpretation: a delayed notice means receipt is uncertain, not that a database save succeeded or failed. Keep the page open, download the current scene before leaving, and check connectivity/service readiness. Do not blindly replay operations. Existing disconnect/rejoin policy remains unchanged; this phase does not add offline editing, a durable outbox, multi-instance operation or automatic alert scheduling.

Status: completed and deployed.
