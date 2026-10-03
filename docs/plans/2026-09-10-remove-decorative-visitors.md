# Remove decorative gallery visitors

Deployed 2026-09-10 15:09 HKT. Removed GalleryVisitors from ViewCanvas and deleted its unused implementation/tests. The static charcoal/stone humanoids no longer appear in any native exhibition viewing mode. Actual Player, RemotePlayers and AgentSystem remain unchanged.

Validation: 12 existing tests passed for native viewer integration, multiplayer players and official participation. Typecheck, scoped lint, fresh HK build and actual bundle/whitelist gates passed. Isolated staging readiness/TLS/all frontend-image hashes passed; staging stopped with volumes retained. Public browser entered personal participation and visually checked the scene without the decorative visitor.

- Release: .tmp/hk-remove-visitors-release-20260910; 282 whitelisted files.
- Archive SHA256: b5bf7d171350fece0d737d4c62c32eef8b3cd585d1a478b74604a8794f61966e.
- Remote: /home/admin/meta-exb-hk-remove-visitors-20260910.
- Accepted web: sha256:0138d995044a2ba77240f8d999f88aea7401f9d9cf81ed34498c75c39980fee6.
- Unchanged app: sha256:badcd2f7df8427a6abf0a86254deae93182a31054acde15dba2e11f70cd30090.
- Prior dist/manifest: /home/admin/meta-exb-hk-production-20260904/source.pre-remove-visitors-20260910; prior web tag meta-exb-hk-production-web:pre-remove-visitors-20260910.
- Non-dist comparison passed; backend/environment/data/uploads/certificates/volumes preserved. Public readiness and www redirect pass; only TCP 80/443 published, app no ports. Logs/helpers .tmp/remove-visitors-*. No Git commit/push.

Public verification: 2026-09-10T07:09:11.979Z; 170 route/asset checks passed.
