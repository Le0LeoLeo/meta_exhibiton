# MetaEXB 功能完整度與使用者體驗評估

日期：2026-09-26（香港時間）。範圍：目前本機版本；這輪只做評估與建立報告，沒有修改應用程式功能或部署。

**整體判斷：個人建立、管理及觀看 3D 展覽的基礎較完整；作為教師與學生共同使用的教學平台，私人審閱、成果撤回、草稿保護及功能入口仍未接成完整流程。** 畫面已有一致的美術館風格，但新使用者要在快速建立、六步精靈與進階編輯器之間自行理解差異。

此處以首頁呈現的教育定位評估。沒有既定需求清單或真實使用者研究，因此不以百分比宣稱完成度，也不把介面觀察當作實際流失率。

## 功能完整度

| 使用任務 | 已有實作 | 主要缺口 | 判斷依據 |
|---|---|---|---|
| 登入後開始建展 | 登入、註冊、快速建立與登入後返回 | 部分其他功能的返回目的地未列入允許清單 | 本機操作＋程式碼 |
| 上傳、編輯與保存展覽 | 圖片快速建立、模板、作品編輯、進階 3D 編輯、儲存及恢復機制 | 未完成快速草稿缺少明顯續作入口；部分編輯表單缺少站內離開保護 | 入口與編輯器實看；其他為程式碼 |
| 預覽、發布與分享 | 預覽、一般展覽公開／停止公開、確認視窗、公開連結及 QR 分享 | 精靈預覽動作與實際觀展模式未接好；共同編輯邀請入口不足 | 確認視窗實看；其他為程式碼 |
| 觀眾看展 | 公開展覽、免登入示範、3D／2D、作品文字及來源 | 真實手機效能、長時間觀看與大型展覽仍需另外驗證 | 本機示範操作＋程式碼 |
| 教師與學生合作 | 班級、邀請碼、投稿、退回／核准、評語、能力卡與公開典藏 | 教師無法私人預覽學生 3D 草稿；主要導覽未接上工作台；典藏缺少撤回 | 程式碼 |
| 個人作品集／CV | 卡片、AI 建議、公開分享與停止分享 | 入口難找、切換卡片的未存保護不足、帳號資料匯出漏 CV | 程式碼 |
| AI 輔助 | 展覽場景產生、能力卡建議及替代結果 | 自訂風格未傳達、替代結果提示不足、部分輸出固定英文 | 程式碼；未呼叫真實模型 |

## 最先改善的五件事

以下「優先」表示對資料、任務完成或信任的影響較大；不是正式事故分級。

| 順序 | 問題與影響 | 建議完成條件 |
|---|---|---|
| 1 | **未儲存內容可能在站內切頁或切換卡片時消失。** 作品編輯及專題表單主要依賴關閉頁面提醒，未涵蓋所有站內導覽；CV 切換卡片直接覆蓋編輯狀態。 | 導覽、返回及卡片切換一致提供保留草稿／儲存／放棄選擇，並驗證輸入可恢復。 |
| 2 | **學生的公開典藏缺少撤回流程，刪帳說明又承諾移除所有關聯資料。** 現有測試明確保留學生刪帳後的已發布文字快照；普通 3D 展覽的停止公開不能代替典藏撤回。 | 支援指定典藏版本或作品停止公開，定義作者與教師權限，並使刪帳說明與實際保留行為一致。 |
| 3 | **教師必須等學生先公開 3D 展覽才能查看。** 文字投稿已有評閱流程，但無法完成「私人製作 → 教師看展 → 修改 → 核准公開」。 | 指定教師可唯讀審閱私人展覽，學生仍能控制公開時間；一般訪客維持不可存取。 |
| 4 | **使用者輸入的展覽風格可能完全沒有生效。** 欄位接受自然語言，請求卻只接受五個內部代碼，其餘默默改成白盒風格；生成採用替代結果時也未顯示原因。 | 自然語言真正參與生成，或改成可理解的風格選項；清楚區分 AI 結果、模板替代與未完成。 |
| 5 | **建立入口及工作台導覽不一致。** 「進階編輯」先進六步精靈；部分手機入口通往桌面限制頁；班級與 CV 已有功能卻不在一般導覽中。 | 統一快速建立入口，直接進入所選模式，提供工作台及「繼續草稿」，並保留登入前任務。 |

## 本機操作與截圖

以下七個畫面均在本輪重新擷取，已檢視保存的原圖。使用英文介面、1280 × 720 桌面視窗及隔離測試帳號。它們是相互銜接的入口檢查，**不是完整上傳至發布的端到端驗收**。

### 1. 首頁 — 需要改善

優點：教育用途清楚，未登入也能先看示範；品牌色、字體與內容方向一致。

問題：同一區域有多種「建立／班級建立／選模板」入口，差異未交代。在此視窗尺寸下，「AI for Education」與語言切換區域互相擠壓，登入文字換成兩行。建議保留一個主要建立動作與一個看範例動作，其他選項於進入後提供，並調整導覽的響應式切換點。

![步驟 1：首頁與擁擠的導覽列](D:/meta_exb/web_ui_new/docs/audits/2026-09-26-product-experience/01-home.png)

### 2. 登入 — 此條路徑可完成

優點：明確說明登入後繼續原任務，並有免登入示範入口。本輪由首頁建立按鈕登入後，成功返回快速建立。

問題：在此視窗高度，登入按鈕接近畫面底部，品牌說明占用較多空間。其他功能的返回目的地仍有程式碼缺口，不能由這一次成功推論全部入口都正常。測試環境未設定 Google 登入，不將其停用列為產品缺陷。

![步驟 2：登入與任務延續說明](D:/meta_exb/web_ui_new/docs/audits/2026-09-26-product-experience/02-login.png)

### 3. 快速建立 — 步驟清楚，首個動作太低

優點：三步流程與尚未儲存狀態清楚，有圖片範圍及其他媒體的說明。

問題：標題、流程、狀態及兩段提示將實際上傳控制推到首屏以下。初次使用者應先看到可以操作的上傳區，再看到進階媒體說明。這是首屏效率問題，不代表上傳功能不存在。

![步驟 3：快速建立的首屏](D:/meta_exb/web_ui_new/docs/audits/2026-09-26-product-experience/03-quick-create.png)

### 4. 從「進階編輯」進入 — 入口預期不一致

實際點擊快速建立頁的 Advanced editing，首先出現六步精靈，還要再按 Switch to the advanced editor 才進編輯器。使用者原本已選擇模式，卻需要再選一次。

優點：精靈有進度、標籤及明確下一步。建議讓指定的進階入口直接進編輯器，六步精靈則保留為清楚命名的獨立選擇。

輔助操作風險：畫面視覺上覆蓋背景，但本輪可存取樹仍列出背景編輯控制，元件使用 section。鍵盤焦點是否能離開精靈需專項驗證；目前不宣稱已完成無障礙符合性測試。

![步驟 4：進階入口先出現六步精靈](D:/meta_exb/web_ui_new/docs/audits/2026-09-26-product-experience/04-advanced-entry-wizard.png)

### 5. 進階編輯器 — 能進入，初學成本較高

優點：本輪看到真實 3D 房間；介面呈現編輯模式、自動儲存、連線、復原及觀看入口。這些功能不是全部缺失，程式碼亦有對應實作。

問題：空展覽初始畫面同時呈現大量工具、空間設定及停用操作，上方工具列約占 197 像素，左側面板占去部分畫布。建議讓「加入第一件作品」成為空狀態主要動作，逐步展開進階設定。英文介面的自動標題仍含中文時間字樣，是次要一致性問題。

![步驟 5：空展覽的進階編輯器](D:/meta_exb/web_ui_new/docs/audits/2026-09-26-product-experience/05-editor.png)

### 6. 發布確認 — 提醒清楚，尚未執行發布

優點：管理頁發布按鈕會開啟確認視窗，顯示作品名稱、公開後的可見範圍及內容／權限準備提醒，並提供取消。

本輪只開啟後取消。這證實確認步驟存在，不能據此宣稱發布成功，也不能宣稱空展覽可成功公開。教學典藏的撤回缺口與此一般展覽流程應分別處理。

![步驟 6：公開前確認視窗](D:/meta_exb/web_ui_new/docs/audits/2026-09-26-product-experience/06-publish-confirmation.png)

### 7. 示範觀展 — 基本瀏覽順暢

優點：可切到 2D，看到作品、作者、說明及館藏來源；按 Next 後從第一件《神奈川沖浪裏》更新為第二件《有柏樹的麥田》，作品文字與選取狀態同步。3D 之外的閱讀入口值得保留。

限制：本輪未量測手機幀率、大量媒體載入或輔助科技完整操作；截圖為第一件作品，下一件操作另以頁面狀態確認。

![步驟 7：2D 作品與導覽說明](D:/meta_exb/web_ui_new/docs/audits/2026-09-26-product-experience/07-demo-view.png)

## 程式碼證據與後續修正範圍

下列是靜態查核所得；除前述七步外，未在這輪逐一重現，也沒有重新執行完整測試套件。

| 問題 | 證據 | 可驗收的改善 |
|---|---|---|
| 站內導覽的未存保護不完整 | [作品編輯保護](D:/meta_exb/web_ui_new/src/app/pages/ExhibitionArtworkEdit.tsx:48)、[僅頁內連結確認](D:/meta_exb/web_ui_new/src/app/pages/ExhibitionArtworkEdit.tsx:84)、[專題表單](D:/meta_exb/web_ui_new/src/app/features/graduation/ProjectEditor.tsx:30)、[CV 切换卡片](D:/meta_exb/web_ui_new/src/app/features/cv/CvWorkspace.tsx:60) | 修改後經全站導覽、返回及卡片切換均不無聲遺失。 |
| 學生刪帳後仍保留已發布典藏，且沒有撤回入口 | [公開路由](D:/meta_exb/web_ui_new/server/routes/graduationRoutes.js:60)、[保留快照的既有測試](D:/meta_exb/web_ui_new/server/routes/graduationRoutes.test.js:377)、[刪帳說明](D:/meta_exb/web_ui_new/src/app/i18n/catalogs/zh-TW.ts:537)、[實際刪帳](D:/meta_exb/web_ui_new/server/repositories/userRepository.js:122) | 停止公開指定內容；刪帳前正確說明保留／移除範圍。此問題針對學生已發布快照，並非所有帳號刪除皆無效。 |
| 教師不能私人預覽 3D 投稿 | [現有介面明確說明](D:/meta_exb/web_ui_new/src/app/features/graduation/copy.ts:4) | 未公開草稿可由指定教師審閱，其他訪客仍被拒絕。 |
| 自然語言風格被改為預設值 | [自由文字欄位](D:/meta_exb/web_ui_new/src/app/features/exhibition-wizard/ExhibitionWizard.tsx:226)、[五值允許清單與生成請求](D:/meta_exb/web_ui_new/src/app/pages/VirtualGalleryCreate.tsx:760) | 例如「明亮、現代、適合學生作品」能影響結果，或明確改成固定選項。 |
| AI 替代結果與完成狀態未區分 | [後端提供 source 與 warnings](D:/meta_exb/web_ui_new/server/services/exhibitionSceneService.js:852)、[前端直接標記完成](D:/meta_exb/web_ui_new/src/app/pages/VirtualGalleryCreate.tsx:771) | 模型不可用、保留舊場景或模板替代時，提示原因與可行下一步。 |
| 部分登入目的地遺失 | [目的地允許清單](D:/meta_exb/web_ui_new/src/app/utils/galleryEntry.ts:44)、[未帶返回目的地的註冊入口](D:/meta_exb/web_ui_new/src/app/pages/VirtualGallery.tsx:386) | CV、作品編輯、公開典藏提問及建展註冊後皆回到原任務；仍拒絕外站跳轉。 |
| 手機建立入口不一致 | [空狀態連到桌面建立](D:/meta_exb/web_ui_new/src/app/pages/Exhibitions.tsx:108)、[同頁另一入口連到快速建立](D:/meta_exb/web_ui_new/src/app/pages/Exhibitions.tsx:151)、[桌面限制](D:/meta_exb/web_ui_new/src/app/pages/VirtualGalleryCreate.tsx:215) | 手機由任一建立入口均可完成快速建立，或立即取得替代入口。 |
| 快速草稿缺少明顯續作入口 | [依 draftId 恢復](D:/meta_exb/web_ui_new/src/app/pages/QuickExhibitionCreate.tsx:23)、[管理頁提供作品／進階編輯](D:/meta_exb/web_ui_new/src/app/pages/MyExhibitions.tsx:568) | 清單可辨識未完成草稿並回到原步驟，不依賴保留原網址。 |
| 班級與 CV 功能不易發現 | [已有路由](D:/meta_exb/web_ui_new/src/app/routes.ts:45)、[主導覽](D:/meta_exb/web_ui_new/src/app/components/Navigation.tsx:11)、[教學指引](D:/meta_exb/web_ui_new/src/app/pages/EducationGuide.tsx:101) | 若納入正式產品，登入後可由工作台進入；若尚在試驗，明確標示狀態。 |
| 共同編輯邀請缺少使用者入口 | [已有分享憑證 API](D:/meta_exb/web_ui_new/src/app/api/gallery.ts:250)、[分享視窗](D:/meta_exb/web_ui_new/src/app/components/ExhibitionShareDialog.tsx:15) | 提供邀請編輯者、權限與撤回入口；不要求使用者理解房間 ID 或連線設定。底層多人協作已有實作。 |
| 精靈預覽僅關閉精靈 | [預覽動作](D:/meta_exb/web_ui_new/src/app/pages/VirtualGalleryCreate.tsx:1025) | 點預覽即進入觀看狀態，且明確提供返回編輯／繼續發布。 |
| 場景圖片預算可能漏計內部媒體 | [無副檔名媒體網址](D:/meta_exb/web_ui_new/server/routes/mediaRoutes.js:71)、[場景未帶 MIME](D:/meta_exb/web_ui_new/server/services/exhibitionSceneService.js:555)、[以 MIME／副檔名辨識](D:/meta_exb/web_ui_new/src/app/modules/metaverse3d/performance/sceneBudget.ts:103) | `/api/media/id` 圖片也能被計入；此問題不表示物件總數計算同時失效。 |
| 部分 AI 能力卡輸出固定英文 | [提示及替代問題](D:/meta_exb/web_ui_new/server/services/graduationSkillService.js:55)、[CV 共用該服務](D:/meta_exb/web_ui_new/server/services/cvService.js:4) | 繁中／簡中／英文介面下的建議與追問語言一致，並保留原文內容。 |
| 帳號匯出未含 CV | [匯出回傳項目](D:/meta_exb/web_ui_new/server/services/userDataExportService.js:222)、[CV 資料表](D:/meta_exb/web_ui_new/server/services/cvService.js:7) | 使用者可匯出自己的 CV 資料、卡片及所需歷程，清楚列明匯出範圍。 |

## 建議改善順序與驗證

1. **先保護內容與公開控制**：補齊站內草稿保護、典藏撤回及刪帳說明，驗證已發布快照與私人資料的不同生命週期。
2. **接通教學任務**：補私人教師審閱、工作台入口及邀請權限，用一位教師與一位學生完整走完投稿、退回、修改、核准、公開及撤回。
3. **統一建立體驗**：整理快速建立／六步精靈／進階編輯入口，補繼續草稿、手機替代路徑、登入返回及真正預覽。
4. **讓 AI 回饋可信**：修正風格傳遞、語言、替代結果提示與媒體計數，再用真實模型和既有媒體做受控驗證。
5. **最後調整視覺效率**：修正導覽擠壓、將上傳區移入首屏、收起非必要工具；另測鍵盤、窄螢幕與實機效能。

## 評估限制

- 使用隔離的本機測試服務及虛構帳號，沒有接觸現有網站。切入編輯器時系統自動建立了一個私人空展覽；發布確認已取消。
- 這輪沒有上傳新作品、執行實際發布、呼叫真實 AI／OAuth、多人共同操作或刪除帳號。相關判斷依程式碼與既有測試內容，並非本輪執行結果。
- 此次截圖只代表英文桌面介面；繁簡中文、小螢幕、鍵盤及螢幕閱讀器需要額外驗證。手機限制項來自程式碼，不是實機觀察。
- 整體判斷是產品與操作流程評估，未構成效能、安全或無障礙認證，也沒有宣稱完整測試套件於這輪通過。
