import { logger as defaultLogger } from './logger.js';

export function sendInternalError(res, error, {
  code = 'INTERNAL_ERROR',
  message = 'internal error',
  logger = defaultLogger,
  req,
  requestId,
} = {}) {
  const resolvedRequestId = requestId || req?.requestId || res.locals?.requestId;
  logger.error('internal_error', error, { code, requestId: resolvedRequestId });
  return res.status(500).json({
    code,
    message,
    ...(resolvedRequestId ? { requestId: resolvedRequestId } : {}),
  });
}

export function createJsonErrorMiddleware({ logger = defaultLogger } = {}) {
  return function jsonErrorMiddleware(error, req, res, next) {
    if (res.headersSent) return next(error);
    return sendInternalError(res, error, { logger, req });
  };
}
