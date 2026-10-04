# Local implementation and validation record

**Scope:** local working-tree implementation only. No Hong Kong deployment or production validation was requested or performed. This file records preliminary technical evidence, not a classroom study or a final release report.

## Implemented locally

- Graduation skill AI requests preview the five experience fields and require explicit source selection. The server validates the saved card revision and selected source IDs, sends selected text evidence, and treats links as unread rather than fetching their contents.
- The graduation flow records a student's decision reason and checked sources. The v4 evidence gate flags problematic suggestions for human review; it does not certify claims as true.
- `/competition-demo` is an English orientation page with fixed fictional examples and links into the existing authenticated graduation workflow.
- A bounded synthetic evaluation runner and `npm run test:competition` were added. The runner is dry-run by default and places reports under ignored `.tmp/` paths.
- The standalone personal CV suggestion path was not extended with graduation's selected-evidence workflow. Do not imply that the CV path has the same per-source controls.

## Corrected v4 synthetic technical run

Report: `.tmp/skill-ai-evaluation-1790332651672/results.json`  
The corrected v4 report records 10 cases: 9 `ready`, 1 `fallback`, and 0 runtime errors. `N01` returned fallback after about 16.6 seconds. `C01` and `C02` returned clarification questions without suggestions; `M02` produced a suggestion flagged `needs_review`; `L02` cited its unread link source but the suggestion was also flagged `needs_review`. All ten entries have `humanReview.status: pending`. This is runtime behavior only, not a semantic pass rate or a claim that the outputs are safe or correct.

The preceding v3 report is retained at `.tmp/skill-ai-evaluation-1790331923077/results.json` as history, not accepted as the final evidence set. Its text cases still exposed that runtime success is not enough:

- `C01` retained “I interviewed six volunteers” as a suggestion despite supplied fictional notes distinguishing six planned interviews from four completed interviews; it asked a useful clarification question, but the draft still repeated the unresolved claim.
- `M02` suggested “I presented our findings to the school” although its only supplied fictional source described draft slides and no presentation record. It asked for clarification, but did not gate the unsupported draft.
- The v3 `L02` case is not valid link-only evidence: the evaluation runner represented its fixture with `kind: url`, which did not match the application's `kind: link` source type. Do not use that result to make a claim about link handling.

The v3 disputed text outputs prompted the stricter v4 evidence gate. The fixture mapping has since been corrected and three regression tests were added. The corrected link-only `L02` result confirms that this run exercised the link case, but its human review remains pending. Earlier v3 and pre-correction v4 link-test outputs are invalid evidence for link behavior. Do not count runtime-ready cases as passing semantic checks or treat the gate as proof of general safety.

The focused regression and demo tests reported for this change total 5 passed (3 fixture/evidence regressions plus 2 demo-page tests). Other final test and build checks are recorded by the supervising agent below.

## Earlier failed attempts retained

- `.tmp/skill-ai-evaluation-1790331376499/results.json` — initial TLS certificate failure.
- `.tmp/skill-ai-evaluation-1790331625518/results.json` — requests timed out at the 15-second default-thinking timeout.

These are operational failures and remain part of the run history. For the current Windows TLS environment, use Node's `--use-system-ca` flag. Keep provider credentials in environment variables only; do not read values into reports, command transcripts, or screenshots.

## Human study and submission status

No student or teacher participants are reported as recruited. No consent or school approval is reported as collected. No learning outcome, classroom effectiveness, adoption rate, or validated semantic accuracy is claimed. Competition eligibility, permission to submit an extension of the existing platform, student contribution details, and final organizer requirements remain for the school and student team to confirm.

## Final validation record

Verified final focused checks (2026-09-25):

- Graduation backend and existing competition repository: 5 files, 30 tests passed. The repository also passed its 3 tests separately.
- Graduation frontend: 4 files, 13 tests passed. The existing `VirtualGalleryCreate.test.tsx` passed all 28 tests separately, including its autosave case.
- Evaluation runner and competition orientation: 2 files, 5 tests passed.
- `npm run test:competition`: 2 browser tests passed against the final browser build, using the real HTTP API and SQLite database with a deterministic synthetic model fixture. Covered selected-source exclusion, decision reasons, teacher approval/publication, public/private separation, English mobile layout, and authentication. This is integration evidence, not a live-provider quality score.
- Final `npm run typecheck`, `npm run lint`, and `npm run check:server` completed successfully (197 server JavaScript files).
- Final `npm run build` and `npm run check:bundle` passed all bundle limits. The earlier full check also passed the avatar asset validation.

The broad browser run completed with 12 passed, 2 failed, and 1 intentionally skipped live-provider case. The two failures were existing 3D builder cases (uploaded video visibility and preview confirmation timeout).

The broad unit run took 1,548.57 seconds and reported 302 files passed, 7 failed, 1 skipped; 2,378 tests passed, 9 failed, 1 skipped; plus 8 worker-startup timeout errors. It began before the final edits, and its graduation route, service, evidence-policy and error-message failures contain older implementation behavior mixed with updated tests. Final focused runs passed those files. Gallery autosave and competition repository also passed separate reruns. These focused passes do not turn the original broad run into a passing run.

The unchanged Vite proxy test still exceeded its 3-second response timeout in isolation; a separate 10-second diagnostic received the complete 1,048,587-byte body in about 6.8 seconds. Do not describe the broad regression suite as green or this diagnostic as satisfying the 3-second test.

All 8 files that failed to start workers passed a final single-worker rerun: 78 tests passed in 23.49 seconds (`.tmp/competition-worker-retest.log`). This covers release recovery, agent behaviors, exhibition scene/builder services, studio canvas, avatar setup, floor variation, and inspection readiness.

The focused 3D builder rerun also failed both cases: `film.webm` was not found after upload, and the preview case raised `UNSUPPORTED_FLOOR_PLAN` from its scene-operation fixture (wall sections require one centred rectangular room). These paths are outside the graduation reflection change and remain unresolved regression limitations; no timeout was relaxed to manufacture a passing result.

Read-only follow-up found that the upload test authenticates through `page.request` but does not install the token into the browser application's in-memory auth; the upload handler returns early without that token, and the failure screenshot still shows “Log In”. The preview test changes `roomSize.width` to 24 without updating existing floor-plan elements; the spatial helper rejects the supplied plan. The exact offending floor-plan element was not captured, so that part remains an inference. Follow-up should fix the browser test's authentication setup and capture/align its scene fixture before treating these tests as release evidence; neither fixture was altered in this task.

Local logs: `.tmp/competition-final-browser.log`, `.tmp/competition-final-static.log`, `.tmp/competition-final-build.log`, `.tmp/competition-full-check.log`, `.tmp/competition-full-browser.log`, and `.tmp/competition-webgl-retest.log`. Browser screenshots are under `.tmp/competition-browser-results/`; the evidence preview was visually inspected after the final run. These ignored local artifacts are not an exported submission package.

All results above are local-only; no production deployment or classroom study is implied.

## Follow-up: English workflow and remaining browser regressions

The default UI and prerendered homepage now use English; explicitly saved language preferences still work. The English workflow browser test now starts without forcing a saved locale, signs the student and teacher in through the login form, and performs teacher skill approval, project approval and archive publication through the interface. Both competition browser tests passed (`.tmp/followup-english-browser.log`), including the mobile orientation/login boundary. The teacher page screenshot was visually inspected. These checks use synthetic accounts and a deterministic provider, not human participants.

The Vite proxy test passed both tests without changing its 3-second deadline (`.tmp/followup-proxy.log`). This supersedes the earlier isolated timeout for this follow-up run only; the earlier failures remain recorded.

The builder tests were corrected to use actual UI sign-in and to update room geometry consistently when resizing their fixture. Later runs progressed beyond the original blockers, but still encountered total-test timeouts and one mobile login navigation timeout (`.tmp/followup-builder-browser.log`, `.tmp/followup-builder-complete.log`). Successful media 200/206 responses were present; canceled media requests and a single early `readyState=0` sample do not establish a playback defect. Subsequent final results must be recorded separately rather than deleting these attempts.

The [classroom pilot checklist](./classroom-pilot-checklist.en.md) is prepared for the student, teacher and observer roles, with blank observation fields and stopping conditions. No classroom participants or results have been added.

Follow-up code review corrected two mixed-language English catalog sentences, localized the four main 3D Add buttons and untitled/unknown-author display fallbacks, and retained user-authored artwork content. The login return-path validator now accepts only canonical UUID share paths for this new case, while rejecting extra segments, queries/fragments, encoded separators, and external destinations. Existing gallery-entry and authentication continuity tests passed: 2 files, 55 tests. Locale/catalog and exhibit-focused checks passed: 4 files, 16 tests. Final type checking and lint also passed after correcting a translation hook's component scope and memo dependencies.

The browser fixture now performs a normal UI login directly back to its share path. It avoids duplicate navigation and waits for DOM readiness followed by the existing explicit UI/WebGL assertions. The complete builder test uses a 1280 × 800 desktop viewport; the preview test remains 1100 × 800 and touch remains 390 × 844. Existing timeouts and rendered-pixel thresholds are unchanged. The four English Add button labels are now asserted in the complete builder browser flow.

The candidate rerun (`.tmp/followup-candidate-builder.log`) passed the API payload and mobile read-only cases. The complete builder produced its verified image/video screenshot and the preview workflow reached public rendering, but both cases exceeded their total test deadline during browser shutdown/data cleanup. Cleanup was therefore moved into a test-scoped fixture, retaining the same close/delete operations and deletion assertion. This uses Playwright's [separate standard teardown budget](https://playwright.dev/docs/test-timeouts); it does not increase interaction or pixel-check deadlines, but does give cleanup its own budget. The preceding failed run remains in the record.

A later run (`.tmp/followup-final-builder.log`) still failed: two login-navigation waits expired, and the preview request contained the application's default five-room scene rather than the saved nine-work fixture. Trace inspection confirmed the actual input IDs (`default-*` instead of `work-0`…`work-8`), so the floor-plan failure cannot be attributed only to room-resize fixture dimensions. Editor visibility must not be treated as saved-scene readiness. The browser checks now wait for the loaded exhibition title and assert original item IDs in the model request; the product's loading/error protections are being corrected separately. These failed attempts are not passing acceptance evidence.

### Saved-scene guard and subsequent acceptance

Saved/shared routes now start in a loading state and mount the studio only after their own scene has loaded. Route identity prevents the previous scene from remaining editable during navigation. Load errors block both automatic and manual persistence; the error panel remains visible instead of exposing the default scene. The focused gallery suite passed 30/30 tests, including delayed loading and invalid saved JSON. Type checking and lint passed. Production build and all five bundle limits passed (`.tmp/followup-guard-production.log`, `.tmp/followup-guard-bundle.log`).

The final English competition workflow rerun passed 2/2 browser tests (`.tmp/followup-guard-competition.log`), with synthetic student/teacher accounts, actual API/database persistence and deterministic AI responses.

The guarded 3D run (`.tmp/followup-guard-builder.log`) passed API and mobile viewing, failed two desktop cases, and intentionally skipped the paid live-provider case. The upload trace showed sequential successful uploads exceeding the single 15-second wait for the last filename; the fixture now checks each uploaded filename in order. The preview trace confirmed correct original work IDs and a correct second response, but that response took 31.139 seconds (about 21.068 seconds waiting and 10.071 receiving) despite a 9,477-byte payload. The asynchronous preview visibility wait was explicitly increased from 15 to 45 seconds for software-WebGL acceptance; the overall 120-second case deadline remains unchanged. This is a changed test allowance, not evidence that latency was fixed. The earlier statement about unchanged deadlines describes the earlier attempts only. Subsequent results are recorded separately.

Latest 3D acceptance (`.tmp/followup-async-builder.log`): **1 passed, 3 failed, 1 intentionally skipped**. The API payload case passed. The complete case timed out waiting for the first uploaded filename; the preview case progressed through preview and apply but its saved-scene HTTP read failed with a socket hang-up; the touch case timed out at login/viewer readiness. The prior mobile pass does not supersede this latest failure. Local response delays and connection interruptions remain unresolved; the evidence does not isolate their full cause or establish a fully passing 3D release. No further deadline increase was made. The core English competition workflow remains independently verified by the 2/2 run above. No production deployment, real classroom study, or competition submission was performed.
