import { beforeEach, describe, expect, it, vi } from 'vitest';
import { completeExhibitionPassport, getExhibitionPassport, getExhibitionSouvenir, listRecentExhibitionSouvenirs, shareExhibitionPassport } from './exhibitionPassport';

function response(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), { status: 200, ...init, headers: { 'Content-Type': 'application/json' } });
}

describe('exhibition passport API', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({}))));

  it('encodes gallery IDs and sends authentication', async () => {
    await getExhibitionPassport('jwt', 'gallery / one');
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('/api/exhibition-passports/gallery%20%2F%20one');
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer jwt');
  });

  it('sends reflection JSON when completing and supports sharing', async () => {
    await completeExhibitionPassport('jwt', 'gallery-1', 'A quiet favorite.');
    expect(fetch).toHaveBeenLastCalledWith('/api/exhibition-passports/gallery-1/complete', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ reflection: 'A quiet favorite.' }),
    }));

    vi.mocked(fetch).mockResolvedValueOnce(response({ token: 'public', sharePath: '/souvenirs/public' }));
    await expect(shareExhibitionPassport('jwt', 'gallery-1')).resolves.toEqual({ token: 'public', sharePath: '/souvenirs/public' });
  });

  it('preserves status, code, and progress from a 409 response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({
      message: 'passport tasks are not complete', code: 'PASSPORT_INCOMPLETE',
      progress: { completedTaskIds: ['visit-count'], complete: false },
    }, { status: 409 }));
    await expect(completeExhibitionPassport('jwt', 'gallery-1', '')).rejects.toMatchObject({
      message: 'passport tasks are not complete', status: 409, code: 'PASSPORT_INCOMPLETE',
      progress: { completedTaskIds: ['visit-count'], complete: false },
    });
  });

  it('handles invalid JSON error responses safely', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('not json', { status: 500 }));
    await expect(getExhibitionPassport('jwt', 'gallery-1')).rejects.toThrow('Failed to load exhibition passport');
  });

  it('keeps public requests unauthenticated', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ galleryId: 'gallery-1' }));
    await getExhibitionSouvenir('public / token');
    vi.mocked(fetch).mockResolvedValueOnce(response([]));
    await listRecentExhibitionSouvenirs(6);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/exhibition-souvenirs/public%20%2F%20token');
    expect(new Headers(vi.mocked(fetch).mock.calls[0][1]?.headers).has('Authorization')).toBe(false);
    expect(vi.mocked(fetch).mock.calls[1][0]).toBe('/api/exhibition-souvenirs?limit=6');
    expect(new Headers(vi.mocked(fetch).mock.calls[1][1]?.headers).has('Authorization')).toBe(false);
  });
});
