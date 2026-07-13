import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { decodeGrowthUpload, isPrivateGrowthAssetUrl } from '../services/growthAssetService.js';

const SHARE_ROLE_VIEWER = 'viewer';
const SHARE_ROLE_EDITOR = 'editor';
const noRateLimit = (_req, _res, next) => next();

const childCreateSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(60, 'name too long'),
  birthday: z.string().trim().min(1, 'birthday is required').max(30, 'birthday too long'),
  avatarUrl: z.string().trim().max(2_000_000, 'avatarUrl too long').optional(),
});

const exhibitCreateSchema = z.object({
  childId: z.string().trim().min(1, 'childId is required'),
  title: z.string().trim().min(1, 'title is required').max(120, 'title too long'),
  templateId: z.string().trim().min(1, 'templateId is required').max(80, 'templateId too long'),
  introStory: z.string().trim().min(1, 'introStory is required').max(2000, 'introStory too long'),
  isPrivate: z.boolean().optional(),
});

const assetCreateSchema = z.object({
  exhibitId: z.string().trim().min(1, 'exhibitId is required'),
  type: z.enum(['photo', 'video', 'audio', 'text']),
  title: z.string().trim().min(1, 'title is required').max(120, 'title too long'),
  contentUrl: z.string().trim().max(2_000, 'contentUrl too long').url('contentUrl must be a valid URL').refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === 'https:' || protocol === 'http:';
  }, 'contentUrl must use http or https').optional(),
  note: z.string().trim().max(2000, 'note too long').optional(),
  capturedAt: z.string().trim().max(40, 'capturedAt too long').optional(),
});

const commentCreateSchema = z.object({
  exhibitId: z.string().trim().min(1, 'exhibitId is required'),
  userName: z.string().trim().min(1, 'userName is required').max(80, 'userName too long'),
  content: z.string().trim().min(1, 'content is required').max(1000, 'content too long'),
});

const shareLinkCreateSchema = z.object({
  role: z.enum([SHARE_ROLE_VIEWER, SHARE_ROLE_EDITOR]).default(SHARE_ROLE_VIEWER),
  expiresInHours: z.coerce.number().int().positive().max(24 * 365).optional(),
});

const uploadAssetSchema = z.object({
  exhibitId: z.string().trim().min(1, 'exhibitId is required'),
  title: z.string().trim().min(1, 'title is required').max(120, 'title too long'),
  note: z.string().trim().max(2000, 'note too long').optional(),
  capturedAt: z.string().trim().max(40, 'capturedAt too long').optional(),
  fileName: z.string().trim().min(1, 'fileName is required').max(255, 'fileName too long'),
  mimeType: z.string().trim().min(1, 'mimeType is required').max(120, 'mimeType too long'),
  dataBase64: z.string().trim().min(1, 'dataBase64 is required').max(20_000_000, 'file too large'),
});

export function registerGrowthRoutes(app, deps) {
  const {
    requireAuth,
    commentLimiter = noRateLimit,
    uploadLimiter = noRateLimit,
    getUserById,
    insertGrowthChild,
    listGrowthChildrenByOwnerId,
    getGrowthChildById,
    insertGrowthExhibit,
    listGrowthExhibitsByOwnerId,
    listAllGrowthExhibitsByOwnerId,
    getGrowthExhibitById,
    updateGrowthExhibitShareById,
    getGrowthExhibitByShareToken,
    insertGrowthAsset,
    getGrowthAssetById,
    listGrowthAssetsByExhibitId,
    signGrowthAssetToken,
    verifyGrowthAssetToken,
    saveGrowthAssetFile,
    readGrowthAssetFile,
    insertGrowthComment,
    listGrowthCommentsByExhibitId,
  } = deps;

  const serializeGrowthAsset = (asset) => {
    const contentUrl = asset.content_url && isPrivateGrowthAssetUrl(asset.content_url)
      ? `/api/growth/assets/${encodeURIComponent(asset.id)}/content?access=${encodeURIComponent(signGrowthAssetToken(asset.id))}`
      : asset.content_url;

    return {
      id: asset.id,
      ownerId: asset.owner_id,
      exhibitId: asset.exhibit_id,
      type: asset.type,
      title: asset.title,
      contentUrl,
      note: asset.note,
      capturedAt: asset.captured_at,
      createdAt: asset.created_at,
    };
  };

  app.post('/api/growth/children', async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      const owner = await getUserById(payload.sub);
      if (!owner) return res.status(401).json({ message: 'user not found, please login again' });

      const parsed = childCreateSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'invalid payload' });
      }

      const now = new Date().toISOString();
      const child = {
        id: randomUUID(),
        ownerId: payload.sub,
        name: parsed.data.name,
        birthday: parsed.data.birthday,
        avatarUrl: parsed.data.avatarUrl ?? null,
        createdAt: now,
        updatedAt: now,
      };

      await insertGrowthChild(child);
      res.status(201).json({ child });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.get('/api/growth/children/mine', async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      const rows = await listGrowthChildrenByOwnerId(payload.sub);
      const children = rows.map((row) => ({
        id: row.id,
        ownerId: row.owner_id,
        name: row.name,
        birthday: row.birthday,
        avatarUrl: row.avatar_url,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      res.json({ children });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.post('/api/growth/exhibits', async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      const owner = await getUserById(payload.sub);
      if (!owner) return res.status(401).json({ message: 'user not found, please login again' });

      const parsed = exhibitCreateSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'invalid payload' });
      }

      const child = await getGrowthChildById(parsed.data.childId);
      if (!child || child.owner_id !== payload.sub) {
        return res.status(404).json({ message: 'child not found' });
      }

      const now = new Date().toISOString();
      const exhibit = {
        id: randomUUID(),
        ownerId: payload.sub,
        childId: parsed.data.childId,
        title: parsed.data.title,
        templateId: parsed.data.templateId,
        introStory: parsed.data.introStory,
        isPrivate: parsed.data.isPrivate ?? true,
        createdAt: now,
        updatedAt: now,
      };

      await insertGrowthExhibit(exhibit);
      res.status(201).json({ exhibit });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.get('/api/growth/exhibits/mine', async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      const rows = await listGrowthExhibitsByOwnerId(payload.sub);
      const exhibits = rows.map((row) => ({
        id: row.id,
        ownerId: row.owner_id,
        childId: row.child_id,
        title: row.title,
        templateId: row.template_id,
        introStory: row.intro_story,
        isPrivate: Boolean(row.is_private),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        child: {
          name: row.child_name,
          birthday: row.child_birthday,
        },
      }));

      res.json({ exhibits });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.get('/api/growth/recommendations/mine', async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      const mode = String(req.query.mode || 'explore').trim();
      const interest = String(req.query.interest || 'story').trim();
      const depth = String(req.query.depth || 'balanced').trim();
      const rows = await listAllGrowthExhibitsByOwnerId(payload.sub);

      const exhibits = rows.map((row) => {
        const assetCount = Number(row.asset_count || 0);
        const commentCount = Number(row.comment_count || 0);
        const latestActivityAt = row.latest_activity_at || row.updated_at || row.created_at;
        const recencyBonus = row.latest_activity_at ? 8 : 0;
        const activityScore = assetCount * 3 + commentCount * 4 + recencyBonus;
        const route = `/growth-memories/3d/${row.id}`;
        const totalDays = Math.max(1, Math.ceil((Date.now() - new Date(row.child_birthday).getTime()) / (1000 * 60 * 60 * 24)));
        const ageScore = totalDays < 365 ? 3 : totalDays < 365 * 6 ? 2 : 1;

        const preferenceScore = [mode, interest, depth].reduce((sum, item) => {
          if (item === 'story' && row.intro_story) return sum + 3;
          if (item === 'media' && assetCount > 0) return sum + 3;
          if (item === 'social' && commentCount > 0) return sum + 3;
          if (item === 'fast' && assetCount > 0) return sum + 2;
          if (item === 'deep' && commentCount > 1) return sum + 2;
          return sum;
        }, 0);

        const score = activityScore + ageScore + preferenceScore;
        const routeType = assetCount >= 5 ? '完整回顧路線' : commentCount >= 3 ? '互動回饋路線' : '快速成長路線';
        const highlight =
          assetCount === 0
            ? '先補上第一批照片或影片，讓這條路線更有故事感。'
            : commentCount === 0
              ? '加入親友留言後，推薦路線會更像一條被回應過的回憶路徑。'
              : '這是一條互動與素材都很完整的成長路線。';

        return {
          exhibitId: row.id,
          route,
          score,
          reason: highlight,
          childName: row.child_name,
          title: row.title,
          introStory: row.intro_story,
          templateId: row.template_id,
          childBirthday: row.child_birthday,
          assetCount,
          commentCount,
          latestActivityAt,
          routeType,
        };
      }).sort((a, b) => b.score - a.score || String(b.latestActivityAt || '').localeCompare(String(a.latestActivityAt || '')));

      const route = exhibits[0] || null;
      res.json({ route, routes: exhibits, preferences: { mode, interest, depth } });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.post('/api/growth/assets', async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      const owner = await getUserById(payload.sub);
      if (!owner) return res.status(401).json({ message: 'user not found, please login again' });

      const parsed = assetCreateSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'invalid payload' });
      }

      const exhibit = await getGrowthExhibitById(parsed.data.exhibitId);
      if (!exhibit || exhibit.owner_id !== payload.sub) {
        return res.status(404).json({ message: 'exhibit not found' });
      }

      const now = new Date().toISOString();
      const asset = {
        id: randomUUID(),
        ownerId: payload.sub,
        exhibitId: parsed.data.exhibitId,
        type: parsed.data.type,
        title: parsed.data.title,
        contentUrl: parsed.data.contentUrl ?? null,
        note: parsed.data.note ?? null,
        capturedAt: parsed.data.capturedAt ?? null,
        createdAt: now,
      };

      await insertGrowthAsset(asset);
      res.status(201).json({ asset });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.get('/api/growth/assets/:assetId/content', async (req, res) => {
    try {
      const assetId = String(req.params.assetId || '').trim();
      const accessToken = String(req.query.access || '').trim();
      if (!verifyGrowthAssetToken(accessToken, assetId)) {
        return res.status(404).json({ message: 'asset not found' });
      }

      const asset = await getGrowthAssetById(assetId);
      if (!asset || !isPrivateGrowthAssetUrl(asset.content_url)) {
        return res.status(404).json({ message: 'asset not found' });
      }

      const file = await readGrowthAssetFile(asset.content_url);
      res.set('Content-Type', file.mimeType);
      res.set('X-Content-Type-Options', 'nosniff');
      res.set('Cache-Control', 'private, max-age=300');
      return res.send(file.buffer);
    } catch (err) {
      console.error(err);
      return res.status(404).json({ message: 'asset not found' });
    }
  });

  app.get('/api/growth/exhibits/:id/assets', async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      const exhibitId = String(req.params.id || '').trim();
      if (!exhibitId) return res.status(400).json({ message: 'exhibit id is required' });

      const exhibit = await getGrowthExhibitById(exhibitId);
      if (!exhibit || exhibit.owner_id !== payload.sub) {
        return res.status(404).json({ message: 'exhibit not found' });
      }

      const rows = await listGrowthAssetsByExhibitId(exhibitId);
      const assets = rows.map(serializeGrowthAsset);

      res.json({ assets });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.post('/api/growth/assets/upload', uploadLimiter, async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      const owner = await getUserById(payload.sub);
      if (!owner) return res.status(401).json({ message: 'user not found, please login again' });

      const parsed = uploadAssetSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'invalid payload' });
      }

      const exhibit = await getGrowthExhibitById(parsed.data.exhibitId);
      if (!exhibit || exhibit.owner_id !== payload.sub) {
        return res.status(404).json({ message: 'exhibit not found' });
      }

      let upload;
      try {
        upload = decodeGrowthUpload({
          claimedMimeType: parsed.data.mimeType,
          dataBase64: parsed.data.dataBase64,
        });
      } catch (error) {
        return res.status(400).json({
          message: error instanceof Error ? error.message : 'invalid file',
        });
      }

      const relativePath = await saveGrowthAssetFile(upload.buffer, upload.extension);

      const now = new Date().toISOString();
      const asset = {
        id: randomUUID(),
        ownerId: payload.sub,
        exhibitId: parsed.data.exhibitId,
        type: upload.type,
        title: parsed.data.title,
        contentUrl: relativePath,
        note: parsed.data.note ?? null,
        capturedAt: parsed.data.capturedAt ?? null,
        createdAt: now,
      };

      await insertGrowthAsset(asset);
      res.status(201).json({
        asset: {
          ...asset,
          contentUrl: `/api/growth/assets/${encodeURIComponent(asset.id)}/content?access=${encodeURIComponent(signGrowthAssetToken(asset.id))}`,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.post('/api/growth/comments', commentLimiter, async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      const owner = await getUserById(payload.sub);
      if (!owner) return res.status(401).json({ message: 'user not found, please login again' });

      const parsed = commentCreateSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'invalid payload' });
      }

      const exhibit = await getGrowthExhibitById(parsed.data.exhibitId);
      if (!exhibit || exhibit.owner_id !== payload.sub) {
        return res.status(404).json({ message: 'exhibit not found' });
      }

      const now = new Date().toISOString();
      const comment = {
        id: randomUUID(),
        ownerId: payload.sub,
        exhibitId: parsed.data.exhibitId,
        userName: parsed.data.userName,
        content: parsed.data.content,
        createdAt: now,
      };

      await insertGrowthComment(comment);
      res.status(201).json({ comment });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.get('/api/growth/exhibits/:id/comments', async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      const exhibitId = String(req.params.id || '').trim();
      if (!exhibitId) return res.status(400).json({ message: 'exhibit id is required' });

      const exhibit = await getGrowthExhibitById(exhibitId);
      if (!exhibit || exhibit.owner_id !== payload.sub) {
        return res.status(404).json({ message: 'exhibit not found' });
      }

      const rows = await listGrowthCommentsByExhibitId(exhibitId);
      const comments = rows.map((row) => ({
        id: row.id,
        ownerId: row.owner_id,
        exhibitId: row.exhibit_id,
        userName: row.user_name,
        content: row.content,
        createdAt: row.created_at,
      }));

      res.json({ comments });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.post('/api/growth/exhibits/:id/share-link', async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      const exhibitId = String(req.params.id || '').trim();
      if (!exhibitId) return res.status(400).json({ message: 'exhibit id is required' });

      const parsed = shareLinkCreateSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'invalid payload' });
      }

      const shareToken = randomUUID();
      const role = parsed.data.role;
      const expiresAt = typeof parsed.data.expiresInHours === 'number'
        ? new Date(Date.now() + parsed.data.expiresInHours * 60 * 60 * 1000).toISOString()
        : null;

      const changed = await updateGrowthExhibitShareById(exhibitId, payload.sub, {
        shareToken,
        shareRole: role,
        shareExpiresAt: expiresAt,
      });

      if (!changed) {
        return res.status(404).json({ message: 'exhibit not found' });
      }

      const protocol = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
      const host = String(req.headers['x-forwarded-host'] || req.get('host') || '').split(',')[0].trim();
      const shareUrl = `${protocol}://${host}/growth-memories/share/${encodeURIComponent(shareToken)}`;

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

  app.delete('/api/growth/exhibits/:id/share-link', async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      const exhibitId = String(req.params.id || '').trim();
      if (!exhibitId) return res.status(400).json({ message: 'exhibit id is required' });

      const changed = await updateGrowthExhibitShareById(exhibitId, payload.sub, {
        shareToken: null,
        shareRole: SHARE_ROLE_VIEWER,
        shareExpiresAt: null,
      });

      if (!changed) {
        return res.status(404).json({ message: 'exhibit not found' });
      }

      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.get('/api/share/growth/exhibits/:token', async (req, res) => {
    try {
      const token = String(req.params.token || '').trim();
      if (!token) return res.status(400).json({ message: 'share token is required' });

      const row = await getGrowthExhibitByShareToken(token);
      if (!row) return res.status(404).json({ message: 'share link not found' });
      if (row.share_expires_at && new Date(row.share_expires_at).getTime() <= Date.now()) {
        return res.status(410).json({ message: 'share link expired' });
      }

      res.json({
        exhibit: {
          id: row.id,
          ownerId: row.owner_id,
          childId: row.child_id,
          title: row.title,
          templateId: row.template_id,
          introStory: row.intro_story,
          isPrivate: Boolean(row.is_private),
          shareRole: row.share_role || SHARE_ROLE_VIEWER,
          shareExpiresAt: row.share_expires_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
        access: {
          viaShare: true,
          role: row.share_role || SHARE_ROLE_VIEWER,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.get('/api/share/growth/exhibits/:token/assets', async (req, res) => {
    try {
      const token = String(req.params.token || '').trim();
      if (!token) return res.status(400).json({ message: 'share token is required' });

      const row = await getGrowthExhibitByShareToken(token);
      if (!row) return res.status(404).json({ message: 'share link not found' });
      if (row.share_expires_at && new Date(row.share_expires_at).getTime() <= Date.now()) {
        return res.status(410).json({ message: 'share link expired' });
      }

      const rows = await listGrowthAssetsByExhibitId(row.id);
      const assets = rows.map(serializeGrowthAsset);

      res.json({ assets });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.get('/api/share/growth/exhibits/:token/comments', async (req, res) => {
    try {
      const token = String(req.params.token || '').trim();
      if (!token) return res.status(400).json({ message: 'share token is required' });

      const row = await getGrowthExhibitByShareToken(token);
      if (!row) return res.status(404).json({ message: 'share link not found' });
      if (row.share_expires_at && new Date(row.share_expires_at).getTime() <= Date.now()) {
        return res.status(410).json({ message: 'share link expired' });
      }

      const rows = await listGrowthCommentsByExhibitId(row.id);
      const comments = rows.map((comment) => ({
        id: comment.id,
        ownerId: comment.owner_id,
        exhibitId: comment.exhibit_id,
        userName: comment.user_name,
        content: comment.content,
        createdAt: comment.created_at,
      }));

      res.json({ comments });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.post('/api/share/growth/exhibits/:token/comments', commentLimiter, async (req, res) => {
    try {
      const token = String(req.params.token || '').trim();
      if (!token) return res.status(400).json({ message: 'share token is required' });

      const row = await getGrowthExhibitByShareToken(token);
      if (!row) return res.status(404).json({ message: 'share link not found' });
      if (row.share_expires_at && new Date(row.share_expires_at).getTime() <= Date.now()) {
        return res.status(410).json({ message: 'share link expired' });
      }

      const parsed = z.object({
        userName: z.string().trim().min(1, 'userName is required').max(80, 'userName too long'),
        content: z.string().trim().min(1, 'content is required').max(1000, 'content too long'),
      }).safeParse(req.body || {});

      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'invalid payload' });
      }

      const comment = {
        id: randomUUID(),
        ownerId: row.owner_id,
        exhibitId: row.id,
        userName: parsed.data.userName,
        content: parsed.data.content,
        createdAt: new Date().toISOString(),
      };

      await insertGrowthComment(comment);
      res.status(201).json({ comment });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });
}
