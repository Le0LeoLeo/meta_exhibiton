# Vibe Coding Prompt: React Three.js 展覽專案功能模塊重構

你是本次重構的主 Agent。你必須全程自主推進、追蹤整體進度、拆分任務、生成子 Agent 來實作每一個模塊，並要求每個子 Agent 完成對應驗證與測試。使用者不會參與執行過程；遇到會影響架構、行為相容性、資料安全或任務範圍的疑問時，必須停止並提問，不得猜測。

## 背景

此專案是 React + Three.js 展覽系統。核心 3D 工作區目前集中在 `src/app/modules/metaverse3d`，包含展覽編輯器、觀看模式、樓層平面、多人協作、AI 導覽、Zustand store、Canvas 副作用與大量 UI 邏輯。後端也存在大型 route 檔，將 HTTP I/O、驗證、資料轉換、DB 操作與業務流程混在一起。

重構目標是依功能邊界拆分前後端模塊，建立清楚責任、公共入口、狀態邊界與 API 依賴，降低大型檔案維護成本，並保持現有路由 URL、endpoint 與主要使用流程相容。

必讀文檔：

- `doc/refactor-module-plan.md`
- `doc/module-boundary-map.md`
- `doc/README.md`

執行前先完整閱讀以上文檔。搬遷檔案時以 `module-boundary-map.md` 作為對照表，以 `refactor-module-plan.md` 作為階段計畫。

## 主 Agent 職責

1. 維護全局任務看板，追蹤每個 phase 的狀態、風險、測試結果與阻塞問題。
2. 在每個 phase 開始前，先讀取相關檔案並確認現有引用關係，不得只依文檔推測。
3. 將每個 phase 拆成可獨立完成的子任務，生成子 Agent 負責實作。
4. 明確限制子 Agent 的修改範圍，避免不同子 Agent 同時修改同一批檔案造成衝突。
5. 在合併子 Agent 結果前，審查變更是否符合依賴規則、公共 API 規則與相容策略。
6. 每完成一個 phase，執行對應檢查指令並記錄結果。
7. 若出現不明確情況，尤其是兩個 `MetaverseStudioApp.tsx` 入口、舊路徑 facade 是否可刪、資料 schema 是否能改、endpoint 是否可改，必須向使用者提問。

## 不可違反的原則

- 先建立 facade 與公共 API，再逐步搬遷檔案。
- 每個 feature 只能透過 `index.ts` 暴露公共能力。
- 其他 feature 不得 import 某個 feature 的內部檔案，只能 import 其 public API。
- React 頁面只負責路由、載入、權限、頁面級錯誤與啟動模塊，不承擔 3D 場景內部規則。
- Three.js/R3F Canvas 層只負責渲染與互動事件轉譯，不直接保存業務資料，也不直接呼叫 HTTP API。
- Zustand store 拆成 slices；跨 slice 動作放入 service/action orchestrator。
- 後端 route 只保留 HTTP I/O、validator 呼叫、service 呼叫與統一回應。
- 現有前端路由 URL 與後端 endpoint 必須保持相容，除非使用者明確批准。
- 搬遷時先保留舊路徑 re-export，待所有 import 改為新 public API 後再刪除舊 facade。
- 目前部分中文文字可能有編碼問題。不要把文字內容修復與結構重構混在同一個 commit 或同一個子任務中。

## 目標架構

前端目標結構：

```text
src/app/
  app/
    App.tsx
    routes.ts
    auth.tsx
  shared/
    api/
    components/
    hooks/
    lib/
    styles/
    types/
  features/
    marketing-3d/
    virtual-gallery/
    exhibition-viewer/
    metaverse-studio/
      app/
      canvas/
      editor/
      viewer/
      floor-plan/
      exhibits/
      room/
      agent/
      multiplayer/
      performance/
      store/
      types/
      index.ts
    growth-memories/
    competitions/
    account/
```

後端目標結構：

```text
server/
  app.js
  index.js
  config/
  db/
    connection.js
    repositories/
  modules/
    auth/
    galleries/
    growth/
    competitions/
    agent/
    tts/
    multiplayer/
```

## 分派子 Agent 策略

主 Agent 需按階段生成子 Agent。每個子 Agent 都必須輸出：

- 修改摘要
- 變更檔案清單
- 依賴邊界檢查
- 執行過的測試或檢查指令
- 未能驗證的風險

建議子 Agent 分工：

1. Baseline Agent：檢查專案現況、引用關係、現有測試與 `npm run check` 基準。
2. Facade Agent：建立 `features/metaverse-studio` 目錄、public API 與舊路徑 re-export。
3. Canvas Agent：拆分 `CanvasContainer.tsx` 的 preload、快捷鍵、pointer lock 與 overlay。
4. Exhibits Agent：建立 exhibit registry，拆分 painting、text、pedestal、partition、lightstrip 與 decor model。
5. Room Agent：拆分 Room 的拓撲、材質、牆面放置與 preview。
6. Store Agent：建立 selectors、拆分 slices、處理 persist schema 相容。
7. Page Feature Agent：拆分 virtual-gallery、exhibition-viewer、marketing-3d、growth-memories、competitions、account。
8. Server Agent：拆分 gallery、growth、competition、auth、agent、tts、multiplayer 後端模塊。
9. Verification Agent：執行全局檢查、補足單元測試、整理殘留 facade 與 import 邊界。

同一時間只允許並行互不重疊的子 Agent。例如 Canvas Agent 與 Server Agent 可並行；Store Agent 與 Exhibits/Room Agent 若會同時改 store hooks，需由主 Agent 排序。

## Phase 計畫

### Phase 0: 建立保護網

- 執行 `npm run check` 確認基準狀態。
- 建立煙霧測試清單：首頁、登入、建立展覽、載入既有展覽、編輯物件、發布觀看、多人房間、AI 導覽聊天。
- 搜尋並記錄兩個 `MetaverseStudioApp.tsx` 的實際引用路徑。
- 為 scene import/export、floor plan geometry、selection helper 補最小單元測試；若尚無測試框架，先評估是否加入 Vitest，需避免大範圍改動。

### Phase 1: 建立 feature 目錄與 facade

- 建立 `src/app/features/metaverse-studio`。
- 將正式 `MetaverseStudioApp.tsx` 搬到 `features/metaverse-studio/app/MetaverseStudioApp.tsx`。
- 建立 `features/metaverse-studio/index.ts` 作為 public API。
- 舊路徑保留 re-export。
- 將 types 搬到 `features/metaverse-studio/types/index.ts`，舊路徑保留 re-export。
- 確認 `VirtualGalleryCreate.tsx`、`ExhibitionView.tsx` 可透過 public API 使用 studio。

### Phase 2: 拆 Canvas 與全域副作用

- 從 `CanvasContainer.tsx` 拆出 `useScenePreloader`。
- 拆出 `PreloadOverlay`。
- 拆出 `useGlobalStudioShortcuts`。
- 拆出 `usePointerLockExitOnEdit`。
- 將組裝元件改名或搬遷為 `features/metaverse-studio/canvas/StudioCanvasRoot.tsx`。
- 保持 UI 行為不變，執行 `npm run check`。

### Phase 3: 拆 ExhibitItem

- 建立 `features/metaverse-studio/exhibits/exhibitRegistry.ts`。
- 定義 `ExhibitRendererProps`。
- 先搬 `PaintingExhibit` 與 `TextExhibit`。
- 再搬 `PedestalExhibit`、`PartitionExhibit`、`LightstripExhibit`。
- 最後建立 `DecorModelExhibit`，用 config 合併 `flower/chandelier/bench/rug/vase/sculpture/spotlight/plant/column/neon`。
- `ExhibitItem.tsx` 只保留選取、TransformControls、registry dispatch 與觀看互動。

### Phase 4: 拆 Room 與牆面放置

- 將 `createSegments`、wall topology、partition surface 推導搬到純函式檔。
- 將材質建立與 texture 設定搬到 `roomMaterials.ts`。
- 將 pending placement hover/click 邏輯搬到 `useWallPlacement.ts`。
- 建立 `PlacementPreview.tsx`。
- `Room.tsx` 只負責從 store 讀資料、取得 handlers、組裝 `FloorMesh`、`WallSegments`、`PlacementPreview`。

### Phase 5: 拆 Store

- 先建立 public selectors/hooks，讓元件停止直接讀大量 store 欄位。
- 拆分 slices：scene、selection、viewing、wallMaterial、floorPlan、history、placement、performance、agent。
- 將純 helper 放入 `store/helpers` 或相關 feature model。
- 調整 persist schema，確保舊 localStorage 可以升級。
- public hooks 建議包含：

```ts
export function useStudioMode(): AppMode;
export function useSceneItems(): ExhibitItem[];
export function useSelectedItem(): ExhibitItem | null;
export function useEditorActions(): {
  addItem: AddItemAction;
  updateItem: UpdateItemAction;
  removeItem: RemoveItemAction;
  undo: () => void;
  redo: () => void;
};
export function useFloorPlanState(): FloorPlanViewModel;
export function useViewerState(): ViewerViewModel;
export function useAgentState(): AgentViewModel;
```

### Phase 6: 拆頁面 feature

- 將 `VirtualGalleryCreate` 的 loading、autosave、multiplayer bootstrap 拆到 `features/virtual-gallery/services`。
- 將 `DEFAULT_NEW_GALLERY_SCENE` 與 sceneJson parse/serialize 搬到 `features/virtual-gallery/model/galleryScene.ts`。
- 將 `ExhibitionView` 的 published gallery loading 拆到 `features/exhibition-viewer/services/publishedGalleryLoader.ts`。
- 搬遷 `marketing-3d`、`growth-memories`、`competitions`、`account` 頁面與 API client。
- 更新 `src/app/app/routes.ts` lazy imports 指向 features。

### Phase 7: 拆後端 route

- 先拆 `galleryRoutes.js` 到 `server/modules/galleries`，因為它與 metaverse scene 耦合最高。
- 再拆 `growthRoutes.js` 與 `competitionRoutes.js`。
- 拆出 service、repository、validators、serializer。
- 保持 endpoint URL 不變。
- 每拆一個 route 檔，執行 `npm run check:server`。

## 驗證要求

每個 phase 完成後至少執行：

```bash
npm run check
```

後端修改後執行：

```bash
npm run check:server
```

若加入或已有 Vitest，針對純函式執行：

```bash
npm run test -- floorPlanGeometry
npm run test -- metaverseStore
```

煙霧測試至少覆蓋：

- 建立新展覽可載入 3D 編輯器。
- 編輯模式可新增 painting/text/pedestal/partition/lightstrip。
- 物件可選取、移動、旋轉、縮放。
- 平面圖模式可新增 room/wall，並套用到 3D。
- 觀看模式可移動玩家、打開展品、返回編輯模式。
- AI 模式可開啟聊天，導覽員不阻塞觀看模式。
- 儲存與自動儲存不覆蓋遠端較新版本。
- 發布展覽後 `/exhibitions/:id` 可讀取 sceneJson。
- 多人 host 與 viewer 進入同一 room 後可以看到遠端玩家。

## 完成定義

任務完成時必須滿足：

- 每個 feature 有 `index.ts` 作為唯一公共出口。
- 任一核心元件檔案低於約 250 行；例外需在檔案頂部說明原因。
- `metaverse-studio` store 已拆成 slices，元件多數使用 selector/hook。
- `ExhibitItem` 不再包含所有展品渲染實作。
- `Room` 不再包含牆面拓撲、材質、放置規則的全部細節。
- 頁面層沒有自動儲存、多人 socket、scene parse 的大段業務邏輯。
- 後端每個功能域都有 route/service/repository 分層。
- 現有 endpoint 與路由 URL 保持相容。
- 全部必要檢查與測試已執行，失敗項已修復或明確回報阻塞。

## 最終回報格式

主 Agent 完成全部工作後，請回報：

1. 完成的 phase 與子 Agent 分工。
2. 主要架構變更摘要。
3. public API 與 facade 狀態。
4. 執行過的驗證指令與結果。
5. 尚未處理或需要使用者決策的事項。

