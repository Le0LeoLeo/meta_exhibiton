# MetaEXB brand icon integration

Brand implementation and acceptance COMPLETE. No further icon edits or user approval are pending. Awaiting verification on the fresh integrated Hong Kong release; do not wait for additional brand work before building that release.

## Changes
- Added the approved generated gallery-door/M icon at `public/brand/metaexb-icon-v1.png`, preserving the original artwork.
- Navigation and footer use the icon beside the existing META EXB wordmark, with a vermilion background for contrast in both themes.
- Browser favicon and Apple touch icon reference the versioned PNG.
- Navigation uses a smaller icon and wordmark on mobile. At widths of 360px or less, the icon remains visible and the home link retains its META EXB accessible name.

## Verification
- Navigation, homepage and Hong Kong packaging tests: 42 passed before the responsive adjustment; navigation/homepage rerun: 11 passed after it.
- Typecheck and focused component lint passed again after the responsive adjustment.
- Hong Kong frontend build and all bundle-budget checks passed.
- Shared integrated test run subsequently passed 273 suites / 2103 tests, with one Redis suite/test skipped (`.tmp/motion-integrated-tests.log`).
- Browser visual checks: desktop light/dark themes, footer, 390px and 320px; both brand images load, correct favicon URL, no horizontal document overflow at mobile widths.

## Deployment status
- Superseding update: deployed in the fresh integrated UI release at 12:24 HKT on 2026-09-10; see 2026-09-10-museum-motion.md for staging acceptance, image hashes and rollback. The pending notes below are historical.
- Pending: the second icon build includes concurrent animation and bulk-import changes. The bulk-import task reports its code checks passed but its real folder-import browser acceptance is unfinished; it has not deployed. Do not promote this intermediate icon release as an independently validated production build.
- The animation task also finished without deployment because of that same pending bulk-import acceptance. Production remains unchanged. Local icon preview is available at `http://127.0.0.1:5391/` while this task's preview process is running.
- The earlier whitelist archive uploaded to `/home/admin/meta-exb-hk-icon-20260910.tar.gz` has NOT been activated. It predates the mobile adjustment and must not be used for final deployment.
- No Git commit or push; existing production data and configuration untouched by this task so far.
