import {
  getUserByEmail,
  insertUser,
  getUserById,
  updateUserName,
  updateUserPasswordHash,
  deleteUserById,
  insertGallery,
  listGalleriesByOwnerId,
  getGalleryById,
  updateGalleryById,
  deleteGalleryById,
  updateGalleryShareById,
  getGalleryByShareToken,
} from '../db.js';
import { generateCuratedSceneWithQwen, buildCuratedScene } from '../services/curateService.js';
import { generateGuideTtsAudio } from '../services/ttsService.js';

export function buildAppDependencies({ requireAuth, signToken }) {
  return {
    auth: {
      requireAuth,
      signToken,
      getUserByEmail,
      insertUser,
      getUserById,
      updateUserName,
      updateUserPasswordHash,
      deleteUserById,
    },
    gallery: {
      requireAuth,
      getUserById,
      insertGallery,
      listGalleriesByOwnerId,
      getGalleryById,
      updateGalleryById,
      deleteGalleryById,
      updateGalleryShareById,
      getGalleryByShareToken,
    },
    curate: {
      generateCuratedSceneWithQwen,
      buildCuratedScene,
      generateGuideTtsAudio,
    },
  };
}
