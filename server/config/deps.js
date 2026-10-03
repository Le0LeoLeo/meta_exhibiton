import { runStatement } from '../repositories/sqliteHelpers.js';
import { allStatement } from '../repositories/sqliteHelpers.js';
import { hasGraduationReviewAccess } from '../security/graduationReviewAccess.js';
import {
  db,
  dbFile,
  getUserByEmail,
  getUserByGoogleSubject,
  insertUser,
  linkGoogleSubject,
  getUserById,
  updateUserName,
  updateUserAvatarAppearance,
  updateUserPasswordHash,
  deleteUserAndCreateFileCleanupJobs,
  markFileCleanupJobCompleted,
  markFileCleanupJobFailed,
  listGrowthAssetContentUrlsByOwnerId,
  insertGallery,
  listGalleriesByOwnerId,
  listPublishedGalleries,
  getGalleryById,
  insertMediaAsset,
  getMediaAssetById,
  bindMediaAssetsToGallery,
  deleteMediaAssetById,
  listMediaStorageFileNamesByOwnerId,
  getPublishedGalleryById,
  updateGalleryById,
  deleteGalleryById,
  updateGalleryShareById,
  updateGalleryPublishById,
  getGalleryByShareToken,
  insertExhibitComment,
  listExhibitCommentsByGalleryAndItem,
  listExhibitCommentsByGalleryOwnerId,
  getExhibitCommentById,
  deleteExhibitCommentById,
  getExhibitionPassport,
  insertExhibitionPassport,
  completeExhibitionPassport,
  publishExhibitionPassport,
  getPublishedSouvenirByToken,
  listRecentPublishedSouvenirs,
  createExhibitionBuilderSessionRecord,
  getExhibitionBuilderSessionRecord,
  saveExhibitionBuilderSessionReview,
  appendExhibitionBuilderSessionVersion,
} from '../db.js';
import { generateGuideTtsAudio } from '../services/ttsService.js';
import { generateAgentReply } from '../services/agentService.js';
import { summarizeFeedback, polishIntro, translateText } from '../services/aiWritingService.js';
import { generateCuratorPlan } from '../services/aiCuratorService.js';
import { generateExhibitionScene } from '../services/exhibitionSceneService.js';
import {
  createBuilderSession,
  reviewBuilderSession,
  reviseBuilderSession,
  restoreBuilderSessionVersion,
} from '../services/exhibitionBuilderAgentService.js';
import { getVisitorMemory, upsertVisitorMemory } from '../db.js';
import { createGalleryAnalyticsRepository } from '../repositories/galleryAnalyticsRepository.js';
import { resolveGalleryAccess } from '../security/galleryAccess.js';
import { createRequireActiveUser } from '../auth/activeUser.js';
import {
  deleteGrowthAssetFiles,
} from '../services/growthAssetService.js';
import { exportUserData } from '../services/userDataExportService.js';
import { deleteMediaFiles } from '../services/mediaFileService.js';
import { deleteAccountWithCleanup } from '../services/accountDeletionService.js';
import { createExhibitionPassportService } from '../services/exhibitionPassportService.js';
import { createQuickExhibitionRepository } from '../repositories/quickExhibitionRepository.js';
import { createQuickExhibitionService } from '../services/quickExhibitionService.js';

export function buildAppDependencies({
  optionalAuth,
  requireAuth,
  signToken,
  createCsrfToken,
  verifyGoogleCredential,
  emailVerification = { enabled: false },
  passwordReset = { enabled: false },
  revokeUserSessions,
  signMediaPreviewToken,
  verifyMediaPreviewToken,
  rateLimiters = {},
}) {
  const requireActiveUser = createRequireActiveUser({ requireAuth, getUserById, emailVerificationEnabled: emailVerification.enabled });
  const quickExhibitionService = createQuickExhibitionService({
    repository: createQuickExhibitionRepository({ filename: dbFile }),
    signMediaPreviewToken,
    updateGalleryById,
  });
  const exhibitionPassportService = createExhibitionPassportService({
    getPublishedGalleryById,
    getVisitorMemory,
    getExhibitionPassport,
    insertExhibitionPassport,
    completeExhibitionPassport,
    publishExhibitionPassport,
    getPublishedSouvenirByToken,
    listRecentPublishedSouvenirs,
  });

  return {
    auth: {
      requireAuth,
      signToken,
      createCsrfToken,
      verifyGoogleCredential,
      emailVerification,
      passwordReset,
      markEmailVerified: (id) => runStatement(db, 'UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?', [new Date().toISOString(), id]),
      verificationLimiter: rateLimiters.verificationLimiter,
      revokeUserSessions,
      authLimiter: rateLimiters.authLimiter,
      getUserByEmail,
      getUserByGoogleSubject,
      insertUser,
      linkGoogleSubject,
      getUserById,
      updateUserName,
      updateUserAvatarAppearance,
      updateUserPasswordHash,
      deleteAccountWithCleanup: ({ ownerId, growthAssetUrls, mediaFileNames }) => deleteAccountWithCleanup({
        ownerId,
        growthAssetUrls,
        mediaFileNames,
        deleteUserAndCreateFileCleanupJobs,
        deleteGrowthAssetFiles,
        deleteMediaFiles,
        markFileCleanupJobCompleted,
        markFileCleanupJobFailed,
      }),
      exportUserData: (ownerId) => exportUserData(db, ownerId),
      listMediaStorageFileNamesByOwnerId,
      deleteMediaFiles,
      listGrowthAssetContentUrlsByOwnerId,
      deleteGrowthAssetFiles,
    },
    gallery: {
      hasReviewAccess: (gallery, userId) => hasGraduationReviewAccess(db, gallery, userId),
      publishQuickExhibition: quickExhibitionService.publish,
      saveQuickExhibitionFromEditor: quickExhibitionService.saveFromEditor,
      requireAuth,
      optionalAuth,
      resolveGalleryAccess,
      commentLimiter: rateLimiters.commentLimiter,
      getUserById,
      insertGallery,
      listGalleriesByOwnerId,
      listPublishedGalleries,
      getGalleryById,
      getPublishedGalleryById,
      updateGalleryById,
      deleteGalleryById,
      updateGalleryShareById,
      updateGalleryPublishById,
      getGalleryByShareToken,
      insertExhibitComment,
      listExhibitCommentsByGalleryAndItem,
      listExhibitCommentsByGalleryOwnerId,
      getExhibitCommentById,
      deleteExhibitCommentById,
      analyticsRepository: createGalleryAnalyticsRepository(db),
      visitLimiter: rateLimiters.galleryVisitLimiter,
    },
    agent: {
      requireActiveUser,
      agentLimiter: rateLimiters.agentLimiter,
      generateAgentReply,
    },
    aiWriting: {
      requireActiveUser,
      aiWritingLimiter: rateLimiters.aiWritingLimiter,
      summarizeFeedback,
      polishIntro,
      translateText,
    },
    aiCurator: {
      requireActiveUser,
      aiWritingLimiter: rateLimiters.aiWritingLimiter,
      generateCuratorPlan,
    },
    exhibitionScene: {
      requireActiveUser,
      aiWritingLimiter: rateLimiters.aiWritingLimiter,
      generateExhibitionScene,
      createBuilderSession,
      reviewBuilderSession,
      reviseBuilderSession,
      restoreBuilderSessionVersion,
      createExhibitionBuilderSessionRecord,
      getExhibitionBuilderSessionRecord,
      saveExhibitionBuilderSessionReview,
      appendExhibitionBuilderSessionVersion,
    },
    quickExhibition: {
      requireAuth: requireActiveUser,
      service: quickExhibitionService,
    },
    media: {
      hasReviewAccess: (gallery, userId) => hasGraduationReviewAccess(db, gallery, userId),
      getAssetGalleries: (assetId) => allStatement(db, `SELECT DISTINCT g.* FROM galleries g
        LEFT JOIN box_contents c ON c.box_id=g.id AND c.asset_id=?
        WHERE c.id IS NOT NULL OR g.id=(SELECT gallery_id FROM media_assets WHERE id=?)`, [assetId, assetId]),
      requireAuth: requireActiveUser,
      optionalAuth,
      uploadLimiter: rateLimiters.uploadLimiter,
      insertMediaAsset,
      getMediaAssetById,
      bindMediaAssetsToGallery,
      getGalleryById,
      getGalleryByShareToken,
      signMediaPreviewToken,
      verifyMediaPreviewToken,
      deleteMediaAssetById,
    },
    visitorMemory: {
      requireAuth,
      visitorMemoryLimiter: rateLimiters.visitorMemoryLimiter,
      getVisitorMemory,
      upsertVisitorMemory,
    },
    exhibitionPassport: {
      requireAuth,
      passportMutationLimiter: rateLimiters.passportMutationLimiter,
      souvenirReadLimiter: rateLimiters.souvenirReadLimiter,
      service: exhibitionPassportService,
    },
    tts: {
      requireActiveUser,
      ttsLimiter: rateLimiters.ttsLimiter,
      generateGuideTtsAudio,
    },
  };
}
