# Teaching workflow implementation plan

**Goal:** Extend the existing graduation module across collaboration, explainable curation, accessible viewing, dialogue and long-term portfolios; validate and deploy to Hong Kong.

**Architecture:** Reuse class-scoped permissions and revision checks. Add SQLite tables and triggers without replacing existing data. Public archives stay immutable; post-publication questions are a separately labelled live discussion. No Git operations.

**Tech Stack:** React, TypeScript, Express, SQLite, Zod, Vitest, existing Hong Kong Docker release workflow.

## Tasks and verification

1. Extend `server/repositories/graduationRepository.js`, `server/services/graduationService.js` and `server/routes/graduationRoutes.js`: class progress and editable deadline with optimistic concurrency; immutable project history; authenticated visitor questions, author/teacher replies and moderation. Test real SQLite HTTP permissions, revision races, old snapshots, privacy and restart-safe schema initialization in `server/routes/graduationRoutes.test.js`.
2. Extend `server/services/graduationCurationService.js` and `src/app/features/graduation/CurationPanel.tsx`: editable group introductions grounded in supplied text, explicit confirmation, optional self-reported manual baseline/actual minutes, quality and notes tied to saved plan revision. Retain AI/rules distinction and test invalid output and measurement validation.
3. Update `src/app/features/graduation/`: status filtering, actionable counts, teacher settings, question inbox, mobile public project index, separate 2D/3D links, version history, standalone HTML portfolio download. Add three-language copy using existing locale provider. Test conflicts, retained input, filters, escaping and 2D entry without 3D initialization.
4. Run targeted tests, `npm run check`, fresh Hong Kong build and bundle gate. Browser-check actual teacher/student/public paths and narrow viewport using isolated synthetic data.
5. Package only release whitelist, verify hashes, use isolated HK acceptance and restart/restore checks; preserve dependencies when lockfile matches verified image to avoid host I/O overload. Back up production runtime, deploy accepted app/web images, verify health, public TLS/redirect/assets and ports. Record concrete results here.

## Acceptance limits

No invented teacher trial results or measured FPS claims. Measured curation minutes are explicitly self-reported and may show negative savings. Text revision capture starts with the existing version at migration; no reconstruction of previously discarded drafts. 3D links remain live references rather than permanent media snapshots.

## Implemented

- Teacher dashboard counts enrolled students and missing/draft/submitted/returned/approved work; status filters preserve mounted editors and unsent feedback. Deadline changes use a conditional write to reject stale changes. Membership details remain teacher-only.
- Curation accepts a bounded, editable visitor introduction per group, asks the model to cite supplied project titles in its reasoning, and retains explicit human confirmation. Rule fallback leaves introductions blank. Optional evaluation records are teacher-only, tied to the current saved plan, include manual/actual minutes, quality and notes, and show negative differences without claiming a benefit.
- Public archives have a mobile project index, search, lazy-open discussions and explicit 2D links. `?mode=2d` skips WebGL probing and studio initialization. Existing adaptive 3D rendering remains unchanged; no FPS improvement is claimed.
- Signed-in visitors can ask public questions against a project included in a specific release. Authors and class organisers can reply once (conflicting replies return 409) or hide the discussion. Private reviews remain private. Live questions are labelled separately from immutable publication feedback; lists are capped at 100.
- SQLite triggers retain every successful project revision atomically; initialization seeds the existing version without duplicates. Personal portfolios show dated class archives, version selection, JSON history and standalone printable HTML containing selected creative text, excluding private feedback. Account export now handles both historical array snapshots and current grouped snapshots, and includes personal versions/questions.

## Validation — 2026-09-12

- `npm run check`: passed server syntax, avatar assets, typecheck, lint, 300 test files / 2,337 tests (one optional Redis file/test skipped), build and bundle budget. Log: `.tmp/teaching-workflow-check.log`.
- Final focused run after adding interface tests: 9 files / 64 tests passed. Focused lint also passed. Covers deadline conflicts, permission isolation, successful-only revision history, repeat schema initialization, public question spoofing/reply races/moderation, evaluation privacy and negative differences, HTML escaping and 2D initialization. Log: `.tmp/teaching-targeted-final.log`.
- Browser: created a new synthetic class, switched to synthetic student, joined, saved and submitted, switched teacher and approved, edited grouping rationale/guide and explicitly saved, recorded synthetic negative-difference evaluation, published, asked from public page, replied as author, opened version 1 in portfolio. Downloaded HTML was inspected for both projects, print rules and private-feedback exclusion. Browser download-event notification timed out, but the actual downloaded file was verified. At a 390px browser viewport (375px content area with scrollbar), public page and portfolio had no horizontal overflow.
- Fresh no-development-env HK build passed actual release bundle budgets; release contains 459 allowed files. Archive SHA256: `ede43d8b9900e4f052666d0fb9010d64bff7326546fc880070419c9bb3a72f34`.
- Exactly five backend files differed from prior production: graduation repository/routes/service/curation service and personal data export service. Package/lock files exactly matched. Reused the verified production runtime dependencies, avoiding dependency installation on the recently recovered host.
- HK isolated HTTPS acceptance passed teacher/student/visitor, deadline CAS, return/revise/resubmit/approve, private/public feedback, confirmed guide/evaluation, publication snapshots, live question/reply, history, restart persistence and personal account export. Initial verifier referenced the wrong temporary CA filename; corrected the filename and verified TLS normally, without disabling validation. No account had been created before that correction.
- Independent restore volume `meta-exb-hk-teaching-restore-20260912` passed SQLite integrity and version/release/guide/evaluation/reply assertions. Initial SQLite read on a read-only restore mount could not create its WAL helper files; allowing writes only on the isolated restored volume resolved the check. Original staging data was preserved. Synthetic staging accounts and their dependent records were then cleaned; staging app/web stopped, no ports exposed.

## Deployed — 2026-09-12 17:51 HKT

- Existing project/source preserved: `/home/admin/meta-exb-hk-production-20260904/source`, `meta-exb-hk-production`.
- Previous source: `source.pre-teaching-20260912`; previous images tagged `pre-teaching-20260912`.
- Consistent stopped-runtime backup: `/home/admin/meta-exb-hk-production-20260904/backup-teaching-20260912/runtime.tar.gz`; retained alongside existing backups and independent restore volume.
- Accepted/deployed app image: `sha256:b0c1fec53550be40397924f530ff1091a61fb87af7d5c954b7e11ae84da71ed2`.
- Accepted/deployed web image: `sha256:fa64cb6b9eb21970be291d08378a35095886aea92ec060f8c92db5399ee13e2c`.
- Production environment hash and mode 600, runtime/upload volumes and certificate volumes unchanged. New schema is additive; roll back code if needed without replacing current user data with an older database.
- Public system-trusted HTTPS, `/api/ready`, www redirect, 345 exact frontend hashes, backend manifest and SQLite integrity all passed. Browser verified `/graduation` correctly returns unauthenticated visitors to login with the graduation return path and existing Google sign-in. Only 80/443 expose website services; SSH administration remains unchanged, no app/DB/multiplayer/Docker ports exposed. Load average at 17:51 HKT: 0.04/0.08/0.04.
- No Git commit, push, branch change, DNS or cloud-account change.
- Local synthetic class created for this run and its dependent records were cleaned after browser acceptance; the earlier local demonstration class/accounts were preserved. The temporary local development session was stopped.

## Remaining evidence limits

This verifies software functionality using synthetic users. Real classroom trials, independently assessed curation quality, real manual timing and low-end physical-device FPS remain unmeasured. Portfolios archive text and review versions; linked 3D media remains subject to current publication permissions and is not a permanent binary asset snapshot.
