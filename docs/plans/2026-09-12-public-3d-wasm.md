# Public 3D WebAssembly recovery

**Goal:** Restore direct public exhibition 3D rendering without enabling JavaScript eval or inline scripts.

**Cause:** Public exhibition HTML is served through Express for sharing metadata. Its `script-src 'self'` policy blocked Three.js/physics WebAssembly initialization, although the same SPA reached through static pages could render.

**Changes:** Add only `'wasm-unsafe-eval'` to `server/config/middleware.js`. Keep the existing script origin, inline-script, object, frame, base URI and other restrictions. [MDN documents this narrower WebAssembly permission](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src#unsafe_webassembly_execution). Configure Troika's supported `useWorker: false` mode before the first text request: its dynamically generated blob-worker probe can succeed synchronously despite an asynchronous CSP rejection, leaving text and the enclosing scene suspended. Keep optional external environment lighting inside its own Suspense/error boundary so loading/failure does not hide the gallery.

**Validation plan:** Real HTTP middleware regression, relevant server/route tests, fresh HK build/budget, browser-run CSP probe with WebAssembly allowed and JS eval blocked, actual 3D scene under the middleware policy, isolated HK acceptance, production deployment with prior source/data backups, public HTTPS/header/assets and real 2D-to-3D/3D-to-2D browser checks. No Git operations or production data edits.

## Execution, 2026-09-12 18:40 HKT

- First CSP-only release removed the WASM error, but real browser verification still found a dark scene. That was not counted as a successful fix. Local isolation showed an empty room rendered, while adding the paintings suspended the whole scene. Troika's main-thread mode restored the paintings and Chinese/numeric labels under the same strict policy.
- The optional HDR source independently returned HTTP 403 to a direct request. Environment tests cover pending, resolved and failed lighting without hiding scene siblings.
- Final focused verification: 7 files / 152 tests passed; typecheck, scoped runtime lint and server syntax checks passed. Fresh HK build and bundle whitelist passed (459 release files). No dependency changes.
- Real browser CSP probe: WebAssembly instantiated successfully; JavaScript eval and Function constructor remained blocked. No worker/blob or arbitrary JavaScript permission was added.
- Final release `/home/admin/meta-exb-hk-wasm3-20260912`; archive SHA256 `a18cbc68a57b7fa3302ca61dd9053c5d9d217faf61ab6547aedbc4d9ce07f666`.
- Isolated HK HTTPS policy, teacher/student/visitor workflow, restart persistence and independent restore passed. Restored volume `meta-exb-hk-wasm3-restore-20260912` retained. Exact synthetic accounts cleaned; isolated services stopped with no public ports.
- Existing production project updated with environment, data, uploads and certificates preserved. Source backup `source.pre-wasm3-20260912` and data backup `backup-wasm3-20260912` retained under `/home/admin/meta-exb-hk-production-20260904/`; the earlier CSP-only backup remains too.
- Final app image `sha256:e37947139efdf897f5e36cbe8d0090d77d62e0c2e60b826bad2254267ff1c49c`; web image `sha256:68225f211ff9b6887d27350aae3910713ffd84902e590a4a7ec6453bd89f0526`.
- Production readiness, trusted HTTPS, www redirect, 345 public file hashes, backend manifest and SQLite integrity passed. Only website ports 80/443 exposed.
- Public desktop browser visibly rendered the room, both paintings and their labels; error/warning log empty. 3D → 2D → 3D worked. Existing open documents must be fully refreshed or reopened to receive the new policy and scripts.
- Public 390 × 844 browser viewport also visibly rendered the painting, label, room and touch controls; errors/warnings empty and document content/viewport widths both 390px. This is browser viewport acceptance, not a physical-phone performance measurement.
- Text typesetting uses the main thread to retain the strict policy; physical-device FPS and very large text-heavy scenes have not been benchmarked in this fix.
