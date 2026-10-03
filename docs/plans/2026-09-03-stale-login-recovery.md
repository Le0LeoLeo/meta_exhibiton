# Stale Login Recovery Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow login after a session cookie has expired or become invalid, without weakening CSRF checks for authenticated requests.

**Architecture:** Validate the session cookie with the existing JWT verifier before requiring a CSRF token. Clear invalid session/CSRF cookies and leave authentication to the existing route guards; valid sessions still require matching, signed CSRF tokens. Do not alter frontend storage, JWT secrets, account records, or deployment exposure.

**Tech Stack:** Express, jsonwebtoken, Vitest, Docker Compose, private HTTPS preview through SSH.

---

## Scope and constraints

- Work in the existing user checkout; preserve unrelated uncommitted changes.
- The referenced executing-plans skill is unavailable. Execute the approved work directly in this task, with test checkpoints; no new task or commit is requested.
- Read `doc/README.md`, `server/auth/jwt.js`, `server/auth/sessionCookie.js`, and existing auth tests.
- Deploy only the changed runtime module after comparing its original hash with the deployed file. Keep a rollback copy and image tag. Preserve `.env.private`, volumes, database, uploads, and loopback-only ports.

### Task 1: Regression tests

**Files:** Modify `server/security/csrf.test.js`; create `server/security/csrfLogin.integration.test.js`.

1. Update existing CSRF fixtures so cookie sessions are recognized as valid by the test verifier.
2. Add cases for malformed/expired/old-key session cookies: proceed as unauthenticated and expire both cookies. Keep valid-cookie missing, mismatched, forged, and invalid-Bearer tests returning 403. Cover all mutation methods and safe GET behavior.
3. Use a loopback Express test app with the real JWT verifier, CSRF middleware, and auth routes, plus an in-memory user fixture (no database). Test stale-cookie correct login 200, wrong password 401, stale-cookie logout 200, protected mutation 401, and valid-session CSRF enforcement.
4. Run `npm run test -- server/security/csrf.test.js server/security/csrfLogin.integration.test.js`; expect stale-cookie cases to fail before implementation.

### Task 2: Minimal implementation

**Files:** Modify `server/security/csrf.js` only at runtime.

1. Import `SESSION_COOKIE_NAME`, `clearSessionCookie`, and `clearCsrfCookie` from the existing cookie helper.
2. After parsing cookies and the no-session early return, implement:

```js
if (!verifyToken(cookies[SESSION_COOKIE_NAME])) {
  clearSessionCookie(res);
  clearCsrfCookie(res);
  return next();
}
```

3. Leave valid Bearer handling and signed double-submit verification unchanged.
4. Run the regression suite plus `server/routes/authRoutes.test.js`, session-cookie/JWT tests, `npm run check:server`, and targeted ESLint. Expect all checks to pass.

### Task 3: Private deployment and verification

1. Confirm SSH identity, existing app health, and original deployed source hash.
2. Back up the old module and tag the running image. Upload only `server/security/csrf.js`, verify its hash, and rebuild only the app using the existing pinned official Node/Caddy images and Aliyun Debian mirror.
3. Recreate only the app with Compose, retaining all volumes. Check readiness and loopback port binding.
4. Create one clearly synthetic test account through the existing API. Test browser login in the existing preview tab, reload/session restoration, and logout. Independently confirm invalid-session login succeeds and valid-session mutation without CSRF remains 403.
5. Delete only the synthetic account after checking its exact ID/email; clear the test form. Record actual results and any remaining issues below. If deployment fails, restore the backed-up module/image without touching runtime data.

## Verification results

- Before implementation: 12 expected regression failures, including stale-cookie login returning 403 instead of 200. The 8 existing/protection cases passed.
- After implementation: 56 tests passed across CSRF, real-route integration, auth routes, JWT, session cookies, and middleware. Server syntax check passed for 135 JavaScript files; targeted ESLint and whitespace checks passed.
- Deployed only `server/security/csrf.js`; its original local/deployed SHA-256 matched (`60dc3bc078a45da87b137c3dbebf8cadffa7240ce41606ec676b569559ecd48f`). The new local/deployed/container SHA-256 is `ee2948962f0ddb836889ce3e986f34083c4c360dff4283792d2fc0c2b88613fd`.
- Rollback source: `/home/admin/meta-exb-private-20260902/stale-login-fix-20260903-0758/csrf.js.before`. Rollback image: `meta-exb-private-app:before-stale-login-20260903-0758`. New image manifest list: `sha256:e67f7daa1e3e63520dc1ac5346aa630ad845cb114cf590f274aa526d6980b578`.
- App recreated successfully and healthy. Existing web container, environment, volumes, and loopback-only publishing retained.
- Existing browser tab that previously returned 403: login succeeded (HTTP 200), then displayed the synthetic user's profile and matching identity. Full document reload retained access to that account. Browser logout returned 200; reopening `/profile` redirected to the login page with an empty form.
- Independent live API checks: stale-cookie login 200; valid session without CSRF 403; logout with matching CSRF 200; account lookup after logout 401; wrong password 401.
- Synthetic test account removed after exact ID/email guard; deletion 200 and subsequent account lookup 401. No real accounts or uploads modified by testing; no credentials saved in this document.

### Separate issue found during verification (not changed)

After reload the profile remains authenticated, but the top navigation temporarily/stably displays the signed-out links until a navigation/focus refresh. `src/app/components/Navigation.tsx` maintains its own user state and listens to storage/focus/path changes, but does not subscribe to the existing `subscribeAuth` notification sent by the asynchronous session bootstrap in `src/app/auth.tsx`. This is a separate frontend synchronization issue, not a failed server session restoration. Report it to the user; the scoped server-side stale-session fix is complete.
