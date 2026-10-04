# 模板展覽返回編輯修正

2026-09-07，已部署香港正式站。

- 原因：觀展模式隱藏 EditUI 後沒有返回編輯入口；開啟模板展覽又會沿用先前的 studio mode。
- VirtualGalleryCreate 載入可編輯的展覽、編輯分享或新場景時明確進入 edit；手機及唯讀連結仍進入 view。
- 擁有者、編輯分享及新場景預覽提供「返回編輯器」，在導覽方式選擇遮罩上亦可使用。返回只切換模式，不重新讀取或覆寫場景。
- 唯讀分享、share=view、手機、載入失敗或阻止持久化的房間錯誤不提供返回入口。

## 驗證

- TypeScript 與本次兩個修改檔案 ESLint 通過。
- VirtualGalleryCreate、VirtualGalleryEntry：32 項測試通過，新增模板載入模式、預覽返回保留修改、編輯／唯讀分享及 owner 唯讀連結回歸測試。
- MetaverseStudioApp、MetaverseStudioApp.view、香港部署規則：40 項測試通過。
- 瀏覽器使用暫時的本機頁面載入真實 VirtualGalleryCreate 與 3D 編輯器；從編輯進入觀展後，在導覽方式選擇前及確定自由觀展後均成功按返回並恢復工具列。暫時測試頁面已刪除，未打包進正式版。
- 模板資料及擁有者流程由組件測試驗證；正式站沒有新增測試帳號或修改展覽資料。
- 香港專用 Vite build 通過，沿用正式站公開 Google client ID。Bundle budget 全部通過：JS 3417.8 KiB、CSS 201.9 KiB。
- 正式站虛擬展廳模板入口瀏覽器載入正常；首頁、入口 JS/CSS 與 VirtualGalleryCreate JS 經公開 HTTPS 下載，SHA256 與本機 release 一致。
- 首頁 HTTPS 200、TLS 驗證 0、/api/ready ready、www 301 保留路徑；app healthy，網站僅公開 80/443。

## 部署與回復

- 白名單 release：`.tmp/hk-template-return-release-20260907.tar.gz`，222 個檔案。
- Archive SHA256：`b0cfd9ade6205a1c5cedbe2d3720968f0b5714bdc50ffd22f3e6c5a3ac19bb07`。
- 遠端 release：`/home/admin/meta-exb-hk-template-return-20260907`，全部 manifest hashes 驗證通過。所有非 dist 執行檔與正式站一致；既有 EMAIL_VERIFICATION.md 文件排除比較，沒有覆寫。
- 只更新既有 production source/dist 並重建 web。
- 新 web image：`sha256:11b4953abd172d7e377a4bc12868da91c122a6d09bcdd7de80741464df5731c8`。
- 回復 dist：`/home/admin/meta-exb-hk-production-20260904/source/dist.pre-template-return-20260907`。
- 回復 image tag：`meta-exb-hk-production-web:pre-template-return-20260907`。
- App image 保持 `sha256:4bdbe56b7d60386063d2cffab3fb2d359c69f23c35cda12560ab3bd7e5ce3360`；正式 env hash 未變，runtime、uploads、憑證及備份保留。
- 保留原有 dirty worktree，未 commit 或 push。
