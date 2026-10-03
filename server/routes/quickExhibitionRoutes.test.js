// @vitest-environment node
import express from 'express';
import sqlite3 from 'sqlite3';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createJwtHelpers } from '../auth/jwt.js';
import { createRequireActiveUser } from '../auth/activeUser.js';
import { initDb, updateGalleryById } from '../db.js';
import { getStatement, runStatement } from '../repositories/sqliteHelpers.js';
import { createQuickExhibitionRepository } from '../repositories/quickExhibitionRepository.js';
import { createQuickExhibitionService } from '../services/quickExhibitionService.js';
import { registerQuickExhibitionRoutes } from './quickExhibitionRoutes.js';
import { registerGalleryRoutes } from './galleryRoutes.js';

const jwt = createJwtHelpers({ secret: 'quick-exhibition-test-secret-32-characters' });
const token = jwt.signToken({ id: 'owner', email: 'owner@example.test', name: 'Owner' });
const otherToken = jwt.signToken({ id: 'other', email: 'other@example.test', name: 'Other' });
const servers = [];
const cleanup = [];
const draftId = randomUUID();
const root = {
  draftId, galleryId: randomUUID(), revision: 0, status: 'collecting',
  input: { title: 'My Art Exhibition', language: 'en', style: 'white-box', assets: [] },
  result: null, createdAt: '2026-09-02T00:00:00.000Z', updatedAt: '2026-09-02T00:00:00.000Z',
  limits: { maxAssets: 30, maxFileBytes: 15 * 1024 * 1024 },
};

async function startApp({ service, galleryDeps, getUserById = async () => ({ id: 'owner' }) } = {}) {
  const app = express();
  app.use(express.json());
  const methods = service ?? Object.fromEntries(['create', 'get', 'patch', 'build', 'apply', 'discard'].map((method) => [method, vi.fn(async () => root)]));
  registerQuickExhibitionRoutes(app, { requireAuth: createRequireActiveUser({ requireAuth: jwt.requireAuth, getUserById }), service: methods });
  if (galleryDeps) registerGalleryRoutes(app, { requireAuth: jwt.requireAuth, ...galleryDeps });
  const server = await new Promise((resolve) => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  servers.push(server);
  return { url: `http://127.0.0.1:${server.address().port}`, service: methods };
}

function request(url, { method = 'GET', suffix = '', body, auth = token, cookie = false, id = draftId } = {}) {
  return fetch(`${url}/api/quick-exhibitions/${id}${suffix}`, {
    method,
    headers: { ...(auth ? cookie ? { cookie: `mrei_session=${auth}` } : { authorization: `Bearer ${auth}` } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function startPersistedApp() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'quick-exhibition-http-'));
  const filename = path.join(directory, 'app.db');
  const database = new sqlite3.Database(filename);
  cleanup.push(async () => {
    await new Promise((resolve, reject) => database.close((error) => error ? reject(error) : resolve()));
    await rm(directory, { recursive: true, force: true });
  });
  await initDb(database);
  await runStatement(database, "INSERT INTO users (id, email, name, password_hash, created_at) VALUES ('owner', 'owner@test.test', 'Owner', 'hash', 'now')");
  const assetId = randomUUID();
  await runStatement(database, `INSERT INTO media_assets
    (id, owner_id, storage_file_name, original_file_name, mime_type, size_bytes, width, height, created_at, updated_at)
    VALUES (?, 'owner', ?, 'Art.png', 'image/png', 100, 400, 600, 'now', 'now')`, [assetId, `${assetId}.png`]);
  const service = createQuickExhibitionService({ repository: createQuickExhibitionRepository({ filename }),
    signMediaPreviewToken: jwt.signMediaPreviewToken, updateGalleryById });
  const manualPublish = vi.fn(async (id, ownerId, updates) => (await runStatement(database,
    'UPDATE galleries SET is_published = ?, published_at = ? WHERE id = ? AND owner_id = ?',
    [updates.isPublished ? 1 : 0, updates.publishedAt, id, ownerId])).changes);
  const { url } = await startApp({ service, galleryDeps: {
    getGalleryById: (id) => getStatement(database, 'SELECT * FROM galleries WHERE id = ?', [id]),
    getGalleryByShareToken: (shareToken) => getStatement(database, 'SELECT * FROM galleries WHERE share_token = ?', [shareToken]),
    updateGalleryById: (id, ownerId, updates) => updateGalleryById(id, ownerId, updates, database),
    saveQuickExhibitionFromEditor: service.saveFromEditor,
    publishQuickExhibition: service.publish,
    updateGalleryPublishById: manualPublish,
  } });
  return { url, database, service, assetId, manualPublish };
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))));
  for (const dispose of cleanup.splice(0)) await dispose();
});

describe('quick exhibition routes', () => {
  it.each([
    ['PUT', '', 'create', { language: 'en' }],
    ['GET', '', 'get', undefined],
    ['PATCH', '', 'patch', { expectedRevision: 0, title: 'Name' }],
    ['POST', '/build', 'build', { expectedRevision: 0, requestId: randomUUID() }],
    ['POST', '/apply', 'apply', { expectedRevision: 0, requestId: randomUUID() }],
    ['POST', '/discard', 'discard', { expectedRevision: 0, requestId: randomUUID() }],
  ])('%s %s requires auth and returns the draft at the root', async (method, suffix, operation, body) => {
    const { url, service } = await startApp();
    expect((await request(url, { method, suffix, body, auth: null })).status).toBe(401);
    const response = await request(url, { method, suffix, body });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(root);
    expect(service[operation]).toHaveBeenCalledWith(draftId, 'owner', body);
  });

  it('uses the same auth.sub for cookie sessions and rejects deleted accounts', async () => {
    const { url, service } = await startApp();
    expect((await request(url, { cookie: true })).status).toBe(200);
    expect(service.get).toHaveBeenCalledWith(draftId, 'owner', undefined);
    const deleted = await startApp({ getUserById: async () => null });
    expect((await request(deleted.url)).status).toBe(401);
  });

  it.each([
    ['PATCH', '', { expectedRevision: -1 }],
    ['PATCH', '', { expectedRevision: 0, scene: {} }],
    ['PATCH', '', { expectedRevision: 0, assets: [{ assetId: randomUUID(), clientFileId: 'local', order: 0, width: 800, height: 400 }] }],
    ['PATCH', '', { expectedRevision: 0, assets: [{ assetId: randomUUID(), clientFileId: 'local', order: 0, url: 'https://example.com/art.png' }] }],
    ['PUT', '', { language: 'fr' }],
    ['PUT', '', { style: 'museum' }],
    ['POST', '/build', { expectedRevision: 0, requestId: 'invalid' }],
    ['POST', '/apply', { requestId: randomUUID() }],
    ['POST', '/discard', { requestId: randomUUID() }],
    ['POST', '/discard', { expectedRevision: 0, requestId: randomUUID(), scene: {} }],
  ])('rejects invalid or untrusted %s %s bodies', async (method, suffix, body) => {
    const { url, service } = await startApp();
    const response = await request(url, { method, suffix, body });
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('INVALID_INPUT');
    for (const mock of Object.values(service)) expect(mock).not.toHaveBeenCalled();
  });

  it('rejects invalid draft IDs and too many assets with the documented code', async () => {
    const { url } = await startApp();
    expect((await request(url, { id: 'not-uuid' })).status).toBe(400);
    const response = await request(url, { method: 'PATCH', body: { expectedRevision: 0,
      assets: Array.from({ length: 31 }, (_, order) => ({ assetId: randomUUID(), clientFileId: `c-${order}`, order })) } });
    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe('TOO_MANY_ASSETS');
  });

  it.each([[404, 'DRAFT_NOT_FOUND'], [409, 'DRAFT_CHANGED'], [409, 'SCENE_CHANGED'], [409, 'REQUEST_ID_REUSED'], [422, 'ASSET_COVERAGE_MISMATCH']])(
    'preserves service errors %i %s', async (status, code) => {
      const { url } = await startApp({ service: { get: async () => { throw Object.assign(new Error(code), { status, code }); } } });
      const response = await request(url);
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ code, message: code });
    },
  );

  it('restores and publishes a real persisted quick gallery through the existing HTTP API', async () => {
    const { url, assetId, manualPublish } = await startPersistedApp();
    const created = await (await request(url, { method: 'PUT', body: { language: 'en' } })).json();
    expect((await request(url, { auth: otherToken })).status).toBe(404);
    const publish = () => fetch(`${url}/api/galleries/${created.galleryId}/publish`, { method: 'POST', headers: { authorization: `Bearer ${token}` } });
    expect((await publish()).status).toBe(409);
    const patched = await (await request(url, { method: 'PATCH', body: { expectedRevision: 0, assets: [{ assetId, clientFileId: 'one', order: 0 }] } })).json();
    const operation = { expectedRevision: patched.revision, requestId: randomUUID() };
    const builtResponse = await request(url, { method: 'POST', suffix: '/build', body: operation });
    expect(builtResponse.status).toBe(200);
    const built = await builtResponse.json();
    expect(built.status).toBe('ready');
    const retry = await (await request(url, { method: 'POST', suffix: '/build', body: operation })).json();
    expect(retry.revision).toBe(built.revision);
    const restored = await (await request(url)).json();
    expect(restored.result).toEqual(built.result);
    expect(restored.input.assets[0].previewUrl).toContain('?accessToken=');
    const edit = await request(url, { method: 'PATCH', body: { expectedRevision: built.revision, title: 'Candidate title' } });
    expect(edit.status).toBe(200);
    const candidate = await (await request(url, { method: 'POST', suffix: '/build',
      body: { expectedRevision: (await edit.json()).revision, requestId: randomUUID() } })).json();
    expect(candidate.status).toBe('candidate_ready');
    const discardBody = { expectedRevision: candidate.revision, requestId: randomUUID() };
    const discardedResponse = await request(url, { method: 'POST', suffix: '/discard', body: discardBody });
    expect(discardedResponse.status).toBe(200);
    const discarded = await discardedResponse.json();
    expect(discarded.status).toBe('ready');
    expect(discarded.input.title).toBe(built.input.title);
    expect(discarded.result).toEqual(built.result);
    const discardedRetry = await (await request(url, { method: 'POST', suffix: '/discard', body: discardBody })).json();
    expect(discardedRetry.revision).toBe(discarded.revision);
    const staleDiscard = await request(url, { method: 'POST', suffix: '/discard', body: { ...discardBody, requestId: randomUUID() } });
    expect(staleDiscard.status).toBe(409);
    expect((await staleDiscard.json()).code).toBe('DRAFT_CHANGED');
    const published = await publish();
    expect(published.status).toBe(200);
    expect(await published.json()).toMatchObject({ gallery: { id: created.galleryId, isPublished: true, sceneJson: JSON.stringify(built.result.scene) } });
    expect((await (await request(url)).json()).status).toBe('published');
    expect(manualPublish).not.toHaveBeenCalled();
  }, 15_000);

  it.each(['owner', 'editor-share'])('hands an advanced %s scene save to manual publishing and blocks quick resume', async (via) => {
    const { url, database, service, assetId, manualPublish } = await startPersistedApp();
    const draft = await service.create(draftId, 'owner', { language: 'en' });
    await service.patch(draftId, 'owner', { expectedRevision: 0, assets: [{ assetId, clientFileId: 'one', order: 0 }] });
    const ready = await service.build(draftId, 'owner', { expectedRevision: 1, requestId: randomUUID() });
    const sceneJson = JSON.stringify(ready.result.scene);
    const galleryRevision = async () => (await getStatement(database, 'SELECT revision FROM galleries WHERE id = ?', [draft.galleryId])).revision;
    const galleryPatch = async (body, auth = token) => fetch(`${url}/api/galleries/${draft.galleryId}`, {
      method: 'PATCH', headers: { authorization: `Bearer ${auth}`, 'content-type': 'application/json' }, body: JSON.stringify({ ...body, expectedRevision: await galleryRevision() }),
    });
    expect((await galleryPatch({ sceneJson }, otherToken)).status).toBe(404);
    expect((await galleryPatch({ sceneJson: '{"content":"blob:local"}' })).status).toBe(400);
    expect((await galleryPatch({ title: 'Metadata only' })).status).toBe(200);
    expect((await service.get(draftId, 'owner')).status).toBe('ready');
    expect((await getStatement(database, 'SELECT scene_json FROM galleries WHERE id = ?', [draft.galleryId])).scene_json).toBe(sceneJson);
    await service.patch(draftId, 'owner', { expectedRevision: ready.revision, title: 'Quick candidate' });
    const candidate = await service.build(draftId, 'owner', { expectedRevision: ready.revision + 1, requestId: randomUUID() });
    const publish = () => fetch(`${url}/api/galleries/${draft.galleryId}/publish`, { method: 'POST', headers: { authorization: `Bearer ${token}` } });
    expect((await publish()).status).toBe(409);
    const manual = structuredClone(ready.result.scene);
    manual.items[0].title = 'Manually edited artwork';
    manual.items[0].position[0] += 0.4;
    const manualJson = JSON.stringify(manual);
    let saved;
    if (via === 'editor-share') {
      await runStatement(database, "UPDATE galleries SET share_token = 'editor-share', share_role = 'viewer' WHERE id = ?", [draft.galleryId]);
      const sharedPatch = async () => fetch(`${url}/api/share/galleries`, { method: 'PATCH',
        headers: { 'x-gallery-share-token': 'editor-share', 'content-type': 'application/json' }, body: JSON.stringify({ sceneJson: manualJson, expectedRevision: await galleryRevision() }),
      });
      expect((await sharedPatch()).status).toBe(403);
      expect((await service.get(draftId, 'owner')).status).toBe('candidate_ready');
      await runStatement(database, "UPDATE galleries SET share_role = 'editor' WHERE id = ?", [draft.galleryId]);
      saved = await sharedPatch();
    } else saved = await galleryPatch({ sceneJson: manualJson });
    expect(saved.status).toBe(200);
    expect(await saved.json()).toMatchObject({ gallery: { id: draft.galleryId, sceneJson: manualJson } });
    const expectedError = { code: 'DRAFT_EDITOR_MANAGED', message: 'DRAFT_EDITOR_MANAGED', galleryId: draft.galleryId };
    for (const [method, suffix, body] of [
      ['GET', '', undefined], ['PUT', '', {}], ['PATCH', '', { expectedRevision: candidate.revision, title: 'Quick overwrite' }],
      ...['build', 'apply', 'discard'].map((operation) => ['POST', `/${operation}`, { expectedRevision: candidate.revision, requestId: randomUUID() }]),
    ]) {
      const blocked = await request(url, { method, suffix, body });
      expect(blocked.status).toBe(409);
      expect(await blocked.json()).toEqual(expectedError);
    }
    expect((await request(url, { auth: otherToken })).status).toBe(404);
    const published = await publish();
    expect(published.status).toBe(200);
    expect(await published.json()).toMatchObject({ gallery: { isPublished: true, sceneJson: manualJson } });
    expect(manualPublish).toHaveBeenCalledTimes(1);
  }, 15_000);
});
