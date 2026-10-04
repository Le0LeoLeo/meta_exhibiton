// @vitest-environment node
import sqlite3 from 'sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initDb, updateGalleryById } from './db.js';
import { getStatement, runStatement } from './repositories/sqliteHelpers.js';
import { updateUserPasswordHash } from './repositories/userRepository.js';

describe('persistent concurrency versions', () => {
  let database;
  beforeEach(async () => {
    database = new sqlite3.Database(':memory:');
    await initDb(database);
    await runStatement(database, "INSERT INTO users (id,email,name,password_hash,created_at) VALUES ('owner','test@example.invalid','Owner','old','now')");
    await runStatement(database, "INSERT INTO galleries (id,owner_id,title,description,template_title,template_image,category,created_at,updated_at) VALUES ('gallery','owner','Title','','Blank','','art','now','now')");
  });
  afterEach(async () => { await new Promise(resolve => database.close(resolve)); });

  it('allows only one of two saves based on the same revision', async () => {
    const results = await Promise.allSettled([
      updateGalleryById('gallery', 'owner', { sceneJson: 'first', expectedRevision: 0 }, database),
      updateGalleryById('gallery', 'owner', { sceneJson: 'second', expectedRevision: 0 }, database),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find(result => result.status === 'rejected').reason).toMatchObject({ status: 409, code: 'GALLERY_CONFLICT' });
    expect(await getStatement(database, 'SELECT scene_json, revision FROM galleries')).toEqual({ scene_json: 'first', revision: 1 });
  });

  it('versions direct scene writes and survives repeated migrations', async () => {
    await runStatement(database, "UPDATE galleries SET scene_json = 'quick scene' WHERE id = 'gallery'");
    await initDb(database);
    await expect(updateGalleryById('gallery', 'owner', { title: 'stale', expectedRevision: 0 }, database)).rejects.toMatchObject({ code: 'GALLERY_CONFLICT' });
    expect(await getStatement(database, 'SELECT title, revision FROM galleries')).toEqual({ title: 'Title', revision: 1 });
  });

  it('increments the session version atomically with the password change', async () => {
    await updateUserPasswordHash('owner', 'new', database);
    await initDb(database);
    expect(await getStatement(database, 'SELECT password_hash, session_version FROM users')).toEqual({ password_hash: 'new', session_version: 1 });
  });
});
