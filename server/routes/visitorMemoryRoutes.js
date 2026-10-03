import { z } from 'zod';

const saveMemorySchema = z.object({
  galleryId: z.string().trim().min(1, 'galleryId is required'),
  visitedExhibitIds: z.array(z.string().trim().min(1)).max(100).optional().default([]),
  engagedExhibitIds: z.array(z.string().trim().min(1)).max(100).optional().default([]),
  dwellSecondsByExhibit: z.record(z.string(), z.number().min(0)).optional().default({}),
  preferredPersonality: z.enum(['xiaobai', 'expert', 'humor']).optional().default('xiaobai'),
  preferredLanguage: z.string().max(20).optional().default('zh-TW'),
  lastRecommendedExhibitId: z.string().trim().min(1).max(200).nullable().optional().default(null),
});

const noRateLimit = (_req, _res, next) => next();

export function registerVisitorMemoryRoutes(app, deps = {}) {
  const {
    requireAuth,
    visitorMemoryLimiter = noRateLimit,
    getVisitorMemory,
    upsertVisitorMemory,
  } = deps;

  const authUserId = (auth) => auth?.sub || auth?.id;

  app.get('/api/visitor-memory/:galleryId', visitorMemoryLimiter, async (req, res) => {
    try {
      const auth = requireAuth ? requireAuth(req, res) : null;
      if (requireAuth && !auth) return;
      const userId = authUserId(auth);
      if (!userId) return res.status(401).json({ message: 'invalid user token' });

      const { galleryId } = req.params;
      if (!galleryId || !galleryId.trim()) {
        return res.status(400).json({ message: 'galleryId is required' });
      }

      const result = await getVisitorMemory(userId, galleryId.trim());
      if (!result) {
        return res.json({ memory: null });
      }
      return res.json({ memory: result });
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'internal error';
      res.status(500).json({ message });
    }
  });

  app.put('/api/visitor-memory/:galleryId', visitorMemoryLimiter, async (req, res) => {
    try {
      const auth = requireAuth ? requireAuth(req, res) : null;
      if (requireAuth && !auth) return;
      const userId = authUserId(auth);
      if (!userId) return res.status(401).json({ message: 'invalid user token' });

      const { galleryId } = req.params;
      if (!galleryId || !galleryId.trim()) {
        return res.status(400).json({ message: 'galleryId is required' });
      }

      const parsed = saveMemorySchema.safeParse({ ...req.body, galleryId: galleryId.trim() });
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'invalid payload' });
      }

      const data = parsed.data;
      const memoryId = `${userId}__${galleryId.trim()}`;

      await upsertVisitorMemory({
        id: memoryId,
        userId,
        galleryId: galleryId.trim(),
        visitedExhibitIds: data.visitedExhibitIds,
        engagedExhibitIds: data.engagedExhibitIds,
        dwellSecondsByExhibit: data.dwellSecondsByExhibit,
        preferredPersonality: data.preferredPersonality,
        preferredLanguage: data.preferredLanguage,
        lastRecommendedExhibitId: data.lastRecommendedExhibitId,
      });

      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'internal error';
      res.status(500).json({ message });
    }
  });
}
