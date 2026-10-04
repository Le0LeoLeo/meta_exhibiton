import {
  createGallery,
  deleteGalleryById,
  getGalleryById,
  getMyGalleries,
  getPublishedGalleryById,
  getPublishedGalleries,
  publishGalleryById,
  unpublishGalleryById,
  updateGalleryById,
  type GalleryDetail,
  type GallerySummary,
} from './gallery';

export type ExhibitionSummary = GallerySummary;
export type ExhibitionDetail = GalleryDetail;

export {
  createGallery,
  deleteGalleryById,
  getGalleryById,
  getMyGalleries,
  getPublishedGalleryById,
  getPublishedGalleries,
  publishGalleryById,
  unpublishGalleryById,
  updateGalleryById,
};
