# Museum design across the application

User selected homepage direction A and requested the same treatment on all remaining pages.

## Implementation
- Global warm paper/ink/vermilion tokens, serif display headings with sans-serif UI text. Light is the first-visit default; saved dark preferences remain supported.
- Shared META EXB navigation and compact footer load on direct visits to every page. All destinations remain accessible through the menu; primary desktop links stay focused.
- Public exhibition index uses each exhibition's own cover/artwork, honest missing/broken image fallback, editorial metadata and the existing entry dialog. Removed the permanently empty upcoming section.
- Virtual gallery places usable templates before explanatory feature sections. Login/register have a split editorial introduction and accessible original forms.
- Solutions, support, resources, legal documents, profile/admin, competitions, boxes, graduation, growth and souvenir pages use restrained corners, surfaces and typography. Removed decorative gradients/lifts from page surfaces and the 404 page.
- 3D editing and floorplan controls use warm dark panels, compact typography and vermilion selection/action accents. Canvas materials, geometry and interaction logic are unchanged. 2D viewing and loading/error states follow the site palette.
- Shared buttons use native interaction without decorative movement; page-specific business logic remains intact.

## Validation so far
- Full `npm run check` passed at the first completed rollout: 266 suites passed/1 skipped; 2080 tests passed/1 skipped. JS/CSS/model budgets passed (CSS 214.4 KiB / 220 KiB). Log `.tmp/museum-all-check.log`.
- After follow-up refinements: typecheck/lint passed; 18 focused gallery entry/register/support tests, 20 exhibition viewing/cover/theme tests passed. Added cover-failure/entry regression and persisted theme tests.
- Browser: public exhibition real covers; desktop/mobile login; 390px gallery page and join dialog; light/dark management, folder dialog, boxes, graduation, live local 3D editor and floorplan controls. Browser resize is not a physical-device test.
- Isolated synthetic review runtime `.tmp/museum-review-20260910`, local API5290/frontend5291. Public-content frontend5189 proxies production read endpoints; no production test accounts or user-content changes.

## Deployment status
Complete: integrated museum frontend deployed and independently verified at 11:40 HKT, 2026-09-10. The first whitelist bundle `.tmp/hk-museum-pages-release-20260910` was uploaded to `/home/admin/meta-exb-hk-museum-pages-20260910`. Its staging preflight correctly refused a non-frontend mismatch in `galleryFolderRepository.js`: another active task was adding folder sharing. No staging source or live containers were changed by that attempt. Do not promote this obsolete bundle.

The final build includes the subsequent light default, 404/loading states and editor panel refinements. The integrated release preserves the other task's folder-sharing work and original runtime/secrets/volumes. No Git commit/push.

The final museum build `.tmp/hk-museum-pages-final-build-20260910/dist` and the folder-sharing release `.tmp/hk-folder-share-build-20260910/dist` were compared across all 150 static files: byte-identical, no differences. The folder-sharing task deployed that integrated release; no duplicate frontend deployment was performed. Final budget passed: total CSS 208.6 KiB / 220 KiB; JS 3528.4 KiB / 4800 KiB. Integrated full check `.tmp/folder-share-full-check.log`: 269 suites passed/1 skipped, 2090 tests passed/1 skipped, all other checks passed. Public verification is recorded below.

## Final public verification
- `.tmp/museum-live-verify.log`: nine public SPA routes returned 200 with exact expected HTML, and seven primary JS/CSS assets matched the final build SHA256. `/api/ready` ready; www301 to the matching apex path. Independent curl: TLS verification0, HTTPS200.
- HTML SHA256 `2d58899b7198eeded1d795a0483b7abd71f7f106ece332f74410ed538d52eb7d`; global CSS `/assets/index-Bo9QKCz-.css`, SHA256 `ea11a6ceecf0c8a1ee633e27108ebea4c4544d7e0b77e92b32709099e592caf2`; exhibitions `/assets/Exhibitions-DkdTETy8.js`, SHA256 `0cef83ce7e3c3cb3a36140c7dc4886b25976ca54fbf49e6dc0916cc9c4b6a96c`.
- Production app image `sha256:b544daba84765baa6ac553cad267e24b2f82048319ef089d2c1a0d9d9d96a3c2`; web `sha256:868894bda66718bfc68dddc8ae518a1b4a210fe40906e6881a97b83cf979d37c`. Public bindings only80/443. Deployment/backup evidence in the folder-sharing task's `.tmp/folder-share-production-deploy.log` and `.tmp/folder-share-production-backup.log`.
- Production backup `/home/admin/meta-exb-hk-production-20260904/backups/runtime-pre-folder-share-20260910.tar.gz`, SHA256 `bef751324113195464ac37eacdb832f10b58b4fbb715a490f727637bfaddf075`; restore verification passed, mode600. Runtime, secrets, certificates and volumes preserved.
- Real browser confirmed published exhibition covers and new shared shell on HTTPS. Light/dark and390px layouts verified. No production content created or modified by this UI task.
- Synthetic local user `museum-review-user` and its auto-created test gallery cleaned through the account settings flow; SQLite read-only verification confirmed zero matching users. Local API5290/frontend5291 stopped. No Git commit/push.
