import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerMediaRoutes } from './mediaRoutes.js';

const servers = [];
const ASSET_ID = '11111111-1111-4111-8111-111111111111';

afterEach(() => {
  while (servers.length) servers.pop().close();
});

async function startApp(overrides = {}) {
  const deps = {
    requireAuth: vi.fn(() => ({ sub: 'user-1' })),
    optionalAuth: vi.fn(() => null),
    uploadLimiter: vi.fn((_req, _res, next) => next()),
    ingestMediaUpload: vi.fn().mockResolvedValue({
      id: ASSET_ID,
      fileName: `${ASSET_ID}.jpg`,
      originalFileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      size: 4,
      metadataSanitized: true,
      url: `/uploads/media/${ASSET_ID}.jpg`,
    }),
    insertMediaAsset: vi.fn().mockResolvedValue(undefined),
    getMediaAssetById: vi.fn().mockResolvedValue(null),
    bindMediaAssetsToGallery: vi.fn().mockResolvedValue(1),
    getGalleryById: vi.fn().mockResolvedValue(null),
    getGalleryByShareToken: vi.fn().mockResolvedValue(null),
    readMediaFile: vi.fn().mockResolvedValue(Buffer.from('image-bytes')),
    deleteMediaFile: vi.fn().mockResolvedValue(undefined),
    deleteMediaAssetById: vi.fn().mockResolvedValue(null),
    signMediaPreviewToken: vi.fn(() => 'preview-token'),
    verifyMediaPreviewToken: vi.fn((token, id) => token === 'preview-token' && id === ASSET_ID),
    ...overrides,
  };
  const app = express();
  app.use(express.json());
  registerMediaRoutes(app, deps);
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  servers.push(server);
  return { baseUrl: `http://127.0.0.1:${server.address().port}`, deps };
}

function uploadBody(overrides = {}) {
  return {
    dataBase64: '/9j/2Q==',
    mimeType: 'image/jpeg',
    fileName: 'photo.jpg',
    ...overrides,
  };
}

describe('media upload route', () => {
  it('requires authentication, applies upload limiting, and returns asset metadata', async () => {
    const { baseUrl, deps } = await startApp();
    const res = await fetch(`${baseUrl}/api/media/upload`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(uploadBody()),
    });

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ asset: {
      url: `/api/media/${ASSET_ID}`,
      previewUrl: `/api/media/${ASSET_ID}?accessToken=preview-token`,
    } });
    expect(deps.uploadLimiter).toHaveBeenCalledOnce();
    expect(deps.requireAuth).toHaveBeenCalledOnce();
    expect(deps.ingestMediaUpload).toHaveBeenCalledWith(uploadBody());
    expect(deps.insertMediaAsset).toHaveBeenCalledWith(expect.objectContaining({
      id: ASSET_ID,
      ownerId: 'user-1',
      storageFileName: `${ASSET_ID}.jpg`,
    }));
  });

  it('stops when authentication fails', async () => {
    const ingestMediaUpload = vi.fn();
    const { baseUrl } = await startApp({
      requireAuth: (_req, res) => {
        res.status(401).json({ message: 'unauthorized' });
        return null;
      },
      ingestMediaUpload,
    });
    const res = await fetch(`${baseUrl}/api/media/upload`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(uploadBody()),
    });

    expect(res.status).toBe(401);
    expect(ingestMediaUpload).not.toHaveBeenCalled();
  });

  it.each([
    ['INVALID_UPLOAD', 400],
    ['REENCODE_REQUIRED', 422],
    ['UPLOAD_TOO_LARGE', 413],
  ])('maps %s service errors to HTTP %i', async (code, status) => {
    const error = Object.assign(new Error('upload rejected'), { code, status });
    const { baseUrl } = await startApp({ ingestMediaUpload: vi.fn().mockRejectedValue(error) });
    const res = await fetch(`${baseUrl}/api/media/upload`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(uploadBody()),
    });

    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ code, message: 'upload rejected' });
  });

  it('rejects incomplete payloads before calling the service', async () => {
    const { baseUrl, deps } = await startApp();
    const res = await fetch(`${baseUrl}/api/media/upload`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mimeType: 'image/jpeg' }),
    });

    expect(res.status).toBe(400);
    expect(deps.ingestMediaUpload).not.toHaveBeenCalled();
  });

  it('removes the stored file when metadata persistence fails', async () => {
    const error = new Error('database failed');
    const { baseUrl, deps } = await startApp({ insertMediaAsset: vi.fn().mockRejectedValue(error) });
    const res = await fetch(`${baseUrl}/api/media/upload`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(uploadBody()),
    });

    expect(res.status).toBe(500);
    expect(deps.deleteMediaFile).toHaveBeenCalledWith(`${ASSET_ID}.jpg`);
  });
});

describe('media binding and delivery routes', () => {
  const storedAsset = {
    id: ASSET_ID, owner_id: 'user-1', gallery_id: null,
    storage_file_name: `${ASSET_ID}.jpg`, original_file_name: 'photo.jpg',
    mime_type: 'image/jpeg', size_bytes: 11,
  };

  it('binds an authenticated owner asset to an owned gallery', async () => {
    const { baseUrl, deps } = await startApp();
    const res = await fetch(`${baseUrl}/api/media/bind`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ galleryId: 'gallery-1', assetIds: [ASSET_ID] }),
    });

    expect(res.status).toBe(200);
    expect(deps.bindMediaAssetsToGallery).toHaveBeenCalledWith([ASSET_ID], 'gallery-1', 'user-1');
    expect(await res.json()).toMatchObject({
      bound: 1,
      assets: [{ id: ASSET_ID, previewUrl: `/api/media/${ASSET_ID}?accessToken=preview-token` }],
    });
  });

  it('does not reveal a failed binding target', async () => {
    const { baseUrl } = await startApp({ bindMediaAssetsToGallery: vi.fn().mockResolvedValue(0) });
    const res = await fetch(`${baseUrl}/api/media/bind`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ galleryId: 'gallery-1', assetIds: [ASSET_ID] }),
    });
    expect(res.status).toBe(404);
  });

  it('serves an unbound asset only to its owner', async () => {
    const { baseUrl } = await startApp({
      optionalAuth: vi.fn(() => ({ sub: 'user-1' })),
      getMediaAssetById: vi.fn().mockResolvedValue(storedAsset),
    });
    const res = await fetch(`${baseUrl}/api/media/${ASSET_ID}`);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/jpeg');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe('image-bytes');
  });

  it('returns 404 for another user reading a private asset', async () => {
    const { baseUrl, deps } = await startApp({
      optionalAuth: vi.fn(() => ({ sub: 'user-2' })),
      getMediaAssetById: vi.fn().mockResolvedValue(storedAsset),
    });
    const res = await fetch(`${baseUrl}/api/media/${ASSET_ID}`);
    expect(res.status).toBe(404);
    expect(deps.readMediaFile).not.toHaveBeenCalled();
  });

  it('serves an unbound asset through a token scoped to that preview', async () => {
    const { baseUrl } = await startApp({ getMediaAssetById: vi.fn().mockResolvedValue(storedAsset) });
    const res = await fetch(`${baseUrl}/api/media/${ASSET_ID}?accessToken=preview-token`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it('serves a bound asset when its gallery is published', async () => {
    const { baseUrl } = await startApp({
      getMediaAssetById: vi.fn().mockResolvedValue({ ...storedAsset, gallery_id: 'gallery-1' }),
      getGalleryById: vi.fn().mockResolvedValue({ id: 'gallery-1', is_published: 1 }),
    });
    const res = await fetch(`${baseUrl}/api/media/${ASSET_ID}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('public');
  });

  it('serves a private gallery asset with a matching unexpired share token', async () => {
    const { baseUrl } = await startApp({
      getMediaAssetById: vi.fn().mockResolvedValue({ ...storedAsset, gallery_id: 'gallery-1' }),
      getGalleryById: vi.fn().mockResolvedValue({ id: 'gallery-1', is_published: 0 }),
      getGalleryByShareToken: vi.fn().mockResolvedValue({ id: 'gallery-1', share_expires_at: null }),
    });
    const res = await fetch(`${baseUrl}/api/media/${ASSET_ID}`, { headers: { 'x-gallery-share-token': 'share-1' } });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it('accepts the share token in the media URL for browser texture loaders', async () => {
    const { baseUrl } = await startApp({
      getMediaAssetById: vi.fn().mockResolvedValue({ ...storedAsset, gallery_id: 'gallery-1' }),
      getGalleryById: vi.fn().mockResolvedValue({ id: 'gallery-1', is_published: 0 }),
      getGalleryByShareToken: vi.fn().mockResolvedValue({ id: 'gallery-1', share_expires_at: null }),
    });
    const res = await fetch(`${baseUrl}/api/media/${ASSET_ID}?shareToken=share-1`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });
});

describe('media deletion route', () => {
  const deletedAsset = {
    id: ASSET_ID,
    owner_id: 'user-1',
    gallery_id: null,
    storage_file_name: `${ASSET_ID}.jpg`,
  };

  it('deletes an owner asset and its stored file', async () => {
    const { baseUrl, deps } = await startApp({
      getMediaAssetById: vi.fn().mockResolvedValue(deletedAsset),
      deleteMediaAssetById: vi.fn().mockResolvedValue(deletedAsset),
    });
    const res = await fetch(`${baseUrl}/api/media/${ASSET_ID}`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, cleanupPending: false });
    expect(deps.deleteMediaAssetById).toHaveBeenCalledWith(ASSET_ID, 'user-1');
    expect(deps.deleteMediaFile).toHaveBeenCalledWith(`${ASSET_ID}.jpg`);
  });

  it('does not reveal assets outside the authenticated owner scope', async () => {
    const { baseUrl, deps } = await startApp();
    const res = await fetch(`${baseUrl}/api/media/${ASSET_ID}`, { method: 'DELETE' });
    expect(res.status).toBe(404);
    expect(deps.deleteMediaFile).not.toHaveBeenCalled();
  });

  it('completes database deletion and reports deferred cleanup when file removal fails', async () => {
    const { baseUrl } = await startApp({
      getMediaAssetById: vi.fn().mockResolvedValue(deletedAsset),
      deleteMediaAssetById: vi.fn().mockResolvedValue(deletedAsset),
      deleteMediaFile: vi.fn().mockRejectedValue(new Error('disk unavailable')),
    });
    const res = await fetch(`${baseUrl}/api/media/${ASSET_ID}`, { method: 'DELETE' });
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ ok: true, cleanupPending: true });
  });

  it('protects media still used by a published gallery', async () => {
    const { baseUrl, deps } = await startApp({
      getMediaAssetById: vi.fn().mockResolvedValue({ ...deletedAsset, gallery_id: 'gallery-1' }),
      getGalleryById: vi.fn().mockResolvedValue({ id: 'gallery-1', is_published: 1 }),
    });
    const res = await fetch(`${baseUrl}/api/media/${ASSET_ID}`, { method: 'DELETE' });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: 'MEDIA_IN_USE' });
    expect(deps.deleteMediaAssetById).not.toHaveBeenCalled();
  });
});
