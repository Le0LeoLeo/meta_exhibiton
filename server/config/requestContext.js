import { randomUUID } from 'node:crypto';
import { logger as defaultLogger } from './logger.js';

const VALID_REQUEST_ID = /^[A-Za-z0-9._~-]{1,128}$/;
const HEALTH_ROUTES = new Set(['/api/health', '/api/ready']);

export function createRequestContextMiddleware({ logger = defaultLogger } = {}) {
  return function requestContext(req, res, next) {
    const incomingRequestId = req.header('x-request-id');
    const requestId = VALID_REQUEST_ID.test(incomingRequestId || '')
      ? incomingRequestId
      : randomUUID();
    const startedAt = process.hrtime.bigint();

    req.requestId = requestId;
    res.locals.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    res.once('finish', () => {
      const route = (req.originalUrl || req.path || '').split('?')[0];
      const fields = {
        requestId,
        method: req.method,
        route,
        status: res.statusCode,
        durationMs: Number(process.hrtime.bigint() - startedAt) / 1_000_000,
      };

      if (HEALTH_ROUTES.has(route) && res.statusCode < 400) return;
      if (res.statusCode >= 400) logger.warn('http_request_completed', fields);
      else logger.info('http_request_completed', fields);
    });

    next();
  };
}
