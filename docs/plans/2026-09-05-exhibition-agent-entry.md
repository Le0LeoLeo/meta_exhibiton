# 展覽活動入口 Agent 選擇修復

完成：2026-09-05 17:57 HKT；已部署香港正式站。

- 原因：公開觀展頁切換至 view 時沿用全域 hasSelectedParticipationMode，前一場已選過模式後再次進入會跳過選擇。
- ExhibitionView 每個掛載／不同展覽首次準備 3D 時重設選擇並暫停 pointer lock；同一場 2D／3D 切換與一般更新保留選擇，場景快取不受影響。
- 55 項 ExhibitionView、MetaverseStudioApp.view、AgentModeSelector、香港部署測試通過；typecheck、變更檔 ESLint、正式 build 與 bundle budget 通過。
- 正式站 Chrome 實測：活動卡片 → 進入展覽 → 選個人參展 → 離開 → 同一卡片再次進入，均顯示觀展模式選擇。AI 智慧伴展可展開小白／專家／幽默，截圖確認完整可見。

## 部署

- 白名單 release：`.tmp/hk-agent-entry-release-20260905.tar.gz`，216 檔；SHA256 `79cf22cf5f7ad6b62fd9633240f6520c6cbaf34c586c37317cc7216c1cdde9f8`。
- 遠端：`/home/admin/meta-exb-hk-agent-entry-20260905`。Archive 與全部 manifest hashes 通過；所有非 dist 檔案與 production 一致。
- 只更新既有 production source/dist 並重建 web；web image `sha256:172db1a1a99c886cb4ad2cb0642b26bd685480415923a930c22ab8a54019e127`。
- 舊 dist：`/home/admin/meta-exb-hk-production-20260904/source/dist.pre-agent-entry-20260905`；舊 image tag：`meta-exb-hk-production-web:pre-agent-entry-20260905`。
- App image 保持 `sha256:4bdbe56b7d60386063d2cffab3fb2d359c69f23c35cda12560ab3bd7e5ce3360`，app healthy；env hash 檢查一致；runtime、uploads、Caddy volumes 保留。
- HTTPS 首頁 200、TLS verification 0、/api/ready 正常、www 301 至 apex 並保留路徑；網站僅公開 80/443，無 5176/3001/Docker API listener。
- 沒有建立合成帳號或修改展覽資料；未 commit／push，保留既有工作樹修改。
