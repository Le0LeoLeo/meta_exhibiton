import express from 'express';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createJwtHelpers } from '../auth/jwt.js';
import { resolveGalleryAccess } from '../security/galleryAccess.js';
import { registerGalleryRoutes } from './galleryRoutes.js';

const servers = [];
const jwt = createJwtHelpers({ secret: 'gallery-route-test-secret-32-characters' });
const ownerToken = jwt.signToken({
  id: 'owner-1',
  email: 'owner@example.com',
  name: 'Owner',
});
const otherUserToken = jwt.signToken({
  id: 'user-2',
  email: 'other@example.com',
  name: 'Other',
});
const sameNameUserToken = jwt.signToken({
  id: 'user-3',
  email: 'visitor@example.com',
  name: 'Visitor',
});

const privateGallery = {
  id: 'gallery-1',
  owner_id: 'owner-1',
  is_published: 0,
  scene_json: JSON.stringify({ roomSize: { width: 12, length: 18, height: 4, wallThickness: 0.1 }, items: [{ id: 'item-1', type: 'painting', position: [0, 1, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }] }),
  share_token: 'viewer-token',
  share_role: 'viewer',
  share_expires_at: '2099-01-01T00:00:00.000Z',
};

describe('persistent scene validation', () => {
  it('requires a base revision instead of accepting an unprotected save', async () => {
    let writes = 0;
    const response = await fetch(`${await startApp({ updateGalleryById: async () => { writes++; return 1; } })}/api/galleries/gallery-1`, {
      method: 'PATCH', headers: { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Changed' }),
    });
    expect(response.status).toBe(428);
    expect(writes).toBe(0);
  });

  it('returns a version conflict without retrying a stale save', async () => {
    let attempts = 0;
    const response = await fetch(`${await startApp({ updateGalleryById: async (_id, _owner, updates) => {
      expect(updates.expectedRevision).toBe(3);
      attempts++;
      throw Object.assign(new Error('Version changed'), { code: 'GALLERY_CONFLICT', status: 409 });
    } })}/api/galleries/gallery-1`, {
      method: 'PATCH', headers: { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Changed', expectedRevision: 3 }),
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'GALLERY_CONFLICT' });
    expect(attempts).toBe(1);
  });
  it.each(['not-json', '[]', '42', '{"items":"invalid","roomSize":-1}', '{"items":[{"id":"broken"}],"roomSize":null}'])(
    'rejects malformed scenes without overwriting the saved gallery: %s', async (sceneJson) => {
      let writes = 0;
      const baseUrl = await startApp({ updateGalleryById: async () => { writes++; return 1; } });
      const response = await fetch(`${baseUrl}/api/galleries/gallery-1`, {
        method: 'PATCH', headers: { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ sceneJson, expectedRevision: 0 }),
      });
      expect(response.status).toBe(400);
      expect(writes).toBe(0);
    },
  );
});

const publishedGallery = {
  ...privateGallery,
  is_published: 1,
};

describe('public gallery pages', () => {
  it('allows revocable teacher reads without granting gallery writes or sharing secrets', async () => {
    let reviewAllowed = true;
    const base = await startApp({ hasReviewAccess: async (gallery, userId) => gallery.id === 'gallery-1' && userId === 'user-2' && reviewAllowed });
    const headers = { authorization: `Bearer ${otherUserToken}`, 'content-type': 'application/json' };
    const read = await fetch(`${base}/api/galleries/gallery-1`, { headers });
    expect(read.status).toBe(200);
    expect(read.headers.get('cache-control')).toBe('private, no-store');
    const body = await read.json();
    expect(body.gallery).toMatchObject({ reviewAccess: true, shareRole: 'viewer', isPublished: false });
    expect(body.gallery).not.toHaveProperty('shareToken');
    const update = await fetch(`${base}/api/galleries/gallery-1`, { method: 'PATCH', headers, body: JSON.stringify({ expectedRevision: 0, title: 'Teacher must not edit' }) });
    expect([403, 404]).toContain(update.status);
    expect((await fetch(`${base}/api/galleries/gallery-1/share-link`, { method: 'POST', headers, body: JSON.stringify({ role: 'editor' }) })).status).toBe(404);
    reviewAllowed = false;
    expect((await fetch(`${base}/api/galleries/gallery-1`, { headers })).status).toBe(404);
    expect((await fetch(`${base}/api/galleries/gallery-1`)).status).toBe(401);
  });
  it('exposes draft continuation only in the authenticated owner list', async () => {
    const base = await startApp({ listGalleriesByOwnerId: async ownerId => {
      expect(ownerId).toBe('owner-1');
      return [{ ...privateGallery, quick_draft_id: 'private-draft' }];
    }, listPublishedGalleries: async () => [{ ...publishedGallery, quick_draft_id: 'must-not-leak' }] });
    expect((await fetch(`${base}/api/galleries/mine`)).status).toBe(401);
    const mine = await fetch(`${base}/api/galleries/mine`, { headers: { authorization: `Bearer ${ownerToken}` } });
    expect((await mine.json()).galleries[0].quickDraftId).toBe('private-draft');
    const publicResponse = await fetch(`${base}/api/galleries/published`);
    expect((await publicResponse.json()).galleries[0]).not.toHaveProperty('quickDraftId');
  });
  it('returns summaries and a cursor without scene or private share metadata', async () => {
    const base = await startApp({ listPublishedGalleries: async (options) => {
      expect(options).toEqual({ limit: 1, after: null });
      return ['b', 'a'].map(id => ({ ...publishedGallery, id, updated_at: '2026-09-10', cover_image: '/cover.png' }));
    } });
    const response = await fetch(`${base}/api/galleries/published?limit=1`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.galleries).toHaveLength(1);
    expect(body.galleries[0]).toMatchObject({ id: 'b', templateImage: '/cover.png' });
    for (const field of ['sceneJson', 'shareRole', 'shareExpiresAt', 'shareToken']) expect(body.galleries[0]).not.toHaveProperty(field);
    expect(JSON.parse(Buffer.from(body.nextCursor, 'base64url').toString())).toEqual({ at: '2026-09-10', id: 'b' });
  });
  it.each(['limit=0', 'limit=49', 'limit=1.5', 'limit=1&limit=2', 'after=broken', 'after=%25', 'after=e30'])('rejects malformed pages before database access: %s', async query => {
    const base = await startApp({ listPublishedGalleries: async () => { throw new Error('must not access database'); } });
    expect((await fetch(`${base}/api/galleries/published?${query}`)).status).toBe(400);
  });
  it('passes the boundary to the repository and ends the last page', async () => {
    const after = { at: '2026-09-10', id: 'b' };
    const base = await startApp({ listPublishedGalleries: async options => {
      expect(options).toEqual({ limit: 12, after }); return [];
    } });
    const response = await fetch(`${base}/api/galleries/published?after=${Buffer.from(JSON.stringify(after)).toString('base64url')}`);
    expect(await response.json()).toEqual({ galleries: [], nextCursor: null });
  });
});

describe('gallery visit collection', () => {
  const visit = { visitorId: 'adf6ac46-3d6d-4c56-9dac-9b15e28fcb81', sessionId: 'd3d397d3-abbd-4fb9-bd62-d064530107c9', mode: '2d', activeSeconds: 0, itemDwellSeconds: {} };
  const send = async (overrides = {}, { galleryId = 'published-gallery', token, shareToken, body = visit } = {}) => fetch(`${await startApp(overrides)}/api/galleries/${galleryId}/visits`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(shareToken ? { 'x-gallery-share-token': shareToken } : {}) }, body: JSON.stringify(body),
  });
  it('records anonymous public visits and authenticated participants', async () => {
    const records = [];
    const deps = { analyticsRepository: { record: async (input) => records.push(input) } };
    expect((await send(deps)).status).toBe(200);
    expect((await send(deps, { token: otherUserToken })).status).toBe(200);
    expect(records).toHaveLength(2);
  });
  it('excludes the verified gallery owner without writing', async () => {
    let writes = 0;
    const response = await send({ analyticsRepository: { record: async () => writes++ } }, { token: ownerToken });
    expect(await response.json()).toEqual({ ok: true, excluded: true });
    expect(writes).toBe(0);
  });
  it('requires valid viewer access for private galleries', async () => {
    const deps = { analyticsRepository: { record: async () => {} } };
    expect((await send(deps, { galleryId: 'gallery-1' })).status).toBe(401);
    expect((await send(deps, { galleryId: 'gallery-1', shareToken: 'wrong-gallery-token' })).status).toBe(403);
    expect((await send(deps, { galleryId: 'gallery-1', shareToken: 'viewer-token' })).status).toBe(200);
  });
  it('rejects invalid identity and negative duration', async () => {
    for (const body of [{ ...visit, visitorId: 'bad' }, { ...visit, activeSeconds: -1 }]) {
      expect((await send({}, { body })).status).toBe(400);
    }
  });
  it('ignores removed and unknown items without losing the remaining visit', async () => {
    let recorded;
    const response = await send({ analyticsRepository: { record: async (input) => { recorded = input; } } }, { body: { ...visit, activeSeconds: 15, itemDwellSeconds: { removed: 900, 'item-1': 10 } } });
    expect(response.status).toBe(200);
    expect(recorded).toMatchObject({ activeSeconds: 15, itemDwellSeconds: { 'item-1': 10 } });
  });
  it('requires owner login and validates dashboard filters', async () => {
    const base = await startApp({
      listGalleriesByOwnerId: async () => [privateGallery], listExhibitCommentsByGalleryOwnerId: async () => [],
      analyticsRepository: { list: async () => [], startedAt: async () => '2026-09-05T00:00:00Z' },
    });
    expect((await fetch(`${base}/api/galleries/admin/analytics`)).status).toBe(401);
    const headers = { authorization: `Bearer ${ownerToken}` };
    expect((await fetch(`${base}/api/galleries/admin/analytics?range=all`, { headers })).status).toBe(400);
    expect((await fetch(`${base}/api/galleries/admin/analytics?galleryId=another-owner-gallery`, { headers })).status).toBe(404);
    const response = await fetch(`${base}/api/galleries/admin/analytics?range=7d`, { headers });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.summary).toMatchObject({ totalVisits: 0, totalVisitors: 0, totalItems: 1 });
    expect(data.daily).toHaveLength(7);
    expect(data.galleries[0]).not.toHaveProperty('sceneJson');
  });
});

describe('comment deletion capability', () => {
  it.each([
    ['guest', undefined, false],
    ['owner', ownerToken, true],
    ['same-name visitor', sameNameUserToken, false],
  ])('reports owner-only deletion capability for %s', async (_label, token, canDelete) => {
    const response = await commentRequest(await startApp(), { galleryId: 'published-gallery', token });
    expect(response.status).toBe(200);
    expect((await response.json()).canDelete).toBe(canDelete);
  });
});

function createDeps(overrides = {}) {
  const galleries = new Map([
    [privateGallery.id, privateGallery],
    ['published-gallery', { ...publishedGallery, id: 'published-gallery' }],
  ]);
  const shares = new Map([
    [privateGallery.share_token, privateGallery],
    ['expired-token', {
      ...privateGallery,
      share_token: 'expired-token',
      share_expires_at: '2020-01-01T00:00:00.000Z',
    }],
    ['wrong-gallery-token', {
      ...privateGallery,
      id: 'gallery-2',
      share_token: 'wrong-gallery-token',
    }],
    ['revoked-token', {
      ...privateGallery,
      share_token: 'revoked-token',
    }],
  ]);

  return {
    requireAuth: jwt.requireAuth,
    optionalAuth: jwt.optionalAuth,
    resolveGalleryAccess,
    commentLimiter: (_req, _res, next) => next(),
    getUserById: async (id) => ({
      id,
      name: id === privateGallery.owner_id ? 'Owner' : 'Other',
    }),
    getGalleryById: async (id) => galleries.get(id) || null,
    getGalleryByShareToken: async (token) => shares.get(token) || null,
    listExhibitCommentsByGalleryAndItem: async (galleryId, itemId) => [{
      id: 'comment-1',
      gallery_id: galleryId,
      item_id: itemId,
      user_name: 'Visitor',
      content: 'Hello',
      created_at: '2026-06-14T00:00:00.000Z',
    }],
    insertExhibitComment: async () => {},
    getExhibitCommentById: async () => ({
      id: 'comment-1',
      gallery_id: privateGallery.id,
      item_id: 'item-1',
      user_name: 'Visitor',
    }),
    deleteExhibitCommentById: async () => true,
    ...overrides,
  };
}

describe('quick gallery publication gate', () => {
  const publish = (baseUrl, token = ownerToken) => fetch(`${baseUrl}/api/galleries/${privateGallery.id}/publish`, {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: '{}',
  });

  it.each(['DRAFT_NOT_READY', 'SCENE_CHANGED', 'DRAFT_CHANGED', 'ASSET_COVERAGE_MISMATCH'])(
    'preserves %s from the atomic quick publication path without running the manual write', async (code) => {
      let manualWrites = 0;
      const status = code === 'ASSET_COVERAGE_MISMATCH' ? 422 : 409;
      const response = await publish(await startApp({
        publishQuickExhibition: async () => { throw Object.assign(new Error(code), { code, status }); },
        updateGalleryPublishById: async () => { manualWrites++; return true; },
      }));
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ code, message: code });
      expect(manualWrites).toBe(0);
    },
  );

  it('returns the existing gallery wrapper for an atomically published quick gallery', async () => {
    let manualWrites = 0;
    const response = await publish(await startApp({
      publishQuickExhibition: async (id, ownerId) => {
        expect(id).toBe(privateGallery.id);
        expect(ownerId).toBe(privateGallery.owner_id);
        return { ...privateGallery, is_published: 1, published_at: '2026-09-02T00:00:00.000Z' };
      },
      updateGalleryPublishById: async () => { manualWrites++; return true; },
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ gallery: { id: privateGallery.id, isPublished: true } });
    expect(manualWrites).toBe(0);
  });

  it('keeps older manual galleries on their existing publication path', async () => {
    let gallery = { ...privateGallery };
    let manualWrites = 0;
    const response = await publish(await startApp({
      getGalleryById: async () => gallery,
      publishQuickExhibition: async () => null,
      updateGalleryPublishById: async () => { manualWrites++; gallery = { ...gallery, is_published: 1 }; return true; },
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ gallery: { isPublished: true } });
    expect(manualWrites).toBe(1);
  });

  it('checks ownership before invoking quick publication', async () => {
    let calls = 0;
    const response = await publish(await startApp({ publishQuickExhibition: async () => { calls++; } }), otherUserToken);
    expect(response.status).toBe(404);
    expect(calls).toBe(0);
  });
});

async function startApp(overrides = {}) {
  const app = express();
  app.use(express.json());
  registerGalleryRoutes(app, createDeps(overrides));

  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  servers.push(server);

  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
}

function commentRequest(baseUrl, {
  galleryId = privateGallery.id,
  method = 'GET',
  itemId = 'item-1',
  token,
  shareToken,
} = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (shareToken) headers['x-gallery-share-token'] = shareToken;
  if (method === 'POST') headers['content-type'] = 'application/json';

  return fetch(`${baseUrl}/api/galleries/${galleryId}/items/${itemId}/comments`, {
    method,
    headers,
    body: method === 'POST'
      ? JSON.stringify({ userName: 'Visitor', content: 'Hello' })
      : undefined,
  });
}

function deleteComment(baseUrl, {
  galleryId = privateGallery.id,
  itemId = 'item-1',
  commentId = 'comment-1',
  token,
  shareToken,
} = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (shareToken) headers['x-gallery-share-token'] = shareToken;
  return fetch(
    `${baseUrl}/api/galleries/${galleryId}/items/${itemId}/comments/${commentId}`,
    { method: 'DELETE', headers },
  );
}

function galleryDetailRequest(baseUrl, { galleryId = privateGallery.id, token } = {}) {
  const headers = token ? { authorization: `Bearer ${token}` } : {};
  return fetch(`${baseUrl}/api/galleries/${galleryId}`, { headers });
}

function sharedGalleryRequest(baseUrl, {
  method = 'GET',
  shareToken,
  body,
} = {}) {
  const headers = {};
  if (shareToken) headers['x-gallery-share-token'] = shareToken;
  if (body) headers['content-type'] = 'application/json';
  return fetch(`${baseUrl}/api/share/galleries`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(
    (server) => new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }),
  ));
});

describe('gallery comment authorization', () => {
  it('includes the comment lookup in production gallery dependencies', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'server', 'config', 'deps.js'),
      'utf8',
    );
    const galleryDependencies = source.match(/gallery:\s*\{([\s\S]*?)\n\s*\},\n\s*(?:agent|graduation|quickExhibition|media):/)?.[1];

    expect(galleryDependencies).toContain('getExhibitCommentById,');
  });

  it.each(['GET', 'POST'])(
    'returns 401 for anonymous %s on a private gallery',
    async (method) => {
      const response = await commentRequest(await startApp(), { method });
      expect(response.status).toBe(401);
    },
  );

  it.each([
    ['GET', 200],
    ['POST', 201],
  ])('allows anonymous %s on a published gallery', async (method, status) => {
    const response = await commentRequest(await startApp(), {
      galleryId: 'published-gallery',
      method,
    });
    expect(response.status).toBe(status);
  });

  it.each([
    ['GET', 200],
    ['POST', 201],
  ])('allows the owner to %s private gallery comments', async (method, status) => {
    const response = await commentRequest(await startApp(), {
      method,
      token: ownerToken,
    });
    expect(response.status).toBe(status);
  });

  it.each([
    ['GET', 200],
    ['POST', 201],
  ])('allows a valid viewer share to %s private gallery comments', async (method, status) => {
    const response = await commentRequest(await startApp(), {
      method,
      shareToken: privateGallery.share_token,
    });
    expect(response.status).toBe(status);
  });

  it('returns 410 for an expired share', async () => {
    const expiredGallery = {
      ...privateGallery,
      share_token: 'expired-token',
      share_expires_at: '2020-01-01T00:00:00.000Z',
    };
    const response = await commentRequest(await startApp({
      getGalleryById: async () => expiredGallery,
      getGalleryByShareToken: async () => expiredGallery,
    }), {
      shareToken: 'expired-token',
    });
    expect(response.status).toBe(410);
  });

  it.each(['unknown-token', 'wrong-gallery-token'])(
    'returns 403 for invalid share token %s',
    async (shareToken) => {
      const response = await commentRequest(await startApp(), { shareToken });
      expect(response.status).toBe(403);
    },
  );

  it('allows the owner despite an invalid share header', async () => {
    const response = await commentRequest(await startApp(), {
      token: ownerToken,
      shareToken: 'unknown-token',
    });
    expect(response.status).toBe(200);
  });

  it('returns 403 for a revoked share token', async () => {
    const response = await commentRequest(await startApp(), {
      shareToken: 'revoked-token',
    });
    expect(response.status).toBe(403);
  });

  it('returns 403 for an authenticated non-owner without a share', async () => {
    const response = await commentRequest(await startApp(), {
      token: otherUserToken,
    });
    expect(response.status).toBe(403);
  });

  it.each(['GET', 'POST'])('returns 404 for %s on a missing gallery', async (method) => {
    const response = await commentRequest(await startApp(), {
      galleryId: 'missing-gallery',
      method,
    });
    expect(response.status).toBe(404);
  });

  it('uses only the share header and ignores a query parameter', async () => {
    const baseUrl = await startApp();
    const response = await fetch(
      `${baseUrl}/api/galleries/${privateGallery.id}/items/item-1/comments?shareToken=viewer-token`,
    );
    expect(response.status).toBe(401);
  });

  it.each(['GET', 'POST'])(
    'returns 404 when %s targets an item absent from the scene',
    async (method) => {
      const response = await commentRequest(await startApp(), {
        galleryId: 'published-gallery',
        itemId: 'arbitrary-item',
        method,
      });
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ message: 'item not found' });
    },
  );

  it.each([
    null,
    '{malformed',
    JSON.stringify({}),
    JSON.stringify({ items: null }),
  ])('fails closed when scene_json cannot identify items: %s', async (sceneJson) => {
    const gallery = { ...publishedGallery, scene_json: sceneJson };
    const response = await commentRequest(await startApp({
      getGalleryById: async () => gallery,
    }), {
      galleryId: gallery.id,
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ message: 'item not found' });
  });

  it('applies the comment limiter before the N+1 database insertion', async () => {
    let limiterCalls = 0;
    let inserts = 0;
    const baseUrl = await startApp({
      commentLimiter: (_req, res, next) => {
        limiterCalls += 1;
        if (limiterCalls > 1) {
          return res.status(429).json({ message: 'too many comments' });
        }
        return next();
      },
      insertExhibitComment: async () => {
        inserts += 1;
      },
    });

    expect((await commentRequest(baseUrl, {
      galleryId: 'published-gallery',
      method: 'POST',
    })).status).toBe(201);
    expect((await commentRequest(baseUrl, {
      galleryId: 'published-gallery',
      method: 'POST',
    })).status).toBe(429);
    expect(limiterCalls).toBe(2);
    expect(inserts).toBe(1);
  });
});

describe('gallery detail authorization', () => {
  it('allows the owner to read an unpublished gallery', async () => {
    const response = await galleryDetailRequest(await startApp(), {
      token: ownerToken,
    });
    expect(response.status).toBe(200);
    expect((await response.json()).gallery.id).toBe(privateGallery.id);
  });

  it('returns 404 when another authenticated user reads a gallery by ID', async () => {
    const response = await galleryDetailRequest(await startApp(), {
      token: otherUserToken,
    });
    expect(response.status).toBe(404);
  });

  it('returns 401 for anonymous gallery detail reads', async () => {
    const response = await galleryDetailRequest(await startApp());
    expect(response.status).toBe(401);
  });
});

describe('gallery capability header API', () => {
  it('reads a shared gallery through the capability header without leaking token fields', async () => {
    const response = await sharedGalleryRequest(await startApp(), {
      shareToken: privateGallery.share_token,
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.access).toEqual({ viaShare: true, role: 'viewer' });
    expect(body.gallery.id).toBe(privateGallery.id);
    expect(JSON.stringify(body)).not.toContain('share_token');
    expect(JSON.stringify(body)).not.toContain(privateGallery.share_token);
  });

  it('returns 410 for an expired capability', async () => {
    const response = await sharedGalleryRequest(await startApp(), {
      shareToken: 'expired-token',
    });
    expect(response.status).toBe(410);
  });

  it('returns 404 for a missing or revoked capability', async () => {
    expect((await sharedGalleryRequest(await startApp())).status).toBe(404);
    expect((await sharedGalleryRequest(await startApp({
      getGalleryByShareToken: async () => null,
    }), { shareToken: 'revoked-token' })).status).toBe(404);
  });

  it('forbids PATCH through a viewer capability', async () => {
    const response = await sharedGalleryRequest(await startApp(), {
      method: 'PATCH',
      shareToken: privateGallery.share_token,
      body: { title: 'Changed', expectedRevision: 0 },
    });
    expect(response.status).toBe(403);
  });

  it('allows PATCH through an editor capability', async () => {
    const editorGallery = {
      ...privateGallery,
      share_token: 'editor-token',
      share_role: 'editor',
    };
    let update = null;
    const response = await sharedGalleryRequest(await startApp({
      getGalleryByShareToken: async (token) => (
        token === editorGallery.share_token ? editorGallery : null
      ),
      getGalleryById: async (id) => (
        id === editorGallery.id
          ? { ...editorGallery, title: update?.title || editorGallery.title }
          : null
      ),
      updateGalleryById: async (id, ownerId, changes) => {
        update = { id, ownerId, ...changes };
        return true;
      },
    }), {
      method: 'PATCH',
      shareToken: editorGallery.share_token,
      body: { title: 'Changed', expectedRevision: 0 },
    });

    expect(response.status).toBe(200);
    expect(update).toEqual(expect.objectContaining({
      id: editorGallery.id,
      ownerId: editorGallery.owner_id,
      title: 'Changed',
    }));
    expect(JSON.stringify(await response.json())).not.toContain('editor-token');
  });
});

describe('gallery persistent asset validation', () => {
  it('rejects nested blob URLs before creating a gallery', async () => {
    let inserts = 0;
    const response = await fetch(`${await startApp({
      insertGallery: async () => {
        inserts += 1;
      },
    })}/api/galleries`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Gallery',
        description: 'Description',
        templateTitle: 'Template',
        templateImage: 'https://example.com/template.jpg',
        category: 'art',
        sceneJson: JSON.stringify({ items: [{ content: 'blob:https://example.com/local-id' }] }),
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      message: expect.stringMatching(/blob URL/i),
    });
    expect(inserts).toBe(0);
  });

  it('rejects nested blob URLs before updating a gallery', async () => {
    let updates = 0;
    const response = await fetch(`${await startApp({
      updateGalleryById: async () => {
        updates += 1;
        return true;
      },
    })}/api/galleries/${privateGallery.id}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sceneJson: JSON.stringify({ room: { textureUrl: 'blob:null/local-texture' } }),
      }),
    });

    expect(response.status).toBe(400);
    expect(updates).toBe(0);
  });

  it('rejects publishing a stored scene that contains a blob URL', async () => {
    let publishes = 0;
    const gallery = {
      ...privateGallery,
      scene_json: JSON.stringify({ items: [{ nested: { src: 'blob:https://example.com/local-video' } }] }),
    };
    const response = await fetch(`${await startApp({
      getGalleryById: async (id) => (id === gallery.id ? gallery : null),
      updateGalleryPublishById: async () => {
        publishes += 1;
        return true;
      },
    })}/api/galleries/${gallery.id}/publish`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
    expect(publishes).toBe(0);
  });

  it('rejects blob URLs submitted through an editor share', async () => {
    let updates = 0;
    const editorGallery = {
      ...privateGallery,
      share_token: 'editor-token',
      share_role: 'editor',
    };
    const response = await sharedGalleryRequest(await startApp({
      getGalleryByShareToken: async () => editorGallery,
      updateGalleryById: async () => {
        updates += 1;
        return true;
      },
    }), {
      method: 'PATCH',
      shareToken: editorGallery.share_token,
      body: { sceneJson: JSON.stringify({ items: [{ src: 'blob:local-preview-id' }] }) },
    });

    expect(response.status).toBe(400);
    expect(updates).toBe(0);
  });

  it.each([
    ['POST', '/api/galleries/gallery-1/upload-link', { itemId: 'item-1' }],
    ['GET', '/api/upload-links/upload-token', undefined],
    ['PATCH', '/api/upload-links/upload-token', { content: '/api/media/assets/artwork-1' }],
    ['DELETE', '/api/upload-links/upload-token', undefined],
  ])('retires the quick upload endpoint %s %s', async (method, endpoint, body) => {
    let updates = 0;
    const response = await fetch(`${await startApp({
      getGalleryUploadLinkByToken: async () => ({
        upload_token: 'upload-token',
        gallery_id: privateGallery.id,
        item_id: 'item-1',
      }),
      insertGalleryUploadLink: async () => { updates += 1; },
      revokeGalleryUploadLink: async () => { updates += 1; return true; },
      updateGalleryById: async () => {
        updates += 1;
        return true;
      },
    })}${endpoint}`, {
      method,
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'content-type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    expect(response.status).toBe(404);
    expect(updates).toBe(0);
  });
});

describe('gallery comment deletion', () => {
  it('allows the gallery owner to delete a matching comment', async () => {
    let deletes = 0;
    const response = await deleteComment(await startApp({
      deleteExhibitCommentById: async () => {
        deletes += 1;
        return true;
      },
    }), { token: ownerToken });

    expect(response.status).toBe(200);
    expect(deletes).toBe(1);
  });

  it('returns 403 for a non-owner even when the display name matches', async () => {
    let deletes = 0;
    const response = await deleteComment(await startApp({
      getUserById: async () => ({ id: 'user-3', name: 'Visitor' }),
      deleteExhibitCommentById: async () => {
        deletes += 1;
        return true;
      },
    }), { token: sameNameUserToken });

    expect(response.status).toBe(403);
    expect(deletes).toBe(0);
  });

  it('returns 401 for anonymous and share-token deletion attempts', async () => {
    expect((await deleteComment(await startApp())).status).toBe(401);
    expect((await deleteComment(await startApp(), {
      shareToken: privateGallery.share_token,
    })).status).toBe(401);
  });

  it.each([
    ['another gallery', { gallery_id: 'gallery-2', item_id: 'item-1' }],
    ['another item', { gallery_id: privateGallery.id, item_id: 'item-2' }],
  ])('returns 404 before deletion when the comment belongs to %s', async (_name, location) => {
    let deletes = 0;
    const response = await deleteComment(await startApp({
      getExhibitCommentById: async () => ({
        id: 'comment-1',
        user_name: 'Visitor',
        ...location,
      }),
      deleteExhibitCommentById: async () => {
        deletes += 1;
        return true;
      },
    }), { token: ownerToken });

    expect(response.status).toBe(404);
    expect(deletes).toBe(0);
  });
});
