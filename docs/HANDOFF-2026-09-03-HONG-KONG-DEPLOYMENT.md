# MetaEXB 香港公開部署交接

## 維運補強：2026-09-14 — 完整備份指紋與隔離還原驗證

新增全檔案／目錄指紋檢查及 [還原操作文件](../deploy/hongkong/RECOVERY.md)。43 項相關測試通過；香港既有隔離資料經封存、還原到新獨立 volume、完整指紋與 SQLite／展場／圖片核對通過，額外檔案的負向測試也如預期拒絕。工具獨立安裝於 `/home/admin/meta-exb-hk-snapshot-tools-20260914`，未更换或重啟正式網站；原版本與 HTTPS／健康／轉址驗證通過。

演練資料、指紋及 archive 位於 mode-700 的 `/home/admin/meta-exb-hk-snapshot-drill-20260914`；原有及新還原 volume 均保留。這是小型測試資料還原，尚未建立異地備份或故障轉移，單機故障風險仍在。[完整驗收紀錄](plans/2026-09-14-snapshot-verification.md)。

## 最新狀態：2026-09-14 — 編輯器 AI 建展流程拆分

AI 建展流程與面板移至獨立模組，編輯器主檔由 1,377 行減至 509 行。修正離開編輯頁面後仍記住晚到結果、舊還原回應覆蓋新預覽，以及本機工作階段快取失效阻止使用的問題。64 項相關測試、型別／lint／語法及建置通過；五項 WebGL 瀏覽器案例分批通過，涵蓋確認後套用、面板收合保留預覽、手機只讀、兩人協作與公開畫作渲染。AI 回應採固定測試資料，沒有宣稱重新驗證供應商品質或可用性。

香港隔離重啟與獨立還原通過，正式站已部署；345 個公開檔案、HTTPS／健康、後端清單及 SQLite 完整性核對通過。原有資料、設定、憑證及備份保留；新增 `source.pre-editor-split-20260914` 與 `backup-editor-split-20260914/runtime.tar.gz`。單機及實體裝置效能限制仍在。[完整驗收與映像紀錄](plans/2026-09-14-editor-builder-separation.md)。

## 最新狀態：2026-09-14 — 比賽與成長紀錄資料存取拆分

32 個函式移至獨立 repository，資料庫主檔由 1,837 行減至 1,369 行；保留原有介面、SQL 和初始化行為。六項新 SQLite 測試及相關 66 項測試通過。完整測試有一項開發代理逾時，原樣單獨重跑通過；其餘 2,358 項通過、1 項略過。型別、lint、語法、建置及大小檢查通過。

香港隔離驗收涵蓋成長紀錄／分享／撤銷、比賽報名／審核／投票／重複投票拒絕，重啟及獨立還原後核對內容和票數一致。正式站已部署，345 個公開檔案、後端版本、HTTPS／健康及 SQLite 完整性通過。既有資料、設定、上傳檔、憑證及備份保留；新增 `source.pre-repositories-20260914` 與 `backup-repositories-20260914/runtime.tar.gz` 回復資料。單機與真機效能限制仍在。[完整驗收與映像紀錄](plans/2026-09-14-database-repositories.md)。

## 最新狀態：2026-09-12 22:44 HKT — 專案審查補強

已啟用 React Hooks 強制檢查並修正相關生命週期問題；作品編輯器補齊繁中、簡中及英文，抽出可取消的導覽音訊流程。新增公開展覽在實際 CSP 下的 WebGL 畫作像素、桌面／觸控及 2D／3D 切換驗收。完整檢查通過（2,353 項測試通過、1 項略過），八項瀏覽器案例分批通過；香港隔離 8／16／32 連線的 p95 為 13／37／58 毫秒，重啟及獨立還原通過。

既有正式專案已部署，345 個公開檔案、HTTPS／轉址／健康、後端清單及 SQLite 完整性核對通過。環境、使用者資料、上傳檔、憑證和原有備份保留；新增 `source.pre-hardening-20260912` 與 `backup-hardening-20260912/runtime.tar.gz` 回復資料。單機限制仍在，觸控模擬不代表真機效能。[完整驗收與映像紀錄](plans/2026-09-12-audit-hardening.md)。

## 最新狀態：2026-09-11 13:06 HKT — 玻璃按鈕

依用戶補充，首頁兩個按鈕改成半透明毛玻璃、反光漸層、細亮邊與柔和陰影。正式建置、畫面及 114 個公開檔案 hashes 驗證通過，後端及資料設定保留。[驗收與回復](plans/2026-09-11-glass-buttons.md)。

## 最新狀態：2026-09-11 13:03 HKT — 首頁按鈕細節

兩個首頁按鈕統一高度、細圓角、字重及圓形箭頭，加入柔和陰影、鍵盤焦點和窄屏自動上下排列。五項首頁測試、正式建置及 114 個公開檔案 hashes 通過；桌面與手機畫面已驗收，後端及資料設定保留。[驗收與回復](plans/2026-09-11-hero-buttons.md)。

## 最新狀態：2026-09-10 22:20 HKT — 編輯器長方形展台

新增獨立低矮長方形展台，沿用正常放置、變換及歷史流程；修正建立時丟失預設內容。38 項相關測試、型別、lint、建置及 161 個公開檔案 hashes 通過；真實編輯器元件已驗收放置、撤銷及重做。Web：`sha256:9b4b19f443ae0c4d5968decc7fc45743e4dea198632d7d551eb415a0265e07ec`；後端及資料設定保留。[驗收與回復](plans/2026-09-10-editor-vehicle-platform.md)。

## 最新狀態：2026-09-10 21:58 HKT — 模版預設氛圍及封面

科技／攝影預設聚光，歷史／時尚預設暖調，藝術／汽車保留明亮；四張真實 3D 封面同步更新。68 項相關測試、型別、lint、建置及 160 個公開檔案 hashes 通過。Web：`sha256:c5f76cf5bd3e1cbb6878e3f9d96250f0d26e53c378eb6fba12de82f887965990`；後端、資料及設定保留。[驗收與回復](plans/2026-09-10-curated-template-moods.md)。

## 最新狀態：2026-09-10 21:52 HKT — 三種可選展廳氛圍

六款模版新增深色聚光、暖調古典並保留明亮款；預覽與建立流程可選，登入後保留選擇。實際作品受聚光照明，手機與桌面 3D 切換驗收通過。相關測試、型別、lint、建置及 160 個公開檔案 hashes 通過。Web：`sha256:dd5cb227dcab5b8af6e30a3d217ce29c4be5c7278041a79428f898d9aa3a1c97`；後端及資料設定保持不變。[驗收及回復紀錄](plans/2026-09-10-museum-atmospheres.md)。

## 最新狀態：2026-09-10 21:37 HKT — 六款展廳視覺重整

六款場景重排、啞面地板、中性天花、合比例模型展台、真正幼框／無框、完整橫向封面與手機預覽。82 項相關測試、型別、lint、正式建置及 157 個公開檔案 hashes 通過。Web：`sha256:5d0825c4a7c123557a912f437cb60848c44dba8fd56053dc6646eb1828f03e70`；後端保持健康，資料及設定保留。[驗收及回復紀錄](plans/2026-09-10-template-visual-polish.md)。

## 最新狀態：2026-09-10 21:21 HKT — 刷新隨機口號

首頁新增六組三語口號，每次刷新隨機選擇並排除上次同分頁口號。22 項測試、型別、lint、正式建置及 220 個公開檔案 hashes 通過。Web：`sha256:f249660959a25a7134bc7c508323f80896733497637e77f610f6daea62f23824`；後端健康且未重啟，資料與設定保留。[驗收及回復紀錄](plans/2026-09-10-homepage-slogans.md)。

## 最新狀態：2026-09-10 21:12 HKT — 毛玻璃導覽列

導覽列改為半透明模糊、反光漸層與細亮邊，深淺色皆適用。僅共享 CSS 改變，建置／bundle 與 220 個公開檔案 hashes、可信 HTTPS、ready、www 通過。Web：`sha256:2f463ab442e94530aa8ea0d5170c44a5d147a5629ac877ab7ecb65d2fc0a6710`；後端及資料設定保留。[驗收及回復紀錄](plans/2026-09-10-glass-navigation.md)。

## 最新狀態：2026-09-10 21:09 HKT — 首頁背景全寬修正

移除首頁 hero 的 1680px 上限，背景貼齊左右邊界，畫作容器維持置中及 1080px。桌面／390px 無橫向溢出；fresh HK build、bundle 及 220 個公開檔案 hashes、HTTPS／ready／www 驗收通過。Web：`sha256:5e3eebe66833a33669288d62e61948f5ef52ce1f1d843edd320f82494b3398e0`，後端保持健康，資料／設定／憑證保留。[修正與回復紀錄](plans/2026-09-10-background-full-width.md)。

## 最新狀態：2026-09-10 21:04 HKT — 首頁畫廊背景

新增緩慢窗光、暖金／灰綠色暈與創作區顏料色暈；背景離開畫面、分頁隱藏或減少動態時暫停。46 項測試、型別、lint、正式 build 與 bundle 檢查通過；220 個公開前端／字型 hashes、可信 HTTPS、ready、www 驗證通過。只更新 web，後端與資料設定保留。

- Web：`sha256:2daae406a308b0aecfa98d03633b17017a2fc53a3c3bb674e3e41c54ddd196b0`。
- App：`sha256:542698bfbded216582915d4f789f025b328abb5b6b754e5d4e577552eb7ead7f`，保持健康。
- [完整背景驗收與回復紀錄](plans/2026-09-10-gallery-atmosphere.md)。

## 首頁動效驗收：2026-09-10 20:49 HKT

標題分段揭示、主畫作展開、卡片依序進場與 hover 動效已在正式站驗證；最新版模板發佈已包含本次完全相同的首頁 JS/CSS。舊基準部署被 image guard 中止，未覆蓋新模板，亦未再次部署。正式 Web 為 `sha256:2803ad9c83265808fbacb8f91826e9b146395fd5a35c86e749bf99df739ad3f8`；220 個公開前端／字型檔 hashes、HTTPS、ready、www、正式桌面與本機 390px 三語首頁檢查通過。後端維持健康，網站僅 TCP 80/443 對外。[首頁紀錄](plans/2026-09-10-homepage-motion.md)；目前有效部署／回復方式見[完整模板紀錄](plans/2026-09-10-complete-gallery-templates.md)。

## 最新狀態：2026-09-10 20:44 HKT — 六個展覽模版已完成並部署

現代藝術、科技、歷史、時尚、攝影、汽車模版皆可預覽與建立；私人建立頁提供六主題及空白選項。新增本地作品／概念模型、真實場景封面、按需載入 3D 預覽及逐件觀看；修正懸空展品、過高展柱和遮擋作品的隔板。

完整檢查通過：2,224 項測試、另加 3 項私人建立流程測試；一項外部 Redis 整合測試略過。六個 WebGL 展廳已目視驗收，390px 預覽無橫向溢出。香港正式站 154 個前端／模版素材雜湊、HTTPS、ready、www 與正式 3D 預覽均通過。

- Web：`sha256:2803ad9c83265808fbacb8f91826e9b146395fd5a35c86e749bf99df739ad3f8`。
- App 保留 `sha256:542698bfbded216582915d4f789f025b328abb5b6b754e5d4e577552eb7ead7f`，未重啟。
- 環境、資料、uploads、volumes、憑證保留；網站僅 TCP 80/443 公開，未建立正式測試資料，無 Git commit/push。
- [詳細分析、驗收和回復方式](plans/2026-09-10-complete-gallery-templates.md)。

## 前次狀態：2026-09-10 18:56 HKT — 第五批可靠性改善已部署

新增同一分頁重新整理後的草稿恢復，依帳戶／展覽／分享情境隔離，最多保留 24 小時。重新取得權限及最新場景後，明確選擇合併、放棄或下載；選擇前暫停儲存與同步。登出清除草稿，儲存空間不足會提示。關閉分頁後不保證恢復，也不是完整離線編輯。

完整檢查 2,210 項通過（外部 Redis 1 項略過），六項瀏覽器流程通過；新增兩位登入使用者操作真正 WebGL 編輯器，驗證斷線、本機與遠端修改、合併、重新整理及恢復後實際保存。測試使用小型空展間，不代表實機或大型場景效能。香港隔離權限、16 連線／兩房間／80 次修改、重啟保存與獨立備份還原均通過。

- 正式 Web：`sha256:26156b381ca460f6d4e9f598bba3b794b5a38abbea81b939321c8bdc5f2fc997`。
- 正式 App：保留 `sha256:542698bfbded216582915d4f789f025b328abb5b6b754e5d4e577552eb7ead7f`，未重啟後端。
- 公開 112 個 HTML/JS/CSS hashes、可信 HTTPS、ready、www 通過；網站僅公開 TCP 80/443，設定／資料／憑證／既有備份保留。隔離合成資料清零，服務停止，無 Git commit/push。
- 還原：`sh /home/admin/tabdraft-rollback.sh production`；[完整驗收與回復方式](plans/2026-09-10-reliability-phase-five.md)。

## 前次狀態：2026-09-10 18:04 HKT — 第四批可靠性改善已部署

斷線時保留當頁尚未確認的修改；重新連線後先取得最新場景，讓使用者選擇合併或放棄本機修改，期間暫停儲存與同步，並提供場景副本下載。重複斷線會重新取得遠端資料；失去編輯權限禁止合併，帳戶／房間／分享環境變更清除恢復狀態。這是當頁記憶體保護，離開或重載前仍需下載副本。

完整檢查 2,200 項通過（外部 Redis 1 項略過）；補充帳戶／分享情境後 24 項 bridge 測試及 lint 通過，5 個瀏覽器流程通過。香港隔離驗收涵蓋 16 連線／兩房間／80 次修改、權限、重連、重啟保存及備份還原。新版重連選擇以 bridge/store 與元件測試驗證，未宣稱完整 3D 瀏覽器斷網驗收。

- 正式 Web：`sha256:b2f93033f4c35e8ba58db027920be48649380ae05611e19f8b1e24ce69b201d8`。
- 正式 App：保留 `sha256:542698bfbded216582915d4f789f025b328abb5b6b754e5d4e577552eb7ead7f`，未重啟後端。
- 公開 113 個前端檔案 hashes、可信 HTTPS、ready、www 通過；網站僅公開 TCP 80/443，環境設定／正式資料／憑證／備份保留。隔離合成資料清零、服務停止，無 Git commit/push。
- [完整驗收與回復方式](plans/2026-09-10-reliability-phase-four.md)。

## 前次狀態：2026-09-10 17:40 HKT — 第三批可靠性改善已部署

多人編輯／恢復確認等待超過 20 秒時，暫停送出新修改並保留當頁內容與待確認 ID，提供三語提示及場景副本；遲來的確認可恢復同步。提示與資料庫儲存狀態分開，不自動重送不確定的操作。

完整檢查 2,191 案例通過（外部 Redis 1 項略過），5 個瀏覽器流程通過。香港隔離測試以 16 個連線、兩個房間完成 80 次修改，確認每位用戶收到正確的 35 次其他用戶廣播、跨房間隔離與重連場景。內部測試 p50／p95／最慢確認為 20／31／46 ms；不是正式網路或最大容量保證。隔離備份還原與既有權限驗收均通過。

- 正式 Web：`sha256:9125c250484be331d0655f1165e3f23132ba01893e2a9f0819d9ddd99054aa7a`。
- 正式 App 保留 `sha256:542698bfbded216582915d4f789f025b328abb5b6b754e5d4e577552eb7ead7f`，本次正式更新未重啟後端。
- 公開 113 個 HTML/JS/CSS hashes、HTTPS、ready、www 均通過；環境設定、資料、憑證與既有備份保留，網站僅公開 TCP 80/443。staging 合成資料清零、容器停止；無 Git commit/push。
- [完整驗收與回復方式](plans/2026-09-10-reliability-phase-three.md)。

## 前次狀態：2026-09-10 17:13 HKT — 第二批可靠性改善已部署

公開展覽改為每批 12 個摘要及接續游標，不再傳送完整場景；下一頁失敗時保留卡片並可重試。建展頁增加三語步驟、發佈前隱私提示與複製失敗時的手動連結。完整檢查 2,180 案例通過（外部 Redis 1 項略過），5 個瀏覽器流程通過；另以完整手機裝置設定重跑建展／慢網觀看，確認隱藏桌面編輯入口且無橫向溢出。手機驗收是 Chromium 2D 模擬，未宣稱實機 3D 效能。

香港隔離環境通過 13 個合成展覽分頁、完整詳情、帳戶／媒體權限、多人與重啟驗收；正式備份成功還原檢查。正式站 113 個 HTML/JS/CSS hashes、HTTPS、ready、www 均通過。既有兩個公開展覽回應由 4,052 降為 906 bytes，封面 hashes 不變。

- 正式 App：`sha256:542698bfbded216582915d4f789f025b328abb5b6b754e5d4e577552eb7ead7f`。
- 正式 Web：`sha256:d4c129244cf6234de317e4ad91159816b19743267d7b556ad29546e8fd6e5bca`。
- 正式備份：`backups/runtime-pre-discovery-20260910.tar.gz`；SHA256 `5b676ab9104e578c4e2a4d3e0b8ee5bb3f4efbf79dd058abaef95b7bda992614`。
- 發佈紀錄與還原方式：[第二批紀錄](plans/2026-09-10-reliability-phase-two.md)。環境設定、資料、憑證及既有備份保留；僅網站 TCP 80/443 公開。staging 合成資料已清零、容器已停止；無 Git commit/push。

## 前次狀態：2026-09-10 16:43 HKT — 第一批可靠性改善已部署

新增密碼找回（沿用正式 SMTP、限時單次連結、重設後撤銷舊 HTTP／多人登入）、載入新版資源失敗時的明確恢復操作與場景副本，以及獨立瀏覽器流程驗收和 CI 設定。完整 `npm run check` 通過：282 個測試檔、2,169 案例；Redis 外部測試 1 項略過。瀏覽器三條流程通過，使用既有 2D 備援模式。

已在香港隔離環境驗收帳戶／CSRF／跨用戶權限／儲存衝突／撤回媒體／多人重連／重啟資料，另以無網路、全新 tmpfs 容器驗收重設密碼和舊 Socket 撤銷。正式備份成功還原至獨立 volume，SQLite integrity 通過。正式服務只公開 TCP 80/443，設定檔 checksum 未改，資料與憑證保留。

- 正式 App：`sha256:ea27008269a07f936a9f4cfb71a71445c3afe0da572975456dbf2fcbcfc19013`。
- 正式 Web：`sha256:4eb4a214dca83c2f36b0a13ec47c52aad5420a2b07964965096e574de923bdcf`。
- 公開 113 個 HTML/JS/CSS hashes、HTTPS、ready、www 轉址與密碼找回設定均驗證通過。
- 正式備份：`/home/admin/meta-exb-hk-production-20260904/backups/runtime-pre-reliability-20260910.tar.gz`；SHA256 `ff3cd6e5dad4f2bc8f85c4120a195a69e71914aaab188064b8710e0a82332359`。
- 還原：`sh /home/admin/reliability-rollback.sh production`；保留資料 volumes 與環境秘密。
- 完整紀錄：[第一批可靠性改善](plans/2026-09-10-reliability-phase-one.md)。隔離測試資料已清理，staging 已停止。未 Git commit/push；CI 設定尚未觸發遠端執行。

## 歷史狀態：2026-09-10 13:25 HKT — 專案分析修正已部署

場景變更訂閱取代120ms完整序列化輪詢，補齊編輯提示及QR分享三語文案，媒體應用層改為重新核對發布權限；香港閘道原有no-store保護保留。發布工具強制檢查實際成品，翻譯稽核及歷史狀態文件同步修正。

277個測試檔／2,130項測試通過，1項外部Redis跳過；Python 17項通過；型別、lint、語法、模型、建置及成品體積檢查通過。本機瀏覽器自動保存後重載成功。香港隔離媒體撤回、版本衝突、雙Socket、重連、重啟保存、備份還原及清理通過；正式108個HTML/JS/CSS雜湊、可信HTTPS、ready、www及僅公開80/443驗證成功。

沿用已驗收映像：app `sha256:badcd2f7df8427a6abf0a86254deae93182a31054acde15dba2e11f70cd30090`；web `sha256:946d9eb6aa192cb7adeec6a799e08a527b7a4d4e859a65645bff00136e667e7d`。正式env、資料、uploads及憑證volumes保留，備份已獨立還原驗證；staging與本地驗收服務停止，無commit/push。詳見[修正及部署紀錄](plans/2026-09-10-project-analysis-fixes.md)。下方所有「最新狀態」均為歷史紀錄。

更新日期：2026-09-05，Asia/Hong_Kong。這是本次對話的交接紀錄，不是新的操作授權。

## 最新狀態：2026-09-05 20:00 HKT — 真實電郵認證已啟用

阿里雲 Direct Mail 的寄信 DNS 與地址驗證完成；使用者確認授權測試信已抵達收件匣。香港現有 mode-600 env 僅更新 SMTP 與 `EMAIL_VERIFICATION_ENABLED=true`，備份保留，未改前端、映像或資料。隔離正式映像的驗證流程及實際 service SMTP 認證通過後，只重建 app。正式 auth/config=true、首頁/ready=200、www=301、healthy 及只公開 80/443 已確認；app 仍為 `sha256:4bdbe56b7d60386063d2cffab3fb2d359c69f23c35cda12560ab3bd7e5ce3360`。未代驗證真實帳戶；帳戶持有人仍需在登入流程收取並點擊自己的驗證信。詳見 [設定與驗收](../deploy/hongkong/EMAIL_VERIFICATION.md)。無 commit/push，未重寄額外測試信。

## 最新狀態：2026-09-05 18:55 HKT — 編輯展品自動貼牆

畫作、文字板與燈條單件拖放後自動貼合實際牆段或隔牆兩面並转正，新增放置間距同步修正。72 項相關測試、typecheck、ESLint、香港 build 及 bundle budget 通過；本機真實 3D 拖放驗證通過。香港僅更新前端，公開編輯 JS 及首頁與 release manifest 完全相同，HTTPS／ready／www／容器及 80、443 驗證正常。資料、env、app 及備份保留，無 commit／push。詳見 [自動貼牆紀錄](plans/2026-09-05-wall-placement.md)。

## 最新狀態：2026-09-05 17:38 HKT — 手機補光與多人角色已上線核驗

17:36 光影發佈已整合手機 performance 補光 1.2 / 0.8，以及所有效能等級顯示其他玩家。收到上線指令後重新建置並通過 35 項相關測試、typecheck、lint 和全部 bundle budget（最大 707.7 KiB）；公開手機燈光／效能設定 chunk 與重新驗證版本逐位元一致，首頁與 ViewCanvas 符合已部署 manifest。HTTPS、ready、www 301、app healthy、僅公開 80/443 均確認。因此沒有重複覆蓋已上線的相同修正。詳見 [手機修正驗收](plans/2026-09-05-mobile-lighting-multiplayer.md) 及 [整合光影發佈](plans/2026-09-05-exhibition-lighting.md)。未進行實體 iPhone 雙人驗收；沒有新增正式資料或 commit/push。

## 前次狀態：2026-09-05 15:32 HKT — 展品框材質已部署

正式展館畫框加入四條小倒角框條、順向木紋與微表面凹凸、金屬及霧面 PBR 參數。27 項相關測試、typecheck、修改檔 lint、香港 build、bundle budget 通過；本機正式元件正側面驗證。只更新 web，app/env/volumes 保留；公開 HTTPS、ready、www、新版 ExhibitItem bundle hash 及 80/443 確認。詳見 [材質改善紀錄](plans/2026-09-05-frame-material-realism.md)。無 commit/push。

## 最新狀態：2026-09-05 14:48 HKT — 導覽原圖辨識驗收完成

導覽現在傳送目前展品的原圖，經瀏覽器壓縮及後端 Sharp 驗證後送入 Qwen 多模態訊息；不傳媒體憑證／原始 URL，不新增圖片代理。預設沿用已實測支援圖像的 `QWEN_MODEL`（目前 `qwen3.6-plus`），可用 `QWEN_GUIDE_VISION_MODEL` 獨立設定。圖片失敗／模型失敗明確說明只能依文字回答；模糊字不猜測。

完整 check 1,961 項通過（1 Redis 跳過），本機瀏覽器實際傳圖成功，香港隔離權限／圖片格式／備援／重啟驗收通過並清理合成資料。香港正式映像使用原正式 Qwen 設定，在無 volumes／無公開 ports 的臨時容器成功讀出只存在合成圖內的「星期二、Physics／物理、09:30」。正式 216 個檔案與本輪已驗證 manifest 完全相同，執行中的 service 與公開新版 JS 雜湊亦符合，HTTPS／ready／www／healthy／僅公開 80、443 正常。詳見 [導覽讀圖紀錄](plans/2026-09-05-guide-image-understanding.md)。

同期建展任務的 r3 發布已包含完全相同的讀圖檔案，因此沒有重複部署覆蓋；正式映像及備份沿用下節。未更動 env／production 資料、未 commit/push。staging 已停止；未以用戶私人原課表進行測試，也未在實體 iPhone 驗收。

## 前次狀態：2026-09-05 14:50 HKT — 建展 Agent 重構已部署

建展檢查改用獨立室內相機並等待正確預覽；Sharp 驗證空白／重複／損壞圖片，壓縮有效圖片後才送模型，證據不足不給品質分數。場景檢查獨立成 service，新增牆面標籤／畫框重疊檢查；生成場景取消重複標籤並讓入口避開座椅。視覺模型預設 `qwen3-vl-plus`，獨立最多 45 秒逾時且不自動重試；規劃模型同樣最多 45 秒且不自動重試；自動流程遇規劃備援時停止。現有環境設定及導覽模型設定保留。

完整 check 1,961 項通過、1 Redis 跳過，最後導覽相關 24 項通過；真實生成與室內截圖已驗證。香港隔離空白截圖、權限、重啟持久化與既有功能驗收通過，合成資料清理、staging 停止。正式 HTTPS、ready、www、SQLite integrity、app healthy 及只公開 80/443 已確認。詳見 [重構紀錄](plans/2026-09-05-exhibition-agent-refactor.md)。

最新 release `/home/admin/meta-exb-hk-agent-refactor-20260905-r4`，SHA256 `05666714395bf13162d1e2343d7dc6374bd7d65b7aa74299e3fd03b5f4c476f2`；app `sha256:4bdbe56b7d60386063d2cffab3fb2d359c69f23c35cda12560ab3bd7e5ce3360`；web `sha256:002bf19d821e71e569be94f266b581a630683e2d7c5ed92ceb4ea5507cd17fdc`。保留 `pre-agent-refactor-20260905-r4` 舊映像／dist。發布包包含同期導覽讀圖程式及最新 guide model 選擇；該功能的完整驗收由其原任務繼續，本次沒有改動該任務程式。未 commit/push。

## 前次狀態：2026-09-05 14:22 HKT — 香港 Qwen 已啟用

依使用者明確指示，將本機 Qwen 設定經 SSH stdin 套用到正式站限定欄位，私密備份及其他設定保留。本機與香港臨時容器真實呼叫成功；重建正式 app 容器後，現有導覽服務回傳 `source: qwen`，约 1.5 秒完整繁中回答。HTTPS／ready／www／app healthy／80、443 確認。無映像／前端／資料變更，未登入仍採既有本機備援，TTS 未實測。詳見 [Qwen 啟用紀錄](plans/2026-09-05-hongkong-qwen-enabled.md)。文件不得加入金鑰內容。

## 前次狀態：2026-09-05 14:13 HKT — 手機導覽功能框已修正

補上右上角常駐 AI 面板入口，修正低高度面板上下邊界與捲動，觸控端隱藏裁切的 NPC 頭頂氣泡。23 項相關測試、typecheck、lint、香港 build 與本機橫直向瀏覽器操作通過。正式 web 已更新，HTTPS／ready／新版 bundle／www／80、443 確認，app、env 與 volumes 保留。詳見 [手機導覽功能框紀錄](plans/2026-09-05-mobile-agent-panel.md)。

## 前次狀態：2026-09-05 14:05 HKT — 導覽 NPC 外觀已部署

導覽 NPC 換成暖白展館機器人，三種人格以螢幕／配件配色區分，加入眨眼、轉頭、擺臂及講解抬手。全套 check 1,930 項通過、1 Redis 跳過，本機三款外觀與動作驗證。只更新 web，非 dist 檔案比對與原正式版本一致，app、env、資料及 volumes 保留。HTTPS、ready、新 NPC bundle、www 及網站僅公開 80/443 確認。詳細雜湊、備份與驗證邊界見 [NPC 外觀紀錄](plans/2026-09-05-guide-npc-appearance.md)。無 commit/push。

## 前次狀態：2026-09-05 14:00 HKT — 展覽 Agent 品質控制已部署

建展 Agent 拒絕缺少多視角控制器或重複截圖的審查；修訂退步時透過既有 API 恢復本輪較佳版本並保留歷史；審查標示超出自動操作範圍的問題，停止並提供手動修正提示。詳見 [Agent 改善紀錄](plans/2026-09-05-exhibition-agent-quality.md)。

全套 check：1,930 項測試通過、1 Redis 跳過；最終介面／三語 25 項、typecheck、lint、香港 build 通過。香港隔離重複截圖、擁有者保護及重啟持久化驗收通過，合成資料清理且 staging 停止。正式 HTTPS、ready、新版 EditUI 資源、www、SQLite 及只公開 80/443 已確認。未實測真實 Qwen 視覺判讀品質。

Release SHA256 `9afbadade3645d20cb8f4c5fff9242c97f6b57d8c2c4d1930f04ed31697b0a33`；app `sha256:9f98159f038ad7689caf3a0eec702a542c9744219ecd7d6154a9c52c5d8bce25`；web `sha256:bc7a7f1226801360d218bd22fcdab1d0a8dab2ec6b6a601e6338bd7e53f4404d`。原 env、資料與 volumes 保留，舊版 `pre-agent-quality-20260905` 保留；無 commit/push。

## 前次狀態：2026-09-05 13:44 HKT — Email 認證程式已部署，待寄信服務啟用

使用者沒有寄信服務。已加入註冊待驗證、重寄、30 分鐘單次連結、hash 儲存、SMTP TLS、session 驗證及三語驗證頁；正式 Email 強制認證仍為 false，現有登入保留。不能稱作真實信箱驗證已啟用；下一步須設定可用 SMTP 並完成授權收件測試，詳見 [Email 實作紀錄](plans/2026-09-05-email-verification.md) 與 [設定說明](../deploy/hongkong/EMAIL_VERIFICATION.md)。

全套 check 1,925 項通過、1 Redis 跳過；本機真實 TLS SMTP 收信／單次 token 及手機 UI 驗證。香港隔離既有功能及重啟驗收通過，合成資料清理且 staging 停止。正式 HTTPS、ready、頁面、驗證關閉、SQLite、www 及只公開 80/443 已確認；env、資料及 volumes 保留。

Release SHA256 `df5e52b63b2a3ebadeffe944fcef16bf57c2b96463e9781362056036fe7e98d3`；app `sha256:4ea205ccf50e96cabd97d55c4bb9b268249b1da923ec6937b5fd895c05bd2efd`；web `sha256:34904f265fc44d287c6eb83b844ceed726add11d41a49609458490597f96cc74`。舊版 `pre-email-verify-20260905` 保留；無 commit/push。建置期间曾連線逾時，恢復後完成驗收與發布，未重啟主機或修改網路。

## 前次狀態：2026-09-05 13:10 HKT — QR Code 分享已部署

我的展覽 → 分享支援公開觀展 QR Code、PNG 下載及複製相同觀展連結；未公開展覽提示先發佈，不自動擴大存取權。768px 黑白 QR 由瀏覽器本機生成。詳見 [QR 分享驗收紀錄](plans/2026-09-05-exhibition-qr-share.md)。

全套 check 1,893 項通過、1 Redis 跳過；含真實 PNG 解碼測試，手機分享視窗及複製操作驗證。香港隔離完整驗收通過，合成資料清理且 staging 停止。正式 HTTPS／ready／路由／QR 資源／SQLite／80、443 檢查正常；env 與原數據保留。

Release SHA256 `bbbd1fbff1305d647c927e988d7d9473881d7b7d63fa1550b5f083259b82b94a`；app image `sha256:2225ff59e0747825be807727fed2f4909d22566832c99da4f6cfddd146f9ddc7`；web `sha256:853790f65114b231f9a3f08e291fdd05fbbe8699a250d33cc8d77bf62199ac82`。舊版 `pre-qr-share-20260905` 映像及 dist 保留。無 commit/push。

## 前次狀態：2026-09-05 12:54 HKT — 真實參觀統計已部署

後台新增獨立 SQLite 參觀統計，涵蓋匿名／登入 2D、3D 及唯讀分享，排除登入作者和協作編輯者；不再以 AI 記憶冒充完整參觀數據。顯示參觀次數、瀏覽器訪客、平均／總停留、7／30／90 日和展覽篩選、每日趨勢、作品觀看時間。正式量測自 12:53:28 HKT 開始。詳見 [實作與驗收紀錄](plans/2026-09-05-exhibition-analytics.md)。

全套 check：1,887 項通過、1 項 Redis 跳過；最後相關 79 項及 TypeScript 再通過。本機匿名觀展、切換模式、後台篩選和手機繁中介面驗證；隔離 staging 通過匿名／登入／作者排除、2 瀏覽器 3 次參觀、重送不重算、重啟持久化及既有權限／媒體／多人驗收。合成資料已清理，staging 停止。

Release SHA256 `223fd1799e88a8e66209457d2eb7372a4ff8c4267b3d1ad11311943d1972243f`；app image `sha256:478319fbed5746ecbc90df2e19189b409771d63d1ffedc3052b22dcff78b597d`；web `sha256:6adc5bb6f4f3c39bd04263f99f1ebae96af48f12029dc5d712f9cb21f0b3dfec`。正式 HTTPS、ready、SQLite integrity、新增 migration、後台登入保護與 www 轉址正常，只公開 80/443。env／資料 volumes 保留，舊版 `pre-analytics-20260905` 映像及 dist 備份保留。無 commit/push。

## 前次狀態：2026-09-05 12:28 HKT — 原展覽作品編輯已部署

卡片改為「編輯作品建展」並帶入原展覽 ID。新增手機可用的圖片作品編輯頁，支援資料、換圖、增刪、位置尺寸及 3D 預覽，明確保存回同一展覽並檢查 revision。公開狀態、分享資料、展間與其他展品保留。詳見 [實作與驗收紀錄](plans/2026-09-05-existing-exhibition-artwork-editor.md)。

全套 1,865 項測試及所有 check gates 通過，1 Redis 整合測試跳過。本機實際編輯保存與重新載入通過；香港隔離 staging 已公開展覽增刪換圖、衝突拒絕與重啟保存通過。合成資料清理完成，staging 停止。

正式 web image `sha256:49ecaf805d1635ddd8e5b2872ed9fa44960a1b654c255395bfaeb974b03d1cfb`，app 不變；發布包 SHA256 `1fceb7e82a617924a47cd03b6e216e738b3bef90cecd34b5ab450d43c0d9dd7d`。正式站入口／首頁／ready／TLS／www 正常，網站只公開 80/443，env 與資料 volumes 保留，無 commit 或 push。

## 前次狀態：2026-09-05 12:12 HKT — 虛擬展廳補上我的展覽入口

`VirtualGallery.tsx` 頂部操作區新增「我的展覽」連結，直接連到既有受保護路由 `/virtual-gallery/my-exhibitions`；沿用 flex-wrap 窄螢幕換行。未改登入或資料邏輯。

VirtualGalleryEntry 與 auth 兩檔 16 項測試、typecheck、lint、香港乾淨 build 通過。本機及正式站入口顯示已確認，正式站未登入點擊後導向登入並保留返回目的地。

白名單包 `.tmp/hk-my-entry-release-20260905-r1.tar.gz`：207 manifest files、236 entries、禁止路徑 0；SHA256 `cc87a1361b091e6356aa836af2ad51981dd130c8aa5ba19daa7924aaa583fafb`。遠端 `/home/admin/meta-exb-hk-my-entry-20260905-r1`，非 dist manifest 與上一版一致。Web image `sha256:0252235e8fda5403c78cfd277e1af1c1300c5a22dbc16b1bd323e9042249ce1f`，app 不變。舊前端 `dist.pre-my-entry-20260905`、舊映像 tag `pre-my-entry-20260905` 保留。

既有 production ready 正常、首頁 200、可信 HTTPS、www 301 保留路徑、只公開 80/443；env 雜湊不變，資料及 volumes 保留。無本輪合成資料、commit 或 push。

## 前次狀態：2026-09-05 12:06 HKT — 世界名作示範展已部署

首頁及 `/demo` 共用三件 The Met Open Access 名作：葛飾北齋《神奈川沖浪裏》、梵高《有柏樹的麥田》、維梅爾《持水壺的年輕女子》。三笔官方 API 均確認 `isPublicDomain: true`，使用本機 JPG；保留圖像比例及室內相機限制，加入三語作者、年代、原創觀看提示、CC0 來源連結。詳見 [圖像來源紀錄](demo-artwork-sources.md)。

驗證：全套 227 檔、1,850 項通過（1 Redis 整合測試跳過），typecheck、lint、server syntax、avatar、build、bundle gates 通過；最後來源連結及作者測試補強後再跑 4 項通過。本機名作比例、正式站首頁及示範展載入已核對。

部署包 `.tmp/hk-masterpieces-release-20260905-r1.tar.gz`：207 manifest files、236 entries、禁止路徑 0；SHA256 `01df4e2ff4eba2250ea1acfbd39bab15186e9ee0c63a0c408bc4c7603a0e14be`。遠端 `/home/admin/meta-exb-hk-masterpieces-20260905-r1`；非 dist manifest 與上一版一致。Web image `sha256:f50f02a4f3bf42c0c8b4273ac7d19921f3dfe734ae8191240f2f2a3e4db374eb`，app 不變。舊前端 `dist.pre-masterpieces-20260905`、舊映像 tag `pre-masterpieces-20260905` 保留。

首頁 200、ready、可信 TLS、www 301 保留路徑及既有容器正常，只公開 80/443。env 雜湊前後一致，資料及 volumes 保留；無本輪合成資料、commit 或 push。

## 前次狀態：2026-09-05 11:56 HKT — 首頁改用真實示範展間

首頁 `Gallery3D.tsx` 已替換獨立裝飾模型，改用 `createDemoScene` 與共用 `GalleryScenePreview`。三件作品可切換，沿用室內相機限制；加入完整示範展入口，不支援 WebGL 時顯示同一作品圖片。刪除無其他引用的舊裝飾場景及 CSS 模型。

驗證：全套 227 檔、1,850 項通過，1 Redis 整合測試跳過；typecheck、lint、server syntax、avatar、build、bundle gates 通過。補強後備圖片切換與參觀連結測試並單獨重跑通過。本機旋轉／作品切換及正式站作品切換、參觀入口完成瀏覽器驗證。

白名單包 `.tmp/hk-home-gallery-release-20260905-r1.tar.gz`：204 manifest files、233 entries、禁止路徑 0；SHA256 `48f7b6d35f3cecc111009e4cdbec2635f8331fee9ecf8c492c0ffac61dfb3473`。遠端 `/home/admin/meta-exb-hk-home-gallery-20260905-r1`，非 dist manifest 與上一版一致。Web image `sha256:57b89a1c36a077d049e2a702e9025142f02ff72d7dc6c5948cd8861789bf7bf5`，app image 不變。舊前端備份 `dist.pre-home-gallery-20260905`，舊映像 tag `pre-home-gallery-20260905`。

現有 production 更新成功，env 雜湊前後一致、資料及 volumes 保留；首頁 200、ready 正常、可信 HTTPS、www 301 保留路徑，只公開 80/443。沒有本輪合成資料、commit 或 push。

## 前次狀態：2026-09-05 11:48 HKT — 作品觀看相機邊界修正已部署

示範展及快速建展共用預覽新增室內相機限制，涵蓋牆壁、地板、天花板、平移目標與近裁切面安全距離。全套 1,850 項測試及建置檢查通過（1 Redis 整合測試跳過）；本機及正式站拖曳、縮放與切換作品驗證通過。

現有香港 production 已更新；web image `sha256:68d9859e8b6c39173e801bd3fb2e3c51b2aefaf31bd7511a6cb692ff0a326533`，app image 不變。首頁 200、ready、可信 TLS、www 301 及容器健康正常，網站只公開 80/443。資料、env、volumes 與舊版備份保留。詳見 [相機邊界修正紀錄](plans/2026-09-05-preview-camera-bounds.md)。

## 前次狀態：2026-09-05 11:34 HKT — 新用戶體驗更新已部署

使用者要求依修改 Markdown 以 sub-agent 開始實作。本輪三個 sub-agent 完成示範展、教學、模板／登入／加入流程，主代理整合驗證後依 `HK_DEPLOYMENT.md` 更新既有正式站。

- 新增 https://metaexb.com/demo：免登入官方 3D／2D 示例、作品詳情與切換；首頁／空白列表可直接進入。教學改為真實四步說明，模板可用狀態與實際資料一致，登入／註冊保留所選模板及經驗證的返回路徑，加入支援本站現行與舊版連結。
- `npm run check` 通過，226 個測試檔、1,847 項測試；另 1 項 Redis 測試未配置而跳過。已修正測試中的非同步斷線等待，沒有改動正式後端驗證邏輯。
- 已在既有 `meta-exb-hk-staging-20260904` 完成可信 TLS、登入／CSRF／跨帳戶權限／上傳／多人同步及重啟持久化驗收。只清理本次合成資料，staging 最後停止，volumes 保留。
- 正式來源及 project 未變；原 `.env.hongkong` 雜湊與 mode 600 保留，Google 設定維持原值。與上版 Google R2 manifest 比較非 dist 檔案雜湊全部相同，正式 app 仍運行原映像且未重啟。
- Release SHA256 `a1cae91d9e02fa1268be1e9f8fb62fe0ce0fbff8e56ee110a2823daac2b4e83f`；203 檔 manifest。新 web 映像 `sha256:57c09fc86d76ac5af067243823650a1ae78e52c2e90575cbf4e7cedf81d1332e`；app `sha256:fcbec392bf8b0aaff1ff79607b9350aa0f16c9863206136ef8a64a62c08a667c`。
- 正式首頁及 ready 正常、www/demo 301 正確、瀏覽器確認示範展 3D 及作品切換、SQLite integrity ok。只公開 80／443，重大錯誤日誌計數 0。舊前端 `dist.pre-visitor-20260905` 與 `pre-visitor-20260905` 映像 tags 保留供回復。
- 無 commit／push；無 DNS、VPN、深圳或正式資料／憑證／備份 volume 變更。

完整範圍、驗證限制與部署證據見 [新用戶修改結果](plans/2026-09-05-new-visitor-results.md)。以下「Google 未配置」等舊記錄為歷史狀態，不代表本次現況。

## 最新狀態：2026-09-04 16:41 HKT — 正式網站已重新開啟

使用者明確要求「重新開啟網站」。原 `meta-exb-hk-production` project 已以保留資料方式重新啟動，沒有重建或清除 volumes。`app` 與 `web` 均運行且 healthy；`https://metaexb.com` 及 `/api/ready` 回應 200，`https://www.metaexb.com/reopen-check` 以可信 TLS 回應 301 並保留路徑轉到主域名。主機對外監聽 80/443，應用 5176／多人 3001 仍未直接公開。網站目前保持運行。

## 最新狀態：2026-09-04 13:53 HKT — 使用者要求暫停正式網站

使用者在「暫停網站服務」與「關閉整台主機」之間明確選擇 `1`。已執行 `docker compose stop`，只暫停 `meta-exb-hk-production-app-1` 與 `meta-exb-hk-production-web-1`；兩者均為 `Exited (0)`。80/443 已不再監聽，主機只保留 SSH 22。雲端主機沒有關機，DNS、程式、正式資料 volumes、憑證、備份及還原驗證 volume 全部保留。網站目前不可訪問；日後可用原 production Compose project 重新啟動，不需重建資料。

## 最新增補：2026-09-04 13:50 HKT — 香港正式站已公開並完成驗收

此節是目前有效狀態，優先於下方所有「尚未公開／待授權」的歷史內容。使用者在被明確詢問是否可新增 `metaexb.com` 與 `www.metaexb.com` 的 A 記錄至 `47.76.58.150` 後回答「可」，本輪據此完成 DNS 與正式上線；這不擴大至深圳、VPN、購買或其他資源。

- 阿里雲 DNS 已成功新增並啟用兩條 A 記錄：`@` 與 `www` 均指向 `47.76.58.150`，TTL 10 分鐘。香港主機解析兩者均正確。
- 正式網址已上線：[https://metaexb.com](https://metaexb.com)。HTTP 會轉 HTTPS；`https://www.metaexb.com/<path>` 取得獨立可信憑證後以 301 保留路徑轉往主域名。兩張憑證均由 Let's Encrypt 簽發，有效至 2026-12-03 UTC。
- 正式 Compose project 為 `meta-exb-hk-production`，來源在 `/home/admin/meta-exb-hk-production-20260904/source`。`app` 與 `web` 均運行，app healthy；只公開 80/443，沒有公開 5176/3001/Docker API。
- 公網驗收通過：首頁及 SPA 深層路由、ready、註冊／登入、Secure/HttpOnly/SameSite Cookie、CSRF、圖片上傳與綁定、私有展廳／媒體權限、雙客戶端 WebSocket 移動與私有房間拒絕、外來 HTTP/WebSocket origin 拒絕、`www` 轉址。瀏覽器亦核對首頁、登入、註冊、公開比賽、資源未上架提示及受保護頁登入導向。
- 公網驗收用合成帳戶及上傳檔案已透過正常帳戶刪除流程清理；最後 users / galleries / media / growth / competitions 相關十個表全為 0、uploads=0，沒有留下 verifier state。
- 已建立正式初始空資料備份 `/home/admin/meta-exb-hk-production-20260904/backups/runtime-initial-empty-20260904.tar.gz`，SHA256 `4dc4158e50f0c971bfeb54ff325530bd10527b30e5f2c0606620d749eabeefde`，mode 600、admin:admin、7,733 bytes。獨立還原 volume `meta-exb-hk-production-restore-check-20260904` 已通過 SQLite integrity、空表及 uploads 驗證。
- 最終 release R3：本機 `.tmp/hk-release-20260904-r3.tar.gz`，SHA256 `ED32916F057E7207DF2A54C3EFCACFA6347DDF6958AEEFE7030E5D795153A1CD`，11,589,203 bytes；195 個 manifest 檔、223 個 archive entries、禁止路徑 0。遠端 195 個檔案雜湊已按 R3 manifest 核對。
- 最終映像：app `sha256:1cdabfa108a20381c8c0cf32dc71c1282f9e2be23fe56cb116f6dff2a5559ff2`；web `sha256:ef94f182ab50995f5104806ccbdbf2cca5a5a3de8067d9ab5d866b5f404af3b4`。最近 15 分鐘 app/web 致命或 error 日誌計數均 0；可用記憶體約 974 MiB、根磁碟約 29 GiB。
- `deploy/hongkong/Caddyfile` 已新增 `www` 到主域名的永久轉址；`deploy/hongkong/verify-staging.mjs` 已修正 gallery revision 驗收參數。部署支援測試 31/31 通過。沒有 commit 或 push。
- AI、Google 登入、寄信／忘記密碼、客服外部服務及真實資源下載仍未配置；相關 UI 只顯示停用／準備中，不可宣稱已提供。未做中國內地不同網路／比賽場地實測；上線不等於內地連線保證。
- 香港正式站保持運行。舊香港 staging 保持停止；深圳、VPN、路由、舊 8443 預覽、購買及退訂均未動。

完整上線證據與後續注意事項見 [香港公開上線紀錄](plans/2026-09-04-hong-kong-public-launch.md)。

## 最新增補：2026-09-03 21:25 HKT — 本機功能修正及驗收完成，未部署

使用者在上一輪「是否修正已發現問題」後回答「好」，本輪據此修正應用；這不是 DNS、公網或香港部署授權。

- 已補上成長記憶管理入口：新增孩子、私人展覽、JPG/PNG/WebP 相片上傳、保存與 3D 檢視；保留原推薦頁的精簡資料載入。
- 已補上主辦比賽表單和正確入口：只使用本人已發佈的展館，預設建立私人草稿；沒有自動發佈真實展館。表單明確說明前置條件、日期及錯誤狀態。
- 修正本機大回應卡住：完整回應接收仍受超時／取消保護，Vite API 代理使用 keep-alive。獨立重現與真實 app 都驗證成功；263,544-byte 展覽及 527,552-byte 後台回應完整，瀏覽器後台正常載入。不是宣稱先前香港也有此故障。
- 修正角色預覽標籤。忘記密碼、客服表單／聯絡及資源內容已改成明確「未啟用／未上架」，**並非已接通寄信、客服或真實下載**；未新增任何外部服務或憑證。
- 最後全套：215 檔、1,747 項通過；1 Redis 整合測試因未配置跳過。最後 20 項聚焦檢查亦通過；typecheck / lint / 135 檔 server syntax / avatar / 正式 build / bundle gates 通過。未提高測試 timeout。
- 本機新合成帳戶、孩子、展覽、相片及比賽已透過正常帳戶刪除清理；唯讀 DB 核對相關表全 0、uploads 全 0、integrity ok。自建瀏覽器頁已關閉、尺寸已還原；本輪測試程序已停止，4178 / 5188 / 3018 無監聽。8443 舊使用者 tunnel 未動。
- **香港／深圳／DNS／VPN／路由全部未動**；網站未公開，域名審核未重查，香港 staging 尚未套用本輪修正。沒有 commit、push、購買或新 task。
- 詳細程式範圍、驗證證據及未完成服務：[功能修正結果](plans/2026-09-03-function-fixes.md)。下一步若要更新香港，需取得具體部署授權；勿將測試 staging 直接公開。

## 最新增補：2026-09-03 20:45 HKT — 功能驗收完成，尚有未接通功能

使用者本輪要求「你測試一下各功能是否正常」。已測試及診斷，**沒有獲得或推定應用修正、DNS／公開、再次主機重啟或深圳操作授權**。

- 核心帳戶、图片、快速建展、角色及展覽 3D、場景編輯保存、資料權限、香港雙客戶端同步及容器重啟後保存均有新證據。成長記憶 API 與資料匯出／清理亦通過。
- 不能宣稱所有功能正常：忘記密碼、支援表單／聯絡及資源下載仍為提示操作；成長記憶新增與比賽主辦 UI 入口不完整。角色預覽的 aria-label 誤稱不可用，實際 3D 畫面正常。
- 本機 Vite 大回應會不完整並造成頁面持續載入；直連本機 API 正常。香港另以 103,003-byte 展覽及 206,470-byte 後台回應測試，均完整通過，沒有重現。傳輸根因未修正／未定論，不能把本機現象說成香港故障。
- 兩次全套各 1,728 通過、1 項 5 秒逾時、1 Redis 跳過；分別涉及 AvatarCustomizer 及 ExhibitionWizard。最後這兩檔 13 項聚焦重跑全通過，但兩次全套仍須記錄為未全綠。typecheck / lint / server syntax / avatar / 新 production build / bundle budget 全通過。
- 香港兩輪 4 個新合成帳戶及本機 1 個合成帳戶均已精準清理；香港 users / galleries / media 均為 0。本機 users / galleries / media / growthExhibits 及 uploads 檔案均為 0。原有備份／還原驗證 volume 保留。
- 香港兩容器 exited、無 host port binding；本機 4178 / 5188 / 3018 均停止，瀏覽器自建頁面已關閉且視窗尺寸還原。網站仍未公開，網域審核本輪未查；VPN／路由／深圳未改。
- 詳見 [功能驗收結果、問題及未測範圍](plans/2026-09-03-function-acceptance.md)。下一步可由使用者決定先修正功能／載入問題；這份測試結果不是全面上線許可。

## 最新增補：2026-09-03 19:45 HKT — 香港安全維護及一次重啟完成

此節優先於以下 19:26 的「待核心重啟確認」。使用者已對香港安全／核心更新及一次重啟明確回答「好」，且工作已完成，不需重問或重做。

- 已實際安裝 220 個安全相關套件更新；再安裝同一 Ubuntu 24.04 / 6.8 系列核心與持續追蹤套件，9 個新增、零刪除。保留舊核心及原有 cloud-init hold，沒有跨發行版升級或重設密碼。
- 19:41:32 執行 **一次** 香港 `47.76.58.150` 重啟。新 boot ID `9967fdfd-a4d3-4f5b-b889-8999c7a8aaa0`，現行核心 `6.8.0-138-generic`，同一 hostname / SSH 主機指紋核對成功。SSH、Docker、containerd 正常。
- apt / dpkg / needrestart 正常，無 failed units 或待重啟標記；最後安全來源預演無可自動套用套件。仍有 80 個其他較新候選，包含一般更新與雲端客製 cloud-init hold，不能宣稱全部套件已最新或完全無漏洞。
- DB、staging env、Compose 及 authorized_keys 在重啟前後雜湊完全一致。隔離啟動後內部 TLS、ready、首頁及 profile 深層路由通過；既有獨立還原 volume 的 SQLite / 帳戶 / 場景 / 圖片雜湊再次核對成功。
- smoke test 後 **兩個 staging 容器已再次停止，無任何运行容器或網站端口公開**；DB 雜湊亦未變，沒有新增測試帳戶。本輪未重跑完整瀏覽器／登入／多人套件，不把 smoke test 說成完整公網驗收。
- 啟動／套件／網路／SSH 設定備份已保存在 `/home/admin/meta-exb-hk-maintenance-20260903/`，root mode 600；不包含 SSH 私鑰或應用 secret，不是整機快照。舊核心仍可供回復。先前應用備份與還原驗證資料保留。
- 最終可用記憶體約 1174 MiB、磁碟約 29 GiB；未新增 swap、購買或刪除資源，未改 DNS、雲端防火牆、用戶 VPN／路由或深圳。
- 網域本輪未重查：最後 19:25 仍是模板審核中、域名未實名。下一步應刷新域名結果，再取得精確 DNS / 公開授權；此安全維護授權不包含公開網站。

完整版本、備份雜湊、驗證範圍及回復限制：[香港安全維護執行紀錄](plans/2026-09-03-hong-kong-security-maintenance.md)。沒有修改應用程式、commit、push 或新增 task。

## 最新增補：2026-09-03 19:26 HKT — 安全更新及網域診斷完成，待核心重啟確認

- 本輪只做安全更新預演和網域唯讀核對，**尚未安裝更新、更新核心或重啟**；staging 仍停止、無網站端口公開。
- 香港系統仍有 272 項候選更新；一般 upgrade 預演 270 項，安全來源及相依關係預演 220 項。預演會下載 apt cache 及寫日誌，但套件版本未改，`dpkg --audit` / `apt-get check` 正常。
- 現行核心 `6.8.0-63-generic` 沒有持續追蹤用的 kernel metapackage，故一般 upgrade 不會安裝新核心；同一 Ubuntu 24.04 / 6.8 系列候選為 `6.8.0-138.138`。原有 cloud-init hold 不可解除。下一步需使用者確認安全更新、核心更新及香港主機重啟一次；保留舊核心與回復路徑。
- Chrome 新查證：`metaexb.com` 本身仍「未实名认证」、網域電郵「验证未通过」；**使用者的資訊模板已顯示「注册局审核中」、模板電郵「验证成功」**。兩者不同，不能叫使用者重複提交模板，也不能把模板審核中說成域名已通過。
- 香港端向公開 DNS 查 A / AAAA / NS 都為 NXDOMAIN。此次沒有重新查到精確 ClientHold / serverHold 值，不能把舊 ClientHold 當成最新 EPP 證據。
- 沒有改 DNS、身份資料、雲端防火牆、VPN、路由或深圳；沒有發送驗證電郵、購買快照或新增監控。正式 DNS / 公開授權仍未取得。

詳見 [安全更新及域名檢查紀錄](plans/2026-09-03-hong-kong-security-readiness.md)。本輪最終待確認的是香港安全／核心更新與一次重啟，不是再次購買、重建 SSH key 或公開網站。

## 最新增補：2026-09-03 19:12 HKT — 已完成隔離建置及驗收

此節優先於下面 18:44 的環境準備紀錄和原交接正文；是使用者再要求「你進行下一步」後的實際結果，不是新的公開授權。

- 已新增獨立 `deploy/hongkong/` 設定、排除秘密及資料的打包工具，保留現有應用程式及私人部署設定。前端在本機建置，後端在香港建置；沒有新增 swap、升級主機或購買資源。
- 已上傳新部署包至 `/home/admin/meta-exb-hk-staging-20260903/source`，核對 archive SHA256 及 192 檔案雜湊後建立映像。此目錄現含 mode 600 的**全新 staging 專用** `.env.hongkong`，不得輸出或整目錄重新打包；不是正式 production secret。
- 隔離 Compose project：`meta-exb-hk-staging`。兩容器 `meta-exb-hk-staging-app-1`、`meta-exb-hk-staging-web-1` 已完成測試，**目前均已停止，映像及 volumes 保留**。沒有任何 host port binding，網路為 internal-only。Docker 內的 `metaexb.com` alias 不是公開 DNS。
- 已通過：內部 TLS 憑證驗證、ready、SPA 深層路由、兩個新測試帳戶註冊、Secure/HttpOnly Cookie、CSRF、登入／登出／無效舊 Cookie 恢復、圖片上傳與權限、跨帳戶讀寫拒絕、兩個 Socket.IO 客戶端同步及外來 origin 拒絕。重啟後帳戶、展覽場景及圖片雜湊仍一致。
- 本輪完整本機測試 211 檔／1728 項通過；1 項 Redis 整合測試因未配置而跳過。最終部署支援測試 40 項通過；typecheck、lint、135 檔後端語法、avatar、正式 build 及 bundle budget 均通過。這不等於完整公網／瀏覽器驗收。
- 兩個本輪合成帳戶已精準刪除，舊身份 token 查詢 401；staging DB 目前 users=0、galleries=0、media=0。無待清理的活動測試帳戶，不重用先前測試憑證。
- 已在 staging 停機狀態備份 runtime volume，還原到獨立 `meta-exb-hk-restore-check-20260903` volume，核對 SQLite integrity、帳戶、場景及圖片；備份已下載到本機受 ACL 保護的 `.tmp/hk-staging-backups-20260903/` 並核對雜湊。**備份及還原驗證 volume 仍保留合成資料，不是空白 production seed，也不代表深圳已有備份。**
- 主機最終仍只監聽 SSH 22、本機 DNS 53；沒有香港公開網址，沒有改 DNS、雲端防火牆、用戶 hosts／VPN／路由或深圳資源。沒有建立公開憑證或讓使用者電腦信任測試 CA。
- 下一步仍需處理主機系統安全更新／必要重啟安排、核實域名實名及 ClientHold，再取得 `metaexb.com → 47.76.58.150` 的明確 DNS／公開授權。正式環境需全新 project、資料、secret 和憑證儲存；不能把測試環境直接公開。
- 公網正常 TLS、實際瀏覽器 UI、內地網路及正式備份政策未驗收。SSH 金鑰仍禁止 forwarding，沒有為測試而放寬限制。AI／Google 登入仍未設定。

完整檔案清單、最終 release／映像／備份雜湊、測試範圍及已處理的執行細節見 [香港隔離部署驗收紀錄](plans/2026-09-03-hong-kong-staging.md)。沒有 commit、push 或新增對話。

## 最新增補：2026-09-03 18:44 HKT

以下是交接後、使用者先同意 SSH 金鑰並再要求「進行下一步」後的實際結果。此節覆蓋下方歷史正文內「金鑰尚未建立」及「Docker 尚未安裝」的舊狀態；其餘未重新核實的狀態仍須按需查證。

- 香港專用 SSH 金鑰已建立，公鑰已加入 `47.76.58.150` 的 `admin`，原有 authorized_keys entries 已保留及備份。嚴格主機驗證、登入、非互動 sudo 及 SFTP 唯讀測試均成功；不需要重問此項金鑰授權。
- 本機設定：`C:/Users/Leo/.ssh/meta-exb-hongkong.conf`，alias `meta-exb-hongkong`。私鑰只留本機，不得讀取／输出／上傳；權限、指紋、限制及撤銷方式見 `C:/Users/Leo/.ssh/meta-exb-hongkong-README.md`。公鑰使用 `restrict`，禁止 SSH 轉送及 PTY，沒有自動到期；部署命令及帳戶原有 sudo 權限仍可用。
- 香港基礎環境已由官方簽章套件來源安裝：Docker `29.7.2`、Compose `v5.5.0`、Buildx `v0.37.0`；Docker/containerd 服務正常並設定隨開機啟動。沒有新增 docker 群組成員或公開 Docker API。
- 已成功執行官方 hello-world、Node `v24.20.0`、Caddy `v2.11.4` 的短暫測試容器；測試容器離開後已自動清除，保留三個下載映像。**零應用容器、零資料 volumes，尚未上傳源碼、建立正式 secret 或部署網站。**
- 現在仍只有 SSH 22 及本機 DNS 53 監聽；網站端口未啟用。Docker 建立了正常的本機 bridge/iptables/forwarding 設定，不可宣稱主機的所有網路設定完全未變；沒有改雲端防火牆、用戶 VPN／路由、DNS 或深圳資源。
- 本輪選定測試為 6 檔／45 項通過，後端語法檢查 135 檔通過；不是完整正式上線驗收。實測可用記憶體約 1097 MiB、磁碟剩餘 34 GiB，沒有新增 swap。
- 系統仍有待評估的套件更新（安裝時 apt 報 272 項未升級）；公開前須處理安全更新及必要的重啟安排。域名實名／ClientHold、DNS 及深圳退款狀態在本輪沒有重查。
- 下一階段：準備獨立公開 origin 設定、低記憶體建置方式及排除秘密／用戶資料的新源碼包，再做隔離驗收。修改 DNS／公開服務前仍須明確說明目標及取得相應確認。

完整執行結果、映像 digest 及限制：[香港環境準備紀錄](plans/2026-09-03-hong-kong-environment.md)。沒有修改應用程式、commit、push 或新增對話。

## 以下為原交接正文（歷史狀態）

## 先讀這一節：現在停在哪裡

- 用戶要把現有專案公開，讓其他人註冊、使用並保存用戶數據，亦可能在中國內地比賽現場展示。
- 已選擇香港主機，**用戶已自行完成購買，不能再買一台**。網域 `metaexb.com` 也已付款。
- 香港主機已透過阿里雲 Workbench 一鍵免密登入；只做過唯讀系統檢查，**尚未上傳專案、安裝 Docker 或部署網站**。
- **尚未建立或安裝香港 SSH 登入金鑰。** 上一輪最後問用戶是否同意加入香港主機專用公鑰，仍未獲回答；用戶改為要求這份交接。
- 深圳舊主機仍顯示運行中。用戶曾說已退訂，但後續控制台證據未能確認成功。不要宣稱已退款，也不要自行退訂／釋放。
- `metaexb.com` 最近一次刷新後仍顯示「未實名」。曾開過審核頁，但不能僅由頁面 URL 判定已通過；公開解析尚未完成。
- 現有 `https://localhost:8443` 是深圳主機透過 SSH 的私人預覽，不是香港網站，也不是可分享的公網網址。
- 本次交接只新增這份 Markdown；沒有修改程式、雲端資源、登入權限或 DNS，沒有建立新對話或 commit。

下一個對話應先閱讀本文件及 `D:/meta_exb/AGENTS.md`，確認用戶接下來要求。若要繼續部署，第一個待確認事項是下列 SSH 金鑰授權，不要重新詢問是否接受 ¥56 主機價格。

上一輪原問題：

> 你同意我在 `47.76.58.150` 加入這把專用公鑰，供後續部署使用嗎？私鑰只留在你的電腦，香港主機只存公鑰，不需要傳密碼。

## 用戶需求與已做決定

- 使用繁體中文／廣東話、非技術措辭；用戶希望代理實際幫忙操作，不想反覆收取長篇部署教學。
- 原本預算 ¥30–50／月；用戶已接受香港通用型 ¥56／月，並自行買好。
- 付款方式只有 WeChat Pay 和 Alipay；未確認是內地或香港版本。沒有必要再研究付款平台，現有兩項購買已完成。
- 選香港是為避免把網站部署在中國內地主機所需的 ICP 備案流程。**域名實名認證與 ICP 備案是不同事項**。
- 不保證香港主機在內地必定快速／可達；上線後必須實測，現場展示應另備本機／離線可行方案。
- 深圳購買前沒有充分說明 ICP，先前代理已道歉；避免再次作出未核實的購買建議。
- 不要把 AI API 免費額度當成主機方案。主機、網域、AI 呼叫是分開費用。

## 資源現況與證據

### A. 香港：新的部署目標

| 項目 | 已觀察值 |
| --- | --- |
| 名稱 | Ubuntu-phpi |
| 地區 | 中國香港，`cn-hongkong` |
| 實例 ID | `c634859396574c16a500a2e8f8fe1c32` |
| 公網 IPv4 | `47.76.58.150` |
| 私網 IPv4 | `172.19.55.47` |
| 套餐 | 通用型、2 vCPU、2 GiB、40 GiB ESSD |
| 系統 | Ubuntu 24.04；終端顯示 Ubuntu 24.04.2 LTS、x86_64 |
| 狀態 | 最後核對為運行中 |
| 到期 | 2026-10-03 23:59:59 HKT |
| 購買前確認的價格 | 1 個月 ¥56；購買草稿已取消勾選自動續費 |
| 實際購買後自動續費 | **未另行查核，不能把草稿狀態當成實際訂閱證據** |
| Workbench 登入使用者 | `admin`，UID/GID 1000；`sudo -n` 的唯讀公鑰指紋命令成功 |
| 主機 hostname | `iZj6cauo6k7q9ctxhdefuwZ` |
| SSH 主機 ED25519 指紋 | `SHA256:frQ4q2+l4Ab7w9D3rBw3Wflc4nyIFzAmI8S/2Qm7Yrg` |

指紋來源：2026-09-03 約 18:26 HKT，已登入的阿里雲官方 Workbench 內執行 `sudo -n ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`。這是**伺服器身分指紋**，不是我們尚未建立的登入金鑰。

唯讀檢查結果：

- `ss -ltn` 只見 SSH `*:22` 及本機 DNS 的 53 埠；當時沒有網站服務。
- `command -v docker` 沒有輸出，表示 Docker 不在該登入環境 PATH 中，不能宣稱已安裝。
- `free -m` 顯示可見總記憶體約 1613 MiB、available 約 1221 MiB，無 swap。不要因套餐標示 2 GiB 就假定建置時有完整 2 GiB 可用；建置需留意 OOM。
- 根檔案系統約 40G，已用 2.6G，可用 35G。
- 未修改密碼、SSH 設定、authorized_keys、防火牆、套件、檔案或服務。
- 尚未驗證本機到此 IP 的 SSH 可達性；Workbench 能連入不等於本機可直連。

### B. 網域：已買，但尚未可公開使用

- `metaexb.com`，阿里雲萬網。
- 用戶自行付款；曾看到支付成功頁及域名清單。
- 購買前選的是單獨 `.com`、1 年 ¥85，沒有 AI 建站或其他網域組合；當時顯示續費 ¥95／年，日後以實際報價為準。
- 清單顯示註冊時間 `2026-09-03 17:53:48`，到期 `2027-09-03 17:53:48`。
- 最近刷新後狀態仍是「未實名」；支付成功頁曾顯示 `ClientHold`／暫停解析。
- DNS 伺服器顯示 `dns29.hichina.com`、`dns30.hichina.com`。這不是已設定網站 A 記錄的證據。
- 尚未設定指向香港主機的 A/AAAA 記錄，未簽發正式 HTTPS 憑證。
- 用戶曾自行操作實名／信息模板；不要讀取或抄錄不必要的姓名、身分證、地址、證件圖等資料。需要輸入身份資料時交由用戶，勿索取聊天貼文中的證件或密碼。

### C. 深圳：舊私人預覽，不是新公開目標

| 項目 | 已觀察值 |
| --- | --- |
| 名稱 | Ubuntu-kjzb |
| 地區 | 華南1（深圳），`cn-shenzhen` |
| 實例 ID | `ce47655a85a4492fa98564f066f4ad0a` |
| 公網 IPv4 | `120.79.240.7` |
| 私網 IPv4 | `172.17.8.187` |
| 套餐 | Ubuntu 24.04、2 vCPU、4 GiB、50 GiB |
| 到期 | 2026-10-02 23:59:59 HKT |
| 最後觀察 | 控制台刷新完成後仍運行中；香港截圖也仍列深圳 1 台 |

退訂頁最後看到的是**退訂確認表單**：原訂單 ¥29、當時估算可退 ¥29，兩個確認框未勾選，「立即退訂」不可按。這不是退款完成紀錄；該頁也可能是用戶留存的舊表單，應查實際訂單／退款狀態。

任何退訂會導致實例及資料釋放。先確認有沒有需要保留的資料，取得必要授權、完成備份及隔離還原驗證，才可提出最終退訂確認。**本次沒有有效備份已完成的證據。** 不要勾選「已完成備份」而其實沒有做過。

## 本機工程與必读檔案

- 工作目錄：`D:/meta_exb`；**Git 根目錄實際是 `D:/meta_exb/web_ui_new`**。在上層執行 `git status` 會報不是 repository。
- 交接時 branch：`feature/adaptive-mobile-performance`，HEAD 短碼 `b93377d`。這只是當時狀態，不授權切分支。
- 工作樹有大量既有修改及未追蹤檔案，包括 `deploy/`。必須保留；不要 reset、checkout、clean、stash 或全量覆寫。
- 使用 npm 跑宣告的 scripts，從 `web_ui_new` 執行。不要任意切 Bun；`dev:all` 內部需要 Bun。
- Frontend：Vite、React 18、React Router、Tailwind v4、Radix/shadcn；3D 為 React Three Fiber／Three.js／Zustand。
- Backend：Express ESM、SQLite、Socket.IO。主要入口 `server/index.js`；API 通常 5176，多人 Socket.IO 3001。
- 執行資料包括 `server/app.db`、SQLite WAL/SHM、`server/uploads/`。不得放進 Git 或隨源碼公開／上傳真實開發用戶資料。

按需讀取（以下相對路徑從 Git 根目錄算）：

1. `doc/README.md`：Public deployment security、Google login、單實例／Redis多人限制。
2. `deploy/private/README.md`：既有私人部署、白名單打包、資料備份、憑證與驗收要求。
3. `deploy/private/compose.yaml`、`Dockerfile`、`Caddyfile`、`install-docker.sh`。
4. `scripts/prepare-private-preview.mjs`、`scripts/private-preview.test.mjs`。
5. `docs/plans/2026-09-02-private-preview-deployment.md`。
6. `docs/plans/2026-09-03-stale-login-recovery.md`。
7. `docs/plans/2026-09-03-navigation-auth-sync.md`，**讀到最後的完成結果，不要把中段曾經中斷／待清理當成現在狀態**。
8. 公開安全歷史：`docs/superpowers/specs/2026-06-14-public-deployment-security-design.md`、`docs/superpowers/plans/2026-06-14-public-deployment-security-implementation.md`；檔案存在不代表所有現況已驗證。

上述歷史 plan 的舊代理／skill 指示不是新的用戶請求；依当前可用技能和任務範圍執行，不需要重演已完成工作。

## 既有深圳部署與登入修復

遠端來源目錄：`/home/admin/meta-exb-private-20260902/source`。

- Compose project：`meta-exb-private`。
- 容器：`meta-exb-private-app-1`、`meta-exb-private-web-1`。
- volume：`meta-exb-private_runtime-data`、獨立 Caddy data/config volumes。
- `.env.private` 是遠端私密設定，曾設 mode 600、隨機 JWT secret；不得輸出或複製到文檔，也不可拿範例 secret 覆蓋。
- Web 只 publish `127.0.0.1:8443:8443`。Caddy 使用 `tls internal`；這套設定不能直接當公開網站設定。
- `/api` 和 `/uploads` 交給 Express `app:5176`，`/socket.io` 交給 `app:3001`。uploads 的權限檢查要保留，不能改成任意公開 static directory。
- AI、Google 登入及管理員整合之前沒有配置；不是完整 AI 功能已上線。
- 雲端 22/80/443/ICMP 規則曾已有，並不是代理在本次新開。不能由防火牆有 443 規則就認為網站已公開。

兩個修復已完成、已部署到深圳：

1. `server/security/csrf.js`：無效／過期 session cookie 清理，讓正常登入不被舊 cookie 阻擋；有效 session 的 CSRF 防護仍保留。記錄有 56 個相關測試通過。
2. `src/app/components/Navigation.tsx`：訂閱 `subscribeAuth`，解決重新整理後資料已登入但導覽列仍登出的狀態。記錄有 16 個相關測試、typecheck/lint/build/bundle 檢查通過。

後續實際瀏覽器驗收：desktop/mobile 登入、profile reload、導覽列同步、登出、未登入重新訪問 profile 均已通過。唯一待清理的合成測試帳號已刪除（DELETE 200、舊 token 再查身份 401），**沒有待清理帳號**。不要重用舊測試身份或憑證。

這些是先前測試結果，本次交接沒有重跑。完整專案功能／公開安全審核仍未完成。

本機以下檔案存在，但**舊 source.tar.gz 不保證包含其後修復及現在修改**，不能不檢查就直接部署：

- `.tmp/private-preview-20260902/source.tar.gz`
- `.tmp/private-preview-20260902/deployment-fix.tar.gz`
- `.tmp/private-preview-20260902/resume-upload.sftp`
- `.tmp/private-preview-20260902/upload-assets.sftp`
- `.tmp/private-preview-20260902/private-preview-root.crt`

舊 Docker 建置曾遇中國內地下載慢，使用經核實 digest 的官方映像來源及阿里雲 Debian mirror；香港不應未測試就照搬 workaround。既有 Dockerfile 包含 SQLite native module 與 Caddy capability 修正，重用前請讀實作。

## SSH、VPN 與憑證注意

本機只確認以下深圳檔案存在；**香港專用檔案尚未建立**：

- `C:/Users/Leo/.ssh/meta-exb-shenzhen.conf`
- `C:/Users/Leo/.ssh/meta-exb-shenzhen-preview`（私鑰，不能讀取／輸出內容）
- `C:/Users/Leo/.ssh/meta-exb-shenzhen-preview.pub`
- `C:/Users/Leo/.ssh/meta-exb-shenzhen-known_hosts`

深圳 SSH alias 是 `meta-exb-private`，user `admin`；此前採 `BatchMode yes`、`IdentitiesOnly yes`、嚴格主機指紋驗證。深圳 ED25519 指紋為 `SHA256:07xRzQ8A44TZnw4bYUraPlj3cWdeZXbG2w/up77v6gg`。**不要把深圳 alias 指向香港，也不要把兩台主機的指紋混用。**

VPN 曾使 SSH 不穩定。用戶已自行設定 NordVPN 分流，只讓 ChatGPT／Codex 等指定應用走 VPN；關 VPN 會讓用戶不能用 Codex，因此不要要求其無準備直接斷 VPN。

- 曾經獲准新增暫時路由 `120.79.240.7/32` 經 Ethernet interface 22、gateway `192.168.101.1`，未設永久；當前是否仍在需重查。
- 這個授權只針對當時深圳連線，不授權任意修改 VPN、Kill Switch、預設路由或香港路由。
- `localhost:8443` 私人預覽依賴用戶手動啟動的 SSH tunnel。先前自動 tunnel 啟動被工具政策拒絕，不要換 launcher 迴避。
- 歷史 PID 已過時，不可依本文件或舊 plan PID 殺程序。
- 用戶曾授權信任私人 Caddy CA，僅供 localhost；公開網站應使用正常受信任 HTTPS，不要叫訪客安裝這個 CA 或跳過憑證警告。

## 瀏覽器接手方式（狀態可能失效）

用戶先前明確要求操作自己的阿里雲 Chrome 頁面；不是 Codex ambient localhost 頁面。不要因為 context 有 in-app browser 就切換到它。

- 使用當前可用的 Chrome browser skill，先按 skill 完成必要閱讀／初始 setup。上一個對話使用的路徑：`C:/Users/Leo/.codex/plugins/cache/openai-bundled/chrome/26.901.20858/skills/control-chrome/SKILL.md`。如果版本不同，用當前 skills 清單。
- 動作透過 `mcp__node_repl__js` 與 browser-client。不要改用 standalone Playwright、CDP、讀 Chrome profile/cookies/storage，或從其他工具繞過登入／瀏覽器限制。
- 新對話不保證有任何既有 JavaScript binding。舊對話若仍有 `chrome` 則重用，不要因 tab 遺失而重選 browser 或反覆讀完整 API 文檔。
- `chrome.user.openTabs()` 取得 fresh user-tab objects；`chrome.user.claimTab(該物件)` 接手。**不存在 `chrome.tabs.claim`**。
- `chrome.tabs.get(id)` 只用於当前 session 已擁有的 tab；未接手 user tab 要先 claim。
- DOM snapshot 要在實際載入完成後判讀。阿里雲 reload 後可能短暫顯示「沒有資源」再出現清單；不能把初始空畫面當退款成功。
- 「通用型／國際型」切換可能自動重設地區為新加坡和容量；最後必須核對地區、規格、時長及總價。但現在已買好，**不需要再操作購買頁**。

最後觀察到的頁面（ID 只是定位提示，需重新列出並核實）：

| 舊 tab ID | 用途／狀態 |
| --- | --- |
| `470778733` | 香港主機清單：`https://swasnext.console.aliyun.com/servers/cn-hongkong` |
| `470778805` | 已登入 `admin@Ubuntu-phpi` 的 Aliyun Workbench 終端；已 markHandoff |
| `470778754` | `dc.console.aliyun.com` 的 `#/domain-list/all`，曾顯示 metaexb.com 未實名 |
| `470778739` | 先前深圳退訂確認頁，不能視為退款成功 |
| `470778796` | 舊香港報價 tab，後來已變成控制台首頁；不要當作仍可付款的報價 |

Workbench 已成功使用 `getByRole('textbox', {name:'Terminal input', exact:true}).fill(command)`，再 `tab.cua.keypress({keys:['ENTER']})` 執行唯讀命令。仍須先根據新 snapshot 確認終端連到正確主機、沒有未完成命令；勿輸出 secrets 或 session token。

本文件不保存 Workbench session URL、登入 token、密碼、私鑰或個人證件。

## 建議的後續工作順序

以下是交接建議，不是已完成事項，也不替代用戶授權。

1. **SSH 存取授權。** 先接續上文最後問題。獲准後才建立香港獨立金鑰、只加入目標主機 admin 的 authorized_keys，保留既有 entries；私鑰留在本機 `.ssh` 並限制存取。是否設定有效期／限制及撤銷方式需清楚記錄。
2. **驗證目標身分與連線。** 經 authenticated console 核對香港 host key，建立独立 known_hosts/config，嚴格驗證，不要使用 `StrictHostKeyChecking=no`。本機試連時不要套用深圳金鑰或舊 tunnel。
3. **確認要部署的源碼。** 保留 dirty tree，確保最新兩個登入修復包含在版本內；白名單打包，排除 `.git`、node_modules、`.env*`、DB/WAL/SHM、uploads、SSH key、測試輸出。不要直接整個 workspace 上傳。
4. **準備香港環境。** 先唯讀確認現有服務和防火牆；按当前專案需求安裝受信任 Docker/Compose。注意 2GB 套餐可用記憶體，必要時先在本機建置；不要擅自升級／購買資源。
5. **建立獨立公開部署設定。** 私人 compose/Caddyfile 只能作參考；另做香港環境，正確 public origin、secure cookie、CSRF、HTTP/WebSocket origin 和 reverse proxy 信任配置。用新的正式 secret、持久 DB/uploads、單 app process；未有 Redis 不要多副本。
6. **確認資料策略。** 不把本機真實用戶 DB 或深圳合成測試數據當作 production seed。若用戶要遷移資料，先明確範圍、備份並驗證。不能因是「測試主機」就假定可以刪所有資料。
7. **域名實名与公開授權。** 只讀核實域名是否已解除 ClientHold；身份驗證由用戶處理。在修改 DNS／開放公網服務前說明 `metaexb.com → 47.76.58.150` 及新增的公開面向，按當前規則取得需要的確認。避免直接把尚未驗收的登入系統暴露出去。
8. **DNS + 正常 HTTPS。** 配 A 記錄，檢查是否有錯誤 AAAA。僅讓網關對外 80/443（實際需求按配置驗證）；API 5176、Socket.IO 3001、DB 不直接公開。Caddy 憑證資料需持久保存，不購買不必要的付費 SSL。
9. **驗收。** 正常 TLS 的 `/api/ready`、SPA 深層路由 reload、註冊／登入／登出／過期 session、CSRF、防跨用戶讀寫、圖片上傳／權限、展覽保存、雙客戶端 Socket.IO 同步、重啟後持久化、備份還原，及內地網絡實測。合成帳號最後精準刪除，不能宣稱完整測試通過而只測了 ready。
10. **收尾深圳。** 查退款／訂單實際狀態與資料需求。沒有備份成功證據前不要退訂。確認不可恢復後取得最終授權，才退訂精確的深圳 instance，不碰香港。舊路由、tunnel、金鑰／CA 如需移除，各自確認範圍。

## 常用驗證命令與邊界

從 `D:/meta_exb/web_ui_new` 執行，先讀 scripts 和適用檔案；不要將歷史通過當成当前 checkout 通過。

```powershell
npm run test -- server/security/csrf.test.js server/security/csrfLogin.integration.test.js
npm run test -- src/app/components/Navigation.test.tsx src/app/auth.test.tsx src/app/api/auth.test.ts
npm run check:server
npm run check
```

- 更動文件用 apply_patch；不要用腳本或 shell 大量覆寫使用者檔案。
- 不要建立新 task、goal、commit、push 或安排自動監控，除非用戶明確要求。
- 不要自行 spawn sub-agents；本任務没有相關授權需求。
- 不要反覆要求已批准的事項，但購買、接受條款、新增持續存取權、公開資料／服務、資料刪除各自要符合當前明確授權。

## 已查官方參考（價格與政策仍以當前頁面為準）

- [阿里雲：建立輕量應用伺服器](https://help.aliyun.com/zh/simple-application-server/user-guide/create-a-server)
- [阿里雲：實例規格族](https://help.aliyun.com/zh/simple-application-server/product-overview/instance-families/)：國際型 BGP（非中國優化）對內地較高延遲／丟包，因此沒有選 ¥39 的 2GB 國際型。
- [阿里雲：退款](https://help.aliyun.com/zh/simple-application-server/product-overview/refunds)：退款资格、時效、資料釋放必須重新核實。
- [阿里雲：域名註冊](https://help.aliyun.com/zh/dws/user-guide/how-to-register-a-domain-name)
- [Caddy：Automatic HTTPS](https://caddyserver.com/docs/automatic-https)

## 給下一個對話的最短啟動訊息

> 請先完整閱讀 `D:/meta_exb/web_ui_new/docs/HANDOFF-2026-09-03-HONG-KONG-DEPLOYMENT.md` 和 `D:/meta_exb/AGENTS.md`，再接手 MetaEXB 香港公開部署。香港主機及 metaexb.com 已買好，不要重買；香港尚未部署，專用 SSH 公鑰仍待授權，先向我確認這個待辦。深圳退訂未確認完成，不要刪資料或修改我的 VPN。保留現有 dirty tree，依交接文件先核實當前狀態。
