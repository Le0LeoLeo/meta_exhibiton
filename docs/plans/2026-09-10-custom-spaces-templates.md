# Custom Spaces template showcase

Adapt the publicly visible MotionSites Custom Spaces reference (https://motionsites.ai/?prompt=custom-spaces) to the existing gallery template section: large centered heading, five perspective image panels around a selected template, animated selection, previous/next navigation and a shared description/action area. Preserve the existing museum palette and template assets. The paid prompt was not accessed.

Changes are limited to `VirtualGallery.tsx`, its entry tests and removal of the superseded article CSS. Categories derive from displayed templates so the blank-only category no longer produces an empty showcase. Selection resets on category change, wraps through templates, supports focused cards and arrow keys, and respects reduced motion. Actual scene preview, login return and creation remain connected to the selected template; unavailable scenes and mobile editing retain their existing restrictions.

Acceptance: 10 focused entry tests passed, including wrapped navigation, category reset, unavailable scenes, keyboard selection and preview/login/create behavior. Browser checks verified desktop perspective layout, switching to the matching technology scene preview, single-template filtering and mobile-width switching without horizontal page overflow. This is a desktop browser responsive check, not a physical phone test.

## Validation and production, 2026-09-10 19:20 HKT

- `npm run check` passed: server syntax, avatar validation, TypeScript, ESLint, 2,210 tests (one external Redis test skipped), build and bundle limits. Log: `.tmp/custom-spaces-check.log`.
- Fresh HK build and whitelist packaging passed: 287 files; CSS 219.3 / 220 KiB. Archive SHA256: `a8273649699accf0c49c8ec7aac6f5e063e8f2f1c1a613e4b006ca164f385ab4`.
- Runtime/package/deployment hashes matched the prior production manifest; only frontend assets changed. Updated only the web service; backend image and running instance retained. No staging data changes were required for this presentation-only change.
- Web image: `sha256:21ce28c4514a92e1b8f49e205a8ddaa925c7eed7a0ae033a4cdb0542fcce24bc`. App: `sha256:542698bfbded216582915d4f789f025b328abb5b6b754e5d4e577552eb7ead7f`.
- All 112 served HTML/JS/CSS hashes matched over trusted HTTPS, using the system CA trust store. Readiness, SPA routes, www redirect, media denial and bounded public summaries passed. Public browser verified the new showcase and selection of the technology template. Only website ports 80/443 are publicly mapped.
- Environment checksum and mode 600 preserved, along with production data, uploads, certificates and previous backups. No Git commit/push.
- Rollback: `sh /home/admin/custom-spaces-rollback-20260910.sh production`. Prior source: `source.pre-custom-spaces-20260910`; image tags: `:pre-custom-spaces-20260910`. Local helpers: `.tmp/custom-spaces-20260910/`; production deploy helper: `/home/admin/custom-spaces-deploy-20260910.sh`.

