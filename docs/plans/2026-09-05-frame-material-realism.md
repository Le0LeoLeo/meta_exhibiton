# 展品框材質改善

2026-09-05，香港時間約 15:32。

- 正式 `features/metaverse-studio/exhibits/ExhibitItem.tsx` 的純色整塊框改為四條有小倒角的框條；保留既有外框、圖片區域、圖片比例與互動位置。採用現有 frameStyle/frameColor 設定，木框有順框條方向的紋理，金屬與霧黑使用各自的 PBR 參數及微表面凹凸。
- 新增共用 `PaintingRailSurface.tsx`，只保留兩張 128×128 程序貼圖，啟用 mipmap；幾何在卸載時釋放。金屬降低漆層，木材與塗漆採非金屬表面。
- 舊 StudioExhibitItem 亦使用共用表面，並把會令 R3F applyProps 崩潰的 data-* 屬性改成 Three.js name/userData。其玻璃遮罩減淡；正式 ExhibitItem 本次未新增玻璃或修改框尺寸控制。

## 驗證

- 4 個相關測試檔共 27 項通過；TypeScript、修改檔案 ESLint、香港正式 build 及 bundle budget 通過。
- 本機臨時比較頁先驗證舊元件，再改用正式 ExhibitItem 核对六個材質選項、正面和側面、作品貼圖及選取高亮；沒有新增測試帳戶或正式資料。
- 第一包只修改了舊渲染元件，公開部署檢查發現正式 bundle 未變；修正正式渲染路徑後重新建置 R3。以 R3 下述 hash 為最終版本。
- 公開首頁 200、ready 成功、www 保留路徑 301、TLS 驗證 0。公開 ExhibitItem-D8_qqr77.js 與本機 build SHA256 一致：`6a6387ef59eb345b25e62efd4dc8ac057ecb617aa086f4dab292577ce88a50c6`。

## 部署

- Release `.tmp/hk-frame-release-20260905-r3.tar.gz`，216 個白名單檔案，SHA256 `769df1c8f7678553714d422a65099662bd3ad9da6b3273efaa392abb075320ae`。
- 遠端解壓 `/home/admin/meta-exb-hk-frame-20260905-r3`；與正式所有非 dist 檔案逐一 hash 比對一致後，只更新正式 dist 與 web 映像。
- web `sha256:a765e7acc163e071f6b16f76e5df805d60f882c9806a3363efd5f42173374ce3`。
- app 保留 `sha256:4bdbe56b7d60386063d2cffab3fb2d359c69f23c35cda12560ab3bd7e5ce3360`，healthy。環境檔 hash 不變，資料、uploads、憑證和 volumes 保留，網站僅公開 80/443。
- 備份 `dist.pre-frame-20260905-r3` 與 web image tag `pre-frame-20260905-r3` 保留。無 commit/push。

限制：畫框多角度驗證在本機使用正式元件完成；未登入正式使用者展覽編輯個人資料。未重跑完整專案測試。
