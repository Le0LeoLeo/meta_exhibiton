# 本次交付說明

## 交付範圍

依照 `doc/prompt.md` 與既有重構文件的方向，本次完成 Phase 1 的低風險切分：為 `metaverse-studio` 建立新的 feature public API，同時保留舊有 `modules/metaverse3d` 路徑作為相容 facade。

## 已完成事項

1. 新增 `src/app/features/metaverse-studio` feature 入口。
2. 新增 `features/metaverse-studio/index.ts`，統一匯出 app、store hooks 與 types。
3. 新增 `features/metaverse-studio/app/MetaverseStudioApp.tsx`，作為新的 3D Studio 應用入口。
4. 新增 `features/metaverse-studio/store/index.ts`，提供公開 store API 與 hooks：
   - `useStore`
   - `useMetaverseStudioStore`
   - `useStudioMode`
   - `useSceneItems`
   - `useSelectedItem`
   - `useEditorActions`
   - `useFloorPlanState`
   - `useViewerState`
   - `useAgentState`
5. 新增 `features/metaverse-studio/types/index.ts`，提供公開型別匯出。
6. 將舊入口 `src/app/modules/metaverse3d/MetaverseStudioApp.tsx` 改為 re-export 新 feature facade，讓既有 import 不會立即壞掉。
7. 將外部頁面與常數檔改為透過 `features/metaverse-studio` 使用 studio public API：
   - `src/app/pages/VirtualGalleryCreate.tsx`
   - `src/app/pages/ExhibitionView.tsx`
   - `src/app/pages/ExhibitionUploadPlatform.tsx`
   - `src/app/constants/gallerySceneTemplates.ts`

## 主要設計決策

- 這次沒有一次搬動 canvas、room、exhibits、store 的所有內部檔案，避免在目前大量未提交變更的工作樹中造成高風險衝突。
- 新 feature facade 先包住既有模組，讓後續 Phase 2 到 Phase 5 可以逐步把 canvas、exhibits、room、store 拆入 feature 目錄。
- 舊路徑仍可使用，但新的外部呼叫點已開始走 `src/app/features/metaverse-studio`。

## 驗證結果

已執行：

```bash
npm run check
```

結果通過：

- `npm run check:server` 通過，檢查 17 個 server JavaScript 檔案。
- `vite build` 通過，成功完成 production build。

## 安裝與環境注意事項

一開始 `npm run check` 失敗，原因是本機沒有可用的 `node_modules/.bin/vite`。

嘗試正常安裝 dev dependencies 時，`sqlite3` 在 Windows + Node 24.13.0 環境下觸發 native build，並因 Windows SDK / Visual Studio C++ toolchain 不完整而失敗。

最後使用以下命令安裝驗證所需依賴並跳過 native install scripts：

```bash
npm install --include=dev --ignore-scripts --package-lock=false
```

之後 `npm run check` 通過。

## 後續建議

1. 下一步可進入 Phase 2，拆分 `CanvasContainer.tsx` 為 `StudioCanvasRoot`、preload overlay 與快捷鍵 hooks。
2. 若要正式開發 server 端 `sqlite3` 相關功能，建議修好 Windows native build 環境，或改用與專案相容的 Node LTS 版本。
3. 目前工作樹原本已有大量未提交變更，本次只針對 metaverse-studio facade 與相關 import 邊界做增量修改。

---

# Phase 2 交付說明

## 交付範圍

本次進入 Phase 2，針對 canvas 層做低風險拆分。目標是把原本集中在 `CanvasContainer.tsx` 的資源預載、loading overlay、全域快捷鍵、pointer lock 副作用拆到 `features/metaverse-studio/canvas`，同時保留舊路徑相容。

## 已完成事項

1. 新增 `src/app/features/metaverse-studio/canvas/StudioCanvasRoot.tsx`，作為新的 canvas root。
2. 新增 `src/app/features/metaverse-studio/canvas/PreloadOverlay.tsx`，集中處理資源預載時的 loading UI。
3. 新增 `src/app/features/metaverse-studio/canvas/useScenePreloader.ts`，集中處理牆面、地板、圖片與模型資源預載。
4. 新增 `src/app/features/metaverse-studio/canvas/useGlobalStudioShortcuts.ts`，集中處理：
   - view 模式下 AI 參與時按 `T` 開關聊天。
   - 非輸入狀態下 `Ctrl/Cmd+Z` undo。
   - 非輸入狀態下 `Shift+Ctrl/Cmd+Z` redo。
5. 新增 `src/app/features/metaverse-studio/canvas/usePointerLockExitOnEdit.ts`，集中處理切回 edit 模式時退出 pointer lock。
6. 新增 `src/app/features/metaverse-studio/canvas/index.ts`，提供 canvas public exports。
7. 將 `src/app/features/metaverse-studio/app/MetaverseStudioApp.tsx` 改為直接使用 `StudioCanvasRoot`。
8. 將舊的 `src/app/modules/metaverse3d/components/CanvasContainer.tsx` 改為 re-export `StudioCanvasRoot as CanvasContainer`，保留舊 import 相容性。

## 主要設計決策

- 這次只拆 canvas orchestration，不移動 `CanvasScene`、`EditCanvas`、`ViewCanvas`、`FloorPlanCanvas`，避免一次牽動 R3F 場景渲染與互動邏輯。
- `StudioCanvasRoot` 仍然使用既有 store 與既有 canvas scene，Phase 2 只把副作用與 UI 外殼切乾淨。
- 舊 `CanvasContainer` 保留為 facade，避免其他尚未搬遷的模組因 import 路徑改動而壞掉。

## 驗證結果

已執行：

```bash
npm run check
```

結果通過：

- `npm run check:server` 通過，檢查 17 個 server JavaScript 檔案。
- `vite build` 通過，成功完成 production build。

## 後續建議

1. 下一步可進入 Phase 3，拆分 `ExhibitItem.tsx`，建立 exhibit registry 與各類 exhibit renderer。
2. `CanvasScene.tsx` 目前仍在舊 `modules/metaverse3d/components` 內，後續可以在確認穩定後搬入 `features/metaverse-studio/canvas`。
3. `CanvasContainer.tsx` 現在已是相容 facade，等所有 import 改走 feature public API 後，可再評估是否移除舊路徑。

---

# Phase 3 交付說明

## 交付範圍

本次進入 Phase 3，針對 `ExhibitItem.tsx` 做第一層邊界重構：把展品渲染邏輯移入 `features/metaverse-studio/exhibits`，建立 exhibit registry，並保留舊 `modules/metaverse3d/components/ExhibitItem.tsx` 作為相容 facade。

## 已完成事項

1. 將原本的 `src/app/modules/metaverse3d/components/ExhibitItem.tsx` 搬到：
   - `src/app/features/metaverse-studio/exhibits/ExhibitItem.tsx`
2. 新增 `src/app/features/metaverse-studio/exhibits/exhibitRegistry.ts`，定義：
   - `ExhibitRendererProps`
   - `ExhibitRenderer`
   - `createExhibitRegistry`
3. 新增 `src/app/features/metaverse-studio/exhibits/index.ts`，提供 exhibits public exports。
4. 將 `ExhibitItem` 內原本的長串 `if / else if` type dispatch 改為 registry dispatch。
5. 新增 `PaintingExhibit` adapter，保留 painting 的 `CanvasAssetBoundary` fallback 行為。
6. 新增 `TextExhibit` adapter，保留 text item 欄位到 `Text3D` props 的轉換。
7. 將 `src/app/modules/metaverse3d/components/ExhibitItem.tsx` 改為 re-export 新 feature exhibits 入口，讓既有 `EditCanvas` / `ViewCanvas` import 不需要同步改動。
8. 將 `src/app/features/metaverse-studio/index.ts` 補上 `export * from "./exhibits"`，讓 feature public API 包含 exhibits 邊界。

## 目前 registry 涵蓋類型

`exhibitRegistry` 目前涵蓋所有既有 `ItemType`：

- `painting`
- `pedestal`
- `text`
- `partition`
- `lightstrip`
- `flower`
- `chandelier`
- `bench`
- `rug`
- `vase`
- `sculpture`
- `spotlight`
- `plant`
- `column`
- `neon`

## 主要設計決策

- 這次先完成 type dispatch 與 feature 邊界，不一次把 900 行 renderer 全部拆成多檔，避免在大量既有變更的工作樹中製造過大衝突。
- 外層選取、multi-select、TransformControls、牆面吸附、view 模式開啟作品檢視等互動仍留在 `ExhibitItem` 容器內。
- 各 renderer 函式目前仍在同一個 feature 檔案內，下一步可逐個搬到 `exhibits/components/*`。

## 驗證結果

已執行：

```bash
npm run check
```

結果通過：

- `npm run check:server` 通過，檢查 17 個 server JavaScript 檔案。
- `vite build` 通過，成功完成 production build。

## 後續建議

1. 下一步可繼續 Phase 3 細拆，將 `PaintingExhibit`、`TextExhibit`、`PedestalExhibit` 等移入 `features/metaverse-studio/exhibits/components/`。
2. 可把 decor 類型合併成 `DecorModelExhibit` 或 decor config map，降低目前多個 decor renderer 的重複結構。
3. 等 renderer 拆乾淨後，再處理 `CanvasAssetBoundary` 從舊 modules 路徑搬到 feature exhibits 邊界。

## Phase 3 細拆補充

- 繼續收斂 `ExhibitItem.tsx` 的責任邊界，將文字展品、燈帶展品、隔板展品拆到 `src/app/features/metaverse-studio/exhibits/components/`。
- 新增 `TextExhibit.tsx`、`LightstripExhibit.tsx`、`PartitionExhibit.tsx`，並由 `components/index.ts` 統一匯出。
- 更新展品 registry，讓 `text`、`lightstrip`、`partition` 直接指向拆分後的 renderer component。
- 保留 `ExhibitItem.tsx` 作為展品選取、TransformControls、互動事件與 renderer dispatch 的整合入口。
- 驗證：`npm run check` 已通過，包含 server syntax check 與 Vite production build。
