import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { assertPersistentScenePayload } from '../services/exhibitionSceneService.js';

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

const uploadLinkCreateSchema = z.object({
  itemId: z.string().trim().min(1, 'itemId is required'),
  canEditMetadata: z.boolean().optional().default(false),
  expiresInHours: z.coerce.number().int().positive().max(24 * 365).optional(),
});

const uploadLinkUpdateSchema = z.object({
  title: z.string().trim().optional(),
  artist: z.string().trim().optional(),
  description: z.string().trim().optional(),
  externalUrl: z.string().trim().optional(),
  content: z.string().optional(),
  fileName: z.string().trim().optional(),
  fileMimeType: z.string().trim().optional(),
  videoThumbnailUrl: z.string().optional(),
});

const competitionPublishSchema = z.object({
  competitionId: z.string().trim().min(1, 'competitionId is required'),
  statement: z.string().trim().min(1, 'statement is required').max(5000, 'statement too long'),
  assets: z.array(z.object({
    name: z.string().trim().min(1, 'asset name is required').max(255, 'asset name too long'),
    url: z.string().trim().min(1, 'asset url is required').max(2_000_000, 'asset url too long'),
  })).max(10, 'too many assets').optional(),
}).optional();

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
    getPublishedGalleryById,
    updateGalleryById,
    deleteGalleryById,
    deleteCompetitionsByHostGalleryId,
    updateGalleryShareById,
    updateGalleryPublishById,
    getGalleryByShareToken,
    insertGalleryUploadLink,
    getGalleryUploadLinkByToken,
    revokeGalleryUploadLink,
    insertExhibitComment,
    listExhibitCommentsByGalleryAndItem,
    listExhibitCommentsByGalleryOwnerId,
    getExhibitCommentById,
    deleteExhibitCommentById,
    listVisitorMemoriesByGalleryOwnerId,
  } = deps;

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
    shareRole: row.share_role || SHARE_ROLE_VIEWER,
    shareExpiresAt: row.share_expires_at || null,
    isPublished: Boolean(row.is_published),
    publishedAt: row.published_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  const parseJsonValue = (value, fallback) => {
    if (typeof value !== 'string' || !value.trim()) return fallback;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  };

  const getSceneItems = (gallery) => {
    const scene = parseJsonValue(gallery?.scene_json, null);
    return Array.isArray(scene?.items) ? scene.items : [];
  };

  const toAdminAnalytics = ({ galleries, comments, memories }) => {
    const galleryStats = new Map();
    const itemStats = new Map();
    let totalDwellSeconds = 0;

    galleries.forEach((gallery) => {
      const items = getSceneItems(gallery);
      const galleryId = gallery.id;
      galleryStats.set(galleryId, {
        gallery,
        itemCount: items.length,
        commentCount: 0,
        visitorIds: new Set(),
        engagedIds: new Set(),
        dwellSeconds: 0,
        latestActivityAt: gallery.updated_at,
      });

      items.forEach((item) => {
        const itemId = String(item?.id || '').trim();
        if (!itemId) return;
        itemStats.set(`${galleryId}:${itemId}`, {
          galleryId,
          galleryTitle: gallery.title,
          itemId,
          title: String(item?.title || item?.name || itemId),
          artist: typeof item?.artist === 'string' ? item.artist : null,
          type: String(item?.type || 'item'),
          commentCount: 0,
          visitorIds: new Set(),
          engagedIds: new Set(),
          dwellSeconds: 0,
          latestActivityAt: gallery.updated_at,
        });
      });
    });

    comments.forEach((comment) => {
      const stat = galleryStats.get(comment.gallery_id);
      if (!stat) return;
      stat.commentCount += 1;
      stat.latestActivityAt = [stat.latestActivityAt, comment.created_at].filter(Boolean).sort().at(-1) || stat.latestActivityAt;

      const key = `${comment.gallery_id}:${comment.item_id}`;
      const itemStat = itemStats.get(key) || {
        galleryId: comment.gallery_id,
        galleryTitle: comment.gallery_title || stat.gallery.title,
        itemId: comment.item_id,
        title: comment.item_id,
        artist: null,
        type: 'item',
        commentCount: 0,
        visitorIds: new Set(),
        engagedIds: new Set(),
        dwellSeconds: 0,
        latestActivityAt: comment.created_at,
      };
      itemStat.commentCount += 1;
      itemStat.latestActivityAt = [itemStat.latestActivityAt, comment.created_at].filter(Boolean).sort().at(-1) || itemStat.latestActivityAt;
      itemStats.set(key, itemStat);
    });

    memories.forEach((memory) => {
      const stat = galleryStats.get(memory.gallery_id);
      if (!stat) return;
      const visitorId = memory.user_id || memory.id;
      stat.visitorIds.add(visitorId);
      stat.latestActivityAt = [stat.latestActivityAt, memory.updated_at].filter(Boolean).sort().at(-1) || stat.latestActivityAt;

      const visited = parseJsonValue(memory.visited_exhibit_ids_json, []);
      const engaged = parseJsonValue(memory.engaged_exhibit_ids_json, []);
      const dwellByItem = parseJsonValue(memory.dwell_seconds_json, {});

      if (Array.isArray(engaged) && engaged.length > 0) {
        stat.engagedIds.add(visitorId);
      }

      Object.entries(dwellByItem && typeof dwellByItem === 'object' ? dwellByItem : {}).forEach(([itemId, rawSeconds]) => {
        const seconds = Math.max(0, Number(rawSeconds) || 0);
        stat.dwellSeconds += seconds;
        totalDwellSeconds += seconds;
        const key = `${memory.gallery_id}:${itemId}`;
        const itemStat = itemStats.get(key);
        if (itemStat) {
          itemStat.dwellSeconds += seconds;
          itemStat.visitorIds.add(visitorId);
          itemStat.latestActivityAt = [itemStat.latestActivityAt, memory.updated_at].filter(Boolean).sort().at(-1) || itemStat.latestActivityAt;
        }
      });

      visited.forEach((itemId) => {
        const itemStat = itemStats.get(`${memory.gallery_id}:${itemId}`);
        if (itemStat) itemStat.visitorIds.add(visitorId);
      });

      engaged.forEach((itemId) => {
        const itemStat = itemStats.get(`${memory.gallery_id}:${itemId}`);
        if (itemStat) itemStat.engagedIds.add(visitorId);
      });
    });

    const galleriesResponse = [...galleryStats.values()].map((stat) => {
      const visitorCount = stat.visitorIds.size;
      const engagedCount = stat.engagedIds.size;
      const popularityScore = stat.commentCount * 4 + visitorCount * 3 + engagedCount * 2 + Math.min(stat.dwellSeconds / 60, 50);
      return {
        ...toGalleryResponse(stat.gallery),
        itemCount: stat.itemCount,
        commentCount: stat.commentCount,
        visitorCount,
        engagedCount,
        totalDwellSeconds: Math.round(stat.dwellSeconds),
        popularityScore: Math.round(popularityScore * 10) / 10,
        latestActivityAt: stat.latestActivityAt,
      };
    }).sort((a, b) => b.popularityScore - a.popularityScore || new Date(b.latestActivityAt).getTime() - new Date(a.latestActivityAt).getTime());

    const itemsResponse = [...itemStats.values()].map((stat) => {
      const visitorCount = stat.visitorIds.size;
      const engagedCount = stat.engagedIds.size;
      const popularityScore = stat.commentCount * 4 + visitorCount * 3 + engagedCount * 2 + Math.min(stat.dwellSeconds / 60, 25);
      return {
        galleryId: stat.galleryId,
        galleryTitle: stat.galleryTitle,
        itemId: stat.itemId,
        title: stat.title,
        artist: stat.artist,
        type: stat.type,
        commentCount: stat.commentCount,
        visitorCount,
        engagedCount,
        dwellSeconds: Math.round(stat.dwellSeconds),
        popularityScore: Math.round(popularityScore * 10) / 10,
        latestActivityAt: stat.latestActivityAt,
      };
    }).sort((a, b) => b.popularityScore - a.popularityScore || b.commentCount - a.commentCount).slice(0, 30);

    const commentsResponse = comments.slice(0, 100).map((comment) => {
      const item = itemStats.get(`${comment.gallery_id}:${comment.item_id}`);
      return {
        id: comment.id,
        galleryId: comment.gallery_id,
        galleryTitle: comment.gallery_title || item?.galleryTitle || '',
        itemId: comment.item_id,
        itemTitle: item?.title || comment.item_id,
        userName: comment.user_name,
        content: comment.content,
        createdAt: comment.created_at,
      };
    });

    return {
      summary: {
        totalGalleries: galleries.length,
        publishedGalleries: galleries.filter((gallery) => Boolean(gallery.is_published)).length,
        totalItems: galleriesResponse.reduce((sum, gallery) => sum + gallery.itemCount, 0),
        totalComments: comments.length,
        totalVisitors: new Set(memories.map((memory) => memory.user_id)).size,
        totalDwellSeconds: Math.round(totalDwellSeconds),
        topGallery: galleriesResponse[0] || null,
      },
      galleries: galleriesResponse,
      items: itemsResponse,
      comments: commentsResponse,
    };
  };

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
      const galleries = rows.map((r) => toGalleryResponse(r));
      res.json({ galleries });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.get('/api/galleries/published', async (_req, res) => {
    try {
      const rows = await listPublishedGalleries();
      const galleries = rows.map((r) => toGalleryResponse(r));
      res.json({ galleries });
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
      const [galleries, comments, memories] = await Promise.all([
        listGalleriesByOwnerId(payload.sub),
        listExhibitCommentsByGalleryOwnerId(payload.sub),
        listVisitorMemoriesByGalleryOwnerId(payload.sub),
      ]);

      res.json(toAdminAnalytics({ galleries, comments, memories }));
    } catch (err) {
      console.error(err);
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
      if (!row || row.owner_id !== payload.sub) {
        return res.status(404).json({ message: 'gallery not found' });
      }

      res.json({ gallery: toGalleryResponse(row) });
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

      const changed = await updateGalleryById(id, payload.sub, {
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

      res.json({ gallery: toGalleryResponse(row) });
    } catch (err) {
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

      const parsedCompetition = competitionPublishSchema.safeParse(req.body?.competitionEntry);
      if (!parsedCompetition.success) {
        return res.status(400).json({ message: parsedCompetition.error.issues[0]?.message ?? 'invalid competition entry' });
      }

      const row = await getGalleryById(id);
      if (!row || row.owner_id !== payload.sub) {
        return res.status(404).json({ message: 'gallery not found' });
      }
      if (rejectNonPersistentScene(res, row.scene_json)) return;

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

  app.post('/api/galleries/:id/upload-link', async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      const id = String(req.params.id || '').trim();
      if (!id) return res.status(400).json({ message: 'gallery id is required' });

      const parsed = uploadLinkCreateSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'invalid payload' });
      }

      const gallery = await getGalleryById(id);
      if (!gallery || gallery.owner_id !== payload.sub) {
        return res.status(404).json({ message: 'gallery not found' });
      }

      const scene = gallery.scene_json ? JSON.parse(gallery.scene_json) : null;
      const itemExists = Boolean(scene?.items?.some((item) => item?.id === parsed.data.itemId));
      if (!itemExists) {
        return res.status(404).json({ message: 'item not found in gallery' });
      }

      const uploadToken = randomUUID();
      const now = new Date().toISOString();
      const expiresAt = typeof parsed.data.expiresInHours === 'number'
        ? new Date(Date.now() + parsed.data.expiresInHours * 60 * 60 * 1000).toISOString()
        : null;

      await insertGalleryUploadLink({
        id: randomUUID(),
        galleryId: id,
        itemId: parsed.data.itemId,
        uploadToken,
        canEditMetadata: Boolean(parsed.data.canEditMetadata),
        expiresAt,
        revokedAt: null,
        createdBy: payload.sub,
        createdAt: now,
        updatedAt: now,
      });

      const frontendOrigin = String(process.env.FRONTEND_ORIGIN || 'http://localhost:5173').trim().replace(/\/$/, '');
      const url = `${frontendOrigin}/virtual-gallery/upload?token=${encodeURIComponent(uploadToken)}`;

      res.status(201).json({
        uploadLink: {
          url,
          token: uploadToken,
          galleryId: id,
          itemId: parsed.data.itemId,
          canEditMetadata: Boolean(parsed.data.canEditMetadata),
          expiresAt,
        },
      });
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

  app.get('/api/upload-links/:token', async (req, res) => {
    try {
      const token = String(req.params.token || '').trim();
      if (!token) return res.status(400).json({ message: 'upload token is required' });

      const link = await getGalleryUploadLinkByToken(token);
      if (!link) return res.status(404).json({ message: 'upload link not found' });
      if (link.revoked_at) return res.status(410).json({ message: 'upload link revoked' });
      if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) {
        return res.status(410).json({ message: 'upload link expired' });
      }

      const gallery = await getGalleryById(link.gallery_id);
      if (!gallery) return res.status(404).json({ message: 'gallery not found' });
      const scene = gallery.scene_json ? JSON.parse(gallery.scene_json) : null;
      const item = scene?.items?.find((it) => it?.id === link.item_id) || null;

      res.json({
        uploadLink: {
          token: link.upload_token,
          galleryId: link.gallery_id,
          itemId: link.item_id,
          canEditMetadata: Boolean(link.can_edit_metadata),
          expiresAt: link.expires_at,
        },
        gallery: toGalleryResponse(gallery),
        item,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.patch('/api/upload-links/:token', async (req, res) => {
    try {
      const token = String(req.params.token || '').trim();
      if (!token) return res.status(400).json({ message: 'upload token is required' });

      const link = await getGalleryUploadLinkByToken(token);
      if (!link) return res.status(404).json({ message: 'upload link not found' });
      if (link.revoked_at) return res.status(410).json({ message: 'upload link revoked' });
      if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) {
        return res.status(410).json({ message: 'upload link expired' });
      }

      const parsed = uploadLinkUpdateSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'invalid payload' });
      }

      const gallery = await getGalleryById(link.gallery_id);
      if (!gallery) return res.status(404).json({ message: 'gallery not found' });
      const scene = gallery.scene_json ? JSON.parse(gallery.scene_json) : null;
      const items = Array.isArray(scene?.items) ? scene.items : [];
      const itemIndex = items.findIndex((it) => it?.id === link.item_id);
      if (itemIndex < 0) return res.status(404).json({ message: 'item not found' });

      const currentItem = items[itemIndex] || {};
      const nextItem = {
        ...currentItem,
        ...(typeof parsed.data.title === 'string' ? { title: parsed.data.title } : {}),
        ...(typeof parsed.data.artist === 'string' ? { artist: parsed.data.artist } : {}),
        ...(typeof parsed.data.description === 'string' ? { description: parsed.data.description } : {}),
        ...(typeof parsed.data.externalUrl === 'string' ? { externalUrl: parsed.data.externalUrl } : {}),
        ...(typeof parsed.data.content === 'string' ? { content: parsed.data.content } : {}),
        ...(typeof parsed.data.fileName === 'string' ? { fileName: parsed.data.fileName } : {}),
        ...(typeof parsed.data.fileMimeType === 'string' ? { fileMimeType: parsed.data.fileMimeType } : {}),
        ...(typeof parsed.data.videoThumbnailUrl === 'string' ? { videoThumbnailUrl: parsed.data.videoThumbnailUrl } : {}),
      };

      items[itemIndex] = nextItem;
      const nextScene = { ...scene, items };
      if (rejectNonPersistentScene(res, nextScene)) return;
      const changed = await updateGalleryById(link.gallery_id, gallery.owner_id, { sceneJson: JSON.stringify(nextScene) });
      if (!changed) return res.status(404).json({ message: 'gallery not found' });

      const updated = await getGalleryById(link.gallery_id);
      res.json({
        gallery: updated ? toGalleryResponse(updated) : null,
        item: nextItem,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.delete('/api/upload-links/:token', async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      const token = String(req.params.token || '').trim();
      if (!token) return res.status(400).json({ message: 'upload token is required' });

      const deleted = await revokeGalleryUploadLink(token, payload.sub);
      if (!deleted) return res.status(404).json({ message: 'upload link not found' });
      res.json({ ok: true });
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

      const changed = await updateGalleryById(row.id, row.owner_id, {
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

      res.json({ gallery: toGalleryResponse(updated) });
    } catch (err) {
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

      await deleteCompetitionsByHostGalleryId(id);

      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });
}
