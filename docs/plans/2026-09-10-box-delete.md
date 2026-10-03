# Delete from My Boxes

Deployed to Hong Kong production on 2026-09-10 at 12:52 HKT.

- Added a separate Delete action to each box card, outside the opening link. Confirmation identifies the box, explains permanent layout deletion, invalidated sharing and retained saved images. Cancel receives initial focus. Submission prevents duplicate requests and dismissal while pending; failures retain the card and offer retry.
- Reuses the existing owner-authorized gallery deletion API. No backend, schema or dependency changes. Traditional Chinese, Simplified Chinese and English copy included.
- Full check passed: 276 suites / 2114 tests; one external Redis suite/test skipped. Typecheck, lint, server syntax, avatar checks, build and bundle gates passed. Component tests cover cancel, explicit confirmation, duplicate submission prevention, failure/retry and successful empty state.
- Hong Kong isolated API acceptance created a synthetic box and uploaded image, rejected unauthenticated deletion, deleted the box through the existing endpoint, verified list/detail removal and repeat-delete 404, and verified the original image remained available in the saved library and media endpoint. Only this run's account and image were cleaned.
- Production browser acceptance opened and cancelled confirmation on the existing box without deleting it. Visual inspection found low dark-theme contrast; final r2 uses white confirmation text and brighter delete action text. Component tests reran (3 passed), a fresh release was built, and exact final HTML/JS/CSS hashes were accepted in staging before promotion. Browser screenshot and computed color verified white text after promotion, then confirmation was cancelled.
- Public HTTPS verified MyBoxes, entry HTML/JS/CSS release hashes, `/boxes`, readiness and www redirect. Website ports remain TCP 80/443; production app healthy and not restarted. Staging stopped, volumes retained.

## Final release
- Local: `.tmp/hk-box-delete-r2-release-20260910` (249 whitelisted files).
- Archive SHA256: `edf1b5ed578a353129624417875cb78ec771b363f34f4b1c7078ac64ab9a2343`.
- Remote: `/home/admin/meta-exb-hk-box-delete-r2-20260910`.
- Web image: `sha256:57b0e89811e7883374b10828f8010c26c003691849c65a4f9e32943fba59adf2`.
- Backend unchanged: `sha256:91693cca57e81a3034f5711de3448fdc8c10c67f60fd6ea56c70a57c0e07411f`.
- Before this feature: `/home/admin/meta-exb-hk-production-20260904/source.pre-box-delete-20260910` and `meta-exb-hk-production-web:pre-box-delete-20260910`.
- Before contrast refinement: `source.pre-box-delete-r2-20260910` and `meta-exb-hk-production-web:pre-box-delete-r2-20260910`.
- Production environment hash unchanged; existing data, uploads, volumes, certificates and backups preserved. No Git commit/push.
- Logs: `.tmp/box-delete-check.log`, `.tmp/box-delete-staging.log`, `.tmp/box-delete-r2-staging.log`, `.tmp/box-delete-r2-production.log`, `.tmp/box-delete-r2-public.log`.
