# 手機導覽功能框

2026-09-05 14:13 HKT，已部署香港正式站。

問題：關閉 AI 面板後，既有 T 鍵捷徑無法在手機使用；主動邀請只有符合條件才出現，NPC 頭頂氣泡不可點擊且近距離會裁切。

- AI 觀展且面板關閉時提供右上角常駐「智慧導覽 Agent」入口，避開安全區；開啟作品詳情或自主觀展時隱藏。桌面開啟會退出 pointer lock。
- 面板以安全區內上下邊界限制高度，內容獨立捲動，固定標題／關閉鍵及輸入列；輸入字體保持 16px。
- 觸控／窄螢幕隱藏 NPC 頭頂 Html 氣泡，從面板閱讀完整對話。
- 新增 shell 回歸測試：無鍵盤重新開啟、聊天期間隱藏移動控制、關閉後入口恢復、詳情及自主模式隱藏入口。

驗證：相關 23 項測試通過；typecheck、全域 lint、香港乾淨 build 通過。本機瀏覽器 740×340 橫向及 390×650 直向驗證，面板與輸入列在視窗內，重新開啟和「請安靜一下」指令成功，無 console error。瀏覽器尺寸模擬不等同實機 iOS 軟鍵盤驗收。

僅替換正式 web，所有非 dist 檔案與原正式檔案雜湊一致；app image、env 前後一致，資料及憑證 volumes 保留。HTTPS 首頁／ready／新版 MetaverseStudioApp-BDCeCP9T.js 正常，www 保留路徑 301，網站僅公開 80/443。

- Release SHA256 `994971bf3d0ba5975af1f6f13e470d342af2029c2a106e0523ecb420cfe32893`。
- 遠端 `/home/admin/meta-exb-hk-mobile-agent-20260905`。
- Web image `sha256:6d35dfb4b31f7d648fa657ba556a6886dd26d38e0fd9f0cfa81ddad2508c765f`。
- 備份 `dist.pre-mobile-agent-20260905`、image tag `pre-mobile-agent-20260905`。
- 無 commit/push。
