# 編輯模式自動貼牆

完成：2026-09-05 18:55 HKT，已部署香港正式站。

- 單件画作、文字板、燈條以移動控制器拖放後，依實際 floor-plan 牆段／隔牆兩面選取最近可容納展品的表面，自動轉正；不再受原 1.5m 門檻限制。
- 使用牆厚、展品背面厚度及縮放計算貼牆間距；避免落在門洞或過小的牆段。新增預覽、初始位置及自動頂燈間距同步修正。
- 保留旋轉、縮放、群組平移及落地物件既有操作；不自動搬動已保存的場景。文字的邊界判斷沿用標準尺寸估計，未逐字量測長文字。
- 72 項相關測試（牆面 helper、展品、floor-plan、EditUI、部署 whitelist）通過；typecheck、修改檔 ESLint、香港 build、bundle budget 通過。
- 本機隔離頁使用真正 Room／ExhibitItem／TransformControls，文字板由中央拖曳後落在右牆 `[5.815, 2, 0]`，朝向 `-π/2`，DOM 狀態已確認；未操作正式用戶展覽。
- Release `.tmp/hk-wall-placement-release-20260905.tar.gz`：221 白名單檔、250 archive entries，禁止檔案 0；SHA256 `63745e57185fee8d57459d34a44cdb9ca8412ac4f8c961079e694caaf7309bbf`。
- 遠端 `/home/admin/meta-exb-hk-wall-placement-20260905`。全 manifest 校驗、非 dist 檔案與正式 source 比對通過；只更新 frontend。
- Web image `sha256:8db25b8a9a5d9b21349f45e37bffed7e01d96ffc4fb64c123ad8d2eaede5f59e`；app image、env hash 及資料 volumes 未變。保留 `dist.pre-wall-placement-20260905` 及 `pre-wall-placement-20260905` web image tag。
- 公開首頁及 EditCanvas／EditUI／ExhibitItem／Room／wallPlacement 檔案逐位元符合 manifest；首頁 200、ready、可信 TLS、www/demo 301、app healthy、web running，網站只公開 80／443。正式首頁瀏覽器載入確認。沒有 commit／push 或新增正式資料。
