# Humanized AI Curator MVP Design

## Goal

讓現有 AI Curator 和 3D editor 的互動更有「人情味」：使用者感覺系統理解他的創作意圖、尊重原有展品，並在等待、套用、錯誤和低效能狀態中清楚告訴他下一步可以怎樣做。

這不是新增大型社交功能，也不是讓 AI 過度擬人。MVP 的重點是把已存在的 AI curator、apply confirmation、loading/error/recovery 狀態打磨成更像一位可靠策展助理。

## Current Baseline

專案已經有：

- `src/app/modules/metaverse3d/components/UI/AiCuratorPanel.tsx` 的 AI Curator 面板。
- `POST /api/ai/curator-plan` 生成結構化策展計劃。
- `mapCuratorPlanToScene` 將策展計劃映射成 3D scene。
- 已本地化的 apply confirmation，避免使用者未確認就覆蓋場景。
- WebGL recovery、adaptive performance、preload overlay 等狀態處理基礎。

目前的缺口是：AI 可以生成和套用計劃，但仍偏「功能正確」。使用者未必知道 AI 理解了甚麼、會改甚麼、保留甚麼，也未必在錯誤或效能降級時感到安心。

## Product Principles

1. **尊重原作**  
   AI 預設是整理觀看節奏，而不是取代創作者。任何套用前都要說明會改動的範圍，以及哪些現有內容會保留。

2. **先理解，再建議**  
   AI Curator 生成前加入簡短意圖選擇，讓使用者不用寫長 prompt 也能表達展覽希望帶出的感覺。

3. **狀態有下一步**  
   loading、error、WebGL recovery、低效能提示都應包含簡短原因和可行下一步，避免只顯示技術錯誤。

4. **不假裝真人**  
   文案可以溫暖，但不使用「我很在乎你」這類過度情緒化句子。語氣應像專業、可靠、尊重創作者的助理。

## Recommended MVP

實作三個小功能：

### 1. Curatorial Intent

在 AI Curator brief form 增加一個「策展方向」選擇：

- `warm-memory`：溫暖回憶
- `professional-gallery`：專業展覽
- `competition-showcase`：比賽呈現

這個欄位會傳到 curator API，後端 prompt 用它影響 title、introduction、section summary、guide opening 和 exhibit description 的語氣。

前端預設為 `warm-memory`，因為專案已有 growth memories、virtual gallery、student/competition 展示等情境，溫暖回憶是最貼近「人情味」的起點。

### 2. Respectful Apply Confirmation

現有 apply confirmation 改成更具體的保護式摘要：

- 會加入或更新的 section 數量。
- 會加入或更新的 exhibit 數量。
- 會保留的內容，例如已上傳媒體、作品名稱、未被 AI 計劃覆蓋的現有展品。
- 會改動的內容，例如動線、文字說明、燈光或展示位置。

如果目前 scene 已有展品，確認文案必須避免只說「取代目前場景」。應改成「套用前會先保留你現有的展品資料，再根據新計劃整理展示位置和說明」。實際保留規則要和 `mapCuratorPlanToScene(preview, currentScene)` 的行為一致。

### 3. Humanized Status Copy

建立一組可重用的繁中文案常數，先覆蓋以下狀態：

- AI Curator generating。
- AI Curator request error。
- AI Curator fallback plan warning。
- Apply success toast。
- WebGL recovery overlay。
- Performance mode downgrade notice。
- Scene preload overlay。

文案格式統一為：

- 一句人話狀態：發生了甚麼。
- 一句下一步：使用者可以等、重試、切換模式、保留目前場景或繼續編輯。

範例：

- 生成中：「正在整理你的策展方向，先不會改動目前展場。」
- 生成失敗：「這次沒有成功生成計劃。你的展場仍然保持原狀，可以稍後重試。」
- 套用成功：「已按新的策展方向整理展場。你仍可逐件調整位置和說明。」
- WebGL recovery：「3D 畫面暫時無法載入。你的展覽資料仍在，可以重新整理或改用較低效能模式。」

## Architecture

### Frontend

修改 AI Curator 面板和相關型別：

- `AiCuratorPanel` 增加 `intent` form state。
- curator request payload 增加 `intent`。
- preview 顯示「策展方向」摘要。
- confirmation 區塊改用保護式摘要。
- 新增或整理 `humanizedCopy` 常數，避免散落硬編碼文案。

狀態文案優先在現有 UI component 裏替換，不新增全域 notification 系統。

### Backend

擴充 curator request schema：

```ts
type CuratorIntent =
  | "warm-memory"
  | "professional-gallery"
  | "competition-showcase";

type CuratorPlanRequest = {
  theme: string;
  style?: string;
  audience?: string;
  language?: "zh-TW" | "zh-CN" | "en";
  exhibitCount?: number;
  intent?: CuratorIntent;
};
```

後端驗證 `intent`，預設為 `warm-memory`。AI prompt 不要求模型回傳 raw coordinates，只把 intent 轉成內容語氣和策展敘事要求。

### Scene Mapping

MVP 不改變 scene item schema。若現有 mapper 已保留展品，confirmation 文案要反映這點；若 mapper 實際會取代 scene，必須先調整 mapper 或把文案降級為清楚告知「會以新草稿重整場景」。

原則是：文案不能承諾程式沒有做到的保護。

## UX Flow

1. 使用者開啟 AI Curator。
2. 輸入 theme，選擇策展方向。
3. 按下生成，看到「目前不會改動展場」的 loading copy。
4. 生成完成後，preview 顯示標題、段落、展品和策展方向摘要。
5. 使用者按套用。
6. confirmation 顯示會保留甚麼、會整理甚麼。
7. 使用者確認後才 import scene。
8. 成功 toast 告知已整理完成，並提醒仍可手動調整。

## Error Handling

- AI request 失敗不改動 scene。
- fallback plan 顯示溫和 warning，不把 fallback 描述成錯誤。
- intent 不合法時後端回 validation error；前端顯示可重試文案。
- WebGL 或 performance 問題不能暗示資料遺失。
- 所有文案保留診斷資訊的入口，例如 details 或原始 error message，方便開發除錯。

## Testing Strategy

### Frontend Tests

- `AiCuratorPanel` renders intent choices with `warm-memory` selected by default.
- Generating sends the selected intent to the curator API.
- Loading copy says the current gallery will not be changed yet.
- Confirmation summary distinguishes preserved content from changed layout/copy.
- Import happens only after final confirmation.
- Error copy states the scene remains unchanged.

### Backend Tests

- Curator API accepts valid intent values.
- Missing intent defaults to `warm-memory`.
- Invalid intent is rejected by schema validation.
- Prompt/service mapping includes intent-specific instructions.
- Fallback response still works when intent is present.

### Copy Review

Manual review Traditional Chinese copy for:

- Warm but not childish.
- Clear next action.
- No promise that conflicts with implementation.
- Consistent terms for 展場, 展品, 策展方向, 套用, 保留, 整理.

## Out Of Scope

- Visitor-facing AI guide or NPC dialogue.
- Multiplayer presence, reactions, or comments.
- Persistent user preference memory.
- Streaming AI responses.
- Voice, TTS, or avatar behavior.
- New analytics or admin tooling.
- Full rewrite of the AI curator prompt pipeline.

These can become later phases after this MVP proves that small interaction changes make the editor feel more considerate.

## Definition Of Done

- AI Curator has a clear curatorial intent selector.
- Generated requests include intent and backend validation covers it.
- Apply confirmation accurately explains what is preserved and what changes.
- Loading, error, fallback, apply success, WebGL recovery, performance, and preload states use humanized Traditional Chinese copy.
- Existing curator behavior remains deterministic and scene changes still require explicit confirmation.
- Focused tests cover request payload, validation, confirmation, and no-scene-loss error behavior.
