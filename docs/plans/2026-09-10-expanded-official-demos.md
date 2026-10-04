# Eleven artworks in every official exhibition

Deployed 2026-09-10 14:38 HKT. Each of classics, garden and landscape now contains exactly eleven distinct artworks. Preserved the original three works in each and added eight, totalling 33 exhibition placements / 31 unique collection images across all three exhibitions. Added 24 verified Met Open Access images and three-language titles, artist attribution and original viewing prompts. Source references and original dimensions are in docs/demo-artwork-sources.md.

Replaced the single-row layout with four works on the back wall, four on the right and three on the left. All face inward, remain within the room and have at least 0.5m clearance between adjacent frames. Original room footprint and entrance remain intact. Thumbnail grid is two columns on phones, four at small widths and six on desktop; thumbnail images load lazily. Counts appear in exhibition headers and homepage cards. Updated classic and landscape descriptions to reflect the expanded scope.

Validation: 30 tests across five suites passed, including per-exhibition uniqueness, local asset presence, all three translations, frame bounds/orientation/spacing, navigation to the eleventh work, end-button disabling, source link correctness and switching/reset. Typecheck/lint and fresh Hong Kong build passed; actual release bundle gate and whitelist passed with 278 files. Browser checked side-wall 3D rendering, last artwork selection, loaded 2D image and phone layout (390px viewport, document 375px). Live browser verified all three exhibitions have eleven artwork buttons.

Isolated staging passed TLS readiness and every HTML/JS/CSS/JPG hash, then stopped with volumes retained. Non-dist files matched existing runtime. Promoted accepted web only; no backend restart, accounts or user data changes.

- Release: .tmp/hk-expanded-demos-release-20260910.
- Archive SHA256: c1384407014a8f85c52ae8bdb9b05c7f84510a222b3b96f1cb2e61193f08b786.
- Remote release: /home/admin/meta-exb-hk-expanded-demos-20260910.
- Accepted web: sha256:adff081b7f679db9c9f29c2a04baf9f8c5701abdea8341363b51f61ee2ba89c0.
- Unchanged app: sha256:badcd2f7df8427a6abf0a86254deae93182a31054acde15dba2e11f70cd30090.
- Previous dist/manifest: /home/admin/meta-exb-hk-production-20260904/source.pre-expanded-demos-20260910.
- Prior web tag: meta-exb-hk-production-web:pre-expanded-demos-20260910.
- Public HTTPS readiness/www redirect and all route/assets verified; app and gateway running, website publishes only TCP 80/443. Environment hash unchanged; runtime data/uploads/certificates/volumes retained.
- Logs/helpers: .tmp/expanded-demos-*. No Git commit/push.

Public check timestamp: 2026-09-10T06:38:45.388Z; 163 route/asset checks passed.
