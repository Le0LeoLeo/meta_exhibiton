# More official demonstration exhibitions

Deployed 2026-09-10 14:28 HKT. Added Impressions · In the Garden and Floating World · Land and Sea alongside the original classics exhibition. Each has three artworks; seven distinct artworks overall, including four newly verified Met Open Access images served locally. Sources recorded in docs/demo-artwork-sources.md.

Homepage now offers three official exhibition cards. Direct links use /demo?exhibition=garden and /demo?exhibition=landscape; /demo remains the original. Switching exhibitions resets artwork selection and canvas boundaries; unknown IDs fall back to classics. All new copy is supplied in Traditional Chinese, Simplified Chinese and English. Existing read-only 3D/2D viewer remains independent of user drafts and authentication.

Validation: 21 focused tests passed (homepage, exhibition switch/source/reset/fallback, empty listing and public routing). Typecheck and lint passed. Fresh Hong Kong build and whitelist bundle gates passed; 254 packaged files. Desktop browser confirmed covers and real 3D scene rendering; 2D artwork switching and cross-exhibition reset passed. Mobile 390px viewport reports document width 375px, with single-column cards and no horizontal overflow. Public browser confirmed both new exhibition titles and loaded image.

Isolated staging: verified readiness and all HTML/JS/CSS/JPG hashes with trusted staging CA. Stopped staging afterward, retaining volumes. Non-frontend release files match current deployment. Production update changed only dist/manifest and promoted the accepted web image; backend was not restarted.

- Release: .tmp/hk-more-demos-release-20260910.
- Archive SHA256: 1aa2399ed9a1f5682384b682c1f627180760944dfc8e30c821be8d657db62c50.
- Remote release: /home/admin/meta-exb-hk-more-demos-20260910.
- Web image: sha256:6dd20626461ca0dd3c7cd2c54e7f310b53bef2fb857b4f89384099c706a4cf1a.
- Unchanged app: sha256:badcd2f7df8427a6abf0a86254deae93182a31054acde15dba2e11f70cd30090.
- Previous dist/manifest: /home/admin/meta-exb-hk-production-20260904/source.pre-more-demos-20260910.
- Previous web tag: meta-exb-hk-production-web:pre-more-demos-20260910.
- Public HTTPS readiness and www redirect passed; app healthy, gateway running and serving verified content. Only TCP 80/443 published; app has no host port. Environment hash preserved; user data/uploads/certificates/volumes untouched.
- Logs/helpers: .tmp/more-demos-*. No Git commit or push.

Public verification timestamp: 2026-09-10T06:28:15.265Z; 139 route/asset checks passed.
