# Gallery animated backgrounds

Deployed and verified 2026-09-10 21:04 HKT.

Homepage hero now has slowly drifting warm window light, gold/sage washes and thin gallery-like contour arcs. The creation section has terracotta/sage pigment washes. CSS transform/opacity animations run on 18–26 second alternate cycles; existing copy, art and controls stay above non-interactive, aria-hidden layers. Light and dark themes and compact layouts are supported.

`GalleryAtmosphere.tsx` observes each background and pauses CSS animation when offscreen or the tab is hidden. It tracks live reduced-motion preference changes, cleans up observers/listeners, and retains static decoration if observation is unavailable. Existing homepage reduced-motion CSS disables animations entirely. No new dependency, video, canvas render loop or external asset.

Validation: 46 existing homepage/deployment/bundle tests passed, TypeScript and scoped ESLint passed. Fresh HK build/bundle passed: total JS 3606.8 KiB and CSS 324.4 KiB. Release comparison found only Home JS/CSS changed after normalizing generated asset hashes; all runtime and static assets match the latest templates release. Desktop light/dark visuals checked; browser confirmed hero running/creation paused at the top, then hero paused/creation running after scrolling. Reduced-motion and visibility listener paths were reviewed in code, not OS-level emulation.

Production: web-only build/recreation, backend unchanged and healthy. 220 public HTML/JS/CSS/font/license hashes verified over trusted HTTPS, ready/SPA/www checks passed; only website TCP 80/443 host mappings. Private environment checksum/mode, data, uploads and certificates preserved. No synthetic production data or Git commit/push.

- Release: `/home/admin/meta-exb-hk-atmosphere-20260910` (440 whitelisted files).
- Local build/release: `.tmp/hk-atmosphere-build-20260910/dist`, `.tmp/hk-atmosphere-release-20260910`.
- Archive SHA256: `9fa83f8bac80b18214980d63226f2e2305fdcb25ceebafa2e2fbc2226f49d28b`.
- Web: `sha256:2daae406a308b0aecfa98d03633b17017a2fc53a3c3bb674e3e41c54ddd196b0`.
- Backend: `sha256:542698bfbded216582915d4f789f025b328abb5b6b754e5d4e577552eb7ead7f`.
- Backup: `/home/admin/meta-exb-hk-production-20260904/source.pre-atmosphere-20260910`.
- Rollback: `sh /home/admin/atmosphere-rollback-20260910.sh production`.
- Public verifier: `.tmp/atmosphere-20260910/public-verify.mjs` with Node `--use-system-ca`.

Production browser follow-up: both background layers loaded, hero running, and 390px viewport measured no horizontal overflow. Temporary viewport override reset. This is browser viewport acceptance, not physical-phone performance testing.
