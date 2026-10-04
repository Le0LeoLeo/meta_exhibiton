# Homepage refresh slogans — 2026-09-10

Production verified 2026-09-10 21:21 HKT at https://metaexb.com.

## Behavior
Six thematic headline pairs, translated in Traditional Chinese, Simplified Chinese and English. Each document chooses randomly while excluding the previous same-tab session choice. Selection stays stable through React remounts and language changes; no automatic cycling during reading. If session storage is disabled, rendering remains available but cross-refresh exclusion cannot be persisted.

## Validation
- 22 focused homepage, slogan and catalog tests passed; typecheck and scoped ESLint passed.
- Fresh Hong Kong build and actual-output bundle gate passed; 440 whitelist files staged.
- Normalized release comparison: only Home and index JavaScript changed; all other assets and backend/runtime files match the previous release.
- Browser: local reload changed headline; locale switching retained its meaning. Mobile Chinese/English layout had no horizontal overflow and English screenshot was visually checked.
- Public HTTPS verification: 220 HTML/JS/CSS/font/license SHA256 checks passed, readiness, SPA routes, www redirect, bounded public summaries passed.
- Production browser refreshed successfully to a different slogan; desktop width checked.

## Release and recovery
- Archive: `.tmp/hk-slogans-20260910.tar.gz`, SHA256 `a86a5eac16cb3aa70c451c932ad59f4c16ee09b9059af3abfc075e673fc97775`.
- Web image: `sha256:f249660959a25a7134bc7c508323f80896733497637e77f610f6daea62f23824`.
- App unchanged and healthy: `sha256:542698bfbded216582915d4f789f025b328abb5b6b754e5d4e577552eb7ead7f`.
- Source backup: `/home/admin/meta-exb-hk-production-20260904/source.pre-slogans-20260910`.
- Previous web image retained as `meta-exb-hk-production-web:pre-slogans-20260910`.
- Recovery command on HK: `sh /home/admin/slogans-rollback-20260910.sh production` (only applicable before a subsequent release).
- Environment hashes/permissions, backend image, volumes, uploads, certificates and data preserved; only TCP 80/443 published. No Git commit/push or production test data.
