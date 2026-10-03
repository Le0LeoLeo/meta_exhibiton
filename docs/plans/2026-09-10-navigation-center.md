# Center desktop navigation

Use equal-width side columns around the three desktop navigation links at the existing 1280px breakpoint. Brand remains left-aligned and account controls right-aligned; the dropdown and mobile layout retain their existing behavior. CSS-only change in src/app/features/home/home.css.

Validation 2026-09-10 20:03 HKT: four existing Navigation tests passed. Browser measurement at 1280px verified center deviation below 0.01px, no overlap in Chinese or English (English right gap 64px), and mobile flex layout with hidden desktop links and no horizontal overflow. Fresh HK build, bundle budgets and 287-file whitelist passed. All 112 public HTML/JS/CSS hashes matched; trusted HTTPS, readiness, SPA routes, www redirect and website-only 80/443 mappings verified. Only web service updated; existing app image, data, uploads, environment checksum/mode and certificates preserved. No Git commit/push.

Archive SHA256: ed935e6d7d49e72c5b02518410451fe5b16a23e3be902dfa7e2d6395a9445d4b.
Web image: sha256:67aa0db88b2ea4698b95e1b237fec2872b61de0c5a8a5571ff64feff9390356f.
Rollback: sh /home/admin/nav-center-rollback-20260910.sh production. Previous source: source.pre-nav-center-20260910. Helpers: .tmp/nav-center-20260910/.
