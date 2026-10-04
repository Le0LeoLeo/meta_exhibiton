# Homepage product clarity implementation plan

**Goal:** Keep the art-led homepage while explaining the product, distinguishing preview from walkthrough, and making the homepage readable in the initial HTML.

**Architecture:** Reuse the existing React Home component for build-time rendering, with a separate homepage document served only for the root URL. Keep other SPA routes independent. Reuse real template covers and translate all new product copy in the existing three locales. Preserve all unrelated working changes; do not commit or push.

**Tech stack:** React, Vite, React Router, existing CSS, Caddy.

1. Add localized fixed positioning, product capabilities and real template use cases in `src/app/pages/Home.tsx` and `src/app/i18n/catalogs/homeProduct.ts`. Preserve existing demo/create routes and random slogans.
2. Label the second demo entry “開始漫遊” and explain its guide choice; preserve selected exhibition/artwork URLs and WebGL fallback.
3. Add build-time homepage rendering using the real component and metadata. Serve it at `/`, redirect `/index.html` to `/`, and preserve the generic SPA fallback for deep links. Add a root-only sitemap and robots file. Test readable initial content and deep-link isolation.
4. Inspect the initial bundle dependencies, separating unnecessary scene data from homepage imports where supported by evidence. Validate the actual HK bundle budget.
5. Run focused homepage/demo/catalog/build tests, typecheck and lint. Check desktop/mobile and both themes in the browser; perform isolated Caddy routing acceptance before production because route configuration changes.
6. Package with the HK whitelist, verify source differences and hashes, preserve environment/backend/data/certificates, deploy the web image only and verify HTTPS, readiness, redirects and public assets. Record rollback and deployment evidence below.

## Completed 2026-09-11, 21:49 HKT

- Preserved the random art slogans and existing primary CTAs. Added fixed platform positioning, explicit META EXB/MREI relationship, three capabilities and three use cases using actual platform template covers. All new copy supports Traditional Chinese, Simplified Chinese and English.
- Renamed the preview-to-participation action to “開始漫遊” and clarified the self-guided/AI choice. Existing artwork/exhibition URLs and unsupported-WebGL fallback remain intact.
- Vite now renders the real Home React component into `home.html` at build time. Caddy serves that at `/`; the separate empty `index.html` shell serves deep links without a homepage canonical or homepage body. Added localized runtime metadata, Open Graph, robots and a homepage-only sitemap. Root metadata uses the default Traditional Chinese locale; no language-specific indexing or search ranking is claimed.
- Extracted the demo catalog from scene construction and placed shared Zustand and Vite preload helpers in independent chunks. The homepage no longer preloads Three.js, Three stdlib or R3F chunks. A trial of explicit-only manual chunks failed browser initialization and was removed; the final configuration passed actual homepage, preview and native 3D walkthrough rendering.
- 99 focused tests passed across 12 files, including homepage/demo/participation, metadata cleanup after navigation, three-locale catalog coverage, prerender output, routes, release whitelist and chunk grouping. Typecheck, lint and the actual Hong Kong bundle budgets passed. Full test suite, physical-phone performance, AI network replies and two-user multiplayer were not re-tested for this presentation change.
- Browser acceptance covered desktop and 390×844 viewport, light/dark themes, three locales, homepage-to-preview entry, canonical removal on `/demo`, the viewing-mode selector and a rendered native 3D walkthrough. Mobile content had no horizontal overflow. These are browser viewport checks, not physical-device benchmarks.
- Isolated `meta-exb-hk-staging` used a fresh staging-only environment, the unchanged backend image and new web image, with an internal Docker network and no published ports. Trusted staging-CA requests on internal HTTPS port 8443 verified root HTML, deep-route isolation, sitemap, robots, index redirect and API proxy. Staging was stopped afterward; its empty runtime/certificate volumes are retained. Initial staging harness issues (environment-file owner and default HTTPS port) were corrected without changing production.
- Production web-only deployment completed and 220 public file hashes verified at 21:48 HKT. Root content, generic deep-route shell hashes, readiness, trusted system-CA HTTPS, index redirect and www redirect passed. Only website ports 80/443 are published. Backend image and production environment checksum remained unchanged. No production user data was created or changed.

Release archive SHA256: `afff136ab6a5ddb20944326d54ca0f0c0aa207e30cfbf0c655adb57ef61e8fa9`.

Web image: `sha256:a9be6d601e3b561ed34af0efc6638fb45e728efabfde91d8b3780a8f2675bb21`.

Backend image (unchanged): `sha256:542698bfbded216582915d4f789f025b328abb5b6b754e5d4e577552eb7ead7f`.

Release: `/home/admin/meta-exb-hk-home-product-20260911`. Previous source: `/home/admin/meta-exb-hk-production-20260904/source.pre-home-product-20260911`.

Rollback if needed: `sh /home/admin/home-product-rollback.sh production` (restores the prior web image/source; preserves environment, data and failed release files).

Local evidence: `.tmp/home-product-20260911/` (manifest, build, staging, production and public verification logs); `.tmp/home-product-tests.log`, `.tmp/home-product-typecheck.log`, `.tmp/home-product-lint.log`.
