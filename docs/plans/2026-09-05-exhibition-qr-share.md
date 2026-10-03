# 展覽 QR Code 分享

使用者要求分享支援 QR Code。

- 我的展覽 → 分享：已公開展覽顯示 QR Code、複製相同公開觀展連結、下載 PNG。
- 使用 `/exhibitions/:id`，不再讓訪客取得舊的編輯器入口。編輯仍使用展覽卡片既有入口。
- 未公開展覽提示先發佈，不自動公開或產生編輯授權。
- 768px 黑白 PNG、4 模組留白、M 容錯；瀏覽器本機生成，不使用外部 QR 服務。套件以動態載入減少首屏負擔。
- 三語載入／錯誤／重試提示；切換展覽時忽略舊圖片回應；手機視窗可捲動。

## 驗證與部署

- `npm run check` 通過：235 檔、1,893 項測試，1 項 Redis 整合測試未配置而跳過；TypeScript、lint、server、avatar、build 及 bundle gates 通過。
- 5 項分享元件測試涵蓋 URL／下載、未公開、錯誤重試、舊 QR 回應及檔名；另用 sharp＋jsQR 真正解碼生成 PNG，確認解析出的完整網址正確。
- 本機瀏覽器：合成已公開展覽開啟分享、顯示 QR、複製成功提示及 PNG 下載連結確認；390×844 手機尺寸視窗中 QR 與按鈕可見。合成帳戶／展覽已透過正常 API 刪除，分頁及本機伺服器已停止。
- 乾淨香港包 213 manifest 檔案、242 archive entries，禁止路徑 0；SHA256 `bbbd1fbff1305d647c927e988d7d9473881d7b7d63fa1550b5f083259b82b94a`。與上版比較，非 dist 僅 package.json／package-lock.json 改動。
- 香港隔離驗收通過：登入、CSRF、跨帳戶、媒體、多人同步、已公開作品修改、參觀統計與重啟保存；合成資料清理完成，staging 停止且保留 volumes。
- 2026-09-05 13:10 HKT 已更新既有正式站。app image `sha256:2225ff59e0747825be807727fed2f4909d22566832c99da4f6cfddd146f9ddc7`，web `sha256:853790f65114b231f9a3f08e291fdd05fbbe8699a250d33cc8d77bf62199ac82`。
- 正式 HTTPS、ready、我的展覽路由、新 MyExhibitions／QR JS 資源 200；受保護 analytics API 401、www 301、SQLite integrity ok。量測開始時間仍為 12:53:28 HKT。網站僅公開 80/443，env 雜湊不變，資料與 volumes 保留，舊 `pre-qr-share-20260905` 映像／dist 備份保留。無 commit 或 push。
