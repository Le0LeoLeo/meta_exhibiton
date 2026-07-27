# Multiplayer Horizontal Collaboration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate split-brain multiplayer rooms by making multi-instance collaboration use Redis-backed Socket.IO broadcasting, shared presence, and versioned atomic scene state, while keeping the current in-memory path for one-instance deployments.

**Architecture:** SQLite remains the canonical store for saved galleries. Live collaboration uses an asynchronous room-scene store: memory for one process, Redis for multiple processes. Socket.IO's Redis adapter carries chat, focus, presence, and scene broadcasts across nodes; scene writes use compare-and-set versioning so concurrent edits cannot silently overwrite one another. Production startup fails closed whenever `INSTANCE_COUNT > 1` is configured without the complete shared-collaboration stack.

**Tech Stack:** Node.js ESM, Express 5, Socket.IO 4, `@socket.io/redis-adapter`, Redis 6 client, SQLite, Vitest.

**Implementation status (2026-07-27):** Complete. Server syntax, TypeScript,
ESLint, the production build, bundle budgets, and the full Vitest suite pass
(987 passed, 1 skipped). The skipped test is the opt-in two-node Redis
integration test because this workstation has no Docker, Podman, local Redis,
or `REDIS_TEST_URL`; run `npm run test:multiplayer:redis` against Redis before
production rollout. No commit was created because the worktree contains
unrelated user changes.

---

## Scope and acceptance criteria

This plan fixes the production risk documented in:

- `server/config/env.js`: multi-instance configuration currently verifies only the rate-limit Redis connection.
- `server/multiplayer/rooms.js`: players and scenes currently live in module-level `Map` objects.
- `server/multiplayer/socketServer.js`: broadcasts currently assume one Socket.IO process.

The completed implementation must satisfy all of the following:

1. A one-instance deployment works without Redis and preserves current behavior.
2. Production refuses to start with `INSTANCE_COUNT > 1` unless Redis collaboration is explicitly enabled.
3. Two multiplayer server instances connected to the same Redis see the same room members and live scene.
4. Join, leave, move, chat, focus, `scene:sync`, and `scene:op` events cross instance boundaries.
5. Concurrent scene operations are serialized with monotonically increasing versions; no accepted operation is silently lost.
6. A client ignores duplicate or older scene versions and requests a fresh snapshot if it detects a version gap.
7. Redis connection failure prevents a multi-instance server from becoming ready.
8. Redis clients and Socket.IO adapters close during graceful shutdown.
9. The saved gallery continues to be written through the existing SQLite/API flow; Redis state remains ephemeral and receives a bounded TTL.
10. Existing public Socket.IO event names remain compatible. New version fields are additive.

Out of scope:

- Replacing SQLite with a distributed database.
- CRDT/OT-based offline editing.
- Persisting chat history.
- Changing gallery ownership, share-token, or editor-role rules.
- Supporting collaboration when Redis is unavailable in multi-instance mode.

## Target runtime model

```text
Browser A ── Socket.IO ── Node instance 1 ─┐
                                           ├─ Redis adapter: cross-node events/presence
Browser B ── Socket.IO ── Node instance 2 ─┤
                                           └─ Redis scene store: versioned live snapshot

Node instances ── existing REST save flow ── SQLite canonical gallery scene
```

Redis key shape:

```text
mrei:multiplayer:scene:<sha256(roomId)>
```

Stored value:

```json
{
  "version": 17,
  "updatedAt": 1785142800000,
  "scene": {
    "roomSize": {},
    "items": [],
    "floorPlanElements": [],
    "wallMaterialOverrides": {}
  }
}
```

Default live-scene TTL: 3,600 seconds. Every accepted sync or operation refreshes the TTL. SQLite remains the recovery source after expiry.

---

### Task 1: Add fail-closed collaboration configuration

**Files:**

- Modify: `server/config/env.js`
- Modify: `server/security/env.test.js`
- Modify: `.env.example`

**Step 1: Write failing production-configuration tests**

Add tests covering:

```js
it('rejects multiple instances unless Redis collaboration is enabled', () => {
  expect(() => validateSecurityEnv({
    ...validProductionEnv,
    INSTANCE_COUNT: '2',
    REDIS_URL: 'redis://redis.internal:6379',
    MULTIPLAYER_SHARED_STATE: 'memory',
  })).toThrow(/MULTIPLAYER_SHARED_STATE/);
});

it('accepts multiple instances with Redis collaboration', () => {
  expect(validateSecurityEnv({
    ...validProductionEnv,
    INSTANCE_COUNT: '2',
    REDIS_URL: 'redis://redis.internal:6379',
    MULTIPLAYER_SHARED_STATE: 'redis',
  })).toMatchObject({
    INSTANCE_COUNT: 2,
    MULTIPLAYER_SHARED_STATE: 'redis',
  });
});
```

Also test that an unsupported value such as `MULTIPLAYER_SHARED_STATE=sqlite` is rejected.

**Step 2: Run the tests and verify failure**

Run:

```bash
npm run test -- server/security/env.test.js
```

Expected: FAIL because `MULTIPLAYER_SHARED_STATE` is not validated or returned.

**Step 3: Add the minimal configuration contract**

Implement these rules:

```js
const sharedState = String(
  env.MULTIPLAYER_SHARED_STATE || 'memory',
).trim().toLowerCase();

if (!new Set(['memory', 'redis']).has(sharedState)) {
  throw new Error('MULTIPLAYER_SHARED_STATE must be memory or redis');
}
if (isProduction && INSTANCE_COUNT > 1 && sharedState !== 'redis') {
  throw new Error(
    'MULTIPLAYER_SHARED_STATE=redis is required when INSTANCE_COUNT is greater than 1',
  );
}
if (sharedState === 'redis' && !REDIS_URL) {
  throw new Error('REDIS_URL is required for Redis multiplayer shared state');
}
```

Return `MULTIPLAYER_SHARED_STATE` from `validateSecurityEnv()` and `loadEnv()`.

Document:

```dotenv
# Use memory for one Node process. Use redis for two or more processes.
MULTIPLAYER_SHARED_STATE=memory
MULTIPLAYER_SCENE_TTL_SECONDS=3600
```

**Step 4: Run the test and verify success**

Run:

```bash
npm run test -- server/security/env.test.js
```

Expected: PASS.

**Step 5: Commit**

```bash
git add server/config/env.js server/security/env.test.js .env.example
git commit -m "fix: fail closed for multi-instance collaboration" \
  -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

---

### Task 2: Extract an asynchronous live-scene store contract

**Files:**

- Create: `server/multiplayer/sceneState.js`
- Create: `server/multiplayer/memorySceneStore.js`
- Create: `server/multiplayer/memorySceneStore.test.js`
- Modify: `server/multiplayer/rooms.js`

**Step 1: Write failing store-contract tests**

Test the following sequence:

```js
const store = createMemorySceneStore({ ttlMs: 60_000 });
const initial = await store.initialize('gallery-1', initialScene);
expect(initial.version).toBe(1);

const first = await store.applyOperation('gallery-1', addItemOp, validateScene);
const second = await store.applyOperation('gallery-1', updateItemOp, validateScene);

expect(first.version).toBe(2);
expect(second.version).toBe(3);
expect((await store.get('gallery-1')).scene.items[0].title).toBe('Updated');
```

Also test:

- `initialize()` does not overwrite an existing live scene.
- An invalid operation returns `{ accepted: false, reason: 'invalid_scene' }`.
- Two concurrent `applyOperation()` calls both survive and receive distinct versions.
- `replace()` increments the version.
- `delete()` and `close()` are idempotent.

**Step 2: Run the test and verify failure**

Run:

```bash
npm run test -- server/multiplayer/memorySceneStore.test.js
```

Expected: FAIL because the store does not exist.

**Step 3: Extract the pure scene transition**

Move only scene-copy and operation-application logic from `rooms.js` into:

```js
export function applySceneOperation(currentScene, op) {
  // Return a new scene without mutating currentScene.
  // Return null for unsupported operations.
}
```

Keep nickname normalization in `rooms.js` until player presence is migrated. Do not duplicate scene-operation rules between memory and Redis stores.

**Step 4: Implement the in-memory store**

Required interface:

```ts
type SceneStore = {
  initialize(roomId, scene): Promise<VersionedScene>;
  get(roomId): Promise<VersionedScene | null>;
  replace(roomId, scene, validateScene): Promise<WriteResult>;
  applyOperation(roomId, op, validateScene): Promise<WriteResult>;
  delete(roomId): Promise<void>;
  checkReadiness(): Promise<void>;
  close(): Promise<void>;
};
```

Serialize writes per room with a promise chain. Remove the chain after completion so the lock map cannot grow forever.

**Step 5: Run the store tests**

Run:

```bash
npm run test -- server/multiplayer/memorySceneStore.test.js
```

Expected: PASS.

**Step 6: Commit**

```bash
git add server/multiplayer/sceneState.js server/multiplayer/memorySceneStore.js \
  server/multiplayer/memorySceneStore.test.js server/multiplayer/rooms.js
git commit -m "refactor: define multiplayer scene store contract" \
  -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

---

### Task 3: Implement Redis scene state with atomic compare-and-set

**Files:**

- Create: `server/multiplayer/redisSceneStore.js`
- Create: `server/multiplayer/redisSceneStore.test.js`
- Reuse: `server/multiplayer/sceneState.js`

**Step 1: Write failing Redis-store unit tests**

Use an injected Redis client/fake implementing `get`, `set`, `eval`, `ping`, and `quit`. Test:

- Initialization uses `SET ... NX EX`.
- `get()` rejects malformed stored JSON instead of returning an unsafe scene.
- A successful operation increments the stored version.
- A CAS conflict reloads, reapplies, and retries.
- Retry exhaustion returns `{ accepted: false, reason: 'conflict' }`.
- Each accepted write refreshes TTL.
- Redis errors reject; they must never fall back to a per-process map.

**Step 2: Run and verify failure**

Run:

```bash
npm run test -- server/multiplayer/redisSceneStore.test.js
```

Expected: FAIL because `redisSceneStore.js` does not exist.

**Step 3: Implement hashed keys and bounded parsing**

```js
function roomKey(roomId) {
  const hash = createHash('sha256').update(roomId).digest('hex');
  return `mrei:multiplayer:scene:${hash}`;
}
```

Reject values larger than the existing multiplayer scene byte limit before parsing. Validate the decoded envelope and validate `scene` with the same `validateScene` callback used by Socket.IO.

**Step 4: Implement atomic CAS**

Use a Lua script equivalent to:

```lua
local current = redis.call('GET', KEYS[1])
if not current then
  return {0, 'missing'}
end
local decoded = cjson.decode(current)
if tonumber(decoded.version) ~= tonumber(ARGV[1]) then
  return {0, tostring(decoded.version)}
end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
return {1, tostring(ARGV[1] + 1)}
```

Apply and validate the operation locally, then CAS the complete envelope. Retry at most five times with the newly loaded state. Never acknowledge an operation that did not win the CAS.

**Step 5: Run tests**

Run:

```bash
npm run test -- server/multiplayer/redisSceneStore.test.js
```

Expected: PASS.

**Step 6: Commit**

```bash
git add server/multiplayer/redisSceneStore.js server/multiplayer/redisSceneStore.test.js
git commit -m "feat: add atomic Redis multiplayer scene state" \
  -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

---

### Task 4: Add the Socket.IO Redis adapter lifecycle

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `server/multiplayer/redisCollaboration.js`
- Create: `server/multiplayer/redisCollaboration.test.js`
- Modify: `server/multiplayer/serverStartup.js`
- Modify: `server/multiplayer/serverStartup.test.js`

**Step 1: Install the declared adapter**

Run:

```bash
npm install @socket.io/redis-adapter
```

Expected: `package.json` and `package-lock.json` contain the adapter.

**Step 2: Write failing lifecycle tests**

Test that:

- Publisher, subscriber, and scene clients connect before the multiplayer server becomes ready.
- `io.adapter(createAdapter(pubClient, subClient))` is called once.
- Any connection failure rejects startup.
- Partial startup closes every already-open client.
- `close()` is idempotent and calls `quit()` for all owned clients.

**Step 3: Run and verify failure**

Run:

```bash
npm run test -- server/multiplayer/redisCollaboration.test.js \
  server/multiplayer/serverStartup.test.js
```

Expected: FAIL because the lifecycle helper does not exist.

**Step 4: Implement the lifecycle helper**

Expose:

```js
export function createRedisCollaboration({
  url,
  createRedisClient = (options) => createClient(options),
  createSocketAdapter = createAdapter,
}) {
  return {
    async attach(io) {},
    createSceneStore(options) {},
    async checkReadiness() {},
    async close() {},
  };
}
```

Use separate Redis connections for adapter pub/sub and scene commands. Do not reuse the rate-limit store's private client.

**Step 5: Make multiplayer readiness await collaboration**

Allow `startMultiplayer()` to return its current server handle immediately, but ensure its `ready` promise resolves only after:

1. Redis collaboration attaches successfully.
2. Redis and scene-store readiness checks pass.
3. The HTTP listener starts.

**Step 6: Run tests**

Run:

```bash
npm run test -- server/multiplayer/redisCollaboration.test.js \
  server/multiplayer/serverStartup.test.js
```

Expected: PASS.

**Step 7: Commit**

```bash
git add package.json package-lock.json server/multiplayer/redisCollaboration.js \
  server/multiplayer/redisCollaboration.test.js server/multiplayer/serverStartup.js \
  server/multiplayer/serverStartup.test.js
git commit -m "feat: attach Redis adapter before multiplayer readiness" \
  -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

---

### Task 5: Replace process-local player maps with adapter-backed presence

**Files:**

- Modify: `server/multiplayer/socketServer.js`
- Modify: `server/multiplayer/rooms.js`
- Modify: `server/multiplayer/socketServer.test.js`

**Step 1: Add failing presence tests**

Inject an `io.in(roomId).fetchSockets()` implementation containing sockets owned by two simulated nodes. Verify:

- Joining returns every active player, not just players in the local process.
- Duplicate joins update the same socket's player metadata.
- Movement sequence checks remain local to the owning socket.
- Leaving broadcasts `player:left` once.

**Step 2: Run and verify failure**

Run:

```bash
npm run test -- server/multiplayer/socketServer.test.js
```

Expected: FAIL because joins still read the module-level `roomPlayers` map.

**Step 3: Store player state on the owning socket**

Use:

```js
socket.data.player = {
  id: socket.id,
  nickname,
  position,
  yaw,
  lastSeq,
  updatedAt: Date.now(),
};
```

Build the room snapshot with:

```js
const sockets = await io.in(roomId).fetchSockets();
const players = sockets
  .map((candidate) => candidate.data.player)
  .filter(Boolean);
```

`player:move` must update only `socket.data.player` after validating `seq > lastSeq`. The Redis adapter distributes the resulting broadcast.

**Step 4: Remove player-state exports from `rooms.js`**

Delete `roomPlayers`, `addPlayer`, `getPlayers`, `updatePlayerMove`, and `removePlayer` only after all socket-server call sites use adapter-backed presence. Preserve `normalizeNickname`.

**Step 5: Run tests**

Run:

```bash
npm run test -- server/multiplayer/socketServer.test.js
```

Expected: PASS.

**Step 6: Commit**

```bash
git add server/multiplayer/socketServer.js server/multiplayer/rooms.js \
  server/multiplayer/socketServer.test.js
git commit -m "fix: derive multiplayer presence across Socket.IO nodes" \
  -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

---

### Task 6: Route scene sync and operations through the shared store

**Files:**

- Modify: `server/multiplayer/socketServer.js`
- Modify: `server/multiplayer/socketServer.test.js`
- Modify: `server/index.js`
- Modify: `server/readiness.js`
- Modify: `server/readiness.test.js`

**Step 1: Write failing socket behavior tests**

Inject a fake asynchronous scene store and verify:

- Room join calls `initialize(roomId, persistedGalleryScene)` without overwriting an existing live scene.
- `scene:sync` calls `replace()` and broadcasts only after acceptance.
- `scene:op` calls `applyOperation()` and acknowledges only after acceptance.
- Broadcast and acknowledgement payloads include `version`.
- Store failure emits `room:error` with a new `COLLABORATION_UNAVAILABLE` code.
- An unaccepted CAS conflict emits `SCENE_CONFLICT` and a fresh `scene:synced` snapshot.

**Step 2: Run and verify failure**

Run:

```bash
npm run test -- server/multiplayer/socketServer.test.js
```

Expected: FAIL because scene functions are still synchronous module calls.

**Step 3: Inject the scene store**

Change the server factory to require:

```js
startMultiplayerServer({
  // existing dependencies
  sceneStore,
  collaboration,
})
```

Choose `createMemorySceneStore()` for memory mode and Redis collaboration's store for Redis mode in `server/index.js`.

All event handlers that use the scene store must be `async` and must catch store errors. Do not fall back to local state after a Redis error.

**Step 4: Add collaboration readiness**

Extend `/api/ready` dependency checks to include the multiplayer collaboration readiness check when Redis mode is active.

**Step 5: Run focused tests**

Run:

```bash
npm run test -- server/multiplayer/socketServer.test.js \
  server/readiness.test.js server/startup.test.js server/shutdown.test.js
```

Expected: PASS.

**Step 6: Commit**

```bash
git add server/multiplayer/socketServer.js server/multiplayer/socketServer.test.js \
  server/index.js server/readiness.js server/readiness.test.js
git commit -m "fix: serialize live scene edits through shared state" \
  -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

---

### Task 7: Add client-side scene version ordering and resync

**Files:**

- Modify: `src/app/modules/metaverse3d/network/protocol.ts`
- Modify: `src/app/modules/metaverse3d/network/socketClient.ts`
- Modify: `src/app/modules/metaverse3d/network/multiplayerStore.ts`
- Modify: `src/app/modules/metaverse3d/components/Multiplayer/MultiplayerBridge.tsx`
- Test: `src/app/modules/metaverse3d/network/multiplayerStore.test.ts`
- Test: `src/app/modules/metaverse3d/components/Multiplayer/MultiplayerBridge.test.tsx`

**Step 1: Write failing version-order tests**

Test these rules:

```text
current version 10 + inbound version 11 => apply
current version 10 + inbound version 10 => ignore duplicate
current version 10 + inbound version 9  => ignore stale event
current version 10 + inbound version 12 => pause op application and request resync
fresh scene version 12                 => replace state and resume
```

**Step 2: Run and verify failure**

Run:

```bash
npm run test -- src/app/modules/metaverse3d/network/multiplayerStore.test.ts \
  src/app/modules/metaverse3d/components/Multiplayer/MultiplayerBridge.test.tsx
```

Expected: FAIL because protocol payloads do not carry a required live-scene version.

**Step 3: Add additive version fields**

Add `version: number` to server-to-client scene snapshot, operation, and acknowledgement payloads. Keep client-to-server event names and payloads compatible.

Add a `scene:request-sync` event so a client detecting a version gap can request the current authoritative snapshot without reconnecting.

**Step 4: Implement ordered application**

Keep one `lastSceneVersion` in the multiplayer store. Apply operations only when the version is exactly the next expected value. Ensure the existing FIFO queue still drains after a snapshot resync.

**Step 5: Run tests**

Run:

```bash
npm run test -- src/app/modules/metaverse3d/network/multiplayerStore.test.ts \
  src/app/modules/metaverse3d/components/Multiplayer/MultiplayerBridge.test.tsx \
  server/multiplayer/socketServer.test.js
```

Expected: PASS.

**Step 6: Commit**

```bash
git add src/app/modules/metaverse3d/network/protocol.ts \
  src/app/modules/metaverse3d/network/socketClient.ts \
  src/app/modules/metaverse3d/network/multiplayerStore.ts \
  src/app/modules/metaverse3d/components/Multiplayer/MultiplayerBridge.tsx \
  src/app/modules/metaverse3d/network/multiplayerStore.test.ts \
  src/app/modules/metaverse3d/components/Multiplayer/MultiplayerBridge.test.tsx
git commit -m "fix: order collaborative scene updates by server version" \
  -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

---

### Task 8: Verify two real server instances against Redis

**Files:**

- Create: `server/multiplayer/multiInstance.integration.test.js`
- Create: `compose.multiplayer-test.yml`
- Modify: `package.json`
- Modify: `doc/README.md`

**Step 1: Add a Redis test service**

Create a compose file exposing Redis only to localhost:

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "127.0.0.1:6380:6379"
```

**Step 2: Write the integration test**

Start two multiplayer servers with:

- Different random HTTP ports.
- The same `REDIS_TEST_URL`.
- The same gallery fixtures and JWT helper.

Connect editor A to instance 1 and editor B to instance 2. Assert:

1. Both see each other in room presence.
2. A chat event from A reaches B.
3. A focus event from B reaches A.
4. Simultaneous item additions from both editors produce versions `N+1` and `N+2`.
5. Rejoining through either server returns a snapshot containing both additions.
6. Closing instance 1 does not remove instance 2's live scene.

The integration test must skip only when `REDIS_TEST_URL` is absent and must print the exact command needed to enable it.

**Step 3: Add scripts**

```json
{
  "test:multiplayer:redis": "vitest run server/multiplayer/multiInstance.integration.test.js"
}
```

**Step 4: Run the real integration test**

Run:

```bash
docker compose -f compose.multiplayer-test.yml up -d
$env:REDIS_TEST_URL="redis://127.0.0.1:6380"
npm run test:multiplayer:redis
docker compose -f compose.multiplayer-test.yml down
```

Expected: PASS with two live Socket.IO server instances.

**Step 5: Document production requirements**

Update `doc/README.md` with:

- Required `MULTIPLAYER_SHARED_STATE=redis`.
- Redis availability and backup expectations.
- Sticky sessions recommendation for polling transport.
- Live scene TTL and SQLite recovery behavior.
- Deployment ordering: Redis first, Node instances second.
- Rollback: return to `INSTANCE_COUNT=1` and `MULTIPLAYER_SHARED_STATE=memory`.

**Step 6: Commit**

```bash
git add server/multiplayer/multiInstance.integration.test.js \
  compose.multiplayer-test.yml package.json doc/README.md
git commit -m "test: verify collaboration across server instances" \
  -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

---

### Task 9: Run complete validation and perform rollout checks

**Files:**

- Verify only; modify files only for failures directly caused by this plan.

**Step 1: Run focused multiplayer tests**

```bash
npm run test -- server/multiplayer/socketServer.test.js \
  server/multiplayer/memorySceneStore.test.js \
  server/multiplayer/redisSceneStore.test.js \
  server/multiplayer/redisCollaboration.test.js \
  src/app/modules/metaverse3d/network/multiplayerStore.test.ts \
  src/app/modules/metaverse3d/components/Multiplayer/MultiplayerBridge.test.tsx
```

Expected: PASS.

**Step 2: Run server syntax and TypeScript**

```bash
npm run check:server
npm run typecheck
```

Expected: PASS.

**Step 3: Run the complete repository check**

```bash
npm run check
```

Expected: all server syntax, typecheck, lint, 140+ test files, build, and bundle-budget checks pass.

**Step 4: Verify single-instance compatibility**

Start with:

```dotenv
INSTANCE_COUNT=1
MULTIPLAYER_SHARED_STATE=memory
REDIS_URL=
```

Confirm login, room join, movement, chat, scene edit, disconnect, and gallery save work without Redis.

**Step 5: Verify multi-instance fail-closed behavior**

Start production with:

```dotenv
INSTANCE_COUNT=2
MULTIPLAYER_SHARED_STATE=memory
```

Expected: startup fails with an actionable configuration error before either HTTP listener becomes ready.

**Step 6: Verify multi-instance Redis behavior**

Start two server instances with Redis mode. Confirm cross-node presence, chat, focus, scene operations, reconnect snapshot, and graceful shutdown.

**Step 7: Final commit**

```bash
git add .
git commit -m "fix: complete horizontally safe multiplayer collaboration" \
  -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

Do not use `git add .` if the worktree contains unrelated user changes; stage only the files listed in this plan.

---

## Rollout sequence

1. Deploy Redis and verify authentication, TLS/network policy, persistence policy, and monitoring.
2. Deploy the application with `INSTANCE_COUNT=1` and `MULTIPLAYER_SHARED_STATE=redis`.
3. Run the cross-node integration test against the production-like environment.
4. Increase to two instances with sticky sessions enabled for Socket.IO polling fallback.
5. Monitor Redis latency/errors, collaboration conflict rate, resync count, active rooms, and Socket.IO disconnect rate.
6. If Redis collaboration becomes unhealthy, stop new collaboration traffic,
   drain or disconnect active editors, persist live work to SQLite (or
   explicitly accept losing unsaved Redis-only edits), and stop every
   Redis-mode node before starting exactly one memory-mode node. Never overlap
   Redis and memory modes or keep multiple memory-mode instances online.

## Observability requirements

Add structured events without logging room tokens, JWTs, scene bodies, or user chat:

```text
multiplayer.redis.connected
multiplayer.redis.disconnected
multiplayer.scene.conflict
multiplayer.scene.resync
multiplayer.scene.write_failed
multiplayer.room.joined
multiplayer.room.left
```

Useful fields:

```text
requestId, roomIdHash, instanceId, sceneVersion, retryCount, durationMs, errorName
```

## Recovery and failure semantics

- Redis unavailable before startup: multi-instance server is not ready and does not listen.
- Redis unavailable during a write: reject the operation, emit `COLLABORATION_UNAVAILABLE`, and do not mutate a local fallback.
- Client observes a version gap: request and apply an authoritative snapshot.
- Redis live scene expires: the next join initializes from SQLite; an already
  connected editor receives `SCENE_MISSING` and rebuilds the live scene from
  its current local snapshot after pending operations settle.
- Node crashes: Socket.IO presence disappears through adapter lifecycle; live scene remains until TTL.
- Concurrent valid edits: CAS retries serialize them into consecutive versions.
- Repeated CAS conflicts: reject and force resync rather than acknowledging a lost edit.
