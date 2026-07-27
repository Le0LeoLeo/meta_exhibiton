# AI Exhibition Builder Agent Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 將目前的「整場重生」流程改造成能讀取現有場景與展品、輸出安全增量操作、保留使用者內容，並能如實呈現審核失敗的 AI 建展 Agent。

**Architecture:** 保留現有 Qwen 相容 API、Express 路由與 React 編輯器，但把模型輸出拆成「策展資料」與「場景操作計畫」。後端以 Zod 驗證 allowlist 操作，再由 deterministic executor 對 `currentScene` 套用 patch、經既有 `sanitizeSceneSnapshot` 與 `normalizeSceneGeometry` 收斂；視覺審核只提供回饋，不再掩蓋 provider failure。初次建展可以建立基礎場景，修訂則必須以目前版本為基礎做增量變更。

**Tech Stack:** Vite, React 18, TypeScript, Express ESM, Zod, Three.js / React Three Fiber, Vitest, Qwen OpenAI-compatible API.

---

## Product invariants

以下條件是本計畫的不可退讓驗收標準：

1. 使用者已有的 `painting`、`assetId`、`assetUrl`、標題、作者與描述不得因修訂而遺失。
2. 修訂請求必須引用 `currentScene` 中的真實 item ID；模型不得直接回傳任意完整 scene snapshot。
3. 模型只可使用 allowlist 操作；未知操作、未知 item ID、非法座標或超量操作必須被拒絕。
4. Provider、JSON parse、視覺審核或截圖失敗必須在 API 與 UI 清楚標示，不可偽裝成成功審核。
5. 每次 Agent run 最多 3 次 revision，只有分數或 blocking issues 確實改善時才繼續。
6. 未設定 AI provider 時，單次 deterministic fallback 仍可用，但 UI 必須明示「範本模式」，不可顯示為 AI 成功。
7. 所有 scene patch 套用後仍須通過 `sanitizeSceneSnapshot` 與 `normalizeSceneGeometry`。

## Non-goals

- 不在本批次加入新的 agent framework、向量資料庫或長期記憶。
- 不允許模型執行任意 JavaScript、SQL、檔案或網路工具。
- 不重寫 3D renderer、Zustand store 或建展精靈。
- 不在第一版實作自由形式多 Agent 協作；維持單一 planner/reviewer loop。

---

### Task 1: 鎖定現有缺陷的回歸測試

**Files:**
- Modify: `server/services/exhibitionSceneService.test.js`
- Modify: `server/services/exhibitionBuilderAgentService.test.js`
- Modify: `src/app/modules/metaverse3d/aiBuilder/runExhibitionBuilderAgent.test.ts`

**Step 1: 為 `currentScene` 保留行為寫 failing test**

建立含既有作品的 snapshot：

```js
const currentScene = {
  roomSize: validRoomSize,
  items: [{
    id: 'painting-user-1',
    type: 'painting',
    position: [1, 2.5, -9.8],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    content: '/api/media/assets/user-1',
    assetId: 'asset-user-1',
    assetUrl: '/api/media/assets/user-1',
    title: '媽閣記憶',
    artist: 'Student A',
    description: '使用者原始說明',
  }],
  floorPlanElements: [],
  wallMaterialOverrides: {},
};
```

Stub provider 回傳只移動 `painting-user-1` 的操作，斷言結果保留 `content`、`assetId`、`title`、`artist` 與 `description`。

**Step 2: 為 provider/review failure 透明度寫 failing test**

斷言視覺 provider throw 時回傳 `status: "unavailable"`、`source: "fallback"`、`errorCode: "VISION_PROVIDER_FAILED"`，而不是 `status: "reviewed"`。

**Step 3: 為沒有改善就停止迴圈寫 failing test**

在前端 runner 連續回傳相同分數與 issues，斷言只 revision 一次並以 `stopReason: "no_improvement"` 結束。

**Step 4: 執行測試並確認失敗原因正確**

Run:

```bash
npm run test -- server/services/exhibitionSceneService.test.js server/services/exhibitionBuilderAgentService.test.js src/app/modules/metaverse3d/aiBuilder/runExhibitionBuilderAgent.test.ts
```

Expected: FAIL，分別指出現有流程重建 scene、review failure 被轉成 reviewed、runner 沒有改善判斷。

**Step 5: Commit**

```bash
git add server/services/exhibitionSceneService.test.js server/services/exhibitionBuilderAgentService.test.js src/app/modules/metaverse3d/aiBuilder/runExhibitionBuilderAgent.test.ts
git commit -m "test: define exhibition builder agent guarantees" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

---

### Task 2: 建立安全的場景操作 schema 與 executor

**Files:**
- Create: `server/services/exhibitionSceneOperations.js`
- Create: `server/services/exhibitionSceneOperations.test.js`
- Modify: `server/services/exhibitionSceneService.js`

**Step 1: 為 allowlist 操作寫 failing tests**

覆蓋下列操作：

```js
export const operationTypes = [
  'update-room-style',
  'move-item',
  'update-item-copy',
  'update-item-display',
  'add-text',
  'add-light',
  'add-furniture',
  'remove-generated-item',
];
```

測試必須證明：

- `move-item` 只能引用現有 ID。
- `update-item-copy` 不可覆寫 `content`、`assetId` 或 `assetUrl`。
- `remove-generated-item` 只能刪除 `ai-`、`label-`、`light-`、`section-` 前綴項目。
- 單次最多 100 個操作。
- position/rotation/scale 只接受有限數字。
- 未知操作會以 `INVALID_SCENE_OPERATION` 拒絕。

**Step 2: 實作 discriminated-union Zod schema**

核心 contract：

```js
export const sceneOperationPlanSchema = z.object({
  schemaVersion: z.literal(1),
  summary: z.string().trim().min(1).max(500),
  operations: z.array(sceneOperationSchema).max(100),
});
```

每個操作只列出必要欄位，不接受 passthrough unknown keys。顏色、材質 preset、文字長度、光照強度與 frame size 沿用 `sceneSchema.js` 的限制。

**Step 3: 實作 immutable executor**

```js
export function applySceneOperationPlan(currentScene, plan) {
  const source = sanitizeSceneSnapshot(structuredClone(currentScene));
  const parsedPlan = sceneOperationPlanSchema.parse(plan);
  const next = parsedPlan.operations.reduce(applyOneOperation, source);
  return normalizeSceneGeometry(sanitizeSceneSnapshot(next));
}
```

Executor 必須建立 item ID map、拒絕 duplicate IDs，且不可改動輸入 object。

**Step 4: 執行 focused tests**

Run:

```bash
npm run test -- server/services/exhibitionSceneOperations.test.js
```

Expected: PASS。

**Step 5: Commit**

```bash
git add server/services/exhibitionSceneOperations.js server/services/exhibitionSceneOperations.test.js server/services/exhibitionSceneService.js
git commit -m "feat: add validated exhibition scene operations" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

---

### Task 3: 建立精簡且不洩漏大型 media payload 的場景 context

**Files:**
- Create: `server/services/exhibitionSceneContext.js`
- Create: `server/services/exhibitionSceneContext.test.js`
- Modify: `server/services/exhibitionSceneService.js`

**Step 1: 寫 failing tests**

測試 `buildSceneContext(currentScene)`：

- 包含 room 尺寸、材質、item ID/type/position/title/artist/description。
- 優先提供 `assetUrl` 或 `thumbnailUrl`。
- `data:`、`blob:` 與超過 500 字元的 `content` 只輸出 `{ media: "embedded-content-omitted" }`。
- 不輸出 upload token、任意 unknown properties 或完整 base64。
- 最多輸出 100 個 items；超量時附 `truncated: true`。

**Step 2: 實作 context builder**

輸出形狀固定為：

```js
{
  room: { width, length, height, wallColor, wallMaterialPreset, floorColor },
  items: [{ id, type, position, rotation, scale, title, artist, description, media }],
  countsByType: { painting: 8, text: 4, lightstrip: 8 },
  protectedItemIds: ['painting-user-1'],
  generatedItemIds: ['ai-title', 'section-01-title'],
  truncated: false,
}
```

含 `assetId` 或不符合 generated ID 規則的 painting 一律列入 `protectedItemIds`。

**Step 3: 將 context 放入模型 user prompt**

修改 `buildUserPrompt(input)`，加入：

```js
mode: input.currentScene ? 'revise-existing-scene' : 'create-new-scene',
sceneContext: input.currentScene ? buildSceneContext(input.currentScene) : null,
```

並明確指示模型只可引用 context 中的 ID。

**Step 4: 執行測試**

Run:

```bash
npm run test -- server/services/exhibitionSceneContext.test.js server/services/exhibitionSceneService.test.js
```

Expected: PASS，且 prompt snapshot 不包含 `data:image/` 或 `blob:`。

**Step 5: Commit**

```bash
git add server/services/exhibitionSceneContext.js server/services/exhibitionSceneContext.test.js server/services/exhibitionSceneService.js
git commit -m "feat: ground builder prompts in current scene context" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

---

### Task 4: 讓 Qwen 回傳策展計畫與 scene operations，而非完整重建

**Files:**
- Modify: `server/services/exhibitionSceneService.js`
- Modify: `server/services/exhibitionSceneService.test.js`

**Step 1: 更新 provider contract 的 failing tests**

Revision provider fixture 必須回傳：

```json
{
  "exhibition": {
    "title": "澳門城市記憶",
    "curatorialStatement": "從海岸、街區到生活記憶。",
    "sections": []
  },
  "operationPlan": {
    "schemaVersion": 1,
    "summary": "重新分散作品並改善入口閱讀性",
    "operations": [
      {
        "type": "move-item",
        "itemId": "painting-user-1",
        "position": [-4, 2.5, -9.8],
        "rotation": [0, 0, 0]
      }
    ]
  }
}
```

斷言沒有被操作的 items 與 floor plan 完整保留。

**Step 2: 分開 create 與 revise prompt**

- Create mode：模型產生策展 metadata；現有 deterministic `createCuratedScene` 建立初始可用場景。
- Revise mode：模型產生 metadata + `operationPlan`；只以 executor 套用增量操作。
- System prompt 明示 protected items 不得刪除或換 media。
- 將 temperature 降至 `0.2`，保留 `enable_thinking: false`，並要求 JSON-only。

**Step 3: 嚴格解析 provider response**

不要再用「第一個 `{` 到最後一個 `}`」作為唯一保證。先解析完整 JSON；如需相容 fenced JSON，只允許單一 fenced block。解析或 schema validation 失敗時回傳 typed provider error，不可默默使用部分資料。

**Step 4: 實作 revision path**

```js
if (input.currentScene) {
  const plan = sceneOperationPlanSchema.parse(parsed.operationPlan);
  const applied = applySceneOperationPlan(input.currentScene, plan);
  return {
    exhibition: normalizeExhibitionMetadata(input, parsed),
    scene: applied.scene,
    operations: plan.operations,
    operationSummary: plan.summary,
    warnings: applied.warnings,
    source: 'qwen',
  };
}
```

若 provider 不可用，revision 不可自行重排使用者場景；回傳原 scene、`source: "fallback"` 和清楚 warning。

**Step 5: 執行測試**

Run:

```bash
npm run test -- server/services/exhibitionSceneService.test.js server/services/exhibitionSceneOperations.test.js server/services/exhibitionSceneContext.test.js
```

Expected: PASS。

**Step 6: Commit**

```bash
git add server/services/exhibitionSceneService.js server/services/exhibitionSceneService.test.js
git commit -m "feat: revise exhibitions with incremental scene plans" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

---

### Task 5: 修正 builder session、review 與 revision API 語意

**Files:**
- Modify: `server/services/exhibitionBuilderAgentService.js`
- Modify: `server/services/exhibitionBuilderAgentService.test.js`
- Modify: `server/routes/exhibitionSceneRoutes.js`
- Modify: `server/routes/exhibitionSceneRoutes.test.js`
- Modify: `src/app/api/exhibitionScene.ts`
- Modify: `src/app/api/exhibitionScene.test.ts`

**Step 1: 擴充 response types 的 failing tests**

新增欄位：

```ts
type BuilderProviderSource = "qwen" | "fallback";
type BuilderReviewStatus = "reviewed" | "unavailable";

type BuilderSessionResponse = ExhibitionSceneResponse & {
  sessionId: string;
  versionId: string;
  status: "generated" | "revised";
  operationSummary?: string;
  appliedOperationCount?: number;
  revisionCount: number;
};

type BuilderReviewResponse = {
  sessionId: string;
  versionId: string;
  review: BuilderReview | null;
  status: BuilderReviewStatus;
  source: BuilderProviderSource;
  errorCode?: "VISION_PROVIDER_FAILED" | "INVALID_VISION_RESPONSE";
  message?: string;
};
```

**Step 2: 不再把 review exception 包裝成 reviewed**

`reviewBuilderSession` 捕捉 provider exception 後回傳 `status: "unavailable"` 與 `review: null`。Deterministic preflight 可以另外回傳為 `preflight`，但不可冒充 VL 結果。

**Step 3: Revision route 拒絕 unavailable review**

`builderReviseRequestSchema` 接受明確的 review；若 UI 想在沒有 VL 時手動修訂，必須以 `prompt` 進入 `manual-revision` mode，而非傳假 review。

**Step 4: 保留安全錯誤訊息**

Server log 記錄完整 provider error；API 只回傳穩定的 `errorCode` 與使用者可理解訊息，不能洩漏 API key、provider request 或 stack。

**Step 5: 執行 focused tests**

Run:

```bash
npm run test -- server/services/exhibitionBuilderAgentService.test.js server/routes/exhibitionSceneRoutes.test.js src/app/api/exhibitionScene.test.ts
```

Expected: PASS。

**Step 6: Commit**

```bash
git add server/services/exhibitionBuilderAgentService.js server/services/exhibitionBuilderAgentService.test.js server/routes/exhibitionSceneRoutes.js server/routes/exhibitionSceneRoutes.test.js src/app/api/exhibitionScene.ts src/app/api/exhibitionScene.test.ts
git commit -m "fix: expose builder provider and review failures" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

---

### Task 6: 讓 Agent loop 依改善程度停止

**Files:**
- Modify: `src/app/modules/metaverse3d/aiBuilder/runExhibitionBuilderAgent.ts`
- Modify: `src/app/modules/metaverse3d/aiBuilder/runExhibitionBuilderAgent.test.ts`

**Step 1: 定義 progress 與 stop reason**

```ts
type BuilderAgentPhase =
  | "generating"
  | "capturing"
  | "reviewing"
  | "revising"
  | "completed"
  | "stopped";

type BuilderAgentStopReason =
  | "passed"
  | "revision_limit"
  | "no_improvement"
  | "review_unavailable";
```

`onStep` 回傳 phase、attempt、maxRevisions、scores、message。

**Step 2: 寫 improvement comparator**

```ts
export function didReviewImprove(previous: BuilderReview, next: BuilderReview) {
  const previousHigh = previous.blockingIssues.filter((issue) => issue.severity === "high").length;
  const nextHigh = next.blockingIssues.filter((issue) => issue.severity === "high").length;
  return nextHigh < previousHigh
    || next.technicalScore >= previous.technicalScore + 3
    || next.curatorialScore >= previous.curatorialScore + 3;
}
```

第一次 review 可以 revision；第二次起若沒有改善立即停止，保留分數較高的 session/review。

**Step 3: 處理 unavailable review**

若 review status 是 `unavailable`，立即回傳目前 session 與 `stopReason: "review_unavailable"`；不得自動 revision 三次。

**Step 4: 執行測試**

Run:

```bash
npm run test -- src/app/modules/metaverse3d/aiBuilder/runExhibitionBuilderAgent.test.ts
```

Expected: PASS，覆蓋 pass、改善、無改善、review unavailable、revision limit 與 scene restore。

**Step 5: Commit**

```bash
git add src/app/modules/metaverse3d/aiBuilder/runExhibitionBuilderAgent.ts src/app/modules/metaverse3d/aiBuilder/runExhibitionBuilderAgent.test.ts
git commit -m "fix: stop builder agent when revisions do not improve" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

---

### Task 7: 改善編輯器輸入、進度與差異預覽

**Files:**
- Create: `src/app/modules/metaverse3d/aiBuilder/buildBuilderInput.ts`
- Create: `src/app/modules/metaverse3d/aiBuilder/buildBuilderInput.test.ts`
- Create: `src/app/modules/metaverse3d/aiBuilder/summarizeSceneDiff.ts`
- Create: `src/app/modules/metaverse3d/aiBuilder/summarizeSceneDiff.test.ts`
- Modify: `src/app/modules/metaverse3d/components/UI/EditUI.tsx`
- Modify: `src/app/modules/metaverse3d/components/UI/EditUI.test.tsx`
- Modify: relevant locale files found via `rg -n "editorAiBuilder" src`

**Step 1: 從目前 scene 建立 builder input**

`buildBuilderInput(scene, formValues)` 將 paintings 轉為 assets：

```ts
{
  title: item.title,
  artist: item.artist,
  description: item.description,
  imageUrl: item.assetUrl ?? item.thumbnailUrl,
  type: item.fileMimeType?.startsWith("video/") ? "video" : "image",
}
```

不得把 `blob:` 或 `data:` URL 放進 request assets；`currentScene` 仍保留給後端 context builder，但 API body 大小測試必須覆蓋 embedded content 情境。

**Step 2: 將 `buildBuilderInput` 用於 generate 與 Agent run**

取代 `EditUI.tsx` 內兩處手動 payload，確保單次生成與自動 Agent 使用相同輸入。

**Step 3: 顯示清楚 phase**

UI 使用在地化文字顯示：

- 正在理解目前展覽
- 正在生成操作計畫
- 正在擷取檢查視角
- 正在進行視覺審核
- 正在套用第 N 次改善
- 審核服務暫時不可用
- 因沒有進一步改善而停止

不要顯示 `VL status`、`source: qwen` 等內部術語作為主要文案；provider/source 可放在展開的診斷區。

**Step 4: 顯示套用前 diff**

`summarizeSceneDiff(before, after)` 至少計算：

```ts
{
  movedItemIds: string[],
  copyUpdatedItemIds: string[],
  addedItemIds: string[],
  removedGeneratedItemIds: string[],
  protectedItemsPreserved: boolean,
}
```

Preview 顯示「移動 6 件作品、更新 4 個標籤、新增 2 盞燈」。若 protected item 遺失，停用套用按鈕並顯示錯誤。

**Step 5: 維持 preview-first 與可回復性**

Agent 只在離屏 inspection 時暫時 import scene；最終仍需使用者按「套用」。套用必須經 store 的單次 `importScene`，讓既有 undo snapshot 能回復；若現有 import 不建立 undo，先加 focused store test，再以既有 action pattern 修正。

**Step 6: 執行測試**

Run:

```bash
npm run test -- src/app/modules/metaverse3d/aiBuilder/buildBuilderInput.test.ts src/app/modules/metaverse3d/aiBuilder/summarizeSceneDiff.test.ts src/app/modules/metaverse3d/components/UI/EditUI.test.tsx
```

Expected: PASS。

**Step 7: Commit**

```bash
git add src/app/modules/metaverse3d/aiBuilder src/app/modules/metaverse3d/components/UI/EditUI.tsx src/app/modules/metaverse3d/components/UI/EditUI.test.tsx src
git commit -m "feat: show grounded builder progress and scene diff" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

提交前用 `git diff --cached --name-only` 確認沒有把不相關的 `src` 變更帶入；若有，改用精確檔名重新 stage。

---

### Task 8: 建立行為評測，避免「測試全過但 Agent 不好用」

**Files:**
- Create: `server/services/fixtures/exhibitionBuilderCases.js`
- Create: `server/services/exhibitionBuilderEvaluation.test.js`
- Modify: `server/services/exhibitionSceneService.test.js`

**Step 1: 建立 deterministic evaluation cases**

至少包含：

1. 「保留 8 件澳門照片，依海岸／街區／日常分三區」。
2. 「只改善入口照明，不移動作品」。
3. 「把媽閣記憶移到第一區，但不可改圖片及作者」。
4. 「移除 AI 裝飾，但保留使用者上傳雕塑」。
5. 「審核指出路徑阻塞後，只移動 bench 與 rug」。

Fixtures 使用 stubbed provider JSON，不連外、不消耗 token。

**Step 2: 對每個 case 定義機器可驗證 assertions**

- protected item ID set 相同。
- protected media fields deep-equal。
- 操作 type 符合 expected allowlist subset。
- 指定不應移動的 item position deep-equal。
- 最終 scene 可通過 `sanitizeSceneSnapshot`。
- deterministic preflight 的 high issues 不增加。

**Step 3: 加入失敗 provider cases**

覆蓋 timeout、空回應、Markdown JSON、未知 operation、未知 item ID 與超過 100 operations；每個 case 必須得到穩定 error code 或安全 fallback。

**Step 4: 執行 agent evaluation suite**

Run:

```bash
npm run test -- server/services/exhibitionBuilderEvaluation.test.js
```

Expected: PASS，且全程無外部 API request。

**Step 5: Commit**

```bash
git add server/services/fixtures/exhibitionBuilderCases.js server/services/exhibitionBuilderEvaluation.test.js server/services/exhibitionSceneService.test.js
git commit -m "test: add exhibition builder behavior evaluation" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

---

### Task 9: 完整驗證與文件更新

**Files:**
- Modify: `.env.example`
- Modify: `doc/README.md`
- Modify: this plan only if implementation discoveries require corrections

**Step 1: 更新環境設定文件**

記錄：

```dotenv
QWEN_API_KEY=
QWEN_MODEL=qwen3.6-plus
QWEN_VL_MODEL=qwen-vl-max-latest
QWEN_TIMEOUT_MS=30000
```

說明 text model 與 VL model 的用途、缺失時的 UI 行為，以及 production 不應把 key 放到 Vite client env。

**Step 2: 執行 server syntax 與 typecheck**

Run:

```bash
npm run check:server
npm run typecheck
```

Expected: PASS。

**Step 3: 執行完整相關測試**

Run:

```bash
npm run test -- server/services/exhibitionSceneOperations.test.js server/services/exhibitionSceneContext.test.js server/services/exhibitionSceneService.test.js server/services/exhibitionBuilderAgentService.test.js server/services/exhibitionBuilderEvaluation.test.js server/routes/exhibitionSceneRoutes.test.js src/app/api/exhibitionScene.test.ts src/app/modules/metaverse3d/aiBuilder src/app/modules/metaverse3d/components/UI/EditUI.test.tsx
```

Expected: PASS。

**Step 4: 執行 build**

Run:

```bash
npm run build
```

Expected: PASS，沒有新增 bundle budget failure。

**Step 5: 手動驗收**

從 `web_ui_new/` 啟動：

```bash
npm run dev
```

在建展編輯器依序驗證：

1. 上傳至少 3 件有不同標題與作者的作品。
2. 輸入「保留全部作品，分成兩區並改善入口燈光」。
3. Preview 顯示操作摘要與 diff，原作品 media/metadata 不變。
4. 套用後場景符合 preview，undo 可還原。
5. 暫時使用無效 VL model，確認 UI 顯示審核不可用並停止，而非盲目 revision。
6. 暫時使用無效 text model，確認 UI 顯示範本／provider failure，不宣稱 AI 完成。

**Step 6: 執行 full validation**

只在 focused tests、typecheck 與 build 全部通過後執行：

```bash
npm run check
```

Expected: PASS。若被工作樹內既有且不相關的變更阻擋，記錄確切 command、failure 與不相關檔案，不可為了過關改動無關程式碼。

**Step 7: Commit**

```bash
git add .env.example doc/README.md
git commit -m "docs: document exhibition builder agent configuration" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

---

## Definition of done

- `currentScene` 實際進入 prompt context 並成為 revision 基礎。
- 使用者作品與 media references 在所有 revision 中保持不變，除非使用者明確要求修改可修改的 metadata。
- 模型輸出經 allowlist Zod schema 與 deterministic executor 套用。
- Review failure、provider fallback、no-improvement 與 revision-limit 在 API/UI 有不同狀態。
- Preview 在套用前顯示可理解的 scene diff。
- Agent 不會在 review unavailable 或連續無改善時盲目重跑。
- 行為評測覆蓋至少 5 個真實建展意圖與 6 個 failure cases。
- Focused tests、server syntax、typecheck、build 與 `npm run check` 通過，或清楚記錄只由既有無關變更造成的阻擋。

## Rollout and observability

第一版不需新增資料庫。Server 使用結構化 log 記錄以下非敏感欄位：`sessionId`、`versionId`、`phase`、`providerSource`、`operationCount`、`reviewStatus`、`revisionCount`、`stopReason` 與 duration；不得記錄 prompt 全文、圖片 data URL、API key 或完整 scene。若 production 需要漸進推出，再加 server-side `AI_EXHIBITION_PATCH_AGENT_ENABLED` feature flag，預設關閉於 production、開啟於 development；不要使用 `VITE_` 暴露 server flag。

