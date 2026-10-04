# Email 持有權驗證

使用者要求登入使用真實 Email 驗證，並確認目前沒有寄信服務。

## 範圍

- Email／密碼註冊先寄驗證信；未驗證時不發登入 token 或 cookie。
- 既有未驗證密碼帳戶於強制啟用後先驗證再登入；原資料保留。
- 明確按鈕 POST 確認，驗證 token 置於 URL fragment、DB 僅存 hash、30 分鐘到期、單次使用。
- 重寄需要 Email＋密碼，每帳戶 60 秒冷卻及 IP 節流；不把未寄出的申請稱作已寄出。
- SMTP 使用 TLS 憑證驗證；缺設定時不允許啟用。
- 前端三語驗證頁、返回原路徑、重寄及錯誤提示；Google 登入維持獨立驗證。

## 啟用界線

目前沒有外部 SMTP 服務／憑證，也尚未取得授權收件人的真實收件驗證，因此正式 `EMAIL_VERIFICATION_ENABLED` 保持關閉。程式完成與本機收信測試不能當作真實信箱收件成功。啟用步驟見 [部署設定](../../deploy/hongkong/EMAIL_VERIFICATION.md)。

## 驗證及發布

本機加密 SMTP 實際傳送／MIME 收信、token 單次使用／雜湊測試已通過。測試使用本機 OS socket 避免防毒軟體替換 loopback TCP 憑證，TLS 憑證驗證保持開啟；不代表外部郵件送達。手機 390px 驗證頁未啟用提示、停用重寄及返回登入已確認。全套 npm run check 通過：239 個測試檔、1,925 項測試，1 Redis 整合測試跳過；server syntax／avatar／typecheck／lint／build／bundle 全部通過。香港隔離驗收涵蓋驗證關閉、既有註冊登入、CSRF、跨帳戶權限、媒體、多人協作、參觀統計與重啟持久化，合成資料清理且 staging 停止。2026-09-05 13:44 HKT 已部署香港正式站；HTTPS／ready／驗證頁／登入及註冊路由／www 301／SQLite integrity／80、443 檢查正常。正式瀏覽器確認未啟用提示及停用重寄，auth/config 為 false。env hash 不變，資料與 volumes 保留；未寄真實外部郵件。


Release SHA256: df5e52b63b2a3ebadeffe944fcef16bf57c2b96463e9781362056036fe7e98d3，216 manifest files、245 archive entries、禁止路徑 0。正式 app image sha256:4ea205ccf50e96cabd97d55c4bb9b268249b1da923ec6937b5fd895c05bd2efd；web image sha256:34904f265fc44d287c6eb83b844ceed726add11d41a49609458490597f96cc74。舊版 pre-email-verify-20260905 映像與 dist 保留；無 commit/push。

隔離建置期間曾出現 SSH banner 及瀏覽器逾時，主機恢復連線後完成隔離驗收，正式發布前後 ready 正常；未重啟主機或變更網路設定。本機測試程序已停止。

## 2026-09-05 19:18 HKT 阿里雲 Direct Mail 設定

使用者明確確認新增 mail.metaexb.com 的四筆寄信 DNS，包含阿里雲寄信授權及 DMARC 統計報告收件。已在阿里雲 DNS 新增以下記錄（TTL 10 分鐘、預設線路、啟用）：
- TXT mail：v=spf1 include:spf1.dm.aliyun.com -all
- TXT aliyun-cn-hangzhou._domainkey.mail：使用 Direct Mail 控制台提供的 1024 位 DKIM 公鑰。
- TXT _dmarc.mail：v=DMARC1;p=none;rua=mailto:dmarc_report@service.aliyun.com
- MX mail：mx01.dm.aliyun.com，優先級 1。

阿里雲控制台四項均顯示「驗證通過」。原 @、www A 記錄 47.76.58.150 保留。已建立觸發郵件寄件地址 noreply@mail.metaexb.com，狀態正常，未填回信地址。SMTP 為 smtpdm.aliyun.com:465（TLS）。

已打開 SMTP 密碼設定視窗，尚未輸入或設定憑證；依瀏覽器憑證設定 handoff 規則由使用者完成。正式網站尚未配置 SMTP 或啟用 Email 強制驗證，未寄送測試郵件。
