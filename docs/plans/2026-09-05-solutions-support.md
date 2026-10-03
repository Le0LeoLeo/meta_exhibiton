# Solutions and Support Implementation Plan

**Goal:** Make the two public pages useful, navigable and honest about available services.
**Architecture:** Keep existing React routes, UI primitives, brand tokens and three language catalogs. Use real gallery/demo links; do not collect requests without a receiving service.
**Tech Stack:** React, React Router, Tailwind, Radix Accordion, Vitest.

1. Update `src/app/pages/Solutions.tsx`: remove simulated contact/demo submissions, add industry anchors, real demo/start links, and a three-step launch guide. Preserve existing images.
2. Update `src/app/pages/Support.tsx`: replace disabled contact-card wall with task links, categorized searchable FAQs, troubleshooting guidance and one honest service-availability notice.
3. Add matching content to `src/app/i18n/catalogs/{zh-TW,zh-CN,en}.ts`; test filtering, reset, anchors and real destinations in page tests.
4. Run focused tests, typecheck, scoped lint, Hong Kong build and bundle check. Inspect desktop/mobile UI with the browser skill.
5. Stage whitelisted release, verify manifest and unchanged runtime source, update only production dist/web with rollback retained. Verify public HTTPS, readiness, redirect, assets, health and ports. Record results here. No Git commit or push.

## Completed — 2026-09-05 21:01 HKT

- Solutions: six industry anchors, real gallery/demo actions, three-step guidance, support link, responsive/lazy images. Removed fake contact forms, simulated bookings and toast-only scenario buttons.
- Support: three actionable entry cards, nine practical FAQs in three categories, combined text/category filtering, live result count, reset and per-answer links. Added getting-started and troubleshooting guidance; retained one honest unconfigured-service notice without collecting personal information.
- Traditional Chinese, Simplified Chinese and English content added. No backend/API or customer data changes.
- 39 focused tests passed (page journeys, unavailable services, i18n, deployment). After final wording adjustment, all 8 page/i18n tests passed again. Typecheck, scoped ESLint, fresh HK build and bundle budget passed (JS 3416.3 KiB, CSS 201.9 KiB).
- Browser verified search/Enter jump, QR answer/link, topic filtering, mobile industry anchor positioning (112px), education image loading, and language switching. No horizontal overflow at 375, 768 and 1440px. Production mobile FAQ filter and industry links verified; final public entry/chunk/CSS hashes match release.

## Final Hong Kong release

- Archive `.tmp/hk-solutions-support-final-20260905.tar.gz`, 222 whitelisted files; SHA256 `d8ba5fc6700bac5321bb2e77a0ea1f6a3dd3fbfcc83bfcdd5ee7e6fc48773aea`.
- Remote release `/home/admin/meta-exb-hk-solutions-support-final-20260905`.
- Manifest hashes verified. Non-dist files match production except previously documented `deploy/hongkong/EMAIL_VERIFICATION.md` difference; that file was not deployed.
- Only existing production dist and web image updated. Web image `sha256:d2ada0a44f0eec7ba56dc73ceabe06df42cf9213e9a249b96a859cc12763e05f`.
- App image remains `sha256:4bdbe56b7d60386063d2cffab3fb2d359c69f23c35cda12560ab3bd7e5ce3360`. Environment hash unchanged, public Google client ID preserved; runtime, uploads and Caddy volumes retained.
- Pre-task rollback: `dist.pre-solutions-support-20260905` and `meta-exb-hk-production-web:pre-solutions-support-20260905`. First iteration also retained as `dist.pre-solutions-support-final-20260905` and corresponding image tag.
- HTTPS home/solutions/support 200, TLS verification 0, API ready, www redirect 301 preserves path; app healthy and only 80/443 published. Local asset verification used Node system CA after default trust-store verification failed; TLS checking stayed enabled.
- No Git commit/push, no synthetic production data.

## Support email follow-up — 2026-09-05

- User supplied `iopipoiopiopiopiop9990@gmail.com` as the support address. Added a visible, wrapping mailto link and guidance in all three locales; replaced the unavailable-email notice while retaining chat/phone availability information. No email sent.
- Six focused page tests, scoped ESLint, fresh HK build and bundle checks passed. Public support/main/CSS/HTML hashes match release; HTTPS 200, TLS verification 0, ready and www redirect verified; only 80/443 published.
- Release `/home/admin/meta-exb-hk-support-email-20260905`, 222 whitelisted files. Archive SHA256 `80097d323cad708b94d9d8ecfbe40535305f474506b651a18af91e472d63fc2c`.
- Web image `sha256:e4c2c5cdd51c19e6a5488f923526a9d711ef1e54d64568ab802fca22bd67dd14`. Previous dist and image retained as `pre-support-email-20260905`; production app, environment and volumes unchanged. Same non-deployed documentation exception as above. No commit/push.
