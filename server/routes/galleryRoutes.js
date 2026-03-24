import { z } from 'zod';
import { randomUUID } from 'node:crypto';

const SHARE_ROLE_VIEWER = 'viewer';
const SHARE_ROLE_EDITOR = 'editor';

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

export function registerGalleryRoutes(app, deps) {
  const {
    requireAuth,
    getUserById,
    insertGallery,
    listGalleriesByOwnerId,
    getGalleryById,
    updateGalleryById,
    deleteGalleryById,
    updateGalleryShareById,
    getGalleryByShareToken,
  } = deps;

  const toGalleryResponse = (row) => ({
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    description: row.description,
    templateTitle: row.template_title,
    templateImage: row.template_image,
    category: row.category,
    sceneJson: row.scene_json,
    shareRole: row.share_role || SHARE_ROLE_VIEWER,
    shareExpiresAt: row.share_expires_at || null,
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
          title: gallery.title,
          description: gallery.description,
          templateTitle: gallery.templateTitle,
          templateImage: gallery.templateImage,
          category: gallery.category,
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
      const galleries = rows.map((r) => ({
        id: r.id,
        ownerId: r.owner_id,
        title: r.title,
        description: r.description,
        templateTitle: r.template_title,
        templateImage: r.template_image,
        category: r.category,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));

      res.json({ galleries });
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
      if (!row) {
        return res.status(404).json({ message: 'gallery not found' });
      }

      res.json({
        gallery: {
          id: row.id,
          ownerId: row.owner_id,
          title: row.title,
          description: row.description,
          templateTitle: row.template_title,
          templateImage: row.template_image,
          category: row.category,
          sceneJson: row.scene_json,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
      });
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

      res.json({
        gallery: {
          id: row.id,
          ownerId: row.owner_id,
          title: row.title,
          description: row.description,
          templateTitle: row.template_title,
          templateImage: row.template_image,
          category: row.category,
          sceneJson: row.scene_json,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
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

      const protocol = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
      const host = String(req.headers['x-forwarded-host'] || req.get('host') || '').split(',')[0].trim();
      const shareUrl = `${protocol}://${host}/virtual-gallery/share/${encodeURIComponent(shareToken)}`;

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

  app.get('/api/share/galleries/:token', async (req, res) => {
    try {
      const token = String(req.params.token || '').trim();
      if (!token) return res.status(400).json({ message: 'share token is required' });

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
  });

  app.patch('/api/share/galleries/:token', async (req, res) => {
    try {
      const token = String(req.params.token || '').trim();
      if (!token) return res.status(400).json({ message: 'share token is required' });

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
  });

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
