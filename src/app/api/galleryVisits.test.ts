import { afterEach, describe, expect, it, vi } from 'vitest';
import { recordGalleryVisit } from './galleryVisits';

vi.mock('./auth', () => ({ loadAuth: () => ({ token: null, user: null }) }));

describe('recordGalleryVisit', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.cookie = 'mrei_csrf=; Max-Age=0; path=/';
  });

  it('preserves cookie CSRF protection and keepalive for an anonymous shared-gallery heartbeat', async () => {
    document.cookie = 'mrei_csrf=csrf-token; path=/';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await recordGalleryVisit('gallery', {
      visitorId: 'visitor', sessionId: 'session', mode: '2d', activeSeconds: 15, itemDwellSeconds: {},
    }, 'share', true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/galleries/gallery/visits');
    expect(init.keepalive).toBe(true);
    expect(init.credentials).toBe('include');
    expect(init.headers.get('X-CSRF-Token')).toBe('csrf-token');
    expect(init.headers.get('x-gallery-share-token')).toBe('share');
    expect(init.headers.has('Authorization')).toBe(false);
  });

  it('reports rejected heartbeats so the session can retry cumulative counters', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 429 })));
    await expect(recordGalleryVisit('gallery', {
      visitorId: 'visitor', sessionId: 'session', mode: '3d', activeSeconds: 0, itemDwellSeconds: {},
    })).rejects.toThrow('Visit could not be recorded');
  });
});
