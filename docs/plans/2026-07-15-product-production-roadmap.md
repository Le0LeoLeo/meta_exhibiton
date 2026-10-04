# Education 3D Exhibition Product Production Roadmap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 將現有多用途 3D 展覽原型收斂成「教師和學生可在 30 分鐘內，以 AI 建立並發布可多人參觀的 3D 成果展」，並補齊上線安全、可靠性與擴展能力。

**Architecture:** 先建立單一建展主流程、版本化場景服務及學校/未成年人權限邊界，再把 AI、多人體驗、分析和機構能力掛在這些穩定核心上。前端以 `features/metaverse-studio` 作唯一公共 API；後端逐步把 `db.js` 拆成 repository/service，SQLite 保留作單機開發，生產資料界面同時支援 PostgreSQL、Redis、物件儲存與背景工作隊列。

**Tech Stack:** React 18、React Router、Tailwind v4、React Three Fiber/Three.js、Zustand、Express 5 ESM、Zod、SQLite（過渡）、PostgreSQL、Redis、Socket.IO、Vitest、Playwright。

---

## 審查基線

- 已有：模板建立、圖片/PDF/影片/DOCX 單檔上傳、批量套用文字欄位、分享連結到期/撤銷、AI 策展預覽、AI 建展視覺評分與最多三次全場修訂、幾何碰撞/貼牆修正、本機 undo/redo、多人角色/限流/操作 ACK、訪客作品停留與互動統計、WebGL 復原與自動效能降級。
- 半完成：`features/metaverse-studio` 是 facade，但仍直接反向依賴 `modules/metaverse3d`；AI `sessionId/versionId` 只存在單次 HTTP 工作流；分析只有登入訪客的彙總；帳戶刪除存在但沒有標準匯出/保存期限；Google 登入仍是「即將開放」。
- 缺失：完整建展精靈、真正多檔/CSV 匯入、持久場景版本、Redis 房間狀態、操作補發與衝突控制、展品鎖、監護人同意、學校 RBAC、EXIF 清除、AI 成本/回歸、2D 無障礙展覽、機構/收費/品牌/發布排程。

## 交付順序與發布閘門

1. **Release 0（P0，上線閘門）**：定位與建展精靈、媒體安全、持久場景版本、多人體系、兒童資料治理、效能/2D fallback、AI 可控性。
2. **Release 1（P1，產品競爭力）**：有來源的個人化 AI 導覽、事件型分析、機構工作區、WCAG 2.2 AA、模板生態。
3. **Release 2（P2，商業化/擴展）**：方案額度、品牌/網域/嵌入、PostgreSQL/物件儲存/隊列、模組單一 API。

只有當當期所有驗收測試通過、`npm run check` 通過、資料遷移有回滾演練，才進入下一 Release。

---

## Release 0：上線前必須完成

### Task 1：收窄首頁與資訊架構

**Files:**
- Modify: `src/app/components/Hero.tsx`
- Modify: `src/app/components/Navigation.tsx`
- Modify: `src/app/pages/Home.tsx`
- Modify: `src/app/pages/VirtualGallery.tsx`
- Modify: `src/app/routes.ts`
- Test: `src/app/routes.test.ts`
- Create: `src/app/components/Hero.test.tsx`

**Steps:**
1. 寫失敗測試：首頁唯一主 CTA 導向 `/virtual-gallery/create`; 成長記憶及競賽不在首層主 CTA/主導航競爭。
2. 跑 `npm run test -- src/app/routes.test.ts src/app/components/Hero.test.tsx`，確認失敗。
3. 將首頁承諾改為「30 分鐘完成 AI 3D 成果展」，三項證據只保留上傳作品、AI 排展、發布多人參觀。
4. 將成長記憶與競賽移至「方案/使用情境」入口，保留既有 URL 以免破壞分享連結。
5. 新增漏斗事件 `landing_cta -> wizard_started -> previewed -> published`，事件先寫入 Task 14 的 analytics API；在該 API 完成前使用 no-op adapter。
6. 重跑測試並提交一個只含資訊架構的 commit。

**Acceptance:** 新使用者由首頁到開始上傳不超過兩次點擊；可用性測試中 5/5 教師能回答產品主要用途。

### Task 2：建立真正的六步建展精靈

**Files:**
- Create: `src/app/features/exhibition-wizard/ExhibitionWizard.tsx`
- Create: `src/app/features/exhibition-wizard/wizardStore.ts`
- Create: `src/app/features/exhibition-wizard/steps/ThemeStep.tsx`
- Create: `src/app/features/exhibition-wizard/steps/UploadStep.tsx`
- Create: `src/app/features/exhibition-wizard/steps/StyleStep.tsx`
- Create: `src/app/features/exhibition-wizard/steps/LayoutStep.tsx`
- Create: `src/app/features/exhibition-wizard/steps/PreviewStep.tsx`
- Create: `src/app/features/exhibition-wizard/steps/PublishStep.tsx`
- Modify: `src/app/pages/VirtualGalleryCreate.tsx`
- Test: `src/app/features/exhibition-wizard/ExhibitionWizard.test.tsx`
- E2E: `e2e/exhibition-wizard.spec.ts`

**Steps:**
1. 先寫流程測試，固定狀態機：`theme -> upload -> style -> layout -> preview -> publish`；每步可返回且草稿不丟失。
2. 以獨立 wizard store 保存 `galleryId`, `draftRevision`, assets, style, AI job，重新整理後從 server draft 恢復。
3. 桌面與手機共用同一狀態機；手機隱藏座標/旋轉等專業控制，只顯示順序、大小、自動排展與預覽。
4. 未完成必要欄位時禁止下一步，錯誤聚焦到第一個欄位並提供 `aria-live` 說明。
5. 每步保存草稿而非最後一次性保存；保存使用 Task 5 的 `If-Match` 場景版本。
6. 完成 Playwright 測試：建立班級展、上傳 12 件作品、AI 排展、手機 viewport 預覽、發布。

### Task 3：多檔、CSV/Excel 與媒體處理管線

**Files:**
- Create: `src/app/features/exhibition-wizard/import/parseRoster.ts`
- Create: `src/app/features/exhibition-wizard/import/columnMapping.ts`
- Create: `src/app/features/exhibition-wizard/import/importTypes.ts`
- Create: `server/routes/mediaRoutes.js`
- Create: `server/services/mediaIngestService.js`
- Create: `server/services/mediaMetadataService.js`
- Create: `server/repositories/mediaRepository.js`
- Modify: `server/index.js`
- Modify: `server/config/middleware.js`
- Modify: `src/app/pages/ExhibitionUploadPlatform.tsx`
- Test: `src/app/features/exhibition-wizard/import/parseRoster.test.ts`
- Test: `server/services/mediaIngestService.test.js`

**Steps:**
1. 寫失敗測試覆蓋 CSV UTF-8/BOM、中英文欄名、重複學號、缺檔、錯 MIME、超大檔及部分失敗。
2. 支援 `<input multiple>`、拖放資料夾與 CSV/Excel 欄位映射；預設欄為學生代碼、作品名稱、作者顯示名、描述、檔名。
3. 瀏覽器只上傳檔案；服務端 sniff MIME、病毒掃描 hook、重編碼圖片、移除 EXIF/GPS、產縮圖及影片 poster。
4. 禁止把 `blob:`、任意 data URL 或使用者本機路徑寫入 scene；只保存受控 asset ID/URL。
5. 加入批次 job 狀態 `queued/processing/succeeded/failed/partial`，可單件重試且不重傳成功檔案。
6. 在 UI 顯示素材預算（件數、總 MB、影片分鐘、估計初次載入量）。

**Acceptance:** 100 件混合素材可部分成功；EXIF GPS 驗證為空；失敗檔可個別修正重試。

### Task 4：AI 排展可控模型與局部修改

**Files:**
- Modify: `server/routes/exhibitionSceneRoutes.js`
- Modify: `server/services/exhibitionBuilderAgentService.js`
- Modify: `server/services/exhibitionSceneService.js`
- Modify: `server/services/sceneGeometryService.js`
- Create: `server/services/sceneConstraintService.js`
- Create: `server/services/aiUsageService.js`
- Create: `server/repositories/aiJobRepository.js`
- Modify: `src/app/modules/metaverse3d/aiBuilder/runExhibitionBuilderAgent.ts`
- Create: `src/app/features/metaverse-studio/ai/AiBuildProgress.tsx`
- Test: `server/services/sceneConstraintService.test.js`
- Test: `server/services/exhibitionBuilderAgentService.test.js`
- Test: `src/app/modules/metaverse3d/aiBuilder/runExhibitionBuilderAgent.test.ts`

**Steps:**
1. 把目前同步 `start/review/revise` 變成持久 job；事件階段固定為 `analyzing_assets`, `planning_route`, `placing`, `lighting`, `validating`, `rendering_review`, `complete`。
2. request 增加 `scope`（全場、房間、展品 ID）、`lockedItemIds`, `lockedRegionIds`, `constraintsVersion`, `baseSceneVersion`。
3. 在任何模型結果套用前做確定性檢查：AABB/OBB 重疊、牆面穿透、門口/最小走道、鏡頭視線遮擋、浮空、光照上下限、素材 URL。
4. 發現違規先只修正相關展品；若三次仍失敗則保留原版本、回傳問題清單和手動建議，不覆蓋現場。
5. 每次 AI 修改建立正式場景版本；UI 提供「接受、局部重做、全部撤回」而非直接寫入 store。
6. 記錄 provider、model、input/output tokens、圖片數/像素、TTS 字元/秒數、延遲、結果、估算成本與 owner/workspace。
7. 對 20 個固定 fixtures 建立 AI regression：使用確定性 mock 結果驗證 schema/constraints，另設 nightly 真模型評分趨勢，分數下降超閾值阻擋發布。

### Task 5：場景版本、操作日誌與還原

**Files:**
- Create: `server/repositories/sceneRepository.js`
- Create: `server/services/sceneVersionService.js`
- Create: `server/migrations/001_scene_versions.sql`
- Modify: `server/routes/galleryRoutes.js`
- Modify: `server/routes/exhibitionSceneRoutes.js`
- Modify: `src/app/api/exhibitionScene.ts`
- Modify: `src/app/modules/metaverse3d/store/metaverseStoreTypes.ts`
- Test: `server/services/sceneVersionService.test.js`
- E2E: `e2e/scene-version-restore.spec.ts`

**Steps:**
1. 建表 `scene_versions(gallery_id, version, parent_version, schema_version, snapshot_json, created_by, reason, created_at)` 與 `scene_operations(gallery_id, seq, base_version, actor_id, client_op_id, op_json, created_at)`；`(gallery_id, client_op_id)` 唯一。
2. 所有 REST/AI/Socket 修改都經 `sceneVersionService.applyOperation()`，不再直接寫 `galleries.scene_json` 或房間 Map。
3. API 要求 `If-Match: <version>`；版本不符回 409，包含 serverVersion 及可重放操作，不接受 last-write-wins。
4. 每 N 次操作或每 M 秒產 snapshot；保留 append-only 操作供重連/稽核，定期壓縮而不破壞已發布版本。
5. 實作版本列表、差異摘要、預覽、還原；還原建立新版本而不刪歷史。
6. 場景 JSON 加 `schemaVersion`，建立 `migrateScene(snapshot, from, to)` 純函數及 fixture 測試。

### Task 6：Redis 多人架構、重連與衝突

**Files:**
- Create: `server/multiplayer/roomStateStore.js`
- Create: `server/multiplayer/redisRoomStateStore.js`
- Create: `server/multiplayer/itemLockService.js`
- Modify: `server/multiplayer/rooms.js`
- Modify: `server/multiplayer/socketServer.js`
- Modify: `server/multiplayer/protocol.js`
- Modify: `src/app/modules/metaverse3d/network/protocol.ts`
- Modify: `src/app/modules/metaverse3d/network/socketClient.ts`
- Modify: `src/app/modules/metaverse3d/network/multiplayerStore.ts`
- Test: `server/multiplayer/redisRoomStateStore.test.js`
- Test: `server/multiplayer/socketServer.test.js`

**Steps:**
1. 先以 interface 封裝目前 Map，保留 memory adapter 給單元測試；production 缺 Redis 設定時 readiness 失敗。
2. 使用 Socket.IO Redis adapter 做跨節點廣播；玩家 presence 設 TTL，場景真相來自 Task 5 repository 而非 Redis snapshot。
3. `room:join` 帶 `lastAckedSeq`；server 回 snapshotVersion 及其後 op，缺口太大才回完整 snapshot。
4. client 維持 outbox，斷線後以相同 `clientOpId` 重送；server 利用唯一鍵冪等 ACK。
5. 增加 `baseVersion`/`serverSeq`；互不相關展品可合併，同展品 stale update 回 `SCENE_CONFLICT`。
6. 實作展品 lease lock（取得、續期、釋放、斷線 TTL）；`scene:focus` 只做 UI presence，不當成鎖。
7. 測試兩節點、重啟、亂序、重複包、斷線重連、同件展品競爭與管理員還原。

### Task 7：教育 RBAC 與監護人同意

**Files:**
- Create: `server/migrations/002_organizations_and_consent.sql`
- Create: `server/repositories/organizationRepository.js`
- Create: `server/repositories/consentRepository.js`
- Create: `server/services/authorizationService.js`
- Create: `server/routes/organizationRoutes.js`
- Create: `server/routes/consentRoutes.js`
- Modify: `server/routes/growthRoutes.js`
- Modify: `server/routes/galleryRoutes.js`
- Modify: `server/auth/jwt.js`
- Test: `server/services/authorizationService.test.js`
- Test: `server/routes/consentRoutes.test.js`

**Steps:**
1. 建立 organization/campus/class/workspace/membership；角色最少為 org_admin、school_admin、teacher、student、guardian、viewer。
2. 權限按 resource + action 判定，不把角色判斷散落 route；JWT 只存 subject/session，關鍵授權查 DB/快取。
3. 成長記憶建立前要求 child profile 與可驗證 guardian consent；保存政策版本、同意範圍、時間、撤回時間與證據 hash。
4. 撤回後立即停止新處理/分享，排入刪除或去識別化 job；所有受影響分享 token 失效。
5. 分享連結加入密碼 hash、maxViews、viewCount、allowedDomains；密碼與限次在 server 原子判斷。
6. 將學生姓名改為顯示名/代碼優先；未獲同意不可公開真名、生日、原相片。

### Task 8：資料匯出、完整刪除、保存期限與稽核

**Files:**
- Create: `server/services/dataSubjectService.js`
- Create: `server/services/retentionService.js`
- Create: `server/repositories/auditRepository.js`
- Create: `server/routes/privacyRoutes.js`
- Create: `server/workers/retentionWorker.js`
- Modify: `server/routes/authRoutes.js`
- Modify: `server/services/growthAssetService.js`
- Test: `server/services/dataSubjectService.test.js`
- Test: `server/services/retentionService.test.js`

**Steps:**
1. 定義資料清單及 owner：帳戶、學校 membership、場景/版本、媒體、留言、AI 使用、訪客記憶、同意、稽核。
2. 匯出建立 zip manifest + JSON/CSV + 原始媒體，使用一次性短效下載 URL。
3. 刪除採可恢復短暫 grace period，之後 DB transaction + object storage tombstone + worker 清理；產生不可含個資的完成憑證。
4. 依 workspace 政策保存資料；過期分享、媒體、AI 截圖、訪客事件及備份分別定義 TTL。
5. 管理操作、分享、下載、匯出、刪除、還原與權限變更寫 append-only audit log。
6. 補 `Privacy Policy`、`Child Data Notice` 與產品內 consent copy，政策版本必須和 consent 記錄一致。

### Task 9：低階裝置、素材預算與 2D fallback

**Files:**
- Modify: `src/app/modules/metaverse3d/performanceProfile.ts`
- Modify: `src/app/modules/metaverse3d/performance/adaptivePerformance.ts`
- Modify: `src/app/modules/metaverse3d/components/CanvasScene.tsx`
- Create: `src/app/features/exhibition-viewer/Exhibition2DView.tsx`
- Create: `src/app/features/exhibition-viewer/DeviceCapabilityGate.tsx`
- Create: `src/app/modules/metaverse3d/performance/sceneBudget.ts`
- Modify: `src/app/pages/ExhibitionView.tsx`
- Test: `src/app/modules/metaverse3d/performance/sceneBudget.test.ts`
- E2E: `e2e/viewer-fallback.spec.ts`

**Steps:**
1. 定義場景預算：下載 MB、貼圖尺寸/總像素、三角形、draw calls、影片數、同時在線人數；編輯及發布前都顯示警告。
2. 媒體服務產多尺寸圖片、Draco/Meshopt 模型與 LOD manifest；viewer 依裝置/距離延遲載入。
3. 保留目前 FPS 自動降級，再增加記憶體壓力、context-loss 次數與網速信號；降級有冷卻時間且不中斷操作。
4. WebGL 不支援、連續兩次 context loss、使用者主動選擇時進入完整 2D 展覽，而非只有錯誤 overlay。
5. 2D 模式提供同一展品內容、留言、字幕、語音稿與 AI 問答；分享 URL 可帶 `?view=2d`。
6. 建立真機矩陣：iPhone Safari、低階 Android Chrome、iPad、Windows Intel iGPU、慢速 4G；記錄首次可互動、FPS、記憶體及 crash。

---

## Release 1：形成產品競爭力

### Task 10：有來源、受教師控制的個人化 AI 導覽

**Files:**
- Modify: `server/services/agentService.js`
- Modify: `server/routes/agentRoutes.js`
- Create: `server/services/agentGroundingService.js`
- Create: `server/repositories/tourMemoryRepository.js`
- Create: `server/routes/transcriptionRoutes.js`
- Modify: `src/app/modules/metaverse3d/components/UI/AgentChatPanel.tsx`
- Modify: `src/app/modules/metaverse3d/agent/requestContext.ts`
- Test: `server/services/agentGroundingService.test.js`

**Steps:**
1. 為展品建立來源 chunk（作者、教師說明、附件頁碼/時間碼）；回答回傳 citations，無來源時明確說不知道。
2. 教師設定必講內容、禁答主題、年齡層、專業程度、參觀目的；server prompt policy 不信任 client 自報設定。
3. 將現有 session memory 持久化成經同意的跨次記憶，提供查看、清除、退出個人化。
4. 導覽路線從停留/已看/無障礙偏好與教師必看點產生，並保存 route version。
5. 加入 streaming STT -> agent -> streaming TTS；無 STT/TTS 時完整退回文字與字幕。
6. 導覽完成產生有來源摘要；多語版本以同一 facts JSON 生成並做名稱/數字/引用一致性測試。

### Task 11：事件型展覽分析後台

**Files:**
- Create: `server/migrations/003_analytics_events.sql`
- Create: `server/routes/analyticsRoutes.js`
- Create: `server/services/analyticsAggregationService.js`
- Create: `server/repositories/analyticsRepository.js`
- Create: `src/app/pages/ExhibitionAnalytics.tsx`
- Modify: `src/app/pages/ExhibitionAdmin.tsx`
- Test: `server/services/analyticsAggregationService.test.js`

**Steps:**
1. 以匿名 session ID 收集 `visit_start/end`, `position_sample`, `exhibit_view/interact`, `ai_question`, `exit`；先取得所需 consent 並限制採樣。
2. server 驗證 gallery/version/item，按批次落庫；原始位置事件短 TTL，彙總較長 TTL。
3. 計算訪客、回訪率、平均時間、展品排行、漏斗離開點、路線熱圖、AI 問題分類/未答率、留言主題/情緒。
4. 所有指標帶 exhibition version，提供版本前後比較；樣本太小時隱藏以降低個人識別風險。
5. CSV 從同一 query model 匯出；PDF 由背景 job 生成，包含定義、時間範圍與時區。

### Task 12：機構工作區、審批、SSO 與額度

**Files:**
- Create: `server/services/ssoService.js`
- Create: `server/services/quotaService.js`
- Create: `server/services/publishingWorkflowService.js`
- Create: `src/app/pages/OrganizationAdmin.tsx`
- Create: `src/app/pages/WorkspaceSettings.tsx`
- Modify: `server/routes/organizationRoutes.js`
- Test: `server/services/quotaService.test.js`

**Steps:**
1. 完成機構/校區/班級/專案 workspace UI 與 CSV 批量邀請；學生帳戶使用邀請/SSO，不產生可預測密碼。
2. 接 OIDC Google/Microsoft，按 verified domain 或邀請加入組織；保留本地登入給開發/小型客戶。
3. 發布狀態改為 draft -> submitted -> changes_requested -> approved -> scheduled/published；審批和發佈分權。
4. quota 計量 storage bytes、AI tokens/cost、TTS、展覽數與 concurrent visitors；80/100% 通知，超限採可理解降級。
5. 機構管理頁提供用量、稽核、模板、品牌與成員報告。

### Task 13：WCAG 2.2 AA 與防暈模式

**Files:**
- Modify: `src/app/features/exhibition-viewer/Exhibition2DView.tsx`
- Modify: `src/app/modules/metaverse3d/components/UI/ViewUI.tsx`
- Modify: `src/app/modules/metaverse3d/input/playerInput.ts`
- Create: `src/app/features/accessibility/AccessibilitySettings.tsx`
- E2E: `e2e/accessibility.spec.ts`

**Steps:**
1. 對 wizard、viewer、分享與分析跑 axe，修正名稱、焦點、對比、錯誤與 modal focus trap。
2. 3D 所有功能可由鍵盤完成；提供展品清單直接跳轉，不要求第一人稱精準操作。
3. 影片必有字幕，TTS 必有逐字稿；語音輸入結果可編輯後送出。
4. 支援 prefers-reduced-motion、固定視角、降低轉速、teleport、關閉 head bob/postprocessing 的防暈 preset。
5. 以 NVDA + Chrome、VoiceOver + Safari 做人工驗收，缺陷列入發布閘門。

### Task 14：模板與合法資產生態

**Files:**
- Create: `server/repositories/templateRepository.js`
- Create: `server/routes/templateRoutes.js`
- Create: `server/services/templateValidationService.js`
- Modify: `src/app/constants/galleryTemplates.ts`
- Modify: `src/app/constants/gallerySceneTemplates.ts`
- Create: `src/app/pages/TemplateLibrary.tsx`
- Test: `server/services/templateValidationService.test.js`

**Steps:**
1. 把 hardcoded template 遷移為版本化實體，保存適用年級/展覽類型、場景 schema、素材預算、license/provenance。
2. 先上線校園成果展、攝影展、歷史展三個經策展/效能/無障礙驗證模板。
3. 支援預覽、複製、評分、機構私有模板與可重用展品群組。
4. 資產上架前驗 license、作者、來源、允許用途與撤下流程；不要允許任意公共上傳直接進全站庫。

---

## Release 2：商業化與長期工程

### Task 15：方案、計量、帳務與權益

**Files:**
- Create: `server/services/entitlementService.js`
- Create: `server/services/billingService.js`
- Create: `server/repositories/subscriptionRepository.js`
- Create: `server/routes/billingRoutes.js`
- Create: `src/app/pages/Billing.tsx`
- Test: `server/services/entitlementService.test.js`

**Steps:**
1. 將免費、教師、學校、活動、文化機構轉成 data-driven entitlements，不在 UI 散落方案名稱判斷。
2. 先做 usage ledger 和額度，再接支付 provider；webhook 必須簽章驗證、冪等並可重放。
3. 降級/取消不刪資料；改為唯讀或限制新建，清楚展示恢復方法。
4. 為活動短時高流量加入預留 concurrency、排隊/觀眾模式與成本上限。

### Task 16：品牌、網域、嵌入與發布生命週期

**Files:**
- Create: `server/services/domainVerificationService.js`
- Create: `server/services/publicationSchedulerService.js`
- Create: `server/routes/publicationRoutes.js`
- Create: `src/app/pages/BrandSettings.tsx`
- Modify: `src/app/pages/ExhibitionView.tsx`
- Test: `server/services/publicationSchedulerService.test.js`

**Steps:**
1. 支援 slug、自訂網域 DNS 驗證、TLS provisioning 狀態；避免 host header 決定 tenant。
2. embed 使用限定 origin、最小 scope token 與 CSP/frame-ancestors；不共用完整帳戶 cookie。
3. server render/edge metadata 提供 title、description、canonical 與 Open Graph 圖。
4. 品牌 token 限定 logo/字體/色彩/載入畫面並做對比檢查。
5. 發布排程與到期下架由持久 job 執行；QR code 指向穩定 publication URL；票務用 adapter 隔離。

### Task 17：拆分後端與生產資料平台

**Files:**
- Create: `server/repositories/userRepository.js`
- Create: `server/repositories/galleryRepository.js`
- Create: `server/repositories/growthRepository.js`
- Create: `server/repositories/competitionRepository.js`
- Create: `server/repositories/visitorRepository.js`
- Modify: `server/db.js`
- Modify: `server/config/deps.js`
- Create: `server/workers/worker.js`
- Create: `server/observability/logger.js`
- Test: repository contract tests under `server/repositories/`

**Steps:**
1. 先用 contract tests 鎖定現有 SQLite 行為，逐域把 SQL 從 `db.js` 移到 repository；route 只呼叫 service。
2. 引入正式 migration runner（up/down、schema table、transaction、啟動 barrier）；停止以大量 `ALTER TABLE` callback 當 migration。
3. repository interface 同時跑 SQLite 與 PostgreSQL contract tests；完成 shadow migration、校驗筆數/hash、切換與回滾 runbook。
4. 媒體從本地 `server/uploads` 遷至 object storage；DB 只保存 asset metadata/key，下載用短效 URL。
5. AI/TTS/媒體/PDF/排程進背景 queue；job 有 retry/backoff、dead-letter、idempotency、owner quota。
6. 加 structured logs、request/job IDs、錯誤追蹤、RED 指標、AI 成本 dashboard、備份還原演練及 RPO/RTO。

### Task 18：消除 3D 雙重架構

**Files:**
- Modify: `src/app/features/metaverse-studio/index.ts`
- Modify: `src/app/features/metaverse-studio/store/index.ts`
- Modify: `src/app/features/metaverse-studio/types/index.ts`
- Modify: `src/app/pages/ExhibitionUploadPlatform.tsx`
- Delete after migration: `src/app/modules/metaverse3d/MetaverseStudioApp.tsx`
- Delete after migration: `src/app/modules/metaverse3d/store/useStore.ts`
- Delete after migration: `src/app/modules/metaverse3d/components/ExhibitItem.tsx`
- Delete after migration: `src/app/modules/metaverse3d/components/CanvasContainer.tsx`
- Test: `src/app/features/metaverse-studio/publicApi.test.ts`

**Steps:**
1. 寫 import-boundary test/ESLint rule：頁面只能從 `features/metaverse-studio` 匯入，不能直接進 `modules/metaverse3d`。
2. 把 network、AI、canvas、types 的必要 API 經 facade 暴露，逐頁替換 deep import。
3. 將 store 拆成 scene/editor/viewer/agent/multiplayer slices，但保持一個 public store contract；禁止重複 scene type。
4. 前後端 scene schema 由共享 JSON Schema/Zod source 生成；每個 schema version 有 migration fixture。
5. 所有 caller 清零後刪相容 re-export；用 bundle analyzer 確認沒有雙載入。
6. 加 E2E：AI 建展 -> 多人同編 -> 斷線補發 -> 保存 -> schema migration -> 版本還原 -> 2D/3D 發布。

---

## 每個 Release 的固定驗證

1. 先跑新增的 file-scoped tests，確認紅燈，再實作最小變更至綠燈。
2. 跑 `npm run check:server`、`npm run typecheck`、`npm run lint`、`npm run test`、`npm run build`、`npm run check:bundle`。
3. 跑 Playwright 教師主流程、手機主流程、多人重連、無障礙與 2D fallback。
4. 在 staging 做 Redis/PostgreSQL/object storage/queue 故障注入，驗證降級、重試、冪等與資料不丟失。
5. 做 migration backup -> migrate -> verify -> rollback -> restore 演練；記錄 RPO/RTO。
6. 安全驗收涵蓋未成年人 consent、越權、分享爆破/限次、上傳內容、EXIF、資料匯出/刪除及 audit completeness。
7. 每一 task 用小型 commit；AI commit 依 `AGENTS.md` 加 `Co-Authored-By`。

## 建議里程碑

- **第 1-2 週：** Task 1-3，先證明 30 分鐘建展與安全素材入口。
- **第 3-5 週：** Task 4-6，建立 AI/版本/多人共同可靠底座。
- **第 6-8 週：** Task 7-9，完成兒童資料治理與低階裝置發布閘門。
- **第 9-13 週：** Task 10-14，形成導覽、分析、機構、無障礙與模板差異化。
- **第 14 週後：** Task 15-18，以已驗證使用量決定商業方案與平台遷移節奏。

上述估期假設一個 5-7 人跨職能團隊；單人或雙人團隊不應並行全部工作，必須先完成 Release 0。
