import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { z } from 'zod';
import { AUTOMATIC_EXHIBITION_LAYOUT_VERSION, assertAutomaticExhibitionLayout, buildAutomaticExhibition } from './automaticExhibitionLayout.js';
import { readMediaFile } from './mediaFileService.js';
import { DEFAULT_MEDIA_UPLOAD_MAX_BYTES } from './mediaIngestService.js';
import { sceneSnapshotSchema } from '../schemas/sceneSchema.js';
import { assertQuickDraftWritable, isQuickRequestReplay, quickExhibitionError } from '../repositories/quickExhibitionRepository.js';

const settings = {
  style: z.enum(['white-box', 'warm-gallery', 'dark-gallery']).optional(),
  title: z.string().trim().max(120).optional(),
  language: z.enum(['zh-TW', 'zh-CN', 'en']).optional(),
};
export const quickCreateSchema = z.object(settings).strict();
export const quickPatchSchema = z.object({
  ...settings,
  expectedRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  assets: z.array(z.object({
    assetId: z.string().uuid(),
    clientFileId: z.string().trim().min(1).max(100),
    order: z.number().int().nonnegative().max(1_000_000),
    title: z.string().trim().max(200).optional(),
    artist: z.string().trim().max(200).optional(),
    description: z.string().trim().max(5000).optional(),
  }).strict()).max(30).optional(),
}).strict();
export const quickOperationSchema = z.object({
  expectedRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  requestId: z.string().uuid(),
}).strict();

const defaultTitles = { 'zh-TW': '我的作品展', 'zh-CN': '我的作品展', en: 'My Art Exhibition' };
const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const validDimension = (value) => Number.isSafeInteger(value) && value > 0;

function fingerprint(operation, payload, input) {
  return createHash('sha256').update(JSON.stringify({ operation, expectedRevision: payload.expectedRevision, input })).digest('hex');
}

export function validateQuickExhibitionResult(input, result) {
  const expected = input.assets.map((asset) => asset.assetId);
  const items = result?.scene?.items;
  const placed = Array.isArray(items) ? items.filter((item) => item.assetId || item.type === 'painting') : [];
  const exactCoverage = (ids) => Array.isArray(ids) && ids.length === expected.length
    && new Set(ids).size === ids.length && ids.every((id) => expected.includes(id));
  if (!expected.length) throw quickExhibitionError('EMPTY_EXHIBITION', 422);
  if (expected.length > 30) throw quickExhibitionError('TOO_MANY_ASSETS', 422);
  if (new Set(expected).size !== expected.length || !exactCoverage(result?.includedAssetIds)
    || !exactCoverage(placed.map((item) => item.assetId))
    || result.uploadedCount !== expected.length || result.placedCount !== expected.length) {
    throw quickExhibitionError('ASSET_COVERAGE_MISMATCH', 422);
  }
  for (const item of placed) {
    const asset = input.assets.find((candidate) => candidate.assetId === item.assetId);
    const url = `/api/media/${asset.assetId}`;
    if (item.type !== 'painting' || item.content !== url || (item.assetUrl !== undefined && item.assetUrl !== url)
      || item.imageAspectRatio !== asset.width / asset.height
      || item.fileName !== asset.fileName || item.fileMimeType !== asset.mimeType
      || item.title !== asset.title || (item.artist ?? '') !== asset.artist || (item.description ?? '') !== asset.description) {
      throw quickExhibitionError('ASSET_COVERAGE_MISMATCH', 422);
    }
  }
  const json = JSON.stringify(result);
  const room = result.scene.roomSize;
  if (![1, AUTOMATIC_EXHIBITION_LAYOUT_VERSION].includes(result.layoutVersion) || result.title !== input.title
    || !Array.isArray(result.warnings) || result.warnings.some((warning) => typeof warning !== 'string')
    || Buffer.byteLength(json) > 2_000_000 || /(?:[?&](?:accessToken|shareToken)=|blob:|data:image\/)/i.test(json)
    || !sceneSnapshotSchema.safeParse(result.scene).success
    || room.width < 8 || room.width > 40 || room.length < 8 || room.length > 60
    || room.height < 4 || room.height > 8 || room.wallThickness < 0.08 || room.wallThickness > 0.2) {
    throw quickExhibitionError('LAYOUT_NOT_POSSIBLE', 422);
  }
  assertAutomaticExhibitionLayout(result.scene, expected, result.layoutVersion);
  return result;
}

export function createQuickExhibitionService({
  repository,
  build = buildAutomaticExhibition,
  readFile = readMediaFile,
  signMediaPreviewToken,
  updateGalleryById,
}) {
  async function trustedAsset(asset, row) {
    const media = await repository.getMediaAsset(asset.assetId);
    if (!media || media.owner_id !== row.owner_id || media.usage !== 'gallery'
      || (media.gallery_id && media.gallery_id !== row.gallery_id)) {
      throw quickExhibitionError('ASSET_NOT_FOUND', 404);
    }
    if (!imageTypes.has(media.mime_type)) throw quickExhibitionError('INVALID_ASSET_TYPE', 422);
    let { width, height } = media;
    if (width == null || height == null) {
      try {
        const bytes = await readFile(media.storage_file_name);
        const metadata = await sharp(bytes, { failOn: 'error' }).metadata();
        if ((metadata.pages ?? 1) !== 1 || `image/${metadata.format}` !== media.mime_type) throw new Error('unsupported image');
        // Legacy rows describe the stored image, which may still carry orientation.
        const rotated = metadata.orientation >= 5 && metadata.orientation <= 8;
        width = rotated ? metadata.height : metadata.width;
        height = rotated ? metadata.width : metadata.height;
      } catch {
        throw quickExhibitionError('ASSET_DIMENSIONS_UNAVAILABLE', 422);
      }
    }
    if (!validDimension(width) || !validDimension(height)) throw quickExhibitionError('ASSET_DIMENSIONS_UNAVAILABLE', 422);
    const previous = row.input.assets.find((entry) => entry.assetId === asset.assetId);
    return {
      assetId: media.id,
      clientFileId: asset.clientFileId,
      order: asset.order,
      fileName: media.original_file_name,
      mimeType: media.mime_type,
      width,
      height,
      title: ((asset.title ?? previous?.title) || media.original_file_name.replace(/\.[^.]+$/, '')).slice(0, 200),
      artist: asset.artist ?? previous?.artist ?? '',
      description: asset.description ?? previous?.description ?? '',
      url: `/api/media/${media.id}`,
    };
  }

  async function response(row) {
    const assets = await Promise.all(row.input.assets.map(async (asset) => {
      // Do not mint a bearer preview capability for a deleted or rebound asset.
      const media = await repository.getMediaAsset(asset.assetId);
      if (!media || media.owner_id !== row.owner_id || media.usage !== 'gallery' || media.gallery_id !== row.gallery_id) {
        throw quickExhibitionError('ASSET_NOT_FOUND', 404);
      }
      const token = signMediaPreviewToken?.(asset.assetId);
      const url = `/api/media/${asset.assetId}`;
      return { ...asset, url, ...(token ? { previewUrl: `${url}?accessToken=${encodeURIComponent(token)}` } : {}) };
    }));
    return {
      draftId: row.id,
      galleryId: row.gallery_id,
      revision: row.revision,
      status: row.is_published ? 'published' : row.status,
      input: { ...row.input, assets },
      result: row.result,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      limits: { maxAssets: 30, maxFileBytes: DEFAULT_MEDIA_UPLOAD_MAX_BYTES },
    };
  }

  async function operation(kind, draftId, ownerId, payload) {
    const row = await repository.get(draftId, ownerId);
    assertQuickDraftWritable(row);
    // Discard restores input, so its replay fingerprint must use the request body.
    // expectedRevision binds that body to one candidate under the repository CAS.
    const requestFingerprint = fingerprint(kind, payload, kind === 'discard' ? undefined : row.input);
    const request = { draftId, ownerId, ...payload, fingerprint: requestFingerprint };
    if (isQuickRequestReplay(row, request)) return response(row);
    assertQuickDraftWritable(row, payload.expectedRevision);
    if (kind === 'discard') {
      return response(await repository.discard({ ...request, validateResult: validateQuickExhibitionResult }));
    }
    let result;
    try {
      if (kind === 'apply') {
        if (row.status !== 'candidate_ready' || !row.result) throw quickExhibitionError('DRAFT_NOT_READY');
        result = validateQuickExhibitionResult(row.input, row.result);
      } else {
        if (!row.input.assets.length) throw quickExhibitionError('EMPTY_EXHIBITION', 422);
        const assets = await Promise.all(row.input.assets.map((asset) => trustedAsset(asset, row)));
        result = validateQuickExhibitionResult(row.input, await build({ ...row.input, assets }));
      }
    } catch (error) {
      const code = error.code || error.message;
      if (['EMPTY_EXHIBITION', 'TOO_MANY_ASSETS', 'ASSET_DIMENSIONS_UNAVAILABLE', 'ASSET_COVERAGE_MISMATCH', 'LAYOUT_NOT_POSSIBLE'].includes(code)) {
        await repository.fail({ draftId, ownerId, expectedRevision: payload.expectedRevision, code });
        throw quickExhibitionError(code, 422);
      }
      throw error;
    }
    return response(await repository.saveResult({ ...request, result, apply: kind === 'apply' }));
  }

  return {
    create: async (draftId, ownerId, payload) => {
      const language = payload.language ?? 'zh-TW';
      return response(await repository.create({ draftId, ownerId, input: {
        title: payload.title || defaultTitles[language], language, style: payload.style ?? 'white-box', assets: [],
      } }));
    },
    get: async (draftId, ownerId) => response(await repository.get(draftId, ownerId)),
    patch: async (draftId, ownerId, payload) => {
      const row = await repository.get(draftId, ownerId);
      assertQuickDraftWritable(row, payload.expectedRevision);
      const language = payload.language ?? row.input.language;
      const title = payload.title !== undefined ? payload.title || defaultTitles[language] : row.input.title;
      const requestedAssets = payload.assets ?? row.input.assets;
      if (requestedAssets.length > 30) throw quickExhibitionError('TOO_MANY_ASSETS', 422);
      if (new Set(requestedAssets.map((asset) => asset.assetId)).size !== requestedAssets.length
        || new Set(requestedAssets.map((asset) => asset.clientFileId)).size !== requestedAssets.length) {
        throw quickExhibitionError('ASSET_COVERAGE_MISMATCH', 422);
      }
      const assets = await Promise.all(requestedAssets.map((asset) => trustedAsset(asset, row)));
      assets.sort((a, b) => a.order - b.order || a.assetId.localeCompare(b.assetId));
      return response(await repository.patch({ draftId, ownerId, expectedRevision: payload.expectedRevision,
        input: { title, language, style: payload.style ?? row.input.style, assets } }));
    },
    build: (draftId, ownerId, payload) => operation('build', draftId, ownerId, payload),
    apply: (draftId, ownerId, payload) => operation('apply', draftId, ownerId, payload),
    discard: (draftId, ownerId, payload) => operation('discard', draftId, ownerId, payload),
    saveFromEditor: (galleryId, ownerId, updates) => updates.sceneJson === undefined ? null : repository.saveFromEditor({
      galleryId, ownerId, saveGallery: (database) => updateGalleryById(galleryId, ownerId, updates, database),
    }),
    publish: (galleryId, ownerId) => repository.publish({ galleryId, ownerId, validateResult: validateQuickExhibitionResult }),
  };
}
