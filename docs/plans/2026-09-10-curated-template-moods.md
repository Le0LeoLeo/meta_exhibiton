# Curated default template atmospheres — 2026-09-10

Production verified 2026-09-10 21:58 HKT.

## Behavior
- Art and automotive templates default to bright modern; technology and photography default to dark spotlight; history and fashion default to warm classical.
- Four covers were recaptured from actual 3D scenes. Catalogue, preview and newly created scene now agree on the default mood.
- Valid explicit choices, including bright over a dark default, still override defaults. Closing/reopening the same preview preserves the selected mood; changing template resets to that template's default. Dashboard selection and public login return use the same defaults.
- Existing saved exhibitions are not rewritten.

## Validation
- 41 scene/public-demo tests and 27 public/dashboard/preview tests passed; covers individually inspected.
- Typecheck, full lint, fresh HK build and bundle gate passed: JS 3613.6 KiB, CSS 326.3 KiB; 446 whitelisted files.
- Browser verified default technology spotlight and manual bright override; production Traditional Chinese preview shows spotlight selected and renders without errors.
- 160 public release hashes/MIME types, trusted HTTPS, readiness, routes and www redirect passed. Runtime hashes unchanged.

## Release and recovery
- Release: `.tmp/hk-curated-template-moods-release-20260910`.
- Archive SHA256: `68540ebcb306f58b89292122c24eb378d24d2f453af0be6d4ecaafe1bf22e0f7`.
- Web: `sha256:c5f76cf5bd3e1cbb6878e3f9d96250f0d26e53c378eb6fba12de82f887965990`.
- App unchanged/healthy: `sha256:542698bfbded216582915d4f789f025b328abb5b6b754e5d4e577552eb7ead7f`.
- Backup: `/home/admin/meta-exb-hk-production-20260904/source.pre-curated-template-moods-20260910`; previous web tagged `meta-exb-hk-production-web:pre-curated-template-moods-20260910`.
- Recovery before any subsequent deployment: `sh /home/admin/curated-template-moods-rollback-20260910.sh production`.
- Only web updated; environment, data, uploads, runtime volumes, certificates and backend preserved; only TCP 80/443 published. No Git commit/push or production test data.
