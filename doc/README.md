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

## 品質檢查範圍

`npm run typecheck` 會檢查 `src/` 下所有正式 `.ts`、`.tsx` 程式，以及建置設定；
包含 React 頁面、共用元件與 3D 編輯器。`src/` 下的測試檔暫不納入型別檢查，
由 `npm run test` 執行。新增正式程式不需要再逐一登記到 `tsconfig.json`。

React、React DOM 與 Three.js 的型別套件須與執行套件版本對齊。
完整驗證使用 `npm run check`；Redis 多實例整合測試仍需額外設定 `REDIS_TEST_URL`。

瀏覽器驗收使用 `npx playwright install chromium` 後執行 `npm run test:browser`。此命令建置不讀 `.env` 的本機版本，啟動全新 `.tmp/browser-acceptance-*` 資料庫與隔離 TLS 寄信接收器，驗證密碼找回、建展發布與載入失敗恢復。測試不連接正式帳戶、寄信服務或資料庫，埠 5193/5196/3019 僅綁定 loopback。測試產物包含合成帳戶 session，請勿公開 `.tmp`。

瀏覽器驗收分為 `workflow-2d` 與 `webgl` 兩個專案。前者關閉 WebGL，驗證密碼恢復、上傳／選模板／預覽／發布、匿名 2D 觀看、撤回與載入恢復；後者使用 Chromium 軟體 WebGL，驗證雙人斷線合併及重載恢復，也直接開啟使用正式 Express CSP 的公開展覽，檢查作品像素與 2D／3D 切換。兩者均由 `npm run test:browser` 執行；單獨檢查可用 `npx playwright test --project=webgl`。截圖位於 `.tmp/browser-results/`。觸控與螢幕尺寸模擬不能代替實體手機 FPS、大型場景或真機畫質驗收。

React 正式程式的 lint 已啟用 Hooks 呼叫順序與依賴檢查。依賴調整須維持儲存、重連、材質與預載入的原有生命週期；測試中的翻譯函式也應像正式 provider 一樣，在語言未切換時維持穩定。作品設定文字位於 `src/app/i18n/catalogs/painting.ts`，三語鍵值以型別對齊，另有控制操作及硬編碼文字防回歸測試。

## 上傳作品自動建展

快速入口 `/virtual-gallery/quick-create` 可從圖片直接建立私人展覽草稿，再由用戶預覽及發布。
操作、限制及實作位置見 [上傳即建展說明](../docs/quick-exhibition.md)，任務及驗收記錄見 [實現計畫](../docs/plans/2026-09-02-upload-to-exhibition-implementation.md)。

## Avatar facial placement

The avatar customizer provides bounded, symmetric placement controls for eye
height, spacing, and size; eyebrow height, spacing, and tilt; and mouth
position, width, and height. The limits keep procedural facial meshes on the
visible face while preserving each selected facial style.

Placement is part of the version 1 avatar appearance JSON. Legacy appearances
receive neutral defaults, REST updates use strict server-side validation, and
saved placement is propagated through the existing Socket.IO appearance
payload. Slider previews participate in the existing undo/redo history.
Pointer cancellation and Escape restore the pre-gesture appearance.

Direct dragging on the 3D face is intentionally deferred. A future drag
implementation must convert world-space pointer intersections back into the
same bounded placement contract rather than persist raw model coordinates.

## Scene saves and password changes

Startup migrations add `galleries.revision` and `users.session_version` without
replacing existing records. Deploy the frontend and backend together: gallery
PATCH requests now require `expectedRevision` from the last loaded/saved gallery;
missing versions return 428 and stale versions return 409 `GALLERY_CONFLICT`.
Content writes, including quick-exhibition transactions, increment the gallery
revision. The editor serializes saves and pauses on a conflict, preserving local
changes with options to download a copy or explicitly load the latest scene.

Gallery create, save, share-edit and publish reject malformed scene JSON and
invalid scene structures before writing. Existing valid extension fields are
preserved; empty/floor-plan drafts may have `roomSize: null`.

Changing a password increments the persisted session version and returns a fresh
session to the initiating browser. All prior Bearer/Cookie sessions fail the next
HTTP or multiplayer authorization check. The server also disconnects that user's
existing sockets through the collaboration adapter; if the adapter is unavailable,
the existing 30-second authorization sweep is the fallback for idle connections.
Legacy tokens without a version remain valid only while the account version is 0.
Restart the backend to apply the migrations before serving the updated frontend.

## Public deployment security

Published gallery media uses `private, no-cache`: browsers may retain bytes but
must revalidate access before reuse, including requests with an ETag. Withdrawing
publication returns a non-cacheable 404 to unauthorized requests; owner access
and stored files are preserved. Private previews and retained library assets
remain `private, no-store`. Public avatar textures retain their existing cache
policy. Responses cached under the previous one-hour policy can remain fresh
until their original expiry; already downloaded copies cannot be revoked.
Hong Kong's existing Caddy gateway additionally sets `no-store` on API responses;
the application change also protects deployments without that gateway policy.

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

## Google login

Create an OAuth 2.0 Client ID with application type **Web application** in
Google Cloud Console. Add every frontend URL under **Authorized JavaScript
origins**, including:

- `http://localhost:5173` for local Vite development
- the production frontend origin, such as `https://example.com`

This integration uses the Google Identity Services popup callback, so it does
not require an authorized redirect URI. Set the same client ID for the browser
and API server:

```dotenv
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

Restart both the Vite frontend and Express server after changing `.env`.
If the frontend host sends a Content Security Policy, allow
`https://accounts.google.com/gsi/client` in `script-src` and
`https://accounts.google.com/gsi/` in `frame-src`.

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
