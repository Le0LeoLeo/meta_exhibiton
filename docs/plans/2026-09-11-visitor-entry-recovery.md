# Visitor entry recovery

Distinguish unavailable public exhibitions (403/404) from transient load failures with localized, actionable copy. Retry the existing read in place instead of reloading the document. Allow leaving during API loading, and switching to 2D while 3D prepares or after an import failure when a parsed scene remains available. Localize mode-switch labels. Preserve routes, access checks, request payloads and rendering architecture.

Validation completed 2026-09-11:
- 31 page/API/catalog tests passed, including in-place retry, 403/404 copy, leaving a pending load and switching to readable 2D artwork after a scene import failure. Typecheck and lint passed.
- Fresh Hong Kong build and bundle budgets passed; 447 whitelisted release files. No non-frontend runtime differences from the prior production manifest.
- Isolated browser fixture used synthetic 503 then success responses: clicking retry displayed the exhibition and artwork without reloading. Synthetic 404 showed the unavailable message; the return action navigated successfully. A 390×844 screenshot confirmed readable copy and contained actions. This was a browser viewport check, not a physical phone test; the fixture disabled WebGL, and scene-import failure recovery was covered by component tests.
- Production web-only deployment and public verification completed 19:45 HKT: 161 public file hashes, template content types, trusted TLS, readiness, routes and www redirect passed. Backend image and environment checksum unchanged; only website ports 80/443 published. No production data mutations or full test-suite run.

Release archive SHA256: `bb8a8795f8502cd3512c5f8b7ad1dc9f74b7fb8f4043d85ef6784ed95480445e`.
Web image: `sha256:fbf478c4b03dc6c36a1db97918af2542146741f8490286d81220148c2b99e4d5`.
Previous source backup: `/home/admin/meta-exb-hk-production-20260904/source.pre-visitor-entry-ux-20260911`.
Rollback if required: `sh /home/admin/visitor-entry-rollback.sh production` (retains failed source and restores the prior web image).
