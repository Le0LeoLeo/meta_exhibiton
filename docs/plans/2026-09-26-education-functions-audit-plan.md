# 平台功能與教育應用：本機盤點及實作計畫

**日期：**2026-09-26  
**目標：**以目前工作區為準，核實保留的八組功能與教育用途，先移除成長記憶／推薦及競賽投稿／投票，再修可重現的回歸缺口，驗收 3D 展覽、多人互動與展內 Agent 的完整流程。  
**架構：**沿用現有 React／Three.js 編輯與觀看介面、Express／SQLite 資料層及 Socket.IO 房間。班級展、能力卡與分析保留為應用情境；遵照 [三核心計畫](2026-09-26-three-core-functions.md)，本輪不把 CV 或班級管理擴成第四個主產品。  
**技術：**React 18、Vite、Vitest、Playwright、Express、SQLite、Socket.IO。  
**邊界：**本文件記錄盤點、實作與本機驗收；不部署香港、不提交或推送 Git、不改正式資料，也不宣稱任何學習成效已獲證明。

## 盤點方法與證據等級

工作區已有大量未提交變更；下列判斷針對本機現況，不能當成 `metaexb.com` 現有功能清單。原核對稿的「394 項通過、77 項失敗」屬於另一批次，不作本輪測試結果。**刪除兩項功能前，本輪完整 Vitest 首次執行：321 個檔案中 295 通過、25 失敗、1 跳過；2,514 項測試中 2,435 通過、78 失敗、1 跳過。**為擷取失敗清單，同一工作區再跑一次，得到 2,436 通過、77 失敗、1 跳過；清單存於忽略的 `.tmp/education-audit-vitest.json`。兩次皆失敗，且差一項，須按檔案重現。失敗清單中多數是繁中斷言遇到目前英文預設；本機預覽腳本另仍期待已撤下的 `/cv` 跳轉。不能據此斷定每個失敗都是文案問題。2026-09-26 的 [三核心本機驗證紀錄](../three-core-integration-validation.md) 覆蓋展品脈絡編輯、儲存、同場更新與指定作品開啟 Agent，但明言沒有真實模型回答或不同帳號的完整驗收。[競賽教育本機紀錄](../competition-2026/local-validation.md) 記載師生流程及仍不穩定的 3D 瀏覽器測試；歷史成功與失敗均須保留。

本盤點分三層：**可見程式路徑**表示功能存在；**自動測試**表示特定輸入和預期曾被檢查；**端到端／真人驗收**須另有瀏覽器、真實服務或課堂紀錄。不得把前兩者寫成第三者。

## 保留功能盤點

| 項目 | 本機可核對的實作與測試入口 | 尚需驗收或修正 | 優先級 |
|---|---|---|---|
| 1. 班級展、提交及審閱 | `src/app/features/graduation/`、`server/services/graduationService.js`、`server/routes/graduationRoutes.test.js`；提交、退回、版本、核准及發布路徑存在。 | 用學生、教師、訪客三種帳號重走退回→再提交→公開；核對私人評語、舊版本及公開 JSON 的權限。勿把歷史被覆寫內容寫成可還原。 | P1 |
| 2. 3D 編輯及快速建展 | `src/app/modules/metaverse3d/`、`src/app/features/quick-exhibition/`、`server/services/quickExhibitionService.test.js`。近期展品 `workContext` 已接入場景儲存與多人更新。 | 將快速建展與自由編輯分開驗收；修復既有 3D 瀏覽器流程的登入／素材載入／場景就緒／儲存穩定性，實測圖片順序、草稿、預覽及發布。 | **P0** |
| 3. AI 策展及 AI 建展 | `server/services/aiCuratorService.test.js`、`server/services/exhibitionBuilderAgentService.test.js`、`src/app/modules/metaverse3d/components/UI/EditorAiBuilderPanel.tsx`。 | 已確認 AI 策展目前只依主題等輸入生成文字方案，不讀取場景展品或 `workContext`；「保留現有展品」只加入示例文字與燈光，不重排作品。現已修正介面說明並預設保留原展品。若下一步要按真實作品策展，須先設計公開展品資料與 ID 對應、排除私人資訊。AI 建展仍需分別記錄模型生成、畫面檢視失敗、修訂與明確套用，真實服務品質尚未驗收。 | **P0** |
| 4. AI 導覽、問答與語音 | `src/app/modules/metaverse3d/agent/requestContext.ts`、`server/services/agentService.js`、`AgentChatPanel.tsx`；近期公開展品脈絡已可進請求。 | 以真實模型檢查指定展品、缺來源、只附網址、切換展品與私人資料隔離；另做實際語音播放和停止測試。路線仍是建議，不是自動移動。 | **P0** |
| 5. 多人共看與協作 | `server/multiplayer/socketServer.test.js`、`src/app/modules/metaverse3d/network/multiplayerStore.test.ts`。 | 以不同帳號的兩個瀏覽器核對同房位置、聊天、唯讀角色、場景同步和斷線恢復；確認私人 Agent 對話不廣播。現行單實例架構下，不把 Redis 跳過項稱為多實例驗收。 | **P0** |
| 6. 能力卡與作品履歷 | `SkillPortfolio.test.tsx`、`skillEvidencePolicy.test.js`、`cvService.test.js`；班級展可選來源並記錄 AI 建議決策，獨立 CV 仍有相容路由。 | 班級展已以跨角色瀏覽器流程驗證來源、理由與公開邊界；獨立 CV 已驗證建卡、編輯、發布、草稿隔離、重新發布及撤下。退回→再提交仍待完整瀏覽器覆蓋。獨立 CV 不擴成主線，也不自動將私人資料搬入展場。 | P1 |
| 7. 觀展分析與留言摘要 | `server/services/galleryAnalyticsService.js`、`ExhibitionAdmin.test.tsx`、`server/routes/aiWritingRoutes.test.js`。摘要入口在 `ViewUI.tsx` 的單件作品留言區。 | 已以瀏覽器及隔離資料庫核對單件作品的訪次／停留、展覽與日期篩選、留言刪除；零資料畫面及摘要對照仍由定向測試覆蓋，尚未做完整瀏覽器驗收。不可稱為全展自動報告或學習效果證據。 | P2 |
| 8. 2D 與文字工具 | `Exhibition2DView.test.tsx`、`ExhibitionView.test.tsx`、`PaintingInspector.tsx`、`TextInspector.tsx`。 | 觀看頁測試已明確設定語系並補英文預設案例；2D 固定文案與文字檢查器提示已改為三語。仍須以瀏覽器檢查各語系的文字採用、複製及影片入口；繪畫檢查器目前提供英文和葡文翻譯，不能概稱所有文字內容均有三語版本。 | P1 |

### 本輪已確認的具體偏差

1. `ExhibitionView.test.tsx` 的 helper 原先沒有包 `I18nProvider`，令繁中斷言落到英文預設；已修正，定向測試 **19／19 通過**，並驗證未設定語系時的英文預設。
2. `TextInspector.tsx` 原先將登入、潤飾、翻譯提示寫死繁中，結果只在通知顯示；現已提供三語提示、持續預覽、明確採用及複製。相關定向測試 **6／6 通過**，仍需實際瀏覽器互動驗收。
3. 三核心新增的展品貢獻與來源已在本機保存及顯示，但其來源屬創作者提供的公開內容；URL 未被讀取，模型的提示也不能代替事實查核。

## 分批實作與驗收

### 第 0 批：移除兩項功能並固定基線（已完成）

**檔案：**成長專屬頁面／API／route／repository、競賽投稿投票專屬頁面／API／route／repository、共享註冊與導覽、`src/app/pages/ExhibitionView.test.tsx`、`src/app/components/I18nProvider.tsx`、`e2e/editor-ai-builder.spec.ts`、`e2e/collaboration-recovery.spec.ts`、本文件。  
**步驟：**移除兩項產品功能的介面、API、路由、服務與入口，清理專屬測試及仍引用它們的共用程式；保存既有資料庫與上傳資料，不執行 `DROP TABLE`。保留獨立的展內 visitor memory／souvenir，及用於教育 AI 參賽準備的 `CompetitionDemo`、文件和班級展瀏覽器測試。其後按「產品失敗／測試語系或夾具／服務環境／逾時」分類完整測試失敗，不直接調大時限。先替觀看頁測試設明確語系，再重跑 2D／3D 切換、錯誤恢復及英文預設案例。  
**通過條件：**兩項產品功能沒有可達入口或 API；保留功能可建置。每個失敗有重現命令、歸因和修復對應；無法重現者記錄為未定，而非通過。完整測試須在刪除後重跑才能更新總數。

### 第 1 批：3D 展覽與快速建展的可保存流程（部分完成）

**檔案：**`src/app/pages/ExhibitionView.tsx`、`src/app/features/quick-exhibition/`、`src/app/modules/metaverse3d/components/UI/PaintingInspector.tsx`、`server/services/quickExhibitionService.js`、`server/schemas/sceneSchema.js`、`e2e/editor-ai-builder.spec.ts`、`e2e/public-webgl.spec.ts`。  
**步驟：**先寫會失敗的瀏覽器案例，覆蓋圖片依選取順序上傳、生成草稿、重新載入、手動編輯展品脈絡、預覽、明確發布；再修真正的載入／同步問題。以舊場景檢查 schema 相容，不替使用者生成未授權內容。  
**通過條件：**同一合成展覽在儲存前後及 2D／3D 均讀到相同展品；WebGL 不可用時可用 2D；所有圖片實際顯示，截圖人工檢視。快速建展仍不宣稱按圖像內容理解或自動分組。

### 第 2 批：多人互動與作品脈絡（單實例驗收通過）

**檔案：**`server/multiplayer/socketServer.js`、`server/multiplayer/rooms.js`、`src/app/modules/metaverse3d/network/multiplayerStore.ts`、`e2e/collaboration-recovery.spec.ts`。  
**步驟：**先建立兩個不同帳號的角色案例，檢查位置、聊天、同件作品更新、檢視者拒絕編輯、斷線後重連及衝突保護；只對失敗情境做最小修正。  
**通過條件：**場景修改只由有權角色保存，第二位使用者在開啟的作品詳情看到更新；重連不丟未送出的作者改動；私人 Agent 訊息未送到房間事件。多實例驗收需另備 Redis／共享狀態環境。

### 第 3 批：Agent 生成、來源界線及語音（來源界線完成）

**檔案：**`src/app/modules/metaverse3d/agent/requestContext.ts`、`AgentChatPanel.tsx`、`src/app/modules/metaverse3d/components/UI/AiCuratorPanel.tsx`、`src/app/modules/metaverse3d/components/UI/useEditorAiBuilder.ts`、`server/services/agentService.js`、`server/services/aiCuratorService.js`、`server/services/exhibitionBuilderAgentService.js`、相關定向測試與 `e2e/editor-ai-builder.spec.ts`。  
**步驟：**用公開／私人、摘錄／僅 URL、目前作品／切換作品的合成案例先寫請求邊界測試；檢查模型失敗和備援文案。若 AI 策展要依當前作品安排分區，先定義可傳入的公開展品資料，測試作品與分區的對應及私人資料排除。其後以真實服務少量執行生成→檢視→修訂→套用→儲存，人工審閱截圖及回答；以裝置實測語音開始、停止和失敗。  
**通過條件：**未授權資料不在請求中；模型不可聲稱已讀取 URL；失敗版本不可套用；使用者明確套用後場景才改動。真實回答品質以人工評閱結果另行報告，不能只計 API 200 或模型分數。

### 第 4 批：教育情境與輔助頁（班級展瀏覽器流程、定向測試與文字工具完成）

**檔案：**`src/app/features/graduation/`、`server/services/graduationService.js`、`server/services/graduationSkillService.js`、`src/app/features/cv/`、`src/app/pages/ExhibitionAdmin.tsx`、`src/app/modules/metaverse3d/components/UI/TextInspector.tsx`。  
**步驟：**班級展與能力卡重走三角色權限和公開邊界；獨立 CV 做前端流程檢查但不擴主入口。分析頁核對統計定義；文字工具完成三語文案並明示翻譯結果如何採用。每一項先補能反映使用者行為的失敗案例，再作局部修正。  
**通過條件：**各模組的畫面、API 和公開資料一致；原稿所有功能描述能以具體檔案及本輪測試對應。課堂學習成效須另行設計研究和取得合適同意，平台測試不代替該研究。

## 執行順序與品質門檻

第 0 批已完成；第 1–4 批已執行下方所列的定向實作與隔離驗收。後續按 P0 優先處理真實 AI 內容評閱、語音裝置及尚未覆蓋的跨帳號流程，再處理 P1／P2 的完整課堂情境。每批先跑相應 `npm run test -- <path>`、`npm run typecheck`、`npm run lint`；跨前後端改動再跑 `npm run check:server`。候選完成時從 `web_ui_new/` 執行 `npm run check`，並用 Playwright 驗收實際 3D／多人／Agent 流程及檢視截圖。因本輪要求不部署，香港隔離環境與公開站驗證均不在本計畫的完成宣稱內。

**教學證據另設一道門檻：**教師先確認任務、評分準則、素材授權和資料處理，再以真實參與者記錄作品、對話、修訂理由及訪談／問卷。成果報告將功能可用性、AI 回答品質與學習成效分開陳述；目前三者均未由本文件證明。

## 本輪執行紀錄

- 已移除成長記憶／推薦、競賽投稿／投票的可達頁面、API、路由、專屬服務、資料庫新建邏輯、共用入口和專屬測試。新資料庫的測試確認不會建立兩組舊資料表。既有資料庫沒有執行刪表；舊資料仍可經使用者資料匯出取得，成長相片的帳號刪除清理亦保留。
- 保留不同用途的展內訪客記憶／紀念卡，以及教育 AI 參賽準備示範頁。這兩者不提供已刪除的成長展或競賽投稿投票流程。
- 刪除後 `typecheck`、`check:server`、`lint`、`build`、`check:bundle` 均通過；資料庫、路由及語系相關 4 個定向測試檔共 18 項通過。完整測試結果列於下方，不能以這些定向結果替代。
- 刪除後完整 Vitest 重跑：311 個檔案中 286 通過、25 失敗；2,435 項測試中 2,356 通過、78 失敗、1 跳過。與刪除前相比，原有 24 個失敗檔案仍在；多出 `server/multiplayer/socketServer.test.js` 的事件順序斷言，該檔單獨重跑 78／78 通過，暫列為全套並行時的未定波動，不宣稱已修復。報告存於忽略的 `.tmp/education-removal-final-vitest.json`。

### 後續本機實作與驗收

- 修正觀看頁的語系測試夾具，另加英文預設案例。2D 公開頁的固定標籤、作者、影片操作、空清單與缺省作品名稱改隨介面語系顯示；作品原有標題及說明仍保留作者輸入。文字檢查器加入三語提示，潤飾與翻譯結果可先預覽，再由使用者採用或複製。
- 多人房間的測試原先可能在更新斷言時收到前一個 `add-item` 廣播；現在先等該廣播到達再監聽更新。目標測試連續 10 次通過；未改多人同步產品程式。
- 快速建展 5 個定向測試檔共 75 項通過。本機隔離瀏覽器實際上傳兩張圖片、選白盒樣式、生成並重載私人草稿、檢視 3D 圖片、發布後在公開 2D 頁確認圖片順序及第一件作品說明。既有 WebGL 瀏覽器測試 4／4 通過，覆蓋桌面／觸控模式切換及能力卡公開範圍。上述瀏覽器流程使用合成帳號與隔離資料庫，不能代表正式站或實際課堂驗收。
- 觀看頁、2D、文字工具及多人房間相關 5 個定向測試檔共 111 項通過；`typecheck` 和 `lint` 通過。這是修正當時的定向結果；完整套件最終結果見下方。
- AI 策展原先預設以示例文字物件取代現有展品，且「保留」文案錯稱會重排原作品。現預設保留原展品，明示方案不讀現有作品與可能重疊，重建模式也清楚警示會移除當前場景物件；新增明確選「重建」並二次確認的安全案例。相關 4 個定向測試檔共 26 項通過。AI 建展既有瀏覽器案例 1／1 通過，覆蓋素材上傳、生成預覽、明確套用、儲存與公開；測試使用合成服務，未驗模型內容品質。
- 班級展與能力卡的兩個測試檔原先亦缺少語系 Provider；已固定繁中夾具並加英文預設案例，17／17 通過。這是測試回歸修正，沒有改動提交或審閱產品流程。
- 多人協作既有 WebGL 瀏覽器案例 1／1 通過，使用兩個合成帳號驗證同場更新、重連後合併、重載草稿和保存。此結果只覆蓋單實例隔離環境；Redis 多實例仍未驗收。
- Agent 前端請求案例已覆蓋指定作品切換、只有 URL 的來源及無效／非場景物件；服務端加上 `workContext` 白名單，禁止額外私人欄位進模型請求。假模型測試確認 URL 未被擴成全文，提示禁止聲稱已讀 URL，且網頁搜尋關閉。前後端相關 2 個測試檔 19／19 通過；未評估真實模型回答品質或語音。
- 班級展路由、獨立履歷服務、展覽分析及單件作品留言摘要相關 5 個測試檔共 36 項通過。這些是資料與介面定向測試；班級展跨角色瀏覽器驗收見下方。獨立履歷完整前端流程與真實課堂學習成效仍未完成。
- 上述修正後首次完整 Vitest 重跑：312 個檔案中 290 通過、22 失敗；2,449 項測試中 2,390 通過、58 失敗、1 跳過，報告為 `.tmp/education-implementation-vitest.json`。後續逐項修正原有測試的缺失 Provider、過時文案、過時 `/cv` 跳轉與重複按鈕查找；角色外觀、示範展、公開展覽、展覽資料夾、3D 操作、法律頁及通用入口的定向測試已通過。這些主要是測試夾具與預期修正，未將其記為產品功能增補。

## 最終本機檢查（2026-09-26）

- 完整 Vitest：**312／312 個檔案通過；2,449 項通過、0 項失敗、1 項跳過**。跳過項是未設定 `REDIS_TEST_URL` 的多實例整合測試，不能據此聲稱 Redis 同步已驗收。報告為忽略的 `.tmp/education-implementation-final-vitest.json`。
- `npm run typecheck`、`npm run lint`、`npm run check:server`、`npm run check:avatar`、`npm run build`、`npm run check:bundle` 通過。`git diff --check` 仍顯示工作區原有三處空白格式問題：`src/app/constants/gallerySceneTemplates.ts`、`src/app/pages/VirtualGallery.tsx`、`src/main.tsx`；本輪未改動這些位置。
- 隔離 WebGL 瀏覽器測試：公開展場 4／4、AI 建展指定案例 1／1、雙帳號協作恢復 1／1 通過。快速建展另以本機隔離瀏覽器實際操作並人工檢視截圖，沒有把它當成自動回歸測試。正式 AI 生成品質、真實語音裝置與課堂學習成效尚未驗收。
- 班級展瀏覽器測試 `npm run test:competition` 2／2 通過：學生選來源、檢視 AI 請求、記錄採用理由與提交；教師審閱能力卡及作品後發布；公開頁核對私人佐證與決策理由不外洩。另一案例檢查教育 AI 示範頁的英文手機版及登入門檻。此測試使用合成模型及本機隔離資料庫，沒有驗證正式模型品質。
- 展覽分析新增隔離瀏覽器案例 `e2e/analytics.spec.ts`，1／1 通過：匿名訪客留下展品觀看紀錄及留言，管理者以展覽與日期篩選核對訪次、停留與作品數值，再刪除留言並確認資料層更新。它驗證的是實際互動資料，不代表觀眾理解或學習成效。
- 獨立能力履歷新增隔離瀏覽器案例 `e2e/cv-workspace.spec.ts`，1／1 通過：儲存個人介紹、建立及編輯能力卡、公開與私人卡／佐證隔離、發布後草稿不立即公開、重新發布及撤下後公開頁失效。
- 快速建展的既有桌面與手機慢網路瀏覽器案例 2／2 通過，覆蓋上傳、草稿重載、發布、匿名 2D 閱讀、版本衝突及撤下；同步修正該案例沿用的繁中按鈕名稱，使之符合案例指定的英文介面。
