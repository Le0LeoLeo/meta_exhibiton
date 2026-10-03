# 移動端支援與操作便利性審查

日期：2026-09-02。對象：`D:/meta_exb/web_ui_new` 的工作目錄版本及已運行的本機網站。

## 結論

專案已有響應式網頁、手機觀展輸入、效能降級和簡化建展流程，屬於「已有移動端支援，但關鍵流程尚未達到穩定好用」。一般內容瀏覽較成熟；3D 觀展的浮層、聊天及多人呈現有明顯問題；完整 3D／平面編輯器仍偏向桌面。不能用「有手機選單」或「有搖桿」推論所有功能在手機上都方便。

手機應優先支援找展覽、讀作品、輕量導覽、批量加入作品及簡單修改；精細的空間佈置需要另外設計觸控工作流程。

## 證據與限制

- 用內建瀏覽器實際操作首頁、選單、公開展覽入場、觀展模式選擇、AI 面板、建展登入入口及角色頁。
- 手機尺寸：390 × 844、360 × 800 CSS px；另外查看了 768 × 1024 的 3D 面板作為平板參考。這是桌面 Chromium 改變視窗尺寸，不是真機，也沒有模擬粗指標、多指觸控、手機鍵盤、Safari 或低階 GPU。
- 公開展覽的 AI 面板已開啟，沒有送出 AI 問題、留言、上傳或發布。建展入口要求登入，故登入後的上傳、編輯、發布以程式碼分析為主，沒有繞過登入。
- 審查期間檔案持續被更新：例如舊的 `ExhibitionUploadPlatform.tsx` 被移除，重複掛載的觀展選擇／聊天面板及 MobileControls 顯示條件也有修改。本文不把這些已改動的中間狀態列為尚未修正的缺陷。截圖保留的是本次實際觀察時的狀態；數值不是所有版本、裝置的固定值。
- 2D 切換曾在 DOM 顯示圖文清單，但後續保存的畫面回到了 3D；未取得可靠的 2D 截圖，不把它宣稱為完整實測通過。僅保留對目前 2D 實作的程式碼判斷。
- 沒有改動應用程式碼，沒有執行完整測試或測量 FPS、記憶體、耗電。沒有宣稱無障礙合規。

## 已實際走過的流程

| 步驟 | 操作 | 狀態與便利性 |
|---|---|---|
| 1 | 390px 首頁 | 內容與主要按鈕能直向排列；頂部選單被擠出右邊界 |
| 2 | 展開選單、前往展覽列表 | 導覽項目清楚、可導航；選單入口的可見性先造成障礙 |
| 3 | 打開公開展覽、入場 | 列表單欄可讀；點卡片後還有入場確認及觀展模式選擇，首次參觀步驟偏多 |
| 4 | 選擇觀展模式 | 390 × 844 下整個選擇框高約 1,019px，頂部與底部裁切 |
| 5 | 選 AI 伴展、確認 | 面板可開啟；390px 幾乎佔滿畫面，360 × 800 下關閉按鈕被裁到頂部之外 |
| 6 | 切換 2D 圖文 | 曾取得清單 DOM；視覺穩定性未完成驗證 |
| 7 | 從建展入口到登入 | 正確保留返回建展的目的路徑；表單可讀，顯示密碼圖示太小；登入後流程未操作 |
| 8 | 開啟角色設定 | 預覽可見、分類橫向捲動；手機上預覽與下方細項無法同時保持可見 |

## 優先處理的問題

### P1-1：手機選單被品牌名稱擠出畫面——已實測

390px 視窗中，品牌區寬約 223.4px 且不允許縮小。選單按鈕左緣約 x=359px、寬 40px，右緣約 399px；扣除桌面捲軸後可見寬度更窄。360px 截圖已看不到完整選單入口。語言文字同時換成兩行。

這影響的是登入、找展覽和返回其他功能，不只是視覺美觀。根因是完整品牌名稱、固定間距、語言、主題與選單一起放在同一列。

建議手機顯示「MREI 元境智展」短名稱，為選單保留固定空間；把低頻的語言／主題設定移入選單，並驗證 320、360、390、430px。不要以外層裁切隱藏超寬內容。

程式依據：[Navigation.tsx](D:/meta_exb/web_ui_new/src/app/components/Navigation.tsx:60)、[Layout.tsx](D:/meta_exb/web_ui_new/src/app/components/Layout.tsx)。截圖：01、02、09。

### P1-2：觀展模式視窗過高，初次參觀負擔偏重——已實測

模式框在 390 × 844 時高約 1,019px，y 約 -87.5px 至 931.5px。視窗採垂直居中，沒有整體高度上限與捲動設計，因此標題及底部說明被裁掉。

使用者只是想看一件作品，卻先閱讀個人／AI 模式、三種人格與長篇說明；即使使用個人模式，仍看到 Agent 外觀選項。畫面預先高亮個人模式，但「確定」仍要求再點一次選擇，也容易造成困惑。

建議提供「直接看展」入口；選 AI 後才顯示人格設定。視窗使用受視窗高度限制的捲動內容區，確認與關閉固定可見，並保留手機安全區。

程式依據：[AgentModeSelector.tsx](D:/meta_exb/web_ui_new/src/app/modules/metaverse3d/components/UI/AgentModeSelector.tsx:16)。截圖：04。

### P1-3：AI 聊天面板遮擋展場，窄手機難以關閉——已實測

面板固定 `22rem`（352px）寬，距右／底各 16px，沒有整體最大高度；只有聊天歷史的小區域可捲動。390px 下幾乎遮住整個展場。360 × 800 時，關閉按鈕的 DOM 頂部約 -22px、底部約 3.4px，手指幾乎沒有可點範圍。

2D／3D 切換按鈕又浮在聊天內容之上。人格、導覽状态、記憶及推薦資訊排在對話與輸入前，增加找輸入框的成本。手機軟鍵盤彈出時的情況尚未驗證，但既有高度問題會提高風險。

建議改成可收合底部面板：收起時只保留一句導覽及「提問」，展開時固定標題／關閉與輸入列，中間內容捲動。把診斷性資訊收進次級區域，2D／3D 切換與面板避讓。

程式依據：[AgentChatPanel.tsx](D:/meta_exb/web_ui_new/src/app/modules/metaverse3d/components/UI/AgentChatPanel.tsx:229)、[ExhibitionView.tsx](D:/meta_exb/web_ui_new/src/app/pages/ExhibitionView.tsx:221)。截圖：05、06。

### P1-4：手機效能模式會讓其他參觀者消失——程式碼確認，未做多人真機測試

粗指標裝置被判定為 mobile，`auto` 初始選 `performance`；這個模式除了降低解析度及特效，還設為 `enableRemotePlayers: false`。ViewCanvas／RemotePlayers 按此值停止繪製其他人的角色。

因此手機可能仍然加入多人房間，卻看不見同學；這會削弱本產品「全班多人看展」的主要用途。應區分網路連線與角色可見性，不能說成手機完全沒有多人功能。自動模式之後也可能升級，因此並非永遠隱藏。

建議效能不足時先使用低細節角色、減少遠方角色或降低更新頻率，保留附近人物及人數提示，而不是整體消失。

程式依據：[useAdaptivePerformance.ts](D:/meta_exb/web_ui_new/src/app/modules/metaverse3d/performance/useAdaptivePerformance.ts:35)、[adaptivePerformance.ts](D:/meta_exb/web_ui_new/src/app/modules/metaverse3d/performance/adaptivePerformance.ts:58)、[performanceProfile.ts](D:/meta_exb/web_ui_new/src/app/modules/metaverse3d/performanceProfile.ts:67)、[ViewCanvas.tsx](D:/meta_exb/web_ui_new/src/app/modules/metaverse3d/components/ViewCanvas.tsx:44)。

### P1-5：專業編輯器的空間與操作模式不適合手機——程式碼推導

工作面板預設展開，手機左移 5.2rem（83.2px）再加 17.5rem（280px）寬，在 360px 上已達 363.2px，尚未給外側留邊距。選中物件後的 Inspector 從 `top:23rem` 開始，覆蓋畫布下半部。平面編輯的左右面板各 320px；390px 時互相覆蓋約 250px，768px 時中間只剩約 128px 供平面圖操作。

一般物件的旋轉／縮放操作軸由鍵盤 T/R/S 切換，多選依賴 Shift。雖然有位置數字欄、個別物件尺寸欄及部分平面圖按鈕，但這不等於手機已有完整的直接操作替代。使用者需要在很小的畫布上捏合、點細小操作軸，再回到面板輸入數值，容易誤觸且反覆切換。

建議手機一次只開一個工具面板；用底部工具列明確選「移動／旋轉／大小／多選」，提供步進按鈕及完成／取消；選取物件後才顯示相應設定。平板也需重新分配畫布，不能只沿用兩側固定寬面板。

程式依據：[EditorWorkspacePanel.tsx](D:/meta_exb/web_ui_new/src/app/modules/metaverse3d/components/UI/EditorWorkspacePanel.tsx:24)、[EditorInspectorPanel.tsx](D:/meta_exb/web_ui_new/src/app/modules/metaverse3d/components/UI/EditorInspectorPanel.tsx:70)、[FloorPlanUI.tsx](D:/meta_exb/web_ui_new/src/app/modules/metaverse3d/components/UI/FloorPlanUI.tsx:333)、[FloorPlanInspectorPanel.tsx](D:/meta_exb/web_ui_new/src/app/modules/metaverse3d/components/UI/FloorPlanInspectorPanel.tsx:48)、[ExhibitItem.tsx](D:/meta_exb/web_ui_new/src/app/features/metaverse-studio/exhibits/ExhibitItem.tsx:118)。登入後未實測，尺寸結論是依樣式推算。

### P2-1：有觸控走動基礎，但缺少清楚教學與操作回饋——程式碼確認／真機待驗

MobileControls 提供左下 112px 移動區、右半屏拖動視角、附近物件的至少 44px 互動按鈕；用 Pointer Events、pointer capture、取消時重置。這是實際的手機輸入支援，不依賴 pointer lock 才能移動。

不足是左下只有空心圓，沒有搖桿中心、方向或位移回饋；右半屏是透明觸控層，使用者不容易知道如何轉向。底部仍寫「WASD 移動」。走動與轉向通常需要雙手，不利單手快速讀作品。

右半屏 `z-30` 觸控區仍可能蓋到 `ViewUI z-20` 中右下角角色動作；在真機需驗證點擊是否被視角層攔截。最新程式已在聊天或作品詳情開啟時卸載 MobileControls，因此不再把「詳情被移動層擋住」列成現行問題。

建議加入一次性的兩步手勢教學、可見搖桿回饋、觸控版文字提示；提供「下一件／前往作品」降低走動負擔；每個浮層與手勢區一起驗證命中層級。

程式依據：[MobileControls.tsx](D:/meta_exb/web_ui_new/src/app/modules/metaverse3d/components/MobileControls.tsx:62)、[StudioCanvasRoot.tsx](D:/meta_exb/web_ui_new/src/app/features/metaverse-studio/canvas/StudioCanvasRoot.tsx:137)、[AvatarEmoteBar.tsx](D:/meta_exb/web_ui_new/src/app/modules/metaverse3d/components/UI/AvatarEmoteBar.tsx)、[ViewUI.tsx](D:/meta_exb/web_ui_new/src/app/modules/metaverse3d/components/UI/ViewUI.tsx)。

### P2-2：作品閱讀與 2D 降級流程還不完整——程式碼分析

3D 詳情手機上採上下排列，但媒體區至少 40vh，內邊距各 32px，外層最高 90vh。留給文字與留言的空間有限，PDF 區又設定 70vh。已有左右鍵切換作品，但詳情介面沒有相同用途的上一件／下一件觸控按鈕，連續看作品需離開詳情再定位。

2D 版本有單欄圖文、圖片延遲載入、替代文字及影片入口，是值得擴充的手機路徑。然而只要能建立 WebGL 就預設進 3D，未按操作偏好選擇；2D 沒有同等的留言／導覽與返回展覽列表入口。PDF 也未被建模為獨立媒體種類，不能假設 2D 已完整涵蓋所有上傳內容。

建議圖文模式成為明確、易發現的入口；加入作品前後切換、全螢幕媒體檢視、文件開啟／下載及返回列表。3D 詳情採一個清楚的內容捲動區，留言按需展開。

程式依據：[ViewUI.tsx](D:/meta_exb/web_ui_new/src/app/modules/metaverse3d/components/UI/ViewUI.tsx)、[Exhibition2DView.tsx](D:/meta_exb/web_ui_new/src/app/features/exhibition-2d/Exhibition2DView.tsx)、[sceneToExhibits.ts](D:/meta_exb/web_ui_new/src/app/features/exhibition-2d/sceneToExhibits.ts)、[ExhibitionView.tsx](D:/meta_exb/web_ui_new/src/app/pages/ExhibitionView.tsx:75)。

### P2-3：簡化建展適合手機，批量上傳仍有負擔——程式碼分析

六步精靈在手機把步驟排為三欄兩行，主要動作至少 44px，逐步驗證、明確錯誤及草稿保存都值得保留。UploadStep 亦支持一次選多張圖片。

但實際新上傳入口只接受 JPEG／PNG／WebP，與更廣的文件／影片產品描述仍有落差；不能假設手機相簿的其他格式能順利加入。每批檔案用無併發上限的 Promise.all 同時讀取，而 API 先將整個檔案轉為 Base64 再包 JSON。大量照片會增加手機記憶體與網路負擔；所有結果收齊才更新完成列表，缺少逐檔進度、取消及直接重試按鈕。

建議先提供逐檔狀態、併發上限、失敗重試、檔案尺寸預檢；再改善傳輸方式与圖片壓縮／格式轉換。手机拍攝後直接加入、相簿多選、切到背景再返回，應列為實機流程。

程式依據：[ExhibitionWizard.tsx](D:/meta_exb/web_ui_new/src/app/features/exhibition-wizard/ExhibitionWizard.tsx:168)、[UploadStep.tsx](D:/meta_exb/web_ui_new/src/app/features/exhibition-wizard/steps/UploadStep.tsx:56)、[media.ts](D:/meta_exb/web_ui_new/src/app/api/media.ts:49)、[VirtualGalleryCreate.tsx](D:/meta_exb/web_ui_new/src/app/pages/VirtualGalleryCreate.tsx)。

### P2-4：按鈕尺寸、安全區與角色微調缺少一致性

通用按鈕預設 36px、小按鈕 32px、圖示按鈕 36px；登入顯示密碼圖示只有 16px 且沒有擴大點擊區。這不代表所有小按鈕都不合規，但高頻觸控動作明顯不如精靈的 44px 控制容易命中。建議全站高頻控制採 44–48px 作為產品設計目標，並保留間距。

角色頁已有 44px 分類／色塊、橫向分類捲動、復原重做，以及底部安全區。手機預覽採 42vh／最少 320px，sticky 只從 lg 啟用，所以捲到五官細項時角色已離開視野，需來回捲動確認結果。可用可收合的小型持續預覽，讓改動与回饋同時可見。

主要 3D 浮層尚未統一使用 safe-area，viewport 也未設 viewport-fit=cover。這是劉海、底部手勢與橫向操作的驗證缺口，不能僅因使用了 100dvh 就視為已處理。

程式依據：[button.tsx](D:/meta_exb/web_ui_new/src/app/components/ui/button.tsx:26)、[Login.tsx](D:/meta_exb/web_ui_new/src/app/pages/Login.tsx:108)、[AvatarCustomizer.tsx](D:/meta_exb/web_ui_new/src/app/pages/AvatarCustomizer.tsx:437)、[index.html](D:/meta_exb/web_ui_new/index.html)。截圖：09、10。

## 保留並擴展的基礎

- 首頁／列表已有單欄與斷點佈局，主要入口清晰。
- Layout 對粗指標或減少動畫偏好採較簡單的轉場。
- 3D 根容器使用 100dvh；觸控輸入支援取消重置。
- 效能策略有解析度上限、低效能關閉陰影及後期特效、FPS 自適應、背景／遮蔽節流。
- 六步建展精靈、圖片多選、錯誤狀態、草稿保存降低手機的操作負擔。
- 角色頁提供預設造型、橫向分類、44px 色塊、復原／重做与底部安全區。
- 2D 圖文模式為低負擔與輔助科技瀏覽提供了基礎，但尚未確認全部功能等價。

## 建議交付順序與驗收

1. 先修選單、模式視窗、聊天關閉和浮層避讓；360px 下所有關鍵入口可見，不需橫向搬動畫面。
2. 完成手機看展：手勢教學、作品前後切換、可退出的 2D 入口；多人效能模式保留最低限度的可見人物。
3. 強化圖片上傳的進度／取消／重試及格式處理；手機能從相簿完成一次加入多件作品、失敗恢復与預覽。
4. 專業編輯器另做手機／平板面板佈局及觸控工具；驗收「選物件→移動→旋轉→調尺寸→復原」全程不用實體鍵盤。

真機驗收至少包含 iOS Safari、Android Chrome、窄手機、平板直橫向；同時測左右手觸控、軟鍵盤、底部安全區、放大文字、切背景恢复、較弱網路、低階設備及兩個訪客的多人可見性。既有 jsdom／邏輯測試可檢查狀態轉移，不能替代這些實際操作。

## 本次接受的截圖

以下為本次實際保存並逐張檢查的畫面。它們反映審查時的版本；報告內已說明其證據範圍。

### 01 首頁，390 × 844：選單被擠出邊界

![首頁](D:/meta_exb/web_ui_new/output/mobile-audit-2026-09-02/01-home-390.png)

### 02 手機選單：導覽可用，頂部空間不足

![選單](D:/meta_exb/web_ui_new/output/mobile-audit-2026-09-02/02-menu-390.png)

### 03 展覽列表：單欄可讀

![展覽列表](D:/meta_exb/web_ui_new/output/mobile-audit-2026-09-02/03-exhibitions-390.png)

### 04 觀展模式：視窗上下裁切

![觀展模式](D:/meta_exb/web_ui_new/output/mobile-audit-2026-09-02/04-mode-selector-390.png)

### 05 AI 面板，390 × 844：展場被遮住、模式切換壓到內容

![AI 面板 390](D:/meta_exb/web_ui_new/output/mobile-audit-2026-09-02/05-ai-chat-390.png)

### 06 AI 面板，360 × 800：關閉控制幾乎在畫面外

![AI 面板 360](D:/meta_exb/web_ui_new/output/mobile-audit-2026-09-02/06-ai-chat-360.png)

### 07 建展登入入口，360 × 800：表單可讀，選單與小圖示待改善

![登入](D:/meta_exb/web_ui_new/output/mobile-audit-2026-09-02/09-login-360.png)

### 08 角色頁，360 × 800：預覽與分類上下排列

![角色頁](D:/meta_exb/web_ui_new/output/mobile-audit-2026-09-02/10-avatar-360.png)

未納入：`04-enter-dialog-390.png` 實際是列表而非入場對話框；`07-2d-360.png` 及 `08-2d-768.png` 實際是 3D 聊天狀態，因此沒有作為 2D 成功證據。
