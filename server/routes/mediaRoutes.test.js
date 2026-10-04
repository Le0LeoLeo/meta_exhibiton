import express from 'express';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import sqlite3 from 'sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerMediaRoutes } from './mediaRoutes.js';
import { ensureMediaAssetDimensions, ingestMediaUpload } from '../services/mediaIngestService.js';
import {
  getMediaAssetById,
  insertMediaAsset,
  listMediaAssetsByGalleryId,
  updateMediaAssetDimensions,
} from '../repositories/mediaRepository.js';

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
      width: 32,
      height: 48,
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
  app.use(express.json({ limit: '22mb' }));
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
      width: 32,
      height: 48,
    } });
    expect(deps.uploadLimiter).toHaveBeenCalledOnce();
    expect(deps.requireAuth).toHaveBeenCalledOnce();
    expect(deps.ingestMediaUpload).toHaveBeenCalledWith(uploadBody(), { allowSceneMedia: true });
    expect(deps.insertMediaAsset).toHaveBeenCalledWith(expect.objectContaining({
      id: ASSET_ID,
      ownerId: 'user-1',
      usage: 'gallery',
      storageFileName: `${ASSET_ID}.jpg`,
      width: 32,
      height: 48,
    }));
  });

  it('marks a shirt photo upload for public avatar rendering', async () => {
    const { baseUrl, deps } = await startApp();
    const res = await fetch(`${baseUrl}/api/media/upload`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(uploadBody({ usage: 'avatar' })),
    });

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ asset: { width: 32, height: 48 } });
    expect(deps.ingestMediaUpload).toHaveBeenCalledWith(uploadBody(), { allowSceneMedia: false });
    expect(deps.insertMediaAsset).toHaveBeenCalledWith(expect.objectContaining({
      usage: 'avatar',
      width: 32,
      height: 48,
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

  it('rejects client-supplied dimensions before ingesting or persisting media', async () => {
    const { baseUrl, deps } = await startApp();
    const res = await fetch(`${baseUrl}/api/media/upload`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(uploadBody({ width: 900, height: 900 })),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: 'INVALID_UPLOAD' });
    expect(deps.ingestMediaUpload).not.toHaveBeenCalled();
    expect(deps.insertMediaAsset).not.toHaveBeenCalled();
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

  it.each([false, true])('limits teacher media access to referenced assets and rechecks review access (retained=%s)', async libraryRetained => {
    let approved = true;
    const gallery = { id: 'gallery-1', owner_id: 'student', is_published: 0, scene_json: JSON.stringify({ items: [{ content: `/api/media/${ASSET_ID}` }] }) };
    const { baseUrl, deps } = await startApp({
      optionalAuth: vi.fn(() => ({ sub: 'teacher' })),
      getMediaAssetById: vi.fn().mockResolvedValue({ ...storedAsset, owner_id: 'student', gallery_id: 'gallery-1', library_retained: libraryRetained }),
      getGalleryById: vi.fn(async () => gallery),
      getAssetGalleries: vi.fn(async () => [gallery]),
      hasReviewAccess: vi.fn(async (target, userId) => approved && target.id === gallery.id && userId === 'teacher'),
    });
    const initial = await fetch(`${baseUrl}/api/media/${ASSET_ID}`);
    expect(initial.status).toBe(200);
    expect(initial.headers.get('cache-control')).toBe('private, no-store');
    gallery.scene_json = '{"items":[]}';
    expect((await fetch(`${baseUrl}/api/media/${ASSET_ID}`)).status).toBe(404);
    gallery.scene_json = JSON.stringify({ items: [{ content: `/api/media/${ASSET_ID}` }] });
    approved = false;
    expect((await fetch(`${baseUrl}/api/media/${ASSET_ID}`)).status).toBe(404);
    approved = true;
    deps.optionalAuth.mockReturnValue(null);
    expect((await fetch(`${baseUrl}/api/media/${ASSET_ID}`)).status).toBe(404);
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

  it('serves an avatar asset publicly for multiplayer texture loading', async () => {
    const { baseUrl } = await startApp({
      getMediaAssetById: vi.fn().mockResolvedValue({
        ...storedAsset,
        usage: 'avatar',
      }),
    });
    const res = await fetch(`${baseUrl}/api/media/${ASSET_ID}`);

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('public');
  });

  it('serves a bound asset when its gallery is published', async () => {
    const { baseUrl } = await startApp({
      getMediaAssetById: vi.fn().mockResolvedValue({ ...storedAsset, gallery_id: 'gallery-1' }),
      getGalleryById: vi.fn().mockResolvedValue({ id: 'gallery-1', is_published: 1 }),
    });
    const res = await fetch(`${baseUrl}/api/media/${ASSET_ID}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-cache');
  });

  it('rechecks publication before accepting a cached media validator', async () => {
    const gallery = { id: 'gallery-1', is_published: 1 };
    const { baseUrl, deps } = await startApp({
      getMediaAssetById: vi.fn().mockResolvedValue({ ...storedAsset, gallery_id: gallery.id }),
      getGalleryById: vi.fn().mockResolvedValue(gallery),
    });
    const url = `${baseUrl}/api/media/${ASSET_ID}`;
    const first = await fetch(url);
    expect(first.status).toBe(200);
    expect(first.headers.get('cache-control')).toBe('private, no-cache');
    const etag = first.headers.get('etag');
    expect(etag).toBeTruthy();
    await first.arrayBuffer();

    const headers = { 'if-none-match': etag, 'cache-control': 'max-age=0' };
    const valid = await fetch(url, { headers });
    expect(valid.status).toBe(304);
    expect(valid.headers.get('cache-control')).toBe('private, no-cache');

    gallery.is_published = 0;
    deps.readMediaFile.mockClear();
    const withdrawn = await fetch(url, { headers });
    expect(withdrawn.status).toBe(404);
    expect(withdrawn.headers.get('cache-control')).toBe('private, no-store');
    expect(deps.readMediaFile).not.toHaveBeenCalled();

    gallery.is_published = 1;
    expect((await fetch(url)).status).toBe(200);
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

describe('media dimensions persistence', () => {
  const databases = [];
  const uploadRoots = [];

  afterEach(async () => {
    await Promise.all(databases.splice(0).map((database) => new Promise((resolve, reject) => {
      database.close((error) => error ? reject(error) : resolve());
    })));
    await Promise.all(uploadRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  async function createStorage() {
    const database = new sqlite3.Database(':memory:');
    databases.push(database);
    // The backend migration owns the production schema. Exercise the media
    // repository against its agreed nullable dimension columns in isolation.
    await new Promise((resolve, reject) => database.exec(`CREATE TABLE media_assets (
      id TEXT PRIMARY KEY, owner_id TEXT, gallery_id TEXT, storage_file_name TEXT,
      original_file_name TEXT, mime_type TEXT, size_bytes INTEGER,
      created_at TEXT, updated_at TEXT, usage TEXT, width INTEGER, height INTEGER
    )`, (error) => error ? reject(error) : resolve()));
    const uploadRoot = await mkdtemp(path.join(tmpdir(), 'media-dimensions-'));
    uploadRoots.push(uploadRoot);
    return { database, uploadRoot };
  }

  it('persists a real GLB, serves authorized byte ranges and keeps avatars image-only', async () => {
    const { database, uploadRoot } = await createStorage();
    const input = await readFile('public/templates/concept-car.glb');
    let owner = true;
    const { baseUrl } = await startApp({
      ingestMediaUpload: (payload, options) => ingestMediaUpload(payload, { ...options, uploadRoot }),
      insertMediaAsset: (asset) => insertMediaAsset(asset, database),
      getMediaAssetById: (id) => getMediaAssetById(id, database),
      readMediaFile: (name) => readFile(path.join(uploadRoot, name)),
      optionalAuth: () => owner ? { sub: 'user-1' } : null,
    });
    const upload = (usage) => fetch(`${baseUrl}/api/media/upload`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dataBase64: input.toString('base64'), mimeType: 'application/octet-stream', fileName: 'car.glb', usage }) });
    expect((await upload('avatar')).status).toBe(400);
    const response = await upload('gallery'); expect(response.status).toBe(201);
    const { asset } = await response.json();
    expect(asset.mimeType).toBe('model/gltf-binary');
    const full = await fetch(`${baseUrl}${asset.url}`);
    expect(Buffer.from(await full.arrayBuffer())).toEqual(input);
    const partial = await fetch(`${baseUrl}${asset.url}`, { headers: { Range: 'bytes=0-19' } });
    expect(partial.status).toBe(206); expect(partial.headers.get('content-range')).toBe(`bytes 0-19/${input.length}`);
    expect(Buffer.from(await partial.arrayBuffer())).toEqual(input.subarray(0, 20));
    expect((await fetch(`${baseUrl}${asset.url}`, { headers: { Range: 'bytes=999999999-' } })).status).toBe(416);
    owner = false;
    expect((await fetch(`${baseUrl}${asset.url}`, { headers: { Range: 'bytes=0-19' } })).status).toBe(404);
    expect((await readdir(uploadRoot)).length).toBe(1);
  });

  it.each([
    ['jpeg', 48, 32, 6, 32, 48],
    ['png', 48, 32, 1, 48, 32],
    ['webp', 32, 48, 1, 32, 48],
  ])('keeps %s dimensions identical in upload JSON, database retrieval, and delivered pixels', async (
    format, inputWidth, inputHeight, orientation, width, height,
  ) => {
    const { database, uploadRoot } = await createStorage();
    const input = await sharp({
      create: { width: inputWidth, height: inputHeight, channels: 3, background: 'blue' },
    })[format]().withMetadata({ orientation }).toBuffer();
    const { baseUrl } = await startApp({
      ingestMediaUpload: (payload) => ingestMediaUpload(payload, { uploadRoot }),
      insertMediaAsset: (asset) => insertMediaAsset(asset, database),
      getMediaAssetById: (id) => getMediaAssetById(id, database),
      readMediaFile: (name) => readFile(path.join(uploadRoot, name)),
      optionalAuth: () => ({ sub: 'user-1' }),
    });
    const response = await fetch(`${baseUrl}/api/media/upload`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(uploadBody({ dataBase64: input.toString('base64'), mimeType: `image/${format}` })),
    });

    expect(response.status).toBe(201);
    const { asset } = await response.json();
    expect(asset).toMatchObject({ width, height, mimeType: `image/${format}` });
    const row = await getMediaAssetById(asset.id, database);
    expect(row).toMatchObject({ width, height, mime_type: asset.mimeType, size_bytes: asset.size });
    const delivered = await fetch(`${baseUrl}${asset.url}`);
    expect(delivered.status).toBe(200);
    const bytes = Buffer.from(await delivered.arrayBuffer());
    expect(bytes.length).toBe(asset.size);
    const metadata = await sharp(bytes).metadata();
    expect(metadata).toMatchObject({ width, height });
    expect(metadata.exif).toBeUndefined();
    expect(metadata.orientation).toBeUndefined();
    expect(await readdir(uploadRoot)).toEqual([asset.fileName]);
  });

  it('backfills nullable legacy dimensions and retrieves them by ID and gallery', async () => {
    const { database } = await createStorage();
    const legacy = {
      id: ASSET_ID, ownerId: 'user-1', galleryId: 'gallery-1',
      storageFileName: `${ASSET_ID}.png`, originalFileName: 'legacy.png', mimeType: 'image/png',
      sizeBytes: 100, createdAt: '2026-09-02T00:00:00.000Z', updatedAt: '2026-09-02T00:00:00.000Z',
    };
    await insertMediaAsset(legacy, database);
    await insertMediaAsset({ ...legacy, id: 'other-asset', galleryId: 'gallery-2' }, database);
    const row = await getMediaAssetById(ASSET_ID, database);
    expect(row).toMatchObject({ width: null, height: null, usage: 'gallery' });
    const bytes = await sharp({
      create: { width: 80, height: 120, channels: 3, background: 'red' },
    }).png().toBuffer();
    await ensureMediaAssetDimensions(row, {
      readMediaFile: async () => bytes,
      updateMediaAssetDimensions: (id, width, height) => updateMediaAssetDimensions(id, width, height, database),
    });

    const restored = await getMediaAssetById(ASSET_ID, database);
    expect(restored).toMatchObject({ width: 80, height: 120 });
    expect(await listMediaAssetsByGalleryId('gallery-1', database)).toEqual([restored]);
    expect(await listMediaAssetsByGalleryId('missing-gallery', database)).toEqual([]);
    expect(await getMediaAssetById('other-asset', database)).toMatchObject({ width: null, height: null });
    await expect(updateMediaAssetDimensions(ASSET_ID, 0, 10, database)).rejects.toThrow('positive integers');
    expect(await getMediaAssetById(ASSET_ID, database)).toMatchObject({ width: 80, height: 120 });
  });
});
