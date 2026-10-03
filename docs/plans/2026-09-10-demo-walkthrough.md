# Enter official exhibitions on foot

Deployed 2026-09-10 14:50 HKT. All three eleven-artwork demos now offer an Enter exhibition button. A full-viewport accessible modal starts visitors inside the entrance. WASD/arrow keys move relative to heading, dragging turns the view, and four holdable direction buttons support phones and keyboard activation. Exit walkthrough or Escape returns to the selected artwork. Devices without WebGL retain 2D viewing and disable walking entry.

The walkthrough reuses the existing read-only Room/ExhibitItem renderer through an optional camera-controls slot in GalleryScenePreview. It does not import a demo into the editor store, join multiplayer, create visits or write drafts. The underlying preview canvas unmounts while walking. The dedicated demo movement helper is intentionally limited to these rectangular rooms with no interior obstacles: normalized diagonal speed, capped delta and 0.65m wall clearance. Input and canvas listeners clean up on exit; blur/visibility changes clear held input.

Validation: 40 focused tests passed, plus three input lifecycle tests (43 total). Tests cover movement direction, diagonal speed, frame-gap clamp, all wall boundaries, keyboard/accessible button movement, blur and unmount cleanup, typing exclusion, modal entry/exit for all demos, selected artwork preservation and unchanged editor scene. Typecheck/lint/build and release bundle gate passed; the additional input test file also passed scoped lint. Browser visually verified entrance rendering, drag-to-turn, direction controls, exit and Escape, plus the 390px mobile viewport. Live browser verified entering the garden modal, four direction buttons and return to eleven artwork choices.

Isolated Hong Kong staging passed TLS readiness and all frontend/image hashes; stopped afterward, preserving volumes. Non-dist files match existing runtime. Promoted only accepted web; backend, environment hash, runtime data/uploads/certificates/volumes unchanged. Website publishes only TCP 80/443, backend no ports. Public HTTPS readiness and www redirect passed.

- Release: .tmp/hk-walk-demos-release-20260910 (280 files).
- Archive SHA256: a4dbe1a8febe98d091420a6de49be49dd887d84ea5d0b1e352aef7fc0c535065.
- Remote: /home/admin/meta-exb-hk-walk-demos-20260910.
- Web: sha256:2229328038422e2c6ec0a29b16c8bc7f7c98851f513bafa5090e67ec10127736.
- Unchanged app: sha256:badcd2f7df8427a6abf0a86254deae93182a31054acde15dba2e11f70cd30090.
- Prior dist/manifest: /home/admin/meta-exb-hk-production-20260904/source.pre-walk-demos-20260910.
- Prior web tag: meta-exb-hk-production-web:pre-walk-demos-20260910.
- Logs/helpers: .tmp/walk-demos-*. No Git commit/push.

Public verification: 2026-09-10T06:50:41.198Z; 165 route/asset hashes passed.
