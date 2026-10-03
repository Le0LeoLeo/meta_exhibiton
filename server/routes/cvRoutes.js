import { createCvService } from '../services/cvService.js';

export function registerCvRoutes(app, { database, requireAuth, mutationLimiter = (_req, _res, next) => next() }) {
  const service = createCvService(database);
  const route = (method, path, handler, isPublic = false) => app[method](`/api/cv${path}`,
    async (req, res, next) => {
      try {
        if (!isPublic) {
          const auth = await requireAuth(req, res);
          if (!auth) return;
          req.cvUserId = auth.sub;
        }
        next();
      } catch (error) { next(error); }
    },
    method === 'get' ? (_req, _res, next) => next() : mutationLimiter,
    async (req, res) => {
      try { res.json(await handler(req.cvUserId, req)); }
      catch (error) {
        if (error.status >= 400 && error.status < 500) res.status(error.status).json({ code: error.code, message: error.message });
        else { console.error('[cv]', error); res.status(500).json({ message: 'Internal error' }); }
      }
    });
  route('get', '/me', (id) => service.mine(id));
  route('put', '/me', (id, req) => service.updateProfile(id, req.body));
  route('post', '/cards', (id, req) => service.createCard(id, req.body));
  route('put', '/cards/:cardId', (id, req) => service.updateCard(id, req.params.cardId, req.body));
  route('delete', '/cards/:cardId', (id, req) => service.deleteCard(id, req.params.cardId, req.body));
  route('post', '/cards/:cardId/suggest', (id, req) => service.suggestCard(id, req.params.cardId));
  route('get', '/cards/:cardId/suggestions', (id, req) => service.suggestionRuns(id, req.params.cardId));
  route('post', '/cards/:cardId/suggestions/:runId/decision', (id, req) => service.decideSuggestion(id, req.params.cardId, req.params.runId, req.body));
  route('post', '/publish', (id, req) => service.publish(id, req.body));
  route('post', '/unpublish', (id) => service.unpublish(id));
  route('get', '/public/:token', (_id, req) => service.publicView(req.params.token), true);
}
