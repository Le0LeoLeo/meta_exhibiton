# Curved homepage exhibition wall

Implemented and deployed 2026-09-10. Inspired by the publicly visible Custom Spaces reference; original CSS implementation, no paid prompt used.

- Homepage published exhibitions use a centered, scrollable hanging line with gentle image rotation/rise, level captions and contain-fit artwork. Hover/keyboard focus straightens the frame. One exhibition stays level; mobile uses flat, horizontally snapping cards. Reduced-motion disables transforms/transitions.
- Changed Home.tsx, added styles/exhibition-wall.css and its import. Other functionality preserved.
- Validation: Home tests 7 passed, typecheck/lint passed, fresh HK build and packaging budgets passed. Desktop visual review and 390px mobile checked: document width 375 within 390 viewport; wall scrolls locally. Viewport restored.
- Fresh whitelist .tmp/hk-wall-release-20260910; archive SHA256 e624233121cd8915bf799c3403565446fb10cb4127ec9b44418602a2ddd20b08.
- Non-dist manifest comparison against both staging/production passed; preserves the newer project-analysis fixes. Backend unchanged at sha256:badcd2f7df8427a6abf0a86254deae93182a31054acde15dba2e11f70cd30090.
- Staging TLS/readiness and exact homepage/main asset hashes passed. Staging stopped, volumes retained. Promoted accepted web sha256:7a623f5b9e42c51e22bd9d71bff97c069e08d12b95d7b2043e809a9d564c9d68.
- Public nine-route HTML and relevant asset hashes verified over trusted HTTPS, readiness and www redirect passed. Live browser confirms wall and two real exhibition cards. App healthy, only website TCP 80/443 public.
- Rollback: previous dist/manifest retained at /home/admin/meta-exb-hk-production-20260904/source.pre-wall-20260910; previous web tag meta-exb-hk-production-web:pre-wall-20260910. Environment hash unchanged; data, secrets, certificates and volumes preserved. No Git commit/push.
- Logs: .tmp/wall-staging.log, .tmp/wall-production.log, .tmp/wall-public.log.
