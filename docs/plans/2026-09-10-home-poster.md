# Editorial exhibition poster hero

Deployed 2026-09-10. Homepage hero refines the approved editorial direction: smaller neutral frame, uncropped art, one visible primary entry CTA, current exhibition at left and artwork/curator metadata below the image. Removed duplicate image CTA/overlay credit. Keyed captions and title animate alongside incoming art; carousel buttons remain mounted. Reduced-motion preferences are respected. Homepage background intensity reduced; exhibition wall retained.

- Files: Home.tsx, styles/home-poster.css, styles/index.css.
- Home tests 7 passed; typecheck/lint passed; fresh HK build and release budget gates passed. Desktop screenshot reviewed. Carousel browser check confirmed caption/selection/CTA URL update together. At 390px, document width 375; frame 327 and contained image 309px. Viewport reset.
- Fresh whitelist .tmp/hk-poster-release-20260910. Archive SHA256 b44fff09864b900bf49f3eed0463a71ee2805dc8fbb295856d8495baa85cf10c.
- Staging TLS, readiness and exact entry/Home asset hashes passed; staging stopped retaining volumes. Non-dist hashes unchanged from current production. Promoted exact staging web sha256:96d65501a2a71c4172de9bf513935446f8628263dd2a2812e46a12c4309b931f. App unchanged at sha256:badcd2f7df8427a6abf0a86254deae93182a31054acde15dba2e11f70cd30090, healthy and not restarted.
- Public nine SPA route hashes and related JS/CSS verified over trusted TLS; readiness and www redirect passed. Website ports only TCP 80/443.
- Rollback: /home/admin/meta-exb-hk-production-20260904/source.pre-poster-20260910 and web tag meta-exb-hk-production-web:pre-poster-20260910. Env hash unchanged; secrets/data/uploads/certificates/volumes preserved. No Git commit/push.
- Logs: .tmp/poster-staging.log, .tmp/poster-production.log, .tmp/poster-public.log.
