# Simplify graduation reflection workflow

> **Goal:** Give students one guided project and reflection workflow with a single revision-safe submission for the project and its related skill cards, while preserving AI review and teacher publication controls.

**Architecture:** Keep the existing project and skill-card records and APIs as the source of truth. Add combined server operations that validate the project and related card revisions before an atomic SQLite write and trigger update. Reshape the existing class page and editors into three student steps and a compact teacher review surface.

**Tech Stack:** React 18, TypeScript, Express, SQLite, Vitest.

---

### Task 1: Make combined submission atomic

**Files:**
- Modify `server/services/graduationService.js`
- Modify `server/routes/graduationRoutes.js`
- Modify `server/services/graduationSkillService.js` only if shared validation is needed
- Test `server/routes/graduationRoutes.test.js`

Add a combined endpoint accepting the project revision and exact skill-card revision set. Validate ownership, deadline, project completeness/status, each card status/revision, and set equality before writing. Ensure a stale card or failed project check leaves every record unchanged. Retain the existing individual endpoints for compatibility.

### Task 2: Present one student workflow

**Files:**
- Modify `src/app/features/graduation/GraduationClassPage.tsx`
- Modify `src/app/features/graduation/ProjectEditor.tsx`
- Modify `src/app/features/graduation/SkillPortfolio.tsx`
- Modify `src/app/api/skills.ts`
- Modify `src/app/api/graduation.ts`
- Test `src/app/features/graduation/graduation.test.tsx`

Organize project reflection, evidence/AI review, and preview/submit into three clearly labeled steps. Remove the standalone skill-card submit action and duplicate submit affordance; submit the project and editable related cards together. Keep manual completion available when AI is unavailable, preserve source selection and AI decision/history controls, and show the saved/submitted state with the next action.

### Task 3: Focus teacher review and verify local demo

**Files:**
- Modify `src/app/features/graduation/GraduationClassPage.tsx`
- Modify `src/app/features/graduation/SkillPortfolio.tsx`
- Extend focused route/UI tests as needed

Keep teacher and student surfaces role-specific. Present submitted project content and related submitted cards/evidence for focused teacher review, while retaining explicit approve/return decisions and existing publication confirmation. Run the focused server and UI tests, then exercise the local demo path if available.

### Verification

- `npm run typecheck` and `npm run lint` pass after the final read-only submitted-card change.
- `npm run test -- src/app/features/graduation/graduation.test.tsx`: 14 tests pass, including the submitted-card read-only state.
- `npm run test -- server/routes/graduationRoutes.test.js src/app/features/graduation/graduation.test.tsx src/app/features/graduation/GraduationWorkspace.test.tsx`: 42 tests pass, including atomic revision checks and stale teacher-card review rejection.
- `npm run test:competition`: 2 browser acceptance tests pass for evidence selection, AI fallback/reason history, combined submit/review, and publication controls.
- Local browser acceptance completed the guided flow through teacher approval. Each step is explicitly saved; AI assistance remains optional and does not generate a result when unavailable.
- `npm run check:bundle` passes all bundle budgets.
