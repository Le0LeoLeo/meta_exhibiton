# 門框端面重疊修正

完成：2026-09-05，已部署香港正式站。

- 上一版門框內側與牆體門洞端面共面，造成近距離斜紋／深度爭用。
- 門框向門洞內包覆 8mm，門頂同步包覆；直框頂部與橫框底部對接，避免兩段門框自身交疊。
- 淨視覺寬度比設定值少 16mm、淨高少 8mm；不改展覽資料及人物碰撞演算法。
- 本機真實 Room 近距離、兩側、門頂／直框接縫截圖驗證無斜紋；16 項相關測試、ESLint、正式 build、bundle budget 通過。
- Release `.tmp/hk-door-reveal-release-20260905.tar.gz`：216 白名單檔，SHA256 `90c413fe69f50437f56b3007ad8f0003d992bbc74fc40507694794aaa93dbdfa`。
- 遠端 `/home/admin/meta-exb-hk-door-reveal-20260905`；archive 及全 manifest 驗證通過；非 dist 檔案比對正式 source 一致，只更新 frontend。
- Web image `sha256:73f9576627dcf6e03b25e0625b4eebc59f5e513bbbddb5d7c8a75830be3510cd`。
- 舊 dist `dist.pre-door-reveal-20260905` 及 image tag `pre-door-reveal-20260905` 保留；app image 與 env hash 一致，runtime、uploads、憑證及 volumes 保留。
- 首頁 200、ready、可信 TLS、www 301、只公開 80/443 驗證正常。沒有 commit 或 push。
