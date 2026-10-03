# Existing-sign builder acceptance

The reported request grouped existing works into history, present and future wall sections. A fixed-position section heading collided with an existing text item, rejecting the entire batch. The UI still offered an unchanged fallback as an applicable preview. The user explicitly required completed testing before release.

## Changes

- Find free heading positions around existing displays without moving or replacing existing text, including locked text. Lower artwork rows within floor clearance when needed to avoid existing headings. Reject genuinely unavailable space atomically.
- Use the renderer's default 0.42 text size and actual backboard width/height, plus a conservative wrapped-text envelope, for spatial planning and preflight. Remove the previous 8 m width cap.
- Preserve validated semantic placements through legacy normalization; otherwise the old normalizer forces paintings back to y=2.5. Normalize only remaining legacy edits so the result does not include warnings about changes that were never applied.
- Tell the model to add physical dividers only when explicitly requested; preserving a central aisle does not imply creating partitions.
- Block applying fallback results with zero applied operations, and show an explicit generation-not-completed message in all three languages.

## Release gate evidence

Initial candidates were not deployed. Browser screenshot review caught underestimated text bounds. A Chinese-heading regression caught normalization undoing a safe lower row. Real model acceptance caught an unsolicited divider and, subsequently, obsolete adjustment warnings. These failures were fixed before the final candidate was tested.

- Final focused suite: 124 tests passed across 14 files, covering locked English/Chinese headings, repeat arrangements, impossible capacity with no partial mutation, media preservation, preflight, operation application, builder service/agent and UI.
- Three final browser cases passed: unmocked frontend payload through HTTP/session persistence; rejected preview disabled followed by successful grouping/apply/save/published artwork rendering with an existing locked title; touch read-only viewing. Browser generation is deterministic; actual-model tests are separate. The verified canvas contains 49,910 green artwork pixels; screenshot review confirms separated heading and existing title.
- Three consecutive real Qwen calls used a synthetic scene with nine works and an existing locked Chinese heading, and the request “把現有作品分成歷史、當代、未來三個牆面展區，加上展區標題，保留中央通道。” All chose the grouping operation, produced three new headings, retained media and the original text, and passed wall-display preflight without warnings. Times: 10,401 / 10,160 / 10,855 ms. Synthetic calls used the candidate image in disposable containers, without production runtime volumes. This is not a guarantee for every layout or future model response.
- Typecheck, lint and server syntax checks passed; final changed backend files also passed targeted lint. Fresh Hong Kong frontend build and all bundle budgets passed. Frontend was unchanged during subsequent backend corrections; final backend files were staged afresh with the verified frontend.
- Isolated Hong Kong auth/CSRF, media ownership, save revisions, WebSocket origin/isolation/reconnect, restart persistence and independent restore passed. 16 synthetic clients, 80 accepted operations, p95 acknowledgement 43 ms; no production capacity claim. Only synthetic accounts from this run were removed; staging stopped.

## Release

Candidate `/home/admin/meta-exb-hk-builder-sign4-20260914`; archive SHA256 `dd083604b2ccc09d77b0f82168f0348199c5330372bd2fb2ed7a2fcbca528ac9`.

Exactly four backend runtime files changed: `exhibitionSceneOperations.js`, `exhibitionScenePreflight.js`, `exhibitionSceneService.js`, `exhibitionSpatialTools.js`; plus the validated frontend. No Git actions.

Production updated after all gates above passed. Environment checksum, runtime data, certificate volumes and prior backups preserved; containers healthy, readiness passed, only website ports 80/443 published. Backend manifest and read-only SQLite integrity passed. Trusted public HTTPS, www redirect, all 345 public file hashes and private/missing exhibition metadata exclusion passed.

App image: `sha256:6ce8b60335f1b5add510b42825c1624883f81d0ed38687f635e871fbaa585c6c`; web image: `sha256:684611e21cf0eac0a0a3257395cef74044fe928293a2d51ab8bb8b205ac8eeb9`.

Backups in `/home/admin/meta-exb-hk-production-20260904/`: `source.pre-builder-sign4-20260914` and `backup-builder-sign4-20260914/runtime.tar.gz`; prior app/web image tags end in `:pre-builder-sign4-20260914`. Independent synthetic restore volume `meta-exb-hk-builder-sign4-restore-20260914` retained.

Evidence: `.tmp/builder-sign4-{regression,browser,live-model,hk-accept,production}-20260914.log`; browser images under `.tmp/browser-results/editor-ai-builder-AI-build-3c201-pplies-only-on-confirmation-webgl/`. Earlier sign/sign2/sign3 logs retain failed-candidate evidence.
