# AI Exhibition Passport Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 建立一個可持續遊玩的「AI 展覽護照」MVP，讓登入訪客在 3D 展覽完成三項探索任務、取得可分享的紀念卡，並讓已公開的紀念卡成為首頁的新鮮內容。

**Architecture:** 以現有 `visitor_memories` 作為訪客行為來源，新增獨立的 `exhibition_passports` 資料表保存任務、完成狀態與不可變的紀念卡快照。伺服器負責產生任務及驗證完成條件；前端使用同規則作即時進度預覽，但完成操作必須先儲存最新 visitor memory，再由伺服器重新計算。分享採明確 opt-in：完成護照不會自動公開，只有按下分享後才建立公開 token。

**Tech Stack:** Vite, React 18, TypeScript, Zustand, Tailwind CSS v4, shadcn/Radix, Express ESM, SQLite, Zod, Vitest.

**Relevant skills for execution:** `@andrej-karpathy-skills:karpathy-guidelines`, `@ui-ux-pro-max`, `@threejs-interaction`.

---

## Product contract

### Core loop

1. 登入訪客進入已發佈的 3D 展覽。
2. AI 導賞員以非阻塞方式送上三項護照任務。
3. 訪客探索作品時，護照進度即時更新。
4. 三項任務完成後，訪客可寫最多 280 字的感想並領取紀念卡。
5. 紀念卡預設私人；訪客主動按「分享」後才產生公開連結。
6. 已公開的紀念卡可出現在首頁「最近完成的旅程」。

### MVP task set

任務不依賴外部 AI provider，確保沒有 Qwen API key 時仍可完成。AI NPC 負責呈現、鼓勵與解說；規則保持 deterministic。

| Task kind | 預設條件 | 小型展覽調整 |
|---|---:|---:|
| `visit-count` | 看過 3 件作品 | `min(3, 可探索作品數)` |
| `dwell-one` | 在任何作品停留 20 秒 | 不變 |
| `engage-count` | 深入互動 1 件作品 | 不變 |

「可探索作品」只計算 `painting`、`pedestal` 和 `text`；燈光、牆、長椅及裝飾物不計算。

### Product invariants

- 完成資格由 server 依已儲存的 visitor memory 驗證，不能只相信 client 的 `completed: true`。
- `GET passport` 可以懶建立護照，但同一 user/gallery 永遠只有一筆。
- 完成紀念卡是 snapshot；展覽之後改名或換作品，不應改寫已完成的卡。
- 完成不等於公開。沒有 share token 的紀念卡不能由公開 API 讀取。
- 公開紀念卡預設不展示訪客姓名、email 或 user ID。
- 分享 token 使用 `crypto.randomUUID()`，不能由 user ID 或 gallery ID 推算。
- 任務面板可收起、可用鍵盤操作，所有 icon-only controls 有 accessible name。
- 動畫遵守 `prefers-reduced-motion`；不以顏色作唯一完成提示。
- API provider、TTS 或 WebGL 失敗時，不得令現有參觀及留言功能失效。

### Non-goals

- 積分商城、每日簽到、排行榜、付費獎勵或 NFT。
- 任務由 LLM 每次自由生成；MVP 只使用固定、可驗證的任務類型。
- 匿名訪客的跨裝置持久化。未登入訪客只看到登入後可保存護照的提示。
- 產生 PNG/JPEG 紀念卡；MVP 分享的是 responsive web card URL。
- 2D 模式的完整任務追蹤。MVP 先保持 2D 內容可正常瀏覽，Phase 2 再抽出跨模式 journey tracker。
- 即時開幕禮、展覽傳送門及 Remix；它們應有獨立計劃。

---

## API contract

### Authenticated endpoints

```text
GET  /api/exhibition-passports/:galleryId
POST /api/exhibition-passports/:galleryId/complete
POST /api/exhibition-passports/:galleryId/share
```

`GET` response:

```ts
type ExhibitionPassport = {
  id: string;
  galleryId: string;
  status: "active" | "completed";
  tasks: Array<
    | { id: "visit-count"; kind: "visit-count"; target: number }
    | { id: "dwell-one"; kind: "dwell-one"; targetSeconds: number }
    | { id: "engage-count"; kind: "engage-count"; target: number }
  >;
  progress: {
    completedTaskIds: string[];
    visitedCount: number;
    engagedCount: number;
    longestDwellSeconds: number;
    complete: boolean;
  };
  souvenir: ExhibitionSouvenir | null;
};
```

`POST complete` request:

```json
{ "reflection": "我最記得光線落在第二件作品的感覺。" }
```

If incomplete, return `409`:

```json
{
  "message": "passport tasks are not complete",
  "code": "PASSPORT_INCOMPLETE",
  "progress": { "completedTaskIds": ["visit-count"], "complete": false }
}
```

`POST share` is idempotent and returns:

```json
{
  "token": "uuid",
  "sharePath": "/souvenirs/uuid"
}
```

### Public endpoints

```text
GET /api/exhibition-souvenirs/:token
GET /api/exhibition-souvenirs?limit=6
```

The list endpoint returns only rows with a non-null share token, caps `limit` at 12, and never returns `userId`.

---

### Task 1: Add the pure passport rules

**Files:**
- Create: `server/services/exhibitionPassportRules.js`
- Create: `server/services/exhibitionPassportRules.test.js`

- [ ] **Step 1: Write failing tests for task generation**

Cover galleries with 0, 1, 2, and 5 eligible exhibits. Assert that zero eligible exhibits returns `available: false`; otherwise `visit-count.target` equals `Math.min(3, eligibleCount)` and task IDs remain stable.

Use this contract in the test:

```js
expect(buildPassportTasks({ eligibleExhibitCount: 5 })).toEqual({
  available: true,
  tasks: [
    { id: 'visit-count', kind: 'visit-count', target: 3 },
    { id: 'dwell-one', kind: 'dwell-one', targetSeconds: 20 },
    { id: 'engage-count', kind: 'engage-count', target: 1 },
  ],
});
```

- [ ] **Step 2: Write failing tests for progress evaluation**

Test deduplication, unknown exhibit IDs, negative/NaN dwell values, exact boundary `20`, and incomplete progress. The evaluator signature is:

```js
evaluatePassportProgress(tasks, memory, eligibleExhibitIds)
```

Expected result shape:

```js
{
  completedTaskIds: ['visit-count', 'dwell-one', 'engage-count'],
  visitedCount: 3,
  engagedCount: 1,
  longestDwellSeconds: 24,
  complete: true,
}
```

- [ ] **Step 3: Run the tests and confirm RED**

Run:

```bash
npm run test -- server/services/exhibitionPassportRules.test.js
```

Expected: FAIL because the rules module does not exist.

- [ ] **Step 4: Implement the minimum rules module**

Export:

```js
export const PASSPORT_ELIGIBLE_TYPES = new Set(['painting', 'pedestal', 'text']);
export function getEligibleExhibits(scene) { /* filter and normalize scene.items */ }
export function buildPassportTasks({ eligibleExhibitCount }) { /* stable tasks */ }
export function evaluatePassportProgress(tasks, memory, eligibleExhibitIds) { /* pure */ }
```

Do not add AI calls, randomness, dates, database access, or UI copy to this module.

- [ ] **Step 5: Run the focused test and confirm GREEN**

Run the same command. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/services/exhibitionPassportRules.js server/services/exhibitionPassportRules.test.js
git commit -m "feat: define exhibition passport rules" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

---

### Task 2: Persist passports and souvenir snapshots

**Files:**
- Modify: `server/db.js`
- Modify: `server/dbInitialization.test.js`
- Modify: `server/dataIntegrity.test.js`

- [ ] **Step 1: Write failing schema and cascade tests**

Assert initialization creates the table and indexes, deleting a user/gallery removes its passports, and duplicate `(user_id, gallery_id)` rows fail.

Required schema:

```sql
CREATE TABLE IF NOT EXISTS exhibition_passports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  gallery_id TEXT NOT NULL,
  tasks_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  souvenir_json TEXT,
  souvenir_token TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(gallery_id) REFERENCES galleries(id) ON DELETE CASCADE,
  UNIQUE(user_id, gallery_id)
);
```

Also create:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_exhibition_passports_souvenir_token
ON exhibition_passports(souvenir_token)
WHERE souvenir_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_exhibition_passports_public_recent
ON exhibition_passports(completed_at DESC)
WHERE souvenir_token IS NOT NULL;
```

- [ ] **Step 2: Run DB tests and confirm RED**

```bash
npm run test -- server/dbInitialization.test.js server/dataIntegrity.test.js
```

Expected: FAIL because the table does not exist.

- [ ] **Step 3: Add schema initialization after `visitor_memories`**

Keep the existing initialization completion callback correct: the final `finish()` must run only after all schema statements have been queued. Do not remove or reorder existing React/Tailwind-related code elsewhere.

- [ ] **Step 4: Add database helpers**

Export from `server/db.js`:

```js
getExhibitionPassport(userId, galleryId)
insertExhibitionPassport(passport)
completeExhibitionPassport({ id, souvenir, completedAt })
publishExhibitionPassport({ id, souvenirToken })
getPublishedSouvenirByToken(token)
listRecentPublishedSouvenirs(limit)
```

Parse JSON at the DB boundary. Public helpers return the parsed `souvenir` only and never expose `user_id`.

- [ ] **Step 5: Run DB tests and confirm GREEN**

Run the same test command. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/db.js server/dbInitialization.test.js server/dataIntegrity.test.js
git commit -m "feat: persist exhibition passports" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

---

### Task 3: Build the authoritative passport service

**Files:**
- Create: `server/services/exhibitionPassportService.js`
- Create: `server/services/exhibitionPassportService.test.js`

- [ ] **Step 1: Write failing service tests**

Cover:

- lazily creating one passport for a published gallery;
- returning the existing passport without replacing its tasks;
- rejecting galleries with no eligible exhibits;
- deriving progress from `getVisitorMemory`;
- returning `PASSPORT_INCOMPLETE` before completion;
- selecting the favorite exhibit by greatest dwell time;
- taking gallery title, owner name and exhibit title into an immutable souvenir snapshot;
- completing twice without changing `completedAt` or snapshot;
- publishing twice with the same token;
- omitting visitor identity from the public snapshot.

- [ ] **Step 2: Run tests and confirm RED**

```bash
npm run test -- server/services/exhibitionPassportService.test.js
```

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement dependency-injected service functions**

Use a factory so route tests can provide fakes:

```js
export function createExhibitionPassportService(deps) {
  return {
    getOrCreatePassport,
    completePassport,
    sharePassport,
    getPublicSouvenir,
    listPublicSouvenirs,
  };
}
```

`completePassport` must:

1. load the published gallery and parse `sceneJson` safely;
2. load the passport and visitor memory;
3. call `evaluatePassportProgress`;
4. throw a typed `PASSPORT_INCOMPLETE` error when necessary;
5. build and persist this bounded snapshot:

```js
{
  schemaVersion: 1,
  galleryId,
  galleryTitle,
  galleryOwnerName,
  completedAt,
  visitedCount,
  engagedCount,
  totalDwellSeconds,
  favoriteExhibit: { id, title, thumbnailUrl: safeMediaPathOrNull },
  reflection,
}
```

Clamp count values, strip `blob:` and `data:` URLs, and cap reflection at 280 characters in the route schema as well as the service boundary.

- [ ] **Step 4: Run tests and confirm GREEN**

Run the same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/exhibitionPassportService.js server/services/exhibitionPassportService.test.js
git commit -m "feat: add exhibition passport service" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

---

### Task 4: Expose authenticated passport and public souvenir routes

**Files:**
- Create: `server/routes/exhibitionPassportRoutes.js`
- Create: `server/routes/exhibitionPassportRoutes.test.js`
- Modify: `server/config/deps.js`
- Modify: `server/index.js`
- Modify: `server/security/rateLimitConfig.js`
- Modify: `server/security/rateLimitConfig.test.js`

- [ ] **Step 1: Write failing route tests**

Test all five endpoints, including 401, invalid gallery ID, reflection over 280 characters, incomplete 409, unknown token 404, list limit clamping, and absence of private fields in public JSON.

Use these Zod boundaries:

```js
const galleryIdSchema = z.string().trim().min(1).max(120);
const completeSchema = z.object({
  reflection: z.string().trim().max(280).optional().default(''),
});
const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(12).optional().default(6),
});
```

- [ ] **Step 2: Run route tests and confirm RED**

```bash
npm run test -- server/routes/exhibitionPassportRoutes.test.js server/security/rateLimitConfig.test.js
```

- [ ] **Step 3: Implement routes and error mapping**

Map service errors explicitly:

```text
PASSPORT_UNAVAILABLE -> 422
PASSPORT_INCOMPLETE  -> 409
GALLERY_NOT_FOUND    -> 404
PASSPORT_NOT_FOUND   -> 404
SOUVENIR_NOT_FOUND   -> 404
```

Unexpected errors return the standard generic 500 response and are logged without leaking visitor memory.

- [ ] **Step 4: Wire dependencies and rate limits**

Register `registerExhibitionPassportRoutes(app, deps.exhibitionPassport)` in `server/index.js`. Add a moderate authenticated mutation limiter for complete/share and a public read limiter for souvenir pages. Keep route business logic in the service.

- [ ] **Step 5: Run focused tests and server syntax check**

```bash
npm run test -- server/routes/exhibitionPassportRoutes.test.js server/security/rateLimitConfig.test.js
npm run check:server
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/routes/exhibitionPassportRoutes.js server/routes/exhibitionPassportRoutes.test.js server/config/deps.js server/index.js server/security/rateLimitConfig.js server/security/rateLimitConfig.test.js
git commit -m "feat: expose exhibition passport APIs" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

---

### Task 5: Add the typed frontend API client

**Files:**
- Create: `src/app/api/exhibitionPassport.ts`
- Create: `src/app/api/exhibitionPassport.test.ts`
- Modify: `src/app/api/index.ts`

- [ ] **Step 1: Write failing API client tests**

Mock `apiFetch` and assert URL encoding, auth headers, JSON body, safe JSON parsing, 409 error propagation, and public requests without authorization headers.

- [ ] **Step 2: Run tests and confirm RED**

```bash
npm run test -- src/app/api/exhibitionPassport.test.ts
```

- [ ] **Step 3: Implement types and functions**

Export:

```ts
getExhibitionPassport(token, galleryId)
completeExhibitionPassport(token, galleryId, reflection)
shareExhibitionPassport(token, galleryId)
getExhibitionSouvenir(publicToken)
listRecentExhibitionSouvenirs(limit?)
```

Reuse `apiUrl`, `authHeaders`, `apiFetch`, `parseJsonSafe`, and `errorFromResponse`. Do not introduce a second fetch wrapper.

- [ ] **Step 4: Run tests and confirm GREEN**

Run the same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/exhibitionPassport.ts src/app/api/exhibitionPassport.test.ts src/app/api/index.ts
git commit -m "feat: add exhibition passport client" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

---

### Task 6: Add instant progress calculation and the passport panel

**Files:**
- Create: `src/app/modules/metaverse3d/passport/passportProgress.ts`
- Create: `src/app/modules/metaverse3d/passport/passportProgress.test.ts`
- Create: `src/app/modules/metaverse3d/components/UI/ExhibitionPassportPanel.tsx`
- Create: `src/app/modules/metaverse3d/components/UI/ExhibitionPassportPanel.test.tsx`
- Modify: `src/app/modules/metaverse3d/components/UI/ViewUI.tsx`
- Modify: `src/app/modules/metaverse3d/components/UI/ViewUI.test.tsx`

- [ ] **Step 1: Write parity tests for frontend progress**

Mirror the server rule fixtures exactly. The frontend function is only optimistic UI; add a comment that server progress remains authoritative.

- [ ] **Step 2: Write failing component tests**

Cover loading, unavailable, collapsed, `2 / 3`, complete, keyboard toggle, retry, and unauthenticated sign-in prompt. Assert task labels include textual completion state, not only checkmark color.

- [ ] **Step 3: Run tests and confirm RED**

```bash
npm run test -- src/app/modules/metaverse3d/passport/passportProgress.test.ts src/app/modules/metaverse3d/components/UI/ExhibitionPassportPanel.test.tsx
```

- [ ] **Step 4: Implement the presentational panel**

Use Lucide icons already installed. The collapsed button must be at least 44×44 px and expose progress in its accessible name. Avoid scale-based hover that shifts layout. Use 150–300 ms opacity/color transitions and `motion-reduce:transition-none`.

Recommended component props:

```ts
type ExhibitionPassportPanelProps = {
  passport: ExhibitionPassport | null;
  progress: PassportProgress | null;
  state: 'loading' | 'ready' | 'unavailable' | 'error' | 'signed-out';
  onRetry: () => void;
  onComplete: () => void;
};
```

- [ ] **Step 5: Integrate with `ViewUI`**

In view mode with `exhibitionId`:

- load the passport after auth is known;
- derive optimistic progress from `agent.memory` and eligible `items`;
- keep the panel out of edit and floor-plan modes;
- do not force the panel open over `AgentModeSelector`;
- show one non-blocking NPC/system message when the passport first becomes ready;
- avoid repeated fetches when `viewingItem` or dwell seconds change.

Do not move passport state into the global Zustand store in this MVP; it is server-backed UI state local to `ViewUI`.

- [ ] **Step 6: Run focused tests and confirm GREEN**

```bash
npm run test -- src/app/modules/metaverse3d/passport/passportProgress.test.ts src/app/modules/metaverse3d/components/UI/ExhibitionPassportPanel.test.tsx src/app/modules/metaverse3d/components/UI/ViewUI.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/modules/metaverse3d/passport src/app/modules/metaverse3d/components/UI/ExhibitionPassportPanel.tsx src/app/modules/metaverse3d/components/UI/ExhibitionPassportPanel.test.tsx src/app/modules/metaverse3d/components/UI/ViewUI.tsx src/app/modules/metaverse3d/components/UI/ViewUI.test.tsx
git commit -m "feat: show exhibition passport progress" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

---

### Task 7: Complete the passport and create an opt-in share flow

**Files:**
- Create: `src/app/modules/metaverse3d/components/UI/PassportCompletionDialog.tsx`
- Create: `src/app/modules/metaverse3d/components/UI/PassportCompletionDialog.test.tsx`
- Modify: `src/app/modules/metaverse3d/components/UI/ViewUI.tsx`
- Modify: `src/app/modules/metaverse3d/components/UI/ViewUI.test.tsx`

- [ ] **Step 1: Write failing completion tests**

Assert:

- dialog opens only when all local tasks are complete;
- reflection counter stops at 280;
- pressing complete first awaits `saveVisitorMemory`, then calls `completeExhibitionPassport`;
- 409 refreshes the passport and explains that progress is still syncing;
- completion success does not automatically call share;
- share button calls the share endpoint once and shows copy/native-share controls;
- cancel keeps the completed private card available in the panel.

- [ ] **Step 2: Run tests and confirm RED**

```bash
npm run test -- src/app/modules/metaverse3d/components/UI/PassportCompletionDialog.test.tsx src/app/modules/metaverse3d/components/UI/ViewUI.test.tsx
```

- [ ] **Step 3: Implement the dialog with explicit privacy copy**

Use the existing Radix dialog primitive and `sonner`. Copy must state:「完成後紀念卡仍是私人；只有按下分享才會公開。」

Share behavior:

```ts
if (navigator.share) {
  await navigator.share({ title, text, url: absoluteShareUrl });
} else {
  await navigator.clipboard.writeText(absoluteShareUrl);
}
```

Clipboard/native share failure should leave the URL visible and selectable.

- [ ] **Step 4: Wire an explicit memory flush**

Extract the current debounced visitor-memory payload builder in `ViewUI` into a small local helper so background save and completion save use identical data. Completion order is:

```text
await saveVisitorMemory(...latestPayload)
await completeExhibitionPassport(...reflection)
refresh passport
```

- [ ] **Step 5: Run tests and confirm GREEN**

Run the same command. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/metaverse3d/components/UI/PassportCompletionDialog.tsx src/app/modules/metaverse3d/components/UI/PassportCompletionDialog.test.tsx src/app/modules/metaverse3d/components/UI/ViewUI.tsx src/app/modules/metaverse3d/components/UI/ViewUI.test.tsx
git commit -m "feat: complete and share exhibition passports" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

---

### Task 8: Add the public souvenir page and homepage activity section

**Files:**
- Create: `src/app/pages/ExhibitionSouvenir.tsx`
- Create: `src/app/pages/ExhibitionSouvenir.test.tsx`
- Create: `src/app/components/RecentSouvenirs.tsx`
- Create: `src/app/components/RecentSouvenirs.test.tsx`
- Modify: `src/app/pages/Home.tsx`
- Modify: `src/app/routes.ts`

- [ ] **Step 1: Write failing page/component tests**

Cover loading, not found, public snapshot rendering, no visitor identity, empty recent list, API failure hidden gracefully, six-card cap, and links back to the original exhibition.

- [ ] **Step 2: Run tests and confirm RED**

```bash
npm run test -- src/app/pages/ExhibitionSouvenir.test.tsx src/app/components/RecentSouvenirs.test.tsx src/app/routes.test.ts
```

- [ ] **Step 3: Implement the public page**

Add route:

```tsx
{ path: 'souvenirs/:token', lazy: lazyPage(() => import('./pages/ExhibitionSouvenir')) }
```

The page uses semantic headings, a readable fallback when no thumbnail exists, a link to `/exhibitions/:galleryId`, and a CTA to explore more exhibitions. Never render raw HTML from reflection.

- [ ] **Step 4: Add recent public souvenirs to home**

Insert `<RecentSouvenirs />` between `Showcase` and `Testimonials` in `Home.tsx`. The section should:

- render nothing on API failure so home remains resilient;
- use a skeleton with reserved height while loading;
- label cards by exhibition and completion date, not visitor identity;
- use the existing site tokens rather than a separate neon theme;
- use CSS effects only—no new image-generation or chart dependency.

- [ ] **Step 5: Run tests and confirm GREEN**

Run the same command. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/ExhibitionSouvenir.tsx src/app/pages/ExhibitionSouvenir.test.tsx src/app/components/RecentSouvenirs.tsx src/app/components/RecentSouvenirs.test.tsx src/app/pages/Home.tsx src/app/routes.ts src/app/routes.test.ts
git commit -m "feat: surface shared exhibition souvenirs" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

---

### Task 9: Localize the full experience

**Files:**
- Modify: `src/app/i18n/catalogs/zh-TW.ts`
- Modify: `src/app/i18n/catalogs/zh-CN.ts`
- Modify: `src/app/i18n/catalogs/en.ts`
- Modify: `src/app/i18n/catalogs/catalogs.test.ts`

- [ ] **Step 1: Add failing catalog parity assertions**

Add all `passport*` and `souvenir*` keys to the expected-key test before adding translations.

- [ ] **Step 2: Run and confirm RED**

```bash
npm run test -- src/app/i18n/catalogs/catalogs.test.ts
```

- [ ] **Step 3: Add Traditional Chinese, Simplified Chinese, and English copy**

Include labels for task progress, complete/incomplete text, signed-out prompt, sync conflict, privacy notice, share/copy fallback, recent souvenirs, empty state, and error retry. Keep Traditional Chinese as the copy source of truth.

- [ ] **Step 4: Run catalog tests and root i18n audit**

```bash
npm run test -- src/app/i18n/catalogs/catalogs.test.ts
```

Then run the existing root audit utility documented by the repository. If the exact command is not discoverable from root scripts, use `rg -n "i18n_audit" D:\meta_exb` and document the discovered command rather than inventing one.

- [ ] **Step 5: Commit**

```bash
git add src/app/i18n/catalogs
git commit -m "feat: localize exhibition passports" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

---

### Task 10: Final verification and manual acceptance

**Files:**
- Verify all files changed in Tasks 1–9.
- Update only if verification finds an in-scope defect: `docs/plans/2026-07-22-ai-exhibition-passport.md`

- [ ] **Step 1: Run focused passport tests**

```bash
npm run test -- server/services/exhibitionPassportRules.test.js server/services/exhibitionPassportService.test.js server/routes/exhibitionPassportRoutes.test.js src/app/api/exhibitionPassport.test.ts src/app/modules/metaverse3d/passport/passportProgress.test.ts src/app/modules/metaverse3d/components/UI/ExhibitionPassportPanel.test.tsx src/app/modules/metaverse3d/components/UI/PassportCompletionDialog.test.tsx src/app/modules/metaverse3d/components/UI/ViewUI.test.tsx src/app/pages/ExhibitionSouvenir.test.tsx src/app/components/RecentSouvenirs.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run project validation**

```bash
npm run check
```

Expected: server syntax, typecheck, lint, all tests, build, and bundle budget PASS. If an unrelated dirty-worktree failure appears, record the exact command and file; do not overwrite unrelated user changes.

- [ ] **Step 3: Manual 3D smoke test**

Run:

```bash
npm run dev
npm run dev:server
```

In an authenticated session:

1. Open a published gallery containing at least three eligible works.
2. Confirm the passport loads once and can be collapsed.
3. Visit three works, remain on one for at least 20 seconds, and engage one.
4. Confirm progress reaches `3 / 3` without refreshing.
5. Complete with a reflection and confirm the card is still private.
6. Press share, copy/open the URL in a signed-out browser, and verify the public card contains no user identity.
7. Refresh the gallery and confirm the passport remains completed.
8. Open home and confirm the shared card appears in recent journeys.

- [ ] **Step 4: Accessibility and degraded-mode smoke test**

- Navigate the panel/dialog/card using keyboard only.
- Verify focus is visible and the collapsed button is at least 44×44 px.
- Enable reduced motion and confirm non-essential animation is disabled.
- Disable the AI provider key and confirm deterministic tasks still work.
- Switch to 2D and confirm exhibition content remains usable, while the UI clearly states passport progress currently requires 3D mode.
- Simulate a souvenir API failure and confirm home still renders normally.

- [ ] **Step 5: Security/privacy check**

- Confirm unauthenticated complete/share endpoints return 401.
- Confirm an authenticated user cannot complete or share another user's passport.
- Confirm token lookup is exact and unknown tokens return 404.
- Confirm public list/detail JSON contains no `userId`, email, auth token, visitor memory, or unshared passport.
- Confirm reflection is rendered as text and not HTML.

- [ ] **Step 6: Commit verification fixes only when needed**

```bash
git add <in-scope-fixed-files>
git commit -m "fix: stabilize exhibition passport flow" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```

Do not create an empty commit.

---

## Definition of done

- A logged-in visitor can see exactly three deterministic passport tasks in a published 3D exhibition.
- Progress updates immediately from current visitor behavior and survives refresh through `visitor_memories`.
- Server rejects completion when persisted progress is incomplete.
- Completion creates one immutable, private souvenir snapshot.
- Sharing is a separate, explicit, idempotent action.
- Public souvenir endpoints reveal no visitor identity or private passport data.
- Shared cards render at `/souvenirs/:token` and may appear on home.
- Traditional Chinese, Simplified Chinese, and English catalogs remain in parity.
- Focused tests and `npm run check` pass.

## Phase 2 candidates

After measuring completion rate and share rate, consider these separately:

1. Extract visitor journey tracking above the renderer so 2D and 3D modes share the same passport.
2. Add curator-authored task presets per gallery.
3. Add weekly themed trails spanning several exhibitions.
4. Generate downloadable image cards in a worker or server endpoint.
5. Add live multiplayer group passports for opening events.

