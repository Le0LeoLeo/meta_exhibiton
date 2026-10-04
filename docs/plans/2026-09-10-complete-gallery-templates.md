# Complete gallery templates implementation plan

**Goal:** Make all six advertised exhibition themes usable, while preserving the blank starting point.

**Architecture:** Keep the existing catalogue and scene snapshot loader. Complete the missing factories, enrich existing scenes with curated display positions and real model content, and expose the same catalogue in My Exhibitions. Use bundled assets for reliable template loading; preserve editor and persistence behavior.

**Tech stack:** React, TypeScript, React Three Fiber, Three.js, Vitest.

## Analysis

- Seven catalogue entries; only modern art, technology and history have factories.
- Fashion, photography and cars are disabled with Coming Soon; My Exhibitions has a separate four-entry allowlist.
- Existing themed rooms have sparse back-wall-only pictures and empty product/sculpture pedestals.
- Wood/metal settings inherit the paint texture. External stock photography is used as both covers and artwork.

## Implementation

1. Add catalogue-wide scene contract tests in `src/app/constants/gallerySceneTemplates.test.ts`: schema acceptance, assets, independent copies, artwork bounds, entrance clearance, and coverage. Run the focused test and verify missing scenes fail.
2. Complete `src/app/constants/gallerySceneTemplates.ts` and remove the restricted create allowlist in `src/app/constants/galleryTemplates.ts`. Add local artwork/model assets with source notes and reproducible original model generation. Keep existing scene titles and room dimensions compatible.
3. Update `src/app/pages/VirtualGalleryEntry.test.tsx` to verify all six themes can preview and create their matching scene. Improve `src/app/components/GalleryTemplatePreview.tsx` to show actual object footprints and orientation.
4. Run focused tests, typecheck, lint and a fresh HK build/bundle check. Visually inspect all template previews and representative 3D scenes with the Browser skill. Do not create production user content for testing.
5. Package only the HK whitelist, compare with current production, update only web if runtime is identical, verify trusted public HTTPS/assets/readiness/redirect/container health, and record the exact deployment result here.

No Git commit/push or changes to production data/configuration are part of this task.

## Implemented

- All six themes now contain six artwork displays, descriptive sample content, distinct room finishes and editable layouts. Blank creation remains intentionally empty.
- Added four original GLB sample models, 24 original design studies and six bundled photography samples. History uses six existing documented Met Open Access works. Source notes live in `public/templates/SOURCES.md`.
- Fixed empty/floating pedestal models, oversized floating historical columns, ceiling intersection of the chandelier and obstructing technology partitions (now low display platforms).
- Six catalogue covers are real browser captures of the corresponding room; the blank cover is an empty-room illustration.
- Public preview includes on-demand 3D, an overview and per-artwork camera controls, with its existing floor plan and image list retained. No gallery creation, draft persistence or multiplayer connection is needed to preview.
- My Exhibitions offers all seven options, with a scrollable creation dialog and accessible selected state. Deep-linked public previews initialize the matching carousel selection.

## Validation

- Full suite: 288 test files passed, 2,224 tests passed, one external Redis integration test skipped. The subsequently added private-dashboard tests passed separately (all three new themes); final changed-file lint passed.
- Focused acceptance covers scene/schema and local asset validity, independent scene copies, entrance clearance, all six public create payloads, all three newly available private-dashboard create payloads, lazy 3D toggling and camera cycling, existing editor loading and public demos.
- Browser: visually inspected all six actual WebGL rooms and four model types; no browser error logs in those inspections. All six local catalogue images loaded and all six desktop use buttons enabled. Public dialog 3D and next-artwork controls exercised. A 390px viewport showed no horizontal overflow on the page or preview dialog (341px content width). This is viewport acceptance, not a physical-phone performance test.
- Final isolated HK build: 440 whitelisted files, unchanged non-frontend runtime hashes. Largest JS 707.7 KiB, total JS 3,605.9 KiB, CSS 320.8 KiB; all budgets pass. Preserved the previously deployed public Google OAuth client ID.
- Archive: `.tmp/hk-templates-20260910.tar.gz`; SHA256 `2e9b71fbff96abecfa56f9b4ef49b756b34bce664dbe64328839015a9f4a05fe`. Uploaded and verified before extraction.
- Browser capture harness and acceptance/deployment logs are local `.tmp` artifacts and excluded from the release.

## Production completion — 2026-09-10 20:44 HKT

Deployed to the existing Hong Kong project with only the web service rebuilt/recreated. The complete `npm run check` finished successfully, including the default build and bundle check. Final HK output was independently built and checked after the dashboard scrolling fix.

- Web image: `sha256:2803ad9c83265808fbacb8f91826e9b146395fd5a35c86e749bf99df739ad3f8`.
- App image unchanged: `sha256:542698bfbded216582915d4f789f025b328abb5b6b754e5d4e577552eb7ead7f`; backend remains healthy.
- Release: `/home/admin/meta-exb-hk-templates-20260910`.
- Previous source backup: `/home/admin/meta-exb-hk-production-20260904/source.pre-templates-20260910`.
- Rollback: `sh /home/admin/templates-rollback-20260910.sh production`.
- Verified 154 public HTML/JS/CSS/template asset hashes over trusted HTTPS, including JPEG/SVG content types, `/api/ready`, public routes and the www redirect. Website ports remain TCP 80/443 only.
- Verified the deployed fashion preview opens the matching carousel entry and loads the actual 3D room without browser errors. Evidence: `.tmp/templates-20260910/production-preview.jpg`.
- Production environment checksum and mode 600 preserved; no changes to backend runtime, user data, uploads, volumes or certificates. No production test accounts/exhibitions were created. No Git commit/push.
- Logs: `.tmp/templates-20260910/check.log`, `build-r2.log`, `deploy.log`, `public-verify.log`.
