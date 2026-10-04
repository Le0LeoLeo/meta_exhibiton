# Reload recovery and real browser interruption acceptance

Goal: preserve unsaved editor work across reload in the same tab, scoped to the current account/gallery/share context, and verify real two-browser 3D interruption/reconnection.

Use bounded, versioned sessionStorage records (24 hours, maximum 2 MiB UTF-16 per record), sanitized media URLs, an explicit merge/discard/download choice after successful permission checks, and the existing merge helper. Suspend HTTP saves and socket scene writes until a choice is made. Purge other accounts on authentication and all recovery records on logout. Flush scene changes before pagehide; surface quota/unavailable-storage errors. Do not promise full offline startup or recovery after closing the tab. Keep production runtime data and the dirty worktree intact; no Git commits or worktree changes.

Implement storage/session tests, gallery recovery tests and bridge guards. Extend isolated browser acceptance with two real WebGL browser contexts, actual UI edits, connection interruption, remote edits, reconnection and reload recovery. Run focused/full/browser checks, fresh HK build, isolated staging acceptance, exact-image deployment, public verification and scoped cleanup. Record evidence and limitations here.

Implementation, full validation and Hong Kong production deployment complete; public verification passed on 2026-09-10 at 18:56 HKT.

## Implemented behavior

- `src/app/utils/editorTabDraft.ts`: hash-scoped records, metadata/schema/age/size checks, sanitized relative media URLs, 200 ms debounce and synchronous pagehide/beforeunload flush. Changes observed during recovery cannot overwrite the pending record. Quota, unavailable storage and transient blob URLs surface a warning and retain any older usable record.
- Authentication preserves only records belonging to the current account and purges records on logout. Page sessions stop writing after account or route changes; failed permission checks do not expose stored scenes.
- The editor offers merge, discard and download through an accessible modal. Choices wait for current collaboration state; restore also requires editing rights. HTTP saves, scene-saved events and WebSocket scene writes pause during review. The existing merge helper retains independent remote changes and remote deletions.
- Real browser testing exposed an initialization race: mounting collaboration while the page was still loading could clear the newly configured share context. The page now mounts it only after initialization completes. The collaboration recovery panel is anchored to the viewport so its choices cannot be clipped beneath the site navigation.

## Acceptance

58 focused tests passed across storage/session behavior, editor page recovery and the collaboration bridge. Two distinct authenticated users in separate Chromium browser contexts opened actual WebGL editors and changed room dimensions through UI sliders. The test forwarded real WebSocket traffic, severed connections and took one context offline, retained local changes, accepted independent remote changes, explicitly merged, then reloaded and restored an unsaved draft. A real API read confirmed the combined 22 m × 21 m scene was durably saved. Screenshots and the accepted run log are retained under `.tmp/tabdraft-browser-evidence-20260910/`.

The 3D acceptance uses the existing performance preference and a small empty gallery; it is not a large-scene performance or physical-device claim. Socket.IO's default 20-second connection timeout can delay a reconnect attempt started while offline; the acceptance waits for an actual fresh room acknowledgement within a bounded 45-second window. Earlier test-runner experiments with software rendering were discarded; the accepted run used full headless Chromium and disabled continuous trace screenshots while preserving explicit screenshots and DOM traces.

Limits: same-tab recovery requires successful online gallery permission checks after reload. Closing the tab, clearing browser data or unavailable/full storage can remove/prevent the copy; downloading remains available. The copy expires after 24 hours and is not proof of a server save. No new backend service, account data migration or offline replay queue was introduced.

## Final validation and deployment

- `npm run check`: 2,210 tests passed, one external Redis test skipped; server syntax, avatar validation, TypeScript, ESLint, build and bundle limits passed. CSS is 219.5 / 220 KiB; the limit was not increased.
- `npm run test:browser`: all six flows passed in 52.2 seconds, including the two-user WebGL interruption/reload flow. Final logs: `.tmp/tabdraft-check.log` and `.tmp/tabdraft-browser-all.log`; final screenshots are under `.tmp/browser-results/collaboration-recovery-two-4e914-rk-and-recover-after-reload/`.
- Fresh HK release contains 287 whitelisted files. Archive SHA256: `958ae189224b24c68ecef8e08ce7e9262449b7c9789be0103769dae7a001477a`. Backend, package and deployment files match the prior release; only frontend assets changed.
- Isolated HK acceptance passed authorization, media protection, stale save rejection, TLS, WebSocket room isolation and reconnect, restart persistence and independent backup restoration. The bounded load test used 16 clients, two rooms and 80 operations; p50 / p95 / max acknowledgement was 21 / 34 / 39 ms, not a production capacity claim.
- Staging backup: `/home/admin/meta-exb-hk-staging-20260904/backups/runtime-pre-tabdraft-20260910.tar.gz`; SHA256 `1bb3cf013a191b06316eb1410dccfdc42570b3bbc7267d798094b770de97e4a6`. Existing production backups remain intact; this frontend-only deployment did not stop the production app.
- Exact accepted Web image deployed: `sha256:26156b381ca460f6d4e9f598bba3b794b5a38abbea81b939321c8bdc5f2fc997`. App image remains `sha256:542698bfbded216582915d4f789f025b328abb5b6b754e5d4e577552eb7ead7f`, with existing uptime preserved.
- All 112 served HTML/JS/CSS hashes matched in staging and through public trusted HTTPS. Readiness, SPA routes, www redirect, auth configuration, invalid reset input without account/mail mutation, media denial and bounded public summaries passed.
- Environment checksum and permissions, production runtime data, certificate volumes and prior backups preserved. Only TCP 80/443 are publicly mapped for the website. Staging users, galleries and media_assets each verified zero, then staging stopped; local browser acceptance listeners stopped. No Git commit or push.
- Rollback: `sh /home/admin/tabdraft-rollback.sh production`; prior source is `source.pre-tabdraft-20260910`, prior image tags end in `:pre-tabdraft-20260910`. This restores the preceding frontend without replacing runtime data or secrets. Deployment helpers are retained under `/home/admin/tabdraft-*.sh` and locally under `.tmp/tabdraft-20260910/`.
