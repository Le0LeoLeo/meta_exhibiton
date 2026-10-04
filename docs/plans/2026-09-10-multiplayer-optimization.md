# 多人連線分析與優化 — 2026-09-10

## 分析範圍與架構

檢查 Socket.IO client/server、Zustand 房間狀態、MultiplayerBridge 場景同步、RemotePlayers 插值和編輯器連線面板。香港現況為單一 app process，SQLite 持久化、記憶體多人狀態；本次保留架構。伺服器既有角色授權、場景版本排序、操作確認、速率限制與重連同步均保留。

## 已修正

- 房間 ID、暱稱原本每個輸入字元都會修改 store 並觸發 room:join；改成失焦或非輸入法組字中的 Enter 才套用。暱稱限制 20 字。
- 斷線、切換房間立即清除 selfId、角色、遠端玩家和編輯焦點；在線人數只在取得房間角色後計入自身。
- 忽略非當前房間的入房回覆、玩家加入／移動／離開和焦點事件，避免延遲事件污染新房間。
- 中文輸入法 Enter 選字不送訊息；不具聊天權限或斷線時不清空輸入。傳輸函式回傳是否已 emit，此值不是伺服器送達確認。空白或超過 300 字的訊息不送出；重複聊天事件按 ID 去重。
- 聊天背景減少白色覆蓋，提高文字對比，加入 log/aria-live 和輸入標籤，窄版輸入框允許收縮。
- 空房或位置／角度已靜止時，插值保留 store identity，不再每次 tick 觸發訂閱；接近目標時收斂至精確位置。

## 驗證

- 192 tests passed across network, Multiplayer components, EditUI and server socket tests. Added 7 regression cases for stale joins, room isolation, disconnect cleanup, idle interpolation, chat deduplication, deferred room input and IME/draft preservation.
- TypeScript and scoped ESLint pass. Fresh Hong Kong Vite build and release whitelist/bundle gate pass (282 files).
- Isolated staging: two authenticated real WebSocket clients pass chat, movement, disconnect/rejoin roster, concurrent scene edits, resync, focus refresh/release and deletion convergence. All frontend hashes and trusted staging TLS pass. This run's synthetic account/gallery removed; staging stopped, volumes retained.
- Public verification: 2026-09-10T07:53:21.038Z; 170 route/asset hashes pass, /api/ready ready, www redirect 301, trusted TLS verified with system CA enabled. Only TCP 80/443 published; app has no host ports.
- Browser smoke: public gallery and My Exhibitions load after refresh. Existing browser session had an old lazy-loaded chunk immediately after deployment, showing the error boundary until reload. No production gallery was created for UI testing; panel interactions are covered by component tests, not a fresh production editor screenshot.
- No large concurrency, packet-loss/mobile-network benchmark or server-delivery acknowledgment added. No claim of measured FPS/bandwidth uplift. Chat history remains session-local and server-side chat rejection after emit is not a delivery receipt.

## Deployment / rollback evidence

- Archive: .tmp/hk-multiplayer-opt-release-20260910.tar.gz
- SHA256: a0e1f8cbaa1800f67043197a04302a5e759c2283c0de6801034311e25cd8b202
- Remote release: /home/admin/meta-exb-hk-multiplayer-opt-20260910
- Accepted production web: sha256:0f22720839d724c25dea55f10ad10174e71f88319ef967483b78ee6caab51139
- Unchanged app: sha256:badcd2f7df8427a6abf0a86254deae93182a31054acde15dba2e11f70cd30090
- Production backup: /home/admin/meta-exb-hk-production-20260904/source.pre-multiplayer-opt-20260910 (previous dist and manifest).
- Previous web tag: meta-exb-hk-production-web:pre-multiplayer-opt-20260910.
- Backend whitelist comparison passed; production env checksum unchanged. Data/uploads/certificates/volumes preserved. No Git commit/push.
- Logs and narrowly scoped deploy/acceptance helpers: .tmp/multiplayer-opt-* and .tmp/verify-multiplayer-opt.mjs.
