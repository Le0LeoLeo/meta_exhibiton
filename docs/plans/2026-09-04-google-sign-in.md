# Google Sign-In Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable secure Google sign-in for the existing MetaEXB login flow locally and on the Hong Kong production site.

**Architecture:** Keep the existing Google Identity Services button and backend ID-token exchange. The browser receives a Google ID token, the Express API verifies its signature, issuer, audience, expiry, and verified email with `google-auth-library`, then creates or links the local user and issues the same first-party session used by password login. Production builds receive the public OAuth client ID explicitly instead of loading ambient Vite environment files.

**Tech Stack:** React 18, Vite, Google Identity Services, Express, `google-auth-library`, SQLite, Vitest.

---

### Task 1: Lock down the existing Google identity verifier

**Files:**
- Modify: `server/auth/googleIdentity.js`
- Create: `server/auth/googleIdentity.test.js`

**Step 1: Write failing verifier tests**

Cover an unconfigured client, successful verified identity normalization, rejected unverified email, and missing required claims using a mocked OAuth client.

**Step 2: Run the focused test and confirm the new cases fail**

Run: `npm run test -- server/auth/googleIdentity.test.js`

Expected: FAIL before the verifier exposes a test seam and validates all required claim values.

**Step 3: Implement the minimal verifier hardening**

Inject the OAuth client only for tests, preserve the production default, trim claim strings, reject blank subject/email claims, and return only normalized identity fields.

**Step 4: Run the focused test**

Run: `npm run test -- server/auth/googleIdentity.test.js`

Expected: PASS.

### Task 2: Verify the API login contract and first-party session

**Files:**
- Modify: `server/routes/authRoutes.test.js`
- Modify only if a failing test requires it: `server/routes/authRoutes.js`
- Modify: `src/app/api/auth.test.ts`
- Modify only if a failing test requires it: `src/app/api/auth.ts`

**Step 1: Add missing route cases**

Test disabled configuration, empty/oversized credentials, an already-linked Google account, conflicting account linkage, and cookie/session issuance.

**Step 2: Run the backend route test**

Run: `npm run test -- server/routes/authRoutes.test.js`

Expected: all Google route cases PASS after any minimal fix.

**Step 3: Verify the frontend exchange**

Test that `loginWithGoogle` posts only the credential to `/api/auth/google`, uses the cookie-aware API wrapper, normalizes the response, and surfaces server errors.

**Step 4: Run the frontend API test**

Run: `npm run test -- src/app/api/auth.test.ts`

Expected: PASS.

### Task 3: Make the Google button resilient and accessible

**Files:**
- Modify: `src/app/components/GoogleSignInButton.tsx`
- Modify: `src/app/components/GoogleSignInButton.test.tsx`
- Modify only if required: `src/app/pages/Login.tsx`

**Step 1: Add component regression tests**

Test the configured button, unconfigured state, script-load failure, missing credential response, and disabled state.

**Step 2: Run the component test and observe failures**

Run: `npm run test -- src/app/components/GoogleSignInButton.test.tsx`

Expected: new resilience/accessibility cases fail before implementation.

**Step 3: Make the smallest UI fix**

Reuse a single GIS script, recover from load failure on a future mount, ignore blank credentials, expose an accessible unavailable status, and prevent input while the API exchange is pending.

**Step 4: Run the focused login UI tests**

Run: `npm run test -- src/app/components/GoogleSignInButton.test.tsx src/app/pages/Login.test.tsx`

Expected: PASS (create `Login.test.tsx` only if no current test covers Google completion and failure states).

### Task 4: Enable explicit Hong Kong production configuration

**Files:**
- Modify: `deploy/hongkong/vite.config.ts`
- Modify: `scripts/hongkong-deployment.test.mjs`
- Modify: `scripts/prepare-hongkong-release.mjs`
- Modify: `.env.example`
- Modify: `deploy/hongkong/README.md`

**Step 1: Add failing deployment tests**

Assert the production Vite wrapper embeds only an explicitly supplied Google client ID, fails a Google-enabled build when backend/frontend IDs diverge, and leaves Google disabled when no ID is supplied.

**Step 2: Run deployment tests**

Run: `npm run test -- scripts/hongkong-deployment.test.mjs`

Expected: FAIL for the new explicit-build configuration.

**Step 3: Implement explicit configuration**

Read the public client ID from a dedicated build environment value, validate the standard Google web-client ID shape, and document that `https://metaexb.com` must be an Authorized JavaScript origin. Do not copy local `.env` files into the release.

**Step 4: Run deployment tests and a production build**

Run: `npm run test -- scripts/hongkong-deployment.test.mjs`

Run: `npm run build -- --config deploy/hongkong/vite.config.ts --outDir .tmp/hk-google-build/dist`

Expected: tests and build PASS; built assets contain the configured client ID only when explicitly provided.

### Task 5: Validate and deploy through the Hong Kong safety flow

**Files:**
- Modify: `docs/HANDOFF-2026-09-03-HONG-KONG-DEPLOYMENT.md`
- Modify or create an execution record under `docs/plans/` only for observed deployment results.

**Step 1: Run local validation**

Run: `npm run check`

Expected: all required tests, type checks, lint, server syntax checks, production build, and bundle gates PASS (record any unrelated pre-existing failure separately).

**Step 2: Confirm Google Cloud origin configuration**

Verify the selected OAuth web client authorizes `https://metaexb.com`; add it in the user's authenticated Google Cloud Console only if required.

**Step 3: Build and inspect a fresh whitelisted release**

Build with the explicit public client ID, stage via `scripts/prepare-hongkong-release.mjs`, inspect the manifest/archive exclusions, and compare local/remote SHA256 without transferring `.env`, databases, uploads, secrets, tests, source maps, Git data, or `node_modules`.

**Step 4: Run isolated staging acceptance**

Update only the retained `meta-exb-hk-staging` project, preserve its volumes, set the same Google client ID in its mode-600 environment, and verify readiness plus a real Google sign-in through the intended origin path without printing credentials or tokens.

**Step 5: Update production without replacing runtime volumes**

Update `/home/admin/meta-exb-hk-production-20260904/source`, preserve `.env.hongkong`, runtime data, uploads, certificates, backups, and restore volume, then rebuild app and web sequentially and start with health checks.

**Step 6: Verify the public result**

Verify `https://metaexb.com`, `/api/ready`, trusted TLS, `www` redirect, only ports 80/443 public, successful Google login/session recovery/logout, and clean logs. Record image/release hashes and final service state in the handoff.

No Git commit or push is included because the user did not request either.
