# 展覽 Agent 品質控制改善

2026-09-05：依專案分析後的確認，改善三項建展 Agent 行為。

- 多視角控制器不可用時拒絕拍攝，不再連拍同一 canvas 冒充不同視角。後端要求至少三個不同 view ID 和不同圖像，否則保存 `INVALID_INSPECTION_VIEWS` 並回傳審查不可用。
- 自動建展保存本輪較佳版本；退步、無明顯改善或後續審查不可用時，前端透過既有版本恢復 API 建立新版本，保留歷史和修訂次數。即使新報告標為 pass，也先檢查是否有實質退步。
- 審查 prompt 提供實際操作種類，將房間結構、門牆、作品媒體替換及缺少事實來源等問題標記為 manual。自動流程停止，報告優先顯示手動問題與建議。重複素材的本地檢查直接標記 manual；舊報告仍相容。

## 驗證

- `npm run check` 通過：239 檔、1,930 項測試；1 項 Redis 整合測試未配置而跳過。server syntax、avatar、typecheck、lint、build、bundle gates 通過。
- 最後報告呈現調整後，介面／三語 25 項測試、typecheck、lint 與香港乾淨 build 再通過。
- 香港隔離驗收通過：重複截圖拒絕、session 擁有者保護、重啟後審查拒絕紀錄持久化；既有登入／CSRF／媒體／多人／統計回歸通過。僅本輪合成帳戶與資料清理，staging 已停止。
- 2026-09-05 14:00 HKT 正式 HTTPS、ready、頁面、更新的 EditUI 資源、www 301、SQLite integrity 及只公開 80/443 均驗證。前後環境檔雜湊一致；既有 volumes 與資料保留。
- 測試涵蓋程式控制流程與模擬模型回覆，沒有實測真實 Qwen 視覺判讀品質。手動／自動問題分類仍依賴模型，並非完整幾何可解性證明。

## 發布

- 白名單包：`.tmp/hk-agent-quality-release-20260905-r1.tar.gz`，216 manifest files、245 archive entries、禁止路徑 0。
- SHA256：`9afbadade3645d20cb8f4c5fff9242c97f6b57d8c2c4d1930f04ed31697b0a33`。
- 遠端：`/home/admin/meta-exb-hk-agent-quality-20260905-r1`。
- app：`sha256:9f98159f038ad7689caf3a0eec702a542c9744219ecd7d6154a9c52c5d8bce25`。
- web：`sha256:bc7a7f1226801360d218bd22fcdab1d0a8dab2ec6b6a601e6338bd7e53f4404d`。
- 保留 `pre-agent-quality-20260905` 映像 tags 及 `dist.pre-agent-quality-20260905`；未 commit／push。
