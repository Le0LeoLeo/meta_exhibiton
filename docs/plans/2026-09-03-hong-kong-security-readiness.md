# 香港主機安全更新與網域檢查

核對時間：2026-09-03 19:20–19:26 HKT。

後續：使用者已明確同意香港安全／核心更新及一次重啟，並於 19:45 HKT 完成。此文件保留為更新前診斷；最新結果見 [安全維護執行紀錄](2026-09-03-hong-kong-security-maintenance.md)，不要重問已完成的重啟授權。

## 範圍與結果

使用者在隔離部署完成後回答「好」，本輪接續檢查安全更新及網域狀態。
只做診斷與更新預演，沒有安裝系統更新、更新核心、重啟、修改 DNS、公開服務或更改身份資料。
更新與必要核心重啟需先取得本輪最終問題的確認；本文件不是操作授權。

## 香港主機

- 透過原有嚴格主機驗證 SSH 設定連到 `admin@47.76.58.150`；hostname 為 `iZj6cauo6k7q9ctxhdefuwZ`。
- 運行核心 `6.8.0-63-generic`。只有該版 image / headers，沒有 `linux-image-generic`、`linux-generic` 或 `linux-virtual` 持續追蹤套件。因此僅執行一般已安裝套件 upgrade 不會補上新核心。
- 目前 apt 索引的官方 Ubuntu 24.04 generic 核心候選為 `6.8.0-138.138`。保持 Ubuntu 24.04 / 6.8 系列，不規劃跨發行版升級。
- 已安裝套件有 272 項候選更新；一般 upgrade 模擬為 270 項更新、零新增、零刪除，保留 `cloud-init` 及 `fwupd`。
- `cloud-init` 有既有 hold，版本 `23.2.2-8`，不能自行解除或以 Ubuntu 通用版本覆蓋雲端客製版本。
- 一般 upgrade 候選中 192 項標有 noble-security；官方 `unattended-upgrade --dry-run` 按安全來源及相依關係評估出 220 項。這些數量的計算範圍不同，不是全部 272 項都屬安全修正。
- 安全更新預演 exit 0；它下載套件至 apt cache 並寫入診斷日誌，但沒有執行實際安裝。日誌明確寫有 `Option --dry-run given, *not* performing real actions`；後面的 `All upgrades installed` 是同一次預演的訊息，不是已實際完成更新的證據。
- 預演期間出現 Python fork deprecation、distro-info-data 過舊及 PackageKit 移除設定檔檢查警告。未把警告當作已修正；實際更新前需保留日誌並再次檢查。
- 預演後確認 libc6 `2.39-0ubuntu8.4`、OpenSSH server `1:9.6p1-3ubuntu13.12`、systemd `255.4-1ubuntu8.8` 未變。`dpkg --audit` 無異常，`apt-get check` 成功。
- 現時沒有 `/var/run/reboot-required`。這只表示尚未安裝需要重啟的更新，不代表舊核心已符合公開前更新要求。
- `needrestart -b -r l` 為唯讀列舉，未重啟服務；其 expected kernel 同樣只看到已安裝的舊核心。
- GRUB_DEFAULT=0、GRUB_TIMEOUT=1；/boot 在根檔案系統，約 31 GiB 可用，EFI 分區約 191 MiB 可用。現有核心內建 virtio block/net/PCI、Xen frontend 及 ext4。
- `linux-generic` 全預設模擬會帶入額外推薦工具；`--no-install-recommends install linux-image-generic linux-headers-generic` 模擬為 9 新增、2 更新、零刪除。未執行任何一項。若獲准，仍需刷新索引、重新核對精確候選、相依項目、引導驅動及回復路徑。
- Docker / containerd / SSH 均正常。兩個 staging 容器仍停止，無运行容器；只監聽 SSH 22 與本機 DNS 53，網站未公開。

## 網域：模板審核與網域狀態不能混淆

使用既有 Chrome 登入狀態，搜尋可用連接器後沒有找到阿里雲專用連接器，因此透過 Chrome 技能讀取控制台 UI。沒有讀取 cookies、token、證件圖片或提交任何表單。

- 網域清單刷新後一度持續空白，不能推論網域被刪除或購買失敗；已轉至既有 `metaexb.com` 詳情頁的「基本信息」重新查證。
- 網域本身仍顯示「未实名认证」，並提示暫時不能解析、續費、轉移、修改 DNS；網域聯絡電郵欄仍為「验证未通过」。
- 「信息模板」刷新載入完成後，現有模板顯示「注册局审核中」，其電郵為「验证成功」。因此不能籠統說使用者沒有提交驗證，也不能叫使用者重複提交；模板通過後仍需核對網域是否完成關聯／同步。
- 未重新取得精確的 ClientHold / serverHold EPP 值，不把歷史 ClientHold 當成此次最新查詢。
- 在香港向公開 DNS resolver `1.1.1.1` 查詢 `metaexb.com` 的 A、AAAA、NS 均回覆 NXDOMAIN，authority 為 `.com`。目前沒有可用的公開域名解析。
- 本輪沒有新增 A / AAAA 記錄、發送驗證電郵、修改模板／持有人資料或申請憑證。

## 下一個授權與驗收關卡

1. 向使用者確認：僅對香港 `47.76.58.150` 安裝安全更新、更新 6.8 系統核心並重啟一次；預期 SSH / Workbench 暫時斷線，網站尚未公開。這不包含 DNS 或公開授權。
2. 獲准後，先確認雲端救援登入／回復途徑；既有應用資料備份不是整機系統快照，不可混稱。不要自行購買快照或替換主機。
3. 保留舊核心、原有 cloud-init hold、SSH host key / 專用登入 key、現有網路設定與所有部署資料。實際更新後核對套件狀態、引導檔案；重啟後驗證同一主機身份、新核心、Docker、端口及隔離部署仍未公開。
4. 模板審核通過後再核對域名實名／電郵／鎖定狀態；涉及持有人關聯、條款、驗證碼或身份資料時由使用者確認／處理。
5. 修改 `metaexb.com → 47.76.58.150` 及公開 80/443 仍需獨立明確確認，並以全新 production project、資料與 secret 部署。

本輪不碰深圳主機、VPN、路由、購買、退款、commit、push、新 task 或自動監控。

## 官方參考

- [Ubuntu 自動更新、服務重啟及主機重啟](https://ubuntu.com/server/docs/how-to/software/automatic-updates/)
- [Ubuntu 安全更新](https://documentation.ubuntu.com/security/security-updates/)
- [阿里雲 Linux 核心升級與風險提示](https://help.aliyun.com/zh/ecs/user-guide/upgrade-the-linux-instance-kernel)（ECS 文件只作引導檢查參考，本機是輕量應用伺服器）
- [阿里雲域名實名認證](https://help.aliyun.com/zh/dws/security-and-compliance/domain-name-real-name-authentication)
- [阿里雲域名認證與模板關聯](https://help.aliyun.com/en/dws/user-guide/how-to-complete-domain-name-authentication)
