// @vitest-environment node
import express from 'express';
import sqlite3 from 'sqlite3';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { beforeEach, afterEach, it, expect } from 'vitest';
import { initDb } from '../db.js';
import { getStatement as get, runStatement as run } from '../repositories/sqliteHelpers.js';
import { createGalleryFolderRepository } from '../repositories/galleryFolderRepository.js';
import { registerGalleryFolderRoutes } from './galleryFolderRoutes.js';

let directory, db, repo, server, base;
const create = async (name, parentId = null, owner = 'owner') => {
  const data = await repo.create(owner, { name, parentId });
  return data.folders.find(f => f.name === name);
};
const request = (url = '', method = 'GET', body, owner = 'owner') => fetch(`${base}/api/gallery-folders${url}`, {
  method, headers: { 'content-type': 'application/json', ...(owner ? { 'x-test-user': owner } : {}) },
  body: body === undefined ? undefined : JSON.stringify(body),
});
beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'gallery-folder-test-'));
  db = new sqlite3.Database(path.join(directory, 'app.db'));
  await initDb(db);
  for (const id of ['owner', 'other']) {
    await run(db, "INSERT INTO users(id,email,name,password_hash,created_at) VALUES(?,?,?,'hash','now')", [id, `${id}@example.test`, id]);
    await run(db, `INSERT INTO galleries(id,owner_id,title,description,template_title,template_image,category,created_at,updated_at,scene_json,share_token,is_published)
      VALUES(?,?,'Title','Description','Blank','image','art','now','now','{"items":[]}',?,1)`, [id + '-gallery', id, id + '-share']);
  }
  repo = createGalleryFolderRepository({ filename: path.join(directory, 'app.db') });
  const app = express(); app.use(express.json());
  registerGalleryFolderRoutes(app, { repository: repo, readMediaFile: async () => Buffer.from('picture'), requireAuth: (req, res) => {
    if (!req.header('x-test-user')) { res.status(401).end(); return null; }
    return { sub: req.header('x-test-user') };
  } });
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (db) await new Promise(resolve => db.close(resolve));
  if (directory && path.dirname(directory) === path.resolve(os.tmpdir()) && path.basename(directory).startsWith('gallery-folder-test-')) await rm(directory, { recursive: true, force: true });
});

it('persists nested folders and moves without changing gallery content or sharing', async () => {
  const before = await get(db, 'SELECT * FROM galleries WHERE id=?', ['owner-gallery']);
  const parent = await create('Portfolio'); const child = await create('2026', parent.id);
  expect((await request('/move', 'POST', { galleryIds: ['owner-gallery'], folderId: child.id })).status).toBe(200);
  await repo.update('owner', child.id, { name: 'Final works' });
  const reopened = createGalleryFolderRepository({ filename: path.join(directory, 'app.db') });
  expect((await reopened.list('owner')).memberships).toEqual([{ galleryId: 'owner-gallery', folderId: child.id }]);
  expect((await reopened.list('owner')).folders.find(f => f.id === child.id)).toMatchObject({ name: 'Final works', parentId: parent.id });
  expect(await get(db, 'SELECT * FROM galleries WHERE id=?', ['owner-gallery'])).toEqual(before);
  await repo.moveGalleries('owner', { galleryIds: ['owner-gallery'], folderId: null });
  expect((await repo.list('owner')).memberships).toEqual([]);
});

it('hides legacy boxes from folders while keeping their stored records', async () => {
  const folder = await create('Portfolio');
  await run(db, "UPDATE galleries SET is_box=1 WHERE id='owner-gallery'");
  await run(db, 'INSERT INTO gallery_folder_memberships(gallery_id,folder_id) VALUES(?,?)', ['owner-gallery', folder.id]);
  expect((await repo.list('owner')).memberships).toEqual([]);
  const { token } = await repo.share('owner', folder.id);
  expect((await repo.shared(token)).galleries).toEqual([]);
  await expect(repo.sharedGallery(token, 'owner-gallery')).rejects.toMatchObject({ code: 'FOLDER_SHARE_UNAVAILABLE' });
  await expect(repo.moveGalleries('owner', { galleryIds: ['owner-gallery'], folderId: folder.id })).rejects.toMatchObject({ code: 'GALLERY_NOT_FOUND' });
  expect(await get(db, 'SELECT id FROM galleries WHERE id=?', ['owner-gallery'])).toEqual({ id: 'owner-gallery' });
});

it('requires authentication and rejects invalid, foreign and mixed-owner operations atomically', async () => {
  const own = await create('Own'); const foreign = await create('Foreign', null, 'other');
  expect((await request('', 'GET', undefined, null)).status).toBe(401);
  expect((await request('', 'POST', { name: '   ' })).status).toBe(400);
  expect((await request('', 'POST', { name: 'Invalid', parentId: foreign.id })).status).toBe(404);
  expect((await request(`/${foreign.id}`, 'PATCH', { name: 'Stolen' })).status).toBe(404);
  expect((await request(`/${foreign.id}`, 'DELETE')).status).toBe(404);
  expect((await request('/move', 'POST', { galleryIds: ['owner-gallery'], folderId: foreign.id })).status).toBe(404);
  expect((await request('/move', 'POST', { galleryIds: ['owner-gallery', 'other-gallery'], folderId: own.id })).status).toBe(404);
  expect((await repo.list('owner')).memberships).toEqual([]);
  expect((await repo.list('owner')).folders).toHaveLength(1);
});

it('prevents direct and nested cycles including concurrent opposing moves', async () => {
  const a = await create('A'); const b = await create('B', a.id);
  expect((await request(`/${a.id}`, 'PATCH', { parentId: b.id })).status).toBe(409);
  expect((await request(`/${a.id}`, 'PATCH', { parentId: a.id })).status).toBe(409);
  await repo.update('owner', b.id, { parentId: null });
  const result = await Promise.allSettled([repo.update('owner', a.id, { parentId: b.id }), repo.update('owner', b.id, { parentId: a.id })]);
  expect(result.filter(r => r.status === 'fulfilled')).toHaveLength(1);
});

it('deleting a folder promotes children and exhibitions, never deletes gallery content', async () => {
  const a = await create('A'); const b = await create('B', a.id); const c = await create('C', b.id);
  await repo.moveGalleries('owner', { galleryIds: ['owner-gallery'], folderId: b.id });
  await repo.remove('owner', b.id);
  let state = await repo.list('owner');
  expect(state.folders.find(f => f.id === c.id).parentId).toBe(a.id);
  expect(state.memberships[0].folderId).toBe(a.id);
  await repo.remove('owner', a.id);
  state = await repo.list('owner');
  expect(state.folders[0].parentId).toBeNull(); expect(state.memberships).toEqual([]);
  expect(await get(db, 'SELECT id FROM galleries WHERE id=?', ['owner-gallery'])).not.toBeNull();
});

it('cleans folder data when the owner account is removed and tolerates repeated schema initialization', async () => {
  const folder = await create('Owned');
  await repo.share('owner', folder.id);
  await repo.moveGalleries('owner', { galleryIds: ['owner-gallery'], folderId: folder.id });
  await initDb(db);
  expect((await repo.list('owner')).memberships).toHaveLength(1);
  await run(db, 'DELETE FROM users WHERE id=?', ['owner']);
  expect(await repo.list('owner')).toEqual({ folders: [], memberships: [] });
  expect(await get(db, 'SELECT * FROM gallery_folder_memberships')).toBeNull();
  expect(await get(db, 'SELECT * FROM gallery_folder_shares')).toBeNull();
});

const sharedRequest = (token, suffix = '') => fetch(`${base}/api/shared-folders${suffix}`, { headers: { 'x-folder-share-token': token } });

it('requires deliberate owner action, keeps a stable share and rotates revoked tokens', async () => {
  const folder = await create('Portfolio');
  expect(await repo.shareInfo('owner', folder.id)).toEqual({ token: null });
  expect((await request(`/${folder.id}/share`, 'POST', undefined, 'other')).status).toBe(404);
  expect((await request(`/${folder.id}/share`, 'GET', undefined, 'other')).status).toBe(404);
  expect((await request(`/${folder.id}/share`, 'DELETE', undefined, 'other')).status).toBe(404);
  const response = await request(`/${folder.id}/share`, 'POST');
  expect(response.headers.get('cache-control')).toContain('no-store');
  const { token } = await response.json();
  expect(token).toMatch(/^[a-f0-9]{64}$/);
  expect(await repo.share('owner', folder.id)).toEqual({ token });
  expect((await sharedRequest(token)).status).toBe(200);
  await repo.revoke('owner', folder.id);
  expect((await sharedRequest(token)).status).toBe(404);
  expect((await repo.share('owner', folder.id)).token).not.toBe(token);
  expect((await sharedRequest(token)).status).toBe(404);
});

it('shares private descendant exhibitions without exposing outside metadata or independent tokens', async () => {
  const root = await create('Shared'); const child = await create('Child', root.id); const outside = await create('Secret outside');
  const foreign = await create('Other account', null, 'other');
  await run(db, 'UPDATE galleries SET is_published=0 WHERE id=?', ['owner-gallery']);
  const before = await get(db, 'SELECT * FROM galleries WHERE id=?', ['owner-gallery']);
  await repo.moveGalleries('owner', { galleryIds: ['owner-gallery'], folderId: child.id });
  const { token } = await repo.share('owner', root.id);
  const list = await (await sharedRequest(token, `?folder=${child.id}`)).json();
  expect(list.galleries).toEqual([{ id: 'owner-gallery', title: 'Title', description: 'Description' }]);
  expect(list.folders.map(f => f.name).sort()).toEqual(['Child','Shared']);
  expect(list.folders.find(f => f.id === root.id).parentId).toBeNull();
  for (const id of [outside.id, foreign.id]) expect((await sharedRequest(token, `?folder=${id}`)).status).toBe(404);
  const detail = await (await sharedRequest(token, '/galleries/owner-gallery')).json();
  expect(Object.keys(detail).sort()).toEqual(['description','id','sceneJson','title']);
  expect(JSON.stringify(list)).not.toContain('owner-share');
  expect((await sharedRequest(token, '/galleries/other-gallery')).status).toBe(404);
  expect(await get(db, 'SELECT * FROM galleries WHERE id=?', ['owner-gallery'])).toEqual(before);
  await repo.update('owner', child.id, { parentId: outside.id });
  expect((await sharedRequest(token, '/galleries/owner-gallery')).status).toBe(404);
  await repo.update('owner', child.id, { parentId: root.id });
  expect((await sharedRequest(token, '/galleries/owner-gallery')).status).toBe(200);
  await repo.moveGalleries('owner', { galleryIds: ['owner-gallery'], folderId: null });
  expect((await sharedRequest(token, '/galleries/owner-gallery')).status).toBe(404);
});

it('protects image bytes with current scope, confirmed placement, asset ownership and revocation', async () => {
  const folder = await create('Images');
  await repo.moveGalleries('owner', { galleryIds: ['owner-gallery'], folderId: folder.id });
  for (const [id,owner] of [['image','owner'],['pending','owner'],['foreign','other']]) await run(db, `INSERT INTO media_assets
    (id,owner_id,storage_file_name,original_file_name,mime_type,size_bytes,width,height,created_at,updated_at,library_retained)
    VALUES(?,?,?,'Image.png','image/png',7,1,1,'now','now',1)`, [id,owner,id+'.png']);
  await run(db, 'UPDATE galleries SET scene_json=? WHERE id=?', [JSON.stringify({items:[{assetId:'image',content:'/api/media/image'},{assetId:'foreign',content:'/api/media/foreign'}]}),'owner-gallery']);
  const { token } = await repo.share('owner', folder.id);
  const response = await sharedRequest(token, '/galleries/owner-gallery/media/image');
  expect(response.status).toBe(200); expect(await response.text()).toBe('picture');
  expect(response.headers.get('cache-control')).toContain('no-store');
  for (const id of ['pending','foreign']) expect((await sharedRequest(token, '/galleries/owner-gallery/media/'+id)).status).toBe(404);
  expect((await sharedRequest('wrong', '/galleries/owner-gallery/media/image')).status).toBe(404);
  await repo.moveGalleries('owner', { galleryIds: ['owner-gallery'], folderId: null });
  expect((await sharedRequest(token, '/galleries/owner-gallery/media/image')).status).toBe(404);
  await repo.moveGalleries('owner', { galleryIds: ['owner-gallery'], folderId: folder.id });
  await repo.revoke('owner',folder.id);
  expect((await sharedRequest(token, '/galleries/owner-gallery/media/image')).status).toBe(404);
});

it('deleting a shared parent invalidates its link without revoking independently shared children', async () => {
  const root = await create('Root'); const child = await create('Child',root.id);
  const parentShare = await repo.share('owner',root.id); const childShare = await repo.share('owner',child.id);
  await repo.remove('owner',root.id);
  expect((await sharedRequest(parentShare.token)).status).toBe(404);
  expect((await sharedRequest(childShare.token)).status).toBe(200);
  await repo.remove('owner',child.id);
  expect((await sharedRequest(childShare.token)).status).toBe(404);
});
