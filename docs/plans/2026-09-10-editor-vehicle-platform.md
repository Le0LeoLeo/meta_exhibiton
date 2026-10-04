# Standalone vehicle platform in editor — 2026-09-10

Production verified 2026-09-10 22:20 HKT.

## Behavior
The editor Add toolbar now offers 長方形展台 / Low platform alongside the ordinary pedestal. It places an empty, grounded 5.4 × 2.6 m platform, height 0.14 m, matching the automotive template. Existing move/rotate/scale controls apply. The specialized inspector hides model replacement/offset controls for this standalone furnishing.

Pending placement carries whitelisted item defaults through the floor click and store factory. Ghost dimensions and wall-edge padding match the platform footprint. Store creation preserves content, scale, offset and title; undo/redo and JSON import/export retain the furnishing. Existing round pedestals and uploaded models retain their prior behavior. The bundled GLB is 30,044 bytes, grounded at y=0, with verified bounds.

## Validation
- 26 real-store/UI tests passed, including actual create/undo/redo/export/import and ordinary pedestal regression. Another 12 helper/collision/renderer tests passed, including server-schema serialization and scaled collision.
- Typecheck and full lint passed; fresh HK r2 build and bundle gate passed (JS 3615.9 KiB; CSS 326.4 KiB; GLB 6556.6 KiB).
- Browser ran the actual editor components in an isolated local harness: clicked toolbar, placed on floor, visually inspected empty platform, undid and redid. Final fresh-page run had no browser errors. Initial HMR-only harness errors were cleared by a fresh page; the harness is excluded from production.
- 447 release-whitelist files. Runtime hashes unchanged. 161 public HTML/JS/CSS/template/texture hashes/MIME checks, trusted HTTPS, readiness, routes and www redirect passed.

## Release and recovery
- Release `.tmp/hk-editor-platform-release-20260910-r2`; archive SHA256 `df7355512473cfd5161831c1634a1766f71b31642bfbe5c27411ce5a9a3fff82`.
- Web `sha256:9b4b19f443ae0c4d5968decc7fc45743e4dea198632d7d551eb415a0265e07ec`.
- App unchanged/healthy `sha256:542698bfbded216582915d4f789f025b328abb5b6b754e5d4e577552eb7ead7f`.
- Backup `/home/admin/meta-exb-hk-production-20260904/source.pre-editor-platform-20260910`; previous web tagged `meta-exb-hk-production-web:pre-editor-platform-20260910`.
- Recovery before a later release: `sh /home/admin/editor-platform-rollback-20260910.sh production`.
- Only web updated; existing shortcut removal retained. Environment, data, uploads, volumes, certificates and backend preserved; only TCP 80/443 published. No Git commit/push or production test data.
