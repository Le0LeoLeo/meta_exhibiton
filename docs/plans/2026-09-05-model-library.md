# 模型庫 17 款模型優化

完成：2026-09-05 19:02 HKT，已部署香港正式站。

- 燈條降低低效能模式光暈成本，保留貼牆尺寸；花藝支援花瓣改色並保留綠色枝幹；吊燈增加固定座；長椅增加靠背支撐；地毯增加邊飾；花瓶增加底足。
- 雕塑增加支柱，投射燈統一燈體、燈面、光束方向並降低光束不透明度；盆栽改為泥土、枝幹及九片葉片；立柱改為收分柱身；霓虹牌改為雙燈管。
- 單椅與沙發使用較簡單的標準布料材質，沙發補四腳；座地燈改為截錐燈罩，降低燈罩自發光；展示櫃改為有背板、側板與層板的空心結構及四腳。
- 唱盤修正唱片、標籤與唱臂方向，增加唱片溝槽；噴泉增加池沿、取消水面 transmission 額外渲染成本，修正水流及漣漪初始可見狀態。
- 程式模型的圓角在 performance 模式由兩段降為一段。沿用場景位置、旋轉、縮放與既有互動 store。未引入新資產或套件；未進行 FPS 基準測試。

## 驗證

- TypeScript、本次三個修改檔案 ESLint 通過。
- 模型、互動、貼牆及香港 release 相關 66 項測試通過。
- 本機隔離頁 `.tmp/model-library-review.html` 使用真正 ExhibitItem，17 款全部顯示；檢查櫃門開關、唱盤與噴泉啟動，以及 balanced/performance 模式外形。開發熱更新曾產生僅屬隔離頁重複 createRoot 警告，重新載入後沒有新增警告。未修改正式用戶場景。
- 正式 build 及 bundle budget 通過：JS 3405.1 KiB、CSS 201.5 KiB；無新增 GLB。

## 部署

- Release：`.tmp/hk-model-library-release-20260905.tar.gz`，221 白名單檔案。
- SHA256：`6ca9726548aa6841c755f9427b3f112b432df997c05af7b1588b6c2f0142053d`。
- 遠端：`/home/admin/meta-exb-hk-model-library-20260905`。全部 manifest hashes 與非 dist 檔案和 production 比對通過，只更新 dist 並重建 web。
- Web image：`sha256:1e312e8fbcdb934544b3f732f760bf8fe4936303492a7bbd7e60f72ba01e8e90`。
- 保留 `dist.pre-model-library-20260905` 和 `pre-model-library-20260905` image tag。App image、正式 env hash、runtime data、uploads 及 Caddy volumes 保留。
- 公開首頁及 `ExhibitItem-DouTQjx2.js` SHA256 與 release 一致；首頁瀏覽器正常載入，HTTPS 200、TLS verification 0、ready 正常、www/demo 301 保留路徑；只有 80/443 公開，app healthy。
- 保留同工作目錄已部署的 wall-placement 修改，未 commit/push。
