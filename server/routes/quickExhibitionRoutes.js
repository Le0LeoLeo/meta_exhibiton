import { z } from 'zod';
import { quickCreateSchema, quickPatchSchema, quickOperationSchema } from '../services/quickExhibitionService.js';

export function registerQuickExhibitionRoutes(app, { requireAuth, service }) {
  const routes = [
    ['put', '', 'create', quickCreateSchema],
    ['get', '', 'get', null],
    ['patch', '', 'patch', quickPatchSchema],
    ['post', '/build', 'build', quickOperationSchema],
    ['post', '/apply', 'apply', quickOperationSchema],
    ['post', '/discard', 'discard', quickOperationSchema],
  ];
  for (const [method, suffix, operation, schema] of routes) {
    app[method](`/api/quick-exhibitions/:draftId${suffix}`, async (req, res) => {
      try {
        const auth = await requireAuth(req, res);
        if (!auth) return;
        if (!z.string().uuid().safeParse(req.params.draftId).success) {
          return res.status(400).json({ code: 'INVALID_INPUT', message: 'draftId must be a UUID' });
        }
        const parsed = schema?.safeParse(req.body ?? {});
        if (parsed && !parsed.success) {
          const tooMany = Array.isArray(req.body?.assets) && req.body.assets.length > 30;
          return res.status(tooMany ? 422 : 400).json({ code: tooMany ? 'TOO_MANY_ASSETS' : 'INVALID_INPUT',
            message: parsed.error.issues[0]?.message ?? 'invalid input' });
        }
        res.json(await service[operation](req.params.draftId, auth.sub, parsed?.data));
      } catch (error) {
        if (error.status >= 400 && error.status < 500) {
          return res.status(error.status).json({ code: error.code, message: error.message,
            ...(error.galleryId ? { galleryId: error.galleryId } : {}) });
        }
        console.error(error);
        res.status(500).json({ message: 'internal error' });
      }
    });
  }
}
