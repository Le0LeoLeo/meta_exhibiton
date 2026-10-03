# Browser favicon completion

Deployed and verified 2026-09-10 20:11 HKT.

The homepage already referenced the new brand PNG, but the historical `/favicon.svg` still contained the old cyan M and `/favicon.ico` returned SPA HTML. Replaced the historical SVG with a self-contained wrapper around the approved artwork, added a multi-size ICO, and exported opaque 16px/32px PNG icons plus a 180px Apple icon. The HTML now references versioned icon URLs to encourage refresh of cached icons. Existing browser bookmarks or pinned shortcuts may still retain their own cached artwork.

`scripts/generate-brand-icons.mjs` reproducibly exports these browser formats from the unchanged original brand image. Navigation/footer artwork is unchanged.

Verification: 41 packaging/bundle tests passed; fresh HK build and bundle budgets passed; 291-file whitelist release. Release comparison with the previous navigation-centering release found only six changed/new files: index.html and five icon files. ICO directory/signatures and PNG dimensions/opacity validated. All 112 public HTML/JS/CSS hashes and all five icon hashes/content types matched over trusted HTTPS using the system CA store. Readiness, SPA routes, www redirect, backend health and website-only TCP 80/443 mappings passed.

Only web service updated. Backend image, environment checksum/mode, database, uploads, volumes and certificates preserved. No Git commit/push.

- Archive: `.tmp/hk-favicon-20260910.tar.gz`, SHA256 `3e916f728c55e0aeb8a8e774ccfd14329ead4d20553a8113699b3c20e3fbeaac`.
- Release: `/home/admin/meta-exb-hk-favicon-20260910`.
- Web image: `sha256:d77c0bf2a1cd5280e958f69c7084461dcba922d0ac00577fa49db5afbb21c04a`.
- Backup: `/home/admin/meta-exb-hk-production-20260904/source.pre-favicon-20260910`.
- Rollback: `sh /home/admin/favicon-rollback-20260910.sh production`.
- Deployment log: `.tmp/favicon-deploy.log`.
