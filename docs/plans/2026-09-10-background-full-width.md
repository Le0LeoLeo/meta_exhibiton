# Full-width homepage background

Deployed and verified 2026-09-10 21:09 HKT.

The hero inherited a 1680px maximum width, clipping its decorative background into a centered rectangle on wide screens. Added `max-width: none` to the existing `.museum-home .home-showcase` rule in `src/styles/gallery-atmosphere.css`. The artwork/caption container retains its 1080px maximum and centered placement; mobile padding and animation behavior remain unchanged.

Fresh Hong Kong build and release bundle budgets passed. Normalized release comparison confirms only homepage CSS changed; all JavaScript, runtime and static assets match the previous atmosphere release. Browser verified the background starts at x=0 and reaches the document's right edge on desktop and a 390px viewport, without horizontal overflow. Production desktop measured 2032.8px background width (2033px rounded document width), centered 1080px artwork container. All 220 public HTML/JS/CSS/font/license hashes, trusted HTTPS, readiness and www redirect passed.

- Release: `/home/admin/meta-exb-hk-widebg-20260910` (440 whitelisted files).
- Web image: `sha256:5e3eebe66833a33669288d62e61948f5ef52ce1f1d843edd320f82494b3398e0`.
- Backend unchanged/healthy: `sha256:542698bfbded216582915d4f789f025b328abb5b6b754e5d4e577552eb7ead7f`.
- Backup: `/home/admin/meta-exb-hk-production-20260904/source.pre-widebg-20260910`.
- Rollback: `sh /home/admin/widebg-rollback-20260910.sh production`.
- Archive SHA256: `2070b36e345c05e001fe5a9c0ef0c8ef73645ede1b3f57f322f33986d524ff7e`.
- Private environment checksum/mode, data, uploads, volumes and certificates preserved. Only website TCP 80/443 published. No Git commit/push.
