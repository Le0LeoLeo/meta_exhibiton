# Noto Sans TC interface font

Deployed and verified 2026-09-10 20:27 HKT.

The interface previously preferred installed system fonts and never downloaded Noto Sans TC. Self-hosted Google's v39 variable WOFF2 release (105 Unicode subsets, 4,194,768 bytes in total) with `font-display: swap`. The browser downloads subsets needed by page text; the verified homepage requested 16 font assets from the same origin. License and source URLs/SHA256 hashes are retained in `public/fonts/noto-sans-tc-v39/`.

Put Noto Sans TC first in `--font-sans-ui`, mapped Tailwind's `font-sans` to that shared stack, and updated the editor shell to use it. Existing serif exhibition headings, brand lettering and 3D text rendering are unchanged. Existing font weights are retained; the variable font supports 100–900.

Validation: 41 deployment/bundle tests passed; fresh Hong Kong Vite build passed. Total CSS is 316.8 KiB including Unicode declarations; the CSS budget was explicitly adjusted from 220 to 340 KiB with its boundary test. Other bundle budgets are unchanged. All JavaScript matches the favicon release after normalizing generated asset hashes. Excluded 34 unrelated, newly added template assets from this release while preserving them in the working directory.

Browser acceptance: desktop and 390px mobile homepage have no horizontal overflow; title serif stack retained. Local editor review renders its actual buttons and panel headings in the shared Noto stack. Production homepage font resources all use `https://metaexb.com/fonts/`; Traditional Chinese, Simplified Chinese and English switches checked without horizontal overflow and restored to Traditional Chinese. This is interface font acceptance, not a new authenticated editing or 3D text acceptance run.

All 219 public HTML/JS/CSS/font/license hashes verified over trusted HTTPS. Readiness, SPA routes, www redirect, healthy backend and website-only TCP 80/443 mappings passed. Only web service updated; backend image, private environment checksum/mode, runtime data, uploads and certificate volumes preserved. No Git commit/push.

- Release: `/home/admin/meta-exb-hk-fonts-20260910` (398 whitelisted files).
- Archive: `.tmp/hk-fonts-20260910.tar.gz`, SHA256 `b4c2d07e544055d31d41bcb362b414a1a19459720abee1c43e2d8d78c51b367b`.
- Local release: `.tmp/hk-fonts-final-release-20260910`; its frontend is `.tmp/hk-fonts-final-build-20260910/dist`.
- Web image: `sha256:d534aa5f1fd915249795cbcbafe3dc1458af1e827d9efca909e3c9f2266ce9ce`.
- Backup: `/home/admin/meta-exb-hk-production-20260904/source.pre-fonts-20260910`.
- Rollback: `sh /home/admin/fonts-rollback-20260910.sh production`.
- Deployment log: `.tmp/fonts-deploy.log`.
