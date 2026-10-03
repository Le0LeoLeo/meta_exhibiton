# Exhibition builder stability: central-room grid

User regression: 「我想要主展間在中間，其他展間圍著，像九宮格一樣的佈局」 returns an unchanged Qwen fallback. Continue testing and fix reproducible causes before release.

1. Repeat the exact request against the deployed provider/runtime using a synthetic populated six-annex scene. Retain model output, validation failures and timings; no production exhibition is applied or overwritten.
2. Distinguish provider timeout/invalid structured output from geometry rejection. Verify whether room relocation also carries its contents and preserves the primary coordinate anchor.
3. Implement the smallest reusable correction supported by evidence, with deterministic tests for populated layouts, locked originals, repeated requests, door/display collisions and input immutability.
4. Repeat real-provider cases and actual browser rendering, follow-up edits and saved-scene verification. Test retained previews, failed revisions and cancellation without counting fallback as success.
5. If app behavior changes, run focused/full checks appropriate to scope, package only approved files, complete isolated HK restart/restore acceptance, deploy and verify public hashes/integrity. Re-test the user's case in the production UI and report exact limits.

Baseline starts from recovery5 app `37aa921f546737a75bd928db2946160227aba3b50993b51367045355398ca1c7`. Existing source/data/environment/certificates remain untouched during baseline tests.

## Stability test results, 2026-09-15

**Status: grid arrangement fails acceptance. Diagnosis completed; correction and release remain outstanding. No application changes or deployment in this test run.**

Three sequential real-Qwen calls used the deployed image in disposable read-only containers, with synthetic input and no production runtime volume. Input was the previously saved synthetic six-zone exhibition: seven rooms, 61 paintings, 103 items. The exact Chinese request above was supplied with `allowDestructive:false` and complete edit mode. These are independent repetitions from identical input, not successive revisions of a user's exhibition.

| Run | Seconds | Reported source | Actual result | Acceptance |
| --- | ---: | --- | --- | --- |
| 1 | 44.808 | qwen | Deleted 102 existing generated items and six annex rooms; rebuilt eight annexes, 33 total paintings | Fail |
| 2 | 41.901 | qwen | Deleted the same 102 existing generated items and six annex rooms; rebuilt eight annexes, 65 total paintings | Fail |
| 3 | 46.532 | fallback | Zero operations; input scene preserved exactly; same generic revision-failed warning as screenshot | Fail |

Both nominal successes placed all nine rooms on the same Z coordinate, at X = 0, 20, ..., 160. They were linear arrangements, not a central-room grid. Both had zero geometric preflight issues and no warnings. Thus model source, nonzero changes and geometric preflight alone are insufficient success criteria. No full visual reviewer was invoked on these probe results; this does not establish that the later visual review would approve them.

Code evidence:

- `server/services/exhibitionZoneLayout.js` constructs annexes in an eastward row. The model selected this tool despite the requested grid.
- `server/services/editorSceneCommands.js` permits deleting items with generated ID prefixes even with `allowDestructive:false`. This allowed previously generated scene content to be replaced during a layout-only request. The locked original painting remained intact.
- `editorScenePreflight.js` checks spatial validity, not compliance with requested layout or retention of prior section counts.
- The third run's provider log contains no response. Its duration is close to the configured 45-second request limit, but timeout is only a hypothesis: the generic fallback suppresses the underlying reason. Do not present timeout as confirmed.

Existing regression checks rerun:

- 110 tests across 14 files passed (scene service, commands, geometry, zones, builder service and frontend builder helpers).
- Four existing browser regressions passed in 2.4 minutes: real HTTP payload with relative media URL; controlled command plan with media upload/material/geometry/render/save; preview retention and explicit apply; touch read-only access.
- Inspected the rendered media and preview screenshots. The synthetic image and video were visible; video diagnostics reported readyState 4, unpaused and advancing playback time. These browser regressions use controlled plans where specified and do not prove live-model grid generation or repair.

Evidence: `.tmp/grid-baseline.log`, `.tmp/grid-baseline/result-{1,2,3}.json`, `.tmp/grid-baseline/provider-{1,2,3}.log`, `.tmp/grid-baseline/spatial-audit.json`, `.tmp/stability-focused.log`, `.tmp/stability-browser.log`, `.tmp/stability-browser-evidence/`. Reproduction helpers: `.tmp/run-grid-baseline.mjs`, `.tmp/audit-grid-baseline.mjs`; the first invokes paid real-provider requests through the isolated probe. No user exhibition was applied or saved.

Required before claiming grid stability: a room arrangement operation that carries existing contents, preserves section identities/counts and respects locked items; validation against the requested layout; distinguishable provider failure diagnostics; repeated real-provider grid/follow-up tests and browser visual/apply/save acceptance. If eight surrounding annexes are generated, review coverage must also cover all eight (the current 16-view cap can omit the eighth annex). This run makes no production-readiness claim for those outstanding changes.
