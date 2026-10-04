# New Visitor Improvements Implementation Plan

**Goal:** Complete the first-visitor requirements in `../新用戶試用修改需求-2026-09-05.md` with a usable public demo, honest onboarding, safe joins and readable copy.

**Architecture:** Reuse existing gallery rendering and template data. Keep public demonstrations independent of user-owned runtime records and preserve existing authentication and sharing authorization. Three sub-agents own disjoint frontend areas; the parent owns integration, shared catalog changes, verification and deployment.

**Tech Stack:** React 18, React Router, TypeScript, R3F, Zustand, Vitest, Vite, existing Express deployment.

User explicitly selected sub-agent execution in this session. Preserve existing working changes; no commits, branch changes or Git push. Native collaboration tools implement the delegation workflow; referenced superpowers execution skills are not installed and are not needed for this workflow.

## Task 1 — Public demonstration (agent demo)
- Inspect `src/app/pages/ExhibitionView.tsx`, template snapshots and existing 2D/3D viewer.
- Implement `/demo` with owned sample content using existing rendering, visible instructions, return/create actions and 2D fallback. Disable user-data writes and multiplayer/AI requests for the local demonstration rather than weakening server authorization.
- Own demo-specific new files, `routes.ts`, `ExhibitionView.tsx`, `MetaverseStudioApp.tsx` if needed, `pages/Exhibitions.tsx` and `components/RecentSouvenirs.tsx`.
- Verify loading/empty/error distinctions and demonstration boundaries with focused tests.

## Task 2 — Homepage and learning (agent onboarding)
- Own `components/Hero.tsx`, new quick-start components, `InfoBanner.tsx`, `Navigation.tsx`, `Footer.tsx`, relevant tests.
- Add prominent `/demo` action and replace decorative video with an accessible step-by-step quick start.
- Preserve existing customer quotations; improve misleading first-party destinations and contrast within owned components.
- Verify meaningful navigation and tutorial interactions with focused tests.

## Task 3 — Templates, joins and authentication continuity (agent entry)
- Own `pages/VirtualGallery.tsx`, `Login.tsx`, `Register.tsx`, relevant utilities/components/tests; coordinate before editing other files.
- Inspect actual template availability; add previews and preserve chosen template through authentication.
- Implement validated local gallery/share-link parsing, preserve access boundaries, and test external URLs, invalid values and genuine supported routes.
- Add contextual login messages and demo alternative without changing authentication mechanisms.

## Task 4 — Parent integration
- Merge agents' requested locale keys into `src/app/i18n/catalogs/{zh-TW,zh-CN,en}.ts` without overwriting existing changes.
- Inspect `src/styles/theme.css` and measure text contrast; make narrow token corrections if justified.
- Review all task-specific changes, run targeted tests then `npm run check`.
- Run the app locally and verify anonymous demo, tutorial, templates, join validation and responsive layouts in the supported browser.

## Task 5 — Release
- Read current Hong Kong handoff and deployment instructions; inspect exact current production identity without printing secrets.
- Build clean-env release with existing whitelist, inspect archive and hashes.
- Follow isolated staging acceptance where authentication/data/networking changes require it, then update the existing production project while preserving env/data/certificate volumes.
- Verify trusted public HTTPS, readiness, redirects and UI; record precise validation/deployment outcome in handoff and requirement checklist.

## Commands
- Focused tests: `npm run test -- <affected test paths>`; expected pass.
- Full validation: `npm run check`; expected all required gates pass (Redis integration may be explicitly skipped without its service).
- Release build: `npm run build -- --config deploy/hongkong/vite.config.ts --outDir <unique stage>/dist`.
- Release preparation: `node scripts/prepare-hongkong-release.mjs --stage <unique stage>/dist <unique release>`.
