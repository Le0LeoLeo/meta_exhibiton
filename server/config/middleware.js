import cors from 'cors';
import express from 'express';

export function applyAppMiddleware(app, {
  requestBodyLimit,
  growthUploadBodyLimit,
  aiReviewBodyLimit,
  verifyToken,
}) {
  app.use(
    cors({
      origin: ['http://localhost:5173'],
      credentials: true,
    }),
  );

  const requireValidBearer = (req, res, next) => {
    const authorization = req.header('authorization') || '';
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return res.status(401).json({ message: 'missing bearer token' });
    }
    if (!verifyToken(match[1])) {
      return res.status(401).json({ message: 'invalid or expired token' });
    }
    return next();
  };

  app.post(
    '/api/growth/assets/upload',
    requireValidBearer,
    express.json({ limit: growthUploadBodyLimit }),
  );
  app.post(
    '/api/ai/exhibition-builder/review',
    requireValidBearer,
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
