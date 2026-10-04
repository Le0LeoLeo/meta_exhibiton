import { z } from 'zod';
import { JOURNEY_STEPS } from '../services/journeyAnalytics.js';
const schema = z.object({ sessionId: z.string().uuid(), step: z.enum(JOURNEY_STEPS), consent: z.literal(true) }).strict();
const withdrawal = z.object({ sessionId: z.string().uuid() }).strict();
export function registerJourneyAnalyticsRoutes(app, { service, limiter, origin }) {
  const sameOrigin = (req, res, next) => req.get('origin') === origin ? next() : res.sendStatus(403);
  app.post('/api/journey/events', sameOrigin, limiter, async (req,res,next) => {
    const input=schema.safeParse(req.body); if (!input.success) return res.sendStatus(400);
    if (req.get('dnt') === '1' || req.get('sec-gpc') === '1') return res.sendStatus(204);
    try { await service.record(input.data.sessionId,input.data.step); res.sendStatus(204); } catch(error) { next(error); }
  });
  app.post('/api/journey/withdraw', sameOrigin, limiter, async (req,res,next) => {
    const input=withdrawal.safeParse(req.body); if (!input.success) return res.sendStatus(400);
    try { await service.withdraw(input.data.sessionId); res.sendStatus(204); } catch(error) { next(error); }
  });
}
