import { z } from 'zod';
import { sceneContainsAsset } from '../repositories/legacyBoxData.js';
import { resolveGalleryAccess } from '../security/galleryAccess.js';
import { ingestMediaUpload as defaultIngestMediaUpload } from '../services/mediaIngestService.js';
import { deleteMediaFile as defaultDeleteMediaFile, readMediaFile as defaultReadMediaFile } from '../services/mediaFileService.js';

const uploadSchema = z.object({
  dataBase64: z.string().min(1),
  mimeType: z.string().trim().min(1).max(100),
  fileName: z.string().trim().min(1).max(255),
  usage: z.enum(['gallery', 'avatar']).default('gallery'),
}).strict();

const bindSchema = z.object({
  galleryId: z.string().trim().min(1).max(100),
  assetIds: z.array(z.string().uuid()).min(1).max(100),
}).strict();

const noRateLimit = (_req, _res, next) => next();

export function registerMediaRoutes(app, deps = {}) {
  const {
    requireAuth,
    optionalAuth,
    uploadLimiter = noRateLimit,
    ingestMediaUpload = defaultIngestMediaUpload,
    insertMediaAsset,
    getMediaAssetById,
    bindMediaAssetsToGallery,
    getGalleryById,
    hasReviewAccess = async () => false,
    getGalleryByShareToken,
    readMediaFile = defaultReadMediaFile,
    deleteMediaFile = defaultDeleteMediaFile,
    signMediaPreviewToken,
    verifyMediaPreviewToken,
    deleteMediaAssetById,
    getAssetGalleries,
  } = deps;

  app.post('/api/media/upload', uploadLimiter, async (req, res) => {
    let storedAsset = null;
    try {
      const auth = requireAuth ? await requireAuth(req, res) : null;
      if (requireAuth && !auth) return;

      const parsed = uploadSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({
          code: 'INVALID_UPLOAD',
          message: parsed.error.issues[0]?.message ?? 'invalid upload payload',
        });
      }

      const { usage, ...upload } = parsed.data;
      storedAsset = await ingestMediaUpload(upload, { allowSceneMedia: usage === 'gallery' });
      const now = new Date().toISOString();
      await insertMediaAsset?.({
        id: storedAsset.id,
        ownerId: auth?.sub,
        galleryId: null,
        storageFileName: storedAsset.fileName,
        originalFileName: storedAsset.originalFileName,
        mimeType: storedAsset.mimeType,
        sizeBytes: storedAsset.size,
        width: storedAsset.width,
        height: storedAsset.height,
        usage,
        createdAt: now,
        updatedAt: now,
      });
      const url = `/api/media/${encodeURIComponent(storedAsset.id)}`;
      const previewToken = signMediaPreviewToken?.(storedAsset.id);
      return res.status(201).json({
        asset: {
          ...storedAsset,
          url,
          ...(previewToken ? { previewUrl: `${url}?accessToken=${encodeURIComponent(previewToken)}` } : {}),
        },
      });
    } catch (error) {
      if (storedAsset?.fileName) {
        try { await deleteMediaFile(storedAsset.fileName); } catch { /* retain original error */ }
      }
      if (error?.code && Number.isInteger(error?.status)) {
        return res.status(error.status).json({ code: error.code, message: error.message });
      }
      console.error(error);
      return res.status(500).json({ code: 'MEDIA_UPLOAD_FAILED', message: 'media upload failed' });
    }
  });

  app.post('/api/media/bind', async (req, res) => {
    try {
      const auth = requireAuth ? await requireAuth(req, res) : null;
      if (requireAuth && !auth) return;
      const parsed = bindSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ code: 'INVALID_MEDIA_BINDING', message: parsed.error.issues[0]?.message ?? 'invalid binding payload' });
      }
      const assetIds = [...new Set(parsed.data.assetIds)];
      const changed = await bindMediaAssetsToGallery?.(assetIds, parsed.data.galleryId, auth?.sub);
      if (changed !== assetIds.length) {
        return res.status(404).json({ code: 'MEDIA_NOT_FOUND', message: 'media or gallery not found' });
      }
      return res.json({
        ok: true,
        bound: changed,
        assets: assetIds.map((id) => {
          const url = `/api/media/${encodeURIComponent(id)}`;
          const previewToken = signMediaPreviewToken?.(id);
          return {
            id,
            url,
            ...(previewToken ? { previewUrl: `${url}?accessToken=${encodeURIComponent(previewToken)}` } : {}),
          };
        }),
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ code: 'MEDIA_BIND_FAILED', message: 'media binding failed' });
    }
  });

  app.get('/api/media/:id', async (req, res) => {
    // Access may be withdrawn; do not cache denials or private preview responses.
    res.setHeader('Cache-Control', 'private, no-store');
    try {
      const id = String(req.params.id || '').trim();
      if (!id) return res.status(404).json({ message: 'media not found' });
      const asset = await getMediaAssetById?.(id);
      if (!asset) return res.status(404).json({ message: 'media not found' });

      const auth = optionalAuth ? await optionalAuth(req, res) : null;
      const isOwner = Boolean(auth?.sub && auth.sub === asset.owner_id);
      const previewToken = String(req.query.accessToken || '');
      const hasPreviewAccess = Boolean(previewToken && verifyMediaPreviewToken?.(previewToken, asset.id));
      const isAvatarAsset = asset.usage === 'avatar';
      let isPublished = false;
      let hasShareAccess = false;
      let hasTeacherAccess = false;
      if (asset.library_retained && !isOwner && getAssetGalleries) {
        const shareToken = String(req.header('x-gallery-share-token') || req.query.shareToken || '').trim();
        const shared = shareToken ? await getGalleryByShareToken?.(shareToken) : null;
        for (const gallery of await getAssetGalleries(asset.id)) {
          if (!sceneContainsAsset(gallery.scene_json, asset.id)) continue;
          if (auth?.sub && await hasReviewAccess(gallery, auth.sub)) hasTeacherAccess = true;
          if (gallery.is_published) isPublished = true;
          if (shared?.id === gallery.id && resolveGalleryAccess({ gallery, share: shared, shareToken }).allowed) hasShareAccess = true;
        }
      } else if (!asset.library_retained && asset.gallery_id && !isOwner) {
        const gallery = await getGalleryById?.(asset.gallery_id);
        if (auth?.sub && gallery && sceneContainsAsset(gallery.scene_json, asset.id)) {
          hasTeacherAccess = await hasReviewAccess(gallery, auth.sub);
        }
        isPublished = Boolean(gallery?.is_published);
        if (!isPublished) {
          const shareToken = String(req.header('x-gallery-share-token') || req.query.shareToken || '').trim();
          if (shareToken) {
            const sharedGallery = await getGalleryByShareToken?.(shareToken);
            const notExpired = !sharedGallery?.share_expires_at
              || new Date(sharedGallery.share_expires_at).getTime() > Date.now();
            hasShareAccess = sharedGallery?.id === asset.gallery_id && notExpired;
          }
        }
      }
      if (!isOwner && !isAvatarAsset && !isPublished && !hasShareAccess && !hasPreviewAccess && !hasTeacherAccess) {
        return res.status(404).json({ message: 'media not found' });
      }

      const bytes = await readMediaFile(asset.storage_file_name);
      res.setHeader('Content-Type', asset.mime_type);
      res.setHeader('Content-Length', String(bytes.length));
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader(
        'Cache-Control',
        !asset.library_retained && isAvatarAsset ? 'public, max-age=3600'
          : !asset.library_retained && isPublished ? 'private, no-cache' : 'private, no-store',
      );
      res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(asset.original_file_name || 'artwork')}`);
      res.setHeader('Accept-Ranges', 'bytes');
      if (req.headers.range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        const start = match?.[1] ? Number(match[1]) : match?.[2] ? Math.max(0, bytes.length - Number(match[2])) : NaN;
        const end = match?.[1] && match?.[2] ? Math.min(bytes.length - 1, Number(match[2])) : bytes.length - 1;
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= bytes.length) {
          res.setHeader('Content-Range', `bytes */${bytes.length}`);
          res.removeHeader('Content-Length');
          return res.status(416).end();
        }
        res.setHeader('Content-Range', `bytes ${start}-${end}/${bytes.length}`);
        res.setHeader('Content-Length', String(end - start + 1));
        return res.status(206).send(bytes.subarray(start, end + 1));
      }
      return res.send(bytes);
    } catch (error) {
      if (error?.code === 'ENOENT' || error?.code === 'INVALID_MEDIA_PATH') {
        return res.status(404).json({ message: 'media not found' });
      }
      console.error(error);
      return res.status(500).json({ code: 'MEDIA_READ_FAILED', message: 'media read failed' });
    }
  });

  app.delete('/api/media/:id', async (req, res) => {
    try {
      const auth = requireAuth ? await requireAuth(req, res) : null;
      if (requireAuth && !auth) return;
      const id = String(req.params.id || '').trim();
      if (!id) return res.status(404).json({ message: 'media not found' });
      const existing = await getMediaAssetById?.(id);
      if (!existing || existing.owner_id !== auth?.sub) {
        return res.status(404).json({ message: 'media not found' });
      }
      if (existing.library_retained) {
        return res.status(409).json({ code: 'MEDIA_IN_USE', message: 'This file is retained in your personal library. Remove it from boxes without deleting the original.' });
      }
      if (existing.gallery_id) {
        const gallery = await getGalleryById?.(existing.gallery_id);
        if (gallery?.is_published) {
          return res.status(409).json({
            code: 'MEDIA_IN_USE',
            message: 'unpublish the gallery before deleting this media asset',
          });
        }
      }
      const asset = await deleteMediaAssetById?.(id, auth?.sub);
      if (!asset) return res.status(404).json({ message: 'media not found' });
      try {
        await deleteMediaFile(asset.storage_file_name);
        return res.json({ ok: true, cleanupPending: false });
      } catch (cleanupError) {
        console.error('[media] deferred deleted asset file cleanup', cleanupError);
        return res.status(202).json({ ok: true, cleanupPending: true });
      }
    } catch (error) {
      console.error(error);
      return res.status(500).json({ code: 'MEDIA_DELETE_FAILED', message: 'media deletion failed' });
    }
  });
}
