import cors from 'cors';
import express from 'express';
import { logger as defaultLogger } from './logger.js';
import { createRequestContextMiddleware } from './requestContext.js';
import { readSessionCookie } from '../auth/sessionCookie.js';
import { createSessionMiddleware } from '../auth/sessionValidation.js';

export function applyAppMiddleware(app, {
  frontendOrigin,
  requestBodyLimit,
  mediaUploadBodyLimit,
  aiReviewBodyLimit,
  verifyToken,
  verifySessionToken,
  csrfMiddleware = (_req, _res, next) => next(),
  logger = defaultLogger,
}) {
  app.use(createRequestContextMiddleware({ logger }));

  app.use((_req, res, next) => {
    // Published exhibition HTML also passes through Express. Three.js decoders
    // and Rapier need WebAssembly, but JavaScript eval/inline scripts stay blocked.
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self' ws: wss: https:",
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=()');
    next();
  });

  app.use(
    cors({
      origin(requestOrigin, callback) {
        callback(null, !requestOrigin || requestOrigin === frontendOrigin);
      },
      credentials: true,
    }),
  );

  if (verifySessionToken) app.use(createSessionMiddleware({ verifySessionToken }));
  app.use(csrfMiddleware);

  const requireValidAuth = (req, res, next) => {
    const authorization = req.header('authorization') || '';
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    const token = match?.[1] || readSessionCookie(req);
    if (!token) {
      return res.status(401).json({ message: 'missing authentication' });
    }
    if (!verifyToken(token)) {
      return res.status(401).json({ message: 'invalid or expired token' });
    }
    return next();
  };

  app.post(
    '/api/media/upload',
    requireValidAuth,
    express.json({ limit: mediaUploadBodyLimit }),
  );
  app.post(
    '/api/ai/exhibition-builder/review',
    requireValidAuth,
    express.json({ limit: aiReviewBodyLimit }),
  );

  app.use(express.json({ limit: requestBodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: requestBodyLimit }));

  app.use((error, _req, res, next) => {
    if (error?.type === 'entity.too.large') {
      return res.status(413).json({ message: 'request body too large' });
    }
    return next(error);
  });
}
