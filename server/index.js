import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { initDb } from './db.js';
import { loadEnv } from './config/env.js';
import { applyAppMiddleware } from './config/middleware.js';
import { buildAppDependencies } from './config/deps.js';
import { startMultiplayerServer } from './multiplayer/socketServer.js';
import { startServersAtomically } from './multiplayer/serverStartup.js';
import { createJwtHelpers } from './auth/jwt.js';
import { createFixedWindowLimiter } from './security/rateLimit.js';
import {
  createRateLimitKey,
  readBoundedEnvInteger,
} from './security/rateLimitConfig.js';
import { registerAuthRoutes } from './routes/authRoutes.js';
import { registerGalleryRoutes } from './routes/galleryRoutes.js';
import { registerGrowthRoutes } from './routes/growthRoutes.js';
import { registerCompetitionRoutes } from './routes/competitionRoutes.js';
import { registerAgentRoutes } from './routes/agentRoutes.js';
import { registerAiWritingRoutes } from './routes/aiWritingRoutes.js';
import { registerAiCuratorRoutes } from './routes/aiCuratorRoutes.js';
import { registerExhibitionSceneRoutes } from './routes/exhibitionSceneRoutes.js';
import { registerVisitorMemoryRoutes } from './routes/visitorMemoryRoutes.js';
import { registerTtsRoutes } from './routes/ttsRoutes.js';

const {
  PORT,
  JWT_SECRET,
  DEFAULT_MULTIPLAYER_PORT,
  MULTIPLAYER_CORS_ORIGIN,
  REQUEST_BODY_LIMIT,
  GROWTH_UPLOAD_BODY_LIMIT,
  AI_REVIEW_BODY_LIMIT,
} = loadEnv();

initDb();

const app = express();
const {
  signToken,
  verifyToken,
  signGrowthAssetToken,
  verifyGrowthAssetToken,
  optionalAuth,
  requireAuth,
} = createJwtHelpers({ secret: JWT_SECRET });

const trustProxyHops = readBoundedEnvInteger(process.env, 'TRUST_PROXY_HOPS', {
  defaultValue: 0,
  min: 0,
  max: 16,
});
if (trustProxyHops > 0) {
  app.set('trust proxy', trustProxyHops);
}
applyAppMiddleware(app, {
  requestBodyLimit: REQUEST_BODY_LIMIT,
  growthUploadBodyLimit: GROWTH_UPLOAD_BODY_LIMIT,
  aiReviewBodyLimit: AI_REVIEW_BODY_LIMIT,
  verifyToken,
});

function readRateLimitInteger(name, defaultValue, max) {
  return readBoundedEnvInteger(process.env, name, {
    defaultValue,
    min: 1,
    max,
  });
}

const ipRateLimitKey = createRateLimitKey();
const subjectRateLimitKey = createRateLimitKey({ optionalAuth });
const MAX_RATE_LIMIT = 1_000_000;
const MAX_RATE_WINDOW_MS = 86_400_000;

const rateLimiters = {
  authLimiter: createFixedWindowLimiter({
    limit: readRateLimitInteger('RATE_LIMIT_AUTH_MAX', 10, MAX_RATE_LIMIT),
    windowMs: readRateLimitInteger(
      'RATE_LIMIT_AUTH_WINDOW_MS',
      15 * 60_000,
      MAX_RATE_WINDOW_MS,
    ),
    key: ipRateLimitKey,
    message: 'too many authentication attempts',
  }),
  commentLimiter: createFixedWindowLimiter({
    limit: readRateLimitInteger('RATE_LIMIT_COMMENT_MAX', 20, MAX_RATE_LIMIT),
    windowMs: readRateLimitInteger(
      'RATE_LIMIT_COMMENT_WINDOW_MS',
      10 * 60_000,
      MAX_RATE_WINDOW_MS,
    ),
    key: subjectRateLimitKey,
    message: 'too many comments',
  }),
  voteLimiter: createFixedWindowLimiter({
    limit: readRateLimitInteger('RATE_LIMIT_VOTE_MAX', 30, MAX_RATE_LIMIT),
    windowMs: readRateLimitInteger(
      'RATE_LIMIT_VOTE_WINDOW_MS',
      10 * 60_000,
      MAX_RATE_WINDOW_MS,
    ),
    key: subjectRateLimitKey,
    message: 'too many votes',
  }),
  agentLimiter: createFixedWindowLimiter({
    limit: readRateLimitInteger('RATE_LIMIT_AGENT_MAX', 20, MAX_RATE_LIMIT),
    windowMs: readRateLimitInteger(
      'RATE_LIMIT_AGENT_WINDOW_MS',
      60_000,
      MAX_RATE_WINDOW_MS,
    ),
    key: subjectRateLimitKey,
    message: 'too many agent requests',
  }),
  ttsLimiter: createFixedWindowLimiter({
    limit: readRateLimitInteger('RATE_LIMIT_TTS_MAX', 20, MAX_RATE_LIMIT),
    windowMs: readRateLimitInteger(
      'RATE_LIMIT_TTS_WINDOW_MS',
      60_000,
      MAX_RATE_WINDOW_MS,
    ),
    key: subjectRateLimitKey,
    message: 'too many text-to-speech requests',
  }),
  aiWritingLimiter: createFixedWindowLimiter({
    limit: readRateLimitInteger('RATE_LIMIT_AI_WRITING_MAX', 20, MAX_RATE_LIMIT),
    windowMs: readRateLimitInteger(
      'RATE_LIMIT_AI_WRITING_WINDOW_MS',
      60_000,
      MAX_RATE_WINDOW_MS,
    ),
    key: subjectRateLimitKey,
    message: 'too many AI writing requests',
  }),
  visitorMemoryLimiter: createFixedWindowLimiter({
    limit: readRateLimitInteger('RATE_LIMIT_VISITOR_MEMORY_MAX', 30, MAX_RATE_LIMIT),
    windowMs: readRateLimitInteger(
      'RATE_LIMIT_VISITOR_MEMORY_WINDOW_MS',
      60_000,
      MAX_RATE_WINDOW_MS,
    ),
    key: subjectRateLimitKey,
    message: 'too many visitor memory requests',
  }),
  uploadLimiter: createFixedWindowLimiter({
    limit: readRateLimitInteger('RATE_LIMIT_UPLOAD_MAX', 20, MAX_RATE_LIMIT),
    windowMs: readRateLimitInteger(
      'RATE_LIMIT_UPLOAD_WINDOW_MS',
      10 * 60_000,
      MAX_RATE_WINDOW_MS,
    ),
    key: subjectRateLimitKey,
    message: 'too many uploads',
  }),
};

const deps = buildAppDependencies({
  optionalAuth,
  requireAuth,
  signToken,
  signGrowthAssetToken,
  verifyGrowthAssetToken,
  rateLimiters,
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'local-backend', time: new Date().toISOString() });
});

registerAuthRoutes(app, deps.auth);
registerGalleryRoutes(app, deps.gallery);
registerGrowthRoutes(app, deps.growth);
registerCompetitionRoutes(app, deps.competition);
registerAgentRoutes(app, deps.agent);
registerAiWritingRoutes(app, deps.aiWriting);
registerAiCuratorRoutes(app, deps.aiCurator);
registerExhibitionSceneRoutes(app, deps.exhibitionScene);
registerVisitorMemoryRoutes(app, deps.visitorMemory);
registerTtsRoutes(app, deps.tts);

export async function startServer() {
  return startServersAtomically({
    startMultiplayer: () => startMultiplayerServer({
      initialPort: DEFAULT_MULTIPLAYER_PORT,
      corsOrigin: MULTIPLAYER_CORS_ORIGIN,
      allowMissingOrigin: process.env.NODE_ENV !== 'production',
      verifyToken,
      getGalleryById: deps.gallery.getGalleryById,
      getGalleryByShareToken: deps.gallery.getGalleryByShareToken,
    }),
    startHttp: () => new Promise((resolve, reject) => {
      const httpServer = app.listen(PORT, () => {
        console.log(`[server] listening on http://localhost:${PORT}`);
        console.log(`[server] env loaded: QWEN_API_KEY=${process.env.QWEN_API_KEY ? 'set' : 'missing'}, DASHSCOPE_API_KEY=${process.env.DASHSCOPE_API_KEY ? 'set' : 'missing'}, QWEN_MODEL=${process.env.QWEN_MODEL || 'qwen3.6-plus'}`);
        resolve(httpServer);
      });
      httpServer.once('error', reject);
    }),
  });
}

const isDirectExecution = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  startServer().catch((error) => {
    console.error('[server] startup failed', error);
    process.exitCode = 1;
  });
}
