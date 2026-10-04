# Artwork detail image loading — 2026-09-10

Production verified 2026-09-10 22:18 HKT.

- The detail dialog initially rendered an unrelated Unsplash flower image, waited for a separate anonymous-CORS image probe, and only then assigned the real image to a lazy-loaded element. Probe failures retained the unrelated artwork, and late callbacks could replace a newer selection.
- Render the selected image immediately with eager/high-priority loading and async decoding. Remove the probe and external fallback. Show translated loading/error text and isolate image state by item ID and source. Explicit image MIME types support local blob previews.
- Validation: all 16 ViewUI tests passed, including immediate source selection, stale events, errors/reopening and blob URLs. Typecheck, lint, fresh Hong Kong build and actual release bundle budgets passed.
- In-app browser acceptance used the actual ViewUI in a local fixture: missing image produced the translated failure state; a valid local image rendered successfully (natural width 1000), with screenshot inspection. This was component acceptance, not an authenticated visit to the user's specific exhibit. No network speed percentage is claimed.
- Production: 161 public resource hashes verified, trusted HTTPS, readiness, page routes and www redirect passed. Backend runtime/image unchanged. Only website TCP 80/443 published; environment, data, uploads and certificates preserved.
- Release: `.tmp/hk-artwork-detail-release-20260910`; archive SHA256 `739734b04869b9315ceae25086fa4bc9ebad958f0e856def911ead7dad9f2d94`.
- Web image: `sha256:d212f1d436199385f8eda5c494a6b18fe8b7f7115377a25b54966b2f5b71ec46`.
- Backup: `/home/admin/meta-exb-hk-production-20260904/source.pre-artwork-detail-20260910`.
- Recovery before subsequent deployments: `sh /home/admin/artwork-detail-rollback-20260910.sh production`.
- No Git commit/push or production test data.
