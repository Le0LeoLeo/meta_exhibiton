# Comment draft recovery

Use sessionStorage for bounded per-account/gallery/artwork comment drafts. No token is persisted. Flush on input to survive immediate reload, reject malformed/expired records, preserve newer text while requests finish, and remove a matching draft after confirmed submission. Display successful tab storage separately from an unavailable-storage warning. Session drafts are not automatically submitted and expire after 24 hours on restore.

Scope is browser-side draft storage only; backend and request protocols are unchanged.

## Verified 2026-09-11 17:50 HKT

- 38 viewer/draft/catalog tests passed: remount restoration, clearing matching confirmed submissions, retaining newer text, user/gallery/artwork isolation, invalid/expired records and blocked/quota storage. Typecheck and lint passed.
- Isolated synthetic browser fixture verified actual reload restores nickname and comment, with the tab-storage explanation visible. At 390×844, no horizontal overflow; screenshot inspected. No production comments submitted.
- Uses per-tab sessionStorage, not cross-device storage. Drafts expire on restore after 24 hours; closing the tab may discard them. Stored drafts are account-scoped, not purged on logout; authentication/share tokens are never stored. Existing ignored obsolete submissions can leave a draft for manual review, as documented in the preceding release.
- Fresh HK build/whitelist: 447 files; largest JS 707.7 KiB, total JS 3625.3 KiB, CSS 329.9 KiB. Non-dist files matched prior production.
- Web-only deployment completed, preserving backend image, environment checksum/mode, runtime data and certificate volumes. Web healthy, backend ready, only TCP 80/443 publicly mapped.
- Verified 161 public HTML/JS/CSS/template hashes over trusted HTTPS with system CA, readiness, SPA routes and www redirect.
- Archive SHA256: `c8fe9a863b0c7caaac225a9aebad97bc6fdf9601ac55c69956053ba08e62d597`.
- Web image: `sha256:ce173eb53e2f72ca25480b15c6b0d485a51c39d93305aa05ddb65a7ab642e586`.
- Backup: `/home/admin/meta-exb-hk-production-20260904/source.pre-comment-draft-ux-20260911`.
- Rollback before a subsequent release: `sh /home/admin/comment-draft-rollback.sh production`.
- Evidence/helpers: `.tmp/comment-draft-ux-20260911/`. Full regression suite and physical mobile device acceptance were not run.
