# Audit hardening implementation plan

**Goal:** Close the confirmed audit gaps in React checks, editor localization, automated WebGL acceptance and operational validation.

**Architecture:** Preserve existing stores, APIs and the single-instance production architecture. Use existing isolated browser/staging runtimes; extract cohesive editor behavior without changing its contracts. Do not commit or reset the existing dirty workspace.

**Tech Stack:** React 18, TypeScript, ESLint, Three.js/R3F, Playwright, Express, SQLite, Docker/Caddy.

## 1. React correctness gate
- Enable `react-hooks/rules-of-hooks` and `react-hooks/exhaustive-deps` in `eslint.config.js`.
- Fix reported dependencies with stable callbacks/scalar dependencies; preserve asset caching and recovery behavior. Add regression coverage for conditional Hooks and behavior affected by dependency changes.
- Run scoped tests, typecheck and lint; do not blanket-disable rules.

## 2. Editor maintainability and localization
- Extract cohesive UI/behavior from `components/UI/EditUI.tsx` while retaining the store/action split.
- Translate PaintingInspector's visible text and feedback through a typed three-language catalog; add coverage for English, simplified Chinese and existing editing actions.
- Add a focused gate preventing hardcoded CJK user-facing literals from returning to the repaired component.

## 3. Actual WebGL acceptance
- Add a separate WebGL Playwright project, retaining the existing 2D workflow project.
- Seed a synthetic published exhibition through the existing API and serve its direct page under the production application's CSP in the isolated runtime.
- Assert actual rendered canvas content, labels/assets, no page/CSP errors, 2D/3D transitions and touch viewport operation. Save screenshots and diagnostics; do not equate software rendering with physical-phone FPS.
- Run these checks through the existing CI browser script.

## 4. Operational limits and release
- Reuse isolated collaboration load and restart/independent-restore acceptance; record measured latency and explicit limits. Preserve the single app instance and all production data.
- Run `npm run check`, browser acceptance, fresh HK build and whitelist/budget checks.
- Package only authorized runtime files; run isolated HK acceptance, update the existing production project and verify public HTTPS, readiness, redirect, hashes and exposed ports.
- Record concrete test/deployment results and residual single-host/physical-device limitations here and in the deployment handoff.

## Execution
- Initial Hooks audit found 56 reports, including conditional Hooks in StudioEditPanel; all reported violations resolved and the rules now enforced.
- Audit correction: the pre-existing collaboration browser test overrides the default no-WebGL option. The missing coverage was direct public-page CSP and rendered artwork, not all automated 3D testing. The browser projects now make this distinction explicit.
- Hooks rules enabled without blanket suppression; fixed dependencies use callbacks/scalars and resolved asset queues. Translation changes do not reopen the editing session. StudioEditPanel has a mode-switch regression test. Stable-locale mocks now match the actual provider's function identity.
- PaintingInspector controls, presets, validation and feedback use a typed three-language catalog. A source gate and per-locale editing tests protect it. Extracted editor audio synthesis/playback and cancellation into useEditorGuideAudio with selection-change/unmount tests.
- Browser acceptance: seven workflow/public-WebGL cases passed after updating obsolete quick-create steps and waiting for login rendering before simulating a missing lazy chunk. Existing two-client WebGL interruption/merge/reload acceptance also passed. Desktop and touch screenshots visibly show the synthetic artwork and Chinese/numeric label; tone-mapped pixels are checked against neutral walls.
- Fresh HK build and budgets passed: largest JS 707.7 KiB, total JS 3688.0 KiB, CSS 331.8 KiB. No dependency changes. Archive SHA256: a084da6195868b6dca61eef5549f30f3f4fc29943ab00528b9b0be88eb3fd0be; release: /home/admin/meta-exb-hk-hardening-20260912.
- Isolated HK HTTPS, authentication/CSRF, media permissions, stale-save rejection, multiplayer reconnection and restart persistence passed. Load tiers: 8 clients/40 operations p95 13ms; 16/80 p95 37ms; 32/160 p95 58ms, max 69ms. All remain below the new 2,000ms p95 gate. This is bounded small-scene delivery evidence, not maximum audience capacity.
- Independent stopped-volume restoration verified SQLite integrity, both synthetic accounts, gallery scene and image hash in 1 second. This tiny synthetic snapshot does not establish a production RTO. Restore volume meta-exb-hk-hardening-restore-20260912 retained; exact synthetic users cleaned and staging stopped with no public ports.
- Full checks initially run concurrently with browsers encountered timeouts. Final sequential `npm run check` passed: typecheck, lint, server syntax, 305 test files / 2,353 tests passed, one file/test skipped, production build and bundle budgets passed. An additional isolated run of useScenePreloader passed all five tests, including position-only edits preserving the asset queue and changed image sources reloading it.

## Production completion, 2026-09-12 22:44 HKT

- Updated the existing Hong Kong production project only after the above checks passed. Production environment checksum and mode 600 preserved; existing runtime and certificate volumes retained. No Git commit, push or branch operation.
- Prior source: `/home/admin/meta-exb-hk-production-20260904/source.pre-hardening-20260912`; consistent stopped-runtime backup: `/home/admin/meta-exb-hk-production-20260904/backup-hardening-20260912/runtime.tar.gz`. Previous app/web images retained with `pre-hardening-20260912` tags.
- Final app image: `sha256:540fcfbd7d991ee9c74d24b3aba6a25bfc054677f94e57547237311adaae757b`; web image: `sha256:bc66f16330240ca18a58d569430317ee37354cb34625dc61f572e414640fc5a8`. Production app image matches the isolated staging acceptance image.
- Trusted public HTTPS, readiness, www redirect, all 345 public file hashes and missing-exhibition metadata exclusion passed. Local Node verification used the operating system CA store (`--use-system-ca`), with certificate validation enabled.
- Running backend hashes match the release manifest; read-only live SQLite integrity check passed. Website host bindings remain only 80/443; the app has no exposed host port.
- Actual desktop/touch WebGL screenshots and 2D/3D transitions were verified in the isolated browser runtime under the production middleware CSP; the deployed release was verified through public HTTPS and exact file hashes. This release did not perform a new physical-device benchmark.
- Remaining architectural work: SQLite/in-memory collaboration still requires one app instance; this change does not provide failover or horizontal scaling. The cohesive audio extraction reduces EditUI responsibilities but does not fully split the large editor/database modules. Broader component localization remains outside the repaired PaintingInspector scope.
