# Builder artwork URL compatibility fix

The frontend builder passes saved same-origin artwork paths such as `/api/media/assets/...` in `assets[].imageUrl`; the server previously required an absolute URL and rejected generation with the raw Zod message `Invalid URL`. Previous spatial acceptance mocked the start endpoint or used data URLs omitted from the assets list, missing this integration boundary.

Accept site-root-relative artwork references as well as HTTP(S) URLs at the server validator. The frontend selects only reusable references, skipping invalid candidates in favour of a usable thumbnail. Reject protocol-relative URLs, backslashes, unsupported schemes and malformed strings. Preserve the actual scene and its media references.

Tests cover uploaded-media paths and bundled demo paths through the real route validator, invalid references, and frontend candidate selection. A browser-suite HTTP case sends the actual `buildBuilderInput` output through the unmocked route/service/session database and reloads the saved session. Keep the existing preview/apply and rendered-artwork browser cases.

Deploy only the route module and fresh frontend delta, preserving production data, environment and certificates, with isolated acceptance first. No Git actions.

## Validation and deployment

- 118 focused tests passed across 12 files; typecheck, lint and syntax checks passed (183 server JavaScript files).
- Three browser-suite cases passed: actual frontend payload through the unmocked HTTP API and saved session, desktop preview/apply with rendered artwork, and touch read-only viewing. The HTTP case uses the isolated server without a paid model; it verifies the previously missed request-validation boundary.
- Fresh Hong Kong build and all bundle budgets passed. Release packaging verified exactly one changed backend runtime file, `server/routes/exhibitionSceneRoutes.js`, plus fresh frontend assets.
- Isolated Hong Kong acceptance passed authentication/CSRF, upload ownership, revision conflicts, public media withdrawal, WebSocket origin/isolation/reconnect, restart persistence and independent restore. Synthetic load: 16 clients, 80 accepted operations, p95 acknowledgement 54 ms; this is not a production capacity claim. Only this run's synthetic accounts were removed; staging stopped afterward.
- Production updated with environment checksum unchanged, runtime data and certificates retained, prior source/data/images backed up. Containers healthy; readiness passed; only website ports 80/443 published. Production backend manifest and read-only SQLite integrity passed.
- Public trusted HTTPS, readiness, www redirect, all 345 exact public asset hashes and private/missing exhibition metadata exclusion passed.

Release: `/home/admin/meta-exb-hk-builder-url-20260914`; archive SHA256 `4625406627d294e064badaef8d4030c38f18bcb1c4764d234439cda8cbf09027`.

Production app image: `sha256:0f2cf8292279e65a14fd53fd7b8b80e5228271f8936029bdd29fb7bda54f9751`; web image: `sha256:4d76776dd347108d6c554c7f9c851bfc040d4852c5f0f8a0b185a01e025c5617`.

Backups under `/home/admin/meta-exb-hk-production-20260904/`: `source.pre-builder-url-20260914` and `backup-builder-url-20260914/runtime.tar.gz`; prior image tags `meta-exb-hk-production-app:pre-builder-url-20260914` and `meta-exb-hk-production-web:pre-builder-url-20260914`. Independent synthetic restore volume: `meta-exb-hk-builder-url-restore-20260914`.

Local evidence: `.tmp/builder-url-{focused,browser,hk-build,hk-stage,hk-accept,hk-production,public,integrity}-20260914.log`.
