import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerExhibitionPassportRoutes } from './exhibitionPassportRoutes.js';

let server;
async function start(overrides = {}) {
  const app = express();
  app.use(express.json());
  const service = {
    getOrCreatePassport: vi.fn(async (_userId, galleryId) => ({ id: 'p1', galleryId })),
    completePassport: vi.fn(async () => ({ id: 'p1', status: 'completed' })),
    sharePassport: vi.fn(async () => ({ token: 't1', sharePath: '/souvenirs/t1' })),
    getPublicSouvenir: vi.fn(async () => ({ galleryId: 'g1', galleryTitle: 'Gallery' })),
    listPublicSouvenirs: vi.fn(async () => []),
    ...overrides.service,
  };
  registerExhibitionPassportRoutes(app, {
    requireAuth: () => ({ sub: 'u1' }), service, errorLogger: vi.fn(), ...overrides,
  });
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  return { baseUrl: `http://127.0.0.1:${server.address().port}`, service };
}

afterEach(() => server && new Promise((resolve) => server.close(resolve)));

describe('exhibition passport routes', () => {
  it('requires authentication', async () => {
    const { baseUrl } = await start({ requireAuth: (_req, res) => { res.status(401).json({ message: 'unauthorized' }); return null; } });
    expect((await fetch(`${baseUrl}/api/exhibition-passports/g1`)).status).toBe(401);
  });

  it('serves all direct response shapes and clamps public list limits', async () => {
    const { baseUrl, service } = await start();
    expect((await fetch(`${baseUrl}/api/exhibition-passports/g1`)).status).toBe(200);
    expect((await fetch(`${baseUrl}/api/exhibition-passports/g1/complete`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reflection: 'nice' }),
    })).status).toBe(200);
    expect(await (await fetch(`${baseUrl}/api/exhibition-passports/g1/share`, { method: 'POST' })).json()).toEqual({
      token: 't1', sharePath: '/souvenirs/t1',
    });
    expect((await fetch(`${baseUrl}/api/exhibition-souvenirs/t1`)).status).toBe(200);
    expect((await fetch(`${baseUrl}/api/exhibition-souvenirs?limit=99`)).status).toBe(200);
    expect(service.listPublicSouvenirs).toHaveBeenCalledWith(12);
  });

  it('validates IDs and reflection', async () => {
    const { baseUrl } = await start();
    expect((await fetch(`${baseUrl}/api/exhibition-passports/${'x'.repeat(121)}`)).status).toBe(400);
    expect((await fetch(`${baseUrl}/api/exhibition-passports/g1/complete`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reflection: 'x'.repeat(281) }),
    })).status).toBe(400);
  });

  it.each([['PASSPORT_INCOMPLETE', 409], ['PASSPORT_UNAVAILABLE', 422], ['SOUVENIR_NOT_FOUND', 404]])(
    'maps %s to %i',
    async (code, status) => {
      const error = Object.assign(new Error('failed'), { code });
      const service = code === 'SOUVENIR_NOT_FOUND'
        ? { getPublicSouvenir: vi.fn(async () => { throw error; }) }
        : code === 'PASSPORT_INCOMPLETE'
          ? { completePassport: vi.fn(async () => { throw error; }) }
          : { getOrCreatePassport: vi.fn(async () => { throw error; }) };
      const { baseUrl } = await start({ service });
      const response = code === 'SOUVENIR_NOT_FOUND'
        ? await fetch(`${baseUrl}/api/exhibition-souvenirs/missing`)
        : code === 'PASSPORT_INCOMPLETE'
          ? await fetch(`${baseUrl}/api/exhibition-passports/g1/complete`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
          : await fetch(`${baseUrl}/api/exhibition-passports/g1`);
      expect(response.status).toBe(status);
    },
  );
});
