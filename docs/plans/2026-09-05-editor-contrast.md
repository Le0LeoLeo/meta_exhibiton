# 編輯介面對比改善

完成：2026-09-05 17:45 HKT；已部署香港正式站。

- 編輯器共用面板由白色 20% 透明底改為 slate-900 / 95%，區塊使用實色 slate-800，輸入框使用 slate-950。
- 按鈕增加可見邊界、hover、停用狀態；編輯器按鈕與摺疊標題增加鍵盤焦點提示。
- 移除左側工具列及模型庫與共用面板衝突的背景樣式；保留原有操作、佈局與紫色主要操作。
- 本機真實 EditUI 於白／黑背景驗證，模型庫、更多工具可展開。正式站於既有白牆展覽的新分頁只讀檢查並截圖確認，沒有編輯或按儲存。
- typecheck、三個變更檔 ESLint、35 項 PaintingInspector／香港部署測試、正式 build、bundle budget 通過。

## 部署紀錄

- Release：`.tmp/hk-editor-contrast-release-20260905.tar.gz`，216 個白名單檔案；SHA256 `343cf72f7325cd43d2735153b2d2d0e1bab22c561dd5ff24301d23b748cad1b6`，遠端 archive 與全部 manifest hashes 驗證通過。
- 遠端：`/home/admin/meta-exb-hk-editor-contrast-20260905`。
- 非 dist 檔案與正式 source 全數比對一致；只替換前端並重建 web。
- Web image：`sha256:9c746c7b44f32d747e4e713c6eb21e0b8fac44c6ee059b9e6a3c1110d35b430e`。
- 舊前端：`/home/admin/meta-exb-hk-production-20260904/source/dist.pre-editor-contrast-20260905`；舊 image tag：`meta-exb-hk-production-web:pre-editor-contrast-20260905`。
- app image 與 env hash 保持一致，runtime、uploads、Caddy volumes 未變更。首頁 200、ready 正常、可信 TLS、www 301 保留路徑；網站僅公開 80/443，app healthy。
- 沒有 commit 或 push；保留所有既有工作樹修改。
