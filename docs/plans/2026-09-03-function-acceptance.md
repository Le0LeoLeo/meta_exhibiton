# MetaEXB Function Acceptance Plan

**Goal:** Test the current dirty checkout and the existing private Hong Kong staging deployment without changing application behavior or publishing the site.

**Architecture:** Existing automated tests, a fresh secret-free production build, an isolated loopback-only browser runtime with an empty database, and the existing synthetic Hong Kong staging acceptance runner. No real user data, external AI calls, new agents, commits, DNS changes, VPN changes, or Shenzhen operations.

**Tech Stack:** npm, Vitest, TypeScript, ESLint, Vite, Express, SQLite, Socket.IO, approved browser tooling, existing SSH and Docker Compose staging configuration.

## Execution

1. Run the full test suite and type/lint/server/avatar checks. Record initial failures and isolated reruns without changing timeouts or application code.
2. Build using `deploy/hongkong/vite.config.ts` into `.tmp/function-acceptance-20260903/build/dist`; run the existing bundle-budget script with that build directory as working directory.
3. Run `deploy/hongkong/verify-staging.mjs` against the existing internal-only Hong Kong containers: prepare, restart containers, verify persistence, then delete only this run's accounts and stop services. Verify no published ports and no leftover synthetic state.
4. Start a disposable local backend copied through the existing release allowlist, with a fresh runtime database and loopback-only listeners. Disable local `.env` loading and external integration credentials. Use the real current frontend with a secret-free local Vite configuration.
5. Exercise important browser journeys with synthetic data: authentication/profile, avatar, gallery creation/save/view, growth memories, competition/public pages, sharing/navigation and narrow-screen behavior where tooling supports it. Report the exact coverage; do not imply every page or external integration passed.
6. Stop our local services, remove only our disposable runtime data if necessary, and write observed results, reproducible defects, untested integrations and release limitations here. Preserve the user's original data and existing worktree changes.

The writing-plans skill is being applied as a bounded testing checklist. Its optional execution sub-skill is unavailable; execution stays in this task, sequentially, without new worktrees, agents or commits.

## Final results — 2026-09-03 20:45 HKT

**結論：主要建展及資料保存流程可用，但不能說所有功能正常。** 部分功能仍是提示訊息或缺少入口；本機開發轉送層有大回應不完整的問題。香港隔離部署沒有重現該傳輸問題。此次只做測試及診斷，沒有修正應用程式。

### 自動檢查

- Full suite, 20:16–20:21 HKT: 210 files passed, 1 failed, 1 skipped; 1,728 tests passed, 1 failed, 1 skipped. The failure was `AvatarCustomizer > applies a curated look and can undo it`, exceeding the default 5-second timeout.
- Immediate isolated rerun at 20:22 HKT: all 11 AvatarCustomizer tests passed in 4.06 seconds total (tests 1.43 seconds). This suggests timing sensitivity under concurrent load, not a proven functional defect; the initial full-suite failure remains recorded.
- Typecheck, lint, server syntax (135 files), and avatar-package validation passed.
- Redis multi-instance integration test skipped because `REDIS_TEST_URL` is unset; no claim of multi-instance acceptance.
- Second full suite at 20:34 HKT with `--maxWorkers=2`: again 210 files / 1,728 tests passed, 1 file / 1 test failed, 1 Redis test skipped (397.65 seconds). This time AvatarCustomizer passed, but `ExhibitionWizard > renders a mobile-friendly six-step workflow and reports validation errors` exceeded the unchanged 5-second timeout.
- Final focused rerun at 20:41 HKT, both affected files together: **13 / 13 tests passed**, 4.77 seconds total. The two complete runs were not fully green; do not replace their outcomes with the focused rerun or claim the timing cause is proven.
- Fresh production build using the Hong Kong secret-free config passed, 3,065 modules / 9.58 seconds. Bundle checks all passed: largest JS 706.1 KiB, total JS 3,020.7 KiB, CSS 205.8 KiB, largest GLB 1,621.0 KiB, total GLB 10,356.5 KiB.

### 實際驗證範圍

| 功能 | 結果與限制 |
| --- | --- |
| 香港註冊／登入／登出 | 兩輪全新合成帳戶的 API 驗收通過；Secure / HttpOnly / SameSite Cookie、過期 Cookie 恢復均通過。註冊頁的條款提交沒有代用戶操作。 |
| 本機登入及個人資料 | 瀏覽器登入、姓名保存、重載、導覽列同步及手機版登出通過。登出後 `/profile` 轉到登入頁。 |
| 角色設定 | 快速造型、保存、重載後選中造型及實際 3D 角色畫面通過。最初把預覽區的 aria-label 當成失敗提示，已用截圖及源碼糾正；不是 WebGL 故障。 |
| 快速建展 | 合成 PNG 上傳、自動排展、私人草稿保存、3D 預覽、2D 切換、隔離環境內發布及開啟參觀頁通過。沒有把網站公開到網際網路。 |
| 進階編輯 | 已連上多人服務；放置展台、復原／重做、手動／自動保存、重載及平面圖往返通過。保存後場景含 painting、pedestal；工具列「展品」只計 painting / sculpture，因此仍顯示 1，並非新增失敗。沒有窮舉所有模型、材質、拖曳及快捷鍵組合。 |
| 展覽管理 | 修改描述後重載保留、已公開狀態及 2D / 3D 參觀通過。較大縮圖產生後，本機後台及部分展覽讀取受下述轉送問題影響。 |
| 權限與多人 | 香港跨帳戶展覽／圖片讀写拒絕、CSRF、HTTP / WebSocket 外來 origin 拒絕；兩個 Socket.IO 客戶端加入、移動及場景同步通過。不是大量並發壓力測試。 |
| 重新啟動後保存 | 香港容器重啟後，帳戶、展覽 JSON 及圖片逐位元雜湊一致。此次沒有再次重啟香港主機。 |
| 成長記憶 | 本機 API 建立合成兒童／展覽、上傳、簽名圖片存取、留言、推薦、分享及撤銷通過；缺少前端建立入口，不能把 API 通過等同完整使用流程通過。 |
| 資料匯出與刪除 | 個人資料匯出成功，遞迴檢查未含 password / secret / share token / CSRF 欄位。正常刪除 API 清除本次帳戶及關聯資料，舊身份驗證回應 401。 |
| 比賽 | 公開空清單能載入，未授權讀取私有比賽的管理查詢回應 403。主辦入口問題見下文；尚未完整實測建立比賽、報名、審批及投票。相關既有單元測試不等於完整現場驗收。 |
| 手機與語言 | 390 × 844 視窗測試：選單、登入狀態、支援表格及繁中 → 簡中 → 英文 → 繁中切換正常；支援頁 clientWidth / scrollWidth 同為 375，沒有橫向溢出。沒有實體手機或 VR 頭戴裝置測試。 |

### 已確認問題／尚未接好的功能

1. **忘記密碼是假成功提示。** `src/app/pages/Login.tsx:128` 只呼叫 toast；即使電郵空白也會顯示「重設密碼連結已發送」。沒有對應寄信／重設流程，不能供真正遺失密碼的使用者使用。
2. **支援聯絡及表單未接服務。** `src/app/pages/Support.tsx:91` 的客服／電郵／電話操作只有提示；`handleFormSubmit` 等待 900 ms 後清空欄位並顯示已收到問題，沒有送出請求。以合成資料操作後表格清空。應接上真實服務，或明確標示尚未提供。
3. **資源區的學習、文件、下載及文章是佔位操作。** `src/app/pages/Resources.tsx:90`, `:119`, `:146`, `:162` 只顯示 toast，沒有實際文件導向或下載；「下載將在幾秒後開始」會誤導使用者。本項以源碼確認，未宣稱每張資源卡都下載測過。
4. **新帳戶成長記憶入口不完整。** `/growth-memories` 實際只有 9 個偏好按鈕；沒有新增兒童／展覽／作品入口，也沒有空狀態引導。源碼 `GrowthMemories.tsx` 目前只渲染推薦。後端資料功能雖正常，普通新用戶無法從這頁開始建立內容。
5. **「我要主辦比賽」沒有完成主辦流程。** 按下後到 `/virtual-gallery/my-exhibitions`，現行頁面沒有主辦比賽表單／按鈕。這不表示比賽 API 不存在，而是目前 UI 路徑未完整接通。
6. **本機大回應卡住，頁面超時保護未涵蓋讀取內容。** 在本次隔離 Vite runtime，`/api/galleries/admin/analytics` 回應標頭為 200、Content-Length 149,218，但經 4178 轉送後內容未完整讀完；直接讀 5188 能完整收到 149,218 bytes。Vite 記錄 ECONNRESET，後台與手機重載展覽曾持續停在載入狀態。`src/app/api/request.ts` 在收到 response headers 後就清除 timeout，後續 `parseJsonSafe(res)` 的 body 讀取不受該 timeout 保護。這是本機測到的傳輸／載入問題，轉送根因尚未定論；不把它宣稱為香港正式部署故障。
7. **角色預覽輔助文字誤標。** `AvatarPreviewCanvas.tsx` 無論是否正常顯示 3D，都把預覽容器 aria-label 設為「3D 預覽暫時無法使用…」。截圖證明角色正常顯示，但輔助科技會收到錯誤狀態文字。

### 香港大回應交叉驗證

另外在相同隔離 Compose 中建立全新合成帳戶，以隨機生成的非個人 JPEG 縮圖測試大資料回應：展覽內容 **103,003 bytes**、後台內容 **206,470 bytes** 均經內部 Caddy / HTTPS 完整取得，縮圖內容逐位元相同。兩者均超過本機出現問題的資料尺度；這一輪沒有重現卡住。腳本在 `.tmp/function-acceptance-20260903/verify-large-response.mjs`，遠端副本在 staging source 目錄之外，不含憑證。

### 未驗證／不能宣稱可用

- AI 策展、聊天、語音及 Google 登入的真實第三方整合沒有設定；Google 按鈕為停用。快速建展成功不表示已呼叫真實 AI 模型。
- Redis 跨實例、完整比賽生命週期、完整護照／紀念品流程、VR、全部模型／影片／音訊格式、所有頁面的可及性與視覺細節、長時間／高並發負載未完整驗收。
- 公開 DNS、正常公開 TLS、香港瀏覽器端到端連線、中國內地實際網路及實體手機仍未驗收。香港驗證使用內部網路與明確信任的 staging CA；本機畫面驗證是開發模式，兩者不能混為公網驗收。

### 清理及交付

- 香港兩輪共 4 個全新合成帳戶均經正常 API 精準移除；停止後以唯讀且 immutable 的 SQLite 檢查確認 **users=0、galleries=0、media=0**，測試狀態檔不存在。
- 香港 app / web 容器均 exited、port bindings 均為 `{}`。原有備份及獨立還原驗證 volume 保留，未刪除或拿來當 production seed。
- 本機唯一合成帳戶及關聯資料已移除；**users=0、galleries=0、media=0、growthExhibits=0、uploads 檔案=0**。本機 fixture 憑證狀態檔已刪除。
- 本機 4178 / 5188 / 3018 的自建服務均已停止，最後檢查沒有這些監聽端口；兩個自建瀏覽器頁面已關閉，臨時手機視窗設定已還原。
- 測試腳本、合成圖片及空白測試資料庫保留在 git-ignored `.tmp/function-acceptance-20260903/` 供重現；沒有任何真實用戶資料或有效帳戶憑證。未改 DNS、VPN、路由、深圳或使用者原有資料；沒有 commit / push / 新 task / 子代理。
- 依最小改動及規劃技能，本次只新增驗收紀錄與隔離測試輔助檔，**未修正以上問題**。下一步需要使用者要求修正後才實施。
