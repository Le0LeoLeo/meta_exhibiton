# Scope, existing platform, and contribution record

**Status:** implementation/contribution worksheet for a local-only working-tree change. This is not a final authorship statement or proof of eligibility. Complete it with the participating students and school before submission. No production deployment is claimed.

## Proposed project

**Working title:** MetaEXB Learn: Evidence-Based Reflection with AI  
**Learning focus:** help a learner describe their own contribution, inspect what available evidence supports, evaluate a generated suggestion, and explain their decision. A 2D portfolio is the primary learning surface; 3D is optional presentation.

## Existing platform capabilities observed in the repository

These capabilities predate this competition work. Their presence in local source does not establish that each is deployed, tested for this project, or authored by the competing students.

| Existing capability | Repository evidence | Competition boundary |
|---|---|---|
| Class, invite, submission, and teacher review flow | `src/app/routes.ts`; `server/routes/graduationRoutes.js`; `docs/teaching-workflow.md` | Reuse only after confirming the candidate environment and school rights. |
| Skill portfolio cards with context, role, actions, outcome, reflection, and sources | `src/app/features/graduation/SkillPortfolio.tsx`; `server/services/graduationSkillService.js` | Existing product functionality; do not count as student-created work without a documented contribution. |
| AI suggestion service and persisted run/decision history | `server/services/graduationSkillService.js`; `server/repositories/graduationRepository.js` | Existing implementation. A real response must be captured from the chosen candidate and named provider/model. |
| Curation, public portfolio, and exhibition views | graduation feature and service modules | Existing review/publishing flow; verify privacy and current access behavior before showing it. |
| 2D and optional 3D exhibition presentation | `GraduationPublicPage.tsx`; `GraduationRoomSkills.tsx` | Existing presentation capability, not evidence of learning impact. |

## Implemented locally in this competition-preparation change

- The graduation skill workflow previews the experience fields and lets the student select saved evidence for a request; the server validates selected source IDs and the request is tied to a saved card revision.
- Graduation decisions can record a reason and checked evidence, and the v4 evidence gate flags outputs that cite unselected or link-only evidence for review. It does not certify claims as true; consult the validation record for tested behavior.
- The public `/competition-demo` orientation page selects English on entry and labels its fixed examples as fictional, not live AI output. Its links enter existing authenticated graduation routes.
- A fixed set of 25 synthetic cases and a bounded local runner support technical checks. Preliminary model outputs remain subject to human review; see `local-validation.md`.

This work is local-only. The standalone personal CV suggestion path remains an existing flow and was not expanded with the graduation workflow's selected-evidence controls. No participant study, consent collection, learning outcome, eligibility determination, production release, or deployment is asserted.

## Student work to record honestly

Fill this table using actual work records. Split work by person and date; do not assign planned work as completed work.

| Student (fill in) | Work actually completed (file, experiment, or artifact) | Date/evidence | Explainable by this student? |
|---|---|---|---|
| [Student A] | [TODO] | [TODO] | [TODO] |
| [Student B] | [TODO] | [TODO] | [TODO] |
| [Student C, if applicable] | [TODO] | [TODO] | [TODO] |

Possible areas of student ownership, only if actually completed: classroom problem definition; source-selection policy; interface and implementation; fixed test design; test execution and error analysis; teacher/participant coordination; research interpretation; English writing, poster, and video. Each student should be able to explain the whole system as well as their own contribution.

## Teacher and tool contribution disclosure

- **Teacher contribution:** [TODO: actual classroom guidance, safety review, recruitment/consent coordination, code or writing feedback, and dates.]
- **AI development tools:** GPT-6 Luna at high reasoning effort was used in subagent implementation work; a supervising Codex agent reviewed integration and risks. Record the actual files/tasks assisted and human review in the final submission disclosure. This describes development assistance, not the Qwen model used for separate technical test runs.
- **Third-party code, packages, services, and assets:** [TODO: licenses, source links, modifications, and whether used in the submitted artifact.]
- **Prior platform owner / reuse permission:** [TODO: obtain written confirmation of ownership, license, and permission to submit a student extension of the existing platform.]
- **Contest eligibility confirmation:** [TODO: school confirms student eligibility and that reuse of this existing platform is allowed.]

## Rights and consent checklist

- [ ] School has confirmed eligibility and permission to base the work on this existing platform.
- [ ] Every image, text, code sample, and recording has a documented right to use it; synthetic examples are labeled.
- [ ] No real student identity, face, voice, private source, or identifiable work is in public materials without the required permission.
- [ ] Any study with people has school approval, appropriate consent/assent, withdrawal and deletion procedures, and a data owner before collection.
- [ ] AI-provider terms and data handling have been reviewed before sending any real learner material.
- [ ] Public cards contain only content deliberately approved for publication; private decision history remains private.

## Before submission

Replace every TODO with verified facts or mark it “not done.” Preserve the distinction between existing platform work, student-created changes, teacher support, AI-tool assistance, and work still outstanding. Do not claim that the project is submission-ready until the school has reviewed the completed record.
