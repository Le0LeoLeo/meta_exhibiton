# 新用戶體驗修改與香港部署結果

完成時間：2026-09-05 11:34 HKT。

## 分工與交付

使用三個 sub-agent 分別完成示範展／空白狀態、首頁／教學、模板／登入／加入展廳；主代理整合三語文字、對比修正、交叉審查、全套檢查、瀏覽器驗收及香港部署。没有 Git commit 或 push，原有工作目錄修改保留。

| 需求 | 本次交付 |
|---|---|
| UX-01 | `/demo` 官方示範展，三幅自行繪製 SVG、作品詳情、作品切換、3D 旋轉／平移／縮放及 2D 後備觀看；首頁、頁尾與 CTA 都可進入 |
| UX-02 | 展覽列表為空時顯示官方示範卡；載入失敗顯示重試；首頁無紀念卡時顯示精簡示範入口 |
| UX-03 | 假影片改成四步驟「快速上手」，說明上傳、自動排展、預覽、發布及裝置限制；可鍵盤開關及返回焦點 |
| UX-04 | 三個有場景資料的模板可預覽实际布局與作品；另外三個標示即將推出並停用；登入後保留所選模板，由用戶再次明確點擊才建立草稿 |
| UX-05 | 密碼及 Google 登入／註冊保留經驗證的站內返回路徑；提供建立／開啟展覽的情境說明與示範入口 |
| UX-06 | 支援本站公開連結、分享 token、UUID，以及目前「我的展覽」產生的舊版編輯／觀看連結；外部網址及不支援格式拒絕；保留原有權限驗證 |
| UX-07 | 調整淺色灰字、金色文字及按鈕 hover 配色；新增示範連結使用高對比文字與下劃線；驗證手機版面 |
| UX-08 | 新增三語文字，修正 All 分類與未翻譯的關閉提示，沿用頁首 MREI 元境智展品牌；原始客戶引言未改寫 |

示範展重用 `GalleryScenePreview`，是旋轉／作品聚焦觀看，不是第一人稱行走或多人／AI 示範。沒有新增後端示範帳號或展覽資料，沒有改動編輯器場景 singleton；建立、保存及權限機制保持原有邏輯。

## 本機驗證

- `npm run check` 通過：139 個後端 JS 語法、avatar 資產、TypeScript、ESLint、226 個測試檔／1,847 項測試、Vite build 與容量檢查。
- 另有 1 個 Redis 整合測試因未配置 Redis 測試服務而跳過。
- 首輪全套測試發現既有 Socket.IO 測試的斷線事件時序競爭：權限拒絕與 player:left 已收到，但立即檢查 connected 太早。只增加等待 `disconnect` 並核對 `io server disconnect` 原因，沒有修改正式驗證邏輯；整個 socket 測試檔 76 項及最終全套均通過。
- 最大 JS chunk 706.1 KiB／800 KiB；總 JS 3088.6 KiB／4800 KiB；CSS 207.0 KiB／220 KiB；最大 GLB 1621.0 KiB／1800 KiB；總 GLB 10356.5 KiB／11000 KiB。
- 本機瀏覽器確認：首頁新入口、3D 真實渲染、下一件作品／詳情切換、2D 圖片、手機 390×844 視窗、可捲動教學、Enter 開啟及 Escape 關閉、模板實際布局、登入→註冊保留模板參數、外部連結拒絕、舊觀看連結保留 share=view、繁中／簡中／英文入口及淺色首頁。
- 示範手機頁面量測 document scrollWidth 等於 clientWidth，沒有橫向溢出。這是桌面瀏覽器視窗模擬，不是真機效能測試。
- 淺色 muted 文字在頁面／次要／白色背景對比分別由 4.30／4.08／4.53 提升為 5.52／5.23／5.81；金色文字由 2.31／2.19／2.43 提升為 5.22／4.95／5.50。深色既有 muted token 對 secondary 約 8.15，保留其設定。
- 真實瀏覽器未提交註冊條款或登入 Google 個人帳號；完整密碼／Google 回傳後路由銜接由元件測試覆蓋，真實 session／資料權限由下述隔離驗收覆蓋。

## 香港隔離驗收

沿用已存在 `meta-exb-hk-staging-20260904` project、來源 `/home/admin/meta-exb-hk-staging-20260904/source`、原環境與 volumes，無 host port binding。

通過可信 staging CA 驗證的 HTTPS、ready、SPA 深層路由、兩個合成註冊帳號、Secure／HttpOnly／SameSite Cookie、CSRF 正反例、圖片上傳與绑定、跨帳戶 gallery／media 拒絕、外來 HTTP／WebSocket origin 拒絕、雙客戶端加入／移動／同步、登出及失效 Cookie 登入恢復。

重啟 app／web 後再次核對帳號、展覽、場景與圖片 bytes 持久化。完成後以正常帳戶刪除流程清理本次合成帳號，舊 token 拒絕、測試媒體無法訪問，verifier state 已刪除。`/demo`、三個示範 SVG、模板、登入及註冊 SPA 路徑均 200。Staging 最後已停止，volumes 保留。沒有關閉 TLS 驗證。

## 正式部署

- 正式站：https://metaexb.com/；示範展：https://metaexb.com/demo。
- 沿用 `meta-exb-hk-production` 與 `/home/admin/meta-exb-hk-production-20260904/source`。
- Release：`.tmp/hk-visitor-release-20260905-r1.tar.gz`，11,608,218 bytes。
- Archive SHA256：`a1cae91d9e02fa1268be1e9f8fb62fe0ce0fbff8e56ee110a2823daac2b4e83f`；本機／遠端一致。
- 203 個 manifest 檔案、232 個 archive entries，禁止路徑數 0；逐檔 SHA256 核對後套用。
- 與原已部署 Google R2 manifest 比較：所有非 dist release 檔案雜湊相同，本次實際產品變更全部在前端。
- 保留原 Google 公開 client ID；`.env.hongkong` 更新前後雜湊相同且 mode 600，正式資料與憑證 volumes 未替換。
- 上一版映像保留為 `meta-exb-hk-production-{app,web}:pre-visitor-20260905`；先前前端保留在正式來源的 `dist.pre-visitor-20260905`。
- App 仍使用原映像 `sha256:fcbec392bf8b0aaff1ff79607b9350aa0f16c9863206136ef8a64a62c08a667c`，沒有重啟既有 app。
- Web 新映像 `sha256:57c09fc86d76ac5af067243823650a1ae78e52c2e90575cbf4e7cedf81d1332e`。
- 首頁 200、`/api/ready` 回傳 ready、`https://www.metaexb.com/demo` 可信 TLS 301 到主域名 `/demo`。
- 網站只公開 80／443；5176、3001、Docker API 未公開。
- SQLite 唯讀 integrity_check 為 ok；近 10 分鐘 app uncaught/unhandled/fatal 及 web error/panic/fatal 計數均 0。
- 正式瀏覽器重新載入後確認新版 index 資產、四步教學、免登入示範 3D 及作品詳情切換。首次開頁曾載入先前快取；reload 後新版本正常，首頁檔案 SHA256 與容器及 release 一致。

遠端操作證據保留於 `/home/admin/meta-exb-hk-visitor-20260905-r1/{staging-deploy,staging-verify,production-deploy}.log`。本次未變動 DNS、VPN、深圳或正式備份 volumes。

## 尚未列為完成的延伸項目

- 短碼加入及新增分享 QR Code 是原文件後續選項，本輪未新增。
- 未新增真正影片；已採用需求允許的圖文／圖示教學方案。
- 客戶引言的來源／授權需由內容擁有者確認，本輪保留原文；沒有宣稱已核實。
- 只整理本次新手流程用語與主要品牌入口，沒有全站逐頁改寫舊內容或宣稱完整 WCAG 稽核。
- 未驗收中國內地網路、實體手機效能、真實 Google 帳號登入或示範轉化率。
