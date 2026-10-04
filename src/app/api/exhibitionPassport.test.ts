import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getExhibitionSouvenir } from './exhibitionPassport';

function response(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), { status: 200, ...init, headers: { 'Content-Type': 'application/json' } });
}

describe('exhibition souvenir API', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({}))));

  it('encodes the public token and stays unauthenticated', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ galleryId: 'gallery-1' }));
    await expect(getExhibitionSouvenir('public / token')).resolves.toEqual({ galleryId: 'gallery-1' });
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('/api/exhibition-souvenirs/public%20%2F%20token');
    expect(new Headers(init?.headers).has('Authorization')).toBe(false);
  });

  it('uses the server message for a missing souvenir', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ message: 'Souvenir not found' }, { status: 404 }));
    await expect(getExhibitionSouvenir('missing')).rejects.toThrow('Souvenir not found');
  });

  it('handles invalid JSON error responses safely', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('not json', { status: 500 }));
    await expect(getExhibitionSouvenir('broken')).rejects.toThrow('Failed to load exhibition souvenir');
  });
});
