import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerGrowthRoutes } from './growthRoutes.js';

const servers = [];

afterEach(() => {
  while (servers.length) servers.pop().close();
});

function storedAsset(overrides = {}) {
  return {
    id: 'asset-1',
    owner_id: 'user-1',
    exhibit_id: 'exhibit-1',
    type: 'photo',
    title: 'Photo',
    content_url: '/uploads/growth/private.png',
    note: null,
    captured_at: null,
    created_at: '2026-07-10T00:00:00.000Z',
    ...overrides,
  };
}

function createDeps(overrides = {}) {
  return {
    requireAuth: () => ({ sub: 'user-1' }),
    uploadLimiter: (_req, _res, next) => next(),
    commentLimiter: (_req, _res, next) => next(),
    getUserById: async () => ({ id: 'user-1' }),
    getGrowthExhibitById: async () => ({ id: 'exhibit-1', owner_id: 'user-1' }),
    getGrowthExhibitByShareToken: async (token) => token === 'share-ok'
      ? { id: 'exhibit-1', owner_id: 'user-1', share_role: 'viewer', share_expires_at: null }
      : null,
    getGrowthAssetById: async (id) => id === 'asset-1' ? storedAsset() : null,
    listGrowthAssetsByExhibitId: async () => [storedAsset()],
    insertGrowthAsset: vi.fn().mockResolvedValue(undefined),
    signGrowthAssetToken: (id) => `signed-${id}`,
    verifyGrowthAssetToken: (token, id) => token === `signed-${id}`,
    saveGrowthAssetFile: vi.fn().mockResolvedValue('/uploads/growth/generated.png'),
    readGrowthAssetFile: vi.fn().mockResolvedValue({
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      mimeType: 'image/png',
    }),
    ...overrides,
  };
}

async function startAppWithDeps(overrides = {}) {
  const deps = createDeps(overrides);
  const app = express();
  app.use(express.json({ limit: '25mb' }));
  registerGrowthRoutes(app, deps);
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  servers.push(server);
  return { baseUrl: `http://127.0.0.1:${server.address().port}`, deps };
}

describe('growth media security', () => {
  it('returns an asset-scoped content URL after owner authorization', async () => {
    const { baseUrl } = await startAppWithDeps();
    const res = await fetch(`${baseUrl}/api/growth/exhibits/exhibit-1/assets`);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.assets[0].contentUrl).toBe('/api/growth/assets/asset-1/content?access=signed-asset-1');
  });

  it('returns an asset-scoped content URL after share-link authorization', async () => {
    const { baseUrl } = await startAppWithDeps();
    const res = await fetch(`${baseUrl}/api/share/growth/exhibits/share-ok/assets`);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.assets[0].contentUrl).toBe('/api/growth/assets/asset-1/content?access=signed-asset-1');
  });

  it('does not replace an external HTTPS asset URL', async () => {
    const { baseUrl } = await startAppWithDeps({
      listGrowthAssetsByExhibitId: async () => [storedAsset({ content_url: 'https://cdn.example.com/photo.jpg' })],
    });
    const res = await fetch(`${baseUrl}/api/growth/exhibits/exhibit-1/assets`);
    const data = await res.json();

    expect(data.assets[0].contentUrl).toBe('https://cdn.example.com/photo.jpg');
  });

  it('rejects missing or cross-asset content tokens without reading a file', async () => {
    const readGrowthAssetFile = vi.fn();
    const { baseUrl } = await startAppWithDeps({ readGrowthAssetFile });

    const missing = await fetch(`${baseUrl}/api/growth/assets/asset-1/content`);
    const wrong = await fetch(`${baseUrl}/api/growth/assets/asset-1/content?access=signed-asset-2`);

    expect(missing.status).toBe(404);
    expect(wrong.status).toBe(404);
    expect(readGrowthAssetFile).not.toHaveBeenCalled();
  });

  it('serves authorized media with safe headers', async () => {
    const { baseUrl } = await startAppWithDeps();
    const res = await fetch(`${baseUrl}/api/growth/assets/asset-1/content?access=signed-asset-1`);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/png');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(Buffer.from(await res.arrayBuffer())).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });

  it('rejects HTML disguised as an uploaded image before saving', async () => {
    const saveGrowthAssetFile = vi.fn();
    const { baseUrl } = await startAppWithDeps({ saveGrowthAssetFile });
    const res = await fetch(`${baseUrl}/api/growth/assets/upload`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        exhibitId: 'exhibit-1',
        title: 'Unsafe',
        fileName: 'photo.png',
        mimeType: 'image/png',
        dataBase64: Buffer.from('<html><script>alert(1)</script></html>').toString('base64'),
      }),
    });

    expect(res.status).toBe(400);
    expect(saveGrowthAssetFile).not.toHaveBeenCalled();
  });

  it('stores a valid upload using the server-detected extension and MIME type', async () => {
    const saveGrowthAssetFile = vi.fn().mockResolvedValue('/uploads/growth/generated.png');
    const insertGrowthAsset = vi.fn().mockResolvedValue(undefined);
    const { baseUrl } = await startAppWithDeps({ saveGrowthAssetFile, insertGrowthAsset });
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const res = await fetch(`${baseUrl}/api/growth/assets/upload`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        exhibitId: 'exhibit-1',
        title: 'Safe',
        fileName: 'misleading.html',
        mimeType: 'image/png',
        dataBase64: png.toString('base64'),
      }),
    });

    expect(res.status).toBe(201);
    expect(saveGrowthAssetFile).toHaveBeenCalledWith(png, '.png');
    expect(insertGrowthAsset).toHaveBeenCalledWith(expect.objectContaining({
      type: 'photo',
      contentUrl: '/uploads/growth/generated.png',
    }));
  });
});
