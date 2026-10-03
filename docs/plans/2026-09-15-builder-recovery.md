# Builder recovery after production browser failures

Final status, 2026-09-15 02:11 HKT: recovery5 is deployed and verified. The actual signed-in production exhibition reached a passing draft (technical 95, curatorial 100) after one explicit follow-up to fix two pre-existing overlapping signs. No draft was applied to the user's saved scene. This was not a first-attempt automatic pass.

User case: six zones A–F, ten exhibits per zone and some decoration. Reproduce with actual provider before changing behavior; preserve existing media and do not apply failed drafts.

1. Diagnose the six-zone planning failure with synthetic scene input and provider response/validation evidence.
2. Separate user brief from technical revision feedback so errors never become exhibition copy. Distinguish failed planning from unavailable visual review and never show a failed version as a generated preview.
3. Align the visual review capability list with complete editor commands. Repair automatic issues even if a separate issue needs manual input, while preserving that manual issue and blocking unsafe application.
4. Resolve the concrete six-zone plan failure without claiming invented original artwork or silently lowering requested counts. Add regression tests for sixty exhibits, field compatibility, failed revisions and retained valid versions.
5. Validate focused tests/build and actual browser/provider generation→inspection→revision. Complete isolated HK acceptance before release and then repeat the user's request on the production web UI.
6. Record exact results and any limits; do not equate a fallback, HTTP success, or partial layout with completion.

## Implemented behavior

- Added one validated `build-exhibition-zones` command. The model specifies named zones and counts; deterministic expansion creates connected annex rooms, spaced displays, readable section signs, opposing lighting, benches and plants. Original rooms/items remain unchanged. The six-zone case creates sixty new display positions in six annex rooms, in addition to the original room/works. It is not sixty unique original artworks: supplied media are reused as explicitly numbered copies, or local demonstration positions are labelled. The preview statement and section inventories are derived from the applied result.
- Kept the original brief separate from internal revision instructions, and fixed complete-editor review capability descriptions. Mixed manual/automatic issues no longer cause an immediate stop before automatic repairs.
- Planning failures with zero operations have their own stop state and failed-result heading; they are not presented as a visual-review outage. Success notifications require an actual passing review.
- Expanded inspection coverage to sixteen images, including both opposing display walls in six annex rooms. Reviews are split into at most four concurrent batches of four images, with room-scoped inventories and a preservation brief for original rooms outside verified new section inventories. Aggregate scores retain the lowest batch score and all blockers. Thresholds were not lowered.
- Builder requests have a 120-second client limit, covering one bounded planning correction and multi-view review. Vision requests have no automatic retries and a maximum 75-second provider limit. The default vision model is `qwen3.6-plus`; explicit deployment model overrides are preserved. Official capability reference: [Alibaba Cloud vision models](https://www.alibabacloud.com/help/en/model-studio/vision-model).

## Evidence before deployment

- Baseline full3 six-zone synthetic real-provider case returned fallback with zero operations; retained in `.tmp/builder-six-baseline.log`.
- First candidate generated sixty positions but real browser review exceeded the old client limit. A subsequent full-image review incorrectly counted five plus five as missing exhibits and conflated retained original-room content with new-zone requirements. Those failures are retained in `.tmp/recovery-first-browser`, `.tmp/recovery-second-browser`, `.tmp/recovery-third-browser` and corresponding logs. One earlier run performed seven real-model repair operations but did not pass final review; it is not counted as successful acceptance.
- Final real-model/browser six-zone run passed generation, sixteen rendered view captures, visual review (technical 85, curatorial compliance 100, no blockers), explicit Apply, database save and original-item preservation. Synthetic seed had one original image; saved result had sixty new copies plus that original and seven rooms. `.tmp/recovery-live-browser4.log` and `.tmp/recovery-passed-browser` contain evidence. This was a first-review pass, not evidence that every possible automatic repair succeeds.
- Four ordinary browser regressions passed: real API relative-media fallback boundary, image/video/model upload and full editor command application/save/render, protected-preview behavior and touch read-only access. Screenshots inspected.
- Final recovery2 complete check passed 2,446 tests with one Redis integration skip, plus typecheck, lint, server syntax and production build/bundle checks. A second real-model browser run against the packaged candidate detected low lighting, applied an actual environment-brightness repair and passed subsequent review, Apply and save. Evidence: `.tmp/recovery-live-candidate-browser.log` and `.tmp/recovery-candidate-browser`.

## Candidate

Release `builder-recovery2-20260915`; archive SHA256 `1855d293b887b9bfe8f89ee28af92b3adf48cccc95fef7bb67c53963b9c2ea70`. Fresh Hong Kong frontend build and five whitelisted server-file changes only. Isolated staging restart, independent restore and bounded collaboration passed before production deployment. Production app `sha256:6194517ab74b84872b9bd1fb2f60088f1977dea5e94adce9e346096ce661dd70`; 345 public hashes, readiness, HTTPS and read-only SQLite integrity verified. Existing environment, runtime data, certificates and backups preserved.

## Production reproduction and geometry correction

The actual production editor still rejected the exact six-zone request after recovery2. The original east-wall painting was cut by a new central doorway, and lower room height caused all six north titles to overlap their light strips. No failed draft was applied; the user's original six items remained. The successful synthetic cases had used a six-metre room and only a north-wall original, so they did not cover these conditions.

Recovery3 changes the new entrance's door offset after checking native wall topology against existing displays, without moving original rooms or artworks. Titles and artwork rows now adapt to room height with caption/backboard clearance below the light strips. A wall with no clear entrance fails explicitly. Shared wall-surface construction lives in the floor geometry module to allow preflight reuse without a circular import.

Added regression fixtures for 4.5, 5 and 6 metre heights with a locked four-metre east-wall painting, plus a fully obstructed wall rejection. All 62 focused service tests passed. The optional real-provider browser case now uses a five-metre room and the obstructing east-wall original. Full checks and this actual-model browser run are in progress at this writing.

Candidate `builder-recovery3-20260915` contains exactly four backend changes; all frontend bytes are identical to recovery2. Archive SHA256 `4fbd1efea92234c320e7a65d15769cd4b216944bd0e59a6997ed2b7b95b0e77a`. Isolated restart/restore acceptance passed. It is not yet deployed at this writing.

Recovery3's real-model five-metre/east-art scene passed generation and visual review (95/100), but Apply exposed a separate transport bug: sending all new items individually exceeded the scene-event rate limiter and left a partial local scene. This is a failed end-to-end acceptance, retained in `.tmp/recovery3-save-failed-browser`. Bulk local edits now use one acknowledged, version-checked scene replacement and wait for outstanding operations. No event limit was relaxed.

A repeat with bulk synchronization retained all 61 paintings but exposed a save/poll race: a background GET could observe this client's newly committed database revision before the save response returned, falsely displaying a conflict. Refresh now defers while a local save is pending; genuine later competing revisions still trigger the existing protection. Evidence retained in `.tmp/recovery4-save-race-browser`; this is also not counted as a passing end-to-end run.

Manual screenshot inspection found blank Chinese backboards despite a passing model assessment. Network evidence showed successful Unicode font downloads, but capture did not wait for glyph generation. Inspection now waits for text geometry and explicitly fails if it remains unavailable, rather than reviewing blank signs. This demonstrates why model scores alone are not acceptance.

Recovery3 complete checks passed 2,450 tests with one Redis integration skip, typecheck, lint, server syntax, build and bundle budgets. Subsequent bulk synchronization, deferred save polling and text-readiness changes passed 56 focused tests. Final browser acceptance and a fresh HK frontend release are in progress.

Final synthetic real-provider browser run passed in 1.2 minutes: `.tmp/recovery7-live-browser.log`, screenshots and sessions in `.tmp/recovery7-passed-browser`. Six annexes contain ten paintings each, saved scene has 61 paintings including the unchanged original, all seven rooms persist, and the 16-view model review passed. Manual inspection confirmed the Chinese signs rendered and the original east painting was clear of the new doorway. A previous test-only Vite proxy truncated large gallery JSON after saves (ECONNRESET / unexpected JSON end); the harness uses a persistent upstream connection, and persisted-scene assertions now read the authenticated isolated API directly. Browser interaction still exercises its normal frontend API.

Final candidate `builder-recovery5-20260915`, archive SHA256 `5b1e7fb2a5c8bffcc427084b53cf3cdc548ab96ef379f8144a8aa80bcae9017c`, contains the four geometry backend files and a fresh frontend with bulk synchronization, save-poll deferral and actual text readiness. Typecheck/lint, fresh HK build/bundle and repeated 56 focused tests passed. Isolated restart, independent restore and collaboration acceptance passed. Production deployment remains pending at this writing.

All four ordinary browser regressions passed after using the isolated API for persisted-scene assertions: `.tmp/recovery5-browser-direct-api.log`, `.tmp/recovery5-regressions-passed`. Image/video/model asset editing and save, preview preservation, site-relative payloads and touch read-only viewing were covered. Video diagnostics reported readyState 0 in this run; this does not certify video playback.

Recovery5 is deployed to the existing Hong Kong production project. App image `sha256:37aa921f546737a75bd928db2946160227aba3b50993b51367045355398ca1c7`; web image `sha256:c5e1eabac2404fbb32c5f22d9b10e99628f95de1dfe2fae06b9bc3c5d616ffc3`. Previous images/source and a stopped runtime backup were retained under `pre-builder-recovery5-20260915` / `backup-builder-recovery5-20260915`. Production environment, data and certificates preserved. Public trusted HTTPS, readiness, www redirect, 345 exact public file hashes and read-only SQLite integrity passed (`.tmp/recovery5-{production,public,integrity}.log`). Only ports 80/443 are public.

The exact brief has been submitted again in the signed-in production editor for 歷史博物館. Generation now succeeds with six zones and sixty new positions; actual production visual review is still running at this writing. Original six works have not been replaced or saved over during this UI test.

Production UI final result: the first run created six zones/sixty new positions but stopped after a quality regression, restoring the better draft. Its remaining blocker was the pre-existing overlap between `text-7js0ej3w` and `text-hl9tcppr`. A follow-up requested preserving the six-zone layout and original content while separating those signs; the Agent moved one item and passed the next review, improving technical 70→95 and curatorial 78→100. Version 4 is current, Apply is enabled, and the visible change summary reports 102 additions (sixty paintings plus forty-two signs/decorations), one moved item, changed floor plan, zero removed original works and preserved media. The user's saved scene still shows six original works. The inspected browser tab remains open with the reviewed draft; Apply/save was tested only in the isolated synthetic exhibition.

## Limits

The agent builds a reviewable draft using supplied media; it does not invent sixty authentic works. Visual review is a bounded model assessment and can vary between runs; it is not a guarantee of whole-route accessibility or curatorial factual correctness. Model execution summaries are shown, not private chain-of-thought. Existing conversation history remains browser-local.
