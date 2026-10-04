# Navigation Auth Synchronization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep desktop and mobile navigation synchronized when cookie-backed login is restored after a reload, or account state changes without navigation.

**Architecture:** Subscribe the existing Navigation state updater to the existing `subscribeAuth` notification API. Retain current focus/storage/path synchronization and unsubscribe on unmount. Do not change auth storage, authentication rules, layout, or account data.

**Tech Stack:** React 18, React Router, Vitest, Testing Library, Vite, Docker Compose.

---

## Execution constraints

The user approved this specific follow-up fix. Preserve the existing dirty checkout and previously deployed CSRF fix. The referenced executing-plans skill is unavailable, so execute directly in this task using the same test checkpoints. No new worktree, task, commit, public access, or infrastructure purchase is requested.

### Task 1: Reproduce and fix navigation synchronization

**Files:** Modify `src/app/components/Navigation.tsx`; create `src/app/components/Navigation.test.tsx`.

1. Add tests using the real auth store and deferred `AuthSessionProvider` bootstrap. Assert navigation changes to the restored user without navigation/focus events, including an already-open mobile menu. Also test name changes, external logout, and unsubscription on unmount.
2. Run `npm run test -- src/app/components/Navigation.test.tsx`; observe failures before implementation.
3. Import `subscribeAuth`, register `const unsubscribe = subscribeAuth(syncAuth)` before the initial `syncAuth()` in the existing effect, and call `unsubscribe()` in its cleanup.
4. Run `npm run test -- src/app/components/Navigation.test.tsx src/app/auth.test.tsx src/app/api/auth.test.ts`, `npm run typecheck`, targeted ESLint, `npm run build`, and `npm run check:bundle`.

### Task 2: Update only the private frontend

1. Compare the original local Navigation SHA-256 with the deployed source. Back up the source and tag the existing web image before replacement.
2. Upload only Navigation.tsx. Rebuild only `web` with the existing pinned official image digests and Debian mirror; do not upload unrelated local changes or credentials.
3. Recreate only `web` while preserving Caddy volumes, TLS trust, loopback-only ports, and the running app container.
4. Use a synthetic account to test real browser login, reload on home/profile, desktop/mobile navigation, logout, and access denial after logout. Use the existing Browser skill connection.
5. Delete only the synthetic test account after checking its exact ID/email; leave an empty login form. Record results and rollback locations below.

## Results

- Before the fix, all 4 added tests failed for the expected missing subscription. After the three-line runtime change, all 16 tests passed across Navigation, AuthSessionProvider, and the auth API store.
- TypeScript, targeted ESLint, Vite production build, bundle-size checks, and scoped whitespace checks passed.
- Original local/deployed Navigation SHA-256 matched: `802ac7ea18699295487a77cca1b089b1ed9f9cb705c40440fe4601fd3fe40787`. New local/deployed SHA-256: `cdd9ad0ee6476a433c3d515b2ffe75fd732897caca53f5139cfc70116df6b75b`.
- Uploaded only `src/app/components/Navigation.tsx`, rebuilt web from the existing remote source, and recreated only web. App remained running and healthy; private port binding remained `127.0.0.1:8443`.
- Rollback source: `/home/admin/meta-exb-private-20260902/navigation-auth-fix-20260903-1619/Navigation.tsx.before`. Rollback image: `meta-exb-private-web:before-navigation-auth-20260903-1619`. New web manifest list: `sha256:672c9c74e43c17caf49dccfcb859aaab5c21a08a28910bb54d0ca5a4121a486a`.
- The prior local SSH tunnel was no longer running. Restored the same approved loopback-only tunnel in a hidden process (PID 13984); normal TLS-validated readiness request succeeded.
- Live browser verification is pending user reload: the first navigation encountered connection refused before tunnel restoration, leaving an internal data-URL error page. Browser URL policy then blocked reload/navigation on that tab. Do not bypass the restriction with another control surface. Ask the user to reload the normal `https://localhost:8443/login` page, then continue browser verification.
- No synthetic account was created this turn, and no user account or uploaded data was changed. Browser viewport was not modified.

### Browser retry after user request (2026-09-03, approximately 16:22–16:25 HKT)

- The user had opened a working login tab, which was reused. A dedicated synthetic account successfully logged in and the navigation displayed its name.
- Full reload of `/virtual-gallery/my-exhibitions` succeeded and the navigation still displayed the authenticated name and logout button, verifying the original navigation synchronization bug is fixed.
- Opening `/profile` displayed the matching synthetic account identity. During the next full reload, the SSH tunnel disappeared and the browser received connection refused. No listener or matching SSH process remained on local port 8443. Two direct SSH attempts to the existing pinned host timed out.
- Profile-reload, mobile-menu, and browser-logout checks remain incomplete due to the connection interruption. Browser URL policy also blocks control of the resulting internal error page; do not bypass it.
- Pending synthetic-account cleanup: ID `2d60e4f1-afed-406f-ad5f-2dc15bbcc29b`, email `private-preview-nav-60006cfa4edc44f4875e39ec5171cbfc@example.invalid`. This is the only account created for this retry. No cleanup is claimed: it cannot be reached while SSH is unavailable. Check this exact ID/email and delete only this fixture after connectivity returns. Test credentials are not stored in this document.
- No source or deployment changes were made during this retry. No viewport override was applied.

### Connectivity follow-up after user reported VPN disabled

- Direct SSH initially recovered; app and web were healthy. Local port 8443 had no listener. Restarted the same authorized loopback tunnel (PID 27496), then confirmed `/api/ready` reported ready and `/profile` returned HTTP 200 with normal TLS validation.
- The tunnel subsequently disappeared again and direct SSH timed out. Synthetic-account cleanup stopped at the identity GET timeout; the delete request was not reached. Cleanup remains pending for the exact fixture identified above.
- Read-only route inspection with `Find-NetRoute -RemoteIPAddress 120.79.240.7` selected `NordLynx`, interface 24, default route via `100.64.0.1` with metric 1. Ethernet interface 22 was also up. This establishes that Windows was still routing the server connection through NordVPN at the time of the check; automatic reconnection or residual routing is only a hypothesis.
- No VPN settings, kill switch, firewall rules, or route overrides were changed. A server-specific direct-route exception would require explicit user authorization before proceeding.

### User-approved server-only direct-route exception (2026-09-03)

- The user approved routing only the Aliyun server directly, leaving other VPN traffic unchanged. Added a non-persistent host route for `120.79.240.7/32` through Ethernet interface 22, gateway `192.168.101.1`, route metric 5, using the elevated Windows route utility without `-p`. This temporary route clears on reboot.
- Verified both the exact route and Windows route selection: the server now selects Ethernet with local address `192.168.101.18`. The NordLynx default route was left unchanged. No VPN protection, firewall, public port, or application configuration was changed.
- End-to-end connectivity is NOT restored: direct TCP port 22 and pinned SSH still timed out after the route was installed. At the final local check, port 8443 had no listener. A route-selection change alone does not prove that traffic can reach the server.
- Two synthetic-account cleanup attempts stopped at the identity GET timeout before any DELETE request. The exact fixture identified above remains pending cleanup; no credentials were written to this document.
- Planned NordVPN UI inspection was stopped after reading Computer Use restrictions on security-app automation and security/privacy settings. No NordVPN UI was controlled. VPN protection interference remains an unconfirmed hypothesis; request user-provided Kill Switch and Split Tunneling settings screenshots before considering further changes.
- To roll back, first verify this exact host route and remove only `120.79.240.7/32` via gateway `192.168.101.1` on interface 22 with administrator approval. Do not remove any default route or unrelated VPN configuration.

### Connectivity recovery and completed browser acceptance (2026-09-03, after 17:01 HKT)

- Read-only inspection of the authenticated Aliyun console confirmed the instance was running and TCP 22 was enabled for `0.0.0.0/0`. Existing TCP 80/443 and ICMP cloud rules were also enabled; none were changed. Through the existing authenticated Workbench terminal, SSH was listening, UFW was inactive, the host INPUT policy was ACCEPT, the application was healthy, and normal CA-validated internal readiness succeeded. Bounded packet-header observations did not establish the exact cause of the client-side interruption.
- The user's VPN-off screenshots showed `SSH_OK` and `{"ok":true,"status":"ready"}`. The user then reported configuring NordVPN to use the VPN only for the selected ChatGPT/Codex applications. Pinned SSH succeeded again. Automatic tunnel startup was rejected by tool policy before execution; no alternate launcher was attempted. The user manually started the existing loopback-only SSH tunnel and opened a new working login tab.
- Reused that user-created browser tab and the existing synthetic fixture; no new account was created. At desktop size 1280x900, full `/profile` reload restored the exact fixture identity and authenticated navigation. At mobile size 390x844, full reload restored the identity and the expanded navigation showed the authenticated Profile/Logout actions.
- Mobile navigation logout returned to the login page. A subsequent direct visit to `/profile` redirected to `/login?returnTo=%2Fprofile`, with no fixture email visible; the mobile menu showed Login/Register instead of authenticated actions.
- Fresh login with the existing fixture credentials returned to `/profile` and updated desktop navigation. Another full profile reload succeeded. Desktop navigation logout followed by a full login-page reload retained the logged-out navigation.
- Deleted only fixture ID `2d60e4f1-afed-406f-ad5f-2dc15bbcc29b`, email `private-preview-nav-60006cfa4edc44f4875e39ec5171cbfc@example.invalid`, through the existing API after checking both exact identity fields with its own test token. DELETE returned HTTP 200; the old token's identity lookup then returned HTTP 401. The prior pending cleanup is complete, and the stored test credentials were discarded.
- Reset the temporary browser viewport. Final user-owned tab is a logged-out login form with empty email/password fields. Final normal-TLS readiness check returned ready, with local binding still only `127.0.0.1:8443` (user-started process PID 24240 at this checkpoint; verify identity before any future process action).
- Login/navigation browser acceptance is complete. The prior 16 automated tests, TypeScript/lint/build/bundle checks were not rerun because this recovery changed no application source or deployed image. This is still a private SSH preview, not public deployment or acceptance of every application feature. No real user data was modified, and the user's tunnel was left running.
