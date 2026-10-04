# Mobile artwork comments layout — 2026-09-10

Production verified 2026-09-10 22:27 HKT.

- Reproduced the landscape failure with the actual ViewUI component: a 932×430 viewport compressed the detail column to 337px while its scroll content extended to 870px. The comment card escaped its background.
- Separate the bounded scroll container from an intrinsic-height two-column grid. Keep the detail column in normal block flow, wrap comment header actions and author metadata, and break long text within the available width.
- Validation: all 16 ViewUI tests, typecheck and lint passed. Fresh Hong Kong build and release bundle gate passed (447 whitelisted files).
- Playwright component acceptance with synthetic comments at 932×430 and 390×844; additional geometry assertions at 320×568, 844×390 and 1280×800 confirmed no horizontal overflow, comments contained by their background, and a visible close toolbar. Screenshots inspected. After correction the landscape detail column covered its full 882px content. No real iOS device or authenticated user exhibit was used; the pre-existing React 18 fetchPriority development warning remains unrelated.
- Production: 161 public asset hashes verified using the system trust store; HTTPS, readiness, page routes and www redirect passed. Only website TCP 80/443 published. Backend image, environment, user data, uploads and certificates preserved. No production test data or Git commit/push.
- Release: `.tmp/hk-mobile-comments-release-20260910`; archive SHA256 `fde3c7599031777aaef936ede9d6aa3bc5ced80a540938d4f37cc0f386c34efd`.
- Web image: `sha256:38ca6893da68fe50b5e94f8576cbf616d56977ad72035af09ee634a2cfcedf01`.
- Backup: `/home/admin/meta-exb-hk-production-20260904/source.pre-mobile-comments-20260910`.
- Recovery before a subsequent release: `sh /home/admin/mobile-comments-rollback-20260910.sh production`.
