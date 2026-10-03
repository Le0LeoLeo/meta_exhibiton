# Education-first entry implementation plan

**Goal:** Make the existing class exhibition workflow the clearest starting point for teachers and students, with a usable teaching guide.

**Architecture:** Reuse the current `/graduation` class workflow and existing routes. Change only the homepage entry, the graduation workspace guidance, and the resources page. Keep exhibition creation and public browsing available.

**Tech stack:** React, TypeScript, React Router, project i18n catalogs, Vitest.

## Tasks and checks

1. Update homepage education message and actions in `src/app/pages/Home.tsx` and relevant translations. Verify teacher and student actions reach the current class workflow without removing the gallery action; run the focused homepage test.
2. Clarify the two paths in `src/app/features/graduation/GraduationWorkspace.tsx`: creating a class and joining with an invitation. Verify the existing create/join forms still call the same API and navigate to the class page; run focused graduation tests.
3. Add a real education quick-start guide to `src/app/pages/Resources.tsx`, using existing routes and accurately stating the review and publication steps. Verify its content and links with a focused test.
4. Review all changed files, run TypeScript, lint, focused tests, and a fresh build. Check the deployment scope against the existing dirty worktree and Hong Kong release rules before any production update.

## Boundaries

- Do not change class membership, authentication, publication, or privacy semantics in this phase.
- Do not commit, push, or replace existing user work.
- Student data and private reviews remain subject to the current server permissions.
