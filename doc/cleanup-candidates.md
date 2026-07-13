# 專案清理候選清單

日期：2026-06-05
專案目錄：`D:\Downloads\meta_exb\web_ui_new`

本文件只做盤點與建議，尚未刪除任何檔案。

## 目前重量概覽

| 路徑 | 類型 | 約略大小 | 判斷 |
| --- | --- | ---: | --- |
| `node_modules/` | 依賴安裝資料夾 | 432.86 MB | 可重裝，最適合清理 |
| `.tmp/` | 暫存資料夾 | 83.61 MB | 可清理，但其中有 GLB 原始備份 |
| `.git/` | Git 歷史 | 58.12 MB | 不建議直接刪 |
| `dist/` | Vite 打包輸出 | 29.89 MB | 可重建，適合清理 |
| `funny.glb` | 3D 模型 | 8.51 MB | 程式有引用，先保留 |
| `noob.glb` | 3D 模型 | 8.50 MB | 程式有引用，先保留 |
| `professional.glb` | 3D 模型 | 8.25 MB | 程式有引用，先保留 |
| `server/app.db` | 本機 SQLite 資料庫 | 約 1.33 MB | 需確認是否為測試資料 |

## 建議可清理項目

以下項目屬於低風險，因為它們是可重裝、可重建，或已在 `.gitignore` 中設定忽略。

| 路徑 | 約略大小 | 為什麼可清理 | 如何還原 |
| --- | ---: | --- | --- |
| `node_modules/` | 432.86 MB | npm/bun 安裝出的依賴，不應作為專案原始碼保存。 | 執行 `bun install`；若改用 npm，則執行 `npm install`。 |
| `dist/` | 29.89 MB | Vite build 產物，裡面包含已打包 JS/CSS 和重複的 `.glb` 模型。 | 執行 `bun run build` 或 `npm run build`。 |
| `.tmp/` | 83.61 MB | 暫存資料夾，已被 `.gitignore` 忽略；目前主要是 `glb-original/` 原始模型備份。 | 只有需要原始未壓縮模型時才手動備份或還原。 |
| `node_modules/.vite/` | 包含在 `node_modules/` 內 | Vite 開發快取，可由 dev server 自動重建。 | 重新啟動開發伺服器即可。 |

只清理以上三個主要資料夾，約可釋放 546 MB。

## 需要你確認後才清理

這些項目可能是功能資產、資料或版本歷史；我不建議在未確認用途前刪除。

| 路徑 | 約略大小 | 目前看到的證據 | 建議 |
| --- | ---: | --- | --- |
| `chair.glb` | 0.22 MB | 目前未在 `src/`、`server/`、`public/`、`scripts/` 找到直接引用。 | 可能可刪，但請先確認未來是否要用椅子模型。 |
| `server/app.db` | 約 1.33 MB | `server/db.js` 會讀取它；Git 顯示它是已追蹤且被修改的檔案。 | 若只是本機測試資料，可移出版本控制並重建；若有正式資料，請先備份。 |
| `funny.glb` | 8.51 MB | `src/app/modules/metaverse3d/agent/config.ts` 有引用。 | 不要刪，除非也移除對應 AI/NPC 模型功能。 |
| `noob.glb` | 8.50 MB | `src/app/modules/metaverse3d/agent/config.ts` 有引用。 | 不要刪，除非也移除對應 AI/NPC 模型功能。 |
| `professional.glb` | 8.25 MB | `src/app/modules/metaverse3d/agent/config.ts` 有引用。 | 不要刪，除非也移除對應 AI/NPC 模型功能。 |
| `flower.glb` | 0.38 MB | `src/app/modules/metaverse3d/components/StudioExhibitItem.tsx` 有引用。 | 不要刪，除非也移除展場花藝模型。 |
| `.git/` | 58.12 MB | Git 倉庫歷史，內含較大的歷史物件。 | 不要直接刪；若要瘦身 Git 歷史，需要另開專門清理流程。 |

## 文件與資料夾整理建議

目前同時有 `doc/`、`docs/`、`guidelines/` 三個文件相關資料夾：

| 路徑 | 用途推測 | 建議 |
| --- | --- | --- |
| `doc/` | 本次清理報告存放處 | 可保留，因為你指定要建立 `doc`。 |
| `docs/` | 既有優化方案與設計文件 | 先保留；若想統一文件位置，可之後把內容搬到 `doc/` 或反向整併。 |
| `guidelines/` | 專案規範 | 先保留。 |

## 目前不建議清理

- `src/`：前端原始碼。
- `server/`：JavaScript 後端原始碼。
- `public/`：公開靜態資源。
- `package.json`、`bun.lock`、`vite.config.ts`、`index.html`：建置與啟動專案需要。
- `.env.example`：環境變數範例，應保留。
- `.env`：本機私密設定，不應提交；可保留在本機，但不要分享。

## 建議執行順序

1. 先刪 `dist/` 和 `.tmp/`，通常不影響原始碼。
2. 如果短期不需要立即開發或啟動專案，再刪 `node_modules/`。
3. 之後需要啟動時，執行 `bun install`，再執行 `bun run dev` 或 `bun run build`。
4. 單獨確認 `chair.glb` 是否已不用。
5. 單獨確認 `server/app.db` 是否只是本機測試資料。

## 後續可選清理方向

- 檢查 `package.json` 內是否有未使用依賴。這需要跑完整建置與頁面測試，不能只靠檔名判斷。
- 優化 GLB 模型大小。根目錄的三個 agent 模型合計約 25 MB，若要保留功能，可改成壓縮模型或延遲載入。
- 清理 Git 歷史中的大檔。這會影響版本歷史與協作方式，必須先確認是否可以改寫 Git history。
