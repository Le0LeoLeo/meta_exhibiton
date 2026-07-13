import { z } from 'zod';

const feedbackSummarySchema = z.object({
  comments: z
    .array(
      z.object({
        author: z.string().optional().nullable(),
        content: z.string().trim().min(1).max(2000),
      }),
    )
    .max(50)
    .default([]),
});

const polishIntroSchema = z.object({
  text: z.string().trim().min(1, 'text is required').max(5000),
});

const translateSchema = z.object({
  text: z.string().trim().min(1, 'text is required').max(5000),
  targetLanguage: z.string().trim().min(1, 'targetLanguage is required').max(50),
});

const noRateLimit = (_req, _res, next) => next();

export function registerAiWritingRoutes(app, deps = {}) {
  const {
    requireAuth,
    aiWritingLimiter = noRateLimit,
    summarizeFeedback,
    polishIntro,
    translateText,
  } = deps;

  app.post('/api/ai/feedback-summary', aiWritingLimiter, async (req, res) => {
    try {
      const auth = requireAuth ? requireAuth(req, res) : null;
      if (requireAuth && !auth) return;

      const parsed = feedbackSummarySchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'invalid payload' });
      }

      const result = await summarizeFeedback(parsed.data.comments);
      res.json({ result });
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'internal error';
      res.status(500).json({ message });
    }
  });

  app.post('/api/ai/polish-intro', aiWritingLimiter, async (req, res) => {
    try {
      const auth = requireAuth ? requireAuth(req, res) : null;
      if (requireAuth && !auth) return;

      const parsed = polishIntroSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'invalid payload' });
      }

      const result = await polishIntro(parsed.data.text);
      res.json({ result });
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'internal error';
      res.status(500).json({ message });
    }
  });

  app.post('/api/ai/translate', aiWritingLimiter, async (req, res) => {
    try {
      const auth = requireAuth ? requireAuth(req, res) : null;
      if (requireAuth && !auth) return;

      const parsed = translateSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'invalid payload' });
      }

      const result = await translateText(parsed.data.text, parsed.data.targetLanguage);
      res.json({ result });
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'internal error';
      res.status(500).json({ message });
    }
  });
}
