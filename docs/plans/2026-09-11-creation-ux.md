# Creation UX implementation plan

**Goal:** Make the first exhibition journey and server-save status easier to understand.

**Architecture:** Keep existing navigation, creation controller and persistence protocol. Add localized guidance to the actual Home page, strengthen the existing quick-create step indicator, and expose save request outcomes in the editor toolbar without changing queue or retry behavior.

**Tech Stack:** React, TypeScript, Tailwind, existing three-language dictionaries, Vitest and browser acceptance.

## Tasks
1. Update `src/app/pages/Home.tsx` with concise visit/create expectations and a template link; preserve existing visual design.
2. Update `src/app/pages/QuickExhibitionCreate.tsx` with a responsive, accessible current/completed step indicator and an always-available published link for manual copying.
3. Update `src/app/pages/VirtualGalleryCreate.tsx` with request saving/error state, persistence-paused/manual-save messaging and locale-aware last-success timestamp. Reset request feedback on gallery navigation; keep stale responses guarded by the existing generation token.
4. Add matching copy in `src/app/i18n/catalogs/creationUx.ts` and register all three dictionaries.
5. Extend existing editor tests for pending automatic saves, persistent failure feedback, retry success, and navigation isolation. Run relevant tests, typecheck, lint and a fresh Hong Kong build with the actual-output bundle gate.
6. Inspect desktop/mobile UI in the browser. Package only whitelisted release files, deploy the web update to the existing Hong Kong project and verify HTTPS, readiness, assets, redirect and published ports. Record exact evidence here.

No Git commits/pushes or branch changes; preserve existing worktree changes. No backend or persistence-protocol changes are planned.

## Validation and production result

Verified 2026-09-11 17:17 HKT.

- Home now explains anonymous visits and sign-in before creation, with a direct template discovery link. Existing glass buttons and destinations retained.
- Quick-create uses responsive current/completed step cards. The published URL is always available for selection/copying, including when clipboard access fails.
- Editor toolbar reports automatic/manual save mode, active server request, persistent failure, paused persistence and a locale-aware last-success timestamp. Local draft status remains distinct. No queue, retry, API, authorization or synchronization protocol change.
- 108 targeted tests plus 5 Home tests passed; typecheck and lint passed. Regression coverage includes automatic-save pending/failure/retry and stale-response navigation isolation. Updated one existing template test to compare the loaded width against its input scene instead of the obsolete hard-coded width.
- Desktop and touch-phone browser workflow tests passed: upload, save, reload, publish, public view, stale-save conflict and withdrawal. Verified published URL without first causing a clipboard failure. These use an isolated synthetic local database, not production accounts.
- In-app browser inspected desktop and 390×844 Home plus quick-create, including login return navigation; no horizontal overflow. Touch-device workflow runs separately using the existing Playwright phone configuration. Real mobile hardware and complete 3D interaction were not revalidated.
- Fresh Hong Kong build, actual-output bundle budgets and whitelist packaging passed (447 files). Largest JS 707.7 KiB; total JS 3618.7 KiB; CSS 329.3 KiB.
- All non-dist release hashes matched the current production manifest. Web-only deployment preserved backend image, environment checksum/permissions, user data, uploads and certificate volumes. Only TCP 80/443 publicly mapped.
- 161 public HTML/JS/CSS/template asset hashes verified over trusted HTTPS, plus readiness, SPA routes and www redirect.
- Archive SHA256: `7b15f2a8c73882a423d8fb6a59ab0625c1b103b7f21df365dd1f3fdfa4a6da9a`.
- Web image: `sha256:50a7f3a38dfff56cb0f37fb287b520edd883e3f66a8d881482c7e65406feb568`.
- Source backup: `/home/admin/meta-exb-hk-production-20260904/source.pre-creation-ux-20260911`.
- Rollback before subsequent release: `sh /home/admin/creation-ux-rollback-20260911.sh production`.
- Local deployment evidence: `.tmp/creation-ux-20260911/`.
