# Evaluation protocol (pre-registration worksheet)

**Status:** proposed human-study protocol; no student or teacher participants have been recruited and no learning results have been collected. Preliminary synthetic technical model runs exist and remain under review; see `local-validation.md`. Complete approvals and lock the candidate build before any human study.

## Questions

- **RQ1:** Compared with a plain reflection template, does an evidence-checking workflow change the specificity and evidence alignment of learner reflections?
- **RQ2:** Can learners better identify unsupported, exaggerated, conflicting, or link-only claims after using the workflow?
- **RQ3:** What time and review effort does the workflow require, including reading, verification, edits, failures, and retries?

These questions do not assume a positive effect. A small classroom pilot cannot establish general or causal effects.

## Before recruitment or data collection

1. Obtain school approval and confirm competition eligibility and platform-reuse rights.
2. Establish age-appropriate consent/assent, withdrawal, retention, access, and deletion procedures with a named school data owner.
3. Do not send identifiable or private student evidence to an AI provider. For model tests, use the fixed synthetic cases or specifically authorized, de-identified data.
4. Freeze and identify the exact candidate build, prompt version, provider/model, and test rubric. Record the deployed/local status accurately.
5. Prepare an offline presentation backup. A video replay must be described as a replay, not offline inference.

## Small pilot design (optional; requires approval)

Target only if feasible: 8–12 students and 1–2 teachers. These are planning numbers, not recruited participants. Use two comparable reflection tasks and counterbalance order: half use a plain template first, half use the evidence/AI workflow first. Keep instructions, time limits, source types, and teacher rubric consistent. Reviewers should not see the tool condition where practical; record when writing style reveals it. Do not call the design fully blinded.

If no approved student pilot is possible, report a teacher/peer simulation as a simulation. Do not describe simulation as classroom evidence.

## Measures and recording

- Reflection rubric: situation specificity, individual contribution, evidence alignment, and reflection depth, each 0–3 (total 0–12). Preserve item-level scores and disagreement.
- AI literacy: five fixed scenario decisions before and after, with equivalent rather than repeated wording where possible. Record each response and error category.
- Task completion: numerator and denominator for card completion, decision explanation, and teacher review.
- Time: end-to-end minutes, including reading, wait, evidence checking, edits, errors, and retries.
- Claim support: teacher review per claim as `supported`, `partly_supported`, `unsupported`, or `not_checkable`; cite the source reviewed.
- Technical behavior: test ID, actual provider/model, prompt version, timestamp, latency if available, status/error, schema validity, cited source IDs, and human support judgment. Do not store secrets.

Use random study IDs, not names, in the analysis file. Store the re-identification key separately under school control, if one is needed at all. Do not put source text, emails, faces, or private notes in the shared evaluation CSV. Document missing data and failed runs; do not drop unfavorable cases silently.

## Analysis and reporting

For a small sample, report paired changes, medians, ranges, per-question errors, completion fractions, and all relevant failures. Include denominators. Separate structured-output validity from semantic support. Describe limitations, order/familiarity effects, reviewer disagreement, missing data, and any deviations. Avoid causal language and claims of universal improvement. A fixed synthetic test set can characterize tested cases only; it cannot prove general safety.

Suggested internal thresholds are planning gates, not results: at least 80% task completion with numerator/denominator disclosed; no unsupported factual claim left unflagged in the selected demo card; and no unauthorized source included in a request in the fixed privacy tests. Any threshold must be set before observing results and justified by the team.

## Files and audit trail

- `ai-test-cases.json`: fixed synthetic cases and expected review checks; not run results.
- `evaluation-template.csv`: blank recording template; no rows are prefilled with fictional outcomes.
- Keep actual outputs and human annotations in a separate access-controlled file. Link a run to its case ID and hash/version without publishing private inputs or credentials.
- Record protocol changes, failed runs, candidate versions, and deviations with dates and reasons.

The repository runner `scripts/evaluate-skill-ai.mjs` defaults to dry-run. A live run requires explicit opt-in and is bounded; the current initial plan is no more than 10 cases with one repetition. Outputs go under ignored `.tmp/skill-ai-evaluation-*/results.json`, with human review pending and no automatic semantic score. Supply credentials through the process environment only; do not print or copy `.env` contents. On the current Windows TLS setup, use `node --use-system-ca scripts/evaluate-skill-ai.mjs ...`. Confirm current runner options, provider/model, budget, and authorization before execution. See `local-validation.md` for the corrected v4 run and earlier attempts. Technical model outputs are not evidence of learning outcomes.
