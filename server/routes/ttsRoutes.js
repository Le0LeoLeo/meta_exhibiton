import { z } from 'zod';
import { sendInternalError } from '../config/errorHandling.js';

const ttsSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  voice: z.string().trim().min(1).optional(),
});
const noRateLimit = (_req, _res, next) => next();

export function registerTtsRoutes(app, deps = {}) {
  const {
    requireActiveUser,
    requireAuth,
    ttsLimiter = noRateLimit,
    generateGuideTtsAudio,
  } = deps;

  app.post('/api/tts/qwen', ttsLimiter, async (req, res) => {
    try {
      const authenticate = requireActiveUser ?? requireAuth;
      const auth = authenticate ? await authenticate(req, res) : null;
      if (authenticate && !auth) return;

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
      return sendInternalError(res, err, { code: 'TTS_FAILED', message: 'TTS generation failed' });
    }
  });
}
