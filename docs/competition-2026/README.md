# 2026 education competition working pack

This folder contains English preparation materials for MetaEXB Learn. Local graduation-flow implementation and preliminary synthetic model testing now exist in the working tree. This remains a **working pack, not a submission-ready entry**: there has been no production deployment, approved human study, consent collection, learning-outcome evaluation, eligibility confirmation, or competition submission.

## Files

- `scope-and-contributions.md` — separates existing platform work, proposed changes, student work to document, tool assistance, rights, and consent.
- `demo-content.en.md` — synthetic English discussion cards; fixed practice text is not live model output.
- `evaluation-protocol.md` — proposed evaluation procedure and reporting limits.
- `local-validation.md` — local implementation scope, preliminary model-test failures, and current validation boundary.
- `classroom-pilot-checklist.en.md` — role-based English pilot procedure, blank observation fields, and stop conditions; no participant results are included.
- `evaluation-template.csv` — blank recording header only. Add actual observations only after approvals and study activity.
- `ai-test-cases.json` — 25 fixed synthetic test inputs across five categories. It contains expected review checks, not model outputs or test results.
- `project-introduction-scaffold.en.md` — short English introduction with explicit placeholders.
- `research-report-scaffold.en.md` — report structure with evidence and limitation prompts.
- `demo-script.en.md` — timed presentation outline with live-result capture requirements.
- `submission-checklist.en.md` — school review, rights, evidence, file, and upload checks.

## Before using this pack externally

The team and school must confirm participant eligibility, permission to extend/reuse the existing MetaEXB platform, material rights, age-appropriate approval and consent, the exact candidate build, and current organizer requirements. Replace placeholders only with documented facts. Mark incomplete sections “not completed”; never turn a target, synthetic example, expected threshold, or planned study into a result.

Do not add personal or identifiable student data to the fixed test set, repository, or public report. Do not commit model credentials, raw private evidence, or unreviewed outputs. Any live-model evaluation is separate work, requires a bounded approved run plan, and must record failures as well as successes.

The bounded runner at `scripts/evaluate-skill-ai.mjs` defaults to dry-run (`node scripts/evaluate-skill-ai.mjs`). Live evaluation must use the documented `--live` option, an approved limit/repeat count, and credentials supplied only through the process environment; never copy credentials from `.env` into a command, log, or report. For the current Windows TLS environment, invoke Node with `--use-system-ca`, for example `node --use-system-ca scripts/evaluate-skill-ai.mjs --live --limit 10 --repeats 1`. The runner writes local output under ignored `.tmp/skill-ai-evaluation-*/results.json` and leaves semantic review pending. See `local-validation.md` for the corrected v4 run and earlier attempts. Review the runner's current options before use.

The focused competition test suite is invoked with `npm run test:competition`. Record its final result against the exact local candidate in the supervising agent's final validation record; no pass is implied by this guide.
