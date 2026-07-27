# 專案重構文檔入口

本目錄放置 React + Three.js 展覽專案的重構方案與執行對照文件。

建議閱讀順序：

1. `refactor-module-plan.md`：完整重構方案、目標架構、分階段計畫、驗證清單。
2. `module-boundary-map.md`：現有檔案到新功能模塊的映射表，適合執行搬遷時查閱。
3. `cleanup-candidates.md`：既有清理候選項。

重構原則：

- 先建立 facade 與公共 API，再逐步搬遷檔案。
- 每個功能模塊只透過 `index.ts` 暴露公共能力。
- React 頁面只負責路由、載入與頁面級狀態，不承擔 3D 場景內部規則。
- Three.js/R3F 場景、Zustand store、多人協作、AI 導覽、後端服務分別拆分。
- 每個階段完成後執行 `npm run check`。

## Public deployment security

- `server/app.db` and `server/uploads/` are runtime data. Do not commit them.
- Before deployment, inspect whether older Git history contains real user data.
  If it does, coordinate a history rewrite and rotate affected credentials.
- Back up the SQLite database and uploaded files outside the application
  directory.
- Use TLS and explicit HTTP/WebSocket origins in production.
- Set strong production secrets. Do not deploy values copied unchanged from
  `.env.example`.
- In-memory rate limits and multiplayer room state support one server process.
  Use the Redis collaboration mode described below before running multiple
  application instances.

## Multi-instance multiplayer deployment

Use memory mode only for a single Node process:

```dotenv
INSTANCE_COUNT=1
MULTIPLAYER_SHARED_STATE=memory
MULTIPLAYER_SCENE_TTL_SECONDS=3600
REDIS_URL=
```

Every deployment with two or more Node processes must use one reachable Redis
service:

```dotenv
INSTANCE_COUNT=2
MULTIPLAYER_SHARED_STATE=redis
MULTIPLAYER_SCENE_TTL_SECONDS=3600
REDIS_URL=redis://redis.internal:6379
```

Production configuration fails closed when `INSTANCE_COUNT` is greater than
one without Redis shared state, or when Redis mode has no `REDIS_URL`. A node
does not become ready until the Socket.IO Redis adapter and the Redis scene
store connect and pass their readiness checks. Do not route traffic to a node
whose `/api/ready` check fails.

Redis holds ephemeral live-scene snapshots and cross-node Socket.IO messages.
SQLite remains the canonical saved gallery. An accepted scene change refreshes
`MULTIPLAYER_SCENE_TTL_SECONDS`; after expiry, the next room join initializes
the live scene from the gallery stored in SQLite. Back up SQLite and uploads as
usual. Choose Redis persistence, replication, authentication, TLS, network
policy, monitoring, and backup settings according to the deployment's
availability requirements.

Deploy Redis and verify its health before starting Node instances. Start one
Node instance in Redis mode, verify readiness and collaboration, then scale
out. Configure sticky sessions at the load balancer when Socket.IO polling is
enabled; WebSocket-only clients do not require stickiness, but polling
fallback does.

To exercise two real Socket.IO nodes locally:

```powershell
docker compose -p meta-exb-multiplayer-test -f compose.multiplayer-test.yml up -d --wait
$env:REDIS_TEST_URL="redis://127.0.0.1:6380"
npm run test:multiplayer:redis
docker compose -p meta-exb-multiplayer-test -f compose.multiplayer-test.yml down
```

The Compose project name isolates this test service from unrelated containers.
The Redis port is bound only to `127.0.0.1`. The integration test uses random
room IDs, random HTTP ports, no SQLite database, and cleans up its Redis scene
key. Without `REDIS_TEST_URL`, the test is skipped and prints the exact command
needed to enable it.

If Redis collaboration is unhealthy, first stop routing new multiplayer
connections and drain or disconnect active editors. Persist the live scene
through the normal SQLite save flow before rollback, or explicitly accept that
unsaved Redis-only edits will be lost. Stop every Redis-mode application node;
only after they are all stopped may one node start with
`INSTANCE_COUNT=1` and `MULTIPLAYER_SHARED_STATE=memory`. Redis-mode and
memory-mode nodes must never overlap, and multiple memory-mode nodes must never
run concurrently: either case splits presence and live scene state.
