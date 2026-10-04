import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { assertPersistentScenePayload } from '../services/exhibitionSceneService.js';
import { analyticsPeriod, artworkItems, buildGalleryAnalytics } from '../services/galleryAnalyticsService.js';

const visitSchema = z.object({
  visitorId: z.string().uuid(), sessionId: z.string().uuid(), mode: z.enum(['2d', '3d']),
  activeSeconds: z.number().finite().min(0).max(86400 * 30),
  itemDwellSeconds: z.record(z.string().min(1).max(200), z.number().finite().min(0).max(86400 * 30))
    .refine((items) => Object.keys(items).length <= 200, 'too many items'),
}).strict();

const SHARE_ROLE_VIEWER = 'viewer';
const SHARE_ROLE_EDITOR = 'editor';
const galleryReviewSchema = z.object({
  userName: z.string().trim().min(1, 'userName is required').max(80, 'userName too long'),
  content: z.string().trim().min(1, 'content is required').max(2000, 'content too long'),
});

const galleryCreateSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(120, 'title too long'),
  description: z.string().trim().min(1, 'description is required').max(2000, 'description too long'),
  templateTitle: z.string().trim().min(1, 'templateTitle is required').max(200, 'templateTitle too long'),
  templateImage: z.string().trim().min(1, 'templateImage is required').max(2_000_000, 'templateImage too long'),
  category: z.string().trim().min(1, 'category is required').max(50, 'category too long'),
  sceneJson: z.string().optional(),
});

const galleryUpdateSchema = z.object({
  expectedRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
  title: z.string().trim().min(1, 'title is required').max(120, 'title too long').optional(),
  description: z.string().trim().min(1, 'description is required').max(2000, 'description too long').optional(),
  templateTitle: z.string().trim().min(1, 'templateTitle is required').max(200, 'templateTitle too long').optional(),
  templateImage: z.string().trim().min(1, 'templateImage is required').max(2_000_000, 'templateImage too long').optional(),
  category: z.string().trim().min(1, 'category is required').max(50, 'category too long').optional(),
  sceneJson: z.string().optional().nullable(),
});

const shareLinkCreateSchema = z.object({
  role: z.enum([SHARE_ROLE_VIEWER, SHARE_ROLE_EDITOR]).default(SHARE_ROLE_VIEWER),
  expiresInHours: z.coerce.number().int().positive().max(24 * 365).optional(),
});


function rejectNonPersistentScene(res, sceneJson) {
  try {
    assertPersistentScenePayload(sceneJson);
    return false;
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : 'scene contains a non-persistent asset URL',
    });
    return true;
  }
}

export function registerGalleryRoutes(app, deps) {
  const {
    requireAuth,
    optionalAuth,
    resolveGalleryAccess,
    commentLimiter = (_req, _res, next) => next(),
    getUserById,
    insertGallery,
    listGalleriesByOwnerId,
    listPublishedGalleries,
    getGalleryById,
    hasReviewAccess = async () => false,
    getPublishedGalleryById,
    updateGalleryById,
    deleteGalleryById,
    updateGalleryShareById,
    updateGalleryPublishById,
    publishQuickExhibition,
    saveQuickExhibitionFromEditor,
    getGalleryByShareToken,
    insertExhibitComment,
    listExhibitCommentsByGalleryAndItem,
    listExhibitCommentsByGalleryOwnerId,
    getExhibitCommentById,
    deleteExhibitCommentById,
    analyticsRepository,
    visitLimiter = (_req, _res, next) => next(),
  } = deps;

  const saveGalleryUpdates = async (id, ownerId, updates) => {
    const quickGallery = await saveQuickExhibitionFromEditor?.(id, ownerId, updates);
    if (quickGallery) return 1;
    return updateGalleryById(id, ownerId, updates);
  };

  const authorizeGalleryComments = async (req, res) => {
    const galleryId = String(req.params.id || '').trim();
    const gallery = await getGalleryById(galleryId);
    const auth = optionalAuth(req);
    const shareToken = String(req.header('x-gallery-share-token') || '').trim() || null;
    const resolvedShare = shareToken
      ? await getGalleryByShareToken(shareToken)
      : null;
    const access = resolveGalleryAccess({
      gallery,
      auth,
      share: shareToken && !resolvedShare ? {} : resolvedShare,
      shareToken,
    });

    if (access.allowed) {
      return { gallery, access };
    }

    const statusByReason = {
      not_found: 404,
      authentication_required: 401,
      forbidden: 403,
      invalid_share: 403,
      share_expired: 410,
    };
    const status = statusByReason[access.reason] || 403;
    res.status(status).json({ message: access.reason });
    return null;
  };

  const galleryHasItem = (gallery, itemId) => {
    try {
      const scene = JSON.parse(gallery?.scene_json);
      return Array.isArray(scene?.items)
        && scene.items.some((item) => item?.id === itemId);
    } catch {
      return false;
    }
  };

  const toGalleryResponse = (row) => ({
    id: row.id,
    ownerId: row.owner_id,
    ownerName: row.owner_name || null,
    title: row.title,
    description: row.description,
    templateTitle: row.template_title,
    templateImage: row.template_image,
    category: row.category,
    sceneJson: row.scene_json,
    revision: row.revision ?? 0,
    shareRole: row.share_role || SHARE_ROLE_VIEWER,
    shareExpiresAt: row.share_expires_at || null,
    isPublished: Boolean(row.is_published),
    isBox: Boolean(row.is_box),
    publishedAt: row.published_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  const isShareExpired = (isoDatetime) => {
    if (!isoDatetime) return false;
    const ts = new Date(isoDatetime).getTime();
    if (Number.isNaN(ts)) return true;
    return ts <= Date.now();
  };

  app.post('/api/galleries', async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      const owner = await getUserById(payload.sub);
      if (!owner) {
        return res.status(401).json({ message: 'user not found, please login again' });
      }

      const parsed = galleryCreateSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: parsed.error.issues[0]?.message ?? 'invalid payload' });
      }
      if (rejectNonPersistentScene(res, parsed.data.sceneJson)) return;

      const now = new Date().toISOString();
      const gallery = {
        id: randomUUID(),
        ownerId: payload.sub,
        title: parsed.data.title,
        description: parsed.data.description,
        templateTitle: parsed.data.templateTitle,
        templateImage: parsed.data.templateImage,
        category: parsed.data.category,
        sceneJson: typeof parsed.data.sceneJson === 'string' ? parsed.data.sceneJson : null,
        createdAt: now,
        updatedAt: now,
      };

      await insertGallery(gallery);

      res.status(201).json({
        gallery: {
          id: gallery.id,
          ownerId: gallery.ownerId,
          ownerName: owner.name,
          title: gallery.title,
          description: gallery.description,
          templateTitle: gallery.templateTitle,
          templateImage: gallery.templateImage,
          category: gallery.category,
          sceneJson: gallery.sceneJson,
          shareRole: SHARE_ROLE_VIEWER,
          shareExpiresAt: null,
          isPublished: false,
          publishedAt: null,
          createdAt: gallery.createdAt,
          updatedAt: gallery.updatedAt,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.get('/api/galleries/mine', async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      const rows = await listGalleriesByOwnerId(payload.sub);
      const galleries = rows.map((r) => ({ ...toGalleryResponse(r), quickDraftId: r.quick_draft_id || null }));
      res.json({ galleries });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.get('/api/galleries/published', async (req, res) => {
    const query = z.object({
      limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(48)).optional(),
      after: z.string().min(1).max(1024).regex(/^[A-Za-z0-9_-]+$/).optional(),
    }).safeParse(req.query);
    if (!query.success) return res.status(400).json({ message: 'invalid gallery page' });
    let after = null;
    if (query.data.after) {
      try {
        after = z.object({ at: z.string().min(1).max(64), id: z.string().min(1).max(200) }).strict()
          .parse(JSON.parse(Buffer.from(query.data.after, 'base64url').toString('utf8')));
      } catch { return res.status(400).json({ message: 'invalid gallery cursor' }); }
    }
    try {
      const limit = query.data.limit ?? 12;
      const rows = await listPublishedGalleries({ limit, after });
      const page = rows.slice(0, limit);
      const galleries = page.map((r) => {
        const summary = toGalleryResponse(r);
        delete summary.sceneJson;
        delete summary.shareRole;
        delete summary.shareExpiresAt;
        summary.templateImage = r.cover_image ?? r.template_image ?? '';
        return summary;
      });
      const last = page.at(-1);
      const nextCursor = rows.length > limit && last
        ? Buffer.from(JSON.stringify({ at: last.published_at || last.updated_at, id: last.id })).toString('base64url') : null;
      res.json({ galleries, nextCursor });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.get('/api/galleries/published/:id', async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) return res.status(400).json({ message: 'gallery id is required' });

      const row = await getPublishedGalleryById(id);
      if (!row) {
        return res.status(404).json({ message: 'gallery not found' });
      }

      res.json({ gallery: toGalleryResponse(row, req) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.get('/api/galleries/admin/analytics', async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      const range = req.query.range || '30d';
      if (!['7d', '30d', '90d'].includes(range) || (req.query.galleryId !== undefined && typeof req.query.galleryId !== 'string')) {
        return res.status(400).json({ message: 'invalid analytics filter' });
      }
      const period = analyticsPeriod(range);
      const [galleries, comments, visits, measurementStartedAt] = await Promise.all([
        listGalleriesByOwnerId(payload.sub),
        listExhibitCommentsByGalleryOwnerId(payload.sub),
        analyticsRepository.list(payload.sub, period.from),
        analyticsRepository.startedAt(),
      ]);
      if (req.query.galleryId && !galleries.some((g) => g.id === req.query.galleryId)) return res.status(404).json({ message: 'gallery not found' });
      res.json(buildGalleryAnalytics({ galleries, comments, visits, measurementStartedAt, period, galleryId: req.query.galleryId, toGalleryResponse }));
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.post('/api/galleries/:id/visits', visitLimiter, async (req, res) => {
    try {
      const parsed = visitSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: 'invalid visit payload' });
      const authorized = await authorizeGalleryComments(req, res);
      if (!authorized) return;
      if (authorized.access.role === 'owner' || authorized.access.role === 'editor') return res.json({ ok: true, excluded: true });
      const ids = new Set(artworkItems(authorized.gallery).map((item) => item.id));
      // A previously viewed artwork may have been removed while this session is open.
      const itemDwellSeconds = Object.fromEntries(Object.entries(parsed.data.itemDwellSeconds).filter(([id]) => ids.has(id)));
      await analyticsRepository.record({ ...parsed.data, itemDwellSeconds, galleryId: authorized.gallery.id });
      res.json({ ok: true });
    } catch (error) {
      if (error.status === 409) return res.status(409).json({ message: error.message });
      console.error(error);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.get('/api/galleries/:id', async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      const id = String(req.params.id || '').trim();
      if (!id) return res.status(400).json({ message: 'gallery id is required' });

      const row = await getGalleryById(id);
      const reviewAccess = Boolean(row && row.owner_id !== payload.sub && await hasReviewAccess(row, payload.sub));
      if (!row || (row.owner_id !== payload.sub && !reviewAccess)) {
        return res.status(404).json({ message: 'gallery not found' });
      }

      res.setHeader('Cache-Control', 'private, no-store');
      res.json({ gallery: { ...toGalleryResponse(row), ...(reviewAccess ? { reviewAccess: true, shareRole: SHARE_ROLE_VIEWER } : {}) } });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.get('/api/galleries/:id/items/:itemId/comments', async (req, res) => {
    try {
      const galleryId = String(req.params.id || '').trim();
      const itemId = String(req.params.itemId || '').trim();
      if (!galleryId || !itemId) {
        return res.status(400).json({ message: 'gallery id and item id are required' });
      }

      const authorized = await authorizeGalleryComments(req, res);
      if (!authorized) return;
      if (!galleryHasItem(authorized.gallery, itemId)) {
        return res.status(404).json({ message: 'item not found' });
      }

      const comments = await listExhibitCommentsByGalleryAndItem(galleryId, itemId);
      res.json({
        canDelete: optionalAuth(req)?.sub === authorized.gallery.owner_id,
        comments: comments.map((comment) => ({
          id: comment.id,
          galleryId: comment.gallery_id,
          itemId: comment.item_id,
          userName: comment.user_name,
          content: comment.content,
          createdAt: comment.created_at,
        })),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.post('/api/galleries/:id/items/:itemId/comments', commentLimiter, async (req, res) => {
    try {
      const galleryId = String(req.params.id || '').trim();
      const itemId = String(req.params.itemId || '').trim();
      if (!galleryId || !itemId) {
        return res.status(400).json({ message: 'gallery id and item id are required' });
      }

      const authorized = await authorizeGalleryComments(req, res);
      if (!authorized) return;
      if (!galleryHasItem(authorized.gallery, itemId)) {
        return res.status(404).json({ message: 'item not found' });
      }

      const parsed = galleryReviewSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'invalid payload' });
      }

      const comment = {
        id: randomUUID(),
        galleryId,
        itemId,
        userName: parsed.data.userName,
        content: parsed.data.content,
        createdAt: new Date().toISOString(),
      };

      await insertExhibitComment(comment);

      res.status(201).json({
        comment: {
          id: comment.id,
          galleryId: comment.galleryId,
          itemId: comment.itemId,
          userName: comment.userName,
          content: comment.content,
          createdAt: comment.createdAt,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.delete('/api/galleries/:id/items/:itemId/comments/:commentId', async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      const galleryId = String(req.params.id || '').trim();
      const itemId = String(req.params.itemId || '').trim();
      const commentId = String(req.params.commentId || '').trim();
      if (!galleryId || !itemId || !commentId) {
        return res.status(400).json({ message: 'gallery id, item id and comment id are required' });
      }

      const gallery = await getGalleryById(galleryId);
      if (!gallery) {
        return res.status(404).json({ message: 'gallery not found' });
      }
      if (gallery.owner_id !== payload.sub) {
        return res.status(403).json({ message: 'only the gallery owner can delete comments' });
      }

      const comment = await getExhibitCommentById(commentId);
      if (!comment || comment.gallery_id !== galleryId || comment.item_id !== itemId) {
        return res.status(404).json({ message: 'comment not found' });
      }

      const deleted = await deleteExhibitCommentById(commentId);
      if (!deleted) {
        return res.status(404).json({ message: 'comment not found' });
      }

      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.patch('/api/galleries/:id', async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      const id = String(req.params.id || '').trim();
      if (!id) return res.status(400).json({ message: 'gallery id is required' });

      const parsed = galleryUpdateSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'invalid payload' });
      }

      const body = parsed.data;
      const hasAnyField =
        typeof body.title === 'string' ||
        typeof body.description === 'string' ||
        typeof body.templateTitle === 'string' ||
        typeof body.templateImage === 'string' ||
        typeof body.category === 'string' ||
        Object.prototype.hasOwnProperty.call(body, 'sceneJson');

      if (!hasAnyField) {
        return res.status(400).json({ message: 'no updatable fields provided' });
      }
      if (rejectNonPersistentScene(res, body.sceneJson)) return;

      if (body.expectedRevision === undefined) return res.status(428).json({ code: 'GALLERY_REVISION_REQUIRED', message: 'Reload the exhibition before saving.' });

      const ownedGallery = await getGalleryById(id);
      if (!ownedGallery || ownedGallery.owner_id !== payload.sub) return res.status(404).json({ message: 'gallery not found' });

      const changed = await saveGalleryUpdates(id, payload.sub, {
        expectedRevision: body.expectedRevision,
        title: body.title,
        description: body.description,
        templateTitle: body.templateTitle,
        templateImage: body.templateImage,
        category: body.category,
        sceneJson: body.sceneJson === null ? null : body.sceneJson,
      });

      if (!changed) {
        return res.status(404).json({ message: 'gallery not found' });
      }

      const row = await getGalleryById(id);
      if (!row || row.owner_id !== payload.sub) {
        return res.status(404).json({ message: 'gallery not found' });
      }

      res.json({ gallery: { ...toGalleryResponse(row), revision: body.expectedRevision + 1 } });
    } catch (err) {
      if (err.status >= 400 && err.status < 500) {
        return res.status(err.status).json({ code: err.code, message: err.message });
      }
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.post('/api/galleries/:id/publish', async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      const id = String(req.params.id || '').trim();
      if (!id) return res.status(400).json({ message: 'gallery id is required' });

      const row = await getGalleryById(id);
      if (!row || row.owner_id !== payload.sub) {
        return res.status(404).json({ message: 'gallery not found' });
      }
      if (rejectNonPersistentScene(res, row.scene_json)) return;

      const quickGallery = await publishQuickExhibition?.(id, payload.sub);
      if (quickGallery) return res.json({ gallery: toGalleryResponse(quickGallery) });

      const publishedAt = row.published_at || new Date().toISOString();
      const changed = await updateGalleryPublishById(id, payload.sub, {
        isPublished: true,
        publishedAt,
      });

      if (!changed) {
        return res.status(404).json({ message: 'gallery not found' });
      }

      const updated = await getGalleryById(id);
      if (!updated) {
        return res.status(404).json({ message: 'gallery not found' });
      }

      res.json({ gallery: toGalleryResponse(updated) });    } catch (err) {
      if (err.status >= 400 && err.status < 500) {
        return res.status(err.status).json({ code: err.code, message: err.message });
      }
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.delete('/api/galleries/:id/publish', async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      const id = String(req.params.id || '').trim();
      if (!id) return res.status(400).json({ message: 'gallery id is required' });

      const changed = await updateGalleryPublishById(id, payload.sub, {
        isPublished: false,
        publishedAt: null,
      });

      if (!changed) {
        return res.status(404).json({ message: 'gallery not found' });
      }

      const updated = await getGalleryById(id);
      if (!updated) {
        return res.status(404).json({ message: 'gallery not found' });
      }

      res.json({ gallery: toGalleryResponse(updated) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.post('/api/galleries/:id/share-link', async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      const id = String(req.params.id || '').trim();
      if (!id) return res.status(400).json({ message: 'gallery id is required' });

      const parsed = shareLinkCreateSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'invalid payload' });
      }

      const role = parsed.data.role;
      const ownedGallery = await getGalleryById(id);
      if (!ownedGallery || ownedGallery.owner_id !== payload.sub) return res.status(404).json({ message: 'gallery not found' });
      const expiresAt = typeof parsed.data.expiresInHours === 'number'
        ? new Date(Date.now() + parsed.data.expiresInHours * 60 * 60 * 1000).toISOString()
        : null;

      const shareToken = randomUUID();
      const changed = await updateGalleryShareById(id, payload.sub, {
        shareToken,
        shareRole: role,
        shareExpiresAt: expiresAt,
      });

      if (!changed) {
        return res.status(404).json({ message: 'gallery not found' });
      }

      const frontendOrigin = String(process.env.FRONTEND_ORIGIN || 'http://localhost:5173').trim().replace(/\/$/, '');
      const shareUrl = `${frontendOrigin}/virtual-gallery/share/${encodeURIComponent(shareToken)}`;

      res.json({
        share: {
          url: shareUrl,
          token: shareToken,
          role,
          expiresAt,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.delete('/api/galleries/:id/share-link', async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      const id = String(req.params.id || '').trim();
      if (!id) return res.status(400).json({ message: 'gallery id is required' });

      const changed = await updateGalleryShareById(id, payload.sub, {
        shareToken: null,
        shareRole: SHARE_ROLE_VIEWER,
        shareExpiresAt: null,
      });

      if (!changed) {
        return res.status(404).json({ message: 'gallery not found' });
      }

      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  const readSharedGallery = async (req, res) => {
    try {
      const token = String(
        req.header('x-gallery-share-token') || req.params.token || '',
      ).trim();
      if (!token) return res.status(404).json({ message: 'share link not found' });

      const row = await getGalleryByShareToken(token);
      if (!row) return res.status(404).json({ message: 'share link not found' });
      if (isShareExpired(row.share_expires_at)) {
        return res.status(410).json({ message: 'share link expired' });
      }

      res.json({
        gallery: toGalleryResponse(row),
        access: {
          viaShare: true,
          role: row.share_role || SHARE_ROLE_VIEWER,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  };

  const updateSharedGallery = async (req, res) => {
    try {
      const token = String(
        req.header('x-gallery-share-token') || req.params.token || '',
      ).trim();
      if (!token) return res.status(404).json({ message: 'share link not found' });

      const row = await getGalleryByShareToken(token);
      if (!row) return res.status(404).json({ message: 'share link not found' });
      if (isShareExpired(row.share_expires_at)) {
        return res.status(410).json({ message: 'share link expired' });
      }
      if ((row.share_role || SHARE_ROLE_VIEWER) !== SHARE_ROLE_EDITOR) {
        return res.status(403).json({ message: 'share link does not allow editing' });
      }

      const parsed = galleryUpdateSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'invalid payload' });
      }

      const body = parsed.data;
      const hasAnyField =
        typeof body.title === 'string' ||
        typeof body.description === 'string' ||
        typeof body.templateTitle === 'string' ||
        typeof body.templateImage === 'string' ||
        typeof body.category === 'string' ||
        Object.prototype.hasOwnProperty.call(body, 'sceneJson');

      if (!hasAnyField) {
        return res.status(400).json({ message: 'no updatable fields provided' });
      }
      if (rejectNonPersistentScene(res, body.sceneJson)) return;

      if (body.expectedRevision === undefined) return res.status(428).json({ code: 'GALLERY_REVISION_REQUIRED', message: 'Reload the exhibition before saving.' });

      const changed = await saveGalleryUpdates(row.id, row.owner_id, {
        expectedRevision: body.expectedRevision,
        title: body.title,
        description: body.description,
        templateTitle: body.templateTitle,
        templateImage: body.templateImage,
        category: body.category,
        sceneJson: body.sceneJson === null ? null : body.sceneJson,
      });

      if (!changed) {
        return res.status(404).json({ message: 'gallery not found' });
      }

      const updated = await getGalleryById(row.id);
      if (!updated) return res.status(404).json({ message: 'gallery not found' });

      res.json({ gallery: { ...toGalleryResponse(updated), revision: body.expectedRevision + 1 } });
    } catch (err) {
      if (err.status >= 400 && err.status < 500) {
        return res.status(err.status).json({ code: err.code, message: err.message });
      }
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  };

  app.get('/api/share/galleries', readSharedGallery);
  app.patch('/api/share/galleries', updateSharedGallery);
  app.get('/api/share/galleries/:token', readSharedGallery);
  app.patch('/api/share/galleries/:token', updateSharedGallery);

  app.delete('/api/galleries/:id', async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      const id = String(req.params.id || '').trim();
      if (!id) return res.status(400).json({ message: 'gallery id is required' });

      const changed = await deleteGalleryById(id, payload.sub);
      if (!changed) {
        return res.status(404).json({ message: 'gallery not found' });
      }

      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });
}
