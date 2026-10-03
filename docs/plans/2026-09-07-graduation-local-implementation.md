# Graduation Exhibition Local Implementation Plan

> Execution: user explicitly requested sub-agents, backup first, and local-only validation. No Git commit/push or deployment. Use focused implementation agents and independent review.

**Goal:** Deliver a locally usable graduation exhibition workflow from class creation and student submission through teacher review, publication, explainable grouping and archived portfolio export.

**Architecture:** Add an isolated graduation domain using the existing Express authentication and SQLite database. Keep existing 3D exhibits intact; link owned published galleries from rich text project pages. Public visitors see only an explicitly published immutable snapshot. AI suggestions never automatically publish or overwrite project facts.

**Tech Stack:** React 18, TypeScript, Tailwind, Express, SQLite, Zod, Vitest.

## Backup

Verified backup: `D:/meta_exb_backups/before-graduation-local-20260907-184607`.
3,574 entries verified, including two consistent SQLite snapshots with integrity checks. See backup manifest and RESTORE.md; dependencies/build/temp/logs excluded. Backup includes private local settings and is not for publishing.

## Scope and boundary

Implement P0 truthfulness and P1 graduation workflow, structured feedback, explainable grouping, explicit immutable releases and downloadable portfolio data. Retain current product features. P2 broad scalability/refactoring, institutional research, real teacher blind evaluation and measured 30-minute promise remain future acceptance work, not fabricated completion.

## Contract

All endpoints `/api/graduation`; existing requireAuth/active-user middleware used. Errors `{message, code?}`. IDs server-generated. All private reads/mutations check membership/ownership. Class creator is teacher for that class (not a site-wide educator credential). Invitation token grants student membership only; reviewer can be added by teacher separately if implemented.

- GET `/classes` -> `{classes: Class[]}` for owned/joined classes.
- POST `/classes` `{title, description, deadline: ISO|null}` -> `{class: Class}`.
- POST `/join` `{inviteToken}` -> `{class: Class}`.
- GET `/classes/:id` -> `{class: Class, projects: Project[], reviews: Review[]}`; student sees own projects/reviews only; teacher sees all. Teacher-only invite token in Class.
- POST `/classes/:id/projects` `ProjectInput` -> `{project: Project}`; one project per student per class, owner cannot be chosen in request.
- PATCH `/projects/:id` `ProjectInput & {expectedRevision}` -> `{project: Project}`; only owner edits draft/returned, rejected after submitted/approved.
- POST `/projects/:id/submit` `{expectedRevision}` -> `{project: Project}`; require completed title/researchQuestion/concept/process/outcome; enforce deadline.
- POST `/projects/:id/review` `{expectedRevision, decision:'approved'|'returned', feedback}` -> `{project: Project}`; only class owner on submitted project. Returned feedback required.
- POST `/projects/:id/reviews` `{visibility:'public'|'private', content}` -> `{review: Review}`; teacher or owning student, reviews private until explicit public release. Keep minimal threaded role-labelled feedback if scope allows.
- POST `/classes/:id/publish` -> `{release: Release}`; teacher only, approved projects only, explicit immutable snapshot, at least one approved project; each call creates numbered release.
- GET `/public/:token` -> `{release: Release}`; only frozen public-safe fields, no invite token, email, private feedback, drafts or mutable gallery privacy bypass.
- GET `/portfolio` -> `{projects: Project[]}` owner only, exportable JSON in UI.
- GET `/classes/:id/releases` -> `{releases: Release[]}` teacher/member scoped as appropriate; no private data in snapshots.

Class: `{id, ownerId, title, description, deadline, createdAt, role:'teacher'|'student', inviteToken?}`.
ProjectInput: `{title, researchQuestion, concept, process, outcome, team, supervisor, galleryId?:string|null}`.
Project: ProjectInput plus `{id,classId,ownerId,authorName,status:'draft'|'submitted'|'returned'|'approved',revision,feedback,createdAt,updatedAt}`.
Review: `{id,projectId,authorName,role,visibility,content,createdAt}`.
Release: `{id,classId,version,token,title,description,createdAt,projects: PublicProject[]}`; snapshot stores confirmed text and public feedback only. Gallery links may be exposed only if currently public; do not embed private gallery assets or token grants. Snapshot text persists unchanged across later edits. UI clearly distinguishes text archive from linked mutable 3D gallery.

## Task 1: Domain and authorization

Create `server/repositories/graduationRepository.js`, `server/services/graduationService.js`, `server/routes/graduationRoutes.js`, focused tests. Modify `server/index.js` to register and initialize before listening, using existing active-user dependencies. Use additive tables with account-deletion compatible foreign keys, atomic revision-conditional transitions, no access to real DB in tests. Cover outsider access, invitation, deadline, stale writes, approval, snapshot privacy and immutability. Run scoped Vitest tests and server syntax check.

## Task 2: Frontend graduation workspace

Create `src/app/api/graduation.ts`, `src/app/features/graduation/*`, pages for workspace/class/public release/portfolio. Add authenticated routes and a public token route in `src/app/routes.ts`, navigable entry in existing navigation. Use existing theme tokens, accessible labelled forms, pending states, error recovery and three-locale copy. Provide teacher creation/invite/review/publish, student join/edit/submit/feedback, public approved-only project details, local JSON export. Confirm before publishing public content. Tests cover failures retaining inputs and permission-aware presentation.

## Task 3: Explainable curation and source transparency

Add bounded grouping service and UI for teacher to request suggestions using only submitted/approved project text. Model access through configured Qwen provider, with explicitly labelled deterministic fallback; no invented projects, exact ID coverage and rationale validation. User reviews proposal and explicitly saves groups; manual grouping is possible. New suggestions do not alter project facts or approved snapshots. Expose source, rationale and warnings. Update quick-create wording to call its geometry algorithm automatic layout, not AI content understanding. Tests validate fabricated/duplicate/missing IDs and fallback labels.

## Task 4: Integration and independent reviews

Review specification compliance first, then code quality/security. Run `npm run check`, resolve introduced failures, and browser-test local teacher/student/public flows with synthetic data. Prefer an isolated local database/runtime for smoke testing; do not seed or overwrite existing user data. Record ports, test results, scope limitations and rollback instructions. No public deployment.

## Completion record

2026-09-07: local core delivered. Backend, frontend and curation each received specification and quality reviews; identified partial-PATCH defaults, field requirements, rate limiting, error localization, gallery-view access, stale-resource display, save/review input races and stale curation recovery were fixed and re-reviewed. Full check passed (2,041 tests passed; Redis integration skipped). Browser workflow and downloaded JSON privacy verified; 390px public view checked. See `../graduation-local-guide.md` for launch, synthetic credentials, backup and remaining roadmap items. No deployment, commit or push performed.
