# 展間入口改善

完成：2026-09-05 18:01 HKT；香港正式站驗證完成。

## 行為

- 入口不再是全高狹縫：共用牆體拓撲現在輸出門洞資料，生成 2.6 米淨高的門楣；低天花不生成負高度牆體。
- 使用低反光暖灰金屬門框，框深跨越牆厚，兩側均可見；保留淨通行寬度，門口地面飾條不參與碰撞。踢腳線與垂直接縫不生成在高處門楣。
- 新展間及預設場景入口寬 1.8 米；平面圖「標準／寬」預設為 1.8／2.4 米。既有展覽保存的門寬仍尊重原設定，不修改正式展覽資料。
- 偏移限制在共用牆面內，避免門洞遭裁切；重疊開口合併後才建立門框和門楣。
- Player 改用 Room 的相同牆體拓撲、門寬、偏移及中心座標，移除固定 1.8 米碰撞缺口的重複演算法；高於人物頭部的門楣不阻擋行走。
- 平面圖門口標記修正重複中心平移。

## 驗證

- 63 項相關測試通過，包括 12 項新測試：四向連接、門高、預設／既有門寬、極端偏移、短共用牆、低天花、獨立房間、合併開口、移位原點下雙向通行與牆側阻擋。
- typecheck、變更檔 ESLint、正式 build、bundle budget 通過。
- 本機真實 Room 於兩側驗證 1.8 米及既有 1.2 米入口畫面。
- 本機真實 Player 透過其 input ref 驅動，在偏移原點場景中穿過偏移 1.5 米、淨寬 1.2 米的門口並返回；可見測試結果為通過。未使用假碰撞替代 Player。
- 公開觀展頁 `/exhibitions/4de16416-ad2f-4a4a-9ebb-fb72a4a5f567` 載入正常，未編輯展覽。

## 部署

- 白名單 release 216 檔：`.tmp/hk-entrance-release-20260905.tar.gz`。
- SHA256：`99cfd45bedf9966735f2f746f86d29c6ac1309e1e047b54486ccb6156e3b43f4`；遠端 archive 及 manifest 全數驗證。
- 遠端 release：`/home/admin/meta-exb-hk-entrance-20260905`。所有非 dist 檔案與正式 source 比對一致，只更新 frontend。
- Source backup：`/home/admin/meta-exb-hk-production-20260904/source/dist.pre-entrance-20260905`；image backup tag `meta-exb-hk-production-web:pre-entrance-20260905`。
- 新 build image `sha256:85b64dcc8461cf0229844f6ed04e7960e53816e781f528aad8a632c5082a40cb`；Compose 保留已運行 image `sha256:172db1a1a99c886cb4ad2cb0642b26bd685480415923a930c22ab8a54019e127`。兩者全部 RootFS layers 核對相同，public/source/local index SHA256 同為 `406e388ea2cccd367b61b404fff515b4ef25b1b86dfb672aaf2c7dc835cca746`。
- app image／env hash 保持一致；資料、uploads、憑證及 volumes 保留。
- 首頁 200、ready 正常、受信任 TLS、www 301 保留路徑；網站僅公開 80/443，app healthy。
- 保留既有 dirty tree；沒有 commit 或 push。
