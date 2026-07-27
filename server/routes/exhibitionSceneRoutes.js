import { z } from 'zod';
import { sendInternalError } from '../config/errorHandling.js';

const assetSchema = z.object({
  title: z.string().optional(),
  artist: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  type: z.enum(['image', 'text', 'model', 'video']).optional(),
});

const exhibitionSceneRequestSchema = z.object({
  prompt: z.string().trim().min(1, 'prompt is required').max(3000, 'prompt too long'),
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
  viewId: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(120),
  dataUrl: z.string().startsWith('data:image/').max(8_000_000),
});

const builderReviewSchema = z.object({
  technicalScore: z.number().min(0).max(100),
  curatorialScore: z.number().min(0).max(100),
  overallStatus: z.enum(['pass', 'needs_revision', 'blocked']),
  blockingIssues: z.array(z.object({
    category: z.enum(['geometry', 'layout', 'lighting', 'navigation', 'curation']),
    severity: z.enum(['low', 'medium', 'high']),
    viewId: z.string(),
    message: z.string(),
    suggestedFix: z.string(),
  })).default([]),
  viewReviews: z.array(z.object({
    viewId: z.string(),
    label: z.string(),
    observations: z.array(z.string()).default([]),
  })).default([]),
  revisionPrompt: z.string().default('Improve the generated exhibition scene.'),
});

const builderReviewRequestSchema = z.object({
  sessionId: z.string().trim().min(1),
  versionId: z.string().trim().min(1),
  scene: z.unknown(),
  screenshots: z.array(screenshotSchema).min(3).max(8),
});

const builderReviseRequestSchema = z.object({
  sessionId: z.string().trim().min(1),
  versionId: z.string().trim().min(1),
  scene: z.unknown(),
  review: builderReviewSchema.optional().nullable(),
  prompt: z.string().trim().max(3000).optional().default(''),
  revisionCount: z.number().int().min(0).max(3).optional().default(0),
}).refine((value) => value.review || value.prompt, {
  message: 'review or prompt is required',
});

const noRateLimit = (_req, _res, next) => next();

export function registerExhibitionSceneRoutes(app, deps = {}) {
  const {
    requireActiveUser,
    requireAuth,
    aiWritingLimiter = noRateLimit,
    generateExhibitionScene,
    createBuilderSession,
    reviewBuilderSession,
    reviseBuilderSession,
  } = deps;

  app.post('/api/ai/exhibition-scene', aiWritingLimiter, async (req, res) => {
    try {
      const authenticate = requireActiveUser ?? requireAuth;
      const auth = authenticate ? await authenticate(req, res) : null;
      if (authenticate && !auth) return;

      const parsed = exhibitionSceneRequestSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'invalid payload' });
      }

      const result = await generateExhibitionScene(parsed.data);
      res.json(result);
    } catch (err) {
      return sendInternalError(res, err, { code: 'EXHIBITION_SCENE_FAILED', message: 'exhibition scene request failed' });
    }
  });

  app.post('/api/ai/exhibition-builder/start', aiWritingLimiter, async (req, res) => {
    try {
      const authenticate = requireActiveUser ?? requireAuth;
      const auth = authenticate ? await authenticate(req, res) : null;
      if (authenticate && !auth) return;

      const parsed = exhibitionSceneRequestSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'invalid payload' });
      }

      const result = await createBuilderSession({
        input: parsed.data,
        generateExhibitionScene,
      });
      res.json(result);
    } catch (err) {
      return sendInternalError(res, err, { code: 'EXHIBITION_BUILDER_FAILED', message: 'exhibition builder request failed' });
    }
  });

  app.post('/api/ai/exhibition-builder/review', aiWritingLimiter, async (req, res) => {
    try {
      const authenticate = requireActiveUser ?? requireAuth;
      const auth = authenticate ? await authenticate(req, res) : null;
      if (authenticate && !auth) return;

      const parsed = builderReviewRequestSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'invalid payload' });
      }

      const result = await reviewBuilderSession(parsed.data);
      res.json(result);
    } catch (err) {
      return sendInternalError(res, err, { code: 'EXHIBITION_REVIEW_FAILED', message: 'exhibition review request failed' });
    }
  });

  app.post('/api/ai/exhibition-builder/revise', aiWritingLimiter, async (req, res) => {
    try {
      const authenticate = requireActiveUser ?? requireAuth;
      const auth = authenticate ? await authenticate(req, res) : null;
      if (authenticate && !auth) return;

      const parsed = builderReviseRequestSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'invalid payload' });
      }

      const result = await reviseBuilderSession({
        ...parsed.data,
        generateExhibitionScene,
      });
      res.json(result);
    } catch (err) {
      return sendInternalError(res, err, { code: 'EXHIBITION_REVISION_FAILED', message: 'exhibition revision request failed' });
    }
  });
}
