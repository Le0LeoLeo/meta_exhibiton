# User Test Fixes Implementation Plan

**Goal:** 修正用戶測試中可處理的四項問題並部署香港正式站。

**Architecture:** 依實際房間及物件碰撞選擇參觀位置，保留既有 store/action 分工；入口修改沿用既有頁面與三語翻譯。SMTP 尚未設定，用戶已指定先完成其他修正，密碼恢復留待寄信服務備妥。

**Tech Stack:** React、Three.js、Zustand、Vitest、Vite、香港 Docker/Caddy。

1. 新增 `src/app/modules/metaverse3d/player/visitorSpawn.ts` 與測試，涵蓋 8m 房间、偏移平面及障礙物；Player 進場採用安全位置，公開展覽提供回到入口按鈕。
2. 修改 `VirtualGallery.tsx` 已登入 CTA；`QuickExhibitionCreate.tsx` 提供桌面進階編輯指引；`Resources.tsx` 指向 FAQ。三語同步調整圖片建展文案。
3. 執行相關測試、typecheck、lint、香港 build 與 bundle 檢查；瀏覽器複測。
4. 僅部署白名單 release；確認正式服務、TLS、www redirect、公開端口與實際 3D 進場。

不 commit 或 push；保留既有工作目錄與 production 資料。

## 完成與驗收（2026-09-05 18:45 HKT）

- 原展览 8×8m，舊隨機位置 z=3–7m，可能在南牆外。改按實際房間中心、牆厚及物件碰撞挑選進場位置並朝向作品；公開頁加入「回到入口」。桌面與 390×844 本機及公開站均確認作品可見。
- 已登入虛擬展廳 CTA 改為圖片建展；正式站查驗註冊連結為 0、圖片建展連結為 2。
- 圖片建展入口加入影片／PDF／文件的進階編輯指引，手機提示需要電腦；保留既有已交由編輯器管理草稿的錯誤恢復流程。
- 資源頁如實說明人工客服尚未提供，按鈕改為搜尋常見問題，導向 `/support#faq-section`。
- 用戶明確決定尚無 SMTP，先完成其餘修正；密碼恢復仍未啟用，沒有修改 authentication 或 production secrets。
- 主要回歸測試 71/71 通過；額外碰撞／平面編輯及翻譯測試通過；typecheck、本次檔案 ESLint、153 個 server syntax checks 通過。
- 正式 build 通過；JS 3399.1 KiB，CSS 201.5 KiB，bundle budget 通過。
- 同一工作目錄另有進行中的 FloorPlan UI 修改，最初 typecheck 發現介面不同步，之後原檔案更新後 typecheck 恢復通過；本次沒有更改該 UI 檔案，保留更新並執行其現有測試。

## 香港部署記錄

- 220 檔白名單 release；archive `.tmp/hk-user-fixes-release-20260905.tar.gz`，SHA256 `f2be8be7be420091cff24e7599cc19001fd0f2f75ef2aa248f9f1d211f47ee6e`。
- 遠端 release `/home/admin/meta-exb-hk-user-fixes-20260905`；archive 與所有 manifest hashes 驗證通過。非 dist 檔案與 production 一致。
- 只替換既有 production dist 並重建 web；保留 `.env.hongkong` 雜湊、app image 與所有資料／憑證 volumes。
- Web image `sha256:042263d3fb27bb5a34a605fd5faa05255acfa31267fff29200257893338f10f0`。
- App image `sha256:4bdbe56b7d60386063d2cffab3fb2d359c69f23c35cda12560ab3bd7e5ce3360`，healthy。
- 回復用目錄 `/home/admin/meta-exb-hk-production-20260904/source/dist.pre-user-fixes-20260905`，前一 image tag `meta-exb-hk-production-web:pre-user-fixes-20260905`。
- HTTPS 200、TLS verification 0、ready 正常、www `/demo` 301 保留路徑；網站只公開 80/443，app 未公開端口。
- 正式站桌面／手機尺寸截圖：`docs/qa/2026-09-05-user-test/fixed-public-3d-desktop.png`、`fixed-public-3d-mobile.png`。未修改正式展覽或建立合成帳號。
