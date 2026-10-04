# 導覽 NPC 外觀更新

2026-09-05 14:05 HKT，已部署香港正式站。

- 以程式內建立的圓角展館機器人取代三個 GLB NPC：暖白外殼、深色表情螢幕、人格配色、展館胸章與底部光環。
- 新增眨眼、輕微轉頭、移動時擺臂及講解時抬手；保留 AgentNPC 的位置、朝向、對話氣泡及既有行為控制。
- 移除 visual config 的 GLB 引用及舊模型正規化／備援載入程式；原模型檔未刪除。
- 本機瀏覽器驗證三種配色、待機與講解姿態，無 console error。預覽為 `.tmp/guide-robot-preview.html`，未包含在發布包。
- `npm run check` 通過：239 個測試檔通過、1 檔跳過；1,930 項通過、1 Redis 整合測試因未配置跳過；server、avatar、typecheck、lint、build、bundle gates 通過。香港乾淨 build 通過。
- 僅更新正式 web：所有非 dist 發布檔案與現有正式檔案逐一雜湊比對一致，app image 及 env 雜湊前後一致，資料及憑證 volumes 保留。沒有 Git commit/push。
- 公開 HTTPS 首頁 200、ready 成功、新 AgentSystem-C_yqEMSz.js 200 並含新 NPC 標記、www 保留路徑 301；app healthy、網站僅公開 80/443。未登入正式用戶展館進行完整導覽驗收；空間碰撞行為不在本次修改範圍。

發布包 `.tmp/hk-npc-release-20260905.tar.gz`；SHA256 `c5ba88b1780a6863a56d3042a57d93d498c8dffa7fa2545e1bc7316d6e273cd7`。
遠端 `/home/admin/meta-exb-hk-npc-20260905`。
Web image `sha256:11f18079057fa0a06ba4a6ca3fd80f8687b2f0bb05f1afd412882f5a12a195be`。
App 保留 `sha256:9f98159f038ad7689caf3a0eec702a542c9744219ecd7d6154a9c52c5d8bce25`。
舊版保留 `dist.pre-npc-20260905` 及 image tag `pre-npc-20260905`。
