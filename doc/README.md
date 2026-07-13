# 專案重構文檔入口

本目錄放置 React + Three.js 展覽專案的重構方案與執行對照文件。

建議閱讀順序：

1. `refactor-module-plan.md`：完整重構方案、目標架構、分階段計畫、驗證清單。
2. `module-boundary-map.md`：現有檔案到新功能模塊的映射表，適合執行搬遷時查閱。
3. `cleanup-candidates.md`：既有清理候選項。

重構原則：

- 先建立 facade 與公共 API，再逐步搬遷檔案。
- 每個功能模塊只透過 `index.ts` 暴露公共能力。
- React 頁面只負責路由、載入與頁面級狀態，不承擔 3D 場景內部規則。
- Three.js/R3F 場景、Zustand store、多人協作、AI 導覽、後端服務分別拆分。
- 每個階段完成後執行 `npm run check`。

## Public deployment security

- `server/app.db` and `server/uploads/` are runtime data. Do not commit them.
- Before deployment, inspect whether older Git history contains real user data.
  If it does, coordinate a history rewrite and rotate affected credentials.
- Back up the SQLite database and uploaded files outside the application
  directory.
- Use TLS and explicit HTTP/WebSocket origins in production.
- Set strong production secrets. Do not deploy values copied unchanged from
  `.env.example`.
- In-memory rate limits and multiplayer room state support one server process.
  Use shared storage before running multiple application instances.
