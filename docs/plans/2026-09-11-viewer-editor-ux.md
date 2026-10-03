# Viewer and editor UX

Scope: build on the already deployed creation UX without changing persistence, networking, authentication or scene geometry.

- Identify the editor mode and explain the next action based on whether an object is selected.
- Explain Esc to release the mouse during desktop viewing; wrap the guidance and separate it from avatar controls at narrower widths.
- Allow failed artwork images to retry in place, preserving the artwork and original media URL.
- Provide English, Traditional Chinese and Simplified Chinese copy.

## Verified 2026-09-11 17:27 HKT

- 46 targeted viewer/editor/catalog tests passed; viewer/catalog checks repeated after final copy adjustment (27 passed). Typecheck and lint passed.
- Actual editor components inspected in a local fixture; desktop and 800px viewing guidance inspected. At 390×844 the artwork retry remains usable with no horizontal overflow. Fixture deliberately uses a missing image; successful retry is covered by the component regression test. No production user data created.
- Fresh Hong Kong build and whitelist passed (447 files). Bundle gates passed: largest JS 707.7 KiB, total JS approximately 3620.5 KiB, CSS 329.8 KiB.
- Web-only production deployment completed. Non-dist release hashes match prior production; backend image and environment checksum/permissions preserved. Backend ready and web healthy; only TCP 80/443 publicly mapped.
- Verified 161 public HTML/JS/CSS/template hashes, trusted HTTPS using the system CA store, readiness, SPA routes and www redirect. Production demo visibly includes the new Esc guidance.
- Archive SHA256: `e751941aaa539578a4977d497ab5985db5ea423b2738505ddab44273bd7e2a9d`.
- Web image: `sha256:1dd33d729570788686edc8e23fd7fb35b90922387ef1fff33896c1d42305c4f0`.
- Source backup: `/home/admin/meta-exb-hk-production-20260904/source.pre-viewer-editor-ux-20260911`.
- Rollback before a subsequent release: `sh /home/admin/viewer-editor-ux-rollback-20260911.sh production`.
- Local evidence/helpers: `.tmp/viewer-editor-ux-20260911/`. No full regression suite or physical mobile device acceptance in this narrowly scoped UI change.
