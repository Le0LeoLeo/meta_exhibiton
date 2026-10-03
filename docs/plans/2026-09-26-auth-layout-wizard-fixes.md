# Login recovery, fullscreen routes and wizard localization

Date: 2026-09-26 (Hong Kong)

## Scope

The user requested fixes after a local project analysis, then explicitly selected local-only work. This change addresses the three confirmed user-facing defects. It does not attempt a broad 3D refactor or claim measured performance improvements.

- Authentication bootstrap failures now show a localized error and explicit retry. Successful retries retain the requested URL; confirmed 401 responses redirect to login with the complete return destination. An explicit login/logout or provider unmount invalidates late bootstrap results.
- The application layout reads `handle.layout` from matched routes. Demo, shared editor, public exhibition and creation routes use the existing fullscreen declarations; normal pages retain navigation and footer.
- The six-step creation wizard, its page-level actions and scene-budget guidance use English, Traditional Chinese and Simplified Chinese catalogs. Validation messages translate when the language changes without resetting the draft or current step.
- The artwork upload and CSV import steps also use the selected language, including status messages, accessible controls, import counts and structured validation errors. CSV parsing and import validation rules remain unchanged. User content and remote error details are not machine-translated.

Browser acceptance also exposed adjacent workflow defects: an outgoing protected route could mount its child during the transition to login and overwrite the original return destination, and a new exhibition could autosave before the user finished or dismissed the initial wizard. Reviewing the remaining wizard steps also confirmed that gallery creation unmounted the wizard, asynchronous patches replaced earlier draft updates, and opening the preview left no way back to publication.

The wizard now stays mounted across its own gallery creation, retains the gallery ID and refreshed media, and can reopen after preview. Its controls are disabled while a saved scene loads or an action is pending. The new-gallery route transition preserves the scene already in memory; unrelated saved exhibitions, shared routes and mobile viewing do not open this wizard. Initial autosave waits until the user enters the editor.

## Validation

- Focused auth: 15 tests passed.
- Focused layout and routes: 17 tests passed.
- Final focused wizard and creation page: 49 tests passed, including the complete create/layout/preview/return/publish flow, pending-load controls and unrelated-route exclusion.
- Focused upload and CSV import: 8 tests passed.
- Final type checking and full ESLint: passed.
- Server syntax (186 files) and avatar validation: passed.
- Final production build and isolated browser build: passed. Bundle gates passed for both builds (largest JS 707.7 KiB / 800 KiB; total JS 3627.9 KiB / 4800 KiB; CSS 326.2 KiB / 340 KiB).
- Full unit run: 310 files passed, one failed, one skipped; 2,483 tests passed, one failed and one skipped. The failure was the unmodified development-proxy large-JSON test's 3-second request timeout; the Redis integration test was skipped because no test Redis URL was configured. Proxy and media files passed unchanged in an isolated single-worker rerun (30 tests). A final isolated proxy rerun after browser acceptance also passed both tests. This is not reported as a completely passing `npm run check`. Final wizard lifecycle changes were separately covered by the 49 focused tests above.
- Final browser regression: all 10 cases passed on the rebuilt app after the full unit process completed. Login recovery, 401 return destinations, demo/shared/fullscreen transitions, English wizard validation, complete wizard publication, password reset, desktop/mobile creation/publication, lazy-route recovery and catalogue recovery all passed. Final screenshots were visually checked.

The first browser run passed six of nine cases, including the existing password recovery, desktop/mobile creation and publication, route chunk recovery and catalogue recovery checks. The new cases exposed the return-destination and premature-autosave defects above; the first protected-page navigation also stalled in the router loading fallback with pending assets. After correction and rebuilding, all nine cases passed. The final expanded run also covers the complete wizard lifecycle through anonymous viewing of its published artwork.

An intermediate expanded browser run passed the complete wizard flow, including anonymous loading of the uploaded image. It exposed a test-isolation issue: leaving that synthetic exhibition published increased the later catalogue test's expected count. The wizard case now unpublishes its own synthetic gallery in teardown. A separate failed login navigation showed successful 503/401 responses but three pending lazy assets, without a route commit or exit-animation state. That run is recorded as incomplete acceptance; the final 10-case rerun passed after the full unit process finished. Test assertions and timeouts were not relaxed.

Browser regression coverage uses the existing loopback-only acceptance runner with a new synthetic database and seeded example.invalid accounts. It checks real cookie recovery after an injected 503, a real 401 after test-cookie expiry, route layout transitions and the integrated English creation wizard. The complete wizard case performs real upload, media binding, gallery creation, persistence, publication and anonymous image loading. Only its AI response is deterministic. This validates the UI/persistence flow, not live-provider quality or WebGL rendering performance. Screenshots are visually reviewed.

## Deployment boundary

A read-only host check on 2026-09-26 found both `meta-exb-hk-production` containers stopped, while `home-memory-hk-production` is running. The public origin responds through the current service. The historical MetaEXB deployment instructions must not be used to replace that service without a new deployment decision.

The user explicitly requested finishing the local fixes without changing the existing website. No remote files, containers, data, certificates or network settings were modified. No Git commit or push was requested or performed.
