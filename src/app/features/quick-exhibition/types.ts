import type { SceneSnapshot } from '@/app/modules/metaverse3d/store/metaverseStoreTypes';

export type QuickExhibitionStyle = 'white-box' | 'warm-gallery' | 'dark-gallery';

export type QuickExhibitionLanguage = 'zh-TW' | 'zh-CN' | 'en';

export type QuickExhibitionAsset = {
  assetId: string;
  clientFileId: string;
  order: number;
  fileName: string;
  mimeType: string;
  width: number;
  height: number;
  title: string;
  artist: string;
  description: string;
  url: string;
  previewUrl?: string;
};

export type QuickExhibitionInput = {
  title: string;
  language: QuickExhibitionLanguage;
  style: QuickExhibitionStyle;
  assets: QuickExhibitionAsset[];
};

export type QuickExhibitionResult = {
  scene: SceneSnapshot;
  title: string;
  layoutVersion: number;
  includedAssetIds: string[];
  uploadedCount: number;
  placedCount: number;
  warnings: string[];
};

export type QuickExhibitionDraft = {
  draftId: string;
  galleryId: string;
  revision: number;
  status: 'collecting' | 'ready' | 'candidate_ready' | 'failed' | 'published';
  input: QuickExhibitionInput;
  result: QuickExhibitionResult | null;
  createdAt: string;
  updatedAt: string;
  limits?: { maxAssets: number; maxFileBytes: number };
};

export type QuickExhibitionAssetInput = Pick<QuickExhibitionAsset,
  'assetId' | 'clientFileId' | 'order' | 'title' | 'artist' | 'description'>;

export type QuickExhibitionPatch = {
  style?: QuickExhibitionStyle;
  expectedRevision: number;
  title?: string;
  language?: QuickExhibitionLanguage;
  assets?: QuickExhibitionAssetInput[];
};

export type QuickUploadItem = {
  id: string;
  fileName: string;
  status: 'pending' | 'uploading' | 'succeeded' | 'failed' | 'missing';
  file?: File;
  previewUrl?: string;
  asset?: QuickExhibitionAsset;
  error?: string;
};

export type QuickExhibitionPhase = 'loading' | 'empty' | 'uploading' | 'building'
  | 'preview' | 'publishing' | 'published' | 'needs_attention';
