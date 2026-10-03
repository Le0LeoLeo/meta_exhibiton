# Official-only homepage

Deployed 2026-09-10. Homepage no longer fetches or recommends published user exhibitions. Removed non-official hero slides, thumbnail selector, exhibition-wall recommendations and recent souvenir previews from Home. Retains the explicitly official /demo entry and artwork, creation actions and feature entry links. Public exhibition listing, stored user galleries and backend are unchanged; no data deleted.

- Changed Home.tsx and updated its tests for the approved official-only behavior.
- Five tests passed (no public API request/non-official links, official cover fallback, three languages). Typecheck/lint and fresh HK build/packaging budgets passed. Local browser verified zero exhibition links or thumbnails and official /demo target.
- Release .tmp/hk-official-release-20260910; archive SHA256 922b8a00a6f817c2502a9f4c40f754cbe99af9829e439ea3f8c89848ba9de347.
- Staging TLS/readiness/exact frontend hashes passed; stopped staging with volumes retained. Non-dist comparison passed. Accepted and promoted web sha256:864a0efd6d4301e84c26643ba4a0dc891769e1fcaba9e472883bb56bde3d8d2b. Backend remains sha256:badcd2f7df8427a6abf0a86254deae93182a31054acde15dba2e11f70cd30090, healthy without restart.
- Public nine-route HTML/related assets verified over trusted HTTPS; readiness and www redirect pass. Website ports only TCP 80/443.
- Previous source dist/manifest at source.pre-official-20260910 beside production source; prior web tag meta-exb-hk-production-web:pre-official-20260910. Environment hash unchanged; secrets, user data, uploads, volumes and certificates preserved. No Git commit/push.
- Logs: .tmp/official-staging.log, .tmp/official-production.log, .tmp/official-public.log.
