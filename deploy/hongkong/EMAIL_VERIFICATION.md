# 電子郵件驗證啟用

驗證寄信與 Google 登入是兩條不同途徑。Google 已由伺服器驗證 ID token 與 `email_verified`；一般 Email／密碼帳戶需要寄信服務才能確認使用者持有信箱。

## 前置條件

1. 有可用 SMTP 寄信服務及已核准的寄件地址／網域。
2. 服務憑證只放香港主機現有 mode-600 `.env.hongkong`，不放對話、前端、Git 或發布包。
3. 先在隔離環境完成無外寄驗收，再向授權測試收件人寄信並確認收件、驗證及後續登入。
4. 未完成真實寄送驗收前，不啟用強制驗證，以免鎖住現有帳戶。

## 設定欄位

```dotenv
EMAIL_VERIFICATION_ENABLED=true
SMTP_HOST=<provider-host>
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=<provider-user>
SMTP_PASSWORD=<secret-configured-on-server>
SMTP_FROM=<verified-sender-address>
```

`FRONTEND_ORIGIN` 沿用既有 `https://metaexb.com`，不用請求的 Host 組合驗證連結。保持 TLS 憑證驗證；不得為寄信設定 `rejectUnauthorized=false`。

如選 Resend，其 [官方 SMTP 文件](https://resend.com/docs/send-with-smtp) 要求建立 API Key 及驗證網域，並提供 `smtp.resend.com`、465（TLS）或 587（STARTTLS）；使用者名稱為 `resend`、密碼為 API Key。建立帳戶、同意條款與取得憑證需由帳戶持有人完成；新增 DNS 必須依實際服務提供的紀錄操作，不推測值或改動網站 A 記錄。

## 本輪狀態

2026-09-05 20:00 HKT：阿里雲 Direct Mail 已接通。`mail.metaexb.com` 的 SPF、DKIM、DMARC、MX 均驗證通過，寄件地址為 `noreply@mail.metaexb.com`，使用杭州 SMTP 端點及 465 TLS。使用者以遮蔽輸入視窗提供憑證，並以收件匣截圖確認唯一一封授權測試信已收到。

僅更新香港現有環境檔的 SMTP 與驗證開關欄位，原檔已私密備份，其餘設定保留。沿用當前正式映像，在無正式資料掛載的臨時容器驗證單次 token、雜湊、冷卻、session 撤銷、到期及實際 service 的 SMTP 認證，然後只重新建立 app 容器。正式 `/api/auth/config` 回傳 `emailVerificationEnabled: true`；首頁、ready、HTTPS、www 轉址及容器健康正常，只公開網站 80/443。

SMTP 測試信不包含帳戶驗證連結，不會驗證使用者帳戶。真實帳戶點信內連結及後續登入仍須由帳戶持有人完成；本次未代登入或更改任何既有帳戶的驗證狀態。

## Google 帳戶連結

強制驗證啟用後，首次以 Google 連結既有未驗證帳戶會使原未驗證密碼失效並撤銷舊 session，避免他人預先登記的密碼繼續存取帳戶。使用者可繼續使用 Google 登入，或透過密碼找回流程確認信箱持有權後設定新密碼。驗證關閉時保留原 Google 連結行為。

## 密碼找回

`/reset-password` 沿用本服務的寄信設定與啟用狀態，不需新增正式環境憑證。申請 API 一律回傳通用 202，後台才查詢帳戶並寄信；此回覆不是送達證明。寄信失敗記錄 `auth.password_reset_delivery_failed`，不記錄信箱、連結或憑證，使用者可稍後重新申請。

每個帳戶每分鐘最多一封重設信；連結存雜湊、30 分鐘到期，重新寄送取代舊連結。密碼更新與 session version 增加使用同一條件 SQL，防止同時消耗同一連結。一般改密碼、Google 連結與其他 session version 更新亦使舊重設連結失效。成功後撤銷舊 HTTP/Socket 登入、寄出通知並要求重新登入。密碼最少 8 字元、最多 72 UTF-8 bytes，以避免 bcrypt 截斷。

驗收參見 `docs/plans/2026-09-10-reliability-phase-one.md`。`verify-password-reset.mjs` 只可在新的隔離 tmpfs 與無外部網路容器內執行；若存在資料庫會拒絕執行。

