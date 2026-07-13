import { z } from 'zod';

const ttsSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  voice: z.string().trim().min(1).optional(),
});
const noRateLimit = (_req, _res, next) => next();

export function registerTtsRoutes(app, deps = {}) {
  const {
    requireAuth,
    ttsLimiter = noRateLimit,
    generateGuideTtsAudio,
  } = deps;

  app.post('/api/tts/qwen', ttsLimiter, async (req, res) => {
    try {
      const auth = requireAuth ? requireAuth(req, res) : null;
      if (requireAuth && !auth) return;

      const parsed = ttsSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'invalid payload' });
      }

      const audioBuffer = await generateGuideTtsAudio({
        text: parsed.data.text,
        voice: parsed.data.voice,
      });

      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'no-store');
      res.send(Buffer.from(audioBuffer));
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'internal error';
      res.status(500).json({ message });
    }
  });
}
