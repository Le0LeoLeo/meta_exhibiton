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
  scene_json: JSON.stringify({ items: [{ id: 'item-1' }] }),
  share_token: 'viewer-token',
  share_role: 'viewer',
  share_expires_at: '2099-01-01T00:00:00.000Z',
};

const publishedGallery = {
  ...privateGallery,
  is_published: 1,
};

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
    const galleryDependencies = source.match(/gallery:\s*\{([\s\S]*?)\n\s*\},\n\s*growth:/)?.[1];

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
      body: { title: 'Changed' },
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
      body: { title: 'Changed' },
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

  it('rejects blob URLs submitted through an upload link', async () => {
    let updates = 0;
    const response = await fetch(`${await startApp({
      getGalleryUploadLinkByToken: async () => ({
        upload_token: 'upload-token',
        gallery_id: privateGallery.id,
        item_id: 'item-1',
      }),
      updateGalleryById: async () => {
        updates += 1;
        return true;
      },
    })}/api/upload-links/upload-token`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'blob:https://example.com/local-upload' }),
    });

    expect(response.status).toBe(400);
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
