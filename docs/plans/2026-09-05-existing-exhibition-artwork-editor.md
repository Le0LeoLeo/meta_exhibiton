# 原展覽作品編輯

完成：2026-09-05 12:28 HKT，已部署香港正式站。

## 行為

- 展覽卡片的「上傳作品建展」改為「編輯作品建展」，帶入該卡片的 exhibitionId；頂部新增展覽入口保留。
- 新受保護頁 `/virtual-gallery/edit-artworks?exhibitionId=...` 載入原 sceneJson，不建立新展覽。
- 支援圖片作品名稱、作者、介紹、更換圖片、新增與移除作品，以及 XYZ、朝向、畫框尺寸；桌面與手機均提供表單操作及 3D 預覽。
- 新增圖片只尋找後牆可用位置，沒有空位會提示。其他展品、房間、材質及未知場景欄位均保留；其他媒體及完整空間編輯沿用桌面進階編輯器。
- 明確按儲存才 PATCH 同一 galleryId，附 expectedRevision；衝突不覆蓋本機內容。公開展覽保存後立即更新，保留原 ID、公開狀態及分享資料。
- 新媒體先 upload、再 bind 到原展覽，儲存使用持久 URL 並移除 access token。從展覽移除作品不刪除底層媒體。
- 既有後端會原子地將 quick draft 標為由編輯器管理，避免旧 quick build 重建覆蓋手動修改。本輪未改後端。

## 驗證

- Sub-agent 核對後端版本與 quick draft 交接語意，實作純場景編輯 helper 與 8 項測試；主 agent 實作頁面、路由、三語文案、卡片入口及 7 項頁面測試。
- 全套 229 檔、1,865 項通過，1 Redis 整合測試跳過。server syntax、avatar、typecheck、lint、build、bundle budget 通過。
- 本機真實瀏覽器從卡片開啟原展覽，修改名稱與作者、保存並重新載入；API 核對同一 ID、原 description、roomSize 及額外欄位保留。
- 香港隔離 staging：真實圖片上傳／綁定、原公開展覽修改資料／更換圖片／新增／刪除、公開頁同步、過期 revision 409、跨用戶拒絕、CSRF、WebSocket、重啟持久化均通過。
- 本機及 staging 本輪合成帳戶已刪除；staging 已停止並保留 volumes。正式站僅驗證未登入入口保護及健康，沒有修改真實用戶展覽。

## 部署

- 包：`.tmp/hk-artwork-editor-release-20260905-r1.tar.gz`；209 manifest files、238 entries、禁止路徑 0。
- SHA256：`1fceb7e82a617924a47cd03b6e216e738b3bef90cecd34b5ab450d43c0d9dd7d`。
- 遠端：`/home/admin/meta-exb-hk-artwork-editor-20260905-r1`。非 dist manifest 與上一版一致。
- Web image：`sha256:49ecaf805d1635ddd8e5b2872ed9fa44960a1b654c255395bfaeb974b03d1cfb`；app image 保持不變。
- 備份：`dist.pre-artwork-editor-20260905`、image tag `pre-artwork-editor-20260905`。env 雜湊一致；資料及 volumes 保留。
- 首頁、新 SPA 入口 200；ready、可信 TLS、www 301 保留路徑正常，只公開 80/443。未 commit 或 push。
