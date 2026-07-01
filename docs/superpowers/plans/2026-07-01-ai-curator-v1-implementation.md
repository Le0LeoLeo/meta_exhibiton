# AI Curator V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an authenticated AI curator assistant that generates a structured exhibition plan, previews it in the 3D editor, and applies it as a deterministic starter scene only after user confirmation.

**Architecture:** Add a focused backend curator service and route that returns validated structured data with fallback behavior. Add frontend API types, a pure plan-to-scene mapper, and a compact editor panel that previews generated content before calling the existing `importScene` store action.

**Tech Stack:** Express ESM, Zod, OpenAI-compatible Qwen/DashScope client, Vite, React 18, Zustand, Vitest, Testing Library.

---

## File Structure

- Create `server/services/aiCuratorService.js`: owns Qwen call, JSON extraction, normalization, fallback plan, and private test exports.
- Create `server/services/aiCuratorService.test.js`: unit tests for fallback, parsing, normalization, and invalid JSON recovery.
- Create `server/routes/aiCuratorRoutes.js`: owns `/api/ai/curator-plan` request validation and auth/rate-limit integration.
- Create `server/routes/aiCuratorRoutes.test.js`: route tests for auth, validation, success, and service failure responses.
- Modify `server/config/deps.js`: wires `generateCuratorPlan` into dependency builder.
- Modify `server/index.js`: registers curator routes.
- Create `src/app/api/aiCurator.ts`: typed frontend API client for `/api/ai/curator-plan`.
- Modify `src/app/api/index.ts`: export the curator API if this file is used as the public API barrel.
- Create `src/app/modules/metaverse3d/aiCurator/mapCuratorPlanToScene.ts`: pure deterministic mapping from curator plan to `SceneSnapshot`.
- Create `src/app/modules/metaverse3d/aiCurator/mapCuratorPlanToScene.test.ts`: pure mapping tests.
- Create `src/app/modules/metaverse3d/components/UI/AiCuratorPanel.tsx`: React panel with brief, generating, preview, and error states.
- Create `src/app/modules/metaverse3d/components/UI/AiCuratorPanel.test.tsx`: UI tests for preview/apply behavior.
- Modify `src/app/modules/metaverse3d/components/UI/EditUI.tsx`: mounts the panel in More Tools and passes `importScene`, `exportScene`, and auth behavior through existing patterns.

## Task 1: Backend Curator Service

**Files:**
- Create: `server/services/aiCuratorService.js`
- Create: `server/services/aiCuratorService.test.js`

- [ ] **Step 1: Write failing fallback and normalization tests**

Create `server/services/aiCuratorService.test.js`:

```js
import { describe, expect, it, vi } from 'vitest';

vi.mock('openai', () => ({
  default: vi.fn(() => ({
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  })),
}));

const OLD_ENV = { ...process.env };

describe('aiCuratorService', () => {
  afterEach(() => {
    process.env = { ...OLD_ENV };
    vi.resetModules();
  });

  it('returns a fallback curator plan without an API key', async () => {
    delete process.env.QWEN_API_KEY;
    delete process.env.DASHSCOPE_API_KEY;
    const { generateCuratorPlan } = await import('./aiCuratorService.js');

    const result = await generateCuratorPlan({
      theme: '澳門非遺文化展',
      exhibitCount: 4,
      language: 'zh-TW',
    });

    expect(result.source).toBe('fallback');
    expect(result.exhibition.title).toContain('澳門非遺文化展');
    expect(result.exhibition.sections.length).toBeGreaterThanOrEqual(3);
    expect(result.exhibition.exhibits).toHaveLength(4);
    expect(result.exhibition.exhibits.every((item) => item.sectionId)).toBe(true);
    expect(result.warnings).toContain('AI curator fallback used because no API key is configured.');
  });

  it('normalizes requested exhibit count and placement hints', async () => {
    delete process.env.QWEN_API_KEY;
    delete process.env.DASHSCOPE_API_KEY;
    const { _private } = await import('./aiCuratorService.js');

    const result = _private.normalizeCuratorPlan({
      theme: '城市記憶',
      exhibitCount: 3,
      language: 'zh-TW',
    }, {
      exhibition: {
        title: '城市記憶',
        introduction: '一場關於街巷、聲音與日常物件的展覽。',
        guideOpening: '歡迎來到城市記憶。',
        sections: [{ id: 's1', title: '街巷', summary: '從街道開始。' }],
        exhibits: [
          { id: 'a', sectionId: 's1', title: '舊街影像', description: '街角影像。', medium: 'image', placementHint: 'left-wall' },
        ],
      },
    });

    expect(result.exhibition.exhibits).toHaveLength(3);
    expect(result.exhibition.exhibits.map((item) => item.placementHint)).toEqual([
      'left-wall',
      'right-wall',
      'back-wall',
    ]);
  });

  it('extracts a JSON object from model text', async () => {
    const { _private } = await import('./aiCuratorService.js');

    expect(_private.extractJsonObject('prefix {"ok":true} suffix')).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run service tests to verify they fail**

Run:

```bash
npm run test -- server/services/aiCuratorService.test.js
```

Expected: FAIL because `server/services/aiCuratorService.js` does not exist.

- [ ] **Step 3: Implement the curator service**

Create `server/services/aiCuratorService.js`:

```js
import OpenAI from 'openai';

const PLACEMENT_HINTS = ['left-wall', 'right-wall', 'back-wall', 'center'];
const MEDIUMS = ['image', 'text', 'model', 'video', 'mixed'];

function getApiKey() {
  return process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY || '';
}

function getQwenBaseUrl() {
  return (
    process.env.QWEN_BASE_URL ||
    process.env.QWEN_API_BASE_URL ||
    'https://dashscope.aliyuncs.com/compatible-mode/v1'
  ).replace(/\/$/, '');
}

function createQwenClient(apiKey, baseUrl, timeoutMs) {
  return new OpenAI({
    apiKey,
    baseURL: baseUrl,
    timeout: timeoutMs,
  });
}

function clampExhibitCount(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return 6;
  return Math.max(3, Math.min(12, parsed));
}

function normalizeCompletionContent(content) {
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content.map((part) => (typeof part === 'string' ? part : part?.text || '')).join('').trim();
  }
  return String(content || '').trim();
}

function extractJsonObject(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('empty Qwen response');
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('Qwen response is not JSON');
    return JSON.parse(raw.slice(start, end + 1));
  }
}

function slugId(prefix, index) {
  return `${prefix}-${String(index + 1).padStart(2, '0')}`;
}

function textOrFallback(value, fallback) {
  const text = String(value || '').trim();
  return text || fallback;
}

function createFallbackPlan(input = {}) {
  const theme = textOrFallback(input.theme, '主題展覽');
  const exhibitCount = clampExhibitCount(input.exhibitCount);
  const sectionCount = Math.min(5, Math.max(3, Math.ceil(exhibitCount / 2)));
  const sectionTitles = ['起點', '脈絡', '轉折', '回望', '未來'];
  const sections = Array.from({ length: sectionCount }, (_, index) => ({
    id: slugId('section', index),
    title: `${theme}${sectionTitles[index]}`,
    summary: `以「${theme}」為核心，整理第 ${index + 1} 組故事線索。`,
  }));
  const exhibits = Array.from({ length: exhibitCount }, (_, index) => {
    const section = sections[index % sections.length];
    return {
      id: slugId('exhibit', index),
      sectionId: section.id,
      title: `${theme}展品 ${index + 1}`,
      description: `這件展品以「${theme}」為出發點，呈現一段可被觀眾快速理解的視覺或文字記憶。`,
      medium: index % 3 === 0 ? 'image' : 'text',
      placementHint: PLACEMENT_HINTS[index % PLACEMENT_HINTS.length],
    };
  });

  return {
    source: 'fallback',
    exhibition: {
      title: `${theme}`,
      introduction: `這是一場圍繞「${theme}」建立的展覽草稿，適合先作為 3D 展廳的策展起點。`,
      guideOpening: `歡迎來到「${theme}」。接下來我們會沿著幾個展區，逐步看見這個主題的不同面向。`,
      sections,
      exhibits,
    },
    warnings: ['AI curator fallback used because no API key is configured.'],
  };
}

function normalizeSections(input, rawSections, requestedCount) {
  const fallback = createFallbackPlan(input).exhibition.sections;
  const source = Array.isArray(rawSections) && rawSections.length > 0 ? rawSections : fallback;
  const count = Math.min(5, Math.max(3, Math.min(source.length || 3, requestedCount)));
  return Array.from({ length: count }, (_, index) => {
    const section = source[index] || fallback[index % fallback.length];
    return {
      id: textOrFallback(section?.id, slugId('section', index)),
      title: textOrFallback(section?.title, fallback[index % fallback.length].title),
      summary: textOrFallback(section?.summary || section?.description, fallback[index % fallback.length].summary),
    };
  });
}

function normalizeExhibits(input, rawExhibits, sections, requestedCount) {
  const fallback = createFallbackPlan({ ...input, exhibitCount: requestedCount }).exhibition.exhibits;
  const source = Array.isArray(rawExhibits) ? rawExhibits : [];
  return Array.from({ length: requestedCount }, (_, index) => {
    const exhibit = source[index] || fallback[index];
    const section = sections.find((item) => item.id === exhibit?.sectionId) || sections[index % sections.length];
    const medium = MEDIUMS.includes(exhibit?.medium) ? exhibit.medium : fallback[index].medium;
    const placementHint = PLACEMENT_HINTS.includes(exhibit?.placementHint)
      ? exhibit.placementHint
      : PLACEMENT_HINTS[index % PLACEMENT_HINTS.length];
    return {
      id: textOrFallback(exhibit?.id, slugId('exhibit', index)),
      sectionId: section.id,
      title: textOrFallback(exhibit?.title, fallback[index].title),
      description: textOrFallback(exhibit?.description, fallback[index].description),
      medium,
      placementHint,
    };
  });
}

function normalizeCuratorPlan(input = {}, parsed = {}) {
  const requestedCount = clampExhibitCount(input.exhibitCount);
  const rawExhibition = parsed.exhibition && typeof parsed.exhibition === 'object' ? parsed.exhibition : {};
  const fallback = createFallbackPlan({ ...input, exhibitCount: requestedCount });
  const sections = normalizeSections(input, rawExhibition.sections, requestedCount);
  const exhibits = normalizeExhibits(input, rawExhibition.exhibits, sections, requestedCount);

  return {
    source: 'qwen',
    exhibition: {
      title: textOrFallback(rawExhibition.title || parsed.title, fallback.exhibition.title),
      introduction: textOrFallback(rawExhibition.introduction, fallback.exhibition.introduction),
      guideOpening: textOrFallback(rawExhibition.guideOpening, fallback.exhibition.guideOpening),
      sections,
      exhibits,
    },
    warnings: [],
  };
}

function buildSystemPrompt() {
  return [
    'You are a precise virtual exhibition curator.',
    'Return valid JSON only. Do not use Markdown.',
    'Do not generate 3D coordinates.',
    'Create exactly the requested exhibit count.',
    'Use the requested language.',
    'Each exhibit must be concrete and specific to the theme.',
  ].join(' ');
}

function buildUserPrompt(input) {
  return JSON.stringify({
    theme: input.theme,
    style: input.style || '',
    audience: input.audience || '',
    language: input.language || 'zh-TW',
    exhibitCount: clampExhibitCount(input.exhibitCount),
    outputContract: {
      exhibition: {
        title: 'string',
        introduction: 'string',
        guideOpening: 'string',
        sections: [{ id: 'section-01', title: 'string', summary: 'string' }],
        exhibits: [{
          id: 'exhibit-01',
          sectionId: 'section-01',
          title: 'string',
          description: 'string',
          medium: 'image | text | model | video | mixed',
          placementHint: 'left-wall | right-wall | back-wall | center',
        }],
      },
    },
  });
}

async function callQwenForCuratorPlan(input) {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  const client = createQwenClient(apiKey, getQwenBaseUrl(), Number(process.env.QWEN_TIMEOUT_MS || 15000));
  const completion = await client.chat.completions.create({
    model: process.env.QWEN_MODEL || 'qwen3.6-plus',
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: buildUserPrompt(input) },
    ],
    stream: false,
    temperature: 0.4,
    top_p: 0.9,
    enable_search: false,
    enable_thinking: false,
    result_format: 'message',
  });
  return normalizeCompletionContent(completion?.choices?.[0]?.message?.content);
}

export async function generateCuratorPlan(input = {}) {
  try {
    const content = await callQwenForCuratorPlan(input);
    if (!content) return createFallbackPlan(input);
    return normalizeCuratorPlan(input, extractJsonObject(content));
  } catch (error) {
    return {
      ...createFallbackPlan(input),
      warnings: [`AI curator generation failed: ${error instanceof Error ? error.message : 'unknown error'}`],
    };
  }
}

export const _private = {
  clampExhibitCount,
  createFallbackPlan,
  extractJsonObject,
  normalizeCuratorPlan,
};
```

- [ ] **Step 4: Run service tests**

Run:

```bash
npm run test -- server/services/aiCuratorService.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit backend service**

Run:

```bash
git add server/services/aiCuratorService.js server/services/aiCuratorService.test.js
git commit -m "feat: add ai curator service" -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

## Task 2: Backend Route Wiring

**Files:**
- Create: `server/routes/aiCuratorRoutes.js`
- Create: `server/routes/aiCuratorRoutes.test.js`
- Modify: `server/config/deps.js`
- Modify: `server/index.js`

- [ ] **Step 1: Write failing route tests**

Create `server/routes/aiCuratorRoutes.test.js`:

```js
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { registerAiCuratorRoutes } from './aiCuratorRoutes.js';

function createApp(deps = {}) {
  const app = express();
  app.use(express.json());
  registerAiCuratorRoutes(app, {
    aiWritingLimiter: (_req, _res, next) => next(),
    requireAuth: vi.fn(() => ({ userId: 'user-1' })),
    generateCuratorPlan: vi.fn(async () => ({
      source: 'fallback',
      exhibition: {
        title: '澳門非遺文化展',
        introduction: 'intro',
        guideOpening: 'opening',
        sections: [{ id: 'section-01', title: '起點', summary: 'summary' }],
        exhibits: [{
          id: 'exhibit-01',
          sectionId: 'section-01',
          title: '展品',
          description: 'description',
          medium: 'text',
          placementHint: 'left-wall',
        }],
      },
      warnings: [],
    })),
    ...deps,
  });
  return app;
}

describe('registerAiCuratorRoutes', () => {
  it('rejects missing theme', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/api/ai/curator-plan')
      .send({ exhibitCount: 6 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBeTruthy();
  });

  it('returns a curator plan for a valid request', async () => {
    const generateCuratorPlan = vi.fn(async (input) => ({
      source: 'fallback',
      exhibition: {
        title: input.theme,
        introduction: 'intro',
        guideOpening: 'opening',
        sections: [{ id: 'section-01', title: '起點', summary: 'summary' }],
        exhibits: [{
          id: 'exhibit-01',
          sectionId: 'section-01',
          title: '展品',
          description: 'description',
          medium: 'text',
          placementHint: 'left-wall',
        }],
      },
      warnings: [],
    }));
    const app = createApp({ generateCuratorPlan });

    const res = await request(app)
      .post('/api/ai/curator-plan')
      .send({ theme: '澳門非遺文化展', exhibitCount: 6 });

    expect(res.status).toBe(200);
    expect(res.body.exhibition.title).toBe('澳門非遺文化展');
    expect(generateCuratorPlan).toHaveBeenCalledWith({
      theme: '澳門非遺文化展',
      language: 'zh-TW',
      exhibitCount: 6,
    });
  });

  it('returns 500 when the service throws', async () => {
    const app = createApp({
      generateCuratorPlan: vi.fn(async () => {
        throw new Error('service failed');
      }),
    });

    const res = await request(app)
      .post('/api/ai/curator-plan')
      .send({ theme: '澳門非遺文化展' });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('service failed');
  });
});
```

- [ ] **Step 2: Run route tests to verify they fail**

Run:

```bash
npm run test -- server/routes/aiCuratorRoutes.test.js
```

Expected: FAIL because `server/routes/aiCuratorRoutes.js` does not exist.

- [ ] **Step 3: Implement route**

Create `server/routes/aiCuratorRoutes.js`:

```js
import { z } from 'zod';

const curatorPlanRequestSchema = z.object({
  theme: z.string().trim().min(1, 'theme is required').max(500, 'theme too long'),
  style: z.string().trim().max(120, 'style too long').optional(),
  audience: z.string().trim().max(120, 'audience too long').optional(),
  language: z.enum(['zh-TW', 'zh-CN', 'en']).optional().default('zh-TW'),
  exhibitCount: z.number().int().min(3).max(12).optional().default(6),
});

const noRateLimit = (_req, _res, next) => next();

export function registerAiCuratorRoutes(app, deps = {}) {
  const {
    requireAuth,
    aiWritingLimiter = noRateLimit,
    generateCuratorPlan,
  } = deps;

  app.post('/api/ai/curator-plan', aiWritingLimiter, async (req, res) => {
    try {
      const auth = requireAuth ? requireAuth(req, res) : null;
      if (requireAuth && !auth) return;

      const parsed = curatorPlanRequestSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'invalid payload' });
      }

      const result = await generateCuratorPlan(parsed.data);
      res.json(result);
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'internal error';
      res.status(500).json({ message });
    }
  });
}
```

- [ ] **Step 4: Wire dependencies and route registration**

In `server/config/deps.js`, add:

```js
import { generateCuratorPlan } from '../services/aiCuratorService.js';
```

Then add this object inside the returned dependencies:

```js
    aiCurator: {
      requireAuth,
      aiWritingLimiter: rateLimiters.aiWritingLimiter,
      generateCuratorPlan,
    },
```

In `server/index.js`, add:

```js
import { registerAiCuratorRoutes } from './routes/aiCuratorRoutes.js';
```

Then register it after `registerAiWritingRoutes(app, deps.aiWriting);`:

```js
registerAiCuratorRoutes(app, deps.aiCurator);
```

- [ ] **Step 5: Run route and syntax checks**

Run:

```bash
npm run test -- server/routes/aiCuratorRoutes.test.js
npm run check:server
```

Expected: both PASS.

- [ ] **Step 6: Commit backend route**

Run:

```bash
git add server/routes/aiCuratorRoutes.js server/routes/aiCuratorRoutes.test.js server/config/deps.js server/index.js
git commit -m "feat: add ai curator route" -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

## Task 3: Frontend API And Scene Mapping

**Files:**
- Create: `src/app/api/aiCurator.ts`
- Modify: `src/app/api/index.ts`
- Create: `src/app/modules/metaverse3d/aiCurator/mapCuratorPlanToScene.ts`
- Create: `src/app/modules/metaverse3d/aiCurator/mapCuratorPlanToScene.test.ts`

- [ ] **Step 1: Write failing scene mapping tests**

Create `src/app/modules/metaverse3d/aiCurator/mapCuratorPlanToScene.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mapCuratorPlanToScene } from "./mapCuratorPlanToScene";
import type { CuratorPlanResponse } from "@/app/api/aiCurator";

const plan: CuratorPlanResponse = {
  source: "fallback",
  exhibition: {
    title: "澳門非遺文化展",
    introduction: "以手藝、節慶與街區記憶構成的展覽。",
    guideOpening: "歡迎來到澳門非遺文化展。",
    sections: [
      { id: "section-01", title: "手藝", summary: "看見工藝。" },
      { id: "section-02", title: "節慶", summary: "走入節慶。" },
      { id: "section-03", title: "街區", summary: "回到街區。" },
    ],
    exhibits: [
      { id: "exhibit-01", sectionId: "section-01", title: "木雕招牌", description: "街角招牌。", medium: "text", placementHint: "left-wall" },
      { id: "exhibit-02", sectionId: "section-02", title: "節慶聲景", description: "節慶聲音。", medium: "text", placementHint: "right-wall" },
      { id: "exhibit-03", sectionId: "section-03", title: "巷弄地圖", description: "巷弄路線。", medium: "text", placementHint: "back-wall" },
    ],
  },
  warnings: [],
};

describe("mapCuratorPlanToScene", () => {
  it("creates supported scene items inside the default room", () => {
    const scene = mapCuratorPlanToScene(plan);

    expect(scene.roomSize.width).toBeGreaterThan(0);
    expect(scene.floorPlanElements).toHaveLength(1);
    expect(scene.items.some((item) => item.id === "ai-curator-title")).toBe(true);
    expect(scene.items.filter((item) => item.type === "text").length).toBeGreaterThanOrEqual(4);
    for (const item of scene.items) {
      expect(Math.abs(item.position[0])).toBeLessThanOrEqual(scene.roomSize.width / 2);
      expect(Math.abs(item.position[2])).toBeLessThanOrEqual(scene.roomSize.length / 2);
    }
  });

  it("is deterministic for the same plan", () => {
    expect(mapCuratorPlanToScene(plan)).toEqual(mapCuratorPlanToScene(plan));
  });

  it("uses current room dimensions when provided", () => {
    const scene = mapCuratorPlanToScene(plan, {
      roomSize: {
        width: 30,
        length: 24,
        height: 6,
        wallThickness: 0.1,
        wallColor: "#ffffff",
        wallMaterialPreset: "paint",
        wallTextureUrl: "/textures/wall-paint.svg",
        wallTextureTiling: 3,
        wallRoughness: 0.35,
        wallMetalness: 0.08,
        wallBumpScale: 0.04,
        wallEnvIntensity: 0.9,
        wallOpacity: 0.98,
        wallTransmission: 0,
        wallIor: 1.45,
        floorColor: "#0f172a",
        floorTextureUrl: "/textures/wall-concrete.svg",
        floorTextureTiling: 2.5,
        floorRoughness: 0.55,
        floorMetalness: 0.18,
        environmentBrightness: 0.45,
      },
      items: [],
      floorPlanElements: [],
      wallMaterialOverrides: {},
    });

    expect(scene.roomSize.width).toBe(30);
    expect(scene.roomSize.length).toBe(24);
  });
});
```

- [ ] **Step 2: Run mapping tests to verify they fail**

Run:

```bash
npm run test -- src/app/modules/metaverse3d/aiCurator/mapCuratorPlanToScene.test.ts
```

Expected: FAIL because the mapper and API type file do not exist.

- [ ] **Step 3: Add frontend API client**

Create `src/app/api/aiCurator.ts`:

```ts
import { apiUrl, authHeaders, errorFromResponse, parseJsonSafe } from "./base";

export type CuratorPlanRequest = {
  theme: string;
  style?: string;
  audience?: string;
  language?: "zh-TW" | "zh-CN" | "en";
  exhibitCount?: number;
};

export type CuratorPlanResponse = {
  source: "qwen" | "fallback";
  exhibition: {
    title: string;
    introduction: string;
    guideOpening: string;
    sections: Array<{
      id: string;
      title: string;
      summary: string;
    }>;
    exhibits: Array<{
      id: string;
      sectionId: string;
      title: string;
      description: string;
      medium: "image" | "text" | "model" | "video" | "mixed";
      placementHint: "left-wall" | "right-wall" | "back-wall" | "center";
    }>;
  };
  warnings: string[];
};

export async function requestCuratorPlan(
  token: string,
  payload: CuratorPlanRequest,
): Promise<CuratorPlanResponse> {
  const res = await fetch(apiUrl("/api/ai/curator-plan"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, "AI curator failed");
  return data as CuratorPlanResponse;
}
```

If `src/app/api/index.ts` is a barrel export, add:

```ts
export * from "./aiCurator";
```

- [ ] **Step 4: Add scene mapper**

Create `src/app/modules/metaverse3d/aiCurator/mapCuratorPlanToScene.ts`:

```ts
import type { CuratorPlanResponse } from "@/app/api/aiCurator";
import type { ExhibitItem, RoomSize } from "../types";
import type { SceneSnapshot } from "../store/metaverseStoreTypes";

const DEFAULT_ROOM_SIZE: RoomSize = {
  width: 20,
  length: 20,
  height: 6,
  wallThickness: 0.1,
  wallColor: "#f8fafc",
  wallMaterialPreset: "paint",
  wallTextureUrl: "/textures/wall-paint.svg",
  wallTextureTiling: 3,
  wallRoughness: 0.35,
  wallMetalness: 0.08,
  wallBumpScale: 0.04,
  wallEnvIntensity: 0.9,
  wallOpacity: 0.98,
  wallTransmission: 0,
  wallIor: 1.45,
  floorColor: "#0f172a",
  floorTextureUrl: "/textures/wall-concrete.svg",
  floorTextureTiling: 2.5,
  floorRoughness: 0.55,
  floorMetalness: 0.18,
  environmentBrightness: 0.45,
};

function compactText(value: string, max = 120) {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function wallPosition(
  hint: CuratorPlanResponse["exhibition"]["exhibits"][number]["placementHint"],
  room: RoomSize,
  index: number,
  count: number,
): { position: [number, number, number]; rotation: [number, number, number] } {
  const slot = count <= 1 ? 0 : -1 + (index / (count - 1)) * 2;
  if (hint === "right-wall") {
    return {
      position: [room.width / 2 - 0.2, 2.6, slot * (room.length / 2 - 2.5)],
      rotation: [0, -Math.PI / 2, 0],
    };
  }
  if (hint === "back-wall") {
    return {
      position: [slot * (room.width / 2 - 2.5), 2.6, -room.length / 2 + 0.2],
      rotation: [0, 0, 0],
    };
  }
  if (hint === "center") {
    return {
      position: [slot * Math.min(4, room.width / 4), 1.4, -1.5],
      rotation: [0, Math.PI / 8, 0],
    };
  }
  return {
    position: [-room.width / 2 + 0.2, 2.6, slot * (room.length / 2 - 2.5)],
    rotation: [0, Math.PI / 2, 0],
  };
}

function createTextItem(
  id: string,
  content: string,
  position: [number, number, number],
  rotation: [number, number, number],
  options: Partial<ExhibitItem> = {},
): ExhibitItem {
  return {
    id,
    type: "text",
    position,
    rotation,
    scale: [1, 1, 1],
    content,
    textFontFamily: "sans",
    textColor: "#111827",
    textFontSize: 0.22,
    textBackboardEnabled: true,
    textBackboardColor: "#ffffff",
    ...options,
  };
}

export function mapCuratorPlanToScene(
  plan: CuratorPlanResponse,
  currentScene?: SceneSnapshot | null,
): SceneSnapshot {
  const roomSize = currentScene?.roomSize || DEFAULT_ROOM_SIZE;
  const exhibits = plan.exhibition.exhibits;
  const items: ExhibitItem[] = [
    createTextItem(
      "ai-curator-title",
      compactText(plan.exhibition.title, 48),
      [0, 4.4, roomSize.length / 2 - 0.2],
      [0, Math.PI, 0],
      { textFontSize: 0.56, textIsBold: true },
    ),
    createTextItem(
      "ai-curator-introduction",
      compactText(plan.exhibition.introduction, 180),
      [0, 3.55, roomSize.length / 2 - 0.2],
      [0, Math.PI, 0],
      { textFontSize: 0.2, textColor: "#334155" },
    ),
  ];

  plan.exhibition.sections.forEach((section, index) => {
    const x = -roomSize.width / 2 + 2 + index * Math.max(2.4, (roomSize.width - 4) / Math.max(1, plan.exhibition.sections.length - 1));
    items.push(createTextItem(
      `ai-curator-section-${section.id}`,
      compactText(`${section.title}\n${section.summary}`, 96),
      [Math.min(roomSize.width / 2 - 2, x), 1.9, 0],
      [0, 0, 0],
      { textFontSize: 0.18, textBackboardColor: "#f8fafc" },
    ));
  });

  exhibits.forEach((exhibit, index) => {
    const anchor = wallPosition(exhibit.placementHint, roomSize, index, exhibits.length);
    items.push(createTextItem(
      `ai-curator-exhibit-${exhibit.id}`,
      compactText(`${exhibit.title}\n${exhibit.description}`, 140),
      anchor.position,
      anchor.rotation,
      { textFontSize: 0.2, textIsBold: true },
    ));
    items.push({
      id: `ai-curator-light-${exhibit.id}`,
      type: "lightstrip",
      position: [anchor.position[0], Math.min(roomSize.height - 1, anchor.position[1] + 0.8), anchor.position[2]],
      rotation: anchor.rotation,
      scale: [1.8, 0.12, 0.12],
      content: index % 2 === 0 ? "#ffe08a" : "#bae6fd",
      lightIntensity: 0.55,
    });
  });

  return {
    roomSize,
    items,
    floorPlanElements: [
      {
        id: "ai-curator-room",
        type: "room",
        position: [0, 0.02, 0],
        rotation: [0, 0, 0],
        scale: [roomSize.width, 0.04, roomSize.length],
        color: "#dbeafe",
        isLocked: true,
        doorWidth: 1.2,
      },
    ],
    wallMaterialOverrides: currentScene?.wallMaterialOverrides || {},
  };
}
```

- [ ] **Step 5: Run mapping tests**

Run:

```bash
npm run test -- src/app/modules/metaverse3d/aiCurator/mapCuratorPlanToScene.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit API and mapper**

Run:

```bash
git add src/app/api/aiCurator.ts src/app/api/index.ts src/app/modules/metaverse3d/aiCurator/mapCuratorPlanToScene.ts src/app/modules/metaverse3d/aiCurator/mapCuratorPlanToScene.test.ts
git commit -m "feat: map ai curator plans to scenes" -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

## Task 4: Editor Panel Integration

**Files:**
- Create: `src/app/modules/metaverse3d/components/UI/AiCuratorPanel.tsx`
- Create: `src/app/modules/metaverse3d/components/UI/AiCuratorPanel.test.tsx`
- Modify: `src/app/modules/metaverse3d/components/UI/EditUI.tsx`

- [ ] **Step 1: Write failing panel tests**

Create `src/app/modules/metaverse3d/components/UI/AiCuratorPanel.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AiCuratorPanel } from "./AiCuratorPanel";
import type { CuratorPlanResponse } from "@/app/api/aiCurator";

const plan: CuratorPlanResponse = {
  source: "fallback",
  exhibition: {
    title: "澳門非遺文化展",
    introduction: "intro",
    guideOpening: "opening",
    sections: [{ id: "section-01", title: "起點", summary: "summary" }],
    exhibits: [{
      id: "exhibit-01",
      sectionId: "section-01",
      title: "展品",
      description: "description",
      medium: "text",
      placementHint: "left-wall",
    }],
  },
  warnings: [],
};

describe("AiCuratorPanel", () => {
  it("generates a preview and applies only after confirmation", async () => {
    const requestCuratorPlan = vi.fn(async () => plan);
    const importScene = vi.fn();
    render(
      <AiCuratorPanel
        token="token-1"
        currentScene={null}
        requestCuratorPlan={requestCuratorPlan}
        importScene={importScene}
      />,
    );

    fireEvent.change(screen.getByLabelText("展覽主題"), {
      target: { value: "澳門非遺文化展" },
    });
    fireEvent.click(screen.getByRole("button", { name: "生成策展方案" }));

    await screen.findByText("澳門非遺文化展");
    expect(importScene).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "套用到展廳" }));
    expect(importScene).toHaveBeenCalledTimes(1);
  });

  it("shows an error without applying a scene", async () => {
    const requestCuratorPlan = vi.fn(async () => {
      throw new Error("network failed");
    });
    const importScene = vi.fn();
    render(
      <AiCuratorPanel
        token="token-1"
        currentScene={null}
        requestCuratorPlan={requestCuratorPlan}
        importScene={importScene}
      />,
    );

    fireEvent.change(screen.getByLabelText("展覽主題"), {
      target: { value: "澳門非遺文化展" },
    });
    fireEvent.click(screen.getByRole("button", { name: "生成策展方案" }));

    await waitFor(() => expect(screen.getByText("network failed")).toBeInTheDocument());
    expect(importScene).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run panel tests to verify they fail**

Run:

```bash
npm run test -- src/app/modules/metaverse3d/components/UI/AiCuratorPanel.test.tsx
```

Expected: FAIL because `AiCuratorPanel.tsx` does not exist.

- [ ] **Step 3: Implement panel**

Create `src/app/modules/metaverse3d/components/UI/AiCuratorPanel.tsx`:

```tsx
import { useState } from "react";
import type { CuratorPlanRequest, CuratorPlanResponse } from "@/app/api/aiCurator";
import { requestCuratorPlan as defaultRequestCuratorPlan } from "@/app/api/aiCurator";
import type { SceneSnapshot } from "../../store/metaverseStoreTypes";
import { mapCuratorPlanToScene } from "../../aiCurator/mapCuratorPlanToScene";

type AiCuratorPanelProps = {
  token: string | null;
  currentScene: SceneSnapshot | null;
  importScene: (scene: SceneSnapshot) => void;
  requestCuratorPlan?: (token: string, payload: CuratorPlanRequest) => Promise<CuratorPlanResponse>;
};

export function AiCuratorPanel({
  token,
  currentScene,
  importScene,
  requestCuratorPlan = defaultRequestCuratorPlan,
}: AiCuratorPanelProps) {
  const [theme, setTheme] = useState("");
  const [style, setStyle] = useState("white-box");
  const [audience, setAudience] = useState("");
  const [language, setLanguage] = useState<"zh-TW" | "zh-CN" | "en">("zh-TW");
  const [exhibitCount, setExhibitCount] = useState(6);
  const [isGenerating, setIsGenerating] = useState(false);
  const [preview, setPreview] = useState<CuratorPlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canGenerate = Boolean(theme.trim()) && !isGenerating;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    if (!token) {
      setError("請先登入再使用 AI 策展。");
      return;
    }
    setError(null);
    setPreview(null);
    setIsGenerating(true);
    try {
      const result = await requestCuratorPlan(token, {
        theme: theme.trim(),
        style,
        audience: audience.trim() || undefined,
        language,
        exhibitCount,
      });
      setPreview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 策展失敗");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApply = () => {
    if (!preview) return;
    importScene(mapCuratorPlanToScene(preview, currentScene));
  };

  return (
    <div className="space-y-3 rounded-2xl border border-white/20 bg-white/10 p-3 text-white">
      <h4 className="text-xs font-semibold text-white">AI 策展助手</h4>
      <label className="block text-[11px] text-white/75">
        展覽主題
        <textarea
          value={theme}
          onChange={(event) => setTheme(event.target.value)}
          className="mt-1 min-h-20 w-full resize-none rounded-xl border border-white/25 bg-white/15 px-2 py-2 text-xs text-white placeholder:text-white/55"
          placeholder="例如：澳門非遺文化展"
          maxLength={500}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[11px] text-white/75">
          風格
          <select
            value={style}
            onChange={(event) => setStyle(event.target.value)}
            className="mt-1 w-full rounded-xl border border-white/25 bg-white/15 px-2 py-1.5 text-xs text-white"
          >
            <option value="white-box">白盒展廳</option>
            <option value="warm-museum">溫暖博物館</option>
            <option value="tech-showroom">科技展廳</option>
            <option value="history-gallery">歷史展廳</option>
            <option value="immersive">沉浸式</option>
          </select>
        </label>
        <label className="block text-[11px] text-white/75">
          展品數
          <input
            type="number"
            min={3}
            max={12}
            value={exhibitCount}
            onChange={(event) => setExhibitCount(Math.max(3, Math.min(12, Number(event.target.value) || 6)))}
            className="mt-1 w-full rounded-xl border border-white/25 bg-white/15 px-2 py-1.5 text-xs text-white"
          />
        </label>
      </div>
      <label className="block text-[11px] text-white/75">
        目標觀眾
        <input
          value={audience}
          onChange={(event) => setAudience(event.target.value)}
          className="mt-1 w-full rounded-xl border border-white/25 bg-white/15 px-2 py-1.5 text-xs text-white placeholder:text-white/55"
          placeholder="例如：中學生、親子觀眾、企業訪客"
          maxLength={120}
        />
      </label>
      <label className="block text-[11px] text-white/75">
        語言
        <select
          value={language}
          onChange={(event) => setLanguage(event.target.value as "zh-TW" | "zh-CN" | "en")}
          className="mt-1 w-full rounded-xl border border-white/25 bg-white/15 px-2 py-1.5 text-xs text-white"
        >
          <option value="zh-TW">繁體中文</option>
          <option value="zh-CN">簡體中文</option>
          <option value="en">English</option>
        </select>
      </label>
      {error && <p className="rounded-xl border border-rose-200/40 bg-rose-500/15 px-2 py-1.5 text-[11px] text-rose-50">{error}</p>}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={!canGenerate}
        className="w-full rounded-xl border border-cyan-200/50 bg-cyan-500/25 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-cyan-500/35 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isGenerating ? "生成中..." : "生成策展方案"}
      </button>
      {preview && (
        <div className="space-y-2 rounded-xl border border-emerald-200/35 bg-emerald-500/12 p-3 text-xs text-white">
          <p className="text-sm font-semibold text-white">{preview.exhibition.title}</p>
          <p className="text-[11px] leading-relaxed text-white/75">{preview.exhibition.introduction}</p>
          <div className="space-y-1">
            {preview.exhibition.sections.map((section) => (
              <div key={section.id} className="rounded-lg border border-white/15 bg-white/10 px-2 py-1.5">
                <p className="font-semibold">{section.title}</p>
                <p className="text-white/70">{section.summary}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] leading-relaxed text-white/75">{preview.exhibition.guideOpening}</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleApply}
              className="rounded-xl border border-emerald-200/45 bg-emerald-500/30 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-500/40"
            >
              套用到展廳
            </button>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="rounded-xl border border-white/20 bg-white/12 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/18"
            >
              捨棄
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Mount the panel in EditUI**

In `src/app/modules/metaverse3d/components/UI/EditUI.tsx`, add imports:

```ts
import { AiCuratorPanel } from "./AiCuratorPanel";
```

In the More Tools panel, add a new open state next to `isAiBuilderOpen`:

```ts
const [isAiCuratorOpen, setIsAiCuratorOpen] = useState(false);
```

Render the button and panel before the existing AI Builder button:

```tsx
<button onClick={() => setIsAiCuratorOpen((prev) => !prev)} className={`w-full rounded-xl px-3 py-2 text-left text-xs font-semibold text-white transition-colors ${glassButtonClass}`}>
  AI 策展助手
</button>
{isAiCuratorOpen && (
  <AiCuratorPanel
    token={loadAuth().token}
    currentScene={useStore.getState().exportScene()}
    importScene={(scene) => {
      useStore.getState().importScene(scene);
      toast.success("AI 策展草稿已套用");
    }}
  />
)}
```

- [ ] **Step 5: Run panel test**

Run:

```bash
npm run test -- src/app/modules/metaverse3d/components/UI/AiCuratorPanel.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit editor panel**

Run:

```bash
git add src/app/modules/metaverse3d/components/UI/AiCuratorPanel.tsx src/app/modules/metaverse3d/components/UI/AiCuratorPanel.test.tsx src/app/modules/metaverse3d/components/UI/EditUI.tsx
git commit -m "feat: add ai curator editor panel" -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

## Task 5: Final Validation

**Files:**
- Modify only if validation exposes defects in files from Tasks 1-4.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm run test -- server/services/aiCuratorService.test.js
npm run test -- server/routes/aiCuratorRoutes.test.js
npm run test -- src/app/modules/metaverse3d/aiCurator/mapCuratorPlanToScene.test.ts
npm run test -- src/app/modules/metaverse3d/components/UI/AiCuratorPanel.test.tsx
```

Expected: all PASS.

- [ ] **Step 2: Run server syntax check**

Run:

```bash
npm run check:server
```

Expected: PASS.

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Manual smoke test**

Run the dev server:

```bash
npm run dev
```

Open the local Vite URL, log in, navigate to `/virtual-gallery/create`, open More Tools, open AI 策展助手, generate with:

```text
澳門非遺文化展
```

Expected:

- A preview appears with title, introduction, sections, and guide opening.
- The 3D scene does not change before clicking 套用到展廳.
- Clicking 套用到展廳 imports visible text panels and light strips.
- Save/autosave behavior remains controlled by the existing gallery creator.

- [ ] **Step 5: Commit validation fixes if any**

If validation required code changes, commit only those touched files:

```bash
git add <changed-files-from-ai-curator-work>
git commit -m "fix: stabilize ai curator validation" -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

If no fixes were needed, do not create an empty commit.

## Self-Review

- Spec coverage: backend structured generation, fallback, frontend preview, explicit apply, deterministic mapping, and focused tests are covered by Tasks 1-5.
- Scope check: visual review, autonomous revision, generation history, upload-aware analysis, and visitor Q&A remain out of scope.
- Placeholder scan: this plan intentionally uses no unfinished markers or undefined follow-up steps.
- Type consistency: `CuratorPlanRequest`, `CuratorPlanResponse`, `requestCuratorPlan`, and `mapCuratorPlanToScene` names are consistent across tasks.
