# Glass navigation

Deployed and verified 2026-09-10 21:12 HKT.

Changed the shared public navigation to translucent frosted glass in `src/styles/museum-motion.css`: 22px backdrop blur, 145% saturation, subtle reflective gradient, fine border and inset highlight. Light/dark base opacity is 68%/64%; browsers without backdrop-filter receive a 96% surface fallback. Navigation layout, routes, buttons and existing positioning are unchanged.

Fresh HK build and bundle budgets passed. Normalized manifest comparison confirms only shared CSS changed; all JavaScript, static assets and backend runtime match the prior full-width release. Browser verified computed blur/transparency in dark and light modes and no desktop horizontal overflow. All 220 public HTML/JS/CSS/font/license hashes, trusted HTTPS, readiness and www checks passed.

- Release: `/home/admin/meta-exb-hk-glassnav-20260910` (440 files).
- Web image: `sha256:2f463ab442e94530aa8ea0d5170c44a5d147a5629ac877ab7ecb65d2fc0a6710`.
- Backend remains healthy: `sha256:542698bfbded216582915d4f789f025b328abb5b6b754e5d4e577552eb7ead7f`.
- Backup: `/home/admin/meta-exb-hk-production-20260904/source.pre-glassnav-20260910`.
- Rollback: `sh /home/admin/glassnav-rollback-20260910.sh production`.
- Archive SHA256: `610155e399181669983b23ef109a421921ccd51d790aefd39988d2c988424ce5`.
- Web-only update preserved environment checksum/mode, data, uploads and certificates. Website host mappings remain TCP 80/443. No Git commit/push.
