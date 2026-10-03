# Box 3D preview correction

Deployed to Hong Kong production on 2026-09-10, verified at 11:47 HKT.

## Cause and changes
- The reported box has a 12 × 10 floor plan but legacy roomSize dimensions of 20 × 20. The additive layout rejected this mismatch, so both images stayed pending and both the viewer and arrangement preview showed an empty room.
- Placement now derives dimensions from the single centered, unrotated room actually rendered. Saved room settings, floor plan and existing items remain unchanged. Unsupported architecture still stays pending. The absent door width now matches the renderer's 1.8 default.
- Selecting 3D viewing with pending content and an empty scene opens the arrangement preview. Persistence still requires Confirm display. An empty scene shows guidance instead of a misleading empty canvas. Added viewing-control guidance and all three locale strings.

## Verification
- Full npm run check passed: 271 suites/2093 tests passed; one Redis suite/test skipped because its external service is unconfigured. Typecheck, lint, server syntax, avatar assets, build and bundle gates passed. Log: .tmp/box-preview-check.log.
- New regressions cover mismatched dimensions with unchanged scene metadata, preview without persistence, cancel, explicit confirmation, and empty-state guidance.
- Local browser, isolated synthetic runtime on 5383/5386: same 12 × 10/20 × 20 case renders both pictures; next artwork, cancel, confirm, reload and viewing the saved result verified.
- Isolated Hong Kong acceptance reproduced the exact geometry, checked two-image preview and explicit persistence, then existing five-plus-three placement preservation, replay, revision conflicts, pending-media privacy, restart, share revocation and original retention. Only the run's synthetic accounts/files were cleaned; staging containers stopped, volumes retained.
- Production user's existing box visually verified: both original Pathfinder images now appear in the preview, with two placeable and zero pending in the candidate. No production content was confirmed, published or changed by this run. The browser is left on the preview for the owner.
- Public homepage and entry JS/CSS, BoxDetailPage and BoxScene assets match the release SHA256. HTTPS /boxes 200, TLS validation 0, /api/ready ready, www /boxes redirects 301. App healthy; website ports only 80/443.

## Release and rollback
- Preserved the already-deployed museum and folder-sharing release. Manifest comparison verified that the only non-dist runtime change is server/services/boxLayout.js; no dependencies, schemas, security settings or migrations changed.
- Whitelist release: .tmp/hk-box-preview-release-20260910, 248 files. Archive SHA256: 0e16351bd2384e38e4e44920fefa76ed5db3726e2cfdcb515e1ec721f46ee1a3.
- Remote release: /home/admin/meta-exb-hk-box-preview-20260910.
- Built the app from the verified existing production dependency image, copying only the corrected service; no npm dependency rebuild on the constrained host. Promoted the exact app/web images accepted in staging.
- App image: sha256:91693cca57e81a3034f5711de3448fdc8c10c67f60fd6ea56c70a57c0e07411f.
- Web image: sha256:c580a399b5c248db2fde00449883e25cd5f026dbb3418b3bfcae8741bcb0e064.
- Previous dist, service and manifest: /home/admin/meta-exb-hk-production-20260904/source.pre-box-preview-20260910.
- Previous images retained as meta-exb-hk-production-app:pre-box-preview-20260910 and meta-exb-hk-production-web:pre-box-preview-20260910.
- Production env hash unchanged; runtime data, uploads, certificates, volumes and prior backups preserved. No Git commit/push or cloud/network changes.
- Logs: .tmp/box-preview-staging-deploy.log, .tmp/box-preview-staging-acceptance.log, .tmp/box-preview-production-deploy.log.
