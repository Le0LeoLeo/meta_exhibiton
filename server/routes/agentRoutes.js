import { z } from 'zod';

const sceneExhibitSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().optional().nullable(),
  artist: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  content: z.string().optional().nullable(),
  type: z.string().optional().nullable(),
  position: z.array(z.number()).length(3).optional().nullable(),
});

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().trim().min(1).max(2000),
});

const visitorStateSchema = z.object({
  currentPosition: z.array(z.number()).length(3).optional().nullable(),
  currentRoomId: z.string().trim().min(1).optional().nullable(),
  mode: z.enum(['idle', 'follow', 'guide', 'tour', 'answer', 'wander']).optional().nullable(),
  followUser: z.boolean().optional().default(false),
  viewingExhibitId: z.string().trim().min(1).optional().nullable(),
  visitedExhibitIds: z.array(z.string().trim().min(1)).max(100).optional().default([]),
  engagedExhibitIds: z.array(z.string().trim().min(1)).max(100).optional().default([]),
  dwellSecondsByExhibit: z.record(z.string(), z.number().min(0)).optional().default({}),
  lastRecommendedExhibitId: z.string().optional().nullable(),
  preferredLanguage: z.string().optional().nullable(),
}).optional().default({});

const sessionStateSchema = z.object({
  sessionId: z.string().trim().min(1).max(200),
  tourProgress: z.object({
    currentStopIndex: z.number().int().min(0).optional().default(0),
    totalStops: z.number().int().min(0).optional().default(0),
    completedExhibitIds: z.array(z.string().trim().min(1)).max(100).optional().default([]),
  }).optional().nullable(),
}).optional().nullable();

const userPreferencesSchema = z.object({
  answerLength: z.enum(['short', 'medium', 'deep']).optional().default('medium'),
  guideStyle: z.enum(['story', 'educational', 'emotional']).optional().default('educational'),
}).optional().nullable();

const replySchema = z.object({
  question: z.string().trim().min(1, 'question is required').max(1000, 'question too long'),
  personality: z.enum(['xiaobai', 'expert', 'humor']).default('xiaobai'),
  exhibitId: z.string().trim().min(1).optional().nullable(),
  exhibit: sceneExhibitSchema.optional().nullable(),
  nearbyExhibits: z.array(sceneExhibitSchema).max(24).optional().default([]),
  chatHistory: z.array(chatMessageSchema).max(20).optional().default([]),
  visitorState: visitorStateSchema,
  sessionState: sessionStateSchema,
  userPreferences: userPreferencesSchema,
});
const noRateLimit = (_req, _res, next) => next();

export function registerAgentRoutes(app, deps = {}) {
  const {
    requireAuth,
    agentLimiter = noRateLimit,
    generateAgentReply,
  } = deps;

  app.post('/api/agent/reply', agentLimiter, async (req, res) => {
    try {
      const auth = requireAuth ? requireAuth(req, res) : null;
      if (requireAuth && !auth) return;

      const parsed = replySchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'invalid payload' });
      }

      const result = await generateAgentReply(parsed.data);
      res.json(result);
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'internal error';
      res.status(500).json({ message });
    }
  });
}
