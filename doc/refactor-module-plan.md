# React Three.js 展覽專案功能模塊重構方案

## 目標

將目前的 React + Three.js 展覽專案按功能邊界拆分，讓每個模塊有清楚責任、入口、狀態與 API 依賴。重構後應降低大型檔案維護成本，讓 3D 編輯器、展覽觀看、樓層平面、多人協作、AI 導覽、後端服務能獨立演進。

## 現況盤點

目前主要程式集中在 `src/app/modules/metaverse3d`，這是核心 3D 展覽工作區。現有結構已經有模塊化雛形，例如 `components`、`store`、`network`、`agent`，但仍存在幾個問題：

- `useMetaverseStudioStore.ts` 同時承擔場景資料、選取、歷史、樓層平面、AI 導覽、效能模式、主題預設等狀態。
- `Room.tsx` 同時處理展場牆面渲染、材質、牆段拓撲、放置預覽、分區牆、滑鼠互動。
- `ExhibitItem.tsx` 同時處理所有展品類型的渲染、載入、選取、TransformControls、觀看互動。
- `CanvasContainer.tsx` 同時處理預載入、全域快捷鍵、模式判斷、指標鎖定、AI 入口、Canvas 包裝。
- `VirtualGalleryCreate.tsx` 同時處理頁面狀態、展覽載入、儲存、自動儲存、多人房間、同步訊號、3D App 啟動。
- `server/routes/galleryRoutes.js`、`growthRoutes.js`、`competitionRoutes.js` 檔案偏大，路由、驗證、資料轉換、業務流程混在一起。
- `src/app/components/Gallery3D.tsx`、`Geo3D.tsx` 是首頁/行銷視覺用 3D 元件，和真正的展覽編輯器不同，應拆成獨立 visual 模塊。
- `src/app/modules/metaverse3d/components/MetaverseStudioApp.tsx` 與 `src/app/modules/metaverse3d/MetaverseStudioApp.tsx` 有重複入口風險，需確認一個為正式入口，一個為舊入口或刪除候選。

## 模塊化原則

1. 以功能域拆分，不以技術層硬切。展品、房間、樓層、導覽員、多人協作都應各自擁有型別、狀態操作、UI、3D 渲染輔助。
2. React 頁面只負責路由、載入資料、權限、頁面級錯誤與啟動模塊，不直接處理 3D 場景內部規則。
3. Three.js/R3F Canvas 層只負責渲染與互動事件轉譯，不直接保存業務資料。
4. Zustand store 拆成 slices，跨 slice 動作放入 service/action orchestrator，避免每個 slice 互相知道全部狀態。
5. 後端 route 只負責 HTTP I/O，資料驗證、DB 操作、業務流程拆到 service/repository。
6. 每個模塊只透過 `index.ts` 匯出公共 API，其他模塊不引用內部檔案。
7. 先建立新結構與 facade，再逐步搬遷，避免一次性大搬家造成展覽功能不可用。

## 建議目錄

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
      components/
      index.ts
    virtual-gallery/
      pages/
      api/
      model/
      services/
      index.ts
    exhibition-viewer/
      pages/
      services/
      index.ts
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
      pages/
      api/
      model/
      index.ts
    competitions/
      pages/
      api/
      model/
      index.ts
    account/
      pages/
      api/
      model/
      index.ts
```

後端建議目錄：

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
      auth.routes.js
      auth.service.js
      auth.repository.js
      auth.validators.js
    galleries/
      galleries.routes.js
      galleries.service.js
      galleries.repository.js
      galleryScene.serializer.js
      comments.service.js
      shareLinks.service.js
    growth/
    competitions/
    agent/
    tts/
    multiplayer/
```

## 前端功能模塊切分

### 1. metaverse-studio

正式承載 3D 展覽編輯與觀看的核心模塊。

建議從 `src/app/modules/metaverse3d` 搬遷到 `src/app/features/metaverse-studio`，先保留 facade：

```ts
// src/app/modules/metaverse3d/MetaverseStudioApp.tsx
export { default } from "../../features/metaverse-studio";
```

子模塊責任：

- `app/`: `MetaverseStudioApp` 組裝 Canvas、UI、MultiplayerBridge、Agent panels。
- `canvas/`: `CanvasScene`、Canvas 初始化、光照、fog、camera、R3F performance profile。
- `editor/`: 編輯模式 UI、工具列、檢查器、快捷鍵、物件放置 hook。
- `viewer/`: 觀看模式 UI、第一人稱玩家、觀看展品 modal、導覽狀態。
- `floor-plan/`: 平面圖 Canvas、平面元素、牆/房間幾何、套用到 3D 場景。
- `exhibits/`: `Painting`、`Pedestal`、`TextExhibit`、`Partition`、`DecorItem` 等展品渲染與展品 registry。
- `room/`: 房間邊界、牆面、材質、牆段拓撲、牆面放置 anchor。
- `agent/`: AI 導覽員狀態、行為、對話、路徑、TTS 觸發。
- `multiplayer/`: socket client、多人 store、遠端玩家、同步橋接。
- `performance/`: DPR、陰影、環境光、低配模式判斷。
- `store/`: slices、selectors、actions、persist schema。
- `types/`: 場景模型、展品、房間、樓層平面、模式、快照。

### 2. virtual-gallery

承載建立、編輯、上傳、我的展覽列表。

搬遷來源：

- `src/app/pages/VirtualGallery.tsx`
- `src/app/pages/VirtualGalleryCreate.tsx`
- `src/app/pages/ExhibitionUploadPlatform.tsx`
- `src/app/pages/MyExhibitions.tsx`
- `src/app/api/gallery.ts`
- `src/app/api/exhibitions.ts`
- `src/app/constants/galleryTemplates.ts`
- `src/app/constants/gallerySceneTemplates.ts`

拆分建議：

- `pages/`: 路由頁面。
- `services/galleryDraftService.ts`: 載入、建立、更新、發布、匯入 sceneJson。
- `services/galleryAutosaveService.ts`: 自動儲存、localStorage sync、pending queue。
- `model/galleryScene.ts`: `DEFAULT_NEW_GALLERY_SCENE`、模板轉換、sceneJson parse/serialize。
- `api/galleryApi.ts`: HTTP client。

### 3. exhibition-viewer

承載已發布展覽觀看頁。

搬遷來源：

- `src/app/pages/ExhibitionView.tsx`
- published gallery API 呼叫。

拆分建議：

- `pages/ExhibitionViewPage.tsx`: 路由參數、載入狀態、錯誤頁、session status。
- `services/publishedGalleryLoader.ts`: 取得 published gallery、parse sceneJson。
- `components/ExhibitionSessionStatus.tsx`: 返回按鈕、WebGPU 狀態、標題、作者、日期。

### 4. marketing-3d

首頁與登入頁使用的裝飾性 3D 視覺，避免和展覽 studio 混淆。

搬遷來源：

- `src/app/components/Gallery3D.tsx`
- `src/app/components/Geo3D.tsx`

建議公共 API：

```ts
export { Gallery3D, MiniGallery3D } from "./components/Gallery3D";
export { FloatingCube, FloatingRing, FloatingDot, GridPattern } from "./components/Geo3D";
```

### 5. growth-memories

成長記憶功能獨立於展覽 studio，但會使用 3D 展示能力。

搬遷來源：

- `GrowthMemories.tsx`
- `GrowthMemories3D.tsx`
- `GrowthMemoriesShare.tsx`
- `GrowthRecommendation.tsx`
- `GrowthRecommendations.tsx`
- `src/app/api/growth.ts`

### 6. competitions

比賽列表、詳情、管理頁獨立。

搬遷來源：

- `Competitions.tsx`
- `CompetitionDetail.tsx`
- `CompetitionAdmin.tsx`
- `src/app/api/competition.ts`

### 7. account

登入、註冊、個人資料、auth client。

搬遷來源：

- `Login.tsx`
- `Register.tsx`
- `Profile.tsx`
- `src/app/auth.tsx`
- `src/app/api/auth.ts`

## metaverse-studio 內部細拆方案

### Store

目標檔案：

```text
features/metaverse-studio/store/
  studioStore.ts
  slices/
    sceneSlice.ts
    selectionSlice.ts
    viewingSlice.ts
    wallMaterialSlice.ts
    floorPlanSlice.ts
    historySlice.ts
    placementSlice.ts
    performanceSlice.ts
    agentSlice.ts
  selectors/
    sceneSelectors.ts
    selectionSelectors.ts
    floorPlanSelectors.ts
  persistence/
    persistSchema.ts
    sceneSanitizers.ts
```

拆分映射：

- `roomSize`、`items`、`wallMaterialOverrides` -> `sceneSlice`
- `selectedItemId`、`selectedItemIds`、`selectedWallFace`、`selectedWallAnchor`、`selectedWallSegmentId` -> `selectionSlice`
- `viewingItem`、`viewingCooldownUntil`、`openNextViewingItem`、`openPrevViewingItem` -> `viewingSlice`
- `floorPlanElements`、`floorPlanEditTarget`、`floorPlanIsTransforming` -> `floorPlanSlice`
- `undoStack`、`redoStack`、`undo`、`redo`、`withHistory` -> `historySlice`
- `pendingPlacement`、`setPendingPlacement` -> `placementSlice`
- `performanceMode` -> `performanceSlice`
- `agent`、`agentChat`、`hasSelectedParticipationMode`、`allowPointerLock` -> `agentSlice`

### Exhibit Registry

`ExhibitItem.tsx` 應拆成 registry，避免新增展品時修改一個巨大 switch/if chain。

建議結構：

```text
exhibits/
  ExhibitItem.tsx
  exhibitRegistry.ts
  types.ts
  components/
    PaintingExhibit.tsx
    PedestalExhibit.tsx
    TextExhibit.tsx
    PartitionExhibit.tsx
    LightstripExhibit.tsx
    DecorModelExhibit.tsx
  loaders/
    usePaintingTexture.ts
    useModelAsset.ts
```

公共介面：

```ts
type ExhibitRendererProps = {
  item: ExhibitItem;
  isSelected: boolean;
  mode: AppMode;
  onInteract?: () => void;
};
```

### Room

`Room.tsx` 應拆成純幾何計算、渲染、放置互動三層：

```text
room/
  Room.tsx
  RoomShell.tsx
  FloorMesh.tsx
  WallMesh.tsx
  WallSegments.tsx
  PlacementPreview.tsx
  useWallPlacement.ts
  wallTopology.ts
  roomMaterials.ts
```

拆分後，`Room.tsx` 只組裝：

- 從 store 讀取 room、items、floor plan。
- 呼叫 `useWallPlacement` 取得 wall click/hover handlers。
- 渲染 `FloorMesh`、`WallSegments`、`PlacementPreview`。

### Canvas

`CanvasContainer.tsx` 建議拆成：

```text
canvas/
  StudioCanvasRoot.tsx
  CanvasScene.tsx
  PreloadOverlay.tsx
  useScenePreloader.ts
  useGlobalStudioShortcuts.ts
  usePointerLockExitOnEdit.ts
```

其中：

- `useScenePreloader` 管理 texture/model preload。
- `useGlobalStudioShortcuts` 管理 `Ctrl+Z`、`Shift+Ctrl+Z`、view mode chat hotkey。
- `StudioCanvasRoot` 負責 DOM overlay 與 `CanvasScene`。
- `CanvasScene` 保持 R3F Canvas、camera、lights、mode canvas switch。

### Editor UI

`EditUI.tsx` 應拆成容器與面板：

```text
editor/
  EditorOverlay.tsx
  EditorToolbar.tsx
  EditorInspector.tsx
  EditorWorkspace.tsx
  hooks/
    useEditorShortcuts.ts
    useItemPlacement.ts
  inspectors/
    PaintingInspector.tsx
    TextInspector.tsx
    PositionInspector.tsx
    PartitionInspector.tsx
```

現有 `components/UI` 內多數 inspector 可以直接搬入 `editor/inspectors`，`FloorPlan*` 搬到 `floor-plan/ui`。

## 後端功能模塊切分

### galleries

目前 `server/routes/galleryRoutes.js` 包含 galleries CRUD、comments、publish、upload-link、share-link。建議拆成：

```text
server/modules/galleries/
  galleries.routes.js
  galleries.service.js
  galleries.repository.js
  galleryComments.service.js
  galleryShareLinks.service.js
  galleryUploadLinks.service.js
  galleryScene.serializer.js
  galleries.validators.js
```

路由只保留：

- 讀取 req/res。
- 呼叫 validator。
- 呼叫 service。
- 統一回應與錯誤處理。

### growth

目前 `growthRoutes.js` 包含 children、exhibits、assets、comments、share。建議拆成：

```text
server/modules/growth/
  growth.routes.js
  children.service.js
  exhibits.service.js
  assets.service.js
  comments.service.js
  share.service.js
  growth.repository.js
  growth.validators.js
```

### competitions

目前 `competitionRoutes.js` 包含 competition CRUD、entries、vote、admin review。建議拆成：

```text
server/modules/competitions/
  competitions.routes.js
  competitions.service.js
  entries.service.js
  votes.service.js
  adminReview.service.js
  competitions.repository.js
  competitions.validators.js
```

### multiplayer

現有 `server/multiplayer` 結構相對獨立，可保留，但建議搬入 `server/modules/multiplayer`，並讓 client/server protocol 共用命名與版本。

## 依賴規則

前端依賴方向：

```text
app/routes -> features/*/pages
features/* -> shared
features/virtual-gallery -> features/metaverse-studio public API
features/exhibition-viewer -> features/metaverse-studio public API
features/metaverse-studio submodules -> features/metaverse-studio/store + shared
shared -> 不依賴 features
```

禁止依賴：

- `features/*` 不直接 import 另一個 feature 的內部檔案，只能 import 其 `index.ts`。
- 頁面不直接 import `metaverse-studio/store/slices/*`。
- Canvas 子元件不直接呼叫 HTTP API。
- 後端 route 不直接寫大量 SQL/DB 操作。

## 分階段重構計畫

### Phase 0: 建立保護網

- 執行 `npm run check` 確認基準狀態。
- 建立煙霧測試清單：首頁、登入、建立展覽、載入既有展覽、編輯物件、發布觀看、多人房間、AI 導覽聊天。
- 為 scene import/export、floor plan geometry、selection helper 補最小單元測試。若專案尚未有測試框架，先用 `vitest` 建立純函式測試。

### Phase 1: 建立 feature 目錄與 facade

- 建立 `src/app/features/metaverse-studio`。
- 將 `MetaverseStudioApp.tsx` 先搬到新目錄，舊路徑保留 re-export。
- 將 `types.ts` 複製/搬遷為 `features/metaverse-studio/types/index.ts`，舊路徑保留 re-export。
- 確認 `VirtualGalleryCreate.tsx`、`ExhibitionView.tsx` 可透過 public API 使用 studio。

### Phase 2: 拆 Canvas 與全域副作用

- 從 `CanvasContainer.tsx` 拆出 `useScenePreloader`。
- 拆出 `PreloadOverlay`。
- 拆出 `useGlobalStudioShortcuts`。
- 拆出 `usePointerLockExitOnEdit`。
- 保持 UI 行為不變，再執行 `npm run check`。

### Phase 3: 拆 ExhibitItem

- 建立 exhibit registry。
- 先搬 `Painting` 與 `Text3D`，因為它們與使用者內容/觀看互動最相關。
- 再搬 `Pedestal`、`Partition`、`LightStrip`。
- 最後把 decor model 類型合併成 `DecorModelExhibit`，用 config 描述 `flower/chandelier/bench/rug/vase/sculpture/spotlight/plant/column/neon`。

### Phase 4: 拆 Room 與牆面放置

- 將 `createSegments`、wall topology、partition surface 推導搬到純函式檔。
- 將材質建立與 texture 設定搬到 `roomMaterials.ts`。
- 將 pending placement hover/click 邏輯搬到 `useWallPlacement.ts`。
- `Room.tsx` 縮小為組裝元件。

### Phase 5: 拆 Store

- 先建立 selectors，讓元件停止直接讀大量 store 欄位。
- 將純 helper 留在 `store/helpers`。
- 以 slice 拆分 `scene`、`selection`、`floorPlan`、`history`。
- 再拆 `agent`、`performance`、`placement`。
- 最後調整 persist schema，確保舊 localStorage 可以升級。

### Phase 6: 拆頁面 feature

- 將 `VirtualGalleryCreate` 的 gallery loading/autosave/multiplayer bootstrap 拆到 `virtual-gallery/services`。
- 將 `ExhibitionView` 的 published gallery loading 拆到 `exhibition-viewer/services`。
- 搬遷 growth、competition、account 頁面與 API client。
- 更新 `routes.ts` lazy imports 指向 features。

### Phase 7: 拆後端 route

- 先拆 `galleryRoutes.js`，因為它與 metaverse scene 耦合最高。
- 再拆 `growthRoutes.js`、`competitionRoutes.js`。
- 保持現有 endpoint URL 不變，只更換內部模塊。
- 每拆一個 route 檔，執行 `npm run check:server`。

## 驗證清單

每個 phase 完成後至少驗證：

- `npm run check`
- 建立新展覽可載入 3D 編輯器。
- 編輯模式可新增 painting/text/pedestal/partition/lightstrip。
- 物件可選取、移動、旋轉、縮放。
- 平面圖模式可新增 room/wall，並套用到 3D。
- 觀看模式可移動玩家、打開展品、返回編輯模式。
- AI 模式可開啟聊天，導覽員不阻塞觀看模式。
- 儲存與自動儲存不覆蓋遠端較新版本。
- 發布展覽後 `/exhibitions/:id` 可讀取 sceneJson。
- 多人 host 與 viewer 進入同一 room 後可以看到遠端玩家。

## 優先處理風險

- 目前部分中文文字呈現亂碼，重構時不要把文字內容與結構搬遷混在同一個 commit；應另開 i18n/encoding 修復。
- `DEFAULT_NEW_GALLERY_SCENE` 在頁面內，應優先搬到 model 層，避免 page 與 scene schema 耦合。
- `gallerySceneTemplates.ts` 直接 import metaverse types，搬遷時要改成 public type export。
- `CanvasContainer` 中存在未使用的 `PreloadOverlay` memo component，拆分時可清理。
- 兩個 `MetaverseStudioApp.tsx` 入口需要先確認實際引用路徑，再決定保留 facade 或刪除舊檔。

## 完成定義

重構完成後應滿足：

- 每個 feature 有 `index.ts` 作為唯一公共出口。
- 任一核心元件檔案低於約 250 行，例外需在檔案頂部說明原因。
- `metaverse-studio` 的 store 拆成 slices，元件多數使用 selector/hook。
- `ExhibitItem` 不再包含所有展品渲染實作。
- `Room` 不再包含牆面拓撲、材質、放置規則的全部細節。
- 頁面層沒有自動儲存、多人 socket、scene parse 的大段業務邏輯。
- 後端每個功能域都有 route/service/repository 分層。
- 現有 endpoint 與路由 URL 保持相容。
