import { z } from 'zod';
import { sendInternalError } from '../config/errorHandling.js';

function isReusableArtworkUrl(value) {
  if (/[\s\\]/.test(value)) return false;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}

const assetSchema = z.object({
  title: z.string().optional(),
  artist: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().trim().max(2000).refine(isReusableArtworkUrl, 'Artwork must use a site-relative path or an HTTP(S) URL').optional(),
  type: z.enum(['image', 'text', 'model', 'video']).optional(),
});

const exhibitionSceneRequestSchema = z.object({
  editMode: z.enum(['complete']).optional(),
  allowDestructive: z.boolean().optional().default(false),
  editorAssets: z.array(z.object({ key: z.string().min(1).max(200), label: z.string().max(300), kind: z.enum(['image', 'video', 'model']),
    url: z.string().max(2000).refine(isReusableArtworkUrl), assetId: z.string().optional(), mimeType: z.string().optional(),
    previewUrl: z.string().max(2000).refine(isReusableArtworkUrl).optional() }).strict()).max(200).optional().default([]),
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
    resolution: z.enum(['automatic', 'manual']).optional(),
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
  screenshots: z.array(screenshotSchema).min(3).max(16),
});

const builderReviseRequestSchema = z.object({
  sessionId: z.string().trim().min(1),
  versionId: z.string().trim().min(1),
  scene: z.unknown(),
  review: builderReviewSchema.optional().nullable(),
  input: exhibitionSceneRequestSchema.optional(),
  prompt: z.string().trim().max(3000).optional().default(''),
  revisionCount: z.number().int().min(0).max(3).optional().default(0),
}).refine((value) => value.review || value.prompt || value.input?.prompt, {
  message: 'review or prompt is required',
});

const builderRestoreRequestSchema = z.object({
  expectedVersionId: z.string().trim().min(1),
  targetVersionId: z.string().trim().min(1),
});

const noRateLimit = (_req, _res, next) => next();
const authUserId = (auth) => auth?.sub || auth?.id;

export function registerExhibitionSceneRoutes(app, deps = {}) {
  const {
    requireActiveUser,
    requireAuth,
    aiWritingLimiter = noRateLimit,
    generateExhibitionScene,
    createBuilderSession,
    reviewBuilderSession,
    reviseBuilderSession,
    restoreBuilderSessionVersion,
    createExhibitionBuilderSessionRecord,
    getExhibitionBuilderSessionRecord,
    saveExhibitionBuilderSessionReview,
    appendExhibitionBuilderSessionVersion,
  } = deps;

  const authenticateRequest = async (req, res) => {
    const authenticate = requireActiveUser ?? requireAuth;
    const auth = authenticate ? await authenticate(req, res) : null;
    if (authenticate && !auth) return null;
    const userId = authUserId(auth);
    if (!userId) {
      res.status(401).json({ message: 'invalid user token' });
      return null;
    }
    return { auth, userId };
  };

  const loadOwnedSession = async ({ sessionId, versionId, userId, res }) => {
    const record = await getExhibitionBuilderSessionRecord(sessionId);
    if (!record || record.userId !== userId) {
      res.status(404).json({ message: 'builder session not found' });
      return null;
    }
    if (versionId && record.currentVersionId !== versionId) {
      res.status(409).json({
        message: 'builder session version is stale',
        currentVersionId: record.currentVersionId,
      });
      return null;
    }
    return record;
  };

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
      const authenticated = await authenticateRequest(req, res);
      if (!authenticated) return;

      const parsed = exhibitionSceneRequestSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'invalid payload' });
      }

      const result = await createBuilderSession({
        input: parsed.data,
        generateExhibitionScene,
      });
      await createExhibitionBuilderSessionRecord({
        userId: authenticated.userId,
        input: parsed.data,
        session: result,
      });
      res.json(result);
    } catch (err) {
      return sendInternalError(res, err, { code: 'EXHIBITION_BUILDER_FAILED', message: 'exhibition builder request failed' });
    }
  });

  app.get('/api/ai/exhibition-builder/sessions/:sessionId', aiWritingLimiter, async (req, res) => {
    try {
      const authenticated = await authenticateRequest(req, res);
      if (!authenticated) return;
      const record = await loadOwnedSession({
        sessionId: req.params.sessionId,
        userId: authenticated.userId,
        res,
      });
      if (!record) return;
      if (!record.currentSession) {
        return res.status(409).json({ message: 'builder session has no current version' });
      }
      return res.json({
        ...record.currentSession,
        input: record.input,
        versions: record.versions,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      });
    } catch (err) {
      return sendInternalError(res, err, { code: 'EXHIBITION_BUILDER_LOAD_FAILED', message: 'builder session load failed' });
    }
  });

  app.post('/api/ai/exhibition-builder/sessions/:sessionId/restore', aiWritingLimiter, async (req, res) => {
    try {
      const authenticated = await authenticateRequest(req, res);
      if (!authenticated) return;
      const parsed = builderRestoreRequestSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'invalid payload' });
      }

      const record = await loadOwnedSession({
        sessionId: req.params.sessionId,
        versionId: parsed.data.expectedVersionId,
        userId: authenticated.userId,
        res,
      });
      if (!record) return;
      const targetVersion = record.versions.find(
        (version) => version.versionId === parsed.data.targetVersionId,
      );
      if (!targetVersion) {
        return res.status(404).json({ message: 'builder session version not found' });
      }

      const restored = restoreBuilderSessionVersion({
        sessionId: record.id,
        targetVersion,
        revisionCount: record.revisionCount,
      });
      const saved = await appendExhibitionBuilderSessionVersion({
        sessionId: record.id,
        userId: authenticated.userId,
        expectedVersionId: parsed.data.expectedVersionId,
        session: restored,
      });
      if (!saved) {
        return res.status(409).json({ message: 'builder session changed while restore was running' });
      }

      return res.json({
        ...restored,
        input: record.input,
        versions: [...record.versions, restored],
        createdAt: record.createdAt,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      return sendInternalError(res, err, { code: 'EXHIBITION_RESTORE_FAILED', message: 'exhibition version restore failed' });
    }
  });

  app.post('/api/ai/exhibition-builder/review', aiWritingLimiter, async (req, res) => {
    try {
      const authenticated = await authenticateRequest(req, res);
      if (!authenticated) return;

      const parsed = builderReviewRequestSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'invalid payload' });
      }

      const record = await loadOwnedSession({
        sessionId: parsed.data.sessionId,
        versionId: parsed.data.versionId,
        userId: authenticated.userId,
        res,
      });
      if (!record) return;

      const result = await reviewBuilderSession({
        editMode: record.input.editMode,
        brief: record.input.prompt,
        exhibition: record.currentSession.exhibition,
        sessionId: parsed.data.sessionId,
        versionId: parsed.data.versionId,
        scene: record.currentSession.scene,
        screenshots: parsed.data.screenshots,
      });
      const saved = await saveExhibitionBuilderSessionReview({
        sessionId: parsed.data.sessionId,
        userId: authenticated.userId,
        expectedVersionId: parsed.data.versionId,
        reviewResponse: result,
      });
      if (!saved) {
        return res.status(409).json({ message: 'builder session changed while review was running' });
      }
      res.json(result);
    } catch (err) {
      return sendInternalError(res, err, { code: 'EXHIBITION_REVIEW_FAILED', message: 'exhibition review request failed' });
    }
  });

  app.post('/api/ai/exhibition-builder/revise', aiWritingLimiter, async (req, res) => {
    try {
      const authenticated = await authenticateRequest(req, res);
      if (!authenticated) return;

      const parsed = builderReviseRequestSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'invalid payload' });
      }

      const record = await loadOwnedSession({
        sessionId: parsed.data.sessionId,
        versionId: parsed.data.versionId,
        userId: authenticated.userId,
        res,
      });
      if (!record) return;

      const result = await reviseBuilderSession({
        sessionId: parsed.data.sessionId,
        scene: record.currentSession.scene,
        review: record.currentSession.review || null,
        input: record.input,
        prompt: parsed.data.prompt || record.input.prompt,
        revisionCount: record.revisionCount,
        generateExhibitionScene,
      });
      const saved = await appendExhibitionBuilderSessionVersion({
        sessionId: parsed.data.sessionId,
        userId: authenticated.userId,
        expectedVersionId: parsed.data.versionId,
        session: result,
      });
      if (!saved) {
        return res.status(409).json({ message: 'builder session changed while revision was running' });
      }
      res.json(result);
    } catch (err) {
      return sendInternalError(res, err, { code: 'EXHIBITION_REVISION_FAILED', message: 'exhibition revision request failed' });
    }
  });
}
