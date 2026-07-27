# Production Hardening and Maintainability Remediation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the current working tree into a reproducible release candidate, then close the highest-value production gaps in request resilience, rate limiting, authentication storage, observability, error recovery, and oversized core modules.

**Architecture:** Preserve the current React/API/Express/service/SQLite boundaries and make incremental, test-first changes. Introduce shared infrastructure behind small interfaces so the existing single-process development setup keeps working while production can opt into Redis-backed limits and cookie-based authentication. Split large files only along boundaries already visible in the code; do not redesign product behavior.

**Tech Stack:** React 18, TypeScript, React Router, Vite, Vitest, Express 5 ESM, SQLite3, Socket.IO, Zustand, Three.js, Zod, npm.

---

## Execution Rules

1. Execute this plan from a dedicated clean worktree created from the intended base commit. The current workspace has 198 changed entries and must not be used as an implicit release baseline.
2. Use `npm` and run commands from `web_ui_new/`.
3. Preserve user changes. Do not reset, checkout, delete, or rewrite unrelated files.
4. Add or update a focused test before each behavior change.
5. Keep each commit limited to one task and include:

   ```text
   Co-Authored-By: GPT-5 Codex <noreply@openai.com>
   ```

6. Do not commit `.env`, databases, uploads, logs, `dist/`, `build/`, or Playwright session state.
7. Stop the release if `npm run check` does not finish successfully. A timeout or partial result is not a pass.

## Completion Criteria

- The release candidate is based on reviewed commits rather than an uncommitted working tree.
- All browser API calls use a shared timeout/cancellation layer.
- Root route errors render a recoverable error page.
- Server logs are structured and correlated by request ID without logging secrets or request bodies.
- Multi-instance production deployments use a shared rate-limit store and fail closed when it is required but unavailable.
- Long-lived bearer tokens are no longer persisted in `localStorage`.
- Translation catalogs and database repositories are separated from their current monolithic files without behavior changes.
- `npm run check` and a production smoke test pass from a clean checkout.

---

## 2026-07-21 Implementation Record

**Implemented in the current shared working tree:**

- Task 2: shared API transport with 15-second default, 60-second AI/TTS, and 120-second upload timeouts; caller cancellation and stable transport error codes.
- Task 3: localized root route error page with recovery actions and non-sensitive error references.
- Task 4: structured JSON logging, recursive sensitive-field redaction, request correlation IDs, and final JSON error middleware.
- Task 5: async rate-limit store contract, bounded in-memory store, Redis Lua implementation, multi-instance production validation, readiness, and shutdown integration.
- Task 6: HttpOnly session cookie, signed double-submit CSRF, Bearer compatibility, in-memory browser token, and cookie bootstrap after reload.
- Task 7: translation catalogs extracted from `I18nProvider.tsx` without changing existing text or fallback behavior.
- Task 8 safe subset: SQLite helpers plus user/cleanup and media repositories extracted behind the existing `db.js` facade.
- Task 9: bounded parallel server syntax checks.
- Integration review fixes: stable Redis failure responses, bounded shutdown drain, and additional logger credential sanitization.
- Dependency remediation: compatible transitive updates applied with `npm audit fix`; production and full dependency audits report zero vulnerabilities.

**Validated evidence:**

```text
npm run check
  server syntax: 105 files passed
  TypeScript: passed
  ESLint: passed with zero warnings
  Vitest: 129 files, 822 tests passed
  production build: 3,005 modules transformed
  largest JavaScript chunk: 711.2 KiB / 800.0 KiB
  total JavaScript: 2,822.1 KiB / 4,800.0 KiB
  total CSS: 199.6 KiB / 220.0 KiB
  largest GLB: 1,621.0 KiB / 1,800.0 KiB
  total GLB: 4,793.3 KiB / 5,400.0 KiB
npm audit: 0 vulnerabilities
```

**Intentional deviations and remaining work:**

- Task 1 was not allowed to rewrite or commit the pre-existing dirty working tree. Release batching and clean-worktree verification remain required before deployment.
- Task 7 found pre-existing catalog asymmetry: `zh-CN` and `en` each have 10 missing and 43 additional keys relative to `zh-TW`; English has one intentionally preserved empty suffix and two placeholder mismatches. The extraction preserves the existing locale → `zh-TW` → key fallback contract. Translation content requires a separate human-reviewed task.
- Task 8 stopped after the user/cleanup and media repositories. Gallery, growth, competition, and visitor-memory extraction remains deferred because those sections overlap ongoing transaction and migration changes in `db.js`.
- Redis behavior is covered with fake-client and HTTP integration tests, but a real Redis service smoke test has not yet been recorded.
- Automated validation is complete; production configuration and browser smoke tests from Task 10 remain outstanding.

---

### Task 1: Establish a Reproducible Release Baseline

**Files:**
- Review: all paths reported by `git status --short`
- Update: `docs/plans/2026-07-21-production-hardening-remediation.md`

**Step 1: Record the current change inventory**

Run:

```powershell
git status --short
git diff --stat
git diff --check
git ls-files .env 'server/uploads/**' '*.db' '*.db-shm' '*.db-wal'
```

Expected:

- `git diff --check` exits 0.
- The final command prints nothing.
- Every changed file can be assigned to one product concern.

**Step 2: Group changes into reviewable batches**

Use these minimum groups:

1. account lifecycle and database integrity;
2. secure media ingestion and retention;
3. AI exhibition builder and TTS;
4. 3D performance, WebGL fallback, and gallery realism;
5. frontend feature and i18n changes;
6. build, lint, tests, and documentation.

Do not combine generated GLB assets with unrelated TypeScript or server changes.

**Step 3: Validate each batch before committing**

Run the focused test files named beside the changed source. Then run:

```powershell
npm run typecheck
npm run lint
```

Expected: both commands exit 0.

**Step 4: Create scoped commits**

Example:

```powershell
git add server/services/accountDeletionService.js server/services/accountDeletionService.test.js server/routes/authRoutes.js server/routes/authRoutes.test.js server/db.js server/dbMigrations.js server/dbMigrations.test.js
git commit -m "fix: make account cleanup durable" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

Repeat with explicit file lists for the other batches. Never use `git add .` in the dirty source workspace.

**Step 5: Verify the baseline**

Run:

```powershell
npm run check
git status --short
```

Expected: the full gate passes and the worktree contains only intentionally deferred files.

---

### Task 2: Add a Shared Browser Request Timeout Layer

**Files:**
- Create: `src/app/api/request.ts`
- Create: `src/app/api/request.test.ts`
- Modify: `src/app/api/base.ts`
- Modify: `src/app/api/auth.ts`
- Modify: `src/app/api/agent.ts`
- Modify: `src/app/api/aiCurator.ts`
- Modify: `src/app/api/aiWriting.ts`
- Modify: `src/app/api/competition.ts`
- Modify: `src/app/api/exhibitionScene.ts`
- Modify: `src/app/api/gallery.ts`
- Modify: `src/app/api/growth.ts`
- Modify: `src/app/api/media.ts`
- Modify: `src/app/api/tts.ts`
- Modify: `src/app/api/visitorMemory.ts`

**Step 1: Write failing timeout and cancellation tests**

Add tests covering:

```ts
it('aborts a request after the configured timeout', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', vi.fn((_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(
      new DOMException('aborted', 'AbortError'),
    ));
  })));

  const pending = apiFetch('/api/slow', {}, { timeoutMs: 100 });
  await vi.advanceTimersByTimeAsync(100);
  await expect(pending).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT' });
});

it('preserves caller cancellation', async () => {
  const controller = new AbortController();
  const pending = apiFetch('/api/cancelled', { signal: controller.signal });
  controller.abort();
  await expect(pending).rejects.toMatchObject({ code: 'REQUEST_ABORTED' });
});
```

**Step 2: Run the test and confirm it fails**

Run:

```powershell
npm run test -- src/app/api/request.test.ts
```

Expected: FAIL because `apiFetch` does not exist.

**Step 3: Implement the minimal shared transport**

Implement `apiFetch` with:

- a default timeout of 15 seconds;
- a longer explicit timeout for AI/TTS operations;
- composition with a caller-provided `AbortSignal`;
- stable `REQUEST_TIMEOUT`, `REQUEST_ABORTED`, and `NETWORK_ERROR` codes;
- no automatic retry for mutations;
- no logging of authorization headers or request bodies.

Public shape:

```ts
export type ApiTransportErrorCode =
  | 'REQUEST_TIMEOUT'
  | 'REQUEST_ABORTED'
  | 'NETWORK_ERROR';

export class ApiTransportError extends Error {
  constructor(
    public readonly code: ApiTransportErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ApiTransportError';
  }
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
  options: { timeoutMs?: number } = {},
): Promise<Response>;
```

Always clear timers and detach abort listeners in `finally`.

**Step 4: Run the transport tests**

Run:

```powershell
npm run test -- src/app/api/request.test.ts
```

Expected: PASS.

**Step 5: Migrate all API call sites**

Replace direct `fetch(apiUrl(...))` calls under `src/app/api/` with `apiFetch(...)`. Use 60 seconds for AI builder review and TTS; retain 15 seconds for normal CRUD calls.

Verification:

```powershell
rg -n "\bfetch\(" src/app/api -g '*.ts'
```

Expected: only the implementation in `request.ts` remains.

**Step 6: Run API and type tests**

Run:

```powershell
npm run test -- src/app/api
npm run typecheck
npm run lint
```

Expected: PASS.

**Step 7: Commit**

```powershell
git add src/app/api
git commit -m "refactor: centralize api request timeouts" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

---

### Task 3: Add a Root Route Error Boundary

**Files:**
- Create: `src/app/components/RouteErrorPage.tsx`
- Create: `src/app/components/RouteErrorPage.test.tsx`
- Modify: `src/app/routes.ts`
- Modify: `src/app/routes.test.ts`
- Reuse: `src/app/components/ui/button.tsx`

**Step 1: Write the failing route error test**

Test that the error page:

- renders a localized generic message;
- does not display raw exception text;
- offers “reload” and “return home” actions;
- includes a generated or supplied error reference.

**Step 2: Run the test and verify failure**

```powershell
npm run test -- src/app/components/RouteErrorPage.test.tsx src/app/routes.test.ts
```

Expected: FAIL because the component and root `errorElement` are missing.

**Step 3: Implement the boundary**

Use `useRouteError()` internally, but render only a generic message. Log the error through a small injectable helper so tests do not depend on `console.error`.

Add to the root route in `routes.ts`:

```tsx
{
  path: '/',
  Component: Layout,
  errorElement: <RouteErrorPage />,
  // existing children
}
```

**Step 4: Run focused tests and accessibility assertions**

```powershell
npm run test -- src/app/components/RouteErrorPage.test.tsx src/app/routes.test.ts
npm run typecheck
```

Expected: PASS; the error heading is discoverable by role and keyboard users can activate both actions.

**Step 5: Commit**

```powershell
git add src/app/components/RouteErrorPage.tsx src/app/components/RouteErrorPage.test.tsx src/app/routes.ts src/app/routes.test.ts
git commit -m "feat: add recoverable route error page" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

---

### Task 4: Add Structured Request Logging and Correlation IDs

**Files:**
- Create: `server/config/logger.js`
- Create: `server/config/logger.test.js`
- Create: `server/config/requestContext.js`
- Create: `server/config/requestContext.test.js`
- Modify: `server/config/middleware.js`
- Modify: `server/config/errorHandling.js`
- Modify: `server/config/errorHandling.test.js`
- Modify: `server/index.js`

**Step 1: Write failing sanitization tests**

Verify that logger output:

- is one JSON object per line;
- includes `timestamp`, `level`, `event`, and `requestId`;
- includes method, route, status, and duration for completed HTTP requests;
- redacts keys matching `authorization`, `cookie`, `token`, `secret`, `password`, `apiKey`, and `dataBase64` recursively;
- serializes errors as `{ name, message, stack }` only.

**Step 2: Run tests to verify failure**

```powershell
npm run test -- server/config/logger.test.js server/config/requestContext.test.js server/config/errorHandling.test.js
```

Expected: FAIL because the logger and request context do not exist.

**Step 3: Implement the logger**

Expose only:

```js
export function createLogger({ write = process.stdout.write.bind(process.stdout) } = {}) {
  return {
    info(event, fields = {}) {},
    warn(event, fields = {}) {},
    error(event, error, fields = {}) {},
  };
}
```

Keep this dependency-free. Centralize redaction and JSON serialization in `logger.js`.

**Step 4: Implement request context middleware**

- Accept a valid incoming `x-request-id` containing 1–128 URL-safe characters; otherwise generate `randomUUID()`.
- Set the response `X-Request-Id` header.
- Record status and elapsed milliseconds on `finish`.
- Do not log health checks at info level unless they fail.

**Step 5: Integrate sanitized internal errors**

Change `sendInternalError()` so callers may pass `req` or `requestId`, and so error logs flow through the structured logger. Keep the existing public `{ code, message }` response contract, adding only `requestId`.

**Step 6: Run focused tests**

```powershell
npm run test -- server/config/logger.test.js server/config/requestContext.test.js server/config/errorHandling.test.js server/config/middleware.test.js
npm run check:server
```

Expected: PASS and no test output contains authorization values or request bodies.

**Step 7: Commit**

```powershell
git add server/config/logger.js server/config/logger.test.js server/config/requestContext.js server/config/requestContext.test.js server/config/middleware.js server/config/errorHandling.js server/config/errorHandling.test.js server/index.js
git commit -m "feat: add structured request logging" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

---

### Task 5: Make Rate Limiting Safe for Multi-Instance Production

**Files:**
- Create: `server/security/redisRateLimitStore.js`
- Create: `server/security/redisRateLimitStore.test.js`
- Modify: `server/security/rateLimit.js`
- Modify: `server/security/rateLimit.test.js`
- Modify: `server/security/rateLimitIntegration.test.js`
- Modify: `server/config/env.js`
- Modify: `server/security/env.test.js`
- Modify: `server/config/deps.js`
- Modify: `server/index.js`
- Modify: `server/readiness.js`
- Modify: `server/readiness.test.js`
- Modify: `server/shutdown.js`
- Modify: `server/shutdown.test.js`
- Modify: `.env.example`
- Modify: `package.json`
- Modify: `package-lock.json`

**Step 1: Write the shared-store contract tests**

Define this interface:

```js
// consume() must be atomic for a given key.
// Return { allowed, retryAfterMs }.
store.consume({ namespace, key, limit, windowMs, now });
store.close();
store.checkReadiness();
```

Test that two limiter instances sharing one fake store enforce one combined limit.

**Step 2: Run tests and verify failure**

```powershell
npm run test -- server/security/rateLimit.test.js server/security/rateLimitIntegration.test.js
```

Expected: FAIL because limiters cannot accept a shared store.

**Step 3: Refactor the limiter around the store interface**

Keep the current bounded in-memory implementation as the development/test store. Make the Express middleware await `store.consume()` and call `next(error)` on store failures.

Do not silently fall back from Redis to memory in multi-instance production.

**Step 4: Add the Redis implementation**

Install the official Redis client:

```powershell
npm install redis
```

Use one Lua script to atomically increment the key, set `PEXPIRE` on the first request, and return count plus remaining TTL. Prefix keys with `mrei:rate-limit:<namespace>:` and store only hashed subject identifiers.

**Step 5: Add environment validation**

Add:

```text
REDIS_URL=
INSTANCE_COUNT=1
```

Rules:

- development and tests may use the in-memory store;
- production with `INSTANCE_COUNT=1` may use memory but logs a warning;
- production with `INSTANCE_COUNT>1` requires `REDIS_URL` and fails startup otherwise.

**Step 6: Wire readiness and shutdown**

- Readiness fails when the configured Redis store cannot respond.
- Shutdown closes Redis after HTTP and Socket.IO listeners stop accepting work.
- Tests use fakes; they must not require a real Redis server.

**Step 7: Run focused validation**

```powershell
npm run test -- server/security server/readiness.test.js server/shutdown.test.js
npm run check:server
```

Expected: PASS.

**Step 8: Commit**

```powershell
git add server/security server/config/env.js server/config/deps.js server/index.js server/readiness.js server/readiness.test.js server/shutdown.js server/shutdown.test.js .env.example package.json package-lock.json
git commit -m "feat: support shared production rate limits" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

---

### Task 6: Move Authentication from Persistent Web Storage to Secure Cookies

**Files:**
- Create: `server/auth/sessionCookie.js`
- Create: `server/auth/sessionCookie.test.js`
- Create: `server/security/csrf.js`
- Create: `server/security/csrf.test.js`
- Modify: `server/auth/jwt.js`
- Modify: `server/auth/jwt.test.js`
- Modify: `server/routes/authRoutes.js`
- Modify: `server/routes/authRoutes.test.js`
- Modify: `server/config/middleware.js`
- Modify: `server/config/middleware.test.js`
- Modify: `src/app/api/request.ts`
- Modify: `src/app/api/auth.ts`
- Modify: `src/app/auth.tsx`
- Modify: `src/app/auth.test.tsx`
- Modify: `.env.example`

**Step 1: Write cookie contract tests**

Test these properties:

- login and registration set `mrei_session` as `HttpOnly`, `Secure` in production, `SameSite=Lax`, `Path=/`, with a bounded max age;
- logout clears the cookie;
- `requireAuth` reads the cookie;
- Bearer auth remains accepted during one migration release;
- mutation requests authenticated by cookie require a valid CSRF header;
- Bearer-authenticated API clients are not forced to send the browser CSRF token.

**Step 2: Run tests and verify failure**

```powershell
npm run test -- server/auth/sessionCookie.test.js server/security/csrf.test.js server/routes/authRoutes.test.js
```

Expected: FAIL because cookie sessions and CSRF checks do not exist.

**Step 3: Implement cookie parsing without logging cookie values**

Use Express-compatible helpers to serialize and clear the cookie. Validate production options from `NODE_ENV`; never derive cookie security from request headers unless trusted proxy configuration is active.

**Step 4: Add CSRF protection for cookie-authenticated mutations**

Use a signed double-submit token:

- a readable `mrei_csrf` cookie contains a random nonce;
- the browser sends the same nonce in `X-CSRF-Token`;
- the server verifies the signed value using timing-safe comparison;
- apply to `POST`, `PUT`, `PATCH`, and `DELETE` after authentication.

Do not apply CSRF checks to health endpoints or Bearer-only machine clients.

**Step 5: Migrate the frontend**

- Set `credentials: 'include'` in `apiFetch`.
- Stop saving new JWT values to `localStorage` and `sessionStorage`.
- Read the CSRF cookie only to populate `X-CSRF-Token` on mutations.
- Bootstrap authentication using `/api/auth/me` rather than the presence of a stored token.
- Remove legacy stored values after a successful bootstrap.

**Step 6: Run auth and API tests**

```powershell
npm run test -- server/auth server/security/csrf.test.js server/routes/authRoutes.test.js src/app/api src/app/auth.test.tsx
npm run typecheck
npm run lint
```

Expected: PASS.

**Step 7: Commit**

```powershell
git add server/auth server/security/csrf.js server/security/csrf.test.js server/routes/authRoutes.js server/routes/authRoutes.test.js server/config/middleware.js server/config/middleware.test.js src/app/api src/app/auth.tsx src/app/auth.test.tsx .env.example
git commit -m "security: move browser sessions to secure cookies" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

---

### Task 7: Split Translation Catalogs from the React Provider

**Files:**
- Create: `src/app/i18n/catalogs/zh-TW.ts`
- Create: `src/app/i18n/catalogs/zh-CN.ts`
- Create: `src/app/i18n/catalogs/en.ts`
- Create: `src/app/i18n/catalogs/index.ts`
- Create: `src/app/i18n/catalogs/catalogs.test.ts`
- Modify: `src/app/components/I18nProvider.tsx`
- Modify: `src/app/components/I18nProvider.test.tsx`

**Step 1: Write catalog parity tests**

Assert that all locale catalogs have exactly the same keys as `zh-TW`, contain no empty values, and preserve interpolation placeholders such as `{name}` across locales.

**Step 2: Run the test and verify failure**

```powershell
npm run test -- src/app/i18n/catalogs/catalogs.test.ts
```

Expected: FAIL because catalog modules do not exist.

**Step 3: Move dictionaries without editing translations**

Move data only. `I18nProvider.tsx` should retain locale selection, persistence, interpolation, context creation, and the provider component. It should import `dictionaries` and the shared `MessageKey` type from `catalogs/index.ts`.

**Step 4: Verify no key or text changed**

```powershell
npm run test -- src/app/i18n/catalogs/catalogs.test.ts src/app/components/I18nProvider.test.tsx
npm run typecheck
```

Expected: PASS; UI snapshots and translation results are unchanged.

**Step 5: Commit**

```powershell
git add src/app/i18n src/app/components/I18nProvider.tsx src/app/components/I18nProvider.test.tsx
git commit -m "refactor: split translation catalogs" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

---

### Task 8: Split SQLite Repositories Behind the Existing Facade

**Files:**
- Create: `server/repositories/sqliteHelpers.js`
- Create: `server/repositories/userRepository.js`
- Create: `server/repositories/galleryRepository.js`
- Create: `server/repositories/mediaRepository.js`
- Create: `server/repositories/growthRepository.js`
- Create: `server/repositories/competitionRepository.js`
- Create: `server/repositories/visitorMemoryRepository.js`
- Modify: `server/db.js`
- Test: existing `server/**/*.test.js` database and route tests

**Step 1: Add a facade compatibility test**

Create a test that imports every currently exported database function from `server/db.js` and asserts representative user, gallery, media, growth, competition, and visitor-memory operations still work against an in-memory database.

Do not change route imports in this task.

**Step 2: Run the compatibility test before extraction**

```powershell
npm run test -- server/dataIntegrity.test.js server/dbInitialization.test.js server/dbMigrations.test.js
```

Expected: PASS, establishing the behavior baseline.

**Step 3: Extract promise helpers**

Move `runStatement`, `getStatement`, and `allStatement` to `repositories/sqliteHelpers.js`. Preserve their rejection behavior and callback `this.lastID`/`this.changes` semantics.

**Step 4: Extract one domain at a time**

Order:

1. users and cleanup jobs;
2. galleries and comments;
3. media;
4. growth memories;
5. competitions and votes;
6. visitor memory.

After each extraction, re-export the same function names from `db.js` and run the relevant existing tests. Do not introduce classes or a generic repository abstraction.

**Step 5: Run the complete server data suite**

```powershell
npm run test -- server/dbInitialization.test.js server/dbMigrations.test.js server/dataIntegrity.test.js server/mediaAssetsDb.test.js server/routes server/services
npm run check:server
npm run lint
```

Expected: PASS with no route import changes and no SQL behavior changes.

**Step 6: Commit**

```powershell
git add server/db.js server/repositories server/dbInitialization.test.js server/dbMigrations.test.js server/dataIntegrity.test.js
git commit -m "refactor: split sqlite repositories" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

---

### Task 9: Reduce Server Syntax Check Wall Time

**Files:**
- Modify: `scripts/check-server-syntax.mjs`
- Create: `scripts/check-server-syntax.test.mjs`
- Modify: `package.json` only if a focused script is needed

**Step 1: Write a failing concurrency test**

Extract a `checkFiles(files, { concurrency, runCheck })` function and test that:

- it never exceeds configured concurrency;
- it reports every failed file;
- it waits for all active checks before resolving;
- one failure produces exit code 1.

Use injected fake checks; do not spawn real Node processes in the unit test.

**Step 2: Run the test and verify failure**

```powershell
npm run test -- scripts/check-server-syntax.test.mjs
```

Expected: FAIL because `checkFiles` does not exist.

**Step 3: Implement bounded parallel syntax checks**

Use asynchronous `spawn`, not `spawnSync`, with a default concurrency of `min(4, availableParallelism())`. Keep output deterministic by collecting results and sorting failures by relative path before printing.

**Step 4: Validate correctness and timing**

```powershell
npm run test -- scripts/check-server-syntax.test.mjs
Measure-Command { npm run check:server }
```

Expected: tests pass and the command completes materially faster than the previous serial implementation while checking all server JavaScript files.

**Step 5: Commit**

```powershell
git add scripts/check-server-syntax.mjs scripts/check-server-syntax.test.mjs package.json
git commit -m "perf: parallelize server syntax checks" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

---

### Task 10: Complete Release Verification

**Files:**
- Update: `docs/plans/2026-07-21-production-hardening-remediation.md`
- Modify other files only when a failing check demonstrates a concrete defect

**Step 1: Run the full quality gate from a clean checkout**

```powershell
npm ci
npm run check
```

Expected, in order:

- server syntax passes;
- TypeScript passes;
- ESLint passes with zero warnings;
- all Vitest files pass with zero failed tests;
- production build passes;
- all bundle budgets pass.

**Step 2: Run focused security validation**

```powershell
npm run test -- server/security server/auth server/config/middleware.test.js server/config/errorHandling.test.js server/routes/authRoutes.test.js server/routes/mediaRoutes.test.js
```

Expected: PASS.

**Step 3: Run production configuration checks**

Start the server once with intentionally invalid production values and confirm startup fails. Then start with valid secrets, explicit HTTPS origins, and the intended rate-limit configuration.

Never print secret values in the terminal or documentation.

**Step 4: Run browser smoke tests**

Verify:

1. register, login, reload, logout, and expired-session behavior;
2. gallery creation, save, publish, and share links;
3. media upload rejects MIME mismatch and oversized files;
4. 3D edit, undo/redo, WebGL recovery, and avatar fallback;
5. multiplayer join, authorization refresh, scene operation, and reconnect;
6. AI builder and TTS success, timeout, rate-limit, and provider-error states;
7. route render failure shows the new recoverable error page.

**Step 5: Verify repository hygiene**

```powershell
git status --short
git diff --check
git ls-files .env 'server/uploads/**' '*.db' '*.db-shm' '*.db-wal' dist build
```

Expected: clean worktree, no whitespace errors, and no runtime or build artifacts tracked.

**Step 6: Record evidence**

Append the date, commit SHA, Node/npm versions, test count, build result, bundle measurements, and smoke-test result to this document. Record failures honestly; do not replace missing evidence with “expected pass.”

**Step 7: Commit verification evidence**

```powershell
git add docs/plans/2026-07-21-production-hardening-remediation.md
git commit -m "docs: record production hardening verification" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

---

## Deferred Follow-ups

These are valuable but should not block the first hardened release unless profiling or incidents justify them:

- Split `useMetaverseStudioStore.ts` into additional Zustand slices after store behavior is covered by integration tests.
- Split `socketServer.js` into authorization, presence, scene-sync, and transport modules without changing the wire protocol.
- Add OpenTelemetry or a hosted observability backend after the dependency-free logging contract is stable.
- Replace fixed-window rate limiting with a sliding-window policy only if production traffic shows unfair boundary bursts.
- Add automatic retries only for explicitly idempotent reads and only after measuring real transient-failure rates.

## Final Definition of Done

This remediation is complete only when:

```text
clean checkout
  -> npm ci
  -> npm run check
  -> focused security suite
  -> production configuration test
  -> browser smoke test
  -> clean git status
```

Every arrow must have recorded evidence from the same commit.
