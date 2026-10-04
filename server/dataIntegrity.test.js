// @vitest-environment node

import sqlite3 from 'sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { deleteGalleryById } from './db.js';

const databases = [];

function exec(database, sql) {
  return new Promise((resolve, reject) => {
    database.exec(sql, (error) => (error ? reject(error) : resolve()));
  });
}

function get(database, sql, params = []) {
  return new Promise((resolve, reject) => {
    database.get(sql, params, (error, row) => (error ? reject(error) : resolve(row || null)));
  });
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => new Promise((resolve) => database.close(resolve))));
});

describe('database integrity operations', () => {
  it('deletes visitor memory only when the gallery owner deletes the gallery', async () => {
    const database = new sqlite3.Database(':memory:');
    databases.push(database);
    await exec(database, `
      CREATE TABLE galleries (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL);
      CREATE TABLE visitor_memories (id TEXT PRIMARY KEY, gallery_id TEXT NOT NULL);
      INSERT INTO galleries VALUES ('gallery-1', 'owner-1');
      INSERT INTO visitor_memories VALUES ('memory-1', 'gallery-1');
    `);

    await expect(deleteGalleryById('gallery-1', 'other-owner', database)).resolves.toBe(0);
    expect(await get(database, 'SELECT id FROM visitor_memories WHERE id = ?', ['memory-1'])).toBeTruthy();

    await expect(deleteGalleryById('gallery-1', 'owner-1', database)).resolves.toBe(1);
    expect(await get(database, 'SELECT id FROM visitor_memories WHERE id = ?', ['memory-1'])).toBeNull();
  });

});
