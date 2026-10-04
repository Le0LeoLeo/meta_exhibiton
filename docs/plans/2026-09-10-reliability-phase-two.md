# Reliability phase two

Scope: public exhibition summaries with bounded keyset pagination; clearer upload → preview → publish guidance and clipboard failure recovery; mobile viewport and constrained-network browser acceptance.

Preserve existing gallery detail endpoints, covers, manual publication, draft URLs and advanced editor. Exclude competition host galleries as before. Validate page boundaries, malformed cursors, scene omission, retry without losing loaded cards, and mobile overflow. Automated mobile checks exercise the existing 2D fallback; they do not establish physical-phone 3D frame rates or replace user studies.

Validation: focused SQL/API/UI tests, full npm check, isolated browser acceptance, fresh Hong Kong whitelist build, isolated staging and restore verification, accepted images deployed to existing production, public HTTPS/hash checks. Preserve all unrelated workspace edits, secrets, runtime volumes and previous backups. No Git commit or push.

Implementation:
- Public endpoint defaults to 12 summaries (maximum 48) and returns an opaque continuation cursor. SQLite orders by publication/update time and ID, uses an additive index, and excludes competition hosts. Full scenes and share metadata are absent from summaries; detail responses remain intact. Existing covers are retained, including a legacy artwork fallback.
- The catalogue appends pages, deduplicates IDs and preserves displayed cards during loading or retry. Its primary creation callout opens quick creation.
- Quick creation shows upload, preview and publication steps in three languages, explains that preview is private, and exposes a selectable URL if clipboard access fails.
- Existing inline cover images are preserved; this release does not migrate them to a thumbnail service or claim a fixed byte budget per card.

Local validation:
- `npm run check`: 2,180 tests passed, 1 external Redis test skipped; typecheck, lint, server syntax, assets and production build passed.
- Bundle budgets passed: largest JS 707.7 KiB, total JS 3579.8 KiB, CSS 219.5 KiB.
- A repository test uses 1 MB scenes and verifies that three returned summaries stay below 2 KB, retain covers, exclude private/competition galleries, and paginate correctly after insertion/withdrawal.
- Read-only pre-release production sample: 2 exhibitions, 4,052 response bytes, both carrying scenes. This small current catalogue is not a scale benchmark.
- Five browser workflows passed. The mobile workflow was then strengthened with the Pixel 7 user agent/touch configuration and passed again, including absence of the desktop editing link. Both reviewed mobile screenshots fit 390×844 without horizontal overflow.
- Synthetic mobile network baseline: 150 ms latency, 200,000 bytes/s download, 50,000 bytes/s upload; image visible plus screenshot in 5,442 ms. This is one Chromium 2D sample, not a speed guarantee or a real-phone 3D benchmark. Evidence is under `.tmp/browser-results/reliability-Touch-phone-cr-3249f-drawal-mobile-slow-network-/`.
- Fresh Hong Kong whitelist: 287 files; archive SHA256 `4250136212a07b4859db9daa285f58514026dd392dcff097de490f8eb9ec48ca`. The host archive hash matched before extraction. Actual HK build passed all bundle budgets.

Hong Kong acceptance and deployment, 2026-09-10 17:13 HKT:
- Isolated staging passed public pagination over 13 newly created synthetic galleries, unique traversal, covers, malformed cursor rejection and unchanged full detail. Existing auth/CSRF/media permissions/revision conflict/multiplayer/restart checks passed.
- The running staging backend and all 113 served HTML/JS/CSS files matched the final manifest. Production deployed exactly these accepted images:
  - App: `sha256:542698bfbded216582915d4f789f025b328abb5b6b754e5d4e577552eb7ead7f`
  - Web: `sha256:d4c129244cf6234de317e4ad91159816b19743267d7b556ad29546e8fd6e5bca`
- Production backup `/home/admin/meta-exb-hk-production-20260904/backups/runtime-pre-discovery-20260910.tar.gz`: SHA256 `5b676ab9104e578c4e2a4d3e0b8ee5bb3f4efbf79dd058abaef95b7bda992614`, mode 600, 28,769,540 bytes. Restored into the separate `meta-exb-hk-production-restore-discovery-20260910` volume; archive comparison and SQLite integrity passed.
- Public HTTPS, ready, www redirect, invalid pagination/reset inputs and all 113 HTML/JS/CSS hashes passed. Existing two public cover hashes are unchanged. Their list response is now 906 bytes versus 4,052 before (77.6% smaller for this sample).
- Existing production environment checksums and volumes were preserved; only TCP 80/443 are published for the site. Staging synthetic users/galleries/media counts are zero and its containers are stopped. Local browser acceptance listeners are closed. No Git commit/push.
- Prior source is `source.pre-discovery-20260910`; prior image tags are `meta-exb-hk-production-{app,web}:pre-discovery-20260910`. Rollback helper: `sh /home/admin/discovery-rollback.sh production`. Additive SQLite index may remain when rolling back; runtime data is not restored over live data.
- Final whitelist directory: `.tmp/hk-discovery-release-20260910`; remote `/home/admin/meta-exb-hk-discovery-20260910`. Logs: `.tmp/discovery-check.log`, `.tmp/discovery-browser.log`, `.tmp/discovery-mobile-final.log`, `.tmp/discovery-stage-acceptance.log`, `.tmp/discovery-production-backup.log`, `.tmp/discovery-public-verify.log`.

Status: completed and deployed. Physical-phone 3D testing, real-user studies and inline-cover migration remain separate future work.
