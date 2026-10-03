# 平面圖模式 UI 優化

完成：2026-09-05 18:47 HKT；已部署香港正式站。

- 將左側長工具面板改為頂部工具列，集中房間／牆線切換、復原、重做、複製、新增、同步與套用返回 3D。
- 右側切換空間設定與元素屬性，同時只開一個面板；可關閉，Esc 恢復焦點且保留選取。選取不同元素後顯示屬性並回到面板頂部。
- 沿用 Edit 的深色面板、字體、表單、焦點提示、停用狀態和減少動畫設定；平面圖樣式限於 floorplan-shell。
- 屬性面板由頂部實際高度定位；可捲動且保持在視窗內。修正狀態卡片、房間保護提示的對比，隱藏技術 ID，簡化對齊按鈕排列。
- 尺寸滑桿／數字欄位補上可及名稱與單位，伸長／縮短按鈕提供選取狀態。保留預設房間的刪除保護和原有幾何操作。

## 驗證

- FloorPlanUI、floorPlanGeometry、香港部署測試共 49 項通過；其中 UI 6 項包含面板切換、Esc 焦點、房間保護、牆線複製及尺寸修改／復原。最後的選取面板重置修改後，UI 6 項再通過。
- typecheck、本次修改檔案 ESLint、香港正式 build 及 bundle budget 通過。JS 3399.1 KiB、CSS 201.5 KiB。
- 本機真實 FloorPlanScene + FloorPlanUI 驗證：尺寸輸入、復原、門位置滑桿、房間／牆線切換、新增牆線、Esc 收合及選取後捲動重置。
- 375×812、768×640、1024×480、1440×900 無頁面橫向溢出；面板均在頂部工具列下方，底部保留 12px，可捲動。
- 正式首頁載入新版；公開 FloorPlanUI CSS／JS 及共用編輯器 CSS 的 SHA256 與驗證 release 一致。屬性互動於本機驗證，沒有修改正式展覽資料。

## 香港部署

- Archive：`.tmp/hk-floorplan-ui-final-release-20260905.tar.gz`，220 白名單檔案。
- SHA256：`f67692d6b877383ef233d8aa4d65c3244f16b438309a13292b58c8db64d735cc`。
- 遠端 release：`/home/admin/meta-exb-hk-floorplan-ui-20260905`；archive 與全部 manifest hashes 通過，非 dist 檔案與 production 一致。
- 只更新既有 production source/dist 並重建 web。Web image：`sha256:8887c1dee9ae36bf33527ed04fd33ec96ded2b711a86468ba409c465016015a2`。
- 回復用 dist：`/home/admin/meta-exb-hk-production-20260904/source/dist.pre-floorplan-ui-20260905`；image tag：`meta-exb-hk-production-web:pre-floorplan-ui-20260905`。
- App image 保持 `sha256:4bdbe56b7d60386063d2cffab3fb2d359c69f23c35cda12560ab3bd7e5ce3360`；env hash、runtime、uploads、Caddy volumes 保留，建置保留正式 Google 公開 client ID。
- HTTPS 200、TLS verification 0、ready 正常、www 301 保留路徑；網站僅公開 80/443，app healthy。
- 保留同工作目錄已驗證的 user-test-fixes 修改，未 commit／push，未建立正式合成資料。
