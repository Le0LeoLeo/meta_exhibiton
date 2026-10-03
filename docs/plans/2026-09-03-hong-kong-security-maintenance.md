# 香港主機安全更新與一次重啟：執行紀錄

日期：2026-09-03，Asia/Hong_Kong。

最終結果：**19:45 HKT 完成安全更新、同系列核心更新、一次重啟及隔離驗收；網站仍未公開，測試容器已停止。**

## 授權

使用者已對「只為香港主機安裝安全更新、更新核心並重啟一次；不改 DNS、不操作深圳」回答「好」。這是本輪執行範圍，不授權公開網站、購買快照／資源、變更持有人資料或重設密碼。

## 執行前核對

- 目標 `admin@47.76.58.150`，hostname `iZj6cauo6k7q9ctxhdefuwZ`；SSH 主機 ED25519 指紋仍為 `SHA256:frQ4q2+l4Ab7w9D3rBw3Wflc4nyIFzAmI8S/2Qm7Yrg`。
- 舊核心 `6.8.0-63-generic`，原始 boot ID `1269b133-b4da-4790-a76d-8c9431dc90f0`。
- apt 索引刷新成功，來源為 Ubuntu 簽章套件的既有阿里雲 mirror，以及 Docker 官方 HTTPS 套件源；未改套件來源或停用簽章驗證。
- Docker、containerd、SSH 正常；兩個 staging 容器為 stopped / unless-stopped，無端口 publish，網路 internal=true。
- 舊核心 image、headers（通用及 generic）、modules、modules-extra 共五個已安裝套件設為 manual，避免被自動移除；不執行 autoremove。既有 cloud-init hold 保留。
- 阿里雲 Chrome 控制台已確認精確香港 instance 與「救援登录」入口可見。沒有發起 VNC 登入、重設密碼或聲稱已測通救援登入。root/admin 密碼均為鎖定狀態；若日後需要 VNC 登入作業系統，須由使用者處理密碼。保留舊核心供啟動選單回復，不把 Workbench 當作可處理所有開機失敗的救援工具。

## 私有回復資料

- `/home/admin/meta-exb-hk-maintenance-20260903/`：admin mode 700。
- `boot-network-package-config-before.tar.gz`：root mode 600，239455 bytes，54 個 archive entries。
- SHA256：`9de42ec0d663786598ea3233ed32edac73727ba81964f59f74a974b383d2f475`。
- 備份包括原有 GRUB 設定、已產生的 grub.cfg、APT、netplan、sshd 設定及 dpkg / apt 套件狀態；不包含 SSH 私鑰或應用程式 secret。這不是整機快照。
- 建立可選套件 TSV 清單的命令因引號展開失敗，TSV 未建立；原始 dpkg status 已在上述驗證過的 tar 備份中，不依賴不存在的 TSV。
- 上一階段 runtime 備份 SHA256 仍為 `5a542fe356f40fe6380182cda2fcf80092ba9ac59c769d0d590c6f8c8195ab8c`，沒有改動。
- 重啟前 staging DB SHA256：`022ca2959e69a8a3b6d107ca24941abc0e5ff247d51bd7c52c2dc34e76c4f13c`。以無網路、唯讀、移除 capabilities 的短暫容器取得，沒有啟動應用服務。
- 已另外保存 `.env.hongkong`、兩份 Compose 設定及 authorized_keys 的核對值作前後比對，不輸出任何檔案內容。

## 進度

- 19:30:43 啟動一次性 systemd transient unit `meta-exb-hk-security-update-20260903.service`，執行官方 `unattended-upgrade --verbose`。
- 使用已核對的安全來源設定；自動重啟未啟用，先完成安裝和引導驗證，再由本輪明確執行一次重啟。
- 19:38:29 安全更新實際完成；dpkg log 計算為 220 個不同套件更新，unit 日誌為 `Deactivated successfully`，`apt-get check` / `dpkg --audit` 正常。最高記憶體使用 667.5 MiB，無 swap。
- transient unit 正常結束後被 systemd 清除；之後查詢出現 not-found / transient 檔案不存在，不是安裝失敗。依已結束日誌及套件資料庫核對完成，而不是只看預設 ExecMainStatus=0。
- 新核心精確目標：`linux-image-generic=6.8.0-138.138` 及 `linux-headers-generic=6.8.0-138.138`。安全更新後再次模擬為 9 新增、零更新、零刪除；80 項其他候選尚未套用，不把它們全部當作未安裝安全修正。
- 已啟動 `meta-exb-hk-kernel-update-20260903.service`，使用官方 apt、`--no-remove`、`--no-install-recommends`，保留原有 conffiles。此 unit 以 RemainAfterExit 保留完成狀態直到重啟，未建立永久啟動工作。
- 19:39:49 核心安裝完成；unit 為 success / exited / ExecMainStatus=0，9 個新套件已安裝。新舊 image 與 initrd 均非空；GRUB 語法檢查通過，預設選新核心，進階選單保留舊核心與 recovery entries。
- 核對新核心內建 virtio block/net/PCI、Xen frontend、ext4，並有 overlay / nf_tables / br_netfilter 模組；initramfs 可讀出 2005 entries。sshd 設定及 apt 健康檢查通過，無 failed units，authorized_keys 雜湊未改。
- 19:41:32 在精確 hostname、舊 boot ID、核心安裝成功及無運行容器的保護檢查後，執行使用者批准的 **一次** `systemctl reboot`。不重複送出重啟。
- 主機重新啟動時間為 19:41:49；新 boot ID `9967fdfd-a4d3-4f5b-b889-8999c7a8aaa0`，實際運行核心 `6.8.0-138-generic`。重新 SSH 連線通過原有嚴格 host key 核對，hostname 不變，SSH / Docker / containerd 均 active。
- 第一次本機輪詢命令有 PowerShell 變數引號語法錯誤，修正後只重試連線檢查，**沒有重複執行 reboot**。

## 重啟後驗收與最終狀態

- 重啟前後 runtime 檔案清單／DB 雜湊、staging env、兩份 Compose 及 authorized_keys 雜湊逐一一致。沒有讀取私鑰或輸出 env 內容。
- `dpkg --audit`、`apt-get check`、`needrestart -b -r l` 均正常；目前核心與 expected kernel 均為 `6.8.0-138-generic`，無 reboot-required marker，無 failed systemd units。
- 官方安全更新再預演回覆 `No packages found that can be upgraded unattended and no pending auto-removals`，沒有執行第二輪實際安裝或自動移除。
- apt 仍顯示 80 項較新候選，包括一般更新及受保護的 cloud-init；這不等於 80 項遺漏安全更新，也不能聲稱所有套件都升至最新或沒有任何已知漏洞。cloud-init 仍是雲端客製 `23.2.2-8` 且保持 hold。
- 主要已更新版本：libc6 `2.39-0ubuntu8.8`、OpenSSH server `1:9.6p1-3ubuntu13.18`、OpenSSL `3.0.13-0ubuntu3.15`、systemd `255.4-1ubuntu8.17`、distro-info-data `0.72-0ubuntu0.24.04.1`。最後的預演沒有再次出現舊 distro-info-data 警告。
- 使用原有已建置映像、原 staging project 和 internal network 啟動隔離 smoke test，沒有 rebuild，也沒有套用 public overlay。app / web 均 healthy、OOM=false、port bindings={}。
- 沿用既有內部 CA，透過 stdin 供 TLS 驗證，沒有跳過憑證檢查、安装 CA 或輸出任何私鑰。`/api/ready`、`/`、`/profile` 均為 HTTP 200，後兩者為含 React root 的 HTML。
- 在 network=none / read-only / cap-drop=ALL 容器內，再驗證既有獨立還原 volume：SQLite integrity、兩個合成帳戶、展覽場景及圖片雜湊全部一致。這是重新核對先前的還原資料，**不是本輪新建一次還原或深圳備份**。
- smoke test 以 EXIT cleanup 停止 app / web。19:45 最終無运行容器，staging DB 雜湊仍完全相同（users/galleries/media 仍為先前核實的空白狀態），本輪沒有新建帳戶或資料。
- 原 runtime 備份及此次啟動設定備份的 SHA256 均未改。映像、volumes、舊核心及受限 SSH 金鑰保留，沒有刪除任何部署資料。
- 最終只監聽 SSH 22 與本機 DNS 53；可用記憶體約 1174 MiB，磁碟約 29 GiB 可用，無 swap。沒有修改 DNS、雲端防火牆、使用者 VPN／路由或深圳資源。

## 尚未完成的公開上線關卡

- 本輪沒有重查域名；最後一次 19:25 的觀察仍是「資訊模板注册局审核中／模板電郵已驗證」，但域名本身未實名、域名電郵未通過。不能把此歷史狀態當作日後仍未通過的證據，下一階段需刷新核對。
- `metaexb.com → 47.76.58.150` 的 DNS 修改及 80/443 公開仍需明確確認，不能把本輪核心重啟授權延伸成公開授權。
- 正式 production project / secret / data、正常公網 TLS、實際瀏覽器與內地網路驗收、正式備份政策仍待處理。AI / Google 尚未配置。
- 本轮沒有改應用程式、commit、push、新 task、代理分工、監控排程、購買或退款。

## 參考

- [預演與網域狀態紀錄](2026-09-03-hong-kong-security-readiness.md)
- [Ubuntu 自動更新及重啟](https://ubuntu.com/server/docs/how-to/software/automatic-updates/)
- [阿里雲核心升級注意](https://help.aliyun.com/zh/ecs/user-guide/upgrade-the-linux-instance-kernel)
- [輕量應用伺服器救援連線](https://help.aliyun.com/zh/simple-application-server/user-guide/connect-to-a-server-by-using-the-rescue-feature/)
