# Homepage motion

Verified on production 2026-09-10 20:49 HKT.

Inspired by the user's MotionSites reference, the existing museum homepage now has staggered title reveals, a finite artwork reveal, delayed caption/entry-arrow arrival, staggered collection cards and creation steps, hover lift/zoom, and animated path underlines. The creation section has a subtle static red wash. Existing routes, translated copy and artwork remain intact. Animation CSS is loaded with Home; no dependency or scroll listener was added. Reduced-motion CSS disables homepage transitions and animation, including inherited artwork hover zoom.

Changed source: `src/app/pages/Home.tsx` and new `src/styles/home-motion.css`.

Validation: 46 homepage/deployment/bundle tests passed, TypeScript check and Home ESLint passed, fresh HK build and actual-output budgets passed (CSS 320.8 KiB / 340 KiB). Browser checked desktop and 390px local layout, Traditional/Simplified Chinese and English, hover presentation, title/artwork animation names and staggered cards. Reduced-motion behavior was reviewed in CSS, not tested by changing the operating-system preference. No physical-phone performance claim.

## Concurrent release resolution

The working directory contained another task's template changes. An isolated control build reproduced the previous font release's JavaScript/CSS after normalizing generated hashes. The attempted web-only deploy was stopped by its expected-web-image guard before any production mutation: the templates task had meanwhile published a newer release.

Inspection showed that the templates release already included the exact tested homepage JavaScript and CSS. Both hashes matched this task's initial fresh build. No second deployment or rollback was performed, preserving the new templates.

- Active release: `/home/admin/meta-exb-hk-templates-20260910`, local manifest `.tmp/hk-templates-release-20260910-r2/release-manifest.json`.
- Homepage assets: `Home-CVYIoZgQ.js`, `Home-DmxwcqpW.css`.
- Web image: `sha256:2803ad9c83265808fbacb8f91826e9b146395fd5a35c86e749bf99df739ad3f8`.
- Backend remains healthy at `sha256:542698bfbded216582915d4f789f025b328abb5b6b754e5d4e577552eb7ead7f`.
- Fresh verification: all 220 public HTML/JS/CSS/font/license hashes matched over trusted HTTPS; `/api/ready`, SPA routes and www redirect passed. Website host mappings remain TCP 80/443 only. Browser confirmed production title/artwork animation and card stagger.
- The current release's backup/rollback is documented in `2026-09-10-complete-gallery-templates.md`. Do not use the unexecuted motion rollback helper: its backup was never created.
- This task changed no production data, private environment, backend or certificate volumes, and made no Git commit/push.

Local verification helper: `.tmp/motion-20260910/verify-current.mjs` (run Node with `--use-system-ca`). The unused isolated motion archive is retained for audit only and must not be deployed over the current template release.
