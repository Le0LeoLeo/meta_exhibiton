# 展覽光影優化

2026-09-05，香港時間約 17:36。已部署至 https://metaexb.com。

## 修改

- 展廳與免登入預覽共用 GalleryLighting / GalleryArtworkLighting。預覽加入 PCF 陰影，以方向光、半球補光、面光和受控環境反射取代過強均勻補光；正式 Canvas 以 percentage 設定維持 PCF，陰影半徑 2。
- 初始化面光所需 LTC 資料，使用既有 three-stdlib 分包，避免直接從 three/examples 引入造成主 Three.js chunk 超出 800 KiB 限制。
- 作品射燈對準實際高度，光源相對作品提高 2.1 公尺；擴大柔邊光束、減少黃色偏色，調整強度。作品圖片的原有 meshBasicMaterial 未變更。
- 射燈依觀看相機位置挑選作品，每移動至少 2 公尺才重新排序；保留 quality 4、balanced 2、performance 0 的光源上限。
- 保留工作期間現有的 performance 模式補光修正（ambient 1.2 / hemisphere 0.8）與其他未提交修改；未 commit/push。

## 驗證

- 五個相關測試檔共 44 項通過，涵蓋作品高度、離開入口後的照明選擇、效能上限、相機邊界與部署白名單。
- TypeScript、修改元件 ESLint、香港正式 build、全部 bundle budget 通過；最大 JS 707.7 KiB，總 JS 3399.7 KiB。
- 本機示範展實際檢查作品與牆面畫面、作品切換；正式站確認第二件作品切換成功，瀏覽器未見 warning/error。
- 首頁 200、ready 成功、TLS 驗證 0、www /demo 301 保留路徑。公開 DemoExhibition-VgzDlvIZ.js 與驗證建置 SHA256 一致：0ba3171b91d10963751b0786e20571df587c0e7483380f0e24ae783127bf95f2。
- 未重跑整個專案測試，未使用個人正式展覽資料或進行實機手機效能量測。

## 香港部署

- 最終建置 `.tmp/hk-lighting-build-20260905-r2/dist`；release `.tmp/hk-lighting-release-20260905.tar.gz`，216 個白名單檔案、245 個 archive entries，無禁止路徑。
- Archive SHA256：75f573f3de96c4ed433aa094b31d48ddf8d20d75661f5558169bca30d6fb4093。
- 遠端 `/home/admin/meta-exb-hk-lighting-20260905`；manifest 全部核對，非 dist 檔案與正式來源逐一雜湊一致，只更新既有 production dist 及 web 映像。
- Web image：sha256:85aa262a7be29ec6582e1e1d08bfd4ed970f061eec91910205d4f5adfbc4f3b0。
- App 維持 sha256:4bdbe56b7d60386063d2cffab3fb2d359c69f23c35cda12560ab3bd7e5ce3360，healthy；env 雜湊不變。
- 保留 `dist.pre-lighting-20260905`、web image tag `pre-lighting-20260905`，保留資料、uploads、憑證及 volumes。網站僅公開 80/443，未產生合成帳戶或資料。
