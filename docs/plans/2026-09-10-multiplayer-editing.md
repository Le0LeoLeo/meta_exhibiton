# Multiplayer editing reliability

Deployed to Hong Kong production on 2026-09-10; public verification completed at 12:41 HKT.

## Changes
- Receiving an operation previously imported the last transmitted scene, losing local changes made within the 120ms send interval. Incoming snapshots could also discard unsent changes.
- Rebase unsent changes onto incoming operations and snapshots, while retaining a separate transmitted baseline so those local changes are actually sent next. Item fields and room fields merge independently; additions from both editors survive and deletions do not resurrect items. The same helper handles floor-plan element IDs and wall override keys.
- Refresh selected-item focus every three seconds, before the existing nine-second expiry. Clear focus when selection changes or edit mode ends and stop the timer on cleanup.
- No protocol, backend, permissions, dependency or persistence changes. Existing server ordering still resolves simultaneous writes; this is not object locking or durable offline editing. Wall overrides merge per target key rather than per nested material field.

## Verification
- Both original defects reproduced as failing component tests before the fix.
- Full `npm run check` passed: 275 suites / 2111 tests passed; one external Redis suite/test skipped. Server syntax, avatar assets, typecheck, lint, build and bundle limits passed. The four helper tests were rerun after correcting their room-length fixture and passed.
- Regression cases: unsent edits survive remote operations and full snapshots and are subsequently emitted; independent fields, conflicting fields, additions, deletions, input immutability, focus heartbeat and mode exit.
- Fresh Hong Kong build and whitelist release: 249 files. Non-frontend files matched both staging and production before activation.
- Isolated Hong Kong acceptance used two authenticated WebSocket clients and the bundled merge helper: independent item edits converged in authoritative snapshots, focus refresh/release worked, remote deletion was not resurrected. React bridge behavior was tested locally; no claim of a manual two-browser UI session. Initial acceptance fixture errors (required gallery fields and full scene initialization) were corrected before successful acceptance. Every run cleaned its own synthetic account; staging was stopped with volumes retained.
- Public HTTPS verified entry HTML, JS/CSS, editor and studio asset hashes against the release; homepage, exhibitions route, readiness and www redirect passed. Windows Node verification used the system CA store without disabling TLS validation. Production app remains healthy; only website TCP 80/443 are published.

## Release and rollback
- Local release: `.tmp/hk-multiplayer-release-20260910`.
- Archive SHA256: `2a0b871095947eea89b59a4792227c5401d83f2a12df663f99269dfbf16ae0c0`.
- Remote release: `/home/admin/meta-exb-hk-multiplayer-20260910`.
- Promoted exact staging web image: `sha256:92c9f249197e96c6605d30b880163ec1dd90706fe83b80f2096a71fe71dd4871`.
- Backend unchanged and not restarted: `sha256:91693cca57e81a3034f5711de3448fdc8c10c67f60fd6ea56c70a57c0e07411f`.
- Previous frontend and manifest: `/home/admin/meta-exb-hk-production-20260904/source.pre-multiplayer-20260910`.
- Previous web image retained as `meta-exb-hk-production-web:pre-multiplayer-20260910`.
- Production environment hash unchanged; runtime data, uploads, certificates and backups preserved. No Git commit or push.
- Logs: `.tmp/multiplayer-improvements-check.log`, `.tmp/multiplayer-staging-acceptance.log`, `.tmp/multiplayer-production-deploy.log`, `.tmp/multiplayer-public-verify.log`.
