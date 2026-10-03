# Exhibition template visual polish — 2026-09-10

Production verified 2026-09-10 21:37 HKT at https://metaexb.com/virtual-gallery.

## Changes
- Six templates use redesigned layouts, neutral matte stone or oak floors, balanced brightness and neutral ceiling finish. Each has at least six paintings; art keeps 26 × 22 m for public-demo compatibility and cars keep 32 m width.
- Replace ornate generic podiums with grounded, proportionate plinths for the four bundled models. Cars use 5.4 × 2.6 m low platforms and 4.6 m models; walking collision follows the new display footprint. Legacy model offsets and custom uploads retain their existing podium renderer.
- Six original art compositions and six distinct automotive studies; refined grounded GLBs. Car GLB reduced to 646,076 bytes.
- Renderer now respects explicit frame thickness and borderless settings. Missing thickness retains legacy dimensions; invalid overrides fall back safely.
- Flat 16:9 carousel cards replace tilted portrait crops, with captions beneath the image. Six covers captured from actual rendered scenes. Mobile 3D preview also uses 16:9, with no horizontal dialog overflow.

## Validation
- 82 unique focused tests passed across scene contracts, template selection/creation, public demos, previews, frame fitting/appearance, exhibit renderer, ceiling and player collision. Final mobile styling checks reran 16 relevant tests successfully.
- Typecheck and full ESLint passed; fresh Hong Kong build and actual-output bundle gate passed. JS 3609.0 KiB, CSS 326.2 KiB, GLB total 6527.2 KiB.
- Individually inspected all six real 3D rooms and final covers. Desktop and 390 px mobile carousel inspected; next/preview/3D controls worked. Mobile dialog client/scroll width both 341 px; no browser errors.
- 443 release-whitelist files staged. All non-dist runtime hashes match previous production. 157 public HTML/JS/CSS/template/texture hashes and media content types verified over trusted HTTPS; readiness, SPA routes and www redirect passed.

## Release and recovery
- Release: `.tmp/hk-template-polish-release-20260910-r2`.
- Archive SHA256: `46413a99d8dfdb913bc748edda230c68a05af4791d346cde4d8fb51549f2a571`.
- Web: `sha256:5d0825c4a7c123557a912f437cb60848c44dba8fd56053dc6646eb1828f03e70`.
- App unchanged and healthy: `sha256:542698bfbded216582915d4f789f025b328abb5b6b754e5d4e577552eb7ead7f`.
- Previous source: `/home/admin/meta-exb-hk-production-20260904/source.pre-template-polish-20260910`.
- Previous web retained as `meta-exb-hk-production-web:pre-template-polish-20260910`.
- Recovery on HK: `sh /home/admin/meta-exb-hk-template-polish-20260910/rollback.sh production`, applicable before a later deployment.
- Only web updated. Environment hashes/permissions, backend, runtime data, uploads, volumes and certificates preserved; only TCP 80/443 published. No Git commit/push or production test data.
