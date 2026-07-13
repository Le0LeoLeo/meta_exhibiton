import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('normalizeGrowthAsset', () => {
  it('applies the configured API base to protected media paths', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com');
    const { normalizeGrowthAsset } = await import('./growth');

    const asset = normalizeGrowthAsset({
      id: 'asset-1',
      ownerId: 'user-1',
      exhibitId: 'exhibit-1',
      type: 'photo',
      title: 'Photo',
      contentUrl: '/api/growth/assets/asset-1/content?access=signed',
      note: null,
      capturedAt: null,
      createdAt: '2026-07-10T00:00:00.000Z',
    });

    expect(asset.contentUrl).toBe('https://api.example.com/api/growth/assets/asset-1/content?access=signed');
  });

  it('leaves external HTTPS media URLs unchanged', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com');
    const { normalizeGrowthAsset } = await import('./growth');
    const contentUrl = 'https://cdn.example.com/photo.jpg';

    expect(normalizeGrowthAsset({
      id: 'asset-1',
      ownerId: 'user-1',
      exhibitId: 'exhibit-1',
      type: 'photo',
      title: 'Photo',
      contentUrl,
      note: null,
      capturedAt: null,
      createdAt: '2026-07-10T00:00:00.000Z',
    }).contentUrl).toBe(contentUrl);
  });
});
