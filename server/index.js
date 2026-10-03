import { createJourneyAnalytics } from './services/journeyAnalytics.js';
import { registerJourneyAnalyticsRoutes } from './routes/journeyAnalyticsRoutes.js';
import { registerPublicExhibitionPageRoutes } from './routes/publicExhibitionPageRoutes.js';
import { createEmailVerificationService } from './services/emailVerificationService.js';
import { createPasswordResetService } from './services/passwordResetService.js';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  db,
  initDb,
  getUserById,
  getGalleryById,
  getMediaAssetById,
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
import { createSessionValidator } from './auth/sessionValidation.js';
import { createGoogleIdentityVerifier } from './auth/googleIdentity.js';
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
  DEFAULT_UPLOAD_RATE_LIMIT,
  readBoundedEnvInteger,
} from './security/rateLimitConfig.js';
import { registerAuthRoutes } from './routes/authRoutes.js';
import { registerGalleryRoutes } from './routes/galleryRoutes.js';
import { registerQuickExhibitionRoutes } from './routes/quickExhibitionRoutes.js';
import { registerGraduationRoutes } from './routes/graduationRoutes.js';
import { registerCvRoutes } from './routes/cvRoutes.js';
import { initCvSchema } from './services/cvService.js';
import { initGraduationSchema } from './repositories/graduationRepository.js';
import { registerAgentRoutes } from './routes/agentRoutes.js';
import { registerAiWritingRoutes } from './routes/aiWritingRoutes.js';
import { registerAiCuratorRoutes } from './routes/aiCuratorRoutes.js';
import { registerExhibitionSceneRoutes } from './routes/exhibitionSceneRoutes.js';
import { registerVisitorMemoryRoutes } from './routes/visitorMemoryRoutes.js';
import { registerTtsRoutes } from './routes/ttsRoutes.js';
import { registerMediaRoutes } from './routes/mediaRoutes.js';
import { createGalleryFolderRepository } from './repositories/galleryFolderRepository.js';
import { registerGalleryFolderRoutes } from './routes/galleryFolderRoutes.js';
import { dbFile } from './db.js';
import { registerExhibitionPassportRoutes } from './routes/exhibitionPassportRoutes.js';

const {
  PORT,
  JWT_SECRET,
  GOOGLE_CLIENT_ID,
  FRONTEND_ORIGIN,
  DEFAULT_MULTIPLAYER_PORT,
  MULTIPLAYER_CORS_ORIGIN,
  REQUEST_BODY_LIMIT,
  MEDIA_UPLOAD_BODY_LIMIT,
  AI_REVIEW_BODY_LIMIT,
  REDIS_URL,
  MULTIPLAYER_SHARED_STATE,
  MULTIPLAYER_SCENE_TTL_SECONDS,
} = loadEnv();

const emailVerification = createEmailVerificationService({ database: db });
const passwordReset = createPasswordResetService({ database: db, mail: emailVerification, onError: () => logger.warn('auth.password_reset_delivery_failed') });
const app = express();
const {
  signToken,
  verifyToken,
  signMediaPreviewToken,
  verifyMediaPreviewToken,
  optionalAuth,
  requireAuth,
} = createJwtHelpers({ secret: JWT_SECRET });
const verifySessionToken = createSessionValidator({ verifyToken, getUserById, emailVerificationEnabled: emailVerification.enabled });
const csrf = createCsrfProtection({ secret: JWT_SECRET, verifyToken });
const verifyGoogleCredential = createGoogleIdentityVerifier(GOOGLE_CLIENT_ID);

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
  mediaUploadBodyLimit: MEDIA_UPLOAD_BODY_LIMIT,
  aiReviewBodyLimit: AI_REVIEW_BODY_LIMIT,
  verifyToken,
  verifySessionToken,
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
  graduationMutationLimiter: createFixedWindowLimiter({
    namespace: 'graduation-mutation', store: rateLimitStore, limit: 60, windowMs: 10 * 60_000,
    key: subjectRateLimitKey, message: 'too many graduation changes; please try again later',
  }),
  graduationPublishLimiter: createFixedWindowLimiter({
    namespace: 'graduation-publish', store: rateLimitStore, limit: 5, windowMs: 60 * 60_000,
    key: subjectRateLimitKey, message: 'too many graduation releases; please try again later',
  }),
  verificationLimiter: createFixedWindowLimiter({ namespace: 'email-verification', store: rateLimitStore, limit: 5, windowMs: 60_000, key: ipRateLimitKey, message: 'too many verification attempts' }),
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
  galleryVisitLimiter: createFixedWindowLimiter({
    namespace: 'gallery-visit', store: rateLimitStore, limit: 120, windowMs: 60_000,
    key: subjectRateLimitKey, message: 'too many visit requests',
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
    limit: readRateLimitInteger('RATE_LIMIT_UPLOAD_MAX', DEFAULT_UPLOAD_RATE_LIMIT, MAX_RATE_LIMIT),
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
  verifyGoogleCredential,
  emailVerification,
  passwordReset,
  signMediaPreviewToken,
  verifyMediaPreviewToken,
  rateLimiters,
  revokeUserSessions: (userId) => multiplayerServerHandle?.revokeUserSessions(userId) ?? Promise.resolve(),
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
registerPublicExhibitionPageRoutes(app, { getGalleryById, getMediaAssetById, origin: FRONTEND_ORIGIN });
registerQuickExhibitionRoutes(app, deps.quickExhibition);
const journeyAnalytics = createJourneyAnalytics(db);
registerJourneyAnalyticsRoutes(app, { service: journeyAnalytics, origin: FRONTEND_ORIGIN,
  limiter: createFixedWindowLimiter({ namespace: 'journey-events', store: rateLimitStore, limit: 120, windowMs: 60000, key: ipRateLimitKey, message: 'too many requests' }) });
const journeyRetentionTimer = setInterval(() => { void journeyAnalytics.prune().catch(() => {}); }, 3600000);
journeyRetentionTimer.unref();
registerGraduationRoutes(app, {
  database: db, requireAuth: deps.quickExhibition.requireAuth,
  mutationLimiter: rateLimiters.graduationMutationLimiter,
  publishLimiter: rateLimiters.graduationPublishLimiter,
});
registerCvRoutes(app, { database: db, requireAuth: deps.quickExhibition.requireAuth,
  mutationLimiter: rateLimiters.graduationMutationLimiter });
registerAgentRoutes(app, deps.agent);
registerAiWritingRoutes(app, deps.aiWriting);
registerAiCuratorRoutes(app, deps.aiCurator);
registerExhibitionSceneRoutes(app, deps.exhibitionScene);
registerVisitorMemoryRoutes(app, deps.visitorMemory);
registerTtsRoutes(app, deps.tts);
registerMediaRoutes(app, deps.media);
registerGalleryFolderRoutes(app, { requireAuth: deps.quickExhibition.requireAuth,
  repository: createGalleryFolderRepository({ filename: dbFile }), limiter: rateLimiters.uploadLimiter });
registerExhibitionPassportRoutes(app, deps.exhibitionPassport);

app.use(createJsonErrorMiddleware({ logger }));

export async function startServer({ host } = {}) {
  return startAfterInitialization({
    initialize: async () => {
      await initDb();
      await initGraduationSchema(db);
      await initCvSchema(db);
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
          host,
          initialPort: DEFAULT_MULTIPLAYER_PORT,
          corsOrigin: MULTIPLAYER_CORS_ORIGIN,
          allowMissingOrigin: process.env.NODE_ENV !== 'production',
          verifyToken,
          verifySessionToken,
          getGalleryById: deps.gallery.getGalleryById,
          getGalleryByShareToken: deps.gallery.getGalleryByShareToken,
          collaboration,
          sceneStore,
        });
        return multiplayerServerHandle;
      },
      startHttp: () => new Promise((resolve, reject) => {
        const httpServer = app.listen(PORT, host, () => {
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
