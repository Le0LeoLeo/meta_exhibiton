# Central artwork and thumbnail selector

Homepage now uses a centered artwork stage with compact centered introduction, artwork label, enlarged slide count and thumbnail buttons. Thumbnails show the official demo and actual public exhibitions, use aria-pressed and native button semantics, and update the existing shared selection/CTA state. Mobile thumbnails can scroll horizontally; artwork keeps its full proportions. Existing arrows, reduced-motion behavior and curved exhibition wall retained.

- Files: Home.tsx, Home.test.tsx, home-showcase.css, styles/index.css.
- Home tests 7 passed including thumbnail-to-CTA/pressed-state regression. Typecheck, lint, HK build and release budgets passed. Desktop screenshot and real thumbnail switching verified. Mobile 390px: document 375px, strip 327px; viewport reset.
- Release .tmp/hk-showcase-release-20260910; archive SHA256 0e2971b401d4668df2db48b90e945e5c9b6312f7655145dab864a0b989bc299c.
- Isolated staging readiness, TLS and exact entry/Home assets passed. Staging stopped, volumes retained. Non-dist files match current runtime. Accepted web sha256:7f496e296f1c3816d62ad7952b7ddb2c5e540b996fe5db6c07ff78a1ab7878a5; unchanged app sha256:badcd2f7df8427a6abf0a86254deae93182a31054acde15dba2e11f70cd30090.
- Production rollback: source.pre-showcase-20260910 beside production source; web tag meta-exb-hk-production-web:pre-showcase-20260910. Environment, user data, uploads, certificates and volumes retained. No Git commit/push.
- Logs: .tmp/showcase-staging.log, .tmp/showcase-production.log, .tmp/showcase-public.log.
- Deployed and public-verified 2026-09-10: nine SPA routes and related JS/CSS hashes match over trusted HTTPS, ready endpoint and www redirect pass. Browser confirms central stage and three thumbnails with the demo selected. App healthy, website only TCP 80/443 exposed.
