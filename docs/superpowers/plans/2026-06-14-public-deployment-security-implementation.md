# Public Deployment Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish server-enforced authorization for HTTP and multiplayer access so the application can be prepared for public deployment.

**Architecture:** Add small reusable security modules for environment validation, optional JWT parsing, gallery access resolution, and fixed-window rate limiting. HTTP routes and Socket.IO both consume the same JWT and gallery-access helpers; the client supplies credentials but never decides its own role.

**Tech Stack:** Node.js ESM, Express 5, Socket.IO 4, JSON Web Tokens, Zod, Vitest, React 18, TypeScript

---

## File Map

- Create `server/security/galleryAccess.js`: resolve owner, viewer-share, editor-share, authenticated participant, and anonymous public access.
- Create `server/security/rateLimit.js`: reusable in-memory fixed-window middleware and event limiter.
- Create `server/security/env.test.js`: production secret validation regression tests.
- Create `server/security/galleryAccess.test.js`: access-resolution unit tests.
- Create `server/security/rateLimit.test.js`: limiter behavior tests.
- Create `server/routes/galleryRoutes.test.js`: private comment and public comment access tests.
- Create `server/routes/competitionRoutes.test.js`: approved-entry and admin-secret tests.
- Create `server/multiplayer/socketServer.test.js`: Socket.IO admission and event authorization tests.
- Modify `server/config/env.js`: validate production JWT/CORS configuration.
- Modify `server/auth/jwt.js`: expose token verification and optional request authentication.
- Modify `server/config/deps.js`: expose shared data dependencies to security-aware routes.
- Modify `server/config/middleware.js`: accept configured CORS origins and global security middleware.
- Modify `server/index.js`: construct and inject shared security dependencies.
- Modify `server/routes/authRoutes.js`: rate-limit login and registration.
- Modify `server/routes/galleryRoutes.js`: authorize comment reads and writes.
- Modify `server/routes/growthRoutes.js`: rate-limit shared comments and uploads.
- Modify `server/routes/competitionRoutes.js`: filter public entries and harden admin access and voting.
- Modify `server/routes/agentRoutes.js`: rate-limit model requests.
- Modify `server/routes/ttsRoutes.js`: rate-limit TTS requests.
- Modify `server/multiplayer/socketServer.js`: authenticate handshake, authorize rooms/events, and bound scene payloads.
- Modify `src/app/modules/metaverse3d/network/socketClient.ts`: send JWT and share token to Socket.IO.
- Modify `src/app/modules/metaverse3d/network/multiplayerStore.ts`: retain the current share token and server-derived room role.
- Modify `src/app/modules/metaverse3d/network/protocol.ts`: define room role and error payloads.
- Modify `.env.example`: document secure production settings.
- Modify Git index for `server/app.db`: stop tracking the ignored runtime database without deleting the local file.

### Task 1: Production Environment And Shared JWT Verification

**Files:**
- Test: `server/security/env.test.js`
- Modify: `server/config/env.js`
- Modify: `server/auth/jwt.js`
- Modify: `.env.example`

- [ ] **Step 1: Write failing environment tests**

Create table-driven tests that call an exported `validateSecurityEnv(env)` function and assert:

```js
expect(() => validateSecurityEnv({ NODE_ENV: 'production' }))
  .toThrow(/JWT_SECRET/);

expect(() => validateSecurityEnv({
  NODE_ENV: 'production',
  JWT_SECRET: 'change-me',
})).toThrow(/JWT_SECRET/);

expect(() => validateSecurityEnv({
  NODE_ENV: 'production',
  JWT_SECRET: 'x'.repeat(32),
  FRONTEND_ORIGIN: 'https://example.com',
  MULTIPLAYER_CORS_ORIGIN: 'https://example.com',
})).not.toThrow();
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run server/security/env.test.js`

Expected: FAIL because `validateSecurityEnv` is not exported.

- [ ] **Step 3: Implement strict production validation**

Export `validateSecurityEnv(env)` from `server/config/env.js`. Reject missing,
shorter-than-32, and known placeholder secrets in production. Reject wildcard or
missing production CORS origins. Keep an explicit development fallback with a
warning.

Extend `createJwtHelpers` with:

```js
function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}

function optionalAuth(req) {
  const match = (req.header('authorization') || '').match(/^Bearer\s+(.+)$/i);
  return match ? verifyToken(match[1]) : null;
}
```

Make `requireAuth` delegate to `verifyToken` so HTTP and Socket.IO share the
same verification behavior.

- [ ] **Step 4: Verify GREEN**

Run: `npx vitest run server/security/env.test.js`

Expected: all environment tests PASS.

- [ ] **Step 5: Document environment variables**

Update `.env.example` with a 32-character placeholder description,
`FRONTEND_ORIGIN`, non-wildcard multiplayer origin, `ADMIN_SECRET`, and comments
that production refuses insecure values.

### Task 2: Gallery Access Resolver

**Files:**
- Create: `server/security/galleryAccess.js`
- Test: `server/security/galleryAccess.test.js`

- [ ] **Step 1: Write failing role-resolution tests**

Cover these exact results:

```js
expect(resolveGalleryAccess({ gallery: published, auth: null, share: null }))
  .toMatchObject({ allowed: true, role: 'viewer', authenticated: false });

expect(resolveGalleryAccess({ gallery: privateGallery, auth: null, share: null }))
  .toMatchObject({ allowed: false, reason: 'authentication_required' });

expect(resolveGalleryAccess({ gallery: privateGallery, auth: owner, share: null }))
  .toMatchObject({ allowed: true, role: 'owner' });

expect(resolveGalleryAccess({ gallery: privateGallery, auth: null, share: viewerShare }))
  .toMatchObject({ allowed: true, role: 'viewer' });

expect(resolveGalleryAccess({ gallery: privateGallery, auth: null, share: editorShare }))
  .toMatchObject({ allowed: true, role: 'editor' });

expect(resolveGalleryAccess({ gallery: privateGallery, auth: null, share: expiredShare }))
  .toMatchObject({ allowed: false, reason: 'share_expired' });
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run server/security/galleryAccess.test.js`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the pure resolver**

Implement:

```js
export function resolveGalleryAccess({ gallery, auth, share, now = Date.now() })
```

The function must not query the database or write a response. It returns
`allowed`, `role`, `authenticated`, and a stable `reason` when denied. A share
record is accepted only when it belongs to the same gallery and is not expired.

- [ ] **Step 4: Verify GREEN**

Run: `npx vitest run server/security/galleryAccess.test.js`

Expected: all role-resolution tests PASS.

### Task 3: Reusable Rate Limiting

**Files:**
- Create: `server/security/rateLimit.js`
- Test: `server/security/rateLimit.test.js`
- Modify: `server/config/middleware.js`
- Modify: `server/routes/authRoutes.js`
- Modify: `server/routes/growthRoutes.js`
- Modify: `server/routes/competitionRoutes.js`
- Modify: `server/routes/agentRoutes.js`
- Modify: `server/routes/ttsRoutes.js`

- [ ] **Step 1: Write failing limiter tests**

Use an injected clock and assert that the first two requests pass, the third
returns `429`, and requests pass again after the window:

```js
const limiter = createFixedWindowLimiter({
  limit: 2,
  windowMs: 1000,
  now: () => now,
  key: () => 'client',
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run server/security/rateLimit.test.js`

Expected: FAIL because `createFixedWindowLimiter` does not exist.

- [ ] **Step 3: Implement the limiter**

Provide:

```js
createFixedWindowLimiter(options) // Express middleware
createRateTokenConsumer(options)  // Socket.IO/event use
```

Set `Retry-After` for HTTP responses and periodically discard expired keys.

- [ ] **Step 4: Verify GREEN**

Run: `npx vitest run server/security/rateLimit.test.js`

Expected: limiter tests PASS.

- [ ] **Step 5: Apply endpoint-specific limits**

Apply distinct limiter instances to registration/login, gallery/shared growth
comments, voting, agent, and TTS endpoints. Use `req.ip` plus authenticated user
ID when available as the key. Keep values configurable through environment
variables with conservative defaults.

### Task 4: Gallery Comment Authorization

**Files:**
- Test: `server/routes/galleryRoutes.test.js`
- Modify: `server/routes/galleryRoutes.js`
- Modify: `server/config/deps.js`
- Modify: `server/index.js`

- [ ] **Step 1: Write failing route tests**

Mount `registerGalleryRoutes` on a real Express app with dependency functions
backed by in-memory records. Verify:

```text
GET private gallery comments without credentials -> 401
POST private gallery comment without credentials -> 401
GET published gallery comments anonymously -> 200
POST published gallery comment anonymously -> 201
GET private gallery comments with owner JWT -> 200
GET private gallery comments with valid viewer share token -> 200
```

Supply share tokens through `x-gallery-share-token`, never a query parameter.

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run server/routes/galleryRoutes.test.js`

Expected: private comment tests FAIL because the current routes allow access.

- [ ] **Step 3: Implement a route-local access guard**

Add one helper inside `registerGalleryRoutes` that:

1. loads the gallery,
2. reads optional JWT through `optionalAuth`,
3. resolves an optional share token through `getGalleryByShareToken`,
4. calls `resolveGalleryAccess`,
5. maps denial reasons to `401`, `403`, or `410`.

Use it for comment GET and POST before querying or inserting comments.

- [ ] **Step 4: Verify GREEN**

Run: `npx vitest run server/routes/galleryRoutes.test.js`

Expected: all gallery route tests PASS.

### Task 5: Competition Visibility And Administrator Checks

**Files:**
- Test: `server/routes/competitionRoutes.test.js`
- Modify: `server/routes/competitionRoutes.js`

- [ ] **Step 1: Write failing competition tests**

Verify:

```text
public competition detail returns only approved entries
empty ADMIN_SECRET never grants admin access
wrong ADMIN_SECRET returns 403
admin endpoint without JWT returns 401
creator management endpoint returns pending and rejected entries
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run server/routes/competitionRoutes.test.js`

Expected: the public filtering and empty-secret assertions FAIL.

- [ ] **Step 3: Implement minimal fixes**

For public detail, always filter entries to `status === 'approved'`.

Replace direct secret comparisons with:

```js
function hasAdminSecret(req) {
  const configured = String(process.env.ADMIN_SECRET || '').trim();
  const provided = String(req.headers['x-admin-secret'] || '').trim();
  return configured.length >= 16 && provided === configured;
}
```

Require a valid JWT before admin endpoints evaluate the admin secret. Preserve
creator access through creator-scoped authenticated endpoints.

- [ ] **Step 4: Verify GREEN**

Run: `npx vitest run server/routes/competitionRoutes.test.js`

Expected: all competition tests PASS.

### Task 6: Socket.IO Room Authorization

**Files:**
- Test: `server/multiplayer/socketServer.test.js`
- Modify: `server/multiplayer/socketServer.js`
- Modify: `server/multiplayer/rooms.js`
- Modify: `server/index.js`

- [ ] **Step 1: Write failing Socket.IO integration tests**

Start the multiplayer server on an ephemeral port and connect real
`socket.io-client` instances. Inject gallery lookup and token verification
functions. Verify:

```text
anonymous client joins published gallery as viewer
anonymous client cannot join private gallery
authenticated non-owner joins published gallery as participant
anonymous viewer scene:op is rejected and not broadcast
authenticated participant chat is broadcast
owner scene:op is acknowledged and broadcast
viewer-share scene:op is rejected
editor-share scene:op is acknowledged and broadcast
expired share token is rejected
```

Also assert `room:error` contains stable codes such as
`AUTH_REQUIRED`, `FORBIDDEN`, and `SHARE_EXPIRED`.

- [ ] **Step 2: Run the tests and verify RED**

Run: `npx vitest run server/multiplayer/socketServer.test.js`

Expected: authorization assertions FAIL because all sockets can currently edit.

- [ ] **Step 3: Make server startup testable**

Change `startMultiplayerServer` to accept injected dependencies and return:

```js
{
  io,
  httpServer,
  close: () => Promise<void>,
  port: () => httpServer.address()?.port,
}
```

Production continues to call the same function from `server/index.js`.

- [ ] **Step 4: Authorize room joins**

Read JWT from `socket.handshake.auth.token` and share token from the join
payload. Resolve gallery access before `socket.join`. Store:

```js
socket.data.galleryId
socket.data.role
socket.data.auth
```

Ignore client-provided host/editor flags.

- [ ] **Step 5: Authorize events and bound scene payloads**

Require:

```text
player:move -> any admitted role
chat:send -> participant/editor/owner
scene:sync -> editor/owner
scene:op -> editor/owner
scene:focus -> editor/owner
```

Reject scenes over configured item/floor-plan counts or serialized byte size.
Add a scene-operation token consumer in addition to existing move/chat limits.

- [ ] **Step 6: Verify GREEN**

Run: `npx vitest run server/multiplayer/socketServer.test.js`

Expected: all multiplayer authorization tests PASS and servers close cleanly.

### Task 7: Client Multiplayer Credentials And Server Role

**Files:**
- Modify: `src/app/modules/metaverse3d/network/protocol.ts`
- Modify: `src/app/modules/metaverse3d/network/multiplayerStore.ts`
- Modify: `src/app/modules/metaverse3d/network/socketClient.ts`
- Test: `src/app/modules/metaverse3d/network/socketClient.test.ts`

- [ ] **Step 1: Write failing client tests**

Mock only the Socket.IO transport boundary and verify:

```text
connectMultiplayer passes the current auth JWT in handshake.auth.token
joinCurrentRoom includes the current share token
room:joined stores the server-provided role
room:error is stored for UI consumption
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run src/app/modules/metaverse3d/network/socketClient.test.ts`

Expected: FAIL because credentials and role are not part of the protocol.

- [ ] **Step 3: Extend the protocol and store**

Add:

```ts
export type MultiplayerRole = "viewer" | "participant" | "editor" | "owner";
export type RoomErrorPayload = { code: string; message: string };
```

Add `shareToken`, `role`, and `roomError` to the multiplayer store. Replace
authorization uses of `isHost` with the server role while retaining `isHost`
only if it still controls non-security UI presentation.

- [ ] **Step 4: Send credentials**

Load the JWT through the existing `loadAuth()` helper and pass it through
Socket.IO `auth`. Include `shareToken` in `room:join`. Listen for `room:error`
and store it.

- [ ] **Step 5: Verify GREEN**

Run: `npx vitest run src/app/modules/metaverse3d/network/socketClient.test.ts`

Expected: all client multiplayer tests PASS.

### Task 8: Runtime Database Tracking

**Files:**
- Modify Git index: `server/app.db`
- Verify: `.gitignore`

- [ ] **Step 1: Verify the database is ignored but tracked**

Run:

```powershell
git check-ignore -v server/app.db
git ls-files server/app.db
```

Expected: `.gitignore` matches and `git ls-files` still prints the database.

- [ ] **Step 2: Stop tracking without deleting local data**

Run:

```powershell
git rm --cached -- server/app.db
```

Expected: Git stages deletion while `Test-Path server/app.db` remains `True`.

- [ ] **Step 3: Record deployment warning**

Add a short section to `doc/README.md` stating that public deployment requires
reviewing and potentially purging the database from Git history, rotating
credentials, and backing up runtime storage.

### Task 9: Full Verification

**Files:**
- Modify as required by failing checks only.

- [ ] **Step 1: Run focused security tests**

Run:

```powershell
npx vitest run server/security server/routes/galleryRoutes.test.js server/routes/competitionRoutes.test.js server/multiplayer/socketServer.test.js src/app/modules/metaverse3d/network/socketClient.test.ts
```

Expected: all focused tests PASS with no open handles.

- [ ] **Step 2: Run complete project check**

Run:

```powershell
npm run check
```

Expected: server syntax check passes, all Vitest tests pass, and Vite production
build exits successfully. Existing large-chunk warnings may remain but no new
errors are accepted.

- [ ] **Step 3: Inspect the final diff**

Run:

```powershell
git diff --check
git status --short
git diff -- server src/app/modules/metaverse3d/network .env.example doc/README.md
```

Expected: no whitespace errors; changes are limited to security work plus the
already-approved design and plan documents. Do not revert unrelated user
changes.

- [ ] **Step 4: Report residual deployment work**

Report that TLS termination, persistent backup configuration, distributed rate
limiting for multi-instance deployment, and coordinated Git-history cleanup are
operational deployment tasks not completed by this code change.
