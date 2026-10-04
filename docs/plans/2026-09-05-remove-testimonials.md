# 移除虛構客戶好評

完成：2026-09-05 18:11 HKT，已部署香港正式站。

- 首頁移除 Testimonials 區塊及元件，清除繁中、簡中、英文共 33 個好評翻譯項目（姓名、職稱、評語與標題）。
- 41 項翻譯目錄／香港部署測試、typecheck、香港正式 build 通過；src 與新 dist 搜尋 testimonials、TechCorp、陳雅婷均無結果。
- Chrome 正式站完整首頁 DOM 確認不再出現好評區塊。
- 白名單 release 217 檔，archive SHA256：1a2be1f4002f4c46ca305553eee13945640634e1aec6f9add74232cf3f66052d。
- 遠端 release：/home/admin/meta-exb-hk-no-testimonials-20260905。Archive／manifest hashes 驗證通過，非 dist 檔案與 production 一致。
- 僅更新既有 production source/dist 並重建 web；web image：sha256:f8ac99224cbfc5f693127cdf2a86bbcbc4bcdb271fca193340d8762199beafdd。
- 保留 dist.pre-no-testimonials-20260905 與 image tag pre-no-testimonials-20260905 作回復用。
- App image 與 env hash 未變；資料、uploads、Caddy volumes 保留。無合成資料、無 commit/push。
- 公開 HTTPS 200、TLS verification 0、api/ready 正常、www 301 保留路徑；網站只公開 80/443，app healthy。
