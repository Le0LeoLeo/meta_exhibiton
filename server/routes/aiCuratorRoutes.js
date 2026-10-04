import { z } from 'zod';
import { sendInternalError } from '../config/errorHandling.js';

const curatorIntentSchema = z.enum([
  'warm-memory',
  'professional-gallery',
]);

const curatorPlanSchema = z.object({
  theme: z.string().trim().min(1, 'theme is required').max(500),
  style: z.string().trim().max(120).optional(),
  audience: z.string().trim().max(120).optional(),
  intent: curatorIntentSchema.default('warm-memory'),
  language: z.enum(['zh-TW', 'zh-CN', 'en']).default('zh-TW'),
  exhibitCount: z.number().int().min(3).max(12).default(6),
});

function createDefaultAiWritingLimiter({ limit = 20, windowMs = 60_000 } = {}) {
  const hits = new Map();

  return (req, res, next) => {
    const now = Date.now();
    for (const [entryKey, entry] of hits.entries()) {
      if (entry.resetAt <= now) {
        hits.delete(entryKey);
      }
    }

    const key = req.user?.id || req.ip || 'anonymous';
    const current = hits.get(key);
    if (!current || current.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;
    if (current.count > limit) {
      return res.status(429).json({ message: 'too many AI curator requests' });
    }

    return next();
  };
}

const defaultAiWritingLimiter = createDefaultAiWritingLimiter();

export function registerAiCuratorRoutes(app, deps = {}) {
  const {
    requireActiveUser,
    requireAuth,
    aiWritingLimiter = defaultAiWritingLimiter,
    generateCuratorPlan,
  } = deps;

  app.post('/api/ai/curator-plan', aiWritingLimiter, async (req, res) => {
    try {
      const authenticate = requireActiveUser ?? requireAuth;
      const auth = authenticate ? await authenticate(req, res) : null;
      if (authenticate && !auth) return;

      const parsed = curatorPlanSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({
          message: parsed.error.issues[0]?.message ?? 'invalid payload',
        });
      }

      const plan = await generateCuratorPlan(parsed.data);
      return res.json(plan);
    } catch (err) {
      return sendInternalError(res, err, { code: 'AI_CURATOR_FAILED', message: 'AI curator request failed' });
    }
  });
}
