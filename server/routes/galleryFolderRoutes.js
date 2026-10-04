import { z } from 'zod';
import { readMediaFile as defaultReadMediaFile } from '../services/mediaFileService.js';

const name = z.string().trim().min(1).max(120);
const folderId = z.string().uuid().nullable();
const create = z.object({ name, parentId: folderId.default(null) }).strict();
const update = z.object({ name: name.optional(), parentId: folderId.optional() }).strict().refine(v => Object.keys(v).length > 0);
const move = z.object({ galleryIds: z.array(z.string().min(1).max(200)).min(1).max(100), folderId }).strict();

export function registerGalleryFolderRoutes(app, { requireAuth, repository, readMediaFile = defaultReadMediaFile, limiter = (_req, _res, next) => next() }) {
  const handle = (method, path, action, schema) => app[method](path, ...(method === 'get' ? [] : [limiter]), async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    try {
      const auth = await requireAuth(req, res);
      if (!auth) return;
      const parsed = schema?.safeParse(req.body ?? {});
      if (parsed && !parsed.success) return res.status(400).json({ code: 'FOLDER_INPUT', message: 'Invalid folder input' });
      return res.json(await action(auth.sub, req.params.id, parsed?.data));
    } catch (error) {
      if (error.code && Number.isInteger(error.status)) return res.status(error.status).json({ code: error.code, message: error.code });
      console.error('[gallery-folders]', error);
      return res.status(500).json({ code: 'FOLDER_FAILED', message: 'Unable to update folders' });
    }
  });
  handle('get', '/api/gallery-folders', owner => repository.list(owner));
  handle('post', '/api/gallery-folders', (owner, _id, body) => repository.create(owner, body), create);
  handle('post', '/api/gallery-folders/move', (owner, _id, body) => repository.moveGalleries(owner, body), move);
  handle('patch', '/api/gallery-folders/:id', (owner, id, body) => repository.update(owner, id, body), update);
  handle('delete', '/api/gallery-folders/:id', (owner, id) => repository.remove(owner, id));
  handle('get', '/api/gallery-folders/:id/share', (owner, id) => repository.shareInfo(owner, id));
  handle('post', '/api/gallery-folders/:id/share', (owner, id) => repository.share(owner, id));
  handle('delete', '/api/gallery-folders/:id/share', (owner, id) => repository.revoke(owner, id));

  const publicRead = action => async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    try {
      const token = req.header('x-folder-share-token') || req.query.token;
      await action(req, res, token);
    } catch (error) {
      if (error.status === 404 || error.code === 'ENOENT') return res.status(404).json({ code: 'FOLDER_SHARE_UNAVAILABLE' });
      console.error('[folder-share]', error);
      return res.status(500).json({ code: 'FOLDER_FAILED' });
    }
  };
  app.get('/api/shared-folders', publicRead(async (req, res, token) => res.json(await repository.shared(token, req.query.folder))));
  app.get('/api/shared-folders/galleries/:id', publicRead(async (req, res, token) => res.json(await repository.sharedGallery(token, req.params.id))));
  app.get('/api/shared-folders/galleries/:id/media/:assetId', publicRead(async (req, res, token) => {
    const asset = await repository.sharedMedia(token, req.params.id, req.params.assetId);
    const bytes = await readMediaFile(asset.storage_file_name);
    res.setHeader('Content-Type', asset.mime_type);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(bytes);
  }));
}
