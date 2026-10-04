# 私人測試部署（沒有域名）

這套設定只提供 SSH 私人測試，不是公開網站，也不是繞過 ICP 備案的方法。
主機只綁定 `127.0.0.1:8443`；不要開放公網 80、443、8443、5176 或 3001。
本機與雲端測試資料分開，預設不啟用 AI、Google 登入或管理員功能。
測試帳號與訪客數據不得當作真實用戶增長數據。

## 前置条件

- 主機：Ubuntu 24.04 x86_64，Docker Engine **28 或更新版本**及 Compose v2。
- 經用戶同意配置的 SSH 存取；優先使用僅用於此主機的金鑰，不傳遞密碼。
- 主機可存取所需的 Ubuntu、npm、Node、Caddy 官方下載來源。
  內地網路可能無法下載 Docker Hub 映像；遇到阻塞須另行確認來源，不能任意替換不可信鏡像。
- 首次操作前以 `ss -ltn` 核對現有服務，保留既有防火牆規則。
- Docker 28 之前的 localhost port publishing 有同一 L2 網段可達的限制，不能作為這份設定的安全前提。

## 傳送與初始化

將本次驗證的完整原始碼放在伺服器獨立的部署目錄，例如 `/opt/meta-exb-private`。
傳送包須用明確白名單，只包括 `package.json`、`package-lock.json`、`index.html`、
`vite.config.ts`、`tsconfig.json`、`config/`、`src/`、`public/`、`server/`、`deploy/private/`、
`scripts/prepare-private-preview.mjs`、`.dockerignore`，以及前端直接匯入的根目錄模型
`noob.glb`、`professional.glb`、`funny.glb`、`flower.glb`。
即使位於白名單目錄內，也必須排除 `.env*`、`*.db*`、`server/uploads/`、金鑰、
`.git/`、`node_modules/` 和測試輸出；`.dockerignore` **只保護 Docker build，不保護傳送壓縮包**。
不要直接上傳整个工作目錄或从 GitHub 拉取尚未包含目前工作區修改的旧版本。

在專案根目錄生成測試設定（主機有 Node 時）：

```sh
node scripts/prepare-private-preview.mjs
```

若主機只有 Docker，可在驗證過的本機專案執行上面指令後，另行安全傳送 `.env.private`，
並在主機把該檔權限設為 `600`。不要將其加到來源壓縮包、Git 或聊天紀錄。
初始化第二次會拒絕覆寫；更新版本時沿用原檔，不要意外更換登入簽章密鑰。

## 啟動

在專案根目錄執行；未完成金鑰授權與傳送前不要聲稱已部署：

```sh
docker compose -f deploy/private/compose.yaml config --quiet
docker compose -f deploy/private/compose.yaml build
docker compose -f deploy/private/compose.yaml run --rm --no-deps web caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker compose -f deploy/private/compose.yaml up -d --wait
docker compose -f deploy/private/compose.yaml ps
```

Compose 使用固定專案名稱 `meta-exb-private`，請勿同時在不同目录启动相同名稱的部署。
若主機無法連到 Docker Hub，但可連 Amazon ECR Public，可使用 Docker 官方發布的
`public.ecr.aws/docker/library/node` 和 `public.ecr.aws/docker/library/caddy`。
先核對相同平台的映像 digest 與 Docker Hub 官方映像一致，再用
`build --build-arg NODE_IMAGE=完整來源@sha256:已核對digest --build-arg CADDY_IMAGE=完整來源@sha256:已核對digest`
取代一般的 `build` 指令；不要改用來歷不明的鏡像。Dockerfile 使用內建 frontend，
不會額外向 Docker Hub 下載語法 frontend。
Dockerfile 會以相同 Linux 基底及內建 Node headers 重新編譯 SQLite，並驗證模組能載入，
避免預建二進位要求較新的 GLIBC。Caddy 則會移除不必要的低端口執行檔 capability，
讓 8443 網關在 `cap_drop: ALL` 下正常啟動；不要以放寬容器權限代替這項修正。
若 Debian 官方站跨境下載過慢，阿里雲主機可另外指定
`--build-arg DEBIAN_MIRROR=mirrors.aliyun.com`，使用
[阿里雲 Debian 套件鏡像](https://developer.aliyun.com/mirror/debian)。
仍保留 HTTPS 驗證、Debian 官方簽章與套件雜湊驗證；不能添加 `trusted=yes` 或停用驗證。
檢查 Docker 發布端口只有 `127.0.0.1:8443`，並從另一台電腦確認主機公網 IP 的
8443、5176、3001 皆不可連線。後端只有容器內部端口，不會直接發布。

## 在你的電腦開啟

完成 SSH 金鑰授權及主機指紋核對後，在你自己的電腦保持這條連線：

```sh
ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:8443:127.0.0.1:8443 admin@120.79.240.7
```

需要專用金鑰時添加 `-i` 和實際金鑰路徑。不要停用 SSH 主機指紋驗證。
這裏的 IP 是本次用戶指定的深圳主機，不是通用模板預設值。

開啟 `https://localhost:8443`（不要換成 `127.0.0.1`，否則與設定的來源不同）。
HTTPS 由測試專用的本地 CA 簽發；瀏覽器起初不信任它是預期行為。
可以先安全匯出**公開根證書**：

```sh
docker compose -f deploy/private/compose.yaml cp web:/data/caddy/pki/authorities/local/root.crt ./private-preview-root.crt
```

透過已驗證的 SSH 通道取得證書並比對指紋，經用戶確認後才可在其電腦信任。
不要匯出 CA 私鑰、全域停用瀏覽器安全檢查，或自動安裝信任根證書。
只做暫時測試時，可在確認 SSH 通道及證書來源後使用瀏覽器針對該 localhost 網站的單站例外。

## 必須完成的驗收

1. 使用取得的 CA 證書驗證 `https://localhost:8443/api/ready` 回傳 `200`。
2. 進入巢狀路由並重新整理，不能出現 404。
3. 新建測試帳號、登入、登出，再登入；確認安全 Cookie 與 CSRF 流程正常。
4. 上傳一张不含個資的測試圖片，建立展覽，再用另一個測試帳號驗證存取權限。
5. 兩個瀏覽器視窗連到相同展覽，驗證 WebSocket 與多人同步。
6. 執行 `docker compose -f deploy/private/compose.yaml restart` 後，帳號、展覽、圖片仍存在。
7. 暫時關閉 SSH 通道後，網站不可從本機使用；公網 IP 也不能開啟它。

AI 尚未配置會顯示相關功能不可用；不應把這視為已完成 AI 上線。
Google、外部圖片、字體及 3D 資源在內地的可達性需另做實機測試。

## 持久化、備份與停止

- SQLite、WAL 與上傳檔案放在 `meta-exb-private_runtime-data` volume。
- Caddy 私有 CA 放在獨立 volume；重建容器不應刪掉它。
- 執行 `docker compose -f deploy/private/compose.yaml stop` 可停止服務，保留資料。
- 備份前停止 `web` 與 `app`，將 runtime volume 唯讀掛載到備份工具，完整複製 `/data/server`。
  備份應包含 DB/WAL/SHM 和 uploads，放在部署目錄之外，並安全下載至另一裝置。
  備份完成後再啟動；必須做過隔離還原測試才可聲稱備份有效。
- 不要使用 `down -v`、`docker volume prune` 或刪除 runtime volume。
- 更新前保留舊映像與資料備份；資料庫遷移後不能只回退程式而忽略 schema 相容性。
- 用戶不再使用私人測試時，先停止容器及 SSH 通道；按用戶授權移除**本次新增的**金鑰與信任證書。

## 公開上線前

另外確認域名、備案主體資格及 ICP 流程。阿里雲文檔要求備案实例購買時長（含續費）
至少 3 個月；現有一個月套餐本身不符合該條件。任何續費、域名購買或公開端口變更均需另行確認。
這份 localhost 配置不能直接用作正式公開網站設定。

參考：[阿里雲建立主機](https://help.aliyun.com/zh/simple-application-server/user-guide/create-a-server)、
[Docker 端口發布](https://docs.docker.com/engine/network/port-publishing/)、
[Caddy 本地 TLS](https://caddyserver.com/docs/caddyfile/directives/tls)。
