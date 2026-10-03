# 香港 Qwen 設定啟用

2026-09-05 14:22 HKT。使用者明確要求查本機 Qwen API 並套用至香港。

- 本機 `web_ui_new/.env` 有 Qwen 金鑰，聊天模型 `qwen3.6-plus`、北京相容端點 `https://dashscope.aliyuncs.com/compatible-mode/v1`，TTS 模型 `qwen3-tts-flash`。
- 本機依專案啟動方式使用 Node 系統 CA，真實聊天呼叫成功。未加系統 CA 的初次診斷遇 Connection error，未停用 TLS 驗證。
- 先在香港無掛載資料、無公開埠的臨時容器驗證相同模型／端點與導覽請求參數，成功產生繁中回答；容器自動移除。
- 金鑰只透過 SSH stdin 傳輸，未寫進腳本、命令列、發布包或輸出。保留私密 mode-600 遠端環境備份，只修改 QWEN_API_KEY、QWEN_BASE_URL、QWEN_API_BASE_URL、QWEN_MODEL、QWEN_TTS_MODEL。程式比對確認其他設定保留，環境檔仍為 600。
- 重建正式 app 容器以載入設定，未建新映像、未變更前端。app／web 映像保持原值，資料、uploads、憑證與 volumes 保留。
- 正式容器內呼叫現有 `generateAgentReply`，使用純合成作品資料，回傳 `source: qwen`，約 1,538ms 產生完整繁中回答；未建立測試帳戶或展覽。
- 公開 HTTPS 首頁 200、ready 成功、www 保留路徑 301；app healthy，網站僅公開 80/443。

限制：未以使用者登入狀態進行瀏覽器端聊天驗收，也未實測 TTS 音訊；未登入仍按既有邏輯使用本機備援。模型可回覆不代表所有藝術描述都已經核實。

本次是使用者授權的執行環境設定更新，未修改應用程式或重新發布 build；無 commit/push。
