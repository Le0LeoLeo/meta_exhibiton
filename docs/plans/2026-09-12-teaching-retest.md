# Teaching workflow retest — 2026-09-12 18:04 HKT

User requested another test run. This run made no application or production configuration changes.

## Passed

- 9 focused test files, 64 tests: submission/review, permission isolation, versions, question/reply moderation, curation/evaluation, HTML export and 2D initialization.
- Actual HK isolated teacher/student/visitor HTTP workflow, including returned/resubmitted work, confirmed guides, evaluation privacy, publication, question/reply conflicts and history.
- Restart of the isolated app followed by persisted history, release, evaluation, questions, personal export and SQLite checks.
- Synthetic staging accounts/dependent records cleaned; staging containers stopped. Production user data unchanged.
- Production runtime manifest, SQLite integrity, HTTPS/readiness/www redirect and 345 public asset hashes matched the deployed release.
- Browser at 390px: graduation login return path, exhibition list and actual published gallery in `?mode=2d`. Both artwork images loaded (natural widths 1080 and 810); no canvas in 2D. Content/viewport widths both 375px with scrollbar: no horizontal overflow.

## Failed: public 3D rendering

**Follow-up:** This historical failure was repaired and deployed in the [public 3D recovery](2026-09-12-public-3d-wasm.md), including actual scene/painting/label browser verification. The retest findings below describe the earlier release.

On the published gallery linked from the public exhibition list, switching from 2D to 3D displayed the participation choice and mobile controls, but the scene remained blank/dark after selecting individual viewing. A subsequent screenshot still showed no scene. Switching back to 2D restored the artwork list and images.

The browser logged `WebAssembly.instantiate()` blocked by `script-src 'self'`. Its stack includes the Three.js loader and avatar preload. `server/config/middleware.js:23` sets this restrictive script policy. `deploy/hongkong/routes.caddy` proxies `/exhibitions/:id` HTML through Express, exposing the policy to the public viewing page. This is evidence of a production 3D loading failure; passing API/unit/build checks did not cover it.

Do not describe this retest as an overall pass. Follow-up implementation needs a narrowly scoped solution for the required WebAssembly and a real public-page 3D regression check, without enabling arbitrary JavaScript evaluation. This run neither relaxed policy nor deployed a fix. Actual physical-device FPS and external AI quality remain unmeasured.
