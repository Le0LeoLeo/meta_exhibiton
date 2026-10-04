# Three-core integration — local validation

Date: 2026-09-26. Scope: modify the existing 3D exhibition, multiplayer and Agent workflows. No standalone CV module or new main product feature was added. No deployment or Git commit was performed.

## Implemented

- The existing painting inspector now edits optional contribution, process, outcome, reflection and up to five source records. Source edits remain local drafts until the author saves valid labels and HTTP(S) links. These are exhibition fields, not private CV records.
- The existing artwork detail dialog shows that work's context and sources, using the current scene item so remote edits update an open detail view.
- “Ask the Agent about this work” opens the existing Agent chat, closes the artwork modal and targets the selected work for the next question. The focus is scoped to the current Agent session, survives valid same-scene sync, and clears on chat closure or scene replacement. The current UI language is used.
- Scene import, persistence, undo and existing multiplayer operations preserve the context. Server validation bounds nested fields and rejects invalid links and oversized payloads.
- Agent requests include context for selected and nearby works. The prompt distinguishes creator self-report, supplied excerpts and unread source URLs; it does not fetch source links or query private CV records. This is not a factual-verification guarantee.
- The isolated preview runner now points its multiplayer client at the local proxy instead of falling back to port 3001.

## Tests

- Initial backend focused run: five files, 123 tests passed. After tightening source names to reject blank labels, the scene-schema file passed 26 tests.
- Additional real Socket.IO update-item regression: valid nested context acknowledged and broadcast to an observer; invalid nested URL rejected without broadcast. One targeted test passed (77 unrelated cases skipped for that targeted command).
- UI/catalog focused run: four files, 66 tests passed. Existing language assertions and current-item fixtures were updated to match the English default and canonical scene-item resolution without removing behavior assertions.
- Final combined frontend regression: six files, 89 tests passed (`.tmp/three-core-final-tests.log`): work-context normalization, Agent request serialization, scene save/import/undo, multiplayer bridge, artwork detail and Agent chat.
- Server syntax checks passed. Final typecheck, lint and production build passed (`.tmp/three-core-typecheck.log`, `.tmp/three-core-lint.log`, `.tmp/three-core-build.log`).
- Final bundle-budget check passed all five limits (`.tmp/three-core-bundle.log`).

Counts above overlap; do not sum them into a unique test total. No full-project regression pass is claimed.

## Actual browser observations

Used only the isolated local runtime and a newly created synthetic exhibition named “Three-core integration — synthetic example”. No existing user artwork was edited.

1. Selected an actual 3D artwork, edited its contribution through the inspector, and received the save-success notification.
2. Opened a second browser tab in the same exhibition. Both used the synthetic demo account; the editor showed “Connected · Collaborators 1”. This verifies separate live connections, not different-account authorization coverage.
3. Entered viewing mode in the second tab, selected the rendered artwork and confirmed its persisted contribution, process, outcome, reflection and source excerpt in the existing detail dialog.
4. Kept the second tab's detail dialog open while changing the outcome in the first tab. The second tab displayed the new outcome without a reload.
5. Clicked the artwork's Agent button. The detail modal closed and the existing Agent dialog displayed the correct current work title.

Local fixture metadata: `.tmp/three-core-fixture.json`. The synthetic exhibition remains available for review. No live model call was made; the isolated runtime has no model key. Prompt/request tests use mocked provider responses, so they do not establish live response quality. Earlier unrelated 3D upload/browser regressions remain recorded in the competition validation history and are not erased by this narrower successful flow.

## UI copy follow-up — 2026-09-26

- Updated homepage and education/community scenario copy around the same three core functions: 3D exhibitions, multiplayer and the exhibition Agent. Education now links to the 3D creation flow rather than the standalone CV route.
- Updated work-context guidance to explain how visitors and the Agent use the supplied context.
- Localized built-in editor item, theme and texture labels and Agent persona/status/prompt labels in English, Traditional Chinese and Simplified Chinese. Preserved saved identifiers, URLs, custom labels and user-authored content.
- Actual local-browser checks confirmed English homepage copy, education scenario text, editor theme/material options and Agent dialogue labels, including “Brief Reply”, “Warm conversation” and “Ready to begin”.
- Combined focused regression: 7 files / 75 tests passed (`.tmp/ui-copy-final-tests.log`). Typecheck, production build and all bundle budgets passed; scoped ESLint passed. Legacy Chinese-language test fixtures now set their language explicitly.
- Local preview only; no deployment or live model call.

## AI for Education positioning — 2026-09-26

Reviewed the official Macau competition rules at https://www.mcs.mo/articles/104 (AI for Education direction, working AI and educational testing requirements). Updated the English-first homepage, SEO, learning scenarios, template display labels, creation entry, registration benefits and learning guide to education-only positioning. Traditional and Simplified Chinese remain aligned. The three core functions remain 3D exhibitions, multiplayer and the exhibition Agent. Removed commercial-use promotions and placeholder resource sections; the guide now links to existing exhibition flows rather than standalone class/CV workspaces. Existing template identifiers and user content are preserved.

No automatic grading, measured learning gains or verified AI accuracy is claimed. Artwork demos remain explicitly identified as collection-based learning samples, not actual student submissions. UI copy changes do not establish competition readiness or replace live AI and learner testing.

Validation: six focused files / 54 tests passed, plus the final homepage/catalog rerun (17 tests; overlapping). Typecheck, build, scoped ESLint and bundle checks passed. Actual local-browser checks covered homepage layout, learning scenarios, education template entry and learning guide. Local only; no deployment.
