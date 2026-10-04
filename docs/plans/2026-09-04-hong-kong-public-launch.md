# MetaEXB 香港公開上線紀錄

日期：2026-09-04，Asia/Hong_Kong

## 上線後狀態變更

2026-09-04 13:53 HKT，使用者明確選擇「暫停 MetaEXB 網站服務，不關閉香港主機」。正式 `app` 與 `web` 容器正常停止，資料與設定均保留。

2026-09-04 16:41 HKT，使用者明確要求「重新開啟網站」。原 production project 已直接重新啟動，沒有重建或清除 volumes；兩個服務均健康，主網址及 ready 回應 200，`www` 可信 HTTPS 301 轉址正常。網站目前保持運行。

## 結果

MetaEXB 香港正式站已公開並保持運行：

- 主網址：[https://metaexb.com](https://metaexb.com)
- `https://www.metaexb.com/<path>`：以可信 HTTPS 接收後，301 保留完整路徑轉到主網址
- 香港公網 IPv4：`47.76.58.150`
- 公開埠：TCP 80、443；沒有公開應用 5176、多人 3001 或 Docker API

使用者在精確確認「新增 `metaexb.com` 與 `www.metaexb.com` 的 A 記錄並指向 `47.76.58.150`」後回答「可」。此次沒有把授權延伸到深圳、VPN／路由、購買、退訂或其他帳戶操作。

## DNS 與 HTTPS

阿里雲權威 DNS 成功新增兩條記錄：

| 主機記錄 | 類型 | 記錄值 | TTL | 狀態 |
| --- | --- | --- | --- | --- |
| `@` | A | `47.76.58.150` | 10 分鐘 | 啟用 |
| `www` | A | `47.76.58.150` | 10 分鐘 | 啟用 |

控制台顯示建立時間為 2026-09-04 13:36:17 HKT。香港端解析兩個名稱均回傳 `47.76.58.150`。本機公共 DNS 指定查詢一度被網路環境攔截／逾時，之後 Chrome 與正式 HTTPS 已能正常解析及開啟，因此沒有修改使用者 DNS、hosts、VPN 或路由作為繞過。

Caddy 自動取得正常公開憑證：

| 名稱 | 簽發者 | 有效期（UTC） |
| --- | --- | --- |
| `metaexb.com` | Let's Encrypt YE1 | 2026-09-04 04:39:29 至 2026-12-03 04:39:28 |
| `www.metaexb.com` | Let's Encrypt YE2 | 2026-09-04 04:41:03 至 2026-12-03 04:41:02 |

核對結果：

- `http://metaexb.com` → 308 `https://metaexb.com/`
- `https://metaexb.com` → 200，TLS 驗證碼 0
- `https://metaexb.com/api/ready` → 200，TLS 驗證碼 0
- `https://www.metaexb.com/test-path` → 301 `https://metaexb.com/test-path`，TLS 驗證碼 0

最初公開設定只接收主域名；測試發現 `www` 雖解析但會 TLS 失敗，因此在 `deploy/hongkong/Caddyfile` 新增獨立 `www` HTTPS 入口與保留 `{uri}` 的永久轉址，驗證配置後只重建／重建置 web gateway。主域名及 app 資料沒有重建。

## 正式環境

- 遠端目錄：`/home/admin/meta-exb-hk-production-20260904/source`
- Compose project：`meta-exb-hk-production`
- 容器：`meta-exb-hk-production-app-1`、`meta-exb-hk-production-web-1`
- 資料 volumes：
  - `meta-exb-hk-production_runtime-data`
  - `meta-exb-hk-production_caddy-data`
  - `meta-exb-hk-production_caddy-config`
- 映像：
  - app `sha256:1cdabfa108a20381c8c0cf32dc71c1282f9e2be23fe56cb116f6dff2a5559ff2`
  - web `sha256:ef94f182ab50995f5104806ccbdbf2cca5a5a3de8067d9ab5d866b5f404af3b4`

最終核對時兩容器均運行，app healthy。主機只見 22、80、443 對外監聽；最近 15 分鐘 app 沒有 fatal/uncaught/unhandled/exception，web 沒有 error/fatal/panic。約有 974 MiB 可用記憶體及 29 GiB 可用根磁碟。

正式環境使用新產生、只存遠端且 mode 600 的 `.env.hongkong`；沒有輸出或寫入本文件。應用維持單實例，因 SQLite 與記憶體多人狀態不能直接水平擴充。

## 驗收

### 本機與隔離 staging

- typecheck、lint、138 個 server 檔語法、avatar asset、正式 build 通過。
- 部署支援測試 31/31 通過。
- 完整測試：217 檔通過、1 跳過、1 個 Socket.IO 時序測試失敗；該項立即聚焦重跑通過，之後連續 5/5 通過，記錄為孤立時序 flake，不把整套說成全綠。
- 新 build：最大 JS 723,007 bytes、JS 總計 3,115,593；CSS 211,074；最大 GLB 1,659,868、GLB 總計 10,605,084，均在既定閘值內。
- 全新 2026-09-04 staging 依序通過可信內部 TLS、ready、SPA、註冊／Cookie／CSRF、圖片、私有權限、HTTP CORS、Socket.IO 加入／移動／場景同步／跨帳戶拒絕／外來 origin 拒絕、登出、stale cookie 恢復、重啟後帳戶／場景／圖片保存。
- 最新功能另通過成長記憶孩子／私人展覽／PNG／推薦與跨帳戶拒絕、已發佈本人展館前置條件、私人比賽草稿／作者可見／其他帳戶 403／公開列表排除。

### 公開站

公開站以兩個隨機 `@example.invalid` 合成帳戶執行並通過：

- 正常受信任 TLS、ready、SPA 深層路由及 `www` 轉址
- 註冊、登入與 Secure / HttpOnly / SameSite=Lax session cookie
- 有效 session、缺少 CSRF 拒絕及正確 CSRF 接受
- PNG 上傳、私有展廳建立、媒體綁定、跨帳戶展廳／媒體拒絕
- 兩個 WebSocket 客戶端加入、移動同步、其他帳戶私人房間拒絕
- 外來 WebSocket origin 拒絕；外來 HTTP origin 不獲 CORS 權限

第一次公網腳本在「未登入讀取私有展廳」把正確的 401 誤寫成預期 404，因此中止；finally 清理成功。修正測試預期後完整重跑通過。這是驗收器預期錯誤，不是服務故障。

Chrome 畫面核對通過首頁、登入、註冊、公開比賽空狀態、資源「準備中」說明及成長記憶未登入導向。瀏覽器沒有建立帳戶或輸入使用者資料；最後已把正式首頁保留給使用者。

## 合成資料清理

公網驗收前、第一次中止後、完整通過後均做空資料核對。最終結果：

- `users`、`galleries`、`media_assets`
- `growth_children`、`growth_exhibits`、`growth_assets`、`growth_comments`
- `competitions`、`competition_entries`、`competition_votes`

以上十表全為 0，`/data/server/uploads` 檔案數為 0，`/data/.hk-public-test-state.json` 不存在。合成帳戶均經正式 DELETE API 清理，沒有直接刪正式 DB 記錄。

## 初始備份與還原驗證

- 備份：`/home/admin/meta-exb-hk-production-20260904/backups/runtime-initial-empty-20260904.tar.gz`
- SHA256：`4dc4158e50f0c971bfeb54ff325530bd10527b30e5f2c0606620d749eabeefde`
- 大小：7,733 bytes
- 權限：mode 600，owner `admin:admin`
- 獨立還原 volume：`meta-exb-hk-production-restore-check-20260904`

備份時只短暫停止 app，shell trap 確保失敗亦重啟；web gateway 保留。第一個還原檢查以唯讀方式掛載 WAL 模式 SQLite，因無法建立必要的共享記憶體檔而得到 `SQLITE_CANTOPEN`；正式 app 已由 trap 正常重啟。其後在同一個**隔離還原 volume** 以可寫掛載重跑（沒有掛正式 volume、network=none），SQLite integrity=ok、十表全 0、uploads=0。備份檔本身沒有變更。

## Release 與本機修改

最終 R3 package：

- 本機：`.tmp/hk-release-20260904-r3.tar.gz`
- SHA256：`ED32916F057E7207DF2A54C3EFCACFA6347DDF6958AEEFE7030E5D795153A1CD`
- 大小：11,589,203 bytes
- 195 個允許檔案；223 個 archive entries；禁止路徑 0
- 遠端 195 個檔案按 R3 manifest 重新核對成功

本輪相關持久檔案：

- `deploy/hongkong/Caddyfile`：新增 `www` → apex 永久轉址
- `deploy/hongkong/verify-staging.mjs`：跨帳戶 PATCH 加入初始 `expectedRevision: 0`
- 本紀錄及頂層香港交接文件

`.tmp/` 內的公網驗收、空資料檢查、備份／還原驗證腳本是操作證據，不含正式 secret。工作樹原本已有大量使用者變更；沒有 reset、checkout、stash、commit 或 push。

## 尚未提供／仍需注意

- Google 登入、AI provider、忘記密碼寄信、客服／聯絡外部服務與真實資源下載仍未配置。頁面目前有停用或「準備中」提示，不應宣稱這些整合可用。
- 尚未從中國內地不同營運商或實際比賽場地測速／測連線。香港主機不等於內地可達性保證；正式活動仍應準備本機或離線備援。
- 正式 runtime 備份已驗證一次，但尚未建立週期性異地備份、監控或通知；這些需要另行決定保存位置、週期與通知方式。
- 香港主機到期日為 2026-10-03 23:59:59 HKT；域名到期日為 2027-09-03 17:53:48 HKT。需在到期前確認續費策略。
- 舊 staging、舊備份及還原驗證 volumes 保留且停止；不要把它們當正式資料。深圳資源與退款狀態仍是獨立事項，本輪沒有修改。
