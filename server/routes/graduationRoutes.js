import { createGraduationService } from '../services/graduationService.js';

const noRateLimit = (_req, _res, next) => next();

export function registerGraduationRoutes(app, {
  database, requireAuth, service = createGraduationService({ database }),
  mutationLimiter = noRateLimit, publishLimiter = noRateLimit,
}) {
  const base = '/api/graduation';
  const handleError = (error, res) => {
    if (error.status >= 400 && error.status < 500) return res.status(error.status).json({ message: error.message, code: error.code });
    console.error('[graduation]', error);
    res.status(500).json({ message: 'Internal error' });
  };
  const route = (method, path, handler, isPublic = false) => app[method](base + path, async (req, res, next) => {
    // A release or one author's snapshot can be withdrawn after publication.
    res.setHeader('Cache-Control', 'private, no-store');
    try {
      const auth = isPublic ? null : await requireAuth(req, res);
      if (!isPublic && !auth) return;
      req.auth = auth;
      next();
    } catch (error) {
      handleError(error, res);
    }
  }, method === 'get' ? noRateLimit : mutationLimiter,
  path.endsWith('/publish') ? publishLimiter : noRateLimit,
  async (req, res) => {
    try {
      res.json(await handler(req.auth?.sub, req));
    } catch (error) {
      handleError(error, res);
    }
  });
  route('get', '/classes', (user) => service.listClasses(user));
  route('post', '/classes', (user, req) => service.createClass(user, req.body));
  route('post', '/join', (user, req) => service.join(user, req.body));
  route('get', '/portfolio', (user) => service.portfolio(user));
  route('get', '/classes/:id', (user, req) => service.getClass(user, req.params.id));
  route('patch', '/classes/:id/deadline', (user, req) => service.updateDeadline(user, req.params.id, req.body));
  route('get', '/classes/:id/questions', (user, req) => service.classQuestions(user, req.params.id));
  route('get', '/projects/:id/history', (user, req) => service.history(user, req.params.id));
  route('get', '/projects/:id/skills', (user, req) => service.listSkills(user, req.params.id));
  route('post', '/projects/:id/skills', (user, req) => service.createSkill(user, req.params.id, req.body));
  route('post', '/projects/:id/skills/suggest', (user, req) => service.suggestSkill(user, req.params.id, req.body));
  route('get', '/skills/:id/suggestions', (user, req) => service.listSkillSuggestions(user, req.params.id));
  route('post', '/skills/:id/suggestions/:suggestionId/decision', (user, req) => service.decideSkillSuggestion(user, req.params.id, req.params.suggestionId, req.body));
  route('patch', '/skills/:id', (user, req) => service.patchSkill(user, req.params.id, req.body));
  route('delete', '/skills/:id', (user, req) => service.deleteSkill(user, req.params.id, req.body));
  route('post', '/skills/:id/submit', (user, req) => service.submitSkill(user, req.params.id, req.body));
  route('post', '/skills/:id/review', (user, req) => service.reviewSkill(user, req.params.id, req.body));
  route('post', '/questions/:id/reply', (user, req) => service.replyQuestion(user, req.params.id, req.body));
  route('post', '/questions/:id/hide', (user, req) => service.hideQuestion(user, req.params.id));
  route('get', '/public/:token/projects/:id/questions', (_user, req) => service.questions(req.params.token, req.params.id), true);
  route('post', '/public/:token/projects/:id/questions', (user, req) => service.askQuestion(user, req.params.token, req.params.id, req.body));
  route('get', '/classes/:id/curation/evaluations', (user, req) => service.curationEvaluations(user, req.params.id));
  route('post', '/classes/:id/curation/evaluations', (user, req) => service.evaluateCuration(user, req.params.id, req.body));
  route('get', '/classes/:id/curation', (user, req) => service.getCuration(user, req.params.id));
  route('post', '/classes/:id/curation/suggest', (user, req) => service.suggestCuration(user, req.params.id, req.body));
  route('put', '/classes/:id/curation', (user, req) => service.saveCuration(user, req.params.id, req.body));
  route('post', '/classes/:id/projects', (user, req) => service.createProject(user, req.params.id, req.body));
  route('post', '/classes/:id/publish', (user, req) => service.publish(user, req.params.id));
  route('get', '/classes/:id/releases', (user, req) => service.releases(user, req.params.id));
  route('post', '/releases/:id/visibility', (user, req) => service.setReleaseVisibility(user, req.params.id, req.body));
  route('post', '/releases/:id/projects/:projectId/visibility', (user, req) => service.setProjectReleaseVisibility(user, req.params.id, req.params.projectId, req.body));
  route('patch', '/projects/:id', (user, req) => service.patchProject(user, req.params.id, req.body));
  route('post', '/projects/:id/submit', (user, req) => service.submit(user, req.params.id, req.body));
  route('post', '/projects/:id/submit-with-skills', (user, req) => service.submitWithSkills(user, req.params.id, req.body));
  route('post', '/projects/:id/review', (user, req) => service.review(user, req.params.id, req.body));
  route('post', '/projects/:id/review-with-skills', (user, req) => service.reviewWithSkills(user, req.params.id, req.body));
  route('post', '/projects/:id/reopen', (user, req) => service.reopen(user, req.params.id, req.body));
  route('post', '/projects/:id/reviews', (user, req) => service.addReview(user, req.params.id, req.body));
  route('get', '/public/:token', (_user, req) => service.publicRelease(req.params.token), true);
}
