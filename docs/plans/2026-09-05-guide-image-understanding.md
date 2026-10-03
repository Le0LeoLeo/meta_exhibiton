# Guide Image Understanding Implementation Plan

**Goal:** 導覽回答能讀取目前展品原圖及文字，並在看不清楚時明確說明。

**Architecture:** 瀏覽器透過既有媒體權限取得目前展品圖片，轉成受限大小 JPEG；後端驗證並重編碼圖片，僅有圖片時使用視覺模型。手動與自動導覽共用 requestAgentReply，因此兩條流程一致；不新增遠端 URL 代理或公開媒體。

**Tech Stack:** React、TypeScript、Canvas、Express、Zod、Sharp、Qwen OpenAI-compatible API。

1. 測試並實作 image context／圖片編碼；限制單張圖片、傳輸大小，取消失效請求，不將憑證或原圖 URL 傳到模型。
2. 測試並實作後端圖片驗證及多模態請求。保留文字模式，失敗時明確標示無法讀圖；圖中文字視為不可信資料。
3. 跑相關測試、型別、lint、build；以合成課表測試真實模型辨字。
4. 香港隔離環境先驗證，再部署並驗證正式服務。保留 Qwen 金鑰、其他環境設定、資料及 volumes；不 commit/push。

## 執行結果 — 2026-09-05 14:48 HKT

- 四步已完成。圖片最多 800,000 字元，JPEG／PNG／WebP 由 Sharp 解碼重編碼，最大 2,048px；前端只取得當前作品，保留既有媒體授權且不向外站送認證。手動／自動對話共用流程。
- `qwen-vl-max-latest` 在現有 key 上回傳拒絕存取；真正的 `qwen3.6-plus` 圖像呼叫成功，所以沿用現有 QWEN_MODEL，另提供 QWEN_GUIDE_VISION_MODEL override。沒有修改任何環境金鑰。
- 全套 `npm run check`：247 檔、1,961 項通過，1 Redis 整合測試因未設定 URL 跳過；server syntax、avatar、TypeScript、lint、build、bundle budgets 通過。
- 本機瀏覽器使用真實 serializeAgentExhibit → requestAgentReply → Canvas JPEG → Express route → Sharp → Qwen 流程；只有 title「測試圖片」，回答正確讀出圖內星期二 Physics／物理 09:30。loopback 測試 harness 的合成認證只存在 `.tmp`，不進發布包。
- 香港隔離 API 驗證：未登入 401、遠端 URL 400、有效圖像 200、未設 key 的明確讀圖失敗備援；既有媒體跨用戶權限、CSRF、WebSocket、展覽修改、統計及重啟持久化亦通過。合成帳號精準清理，staging 停止且 volumes 保留。
- 本輪 whitelist release：216 檔，archive SHA256 `0bb1e5596e2c386e19e7e226b5f13645881564507a85282ccd612f82c7b3c0a8`，遠端 `/home/admin/meta-exb-hk-guide-vision-20260905-r1`。同期 `agent-refactor-20260905-r3` 的全部 manifest 檔案與本輪一致；該任務已發布，因此保留其正式 release，沒有再重複覆蓋。
- 正式 app `sha256:486fc81c2310bbae1e25930021eb2e2497a1291b786ee6978789b75f7a661c56`；web `sha256:eb879f6801caf74cd9998bc6a76cb47059a1ffa0c7275ad0c7f3edf4e5e098a0`。逐檔確認 production source 216 檔、running service 及公開 MetaverseStudioApp-BMIoPlM7.js／index.html 均符合已驗證 hash。
- 另以正式映像、正式 Qwen 設定在香港無公開 ports／無掛載 volumes 的一次性 bridge 容器完成真實讀圖，source=qwen，答案正確。臨時容器自動移除；只輸出答案，未輸出設定秘密。
- 可信 HTTPS、ready、www 301、app healthy、網站只公開 80／443 通過；原 env、資料與備份保留，無 commit/push。

驗收邊界：未拿用戶私人原始课表作測試，亦未在實體 iPhone 測試；外站圖片仍需允許既有瀏覽器跨來源讀取，失敗會明確說明。極細／模糊文字仍可能無法辨識。
