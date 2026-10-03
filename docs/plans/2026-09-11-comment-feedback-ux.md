# Comment feedback UX

Scope: frontend comment presentation and response isolation; unchanged endpoints, payloads, authorization and backend. Keep loading, error and empty states distinct; allow retry. Preserve per-artwork in-page drafts and edits typed while awaiting a submission. Ignore obsolete submission/deletion/summary results after changing artwork/account or unmounting. Guard rapid duplicate submits. Retain typed content and show persistent feedback when submission cannot be confirmed.

## Verified 2026-09-11 17:44 HKT

- 33 viewer/catalog tests passed, including failed read and retry, duplicate shortcut submission, stale submission/AI summary responses, per-artwork drafts, and retaining newer text while a request finishes. Typecheck and lint passed.
- Isolated browser fixture uses synthetic responses only. Verified failed-read retry preserves text, switching away/back restores the artwork draft, failed submission leaves persistent feedback, and 390×844 layout has no horizontal overflow. Screenshot inspected; no production comments created.
- Drafts are held only in the mounted page, not durable storage. Leaving/reloading the page may discard them. An obsolete submission's result is ignored in the new artwork context; retained drafts should be reviewed against the server list before resubmission.
- Fresh HK release: 447 whitelisted files; largest JS 707.7 KiB, total JS 3623.6 KiB, CSS 329.9 KiB. Non-dist files matched the prior production manifest.
- Web-only deployment completed; backend image, environment checksum and permissions, data, uploads and certificate volumes preserved. Web healthy, backend ready, only TCP 80/443 publicly mapped.
- Verified 161 public HTML/JS/CSS/template hashes over trusted HTTPS with system CA, readiness, SPA routes and www redirect.
- Archive SHA256: `6502bf9cca7dab2a0d7e53dbdebeb4c8e9aa906e58602ae8d5bd95d38ae3b08e`.
- Web image: `sha256:dff6bb07e8622d1af0498099d9a318e34828e1f28d3670978b7573a425304a0e`.
- Backup: `/home/admin/meta-exb-hk-production-20260904/source.pre-comment-feedback-ux-20260911`.
- Rollback before a subsequent release: `sh /home/admin/comment-feedback-rollback.sh production`.
- Evidence/helpers: `.tmp/comment-feedback-ux-20260911/`. Full regression suite, real-device acceptance and production comment submission were not run.
