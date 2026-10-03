import sqlite3 from 'sqlite3';
import { randomUUID, randomBytes } from 'node:crypto';
import { sceneContainsAsset } from './legacyBoxData.js';
import { allStatement as all, getStatement as get, runStatement as run } from './sqliteHelpers.js';

export const GALLERY_FOLDER_SCHEMA = `
CREATE TABLE IF NOT EXISTS gallery_folders (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 name TEXT NOT NULL, parent_id TEXT REFERENCES gallery_folders(id) ON DELETE SET NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gallery_folders_owner ON gallery_folders(owner_id, parent_id);
CREATE TABLE IF NOT EXISTS gallery_folder_memberships (
 gallery_id TEXT PRIMARY KEY REFERENCES galleries(id) ON DELETE CASCADE,
 folder_id TEXT NOT NULL REFERENCES gallery_folders(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_gallery_folder_memberships_folder ON gallery_folder_memberships(folder_id);
CREATE TABLE IF NOT EXISTS gallery_folder_shares (
 folder_id TEXT PRIMARY KEY REFERENCES gallery_folders(id) ON DELETE CASCADE,
 token TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL
);`;

const fail = (code, status = 404) => { throw Object.assign(new Error(code), { code, status }); };

export function createGalleryFolderRepository({ filename }) {
  async function transaction(action, write = false) {
    const db = new sqlite3.Database(filename);
    let began = false;
    try {
      await run(db, 'PRAGMA foreign_keys=ON');
      await run(db, 'PRAGMA busy_timeout=5000');
      await run(db, write ? 'BEGIN IMMEDIATE' : 'BEGIN');
      began = true;
      const result = await action(db);
      await run(db, 'COMMIT');
      return result;
    } catch (error) {
      if (began) await run(db, 'ROLLBACK').catch(() => {});
      throw error;
    } finally { await new Promise((resolve, reject) => db.close(e => e ? reject(e) : resolve())); }
  }
  async function owned(db, owner, id) {
    const row = await get(db, 'SELECT * FROM gallery_folders WHERE id=? AND owner_id=?', [id, owner]);
    return row || fail('FOLDER_NOT_FOUND');
  }
  async function snapshot(db, owner) {
    return {
      folders: await all(db, 'SELECT id,name,parent_id AS parentId,created_at AS createdAt FROM gallery_folders WHERE owner_id=? ORDER BY name,id', [owner]),
      memberships: await all(db, `SELECT m.gallery_id AS galleryId,m.folder_id AS folderId FROM gallery_folder_memberships m
        JOIN galleries g ON g.id=m.gallery_id JOIN gallery_folders f ON f.id=m.folder_id WHERE g.owner_id=? AND f.owner_id=? AND g.is_box=0`, [owner, owner]),
    };
  }
  async function scope(db, token) {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) fail('FOLDER_SHARE_UNAVAILABLE');
    const root = await get(db, `SELECT f.* FROM gallery_folders f JOIN gallery_folder_shares s ON s.folder_id=f.id WHERE s.token=?`, [token]);
    if (!root) fail('FOLDER_SHARE_UNAVAILABLE');
    const folders = await all(db, `WITH RECURSIVE tree(id) AS (
      SELECT id FROM gallery_folders WHERE id=? AND owner_id=?
      UNION SELECT f.id FROM gallery_folders f JOIN tree t ON f.parent_id=t.id WHERE f.owner_id=?
    ) SELECT f.id,f.name,f.parent_id AS parentId FROM gallery_folders f JOIN tree t ON t.id=f.id`, [root.id, root.owner_id, root.owner_id]);
    return { root, folders: folders.map(f => ({ ...f, parentId: f.id === root.id ? null : f.parentId })) };
  }
  async function sharedGallery(db, token, id) {
    const context = await scope(db, token);
    const gallery = await get(db, `SELECT g.* FROM galleries g JOIN gallery_folder_memberships m ON m.gallery_id=g.id
      WHERE g.id=? AND g.owner_id=? AND g.is_box=0 AND m.folder_id IN (${context.folders.map(() => '?').join(',')})`, [id, context.root.owner_id, ...context.folders.map(f => f.id)]);
    if (!gallery) fail('FOLDER_SHARE_UNAVAILABLE');
    return gallery;
  }
  return {
    shareInfo: (owner, id) => transaction(async db => {
      await owned(db, owner, id);
      const share = await get(db, 'SELECT token FROM gallery_folder_shares WHERE folder_id=?', [id]);
      return { token: share?.token ?? null };
    }),
    share: (owner, id) => transaction(async db => {
      await owned(db, owner, id);
      await run(db, 'INSERT OR IGNORE INTO gallery_folder_shares(folder_id,token,created_at) VALUES(?,?,?)', [id, randomBytes(32).toString('hex'), new Date().toISOString()]);
      return get(db, 'SELECT token FROM gallery_folder_shares WHERE folder_id=?', [id]);
    }, true),
    revoke: (owner, id) => transaction(async db => {
      await owned(db, owner, id);
      await run(db, 'DELETE FROM gallery_folder_shares WHERE folder_id=?', [id]);
      return { token: null };
    }, true),
    shared: (token, folderId) => transaction(async db => {
      const { root, folders } = await scope(db, token);
      const folder = folders.find(f => f.id === (folderId || root.id));
      if (!folder) fail('FOLDER_SHARE_UNAVAILABLE');
      const galleries = await all(db, `SELECT g.id,g.title,g.description FROM galleries g JOIN gallery_folder_memberships m ON m.gallery_id=g.id
        WHERE m.folder_id=? AND g.owner_id=? AND g.is_box=0 ORDER BY g.updated_at DESC,g.id`, [folder.id, root.owner_id]);
      return { rootId: root.id, folder, folders, galleries };
    }),
    sharedGallery: (token, id) => transaction(async db => {
      const gallery = await sharedGallery(db, token, id);
      return { id: gallery.id, title: gallery.title, description: gallery.description, sceneJson: gallery.scene_json };
    }),
    sharedMedia: (token, galleryId, assetId) => transaction(async db => {
      const gallery = await sharedGallery(db, token, galleryId);
      if (!sceneContainsAsset(gallery.scene_json, assetId)) fail('FOLDER_SHARE_UNAVAILABLE');
      const asset = await get(db, "SELECT * FROM media_assets WHERE id=? AND owner_id=? AND usage='gallery'", [assetId, gallery.owner_id]);
      if (!asset) fail('FOLDER_SHARE_UNAVAILABLE');
      return asset;
    }),
    list: owner => transaction(db => snapshot(db, owner)),
    create: (owner, { name, parentId }) => transaction(async db => {
      if (parentId) await owned(db, owner, parentId);
      const count = await get(db, 'SELECT count(*) AS n FROM gallery_folders WHERE owner_id=?', [owner]);
      if (count.n >= 1000) fail('FOLDER_LIMIT', 409);
      await run(db, 'INSERT INTO gallery_folders(id,owner_id,name,parent_id,created_at) VALUES(?,?,?,?,?)',
        [randomUUID(), owner, name, parentId, new Date().toISOString()]);
      return snapshot(db, owner);
    }, true),
    update: (owner, id, input) => transaction(async db => {
      await owned(db, owner, id);
      if (input.parentId !== undefined) {
        let parent = input.parentId;
        const seen = new Set([id]);
        while (parent) {
          if (seen.has(parent)) fail('FOLDER_CYCLE', 409);
          seen.add(parent);
          parent = (await owned(db, owner, parent)).parent_id;
        }
        await run(db, 'UPDATE gallery_folders SET parent_id=? WHERE id=?', [input.parentId, id]);
      }
      if (input.name !== undefined) await run(db, 'UPDATE gallery_folders SET name=? WHERE id=?', [input.name, id]);
      return snapshot(db, owner);
    }, true),
    moveGalleries: (owner, { galleryIds, folderId }) => transaction(async db => {
      if (folderId) await owned(db, owner, folderId);
      for (const id of galleryIds) {
        if (!await get(db, 'SELECT id FROM galleries WHERE id=? AND owner_id=? AND is_box=0', [id, owner])) fail('GALLERY_NOT_FOUND');
      }
      for (const id of galleryIds) {
        if (folderId) await run(db, `INSERT INTO gallery_folder_memberships(gallery_id,folder_id) VALUES(?,?)
          ON CONFLICT(gallery_id) DO UPDATE SET folder_id=excluded.folder_id`, [id, folderId]);
        else await run(db, 'DELETE FROM gallery_folder_memberships WHERE gallery_id=?', [id]);
      }
      return snapshot(db, owner);
    }, true),
    remove: (owner, id) => transaction(async db => {
      const folder = await owned(db, owner, id);
      await run(db, 'UPDATE gallery_folders SET parent_id=? WHERE parent_id=? AND owner_id=?', [folder.parent_id, id, owner]);
      if (folder.parent_id) await run(db, 'UPDATE gallery_folder_memberships SET folder_id=? WHERE folder_id=?', [folder.parent_id, id]);
      else await run(db, 'DELETE FROM gallery_folder_memberships WHERE folder_id=?', [id]);
      await run(db, 'DELETE FROM gallery_folders WHERE id=? AND owner_id=?', [id, owner]);
      return snapshot(db, owner);
    }, true),
  };
}
