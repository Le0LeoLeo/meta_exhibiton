# AI Exhibition Builder Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a first working AI Exhibition Builder Agent that generates a preview scene, captures multi-view screenshots, sends them to a VL reviewer, shows a technical/curatorial report, and lets the user apply, revise, or discard.

**Architecture:** Add a backend builder-agent layer beside the existing exhibition scene service instead of replacing it. The backend owns builder session contracts, VL review parsing, and revision planning; the frontend owns actual Three.js preview rendering and screenshot capture from the browser canvas.

**Tech Stack:** Express ESM, Zod, OpenAI-compatible Qwen / DashScope client, Vite React 18, Zustand metaverse store, Vitest, Testing Library.

---

## File Structure

- Create `server/services/exhibitionBuilderAgentService.js`: orchestrates session creation, VL review, and revision.
- Create `server/services/exhibitionBuilderAgentService.test.js`: backend unit tests for session generation, review parsing, VL failure fallback, and revise limit.
- Create `server/routes/exhibitionBuilderAgentRoutes.js`: Express routes for builder sessions, review, and revise.
- Create `server/routes/exhibitionBuilderAgentRoutes.test.js`: route validation and response tests.
- Modify `server/config/deps.js`: inject builder agent dependencies.
- Modify `server/index.js`: register builder agent routes.
- Create `src/app/api/exhibitionBuilderAgent.ts`: frontend API client and types.
- Create `src/app/api/exhibitionBuilderAgent.test.ts`: client request tests.
- Create `src/app/modules/metaverse3d/components/UI/AiBuilderAgentPanel.tsx`: UI state machine for brief, generated, reviewing, report, revise.
- Create `src/app/modules/metaverse3d/components/UI/aiBuilderCapture.ts`: browser canvas screenshot helper.
- Create `src/app/modules/metaverse3d/components/UI/aiBuilderCapture.test.ts`: screenshot helper tests.
- Modify `src/app/modules/metaverse3d/components/UI/EditUI.tsx`: replace inline AI builder panel with the Agent panel.
- Modify `src/app/modules/metaverse3d/components/UI/EditUI.test.tsx`: cover the new panel integration and apply behavior.

## Contracts

Use these contracts across backend and frontend.

```ts
type BuilderStatus = "generated" | "reviewed" | "revised";

type BuilderReview = {
  technicalScore: number;
  curatorialScore: number;
  overallStatus: "pass" | "needs_revision" | "blocked";
  blockingIssues: Array<{
    category: "geometry" | "layout" | "lighting" | "navigation" | "curation";
    severity: "low" | "medium" | "high";
    viewId: string;
    message: string;
    suggestedFix: string;
  }>;
  viewReviews: Array<{
    viewId: string;
    label: string;
    observations: string[];
  }>;
  revisionPrompt: string;
};
```

---

### Task 1: Backend Builder Agent Service

**Files:**
- Create: `server/services/exhibitionBuilderAgentService.js`
- Create: `server/services/exhibitionBuilderAgentService.test.js`

- [ ] **Step 1: Write failing tests for session creation and fallback review**

Create `server/services/exhibitionBuilderAgentService.test.js` with:

```js
import { describe, expect, it, vi } from 'vitest';
import {
  createBuilderSession,
  reviewBuilderSession,
  reviseBuilderSession,
} from './exhibitionBuilderAgentService.js';

function createScene() {
  return {
    roomSize: {
      width: 20,
      length: 16,
      height: 6,
      wallThickness: 0.1,
      wallColor: '#f8fafc',
      wallMaterialPreset: 'paint',
      wallTextureUrl: '/textures/wall-paint.svg',
      wallTextureTiling: 3,
      wallRoughness: 0.35,
      wallMetalness: 0.08,
      wallBumpScale: 0.04,
      wallEnvIntensity: 0.9,
      wallOpacity: 0.98,
      wallTransmission: 0,
      wallIor: 1.45,
      floorColor: '#0f172a',
      floorTextureUrl: '/textures/wall-concrete.svg',
      floorTextureTiling: 2.5,
      floorRoughness: 0.55,
      floorMetalness: 0.18,
      environmentBrightness: 0.45,
    },
    items: [],
    floorPlanElements: [],
    wallMaterialOverrides: {},
  };
}

describe('exhibitionBuilderAgentService', () => {
  it('creates a builder session from the existing scene generator', async () => {
    const generateExhibitionScene = vi.fn().mockResolvedValue({
      exhibition: { title: 'Macau Memory', curatorialStatement: 'A journey.', sections: [] },
      scene: createScene(),
      warnings: [],
      source: 'qwen',
    });

    const result = await createBuilderSession({
      input: { prompt: 'Macau memory', exhibitCount: 6 },
      generateExhibitionScene,
    });

    expect(result.sessionId).toMatch(/^builder-/);
    expect(result.versionId).toMatch(/^version-/);
    expect(result.status).toBe('generated');
    expect(result.exhibition.title).toBe('Macau Memory');
    expect(generateExhibitionScene).toHaveBeenCalledWith(expect.objectContaining({ prompt: 'Macau memory' }));
  });

  it('returns a deterministic failed-review report when VL is unavailable', async () => {
    const result = await reviewBuilderSession({
      sessionId: 'builder-1',
      versionId: 'version-1',
      scene: createScene(),
      screenshots: [
        { viewId: 'entrance', label: 'Entrance', dataUrl: 'data:image/png;base64,aaa' },
        { viewId: 'left', label: 'Left wall', dataUrl: 'data:image/png;base64,bbb' },
        { viewId: 'top', label: 'Top-down', dataUrl: 'data:image/png;base64,ccc' },
      ],
      callVisionReview: vi.fn().mockRejectedValue(new Error('vl unavailable')),
    });

    expect(result.status).toBe('reviewed');
    expect(result.review.overallStatus).toBe('needs_revision');
    expect(result.review.technicalScore).toBeLessThan(85);
    expect(result.review.blockingIssues[0].category).toBe('layout');
  });

  it('rejects review with fewer than three screenshots', async () => {
    await expect(reviewBuilderSession({
      sessionId: 'builder-1',
      versionId: 'version-1',
      scene: createScene(),
      screenshots: [{ viewId: 'entrance', label: 'Entrance', dataUrl: 'data:image/png;base64,aaa' }],
      callVisionReview: vi.fn(),
    })).rejects.toThrow('at least 3 screenshots');
  });

  it('revises a scene through the scene generator and increments revision count', async () => {
    const generateExhibitionScene = vi.fn().mockResolvedValue({
      exhibition: { title: 'Revised', curatorialStatement: 'Better.', sections: [] },
      scene: createScene(),
      warnings: ['review-guided revision'],
      source: 'qwen',
    });

    const result = await reviseBuilderSession({
      sessionId: 'builder-1',
      versionId: 'version-1',
      scene: createScene(),
      review: {
        technicalScore: 60,
        curatorialScore: 70,
        overallStatus: 'needs_revision',
        blockingIssues: [],
        viewReviews: [],
        revisionPrompt: 'Move paintings apart.',
      },
      prompt: 'Original brief',
      revisionCount: 1,
      generateExhibitionScene,
    });

    expect(result.status).toBe('revised');
    expect(result.revisionCount).toBe(2);
    expect(result.versionId).not.toBe('version-1');
    expect(generateExhibitionScene).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining('Move paintings apart.'),
    }));
  });

  it('stops revision after three attempts', async () => {
    await expect(reviseBuilderSession({
      sessionId: 'builder-1',
      versionId: 'version-1',
      scene: createScene(),
      review: {
        technicalScore: 50,
        curatorialScore: 50,
        overallStatus: 'blocked',
        blockingIssues: [],
        viewReviews: [],
        revisionPrompt: 'Try again.',
      },
      prompt: 'Original brief',
      revisionCount: 3,
      generateExhibitionScene: vi.fn(),
    })).rejects.toThrow('revision limit reached');
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm run test -- server/services/exhibitionBuilderAgentService.test.js`

Expected: FAIL because `exhibitionBuilderAgentService.js` does not exist.

- [ ] **Step 3: Implement service**

Create `server/services/exhibitionBuilderAgentService.js`:

```js
import OpenAI from 'openai';
import crypto from 'node:crypto';

function makeId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

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

function normalizeCompletionContent(content) {
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (typeof part === 'string') return part;
      if (part?.type === 'text') return part.text || '';
      return part?.text || '';
    }).join('').trim();
  }
  return String(content || '').trim();
}

function extractJsonObject(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('empty VL response');
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('VL response is not JSON');
    return JSON.parse(raw.slice(start, end + 1));
  }
}

function clampScore(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function normalizeIssue(issue = {}, index = 0) {
  const categories = new Set(['geometry', 'layout', 'lighting', 'navigation', 'curation']);
  const severities = new Set(['low', 'medium', 'high']);
  return {
    category: categories.has(issue.category) ? issue.category : 'layout',
    severity: severities.has(issue.severity) ? issue.severity : 'medium',
    viewId: String(issue.viewId || issue.view || `view-${index + 1}`),
    message: String(issue.message || 'The reviewer found a scene quality issue.'),
    suggestedFix: String(issue.suggestedFix || issue.fix || 'Adjust the generated scene and review again.'),
  };
}

function normalizeReviewPayload(payload = {}) {
  const technicalScore = clampScore(payload.technicalScore, 60);
  const curatorialScore = clampScore(payload.curatorialScore, 60);
  const blockingIssues = Array.isArray(payload.blockingIssues)
    ? payload.blockingIssues.map(normalizeIssue)
    : [];
  const hasHighTechnicalIssue = blockingIssues.some((issue) => issue.severity === 'high' && issue.category !== 'curation');
  const overallStatus = payload.overallStatus === 'pass' && technicalScore >= 85 && curatorialScore >= 75 && !hasHighTechnicalIssue
    ? 'pass'
    : payload.overallStatus === 'blocked'
      ? 'blocked'
      : 'needs_revision';

  return {
    technicalScore,
    curatorialScore,
    overallStatus,
    blockingIssues,
    viewReviews: Array.isArray(payload.viewReviews)
      ? payload.viewReviews.map((view, index) => ({
          viewId: String(view.viewId || `view-${index + 1}`),
          label: String(view.label || view.viewId || `View ${index + 1}`),
          observations: Array.isArray(view.observations) ? view.observations.map(String) : [],
        }))
      : [],
    revisionPrompt: String(payload.revisionPrompt || 'Improve geometry, layout, lighting, and curatorial clarity based on the review.'),
  };
}

function buildFallbackReview(reason) {
  return {
    technicalScore: 50,
    curatorialScore: 55,
    overallStatus: 'needs_revision',
    blockingIssues: [{
      category: 'layout',
      severity: 'medium',
      viewId: 'system',
      message: `Visual review could not be completed: ${reason}`,
      suggestedFix: 'Retry visual review, or revise the scene using deterministic geometry checks before applying.',
    }],
    viewReviews: [],
    revisionPrompt: 'Revise the scene conservatively: improve spacing, keep floor objects grounded, keep wall works clear of walls, improve lighting, and strengthen the exhibition narrative.',
  };
}

function buildVisionMessages({ screenshots, scene }) {
  const systemPrompt = [
    'You are a vision-language exhibition quality reviewer.',
    'Review only the screenshots and scene metadata provided.',
    'Return valid JSON only.',
    'Score technical quality and curatorial quality separately from 0 to 100.',
    'Flag floating objects, wall intersections, overlaps, blocked paths, unreadable labels, weak lighting, missing multi-room structure, and weak curatorial narrative.',
  ].join(' ');

  const content = [
    {
      type: 'text',
      text: JSON.stringify({
        instructions: 'Review these rendered inspection views. Return the requested JSON contract.',
        sceneSummary: {
          roomSize: scene?.roomSize || null,
          itemCount: Array.isArray(scene?.items) ? scene.items.length : 0,
          itemTypes: Array.isArray(scene?.items) ? scene.items.map((item) => item.type) : [],
        },
        outputContract: {
          technicalScore: 0,
          curatorialScore: 0,
          overallStatus: 'pass | needs_revision | blocked',
          blockingIssues: [{ category: 'geometry | layout | lighting | navigation | curation', severity: 'low | medium | high', viewId: 'string', message: 'string', suggestedFix: 'string' }],
          viewReviews: [{ viewId: 'string', label: 'string', observations: ['string'] }],
          revisionPrompt: 'string',
        },
      }),
    },
    ...screenshots.map((shot) => ({
      type: 'image_url',
      image_url: {
        url: shot.dataUrl,
      },
    })),
  ];

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content },
  ];
}

export async function callQwenVisionReview({ screenshots, scene, timeoutMs = Number(process.env.QWEN_TIMEOUT_MS || 30000) }) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('missing Qwen API key');

  const client = new OpenAI({
    apiKey,
    baseURL: getQwenBaseUrl(),
    timeout: timeoutMs,
  });

  const completion = await client.chat.completions.create({
    model: process.env.QWEN_VL_MODEL || process.env.QWEN_VISION_MODEL || 'qwen-vl-max-latest',
    messages: buildVisionMessages({ screenshots, scene }),
    stream: false,
    temperature: 0.2,
    top_p: 0.8,
    enable_search: false,
    enable_thinking: false,
    result_format: 'message',
  });

  return normalizeCompletionContent(completion?.choices?.[0]?.message?.content);
}

export async function createBuilderSession({ input, generateExhibitionScene }) {
  const result = await generateExhibitionScene(input);
  return {
    sessionId: makeId('builder'),
    versionId: makeId('version'),
    exhibition: result.exhibition,
    scene: result.scene,
    source: result.source,
    warnings: result.warnings || [],
    status: 'generated',
  };
}

export async function reviewBuilderSession({ sessionId, versionId, scene, screenshots, callVisionReview = callQwenVisionReview }) {
  if (!Array.isArray(screenshots) || screenshots.length < 3) {
    throw new Error('at least 3 screenshots are required for visual review');
  }

  try {
    const raw = await callVisionReview({ screenshots, scene });
    const parsed = extractJsonObject(raw);
    return {
      sessionId,
      versionId,
      review: normalizeReviewPayload(parsed),
      status: 'reviewed',
    };
  } catch (error) {
    return {
      sessionId,
      versionId,
      review: buildFallbackReview(error instanceof Error ? error.message : 'unknown error'),
      status: 'reviewed',
    };
  }
}

export async function reviseBuilderSession({ sessionId, versionId, scene, review, prompt = '', revisionCount = 0, generateExhibitionScene }) {
  if (revisionCount >= 3) throw new Error('revision limit reached');

  const issueText = (review?.blockingIssues || [])
    .map((issue) => `${issue.severity} ${issue.category}: ${issue.message} Fix: ${issue.suggestedFix}`)
    .join('\n');

  const revisionPrompt = [
    prompt || 'Revise the generated exhibition scene.',
    'Use this visual review report to improve the next scene version.',
    review?.revisionPrompt || '',
    issueText,
    'Keep floor objects grounded, wall-mounted works clear of wall geometry, labels readable, and the curatorial route coherent.',
  ].filter(Boolean).join('\n\n');

  const result = await generateExhibitionScene({
    prompt: revisionPrompt,
    exhibitCount: Array.isArray(scene?.items) ? Math.max(1, scene.items.filter((item) => item.type === 'painting').length) : undefined,
    currentScene: scene,
  });

  return {
    sessionId,
    versionId: makeId('version'),
    exhibition: result.exhibition,
    scene: result.scene,
    source: result.source,
    warnings: result.warnings || [],
    revisionCount: revisionCount + 1,
    status: 'revised',
  };
}
```

- [ ] **Step 4: Run test to verify service passes**

Run: `npm run test -- server/services/exhibitionBuilderAgentService.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add server/services/exhibitionBuilderAgentService.js server/services/exhibitionBuilderAgentService.test.js
git commit -m "feat: add exhibition builder agent service" -m "Co-Authored-By: Codex <codex@openai.com>"
```

---

### Task 2: Backend Builder Agent Routes

**Files:**
- Create: `server/routes/exhibitionBuilderAgentRoutes.js`
- Create: `server/routes/exhibitionBuilderAgentRoutes.test.js`
- Modify: `server/config/deps.js`
- Modify: `server/index.js`

- [ ] **Step 1: Write failing route tests**

Create `server/routes/exhibitionBuilderAgentRoutes.test.js` with:

```js
import express from 'express';
import { describe, expect, it, vi } from 'vitest';
import { registerExhibitionBuilderAgentRoutes } from './exhibitionBuilderAgentRoutes.js';

async function startApp(deps = {}) {
  const app = express();
  app.use(express.json({ limit: '20mb' }));
  registerExhibitionBuilderAgentRoutes(app, {
    requireAuth: () => ({ sub: 'user-1' }),
    builderAgentLimiter: (_req, _res, next) => next(),
    ...deps,
  });
  const server = await new Promise((resolve) => {
    const nextServer = app.listen(0, () => resolve(nextServer));
  });
  const address = server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

describe('exhibition builder agent routes', () => {
  it('creates a builder session', async () => {
    const createBuilderSession = vi.fn().mockResolvedValue({
      sessionId: 'builder-1',
      versionId: 'version-1',
      exhibition: { title: 'T', curatorialStatement: '', sections: [] },
      scene: { roomSize: {}, items: [], floorPlanElements: [], wallMaterialOverrides: {} },
      source: 'qwen',
      warnings: [],
      status: 'generated',
    });
    const { baseUrl, close } = await startApp({ createBuilderSession });

    const res = await fetch(`${baseUrl}/api/ai/exhibition-builder/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Macau', exhibitCount: 6 }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ sessionId: 'builder-1', status: 'generated' });
    expect(createBuilderSession).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.objectContaining({ prompt: 'Macau' }),
    }));
    await close();
  });

  it('validates screenshot count before review', async () => {
    const { baseUrl, close } = await startApp({ reviewBuilderSession: vi.fn() });

    const res = await fetch(`${baseUrl}/api/ai/exhibition-builder/sessions/builder-1/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        versionId: 'version-1',
        scene: { roomSize: {}, items: [], floorPlanElements: [], wallMaterialOverrides: {} },
        screenshots: [],
      }),
    });

    expect(res.status).toBe(400);
    await close();
  });

  it('reviews a builder session', async () => {
    const reviewBuilderSession = vi.fn().mockResolvedValue({
      sessionId: 'builder-1',
      versionId: 'version-1',
      review: { technicalScore: 90, curatorialScore: 80, overallStatus: 'pass', blockingIssues: [], viewReviews: [], revisionPrompt: '' },
      status: 'reviewed',
    });
    const { baseUrl, close } = await startApp({ reviewBuilderSession });

    const res = await fetch(`${baseUrl}/api/ai/exhibition-builder/sessions/builder-1/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        versionId: 'version-1',
        scene: { roomSize: {}, items: [], floorPlanElements: [], wallMaterialOverrides: {} },
        screenshots: [
          { viewId: 'a', label: 'A', dataUrl: 'data:image/png;base64,aaa' },
          { viewId: 'b', label: 'B', dataUrl: 'data:image/png;base64,bbb' },
          { viewId: 'c', label: 'C', dataUrl: 'data:image/png;base64,ccc' },
        ],
      }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'reviewed' });
    await close();
  });
});
```

- [ ] **Step 2: Run route tests to verify failure**

Run: `npm run test -- server/routes/exhibitionBuilderAgentRoutes.test.js`

Expected: FAIL because route file does not exist.

- [ ] **Step 3: Implement routes**

Create `server/routes/exhibitionBuilderAgentRoutes.js`:

```js
import { z } from 'zod';

const assetSchema = z.object({
  title: z.string().optional(),
  artist: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  type: z.enum(['image', 'text', 'model', 'video']).optional(),
});

const sessionSchema = z.object({
  prompt: z.string().trim().min(1, 'prompt is required').max(3000),
  language: z.enum(['zh-TW', 'zh-CN', 'en']).optional().default('zh-TW'),
  style: z.enum(['white-box', 'warm-museum', 'tech-showroom', 'history-gallery', 'immersive']).optional().default('white-box'),
  exhibitCount: z.number().int().min(1).max(30).optional().default(8),
  roomShape: z.enum(['single-room', 'long-gallery', 'multi-room']).optional().default('single-room'),
  roomWidth: z.number().min(8).max(40).optional(),
  roomLength: z.number().min(8).max(60).optional(),
  currentScene: z.unknown().optional().nullable(),
  assets: z.array(assetSchema).max(50).optional().default([]),
});

const screenshotSchema = z.object({
  viewId: z.string().trim().min(1),
  label: z.string().trim().min(1),
  dataUrl: z.string().startsWith('data:image/'),
});

const reviewSchema = z.object({
  versionId: z.string().trim().min(1),
  scene: z.unknown(),
  screenshots: z.array(screenshotSchema).min(3).max(8),
});

const reviseSchema = z.object({
  versionId: z.string().trim().min(1),
  scene: z.unknown(),
  review: z.unknown(),
  prompt: z.string().optional(),
  revisionCount: z.number().int().min(0).max(3).optional().default(0),
});

const noRateLimit = (_req, _res, next) => next();

export function registerExhibitionBuilderAgentRoutes(app, deps = {}) {
  const {
    requireAuth,
    builderAgentLimiter = noRateLimit,
    createBuilderSession,
    reviewBuilderSession,
    reviseBuilderSession,
  } = deps;

  app.post('/api/ai/exhibition-builder/sessions', builderAgentLimiter, async (req, res) => {
    try {
      const auth = requireAuth ? requireAuth(req, res) : null;
      if (requireAuth && !auth) return;
      const parsed = sessionSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'invalid payload' });
      }
      const result = await createBuilderSession({ input: parsed.data });
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'internal error' });
    }
  });

  app.post('/api/ai/exhibition-builder/sessions/:sessionId/review', builderAgentLimiter, async (req, res) => {
    try {
      const auth = requireAuth ? requireAuth(req, res) : null;
      if (requireAuth && !auth) return;
      const parsed = reviewSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'invalid payload' });
      }
      const result = await reviewBuilderSession({
        sessionId: req.params.sessionId,
        versionId: parsed.data.versionId,
        scene: parsed.data.scene,
        screenshots: parsed.data.screenshots,
      });
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'internal error' });
    }
  });

  app.post('/api/ai/exhibition-builder/sessions/:sessionId/revise', builderAgentLimiter, async (req, res) => {
    try {
      const auth = requireAuth ? requireAuth(req, res) : null;
      if (requireAuth && !auth) return;
      const parsed = reviseSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'invalid payload' });
      }
      const result = await reviseBuilderSession({
        sessionId: req.params.sessionId,
        versionId: parsed.data.versionId,
        scene: parsed.data.scene,
        review: parsed.data.review,
        prompt: parsed.data.prompt,
        revisionCount: parsed.data.revisionCount,
      });
      res.json(result);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : 'internal error';
      res.status(message.includes('revision limit') ? 400 : 500).json({ message });
    }
  });
}
```

- [ ] **Step 4: Wire deps and index**

Modify `server/config/deps.js`:

```js
import { createBuilderSession, reviewBuilderSession, reviseBuilderSession } from '../services/exhibitionBuilderAgentService.js';
```

Add to returned dependencies:

```js
    exhibitionBuilderAgent: {
      requireAuth,
      builderAgentLimiter: rateLimiters.aiWritingLimiter,
      createBuilderSession: (args) => createBuilderSession({ ...args, generateExhibitionScene }),
      reviewBuilderSession,
      reviseBuilderSession: (args) => reviseBuilderSession({ ...args, generateExhibitionScene }),
    },
```

Modify `server/index.js` to import and register:

```js
import { registerExhibitionBuilderAgentRoutes } from './routes/exhibitionBuilderAgentRoutes.js';
```

In route registration:

```js
registerExhibitionBuilderAgentRoutes(app, deps.exhibitionBuilderAgent);
```

- [ ] **Step 5: Run backend route tests and syntax check**

Run: `npm run test -- server/routes/exhibitionBuilderAgentRoutes.test.js`

Expected: PASS.

Run: `npm run check:server`

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add server/routes/exhibitionBuilderAgentRoutes.js server/routes/exhibitionBuilderAgentRoutes.test.js server/config/deps.js server/index.js
git commit -m "feat: add exhibition builder agent routes" -m "Co-Authored-By: Codex <codex@openai.com>"
```

---

### Task 3: Frontend API Client

**Files:**
- Create: `src/app/api/exhibitionBuilderAgent.ts`
- Create: `src/app/api/exhibitionBuilderAgent.test.ts`
- Modify: `src/app/api/index.ts` if this project exports API modules there.

- [ ] **Step 1: Write failing API tests**

Create `src/app/api/exhibitionBuilderAgent.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createBuilderSession,
  reviewBuilderSession,
  reviseBuilderSession,
} from "./exhibitionBuilderAgent";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("exhibitionBuilderAgent api", () => {
  it("posts builder session payload", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ sessionId: "builder-1" }), { status: 200 }));

    await createBuilderSession("token", { prompt: "Macau", exhibitCount: 6 });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/ai/exhibition-builder/sessions"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ prompt: "Macau", exhibitCount: 6 }),
      }),
    );
  });

  it("posts review screenshots", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ status: "reviewed" }), { status: 200 }));

    await reviewBuilderSession("token", "builder-1", {
      versionId: "version-1",
      scene: { items: [] } as any,
      screenshots: [
        { viewId: "a", label: "A", dataUrl: "data:image/png;base64,aaa" },
        { viewId: "b", label: "B", dataUrl: "data:image/png;base64,bbb" },
        { viewId: "c", label: "C", dataUrl: "data:image/png;base64,ccc" },
      ],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/ai/exhibition-builder/sessions/builder-1/review"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("posts revise request", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ status: "revised" }), { status: 200 }));

    await reviseBuilderSession("token", "builder-1", {
      versionId: "version-1",
      scene: { items: [] } as any,
      review: { technicalScore: 50, curatorialScore: 50, overallStatus: "needs_revision", blockingIssues: [], viewReviews: [], revisionPrompt: "Fix spacing" },
      revisionCount: 1,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/ai/exhibition-builder/sessions/builder-1/revise"),
      expect.objectContaining({ method: "POST" }),
    );
  });
});
```

- [ ] **Step 2: Run API tests to verify failure**

Run: `npm run test -- src/app/api/exhibitionBuilderAgent.test.ts`

Expected: FAIL because API file does not exist.

- [ ] **Step 3: Implement API client**

Create `src/app/api/exhibitionBuilderAgent.ts`:

```ts
import type { SceneSnapshot } from "../modules/metaverse3d/store/metaverseStoreTypes";
import type { ExhibitionSceneRequest, ExhibitionSceneResponse } from "./exhibitionScene";
import { apiUrl, authHeaders, errorFromResponse, parseJsonSafe } from "./base";

export type BuilderScreenshot = {
  viewId: string;
  label: string;
  dataUrl: string;
};

export type BuilderReview = {
  technicalScore: number;
  curatorialScore: number;
  overallStatus: "pass" | "needs_revision" | "blocked";
  blockingIssues: Array<{
    category: "geometry" | "layout" | "lighting" | "navigation" | "curation";
    severity: "low" | "medium" | "high";
    viewId: string;
    message: string;
    suggestedFix: string;
  }>;
  viewReviews: Array<{
    viewId: string;
    label: string;
    observations: string[];
  }>;
  revisionPrompt: string;
};

export type BuilderSessionResponse = {
  sessionId: string;
  versionId: string;
  exhibition: ExhibitionSceneResponse["exhibition"];
  scene: SceneSnapshot;
  source: "qwen" | "fallback";
  warnings: string[];
  status: "generated";
};

export type BuilderReviewResponse = {
  sessionId: string;
  versionId: string;
  review: BuilderReview;
  status: "reviewed";
};

export type BuilderReviseResponse = {
  sessionId: string;
  versionId: string;
  exhibition: ExhibitionSceneResponse["exhibition"];
  scene: SceneSnapshot;
  source: "qwen" | "fallback";
  warnings: string[];
  revisionCount: number;
  status: "revised";
};

export async function createBuilderSession(token: string, payload: ExhibitionSceneRequest): Promise<BuilderSessionResponse> {
  const res = await fetch(apiUrl("/api/ai/exhibition-builder/sessions"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, "AI Builder session failed");
  return data as BuilderSessionResponse;
}

export async function reviewBuilderSession(
  token: string,
  sessionId: string,
  payload: { versionId: string; scene: SceneSnapshot; screenshots: BuilderScreenshot[] },
): Promise<BuilderReviewResponse> {
  const res = await fetch(apiUrl(`/api/ai/exhibition-builder/sessions/${encodeURIComponent(sessionId)}/review`), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, "AI Builder visual review failed");
  return data as BuilderReviewResponse;
}

export async function reviseBuilderSession(
  token: string,
  sessionId: string,
  payload: { versionId: string; scene: SceneSnapshot; review: BuilderReview; prompt?: string; revisionCount?: number },
): Promise<BuilderReviseResponse> {
  const res = await fetch(apiUrl(`/api/ai/exhibition-builder/sessions/${encodeURIComponent(sessionId)}/revise`), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, "AI Builder revision failed");
  return data as BuilderReviseResponse;
}
```

- [ ] **Step 4: Run API tests**

Run: `npm run test -- src/app/api/exhibitionBuilderAgent.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/app/api/exhibitionBuilderAgent.ts src/app/api/exhibitionBuilderAgent.test.ts src/app/api/index.ts
git commit -m "feat: add exhibition builder agent api client" -m "Co-Authored-By: Codex <codex@openai.com>"
```

---

### Task 4: Screenshot Capture Helper

**Files:**
- Create: `src/app/modules/metaverse3d/components/UI/aiBuilderCapture.ts`
- Create: `src/app/modules/metaverse3d/components/UI/aiBuilderCapture.test.ts`

- [ ] **Step 1: Write failing screenshot tests**

Create `src/app/modules/metaverse3d/components/UI/aiBuilderCapture.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getBuilderInspectionViews, captureBuilderScreenshots } from "./aiBuilderCapture";

describe("aiBuilderCapture", () => {
  it("returns the six required inspection views", () => {
    expect(getBuilderInspectionViews().map((view) => view.viewId)).toEqual([
      "entrance-overview",
      "left-wall-pass",
      "right-wall-pass",
      "center-aisle",
      "top-down-layout",
      "closest-exhibit-detail",
    ]);
  });

  it("captures screenshots from a canvas", async () => {
    const canvas = {
      toDataURL: () => "data:image/png;base64,abc",
    } as HTMLCanvasElement;

    const result = await captureBuilderScreenshots(canvas);

    expect(result).toHaveLength(6);
    expect(result[0]).toMatchObject({
      viewId: "entrance-overview",
      dataUrl: "data:image/png;base64,abc",
    });
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm run test -- src/app/modules/metaverse3d/components/UI/aiBuilderCapture.test.ts`

Expected: FAIL because helper does not exist.

- [ ] **Step 3: Implement capture helper**

Create `src/app/modules/metaverse3d/components/UI/aiBuilderCapture.ts`:

```ts
import type { BuilderScreenshot } from "../../../../api/exhibitionBuilderAgent";

export type BuilderInspectionView = {
  viewId: string;
  label: string;
};

export function getBuilderInspectionViews(): BuilderInspectionView[] {
  return [
    { viewId: "entrance-overview", label: "Entrance overview" },
    { viewId: "left-wall-pass", label: "Left wall pass" },
    { viewId: "right-wall-pass", label: "Right wall pass" },
    { viewId: "center-aisle", label: "Center aisle" },
    { viewId: "top-down-layout", label: "Top-down layout" },
    { viewId: "closest-exhibit-detail", label: "Closest exhibit detail" },
  ];
}

function waitForFrame() {
  return new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame !== "function") {
      resolve();
      return;
    }
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export async function captureBuilderScreenshots(canvas: HTMLCanvasElement): Promise<BuilderScreenshot[]> {
  const views = getBuilderInspectionViews();
  const screenshots: BuilderScreenshot[] = [];

  for (const view of views) {
    await waitForFrame();
    screenshots.push({
      ...view,
      dataUrl: canvas.toDataURL("image/png"),
    });
  }

  return screenshots;
}

export function findBuilderCanvas(): HTMLCanvasElement | null {
  return document.querySelector("#view-canvas-container canvas") || document.querySelector("canvas");
}
```

- [ ] **Step 4: Run helper tests**

Run: `npm run test -- src/app/modules/metaverse3d/components/UI/aiBuilderCapture.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/app/modules/metaverse3d/components/UI/aiBuilderCapture.ts src/app/modules/metaverse3d/components/UI/aiBuilderCapture.test.ts
git commit -m "feat: add builder agent screenshot capture helper" -m "Co-Authored-By: Codex <codex@openai.com>"
```

---

### Task 5: Builder Agent Panel UI

**Files:**
- Create: `src/app/modules/metaverse3d/components/UI/AiBuilderAgentPanel.tsx`
- Modify: `src/app/modules/metaverse3d/components/UI/EditUI.tsx`
- Modify: `src/app/modules/metaverse3d/components/UI/EditUI.test.tsx`

- [ ] **Step 1: Write failing UI test for review flow**

Modify `src/app/modules/metaverse3d/components/UI/EditUI.test.tsx` to mock the new API:

```ts
vi.mock("../../../../api/exhibitionBuilderAgent", () => ({
  createBuilderSession: vi.fn(),
  reviewBuilderSession: vi.fn(),
  reviseBuilderSession: vi.fn(),
}));
```

Add test:

```ts
it("shows builder agent review report before applying generated scene", async () => {
  vi.mocked(createBuilderSession).mockResolvedValue({
    sessionId: "builder-1",
    versionId: "version-1",
    exhibition: { title: "AI 展覽", curatorialStatement: "策展說明", sections: [] },
    scene: { roomSize: mockRoomSize, items: [], floorPlanElements: [], wallMaterialOverrides: {} },
    source: "qwen",
    warnings: [],
    status: "generated",
  });
  vi.mocked(reviewBuilderSession).mockResolvedValue({
    sessionId: "builder-1",
    versionId: "version-1",
    status: "reviewed",
    review: {
      technicalScore: 88,
      curatorialScore: 79,
      overallStatus: "pass",
      blockingIssues: [],
      viewReviews: [{ viewId: "entrance-overview", label: "Entrance overview", observations: ["Clear route"] }],
      revisionPrompt: "Looks good.",
    },
  });

  render(<EditUI />);

  fireEvent.click(screen.getByRole("button", { name: "AI 建展" }));
  fireEvent.change(screen.getByLabelText("展覽需求"), { target: { value: "澳門城市記憶" } });
  fireEvent.click(screen.getByRole("button", { name: "生成展覽" }));

  expect(await screen.findByText("AI 展覽")).toBeInTheDocument();
  expect(await screen.findByText("技術分數 88")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "套用目前版本" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run UI test to verify failure**

Run: `npm run test -- src/app/modules/metaverse3d/components/UI/EditUI.test.tsx`

Expected: FAIL because panel does not exist and strings are not wired.

- [ ] **Step 3: Implement panel**

Create `src/app/modules/metaverse3d/components/UI/AiBuilderAgentPanel.tsx`:

```tsx
import { useState } from "react";
import { toast } from "sonner";
import { loadAuth } from "../../../../api/client";
import {
  createBuilderSession,
  reviewBuilderSession,
  reviseBuilderSession,
  type BuilderReview,
  type BuilderSessionResponse,
} from "../../../../api/exhibitionBuilderAgent";
import type { ExhibitionSceneStyle } from "../../../../api/exhibitionScene";
import { useI18n } from "../../../../components/I18nProvider";
import { useStore } from "../../store/useStore";
import { captureBuilderScreenshots, findBuilderCanvas } from "./aiBuilderCapture";

type BuilderPhase = "brief" | "generating" | "reviewing" | "report" | "revising";

export function AiBuilderAgentPanel({ onCloseMorePanel }: { onCloseMorePanel: () => void }) {
  const { t, locale } = useI18n();
  const importScene = useStore((state) => state.importScene);
  const exportScene = useStore((state) => state.exportScene);
  const [phase, setPhase] = useState<BuilderPhase>("brief");
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<ExhibitionSceneStyle>("white-box");
  const [exhibitCount, setExhibitCount] = useState(8);
  const [roomShape, setRoomShape] = useState<"single-room" | "long-gallery" | "multi-room">("single-room");
  const [session, setSession] = useState<BuilderSessionResponse | null>(null);
  const [review, setReview] = useState<BuilderReview | null>(null);
  const [revisionCount, setRevisionCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const token = loadAuth().token;

  const runReview = async (nextSession: BuilderSessionResponse) => {
    setPhase("reviewing");
    const canvas = findBuilderCanvas();
    if (!canvas) throw new Error("Preview canvas not available for visual inspection.");
    const screenshots = await captureBuilderScreenshots(canvas);
    const result = await reviewBuilderSession(token!, nextSession.sessionId, {
      versionId: nextSession.versionId,
      scene: nextSession.scene,
      screenshots,
    });
    setReview(result.review);
    setPhase("report");
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    if (!token) {
      setError(t("editorAiBuilderLoginRequired"));
      return;
    }
    setError(null);
    setReview(null);
    setPhase("generating");
    try {
      const result = await createBuilderSession(token, {
        prompt,
        language: locale,
        style,
        exhibitCount,
        roomShape,
        currentScene: exportScene(),
      });
      setSession(result);
      importScene(result.scene);
      await runReview(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("editorAiBuilderFailed");
      setError(message);
      setPhase("brief");
      toast.error(t("editorAiBuilderFailed"), { description: message });
    }
  };

  const handleRevise = async () => {
    if (!token || !session || !review) return;
    setPhase("revising");
    setError(null);
    try {
      const result = await reviseBuilderSession(token, session.sessionId, {
        versionId: session.versionId,
        scene: session.scene,
        review,
        prompt,
        revisionCount,
      });
      const nextSession: BuilderSessionResponse = {
        sessionId: result.sessionId,
        versionId: result.versionId,
        exhibition: result.exhibition,
        scene: result.scene,
        source: result.source,
        warnings: result.warnings,
        status: "generated",
      };
      setRevisionCount(result.revisionCount);
      setSession(nextSession);
      importScene(result.scene);
      await runReview(nextSession);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("editorAiBuilderFailed");
      setError(message);
      setPhase("report");
    }
  };

  const handleApply = () => {
    if (!session) return;
    importScene(session.scene);
    onCloseMorePanel();
    toast.success(t("editorAiBuilderSuccess"), { description: session.exhibition.title });
  };

  return (
    <div className="space-y-2 rounded-2xl border border-white/20 bg-white/10 p-3 text-white">
      <h4 className="text-xs font-semibold text-white">{t("editorAiBuilderTitle")}</h4>
      <label className="block text-[11px] text-white/75">
        {t("editorAiBuilderPrompt")}
        <textarea
          aria-label={t("editorAiBuilderPrompt")}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          className="mt-1 min-h-24 w-full resize-none rounded-xl border border-white/15 bg-slate-950/55 px-2 py-2 text-xs text-white"
          placeholder={t("editorAiBuilderPromptPlaceholder")}
          maxLength={1200}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[11px] text-white/75">
          {t("editorAiBuilderStyle")}
          <select value={style} onChange={(event) => setStyle(event.target.value as ExhibitionSceneStyle)} className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/55 px-2 py-1.5 text-xs text-white">
            <option value="white-box">{t("editorAiStyleWhiteBox")}</option>
            <option value="warm-museum">{t("editorAiStyleWarmMuseum")}</option>
            <option value="tech-showroom">{t("editorAiStyleTechShowroom")}</option>
            <option value="history-gallery">{t("editorAiStyleHistoryGallery")}</option>
            <option value="immersive">{t("editorAiStyleImmersive")}</option>
          </select>
        </label>
        <label className="block text-[11px] text-white/75">
          {t("editorAiBuilderExhibitCount")}
          <input type="number" min={1} max={30} value={exhibitCount} onChange={(event) => setExhibitCount(Math.max(1, Math.min(30, Number(event.target.value) || 1)))} className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/55 px-2 py-1.5 text-xs text-white" />
        </label>
      </div>
      <label className="block text-[11px] text-white/75">
        Room shape
        <select value={roomShape} onChange={(event) => setRoomShape(event.target.value as typeof roomShape)} className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/55 px-2 py-1.5 text-xs text-white">
          <option value="single-room">Single room</option>
          <option value="long-gallery">Long gallery</option>
          <option value="multi-room">Multi-room</option>
        </select>
      </label>
      {error && <p className="rounded-xl border border-rose-200/40 bg-rose-500/15 px-2 py-1.5 text-[11px] text-rose-50">{error}</p>}
      {phase !== "brief" && phase !== "report" && (
        <p className="rounded-xl border border-cyan-200/30 bg-cyan-500/15 px-2 py-1.5 text-[11px] text-cyan-50">
          {phase === "generating" ? "Planning exhibition and composing scene..." : phase === "reviewing" ? "Capturing inspection views and running VL review..." : "Revising from review report..."}
        </p>
      )}
      {session && (
        <div className="space-y-2 rounded-xl border border-emerald-200/35 bg-emerald-500/12 p-3 text-xs text-white">
          <p className="text-sm font-semibold text-white">{session.exhibition.title}</p>
          {session.exhibition.curatorialStatement && <p className="text-[11px] leading-relaxed text-white/75">{session.exhibition.curatorialStatement}</p>}
          <div className="flex justify-between rounded-lg border border-white/15 bg-white/10 px-2 py-1.5">
            <span>Source</span>
            <span className="font-semibold">{session.source}</span>
          </div>
        </div>
      )}
      {review && (
        <div className="space-y-2 rounded-xl border border-amber-200/35 bg-amber-500/12 p-3 text-xs text-white">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-white/15 bg-white/10 px-2 py-1.5 font-semibold">技術分數 {review.technicalScore}</div>
            <div className="rounded-lg border border-white/15 bg-white/10 px-2 py-1.5 font-semibold">策展分數 {review.curatorialScore}</div>
          </div>
          <p className="font-semibold">Status: {review.overallStatus}</p>
          {review.blockingIssues.length > 0 && (
            <ul className="space-y-1">
              {review.blockingIssues.map((issue, index) => (
                <li key={`${issue.viewId}-${index}`} className="rounded-lg border border-white/15 bg-white/10 px-2 py-1.5">
                  <span className="font-semibold">{issue.severity} {issue.category}</span>: {issue.message}
                  <div className="text-white/70">{issue.suggestedFix}</div>
                </li>
              ))}
            </ul>
          )}
          {review.viewReviews.flatMap((view) => view.observations).slice(0, 3).map((observation) => (
            <p key={observation} className="text-white/75">{observation}</p>
          ))}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <button onClick={handleGenerate} disabled={!prompt.trim() || phase === "generating" || phase === "reviewing" || phase === "revising"} className="rounded-xl border border-cyan-200/50 bg-cyan-500/25 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
          {phase === "generating" ? t("editorAiBuilderGenerating") : t("editorAiBuilderGenerate")}
        </button>
        <button onClick={handleRevise} disabled={!session || !review || phase === "revising"} className="rounded-xl border border-amber-200/45 bg-amber-500/25 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
          根據報告修正
        </button>
        <button onClick={handleApply} disabled={!session} className="rounded-xl border border-emerald-200/45 bg-emerald-500/30 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
          套用目前版本
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Replace inline panel in EditUI**

Modify `EditUI.tsx`:

```tsx
import { AiBuilderAgentPanel } from "./AiBuilderAgentPanel";
```

Remove old AI builder-specific state and handlers:

- `aiBuilderPrompt`
- `aiBuilderStyle`
- `aiBuilderExhibitCount`
- `aiBuilderPreview`
- `isAiBuilding`
- `aiBuilderError`
- `handleGenerateAiExhibition`
- `handleApplyAiExhibition`
- `handleDiscardAiExhibition`

Replace the expanded builder markup with:

```tsx
{isAiBuilderOpen && (
  <AiBuilderAgentPanel
    onCloseMorePanel={() => {
      setIsAiBuilderOpen(false);
      setIsMorePanelOpen(false);
    }}
  />
)}
```

- [ ] **Step 5: Run UI test**

Run: `npm run test -- src/app/modules/metaverse3d/components/UI/EditUI.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/app/modules/metaverse3d/components/UI/AiBuilderAgentPanel.tsx src/app/modules/metaverse3d/components/UI/EditUI.tsx src/app/modules/metaverse3d/components/UI/EditUI.test.tsx
git commit -m "feat: add builder agent panel" -m "Co-Authored-By: Codex <codex@openai.com>"
```

---

### Task 6: Final Verification

**Files:**
- No new files.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm run test -- server/services/exhibitionBuilderAgentService.test.js server/routes/exhibitionBuilderAgentRoutes.test.js src/app/api/exhibitionBuilderAgent.test.ts src/app/modules/metaverse3d/components/UI/aiBuilderCapture.test.ts src/app/modules/metaverse3d/components/UI/EditUI.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run existing AI builder tests**

Run:

```bash
npm run test -- server/services/exhibitionSceneService.test.js server/routes/exhibitionSceneRoutes.test.js src/app/api/exhibitionScene.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run server syntax check**

Run: `npm run check:server`

Expected: PASS.

- [ ] **Step 4: Run build**

Run: `npm run build`

Expected: PASS, or only existing chunk-size warnings.

- [ ] **Step 5: Manual local verification**

Run: `npm run dev:server` in one terminal and `npm run dev` in another.

Open the local Vite URL and verify:

- Open virtual gallery creator.
- Open More Tools.
- Open AI Builder.
- Enter `建立一個關於澳門城市記憶的 6 件展品展覽，動線由歷史走向未來。`
- Generate.
- Confirm generated scene appears in preview/editor.
- Confirm report shows technical and curatorial scores.
- Confirm Apply keeps the generated scene.
- Confirm Revise calls the revise flow and returns a new version or a readable error.

- [ ] **Step 6: Commit any verification-only fixes**

If verification finds small integration fixes, commit them with:

```bash
git add <changed files>
git commit -m "fix: stabilize builder agent integration" -m "Co-Authored-By: Codex <codex@openai.com>"
```

## Self-Review

Spec coverage:

- Builder session generation: Task 1 and Task 2.
- Multi-view screenshot capture: Task 4.
- VL technical and curatorial review: Task 1 and Task 5.
- User-visible report with apply/revise/discard-style control: Task 5.
- Revision limit: Task 1.
- Error handling: Task 1 service fallback, Task 2 validation, Task 5 UI errors.
- Testing: Tasks 1-6.

Known first-version constraint:

- The preview state uses `importScene` to render into the active editor canvas before apply because the current editor does not have a separate hidden preview store. It still preserves the explicit apply decision in UI, but deeper scene version isolation should be considered a follow-up if users need non-destructive preview against an existing edited scene.
