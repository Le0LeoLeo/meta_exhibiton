# Museum homepage — implementation and release record

## Scope
User selected A (museum) from the local comparison demo and authorized implementation. Apply the warm paper, serif title, asymmetric image-led composition to the actual homepage. Preserve the existing feature routes, authentication, locale and theme controls. Do not commit or push Git.

## Implementation
- Home uses the existing public-gallery API with loading, empty, error/retry, and failed-cover states. Actual published gallery titles, covers and routes replace conceptual demo content.
- When no public galleries are available, link to the real official demo and show its Met Open Access artwork; do not present generated gallery images as actual exhibitions.
- Preserve quick image creation/tutorial, personal boxes, graduation and recent souvenirs.
- Homepage-only navigation/footer and scoped light/dark/responsive styles. Three-language copy lives in the shared catalogs.
- Existing local comparison demo remains independent.

## Validation and deployment
- Full `npm run check` passed: 266 suites passed, one Redis integration suite skipped; 2079 tests passed, one skipped. Typecheck, lint, server/avatar validation, build and bundle budgets passed. Log: `.tmp/museum-home-check.log`.
- Public-cover helper uses only the chosen cover or the first image artwork from the already-public scene JSON, via the existing 2D scene parser. No extra API or backend change. Missing/broken covers remain labeled placeholders; the stable first featured entry is the official demo.
- Browser verified 390px mobile layout (no horizontal overflow), mobile navigation, desktop light/dark styles, all three locales, featured carousel, tutorial open/close and creation login preserving `/virtual-gallery/quick-create`. Official demo navigation confirmed. Local API proxy uses system CA trust with TLS verification enabled.
- Hong Kong build passed using the existing public Google client ID: `.tmp/hk-museum-home-build-20260910/dist`; whitelist release `.tmp/hk-museum-home-release-20260910` (245 files). No runtime data, env files or comparison demo included.
- The concurrent exhibition-folders task promoted the shared release. All 148 frontend files in `.tmp/hk-folders-build-20260910/dist` matched this independently validated homepage build byte-for-byte. No competing deployment was performed by this task.

## Verified live — 2026-09-10 11:10 HKT
- Public homepage, Home JS/CSS, entry JS/CSS and all HTML-linked vendor chunks downloaded through trusted HTTPS and SHA256-matched this build.
- Index SHA256: `fc98df13a71ad2a7aade3b8f62b62269fd0c5ebec7674ddd13e16b14ea42e6a4`.
- Home JS: `Home-DISvq5D_.js`, SHA256 `19d470df9ecb392e36483bcca67c7a76f4f5422e4ec983ae0b10556ec544c973`.
- Home CSS: `Home-BEEpg4TV.css`, SHA256 `b62f5d910aa4abb5a436930efde4ada6715023680148ab9123c3af564004f97d`.
- Public `/` returns 200 with TLS verification result 0; `/api/ready` returns `{ok:true,status:"ready"}`; `www` redirects 301 to apex. App healthy, web running; website ports remain 80/443, API/multiplayer are not exposed.
- Web image at verification: `sha256:5c30f7e123ad2aae9d45d1dd33f01bbc1db5f80c4a5a73664d844d302b902ab4`.
- Public browser confirmed the new homepage, actual exhibition covers, official-demo first slide, creation links and shared navigation; no production-origin console errors observed. The local verification server on 5189 was stopped after handoff to the public URL; the separate A/B comparison demo was left intact.
- This task did not change runtime data, credentials, volumes, DNS, Git state or backend code. Shared-release staging/backup/rollback evidence belongs to `2026-09-10-exhibition-folders.md`; that task is separately correcting a folder-menu interaction after its first promotion.
