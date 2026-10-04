# Audit Report

> 修正進度：本次使用者確認後，H1–H3 已實作修正。原始發現與當時分數保留作為審查紀錄；目前行為與驗證見文末「修正紀錄」。M1–M5 不屬於這次優先修正的範圍。

**Input:** `D:/meta_exb/web_ui_new` 當前工作目錄的原始碼與測試；包含既有未提交變更。

**Assumptions:** 以準備對外提供的展覽平台為目標，評估一般展覽建立、儲存、分享、帳號及維護流程。未登入正式環境、未做瀏覽器操作或負載測試；本報告不是完整安全認證。

**Quick Stats:** `src/`、`server/` 共 404 個非測試 TS/TSX/JS 檔、68,837 個實體行；`src/`、`server/`、`config/`、`scripts/` 共 215 個測試檔，另有 Vite 設定測試。主要架構為 React、Three.js/R3F、Express、SQLite、Socket.IO。

## Executive Summary (Read This First)

- [HIGH] 一般展覽儲存接口接受無效場景，可能把可開啟的展覽覆蓋成無法載入的資料。
- [HIGH] 修改密碼後舊登入憑證仍有效；目前憑證有效期為七天。
- [HIGH] 一般展覽儲存沒有版本衝突保護；跨分頁同步也未先保護本地未儲存修改。
- [MEDIUM] 密碼找回、客服、資源下載仍未提供；列表傳輸與多語系也有明確缺口。
- Overall: **Needs fixes**。已有驗證、限流、錯誤處理、備份文件與大量測試等基礎，優先補齊資料可靠性和帳號流程，無須全面重寫。

## Critical Issues (Must Fix Before Production)

None identified. 本次抽查未確認 [CRITICAL] 等級問題；不代表沒有其他未檢查的問題。

## High-Risk Issues

### [HIGH] H1：場景儲存與發布缺少完整資料驗證

**Location:** [galleryRoutes.js](../server/routes/galleryRoutes.js#L27)、[exhibitionSceneService.js](../server/services/exhibitionSceneService.js#L48)、[ExhibitionView.tsx](../src/app/pages/ExhibitionView.tsx#L102)。

**Dimension:** Robustness / Data integrity。

**Problem:** `sceneJson` 只要求是字串；`assertPersistentScenePayload()` 檢查暫存 blob URL，JSON 解析失敗時卻直接返回。一般儲存和發布沿用此檢查。以記憶體替身呼叫實際路由處理器，`not-json` 和 `{"items":"invalid","roomSize":-1}` 均回傳 200 並傳給儲存函式。展示頁遇到前者則會顯示載入失敗。此重現未接觸真實 SQLite 資料。

**Fix:** 儲存、分享編輯和發布統一驗證 JSON 格式及場景結構；無效輸入回傳 400，保留上一份有效場景。沿用既有場景規則，但應拒絕錯誤資料，而不是悄悄刪除不合法作品。快速建展有自己的流程，本項重現針對一般展覽路徑。

### [HIGH] H2：修改密碼後不能撤銷舊登入

**Location:** [authRoutes.js](../server/routes/authRoutes.js#L265)、[jwt.js](../server/auth/jwt.js#L8)、[userRepository.js](../server/repositories/userRepository.js#L80)。

**Dimension:** Security / Account lifecycle。

**Problem:** 修改密碼只更新密碼雜湊；JWT 驗證不檢查登入版本或撤銷狀態。用臨時帳號與記憶體替身執行實際修改密碼處理器後，密碼確實改變，但原 JWT 仍能通過驗證。登出同樣只是清除瀏覽器 Cookie。若憑證外洩，改密碼不能立即終止對方登入。

**Fix:** 增加登入版本或伺服器 Session 撤銷機制；改密碼時撤銷既有登入，HTTP 和 Socket.IO 採用一致的驗證規則，並處理已建立的連線。

### [HIGH] H3：一般展覽的多人／跨分頁儲存可能覆蓋修改

**Location:** [db.js](../server/db.js#L651)、[VirtualGalleryCreate.tsx](../src/app/pages/VirtualGalleryCreate.tsx#L242)、[VirtualGalleryCreate.tsx](../src/app/pages/VirtualGalleryCreate.tsx#L508)。

**Dimension:** Robustness / Concurrency。

**Problem:** SQL 更新只比對展覽 ID 和擁有者，沒有比對讀取時的版本；較舊場景稍後送達仍可覆寫新場景。跨分頁事件呼叫 `refreshGalleryFromServer()` 後，只要時間不同就直接 `importScene()`，沒有先檢查本地是否有未保存修改。自動儲存互斥也只涵蓋自動儲存，手動儲存可同時進行。這是程式路徑確認的覆蓋風險，尚未做雙瀏覽器重現；不能因 Socket.IO 有場景版本就認定 HTTP 儲存已有保護。

**Fix:** 一般展覽加入版本欄位，更新時原子比對，衝突回傳 409；手動與自動儲存共用佇列。收到遠端更新時保留本地未保存內容並提供重新載入／合併選擇。快速建展已有 `expectedRevision`，可參考其做法。

## Maintainability Problems

### [MEDIUM] M1：帳號復原和支援流程未完成

**Location:** [Login.tsx](../src/app/pages/Login.tsx#L135)、[Support.tsx](../src/app/pages/Support.tsx#L267)、[Resources.tsx](../src/app/pages/Resources.tsx#L104)、[Exhibitions.tsx](../src/app/pages/Exhibitions.tsx#L39)。

**Dimension:** Dead/incomplete functionality / Product completeness。

**Problem:** 忘記密碼僅顯示「寄信服務尚未啟用」；客服送出、資源閱讀和下載停用；「即將開始」展覽資料固定為空陣列。這些是程式明示尚未提供的功能，不能列作已完成。忘記密碼的使用者沒有自助復原途徑。

**Fix:** 優先完成一次性、有期限的密碼重設流程和至少一個有效支援管道。其餘項目明確標示規劃中，或先移出主要導覽。是否需要排程展覽，應由產品需求決定。

### [MEDIUM] M2：列表傳輸與編輯器閒置成本未隨資料量控制

**Location:** [db.js](../server/db.js#L572)、[galleryRoutes.js](../server/routes/galleryRoutes.js#L131)、[VirtualGalleryCreate.tsx](../src/app/pages/VirtualGalleryCreate.tsx#L687)。

**Dimension:** Production risks / Performance。

**Problem:** 公開展覽查詢無分頁，且以 `galleries.*` 讀取並把完整 `sceneJson` 傳回列表。記憶體替身中的單筆 1,000,000 字元場景完整出現在列表回應，即使列表只需要標題等摘要。編輯器另每 120ms 匯出並序列化整個場景，閒置時也持續執行。尚未量測真機延遲，不能據此宣稱特定 FPS 或最大容量。

**Fix:** 列表使用摘要欄位和伺服器分頁，開啟展覽才取場景；編輯器改以內容變更標記觸發延遲儲存。分別量測列表回應大小與大場景操作成本。

### [MEDIUM] M3：英文等語言模式仍會出現固定中文

**Location:** [EditUI.tsx](../src/app/modules/metaverse3d/components/UI/EditUI.tsx#L976)、[ExhibitItem.tsx](../src/app/features/metaverse-studio/exhibits/ExhibitItem.tsx#L442)。

**Dimension:** Consistency / Localization。

**Problem:** 「AI 策展助手」、套用成功提示、協作者狀態、未命名作品和未知作者等文字直接寫在 JSX 中，未經翻譯函式。切換語言後這些文字仍是中文。根目錄既有 i18n 報告只掃描 28 個檔案，不能把其「未使用 key」數字視為全專案死碼證據。

**Fix:** 將可見文字與提示補入三份語系字典；擴充掃描至頁面、feature 和 3D 模組，並確認動態 key 的處理。

### [MEDIUM] M4：驗證還不足以保證完整使用者流程

**Location:** [package.json](../package.json#L8)、[devProxy.test.ts](../config/devProxy.test.ts#L17)、[multiInstance.integration.test.js](../server/multiplayer/multiInstance.integration.test.js#L205)。

**Dimension:** Test coverage / Production readiness。

**Problem:** 已有大量單元與整合測試，但本次未找到倉庫內可重複執行的瀏覽器端到端測試套件或 CI 工作流程；既有截圖不等同回歸測試。Redis 多實例測試在缺少 `REDIS_TEST_URL` 時跳過。此次完整驗證亦出現失敗，詳細結果見下方驗證紀錄。倉庫外是否另有 CI 尚未確認。

**Fix:** 先穩定目前失敗或逾時的測試，再把建立→上傳→儲存→重開→發布→匿名觀看，以及分享權限、雙端衝突納入少量端到端測試；部署多實例時必跑實際 Redis 整合測試。

### [MEDIUM] M5：已建立模組入口，但核心職責仍集中

**Location:** [VirtualGalleryCreate.tsx](../src/app/pages/VirtualGalleryCreate.tsx#L242)、[galleryRoutes.js](../server/routes/galleryRoutes.js#L159)、[useMetaverseStudioStore.ts](../src/app/modules/metaverse3d/store/useMetaverseStudioStore.ts#L158)。

**Dimension:** Architecture / Maintainability。

**Problem:** 展覽頁同時負責載入、儲存、縮圖、同步、發布及建立精靈；路由模組直接計算完整分析報表；大型 store 集中編輯操作與歷史。問題在於不同生命週期互相耦合，例如 H3 的手動、自動與遠端同步各自處理狀態，並非單純檔案長就必須重構。

**Fix:** 先抽出統一的場景儲存協調層，讓頁面只呈現狀態；再按需要把分析計算移到服務。沿用既有 facade 與 store/action 分工，避免一次搬遷全部模組。

## Production Readiness Score

**Score: 61 / 100**

依技能規則：100 − 3 個 HIGH × 8 − 5 個 MEDIUM × 3 = 61。這是本次原始碼抽查的啟發式分數，不是可用率或安全保證。現有工程基礎足以繼續改善，但 H1–H3 涉及保存內容與帳號控制，應先修正再擴大對外使用。

## Refactoring Priorities

1. **[P1] 統一場景驗證** — H1；工期 S；避免無效資料取代可用展覽。
2. **[P1] 登入撤銷** — H2；工期 M；讓改密碼能終止舊登入。
3. **[P1] 儲存版本與單一佇列** — H3、M5；工期 M；避免多人或多分頁覆蓋。
4. **[P2] 密碼找回與測試流程** — M1、M4；工期 M；補上帳號復原及關鍵回歸驗證。
5. **[P2] 列表摘要、分頁和多語系補齊** — M2、M3；工期 M；降低載入成本及混合語言介面。

工期為粗估：S 少於一天、M 一至三天、L 超過三天；不含寄信服務申請、產品驗收等外部等待。

**Quick Wins (fix in <1 hour):**

- H1：先拒絕無法解析的 JSON，再補齊完整場景驗證。
- M2：公開列表移除 `sceneJson`，並確認列表呼叫者只用摘要欄位。
- M3：先補上述已定位的固定中文文字。
- M1：讓主要導覽清楚區分可用功能與規劃項目。

## 驗證紀錄

檢查日期：2026-09-03。此次只新增本報告，未修正應用程式碼。編譯產物和測試暫存由既有檢查產生。

- 伺服器語法、Avatar 資源、TypeScript 型別及 ESLint 檢查通過。
- 實際路由處理器＋記憶體替身確認 H1、H2 及 M2 的列表場景傳輸行為，未讀寫真實使用者資料。
- `npm run check` 在測試階段退出：216 個測試檔中 213 通過、2 失敗、1 略過；1,748 個案例中 1,745 通過、2 失敗、1 略過。
- 兩項失敗均先報 5 秒逾時：開發代理的大型 JSON 傳輸，以及快速建展清空作品名稱後的檔名回退案例。後者清理暫存 SQLite 時另出現 Windows `EBUSY`。
- 以單一 worker 重跑這兩個檔案：36 個案例通過、1 個失敗；快速建展 35 項全部通過，代理測試仍於 5 秒逾時。重跑期間完整測試／建置仍在進行，不能排除機器負載影響，也不能把逾時直接等同產品功能失效。
- Redis 多實例整合測試因未設定 `REDIS_TEST_URL` 略過。
- 另行執行 `npm run build` 和 `npm run check:bundle` 均通過。最大 JS 檔 706.1 KiB／上限 800；JS 合計 3,039.6 KiB／4,800；CSS 合計 206.1 KiB／220；GLB 合計 10,356.5 KiB／11,000。這些是建置預算結果，不能代替實際手機效能測量。

## 修正紀錄

- **H1：** 建立、一般儲存、分享編輯、發布共用場景驗證；無效 JSON、作品結構、重複 ID 與非法房間尺寸都會拒絕，檢查過程不會刪除合法延伸欄位。
- **H2：** 新增持久化登入版本。改密碼會增加版本並回傳新憑證給目前瀏覽器；舊 Bearer/Cookie 無法再使用。多人房間會再次檢查版本，改密碼時亦透過協作 adapter 主動中斷該帳號既有連線。adapter 故障時，閒置連線由既有 30 秒權限巡檢處理。
- **H3：** 新增展覽版本和原子比對；所有內容寫入含快速建展交易均會增加版本。舊版本回傳 409，缺少版本回傳 428。手動、自動及精靈發布前儲存使用同一佇列；畫面收到衝突時保留本機修改、暫停自動儲存，提供下載副本與確認後重新載入。
- 資料庫變更透過啟動遷移加入欄位與 trigger，不重建既有資料。需重啟新版後端並使用新版前端；舊前端缺少儲存版本時會被拒絕，須重新載入頁面。
- 已新增資料庫並行寫入、密碼修改後舊 HTTP 憑證失效、多人連線撤銷、跨分頁保留修改、衝突後明確重新載入等回歸測試。

### 修正後驗證

- 伺服器語法、TypeScript、ESLint、正式建置及 bundle 預算檢查通過。
- 全套執行使用 `npm run test -- --maxWorkers=2 --testTimeout=15000`，減少本機並行負載及先前 5 秒逾時的干擾：217 個測試檔、1,763 項案例通過；Redis 整合 1 項略過。當次另有快速建展路由的 2 項舊案例未帶 `expectedRevision`，因此回傳 428；沒有調低正式接口的版本要求。
- 更新上述測試以沿用讀取的版本後，連同一般展覽路由、編輯頁保留修改、場景 schema 再次執行：**4 個測試檔、121 項全部通過**。此輪包含兩項先前失敗案例及後續新增的版本要求／409 回歸案例。
- 尚未設定真實 Redis 多實例測試環境，亦未進行正式環境部署或瀏覽器端到端驗收。
