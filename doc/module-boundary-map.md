# 功能模塊邊界與檔案映射

## 用途

此文件作為重構時的對照表，說明目前檔案應歸屬到哪個功能模塊，以及重構後各模塊允許暴露的公共 API。執行搬遷時，先看本文件，再看 `doc/refactor-module-plan.md` 的分階段計畫。

## 目前核心入口

| 現有檔案 | 目前角色 | 重構歸屬 |
| --- | --- | --- |
| `src/app/App.tsx` | App providers 與 router | `src/app/app/App.tsx` |
| `src/app/routes.ts` | 全站路由 | `src/app/app/routes.ts` |
| `src/app/pages/VirtualGalleryCreate.tsx` | 建立/編輯展覽頁、儲存、自動儲存、多人房間啟動 | `features/virtual-gallery/pages/CreateGalleryPage.tsx` |
| `src/app/pages/ExhibitionView.tsx` | 已發布展覽觀看頁 | `features/exhibition-viewer/pages/ExhibitionViewPage.tsx` |
| `src/app/modules/metaverse3d/MetaverseStudioApp.tsx` | 正式 3D studio 入口 | `features/metaverse-studio/app/MetaverseStudioApp.tsx` |
| `src/app/modules/metaverse3d/components/MetaverseStudioApp.tsx` | 舊版/重複 studio 入口 | 刪除候選或 facade |

## metaverse-studio 檔案映射

### App 與 Canvas

| 現有檔案 | 建議新位置 | 說明 |
| --- | --- | --- |
| `MetaverseStudioApp.tsx` | `features/metaverse-studio/app/MetaverseStudioApp.tsx` | 組裝 Canvas、Editor UI、Viewer UI、FloorPlan UI、Multiplayer、Agent panels |
| `components/CanvasContainer.tsx` | `features/metaverse-studio/canvas/StudioCanvasRoot.tsx` | 拆出 preload、shortcut、pointer lock hooks 後保留組裝 |
| `components/CanvasScene.tsx` | `features/metaverse-studio/canvas/CanvasScene.tsx` | R3F Canvas、camera、lights、mode canvas switch |
| `components/createRenderer.ts` | `features/metaverse-studio/canvas/createRenderer.ts` | renderer/clock 工具 |
| `performanceProfile.ts` | `features/metaverse-studio/performance/performanceProfile.ts` | 渲染效能設定 |

### 編輯器 UI

| 現有檔案 | 建議新位置 |
| --- | --- |
| `components/UI/EditUI.tsx` | `features/metaverse-studio/editor/EditorOverlay.tsx` |
| `components/UI/EditorShell.tsx` | `features/metaverse-studio/editor/components/EditorShell.tsx` |
| `components/UI/EditorTopBar.tsx` | `features/metaverse-studio/editor/components/EditorTopBar.tsx` |
| `components/UI/EditorLeftToolbar.tsx` | `features/metaverse-studio/editor/components/EditorLeftToolbar.tsx` |
| `components/UI/EditorWorkspacePanel.tsx` | `features/metaverse-studio/editor/components/EditorWorkspacePanel.tsx` |
| `components/UI/EditorInspectorPanel.tsx` | `features/metaverse-studio/editor/components/EditorInspectorPanel.tsx` |
| `components/UI/WorkspacePlacementPanel.tsx` | `features/metaverse-studio/editor/components/WorkspacePlacementPanel.tsx` |
| `components/UI/WorkspaceRoomSettingsPanel.tsx` | `features/metaverse-studio/editor/components/WorkspaceRoomSettingsPanel.tsx` |
| `components/UI/useItemPlacement.ts` | `features/metaverse-studio/editor/hooks/useItemPlacement.ts` |
| `components/UI/useEditorShortcuts.ts` | `features/metaverse-studio/editor/hooks/useEditorShortcuts.ts` |
| `components/UI/useTopBarHeight.ts` | `features/metaverse-studio/editor/hooks/useTopBarHeight.ts` |
| `components/UI/editorConstants.ts` | `features/metaverse-studio/editor/model/editorConstants.ts` |

### Inspector

| 現有檔案 | 建議新位置 |
| --- | --- |
| `components/UI/PaintingInspector.tsx` | `features/metaverse-studio/editor/inspectors/PaintingInspector.tsx` |
| `components/UI/TextInspector.tsx` | `features/metaverse-studio/editor/inspectors/TextInspector.tsx` |
| `components/UI/PedestalInspector.tsx` | `features/metaverse-studio/editor/inspectors/PedestalInspector.tsx` |
| `components/UI/PartitionInspector.tsx` | `features/metaverse-studio/editor/inspectors/PartitionInspector.tsx` |
| `components/UI/LightstripInspector.tsx` | `features/metaverse-studio/editor/inspectors/LightstripInspector.tsx` |
| `components/UI/GenericColorInspector.tsx` | `features/metaverse-studio/editor/inspectors/GenericColorInspector.tsx` |
| `components/UI/PositionInspector.tsx` | `features/metaverse-studio/editor/inspectors/PositionInspector.tsx` |
| `components/UI/NumericControlField.tsx` | `features/metaverse-studio/editor/inspectors/NumericControlField.tsx` |
| `components/UI/PerformanceModeControl.tsx` | `features/metaverse-studio/editor/inspectors/PerformanceModeControl.tsx` |
| `components/UI/inspectorShared.ts` | `features/metaverse-studio/editor/inspectors/inspectorShared.ts` |

### Viewer

| 現有檔案 | 建議新位置 |
| --- | --- |
| `components/ViewCanvas.tsx` | `features/metaverse-studio/viewer/ViewCanvas.tsx` |
| `components/Player.tsx` | `features/metaverse-studio/viewer/Player.tsx` |
| `components/UI/ViewUI.tsx` | `features/metaverse-studio/viewer/ViewOverlay.tsx` |

### Floor Plan

| 現有檔案 | 建議新位置 |
| --- | --- |
| `components/FloorPlanCanvas.tsx` | `features/metaverse-studio/floor-plan/FloorPlanCanvas.tsx` |
| `components/FloorPlanScene.tsx` | `features/metaverse-studio/floor-plan/FloorPlanScene.tsx` |
| `components/StudioFloorPlanScene.tsx` | 舊版候選，確認引用後刪除或合併 |
| `components/StudioFloorPlanPanel.tsx` | 舊版候選，確認引用後刪除或合併 |
| `components/UI/FloorPlanUI.tsx` | `features/metaverse-studio/floor-plan/ui/FloorPlanOverlay.tsx` |
| `components/UI/FloorPlanTopBar.tsx` | `features/metaverse-studio/floor-plan/ui/FloorPlanTopBar.tsx` |
| `components/UI/FloorPlanInspectorPanel.tsx` | `features/metaverse-studio/floor-plan/ui/FloorPlanInspectorPanel.tsx` |
| `components/UI/FloorPlanSpacePanel.tsx` | `features/metaverse-studio/floor-plan/ui/FloorPlanSpacePanel.tsx` |
| `components/UI/FloorPlanStatusPanel.tsx` | `features/metaverse-studio/floor-plan/ui/FloorPlanStatusPanel.tsx` |
| `components/UI/FloorPlanTipsPanel.tsx` | `features/metaverse-studio/floor-plan/ui/FloorPlanTipsPanel.tsx` |
| `store/floorPlanGeometry.ts` | `features/metaverse-studio/floor-plan/model/floorPlanGeometry.ts` |
| `store/floorPlanActions.ts` | `features/metaverse-studio/floor-plan/model/floorPlanActions.ts` |
| `store/metaverseStoreFloorPlanHelpers.ts` | `features/metaverse-studio/floor-plan/model/floorPlanHelpers.ts` |

### Room

| 現有檔案 | 建議新位置 | 拆分重點 |
| --- | --- | --- |
| `components/Room.tsx` | `features/metaverse-studio/room/Room.tsx` | 只保留組裝 |
| `components/StudioRoom.tsx` | 舊版候選，確認引用後刪除或合併 | 可能與舊 StudioCanvas 同源 |
| `Room.tsx` 內 `PreviewGhost` | `features/metaverse-studio/room/PlacementPreview.tsx` | pending placement 顯示 |
| `Room.tsx` 內 material/texture 邏輯 | `features/metaverse-studio/room/roomMaterials.ts` | 材質建立與貼圖 repeat |
| `Room.tsx` 內 wall click/hover 邏輯 | `features/metaverse-studio/room/useWallPlacement.ts` | 將事件轉為 store action |

### Exhibits

| 現有檔案 | 建議新位置 | 拆分重點 |
| --- | --- | --- |
| `components/ExhibitItem.tsx` | `features/metaverse-studio/exhibits/ExhibitItem.tsx` | 只保留選取、TransformControls、registry dispatch |
| `components/StudioExhibitItem.tsx` | 舊版候選，確認引用後刪除或合併 | 和 `StudioCanvas` 同步處理 |
| `components/CanvasAssetBoundary.tsx` | `features/metaverse-studio/exhibits/CanvasAssetBoundary.tsx` | 資產載入錯誤邊界 |
| `ExhibitItem.tsx` 內 `Painting` | `features/metaverse-studio/exhibits/components/PaintingExhibit.tsx` | 圖片/影片/thumbnail |
| `ExhibitItem.tsx` 內 `Pedestal` | `features/metaverse-studio/exhibits/components/PedestalExhibit.tsx` | 3D model pedestal |
| `ExhibitItem.tsx` 內 `Text3D` | `features/metaverse-studio/exhibits/components/TextExhibit.tsx` | 文字與 backboard |
| `ExhibitItem.tsx` 內 decor 類型 | `features/metaverse-studio/exhibits/components/DecorModelExhibit.tsx` | 使用 config 合併重複 GLB/primitive 渲染 |

建議 registry:

```ts
export const exhibitRegistry: Record<ItemType, ExhibitRenderer> = {
  painting: PaintingExhibit,
  pedestal: PedestalExhibit,
  text: TextExhibit,
  partition: PartitionExhibit,
  lightstrip: LightstripExhibit,
  flower: DecorModelExhibit,
  chandelier: DecorModelExhibit,
  bench: DecorModelExhibit,
  rug: DecorModelExhibit,
  vase: DecorModelExhibit,
  sculpture: DecorModelExhibit,
  spotlight: DecorModelExhibit,
  plant: DecorModelExhibit,
  column: DecorModelExhibit,
  neon: DecorModelExhibit,
};
```

### Agent

| 現有檔案 | 建議新位置 |
| --- | --- |
| `agent/types.ts` | `features/metaverse-studio/agent/types.ts` |
| `agent/config.ts` | `features/metaverse-studio/agent/config.ts` |
| `agent/useAgentBehavior.ts` | `features/metaverse-studio/agent/useAgentBehavior.ts` |
| `agent/agentBehaviors.ts` | `features/metaverse-studio/agent/agentBehaviors.ts` |
| `agent/behaviorHelpers.ts` | `features/metaverse-studio/agent/behaviorHelpers.ts` |
| `agent/movementHelpers.ts` | `features/metaverse-studio/agent/movementHelpers.ts` |
| `agent/dialogueHelpers.ts` | `features/metaverse-studio/agent/dialogueHelpers.ts` |
| `agent/requestContext.ts` | `features/metaverse-studio/agent/requestContext.ts` |
| `agent/response.ts` | `features/metaverse-studio/agent/response.ts` |
| `components/AgentNPC.tsx` | `features/metaverse-studio/agent/components/AgentNPC.tsx` |
| `components/AgentSystem.tsx` | `features/metaverse-studio/agent/components/AgentSystem.tsx` |
| `components/UI/AgentChatPanel.tsx` | `features/metaverse-studio/agent/ui/AgentChatPanel.tsx` |
| `components/UI/AgentModeSelector.tsx` | `features/metaverse-studio/agent/ui/AgentModeSelector.tsx` |

### Multiplayer

| 現有檔案 | 建議新位置 |
| --- | --- |
| `network/protocol.ts` | `features/metaverse-studio/multiplayer/protocol.ts` |
| `network/socketClient.ts` | `features/metaverse-studio/multiplayer/socketClient.ts` |
| `network/multiplayerStore.ts` | `features/metaverse-studio/multiplayer/multiplayerStore.ts` |
| `network/localPlayerStore.ts` | `features/metaverse-studio/multiplayer/localPlayerStore.ts` |
| `components/Multiplayer/MultiplayerBridge.tsx` | `features/metaverse-studio/multiplayer/components/MultiplayerBridge.tsx` |
| `components/Multiplayer/RemotePlayers.tsx` | `features/metaverse-studio/multiplayer/components/RemotePlayers.tsx` |
| `components/Multiplayer/RemotePlayer.tsx` | `features/metaverse-studio/multiplayer/components/RemotePlayer.tsx` |

## Store 公共 API

重構後元件不應直接依賴完整 `useMetaverseStudioStore`。建議提供以下 hooks：

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

保留低階 store：

```ts
export { useMetaverseStudioStore } from "./store/studioStore";
```

但只允許 feature 內部使用，其他 feature 只能用 public hooks 或 `MetaverseStudioApp`。

## API client 映射

| 現有檔案 | 建議新位置 |
| --- | --- |
| `src/app/api/base.ts` | `src/app/shared/api/base.ts` |
| `src/app/api/client.ts` | 刪除聚合或改成 compatibility facade |
| `src/app/api/auth.ts` | `features/account/api/authApi.ts` |
| `src/app/api/gallery.ts` | `features/virtual-gallery/api/galleryApi.ts` |
| `src/app/api/exhibitions.ts` | `features/exhibition-viewer/api/exhibitionsApi.ts` |
| `src/app/api/growth.ts` | `features/growth-memories/api/growthApi.ts` |
| `src/app/api/competition.ts` | `features/competitions/api/competitionApi.ts` |
| `src/app/api/agent.ts` | `features/metaverse-studio/agent/api/agentApi.ts` |
| `src/app/api/tts.ts` | `features/metaverse-studio/agent/api/ttsApi.ts` |

## 路由映射

| URL | 現有頁面 | 建議頁面 |
| --- | --- | --- |
| `/` | `pages/Home.tsx` | `features/marketing/pages/HomePage.tsx` |
| `/virtual-gallery` | `pages/VirtualGallery.tsx` | `features/virtual-gallery/pages/VirtualGalleryLandingPage.tsx` |
| `/virtual-gallery/my-exhibitions` | `pages/MyExhibitions.tsx` | `features/virtual-gallery/pages/MyExhibitionsPage.tsx` |
| `/virtual-gallery/create` | `pages/VirtualGalleryCreate.tsx` | `features/virtual-gallery/pages/CreateGalleryPage.tsx` |
| `/exhibitions` | `pages/Exhibitions.tsx` | `features/exhibition-viewer/pages/ExhibitionsPage.tsx` |
| `/exhibitions/:exhibitionId` | `pages/ExhibitionView.tsx` | `features/exhibition-viewer/pages/ExhibitionViewPage.tsx` |
| `/growth-memories/*` | `pages/Growth*` | `features/growth-memories/pages/*` |
| `/competitions/*` | `pages/Competition*` | `features/competitions/pages/*` |
| `/login` | `pages/Login.tsx` | `features/account/pages/LoginPage.tsx` |
| `/register` | `pages/Register.tsx` | `features/account/pages/RegisterPage.tsx` |
| `/profile` | `pages/Profile.tsx` | `features/account/pages/ProfilePage.tsx` |

## 後端映射

| 現有檔案 | 建議新位置 |
| --- | --- |
| `server/index.js` | `server/index.js` + `server/app.js` |
| `server/db.js` | `server/db/connection.js` |
| `server/auth/jwt.js` | `server/modules/auth/jwt.js` |
| `server/routes/authRoutes.js` | `server/modules/auth/auth.routes.js` |
| `server/routes/galleryRoutes.js` | `server/modules/galleries/galleries.routes.js` |
| `server/routes/growthRoutes.js` | `server/modules/growth/growth.routes.js` |
| `server/routes/competitionRoutes.js` | `server/modules/competitions/competitions.routes.js` |
| `server/routes/agentRoutes.js` | `server/modules/agent/agent.routes.js` |
| `server/routes/ttsRoutes.js` | `server/modules/tts/tts.routes.js` |
| `server/services/agentService.js` | `server/modules/agent/agent.service.js` |
| `server/services/ttsService.js` | `server/modules/tts/tts.service.js` |
| `server/multiplayer/*` | `server/modules/multiplayer/*` |

## 搬遷時的兼容策略

2026-09-14 編輯器的 AI 建展流程已移至 `useEditorAiBuilder.ts`，畫面移至 `EditorAiBuilderPanel.tsx`。`EditUI.tsx` 保留面板開關與整合；hook 持續掛載，因此暫時收合面板會保留預覽和版本。離開頁面後的回應會被忽略；舊的記憶工作階段還原不能覆蓋新建展結果。瀏覽器中的工作階段指標是可選快取，存取失敗不阻止預覽／套用。

2026-09-14 已完成比賽與成長紀錄的資料存取拆分：`server/repositories/competitionRepository.js`、`growthRepository.js` 以最後一個參數接收資料庫連線。`server/db.js` 保留原有函式名稱、參數及預設連線，供路由繼續使用；資料表初始化尚在原檔。新增的記憶體資料庫測試涵蓋查詢範圍、分享撤銷、投票回滾及刪除關聯資料。後續拆分應沿用這個模式，避免 repository 反向匯入 `db.js` 產生循環依賴。

每次搬遷先保留舊路徑 re-export，避免全專案 import 同時爆炸。

範例：

```ts
// src/app/modules/metaverse3d/store/useStore.ts
export { useMetaverseStudioStore as useStore } from "../../../features/metaverse-studio/store";
```

當所有 import 改為新 public API 後，再刪除舊 facade。

## 重構提交順序建議

1. `docs: add module refactor plan`
2. `refactor(studio): add metaverse-studio facade`
3. `refactor(studio): split canvas preload and shortcuts`
4. `refactor(studio): introduce exhibit registry`
5. `refactor(studio): split room placement and materials`
6. `refactor(studio): split store selectors and slices`
7. `refactor(gallery): move create page services`
8. `refactor(viewer): move published exhibition loader`
9. `refactor(server): split gallery module services`
10. `refactor(server): split growth and competition modules`

## 每次搬遷的檢查指令

```bash
npm run check
```

後端單獨調整時：

```bash
npm run check:server
```

若加入 Vitest，純函式測試建議：

```bash
npm run test -- floorPlanGeometry
npm run test -- metaverseStore
```
