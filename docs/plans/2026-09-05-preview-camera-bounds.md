# 作品觀看相機邊界修正

完成時間：2026-09-05 11:48 HKT。已部署至 https://metaexb.com/demo。

## 修改

- `GalleryScenePreview.tsx` 在 OrbitControls 更新後、畫面繪製前限制相機及平移目標，涵蓋阻尼與觸控操作。
- `previewCameraBounds.ts` 依實際房間座標及牆厚計算室內範圍，限制牆壁、地板及天花板邊界；保留近裁切面的安全距離。多房間使用各自範圍，避免把房間之間的室外空隙當成室內。
- 示範展與快速建展共用預覽均套用；作品切換與原本正常對焦位置保留。
- Sub-agent 獨立核對房間中心、牆厚、地板及天花板幾何，主 agent 實作及整合驗證。

## 驗證

- 新增 3 項相機測試：極端相機位置與近裁切面四角、正常對焦不變、偏移及分離房間。
- 聚焦測試 3 檔 10 項通過。
- `npm run check`：227 檔、1,850 項通過；1 項未配置 Redis 的整合測試跳過。型別、lint、server syntax、avatar、build 及 bundle budget 通過。
- 本機及正式站瀏覽器實測極端旋轉、縮放及切換作品。畫面保持室內，切換作品回到正確對焦。

## 香港部署

- 白名單包：`.tmp/hk-camera-release-20260905-r1.tar.gz`；203 個 manifest 檔案、232 個 archive entries，禁止路徑 0。
- SHA256：`302785545a01d5ee53d07c0ef8807451738b10148de4b317f87744bc1b53d5bc`。
- 遠端 release：`/home/admin/meta-exb-hk-camera-20260905-r1`。
- 更新現有 `meta-exb-hk-production`；非 dist manifest 與上一版完全一致。本輪不涉及 auth、資料或網路行為，使用既有部署程序直接更新前端。
- Web image：`sha256:68d9859e8b6c39173e801bd3fb2e3c51b2aefaf31bd7511a6cb692ff0a326533`。
- App image 保持 `sha256:fcbec392bf8b0aaff1ff79607b9350aa0f16c9863206136ef8a64a62c08a667c`。
- 舊 dist 保存為 `dist.pre-camera-20260905`，舊映像保存 `pre-camera-20260905` tag；正式 env 雜湊前後一致，資料及 volumes 保留。
- 正式站首頁 HTTP 200、ready 正常、可信 TLS、www 301 保留 `/demo` 路徑；app/web healthy。網站只公開 80/443。
- 無本輪合成帳戶或資料；未 commit 或 push。
