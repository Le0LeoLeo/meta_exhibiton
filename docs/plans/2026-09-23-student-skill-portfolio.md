# Student Skill Portfolio Implementation Plan

**Goal:** Add a generic, evidence-grounded student skill portfolio to the existing graduation workflow. Sports are only possible use cases; no sports-specific implementation.

**Architecture:** Persist skill cards against graduation projects, keep source metadata and visibility per evidence item, generate grounded AI suggestions with explicit failure states, and include only teacher-approved public content in immutable graduation releases. Present approved skills in a generic interactive 3D display and the same claims in the 2D public page; preserve the existing optional gallery link.

**Tech stack:** React/TypeScript, Express, SQLite, existing Qwen-compatible AI service, Vitest.

## Work packages

1. Backend schema/service/routes: skill cards, evidence, revision checks, owner/teacher permissions, submit/review, and public snapshot filtering. Test private data exclusion and stale writes.
2. Backend AI: provide grounded suggestions and reflection questions from card input. Validate evidence IDs and return an explicit unavailable state if the provider is not configured or fails. Test output validation and error handling.
3. Frontend API and editor: create and edit skill cards under a student project, supply evidence metadata, request AI suggestions, and allow accepting or rejecting each suggestion. Keep the card generic.
4. Review and publication: teacher reviews submitted cards, public project cards show only approved public claims and sources. A generic 3D card gallery can be opened on demand; 2D content stands alone.
5. Verification: focused tests, server syntax, typecheck, lint, build, browser workflow, and isolated deployment acceptance if the finished release is intended for production.

## Acceptance

- A student can create a generic skill card, document their own contribution, attach permitted text/link sources, and submit it.
- AI suggestions identify their source or missing evidence, remain editable, and never silently become a verified claim.
- A teacher can approve or return a card, and only approved public cards and public sources appear in a release snapshot.
- A visitor can read the same core claims in the public 2D page even if 3D is unavailable.
- No football-specific assets, models, interactions, copy, or templates are added.

## Limitations of this increment

Real student testing, consent collection, English competition materials and a five-minute demo require participants and content. The application should make these possible; this implementation does not invent results or consent.

## Implementation and validation record (2026-09-23)

- Implemented generic student skill cards, text/link evidence and visibility, grounded AI suggestion requests, student submission, teacher review, public release filtering, 2D reading and an on-demand 3D card gallery. No activity-specific scene or template was added.
- Focused server/frontend tests and a browser test covering the student editor, AI unavailable state, teacher approval, public source filtering and rendered WebGL pixels passed. `npm run check` passed 2,435 tests with one Redis integration test skipped; subsequent focused fixes passed their related tests, typecheck, lint, server syntax, build and bundle checks.
- The first broad browser run had one existing builder case fail with a local API `ECONNRESET`; an isolated rerun of that case passed. The new skill browser workflow passed after fixing the unsaved-draft AI validation path.
- Hong Kong production was inspected read-only and not updated. The local worktree contains hundreds of pre-existing changes and differs from the current production source beyond this feature. A release from the whole local tree would include unrelated work; a separate release candidate and isolated staging acceptance are needed before production deployment.
- Continued locally: students can delete draft or returned cards after an explicit confirmation, and submission clears the old editor content. AI requests now use the saved card and its current evidence. The private audit trail records each AI run, source references and the student's adopted, modified or rejected decision; the student and class teacher can review it. Public releases exclude this history, while the student's personal export includes it. No deployment was performed.
- After this increment, `npm run check` passed: 2,440 tests passed, one Redis integration test skipped, and server syntax, avatar validation, typecheck, lint, build and bundle budgets passed. The focused WebGL browser flow also passed with the saved-card AI sequence.
