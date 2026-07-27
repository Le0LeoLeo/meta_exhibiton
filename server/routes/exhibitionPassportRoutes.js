import { z } from 'zod';

const galleryIdSchema = z.string().trim().min(1).max(120);
const tokenSchema = z.string().trim().min(1).max(200);
const completeSchema = z.object({
  reflection: z.string().trim().max(280).optional().default(''),
});
const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(12).optional().default(6),
});
const noRateLimit = (_req, _res, next) => next();

const ERROR_STATUS = {
  PASSPORT_UNAVAILABLE: 422,
  PASSPORT_INCOMPLETE: 409,
  GALLERY_NOT_FOUND: 404,
  PASSPORT_NOT_FOUND: 404,
  SOUVENIR_NOT_FOUND: 404,
};

export function registerExhibitionPassportRoutes(app, deps = {}) {
  const {
    requireAuth,
    passportMutationLimiter = noRateLimit,
    souvenirReadLimiter = noRateLimit,
    service,
    errorLogger = console.error,
  } = deps;

  const authenticate = (req, res) => {
    const auth = requireAuth ? requireAuth(req, res) : null;
    if (requireAuth && !auth) return null;
    const userId = auth?.sub || auth?.id;
    if (!userId) {
      res.status(401).json({ message: 'invalid user token' });
      return null;
    }
    return userId;
  };

  const mapError = (error, res) => {
    const status = ERROR_STATUS[error?.code];
    if (status) {
      const body = { message: error.message, code: error.code };
      if (error.code === 'PASSPORT_INCOMPLETE' && error.progress) body.progress = error.progress;
      return res.status(status).json(body);
    }
    errorLogger(error);
    return res.status(500).json({ message: 'internal server error' });
  };

  app.get('/api/exhibition-passports/:galleryId', async (req, res) => {
    const userId = authenticate(req, res);
    if (!userId) return;
    const parsedId = galleryIdSchema.safeParse(req.params.galleryId);
    if (!parsedId.success) return res.status(400).json({ message: 'invalid gallery ID' });
    try {
      return res.json(await service.getOrCreatePassport(userId, parsedId.data));
    } catch (error) {
      return mapError(error, res);
    }
  });

  app.post('/api/exhibition-passports/:galleryId/complete', passportMutationLimiter, async (req, res) => {
    const userId = authenticate(req, res);
    if (!userId) return;
    const parsedId = galleryIdSchema.safeParse(req.params.galleryId);
    const parsedBody = completeSchema.safeParse(req.body || {});
    if (!parsedId.success) return res.status(400).json({ message: 'invalid gallery ID' });
    if (!parsedBody.success) return res.status(400).json({ message: 'invalid reflection' });
    try {
      return res.json(await service.completePassport(userId, parsedId.data, parsedBody.data.reflection));
    } catch (error) {
      return mapError(error, res);
    }
  });

  app.post('/api/exhibition-passports/:galleryId/share', passportMutationLimiter, async (req, res) => {
    const userId = authenticate(req, res);
    if (!userId) return;
    const parsedId = galleryIdSchema.safeParse(req.params.galleryId);
    if (!parsedId.success) return res.status(400).json({ message: 'invalid gallery ID' });
    try {
      return res.json(await service.sharePassport(userId, parsedId.data));
    } catch (error) {
      return mapError(error, res);
    }
  });

  app.get('/api/exhibition-souvenirs/:token', souvenirReadLimiter, async (req, res) => {
    const parsed = tokenSchema.safeParse(req.params.token);
    if (!parsed.success) return res.status(400).json({ message: 'invalid souvenir token' });
    try {
      return res.json(await service.getPublicSouvenir(parsed.data));
    } catch (error) {
      return mapError(error, res);
    }
  });

  app.get('/api/exhibition-souvenirs', souvenirReadLimiter, async (req, res) => {
    const rawLimit = req.query.limit === undefined ? undefined : Math.min(12, Number(req.query.limit));
    const parsed = listSchema.safeParse({ limit: rawLimit });
    if (!parsed.success) return res.status(400).json({ message: 'invalid limit' });
    try {
      return res.json(await service.listPublicSouvenirs(parsed.data.limit));
    } catch (error) {
      return mapError(error, res);
    }
  });
}
