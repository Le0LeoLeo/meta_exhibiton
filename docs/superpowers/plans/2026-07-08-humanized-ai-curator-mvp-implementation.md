# Humanized AI Curator MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a curatorial intent selector, intent-aware curator generation, and more considerate Traditional Chinese status copy while preserving explicit confirmation before scene changes.

**Architecture:** Keep the AI Curator UI changes inside the existing metaverse editor panel, extracting local copy into a focused helper before adding intent. Extend the API request type, Express validation schema, and server prompt with a small `intent` enum. Update existing i18n strings and preload copy in place rather than adding a global messaging system.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Testing Library, Express ESM, Zod, OpenAI-compatible Qwen client.

---

## File Structure

- Create `src/app/modules/metaverse3d/components/UI/aiCuratorCopy.ts`
  - Owns AI Curator labels, intent labels, humanized status copy, and helper formatters.
- Modify `src/app/modules/metaverse3d/components/UI/AiCuratorPanel.tsx`
  - Uses extracted copy, adds `intent` state, sends intent in the request payload, renders intent summary, improves confirmation and error copy.
- Modify `src/app/modules/metaverse3d/components/UI/AiCuratorPanel.test.tsx`
  - Covers default intent, request payload, loading copy, confirmation copy, and error no-scene-loss copy.
- Modify `src/app/api/aiCurator.ts`
  - Adds `CuratorIntent` and optional `intent` to `CuratorPlanRequest`.
- Modify `server/routes/aiCuratorRoutes.js`
  - Validates `intent`, defaults it to `warm-memory`, and passes it to `generateCuratorPlan`.
- Modify `server/routes/aiCuratorRoutes.test.js`
  - Covers omitted, valid, and invalid intent.
- Modify `server/services/aiCuratorService.js`
  - Adds intent definitions, fallback tone hints, and prompt instructions.
- Modify `server/services/aiCuratorService.test.js`
  - Covers fallback behavior with intent and prompt text containing intent-specific instructions.
- Modify `src/app/components/I18nProvider.tsx`
  - Improves WebGL and performance copy in Traditional Chinese, Simplified Chinese, and English.
- Modify `src/app/features/metaverse-studio/canvas/PreloadOverlay.tsx`
  - Makes preload and asset-failure copy more reassuring.
- Modify `src/app/features/metaverse-studio/canvas/PreloadOverlay.test.tsx`
  - Updates assertions for the new copy.

## Task 1: Extract AI Curator Copy and Add Intent UI Tests

**Files:**
- Create: `src/app/modules/metaverse3d/components/UI/aiCuratorCopy.ts`
- Modify: `src/app/modules/metaverse3d/components/UI/AiCuratorPanel.tsx`
- Test: `src/app/modules/metaverse3d/components/UI/AiCuratorPanel.test.tsx`

- [ ] **Step 1: Write failing tests for intent and humanized panel behavior**

Replace the `text` object in `AiCuratorPanel.test.tsx` with:

```ts
const text = {
  theme: "\u5c55\u89bd\u4e3b\u984c",
  intent: "\u7b56\u5c55\u65b9\u5411",
  warmMemory: "\u6eab\u6696\u56de\u61b6",
  professionalGallery: "\u5c08\u696d\u5c55\u89bd",
  generate: "\u751f\u6210\u7b56\u5c55\u65b9\u6848",
  generating: "\u6b63\u5728\u6574\u7406\u4f60\u7684\u7b56\u5c55\u65b9\u5411\uff0c\u5148\u4e0d\u6703\u6539\u52d5\u76ee\u524d\u5c55\u5834\u3002",
  preserveExisting: "\u4fdd\u7559\u73fe\u6709\u5c55\u54c1",
  preserveWarning: "\u6703\u5148\u4fdd\u7559\u4f60\u73fe\u6709\u7684\u5c55\u54c1\u8cc7\u6599\uff0c\u518d\u6839\u64da\u65b0\u7684\u7b56\u5c55\u65b9\u5411\u6574\u7406\u5c55\u793a\u4f4d\u7f6e\u548c\u8aaa\u660e\u3002",
  preserveDetail: "\u6703\u4fdd\u7559\uff1a\u5df2\u4e0a\u50b3\u5a92\u9ad4\u3001\u73fe\u6709\u5c55\u54c1\u8cc7\u6599\u3002",
  changeDetail: "\u6703\u6574\u7406\uff1a\u5c55\u5340\u7bc0\u594f\u3001\u6587\u5b57\u8aaa\u660e\u3001\u71c8\u5149\u8207\u5c55\u793a\u4f4d\u7f6e\u3002",
  applyToScene: "\u5957\u7528\u5230\u5c55\u5ef3",
  confirmApply: "\u78ba\u8a8d\u5957\u7528",
  title: "\u6fb3\u9580\u975e\u907a\u6587\u5316\u5c55",
  counts: "1 \u500b\u5c55\u5340 / 1 \u4ef6\u5c55\u54c1",
  unchangedError: "\u9019\u6b21\u6c92\u6709\u6210\u529f\u751f\u6210\u8a08\u5283\u3002\u4f60\u7684\u5c55\u5834\u4ecd\u7136\u4fdd\u6301\u539f\u72c0\uff0c\u53ef\u4ee5\u7a0d\u5f8c\u91cd\u8a66\u3002",
};
```

In the first test, add these assertions immediately after render:

```tsx
expect(screen.getByLabelText(text.intent)).toHaveValue("warm-memory");
expect(screen.getByRole("option", { name: text.warmMemory })).toBeInTheDocument();
```

Change the first test's `requestCuratorPlan` mock to a deferred promise so loading copy is observable:

```tsx
let resolvePlan: (value: CuratorPlanResponse) => void = () => {};
const requestCuratorPlan = vi.fn().mockImplementation(() => (
  new Promise<CuratorPlanResponse>((resolve) => {
    resolvePlan = resolve;
  })
));
```

After entering the theme, before resolving the preview, assert the loading copy:

```tsx
fireEvent.click(screen.getByRole("button", { name: text.generate }));
expect(await screen.findByRole("button", { name: text.generating })).toBeDisabled();
resolvePlan(plan);
```

After `await screen.findByText(text.title);`, assert the request payload:

```tsx
expect(requestCuratorPlan).toHaveBeenCalledWith("token-1", expect.objectContaining({
  theme: text.title,
  intent: "warm-memory",
}));
```

After clicking `text.applyToScene`, assert the new confirmation details:

```tsx
expect(screen.getByText(text.preserveWarning)).toBeInTheDocument();
expect(screen.getByText(text.preserveDetail)).toBeInTheDocument();
expect(screen.getByText(text.changeDetail)).toBeInTheDocument();
```

In the error test, replace the alert assertion with:

```tsx
await waitFor(() => {
  expect(screen.getByRole("alert")).toHaveTextContent(text.unchangedError);
  expect(screen.getByRole("alert")).toHaveTextContent("network failed");
});
```

- [ ] **Step 2: Run the panel test and confirm it fails**

Run:

```bash
npm run test -- src/app/modules/metaverse3d/components/UI/AiCuratorPanel.test.tsx
```

Expected: FAIL because `intent` UI, loading copy, payload field, and new error copy do not exist yet.

- [ ] **Step 3: Create the copy helper**

Create `src/app/modules/metaverse3d/components/UI/aiCuratorCopy.ts`:

```ts
export type CuratorIntent = "warm-memory" | "professional-gallery" | "competition-showcase";

export const curatorIntentOptions: Array<{ value: CuratorIntent; label: string; summary: string }> = [
  {
    value: "warm-memory",
    label: "\u6eab\u6696\u56de\u61b6",
    summary: "\u4ee5\u4eba\u7269\u3001\u8a18\u61b6\u8207\u60c5\u611f\u7bc0\u594f\u4e32\u8d77\u5c55\u54c1\u3002",
  },
  {
    value: "professional-gallery",
    label: "\u5c08\u696d\u5c55\u89bd",
    summary: "\u4ee5\u6e05\u6670\u5206\u5340\u3001\u7cbe\u6e96\u8aaa\u660e\u8207\u7a69\u5b9a\u52d5\u7dda\u5448\u73fe\u3002",
  },
  {
    value: "competition-showcase",
    label: "\u6bd4\u8cfd\u5448\u73fe",
    summary: "\u7a81\u51fa\u4f5c\u54c1\u4eae\u9ede\u3001\u5b8c\u6210\u5ea6\u8207\u8a55\u5be9\u53ef\u5feb\u901f\u7406\u89e3\u7684\u91cd\u9ede\u3002",
  },
];

export const aiCuratorCopy = {
  title: "\u0041\u0049 \u7b56\u5c55\u52a9\u624b",
  signInError: "\u8acb\u5148\u767b\u5165\u518d\u4f7f\u7528 AI \u7b56\u5c55\u3002",
  failed: "\u0041\u0049 \u7b56\u5c55\u751f\u6210\u5931\u6557",
  unchangedError: "\u9019\u6b21\u6c92\u6709\u6210\u529f\u751f\u6210\u8a08\u5283\u3002\u4f60\u7684\u5c55\u5834\u4ecd\u7136\u4fdd\u6301\u539f\u72c0\uff0c\u53ef\u4ee5\u7a0d\u5f8c\u91cd\u8a66\u3002",
  theme: "\u5c55\u89bd\u4e3b\u984c",
  themePlaceholder: "\u4f8b\u5982\uff1a\u6fb3\u9580\u975e\u907a\u6587\u5316\u5c55",
  intent: "\u7b56\u5c55\u65b9\u5411",
  style: "\u98a8\u683c",
  whiteBox: "\u767d\u76d2\u5c55\u5ef3",
  warmMuseum: "\u6eab\u6696\u535a\u7269\u9928",
  techShowroom: "\u79d1\u6280\u5c55\u5ef3",
  historyGallery: "\u6b77\u53f2\u5c55\u5ef3",
  immersive: "\u6c89\u6d78\u5f0f",
  exhibits: "\u5c55\u54c1\u6578",
  audience: "\u76ee\u6a19\u89c0\u773e",
  audiencePlaceholder: "\u4f8b\u5982\uff1a\u4e2d\u5b78\u751f\u3001\u89aa\u5b50\u89c0\u773e\u3001\u4f01\u696d\u8a2a\u5ba2",
  language: "\u8a9e\u8a00",
  zhTw: "\u7e41\u9ad4\u4e2d\u6587",
  zhCn: "\u7c21\u9ad4\u4e2d\u6587",
  applyMode: "\u5957\u7528\u65b9\u5f0f",
  replace: "\u91cd\u5efa\u5c55\u5ef3",
  preserveExisting: "\u4fdd\u7559\u73fe\u6709\u5c55\u54c1",
  generating: "\u6b63\u5728\u6574\u7406\u4f60\u7684\u7b56\u5c55\u65b9\u5411\uff0c\u5148\u4e0d\u6703\u6539\u52d5\u76ee\u524d\u5c55\u5834\u3002",
  generate: "\u751f\u6210\u7b56\u5c55\u65b9\u6848",
  preview: "\u7b56\u5c55\u9810\u89bd",
  intentSummary: "\u7b56\u5c55\u65b9\u5411",
  replaceWarning: "\u6703\u4ee5\u9019\u4efd AI \u8349\u7a3f\u91cd\u6574\u76ee\u524d\u5c55\u5834\u3002\u82e5\u6709\u5df2\u4e0a\u50b3\u4f5c\u54c1\uff0c\u8acb\u5148\u78ba\u8a8d\u662f\u5426\u8981\u6539\u7528\u300c\u4fdd\u7559\u73fe\u6709\u5c55\u54c1\u300d\u3002",
  preserveWarning: "\u6703\u5148\u4fdd\u7559\u4f60\u73fe\u6709\u7684\u5c55\u54c1\u8cc7\u6599\uff0c\u518d\u6839\u64da\u65b0\u7684\u7b56\u5c55\u65b9\u5411\u6574\u7406\u5c55\u793a\u4f4d\u7f6e\u548c\u8aaa\u660e\u3002",
  preserveDetail: "\u6703\u4fdd\u7559\uff1a\u5df2\u4e0a\u50b3\u5a92\u9ad4\u3001\u73fe\u6709\u5c55\u54c1\u8cc7\u6599\u3002",
  changeDetail: "\u6703\u6574\u7406\uff1a\u5c55\u5340\u7bc0\u594f\u3001\u6587\u5b57\u8aaa\u660e\u3001\u71c8\u5149\u8207\u5c55\u793a\u4f4d\u7f6e\u3002",
  confirmHint: "\u78ba\u8a8d\u5f8c\u624d\u6703\u5957\u7528\u5230\u76ee\u524d\u7de8\u8f2f\u5668\uff0c\u4f60\u4ecd\u53ef\u4ee5\u9010\u4ef6\u8abf\u6574\u3002",
  confirmApply: "\u78ba\u8a8d\u5957\u7528",
  applyToScene: "\u5957\u7528\u5230\u5c55\u5ef3",
  backToPreview: "\u8fd4\u56de\u9810\u89bd",
  discard: "\u6368\u68c4",
};

export function formatGeneratedCounts(sectionCount: number, exhibitCount: number) {
  return `${sectionCount} \u500b\u5c55\u5340 / ${exhibitCount} \u4ef6\u5c55\u54c1`;
}

export function getCuratorIntentLabel(intent: CuratorIntent) {
  return curatorIntentOptions.find((option) => option.value === intent)?.label ?? curatorIntentOptions[0].label;
}
```

- [ ] **Step 4: Use extracted copy and add intent UI in the panel**

In `AiCuratorPanel.tsx`, replace the local `copy` object and `formatGeneratedCounts` with imports:

```ts
import {
  aiCuratorCopy as copy,
  curatorIntentOptions,
  formatGeneratedCounts,
  getCuratorIntentLabel,
  type CuratorIntent,
} from "./aiCuratorCopy";
```

Add state after `theme`:

```ts
const [intent, setIntent] = useState<CuratorIntent>("warm-memory");
```

Add `intent` to the request payload:

```ts
const result = await requestCuratorPlan(token, {
  theme: theme.trim(),
  style,
  audience: audience.trim() || undefined,
  language,
  exhibitCount,
  intent,
});
```

Replace the catch block with:

```ts
} catch (err) {
  const detail = err instanceof Error ? err.message : copy.failed;
  setError(`${copy.unchangedError} ${detail}`);
} finally {
```

Insert this label between the theme textarea and the style/exhibit grid:

```tsx
<label className="block text-[11px] text-slate-700">
  {copy.intent}
  <select
    value={intent}
    onChange={(event) => setIntent(event.target.value as CuratorIntent)}
    className="mt-1 w-full rounded-xl border border-cyan-200 bg-white px-2 py-1.5 text-xs text-slate-900"
  >
    {curatorIntentOptions.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
</label>
```

Inside the preview header, after the introduction paragraph, add:

```tsx
<p className="mt-1 rounded-lg border border-emerald-100 bg-white px-2 py-1.5 text-[11px] text-emerald-800">
  {copy.intentSummary}\uff1a{getCuratorIntentLabel(intent)}
</p>
```

Inside the confirmation block, after the counts paragraph, add:

```tsx
<p>{copy.preserveDetail}</p>
<p>{copy.changeDetail}</p>
```

- [ ] **Step 5: Run the panel test and verify it passes**

Run:

```bash
npm run test -- src/app/modules/metaverse3d/components/UI/AiCuratorPanel.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/app/modules/metaverse3d/components/UI/AiCuratorPanel.tsx src/app/modules/metaverse3d/components/UI/AiCuratorPanel.test.tsx src/app/modules/metaverse3d/components/UI/aiCuratorCopy.ts
git commit -m "feat: add humanized ai curator intent UI" -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

## Task 2: Extend API and Server Validation for Intent

**Files:**
- Modify: `src/app/api/aiCurator.ts`
- Modify: `server/routes/aiCuratorRoutes.js`
- Test: `server/routes/aiCuratorRoutes.test.js`

- [ ] **Step 1: Add route tests for default, valid, and invalid intent**

In `server/routes/aiCuratorRoutes.test.js`, update the existing `"calls generateCuratorPlan with defaults for omitted optional fields"` expectation to include the default:

```js
expect(generateCuratorPlan).toHaveBeenCalledWith({
  theme: '澳門非遺文化展',
  language: 'zh-TW',
  exhibitCount: 6,
  intent: 'warm-memory',
});
```

Add this test before the `returns 500` test:

```js
it('passes a valid curator intent to generation', async () => {
  const generateCuratorPlan = vi.fn().mockResolvedValue({
    exhibition: { title: 'Competition plan' },
  });
  const response = await postCuratorPlan(await startApp({ generateCuratorPlan }), {
    theme: 'Student design awards',
    intent: 'competition-showcase',
  });

  expect(response.status).toBe(200);
  expect(generateCuratorPlan).toHaveBeenCalledWith({
    theme: 'Student design awards',
    language: 'zh-TW',
    exhibitCount: 6,
    intent: 'competition-showcase',
  });
});

it('returns 400 for invalid curator intent', async () => {
  const generateCuratorPlan = vi.fn();
  const response = await postCuratorPlan(await startApp({ generateCuratorPlan }), {
    theme: 'Macau history',
    intent: 'cold-sales-pitch',
  });

  expect(response.status).toBe(400);
  expect((await response.json()).message).toBeTruthy();
  expect(generateCuratorPlan).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run route tests and confirm failure**

Run:

```bash
npm run test -- server/routes/aiCuratorRoutes.test.js
```

Expected: FAIL because the validation schema does not include `intent`.

- [ ] **Step 3: Update the frontend API type**

In `src/app/api/aiCurator.ts`, add the enum type above `CuratorPlanRequest`:

```ts
export type CuratorIntent = "warm-memory" | "professional-gallery" | "competition-showcase";
```

Add the optional field to `CuratorPlanRequest`:

```ts
intent?: CuratorIntent;
```

- [ ] **Step 4: Update the route schema**

In `server/routes/aiCuratorRoutes.js`, add this constant above `curatorPlanSchema`:

```js
const curatorIntentSchema = z.enum([
  'warm-memory',
  'professional-gallery',
  'competition-showcase',
]);
```

Add this field inside `curatorPlanSchema`:

```js
intent: curatorIntentSchema.default('warm-memory'),
```

- [ ] **Step 5: Run route tests and TypeScript-facing panel tests**

Run:

```bash
npm run test -- server/routes/aiCuratorRoutes.test.js
npm run test -- src/app/modules/metaverse3d/components/UI/AiCuratorPanel.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/app/api/aiCurator.ts server/routes/aiCuratorRoutes.js server/routes/aiCuratorRoutes.test.js
git commit -m "feat: validate ai curator intent" -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

## Task 3: Make Curator Service Intent-Aware

**Files:**
- Modify: `server/services/aiCuratorService.js`
- Test: `server/services/aiCuratorService.test.js`

- [ ] **Step 1: Add service tests for intent fallback and prompt instructions**

In `server/services/aiCuratorService.test.js`, add these tests before the JSON extraction test:

```js
it('uses warm memory language in fallback plans when requested', async () => {
  const { generateCuratorPlan } = await import('./aiCuratorService.js');

  const result = await generateCuratorPlan({
    theme: 'Graduation memories',
    exhibitCount: 3,
    intent: 'warm-memory',
  });

  expect(result.source).toBe('fallback');
  expect(result.exhibition.introduction).toContain('memory');
  expect(result.exhibition.guideOpening).toContain('story');
});

it('adds intent-specific instructions to model messages', async () => {
  const { _private } = await import('./aiCuratorService.js');

  const messages = _private.buildCuratorMessages({
    theme: 'Student design awards',
    language: 'zh-TW',
    intent: 'competition-showcase',
  }, 6);

  expect(messages[1].content).toContain('Curatorial intent: competition-showcase');
  expect(messages[1].content).toContain('highlight strengths, completion quality, and judging clarity');
});
```

- [ ] **Step 2: Run service tests and confirm failure**

Run:

```bash
npm run test -- server/services/aiCuratorService.test.js
```

Expected: FAIL because `_private.buildCuratorMessages` is not exported and fallback/prompt do not use intent.

- [ ] **Step 3: Add intent helpers to the service**

In `server/services/aiCuratorService.js`, add these constants after `ALLOWED_PLACEMENT_HINTS`:

```js
const DEFAULT_INTENT = 'warm-memory';
const INTENT_INSTRUCTIONS = {
  'warm-memory': 'Use a warm, memory-led tone that connects people, places, and lived experience without becoming sentimental.',
  'professional-gallery': 'Use a precise gallery tone with clear sections, concise labels, and a calm visitor flow.',
  'competition-showcase': 'Use a showcase tone that highlights strengths, completion quality, and judging clarity.',
};
```

Add this helper after `clampExhibitCount`:

```js
function normalizeIntent(value) {
  return Object.prototype.hasOwnProperty.call(INTENT_INSTRUCTIONS, value)
    ? value
    : DEFAULT_INTENT;
}
```

- [ ] **Step 4: Update fallback copy to reflect intent**

At the top of `createFallbackPlan`, add:

```js
const intent = normalizeIntent(input.intent);
```

Replace the fallback introduction and guide opening values with:

```js
introduction: intent === 'warm-memory'
  ? `A guided exhibition plan for ${theme}, arranged as a warm memory-led journey through people, places, and lived experience.`
  : `A guided exhibition plan for ${theme}, arranged for a balanced virtual gallery experience.`,
guideOpening: intent === 'competition-showcase'
  ? `Welcome to ${theme}. Move through each section to understand the strongest ideas, execution quality, and judging highlights.`
  : `Welcome to ${theme}. Move through each section as a connected story rather than a checklist.`,
```

Keep the existing warnings array unchanged; do not add a second warning just because `intent` is present.

- [ ] **Step 5: Update prompt construction**

In `buildCuratorMessages`, add:

```js
const intent = normalizeIntent(input.intent);
const intentInstruction = INTENT_INSTRUCTIONS[intent];
```

Add these lines to the user content array after `Exhibit count`:

```js
`Curatorial intent: ${intent}`,
`Intent instruction: ${intentInstruction}`,
```

- [ ] **Step 6: Export helpers for tests**

At the bottom `_private` export, add:

```js
buildCuratorMessages,
normalizeIntent,
```

- [ ] **Step 7: Run service tests**

Run:

```bash
npm run test -- server/services/aiCuratorService.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add server/services/aiCuratorService.js server/services/aiCuratorService.test.js
git commit -m "feat: make ai curator plans intent aware" -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

## Task 4: Humanize WebGL, Performance, and Preload Status Copy

**Files:**
- Modify: `src/app/components/I18nProvider.tsx`
- Modify: `src/app/features/metaverse-studio/canvas/PreloadOverlay.tsx`
- Test: `src/app/features/metaverse-studio/canvas/PreloadOverlay.test.tsx`

- [ ] **Step 1: Update preload overlay tests for reassuring copy**

In `PreloadOverlay.test.tsx`, replace the existing text assertions with:

```tsx
expect(screen.getByText("正在準備展覽，資料仍會保留")).toBeInTheDocument();
expect(screen.getByText("正在載入附近作品與互動，可以先進入後再繼續補載。")).toBeInTheDocument();
expect(screen.getByText("1 個資源暫時載入失敗，已先略過；展覽資料仍然保留。")).toBeInTheDocument();
expect(screen.getByRole("status")).toHaveTextContent("正在載入附近作品與互動，可以先進入後再繼續補載。");
```

- [ ] **Step 2: Run preload tests and confirm failure**

Run:

```bash
npm run test -- src/app/features/metaverse-studio/canvas/PreloadOverlay.test.tsx
```

Expected: FAIL because the copy still says the shorter existing loading messages.

- [ ] **Step 3: Update preload overlay copy**

In `PreloadOverlay.tsx`, replace `stageLabels` with:

```ts
const stageLabels: Record<SceneLoadStage, string> = {
  interface: "準備展覽介面，資料仍會保留",
  core: "建立展館與操作空間，先不會改動你的內容",
  nearby: "正在載入附近作品與互動，可以先進入後再繼續補載。",
  complete: "展覽已準備完成",
};
```

Replace `failureMessage` with:

```ts
const failureMessage =
  failedAssets > 0 ? `${failedAssets} 個資源暫時載入失敗，已先略過；展覽資料仍然保留。` : "";
```

Replace the title text:

```tsx
<div className="text-sm font-medium text-white">正在準備展覽，資料仍會保留</div>
```

- [ ] **Step 4: Update i18n strings for WebGL and performance copy**

In `src/app/components/I18nProvider.tsx`, replace the Traditional Chinese values:

```ts
perfAutoDesc: '自動依裝置與即時效能調整畫質；需要降級時會優先保留展覽內容與操作流暢。',
perfAutoTitleDev: '自動調整畫質以維持流暢觀展，展覽資料不會因此改動',
perfBatteryDesc: '優先維持流暢度並降低耗電，適合裝置變慢或發熱時使用',
perfBalancedDesc: '平衡畫質與流暢度，適合大多數展覽編輯情境',
webglErrorTitle: '3D 畫面暫時無法載入',
webglErrorDesc: '瀏覽器暫停或回收了 WebGL 內容。你的展覽資料仍在，可以重新載入 3D 畫面或改用較低效能模式。',
```

Replace the Simplified Chinese values:

```ts
perfAutoDesc: '自动依装置与即时性能调整画质；需要降级时会优先保留展览内容与操作流畅。',
perfAutoTitleDev: '自动调整画质以维持流畅观展，展览资料不会因此改动',
perfBatteryDesc: '优先维持流畅度并降低耗电，适合装置变慢或发热时使用',
perfBalancedDesc: '平衡画质与流畅度，适合大多数展览编辑情境',
webglErrorTitle: '3D 画面暂时无法载入',
webglErrorDesc: '浏览器暂停或回收了 WebGL 内容。你的展览资料仍在，可以重新载入 3D 画面或改用较低性能模式。',
```

Replace the English values:

```ts
perfAutoDesc: 'Automatically adjusts quality for the device and current performance while keeping exhibition content unchanged.',
perfAutoTitleDev: 'Auto-adjust quality for smooth viewing without changing exhibition data',
perfBatteryDesc: 'Prioritizes smoothness and lower power use when the device slows down or heats up',
perfBalancedDesc: 'Balances quality and smoothness for most exhibition editing sessions',
webglErrorTitle: '3D Scene Is Temporarily Unavailable',
webglErrorDesc: 'The browser paused or reclaimed WebGL content. Your exhibition data is still safe; reload the 3D view or switch to a lower performance mode.',
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm run test -- src/app/features/metaverse-studio/canvas/PreloadOverlay.test.tsx
npm run test -- src/app/modules/metaverse3d/components/WebGLRecoveryOverlay.test.tsx
```

Expected: PASS. If `WebGLRecoveryOverlay.test.tsx` only checks roles and old copy is not asserted, it should still pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/app/components/I18nProvider.tsx src/app/features/metaverse-studio/canvas/PreloadOverlay.tsx src/app/features/metaverse-studio/canvas/PreloadOverlay.test.tsx
git commit -m "feat: humanize gallery status copy" -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

## Task 5: Final Verification

**Files:**
- Review only unless failures require fixes.

- [ ] **Step 1: Run all touched focused tests**

Run:

```bash
npm run test -- src/app/modules/metaverse3d/components/UI/AiCuratorPanel.test.tsx
npm run test -- server/routes/aiCuratorRoutes.test.js
npm run test -- server/services/aiCuratorService.test.js
npm run test -- src/app/features/metaverse-studio/canvas/PreloadOverlay.test.tsx
npm run test -- src/app/modules/metaverse3d/components/WebGLRecoveryOverlay.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run server syntax check**

Run:

```bash
npm run check:server
```

Expected: PASS.

- [ ] **Step 3: Run full validation**

Run:

```bash
npm run check
```

Expected: PASS. If unrelated existing failures appear, capture the failing test names and exact errors in the final handoff instead of changing unrelated files.

- [ ] **Step 4: Inspect git diff**

Run:

```bash
git diff --stat HEAD
git diff -- src/app/modules/metaverse3d/components/UI/AiCuratorPanel.tsx src/app/modules/metaverse3d/components/UI/aiCuratorCopy.ts src/app/api/aiCurator.ts server/routes/aiCuratorRoutes.js server/services/aiCuratorService.js src/app/components/I18nProvider.tsx src/app/features/metaverse-studio/canvas/PreloadOverlay.tsx
```

Expected: diff only contains the planned intent, validation, prompt, and copy changes.

- [ ] **Step 5: Commit any verification fixes**

If Step 1, 2, or 3 required small fixes, commit them:

```bash
git add <fixed-files>
git commit -m "fix: stabilize humanized ai curator mvp" -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

If no fixes were needed, do not create an empty commit.
