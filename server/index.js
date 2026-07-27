import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  db,
  initDb,
  listRetryableFileCleanupJobs,
  markFileCleanupJobCompleted,
  markFileCleanupJobFailed,
} from './db.js';
import { loadEnv } from './config/env.js';
import { applyAppMiddleware } from './config/middleware.js';
import { createJsonErrorMiddleware } from './config/errorHandling.js';
import { logger } from './config/logger.js';
import { buildAppDependencies } from './config/deps.js';
import {
  DEFAULT_SCENE_LIMITS,
  isValidScene,
  startMultiplayerServer,
} from './multiplayer/socketServer.js';
import { createMemorySceneStore } from './multiplayer/memorySceneStore.js';
import { createRedisCollaboration } from './multiplayer/redisCollaboration.js';
import { startServersAtomically } from './multiplayer/serverStartup.js';
import {
  checkDatabaseReadiness,
  checkDependenciesReadiness,
  checkMultiplayerReadiness,
  registerHealthRoutes,
} from './readiness.js';
import { startAfterInitialization } from './startup.js';
import { createJwtHelpers } from './auth/jwt.js';
import { createCsrfProtection } from './security/csrf.js';
import { createShutdownHandler } from './shutdown.js';
import { retryPendingFileCleanupJobs } from './services/accountDeletionService.js';
import { deleteGrowthAssetFiles } from './services/growthAssetService.js';
import { deleteMediaFiles } from './services/mediaFileService.js';
import {
  createFixedWindowLimiter,
  createInMemoryRateLimitStore,
} from './security/rateLimit.js';
import { createRedisRateLimitStore } from './security/redisRateLimitStore.js';
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
import { registerMediaRoutes } from './routes/mediaRoutes.js';
import { registerExhibitionPassportRoutes } from './routes/exhibitionPassportRoutes.js';

const {
  PORT,
  JWT_SECRET,
  FRONTEND_ORIGIN,
  DEFAULT_MULTIPLAYER_PORT,
  MULTIPLAYER_CORS_ORIGIN,
  REQUEST_BODY_LIMIT,
  GROWTH_UPLOAD_BODY_LIMIT,
  AI_REVIEW_BODY_LIMIT,
  REDIS_URL,
  MULTIPLAYER_SHARED_STATE,
  MULTIPLAYER_SCENE_TTL_SECONDS,
} = loadEnv();

const app = express();
const {
  signToken,
  verifyToken,
  signGrowthAssetToken,
  verifyGrowthAssetToken,
  signMediaPreviewToken,
  verifyMediaPreviewToken,
  optionalAuth,
  requireAuth,
} = createJwtHelpers({ secret: JWT_SECRET });
const csrf = createCsrfProtection({ secret: JWT_SECRET, verifyToken });

const trustProxyHops = readBoundedEnvInteger(process.env, 'TRUST_PROXY_HOPS', {
  defaultValue: 0,
  min: 0,
  max: 16,
});
if (trustProxyHops > 0) {
  app.set('trust proxy', trustProxyHops);
}
applyAppMiddleware(app, {
  frontendOrigin: FRONTEND_ORIGIN,
  requestBodyLimit: REQUEST_BODY_LIMIT,
  growthUploadBodyLimit: GROWTH_UPLOAD_BODY_LIMIT,
  aiReviewBodyLimit: AI_REVIEW_BODY_LIMIT,
  verifyToken,
  csrfMiddleware: csrf.middleware,
  logger,
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
const rateLimitStore = REDIS_URL
  ? createRedisRateLimitStore({
    url: REDIS_URL,
    onError: () => logger.warn('rate_limit.redis_error'),
  })
  : createInMemoryRateLimitStore();

const rateLimiters = {
  authLimiter: createFixedWindowLimiter({
    namespace: 'auth',
    store: rateLimitStore,
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
    namespace: 'comment',
    store: rateLimitStore,
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
    namespace: 'vote',
    store: rateLimitStore,
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
    namespace: 'agent',
    store: rateLimitStore,
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
    namespace: 'tts',
    store: rateLimitStore,
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
    namespace: 'ai-writing',
    store: rateLimitStore,
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
    namespace: 'visitor-memory',
    store: rateLimitStore,
    limit: readRateLimitInteger('RATE_LIMIT_VISITOR_MEMORY_MAX', 30, MAX_RATE_LIMIT),
    windowMs: readRateLimitInteger(
      'RATE_LIMIT_VISITOR_MEMORY_WINDOW_MS',
      60_000,
      MAX_RATE_WINDOW_MS,
    ),
    key: subjectRateLimitKey,
    message: 'too many visitor memory requests',
  }),
  passportMutationLimiter: createFixedWindowLimiter({
    namespace: 'exhibition-passport-mutation',
    store: rateLimitStore,
    limit: readRateLimitInteger('RATE_LIMIT_PASSPORT_MUTATION_MAX', 20, MAX_RATE_LIMIT),
    windowMs: readRateLimitInteger(
      'RATE_LIMIT_PASSPORT_MUTATION_WINDOW_MS',
      60_000,
      MAX_RATE_WINDOW_MS,
    ),
    key: subjectRateLimitKey,
    message: 'too many exhibition passport requests',
  }),
  souvenirReadLimiter: createFixedWindowLimiter({
    namespace: 'exhibition-souvenir-read',
    store: rateLimitStore,
    limit: readRateLimitInteger('RATE_LIMIT_SOUVENIR_READ_MAX', 120, MAX_RATE_LIMIT),
    windowMs: readRateLimitInteger(
      'RATE_LIMIT_SOUVENIR_READ_WINDOW_MS',
      60_000,
      MAX_RATE_WINDOW_MS,
    ),
    key: subjectRateLimitKey,
    message: 'too many exhibition souvenir requests',
  }),
  uploadLimiter: createFixedWindowLimiter({
    namespace: 'upload',
    store: rateLimitStore,
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
  createCsrfToken: csrf.createToken,
  signGrowthAssetToken,
  verifyGrowthAssetToken,
  signMediaPreviewToken,
  verifyMediaPreviewToken,
  rateLimiters,
});

let multiplayerServerHandle = null;

registerHealthRoutes(app, {
  checkReadiness: () => checkDependenciesReadiness(
    () => checkDatabaseReadiness(db),
    () => rateLimitStore.checkReadiness(),
    () => checkMultiplayerReadiness(multiplayerServerHandle),
  ),
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
registerMediaRoutes(app, deps.media);
registerExhibitionPassportRoutes(app, deps.exhibitionPassport);

app.use(createJsonErrorMiddleware({ logger }));

export async function startServer() {
  return startAfterInitialization({
    initialize: async () => {
      await initDb();
      const cleanup = await retryPendingFileCleanupJobs({
        listRetryableFileCleanupJobs,
        deleteGrowthAssetFiles,
        deleteMediaFiles,
        markFileCleanupJobCompleted,
        markFileCleanupJobFailed,
      });
      if (cleanup.cleanupPending) {
        console.warn(`[server] ${cleanup.cleanupJobs} account file cleanup job(s) remain pending`);
      }
    },
    startListeners: () => startServersAtomically({
      startMultiplayer: () => {
        const collaboration = MULTIPLAYER_SHARED_STATE === 'redis'
          ? createRedisCollaboration({
            url: REDIS_URL,
            onError: (error, context) => logger.warn(
              'multiplayer.redis_error',
              { ...context, errorName: error.name },
            ),
          })
          : null;
        const sceneStore = collaboration
          ? collaboration.createSceneStore({
            ttlSeconds: MULTIPLAYER_SCENE_TTL_SECONDS,
            sceneMaxBytes: DEFAULT_SCENE_LIMITS.maxBytes,
            validateScene: (scene) => isValidScene(
              scene,
              DEFAULT_SCENE_LIMITS,
              { allowNullRoomSize: true },
            ),
          })
          : createMemorySceneStore({
            ttlMs: MULTIPLAYER_SCENE_TTL_SECONDS * 1000,
          });
        multiplayerServerHandle = startMultiplayerServer({
          initialPort: DEFAULT_MULTIPLAYER_PORT,
          corsOrigin: MULTIPLAYER_CORS_ORIGIN,
          allowMissingOrigin: process.env.NODE_ENV !== 'production',
          verifyToken,
          getGalleryById: deps.gallery.getGalleryById,
          getGalleryByShareToken: deps.gallery.getGalleryByShareToken,
          collaboration,
          sceneStore,
        });
        return multiplayerServerHandle;
      },
      startHttp: () => new Promise((resolve, reject) => {
        const httpServer = app.listen(PORT, () => {
          console.log(`[server] listening on http://localhost:${PORT}`);
          console.log(`[server] env loaded: QWEN_API_KEY=${process.env.QWEN_API_KEY ? 'set' : 'missing'}, DASHSCOPE_API_KEY=${process.env.DASHSCOPE_API_KEY ? 'set' : 'missing'}, QWEN_MODEL=${process.env.QWEN_MODEL || 'qwen3.6-plus'}`);
          resolve(httpServer);
        });
        httpServer.once('error', reject);
      }),
    }),
  });
}

const isDirectExecution = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  startServer()
    .then(({ httpServer, multiplayerServer }) => {
      const shutdown = createShutdownHandler({
        httpServer,
        multiplayerServer,
        rateLimitStore,
        database: db,
      });
      const onSignal = () => {
        shutdown().catch((error) => {
          console.error('[server] shutdown failed', error);
          process.exitCode = 1;
        });
      };
      process.once('SIGTERM', onSignal);
      process.once('SIGINT', onSignal);
    })
    .catch((error) => {
      console.error('[server] startup failed', error);
      process.exitCode = 1;
    });
}
