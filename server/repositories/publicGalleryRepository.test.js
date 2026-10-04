// @vitest-environment node
import sqlite3 from 'sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { listPublishedGalleryRows } from './publicGalleryRepository.js';

const databases = [];
const run = (db, sql, values = []) => new Promise((resolve, reject) => db.run(sql, values, error => error ? reject(error) : resolve()));
afterEach(async () => { await Promise.all(databases.splice(0).map(db => new Promise(resolve => db.close(resolve)))); });

describe('public gallery summary pages', () => {
  it('bounds results, omits scenes, preserves covers and uses a stable boundary despite insertion or withdrawal', async () => {
    const db = new sqlite3.Database(':memory:'); databases.push(db);
    await run(db, `CREATE TABLE galleries (id TEXT PRIMARY KEY, owner_id TEXT, title TEXT, description TEXT,
      template_title TEXT, template_image TEXT, category TEXT, revision INTEGER, is_published INTEGER,
      is_box INTEGER NOT NULL DEFAULT 0, published_at TEXT, created_at TEXT, updated_at TEXT, scene_json TEXT)`);
    await run(db, 'CREATE TABLE users (id TEXT, name TEXT)');
    const scene = JSON.stringify({ padding: 'x'.repeat(1_000_000), items: [{ type: 'painting', thumbnailUrl: '/art.png' }] });
    for (const id of ['a', 'b', 'c', 'd', 'private']) {
      await run(db, 'INSERT INTO galleries (id, is_published, updated_at, template_image, scene_json) VALUES (?, ?, ?, ?, ?)',
        [id, id === 'private' ? 0 : 1, '2026-09-10T00:00:00Z', id === 'd' ? '/cover.png' : '', scene]);
    }
    await run(db, "INSERT INTO galleries (id, is_published, is_box, updated_at) VALUES ('legacy-box', 1, 1, '2026-09-12T00:00:00Z')");
    const first = await listPublishedGalleryRows(db, { limit: 2 });
    expect(first.map(row => row.id)).toEqual(['d', 'c', 'b']); // extra row is the continuation probe
    expect(first[0].cover_image).toBe('/cover.png');
    expect(first[1].cover_image).toBe('/art.png');
    expect(first.every(row => !('scene_json' in row))).toBe(true);
    expect(JSON.stringify(first).length).toBeLessThan(2000);
    await run(db, "INSERT INTO galleries (id, is_published, updated_at) VALUES ('new', 1, '2026-09-11T00:00:00Z')");
    await run(db, "UPDATE galleries SET is_published = 0 WHERE id = 'c'");
    const second = await listPublishedGalleryRows(db, { limit: 2, after: { at: first[1].updated_at, id: first[1].id } });
    expect(second.map(row => row.id)).toEqual(['b', 'a']);
    await run(db, "UPDATE galleries SET scene_json = 'bad json' WHERE id = 'b'");
    expect((await listPublishedGalleryRows(db, { limit: 2, after: { at: first[1].updated_at, id: 'c' } }))[0].cover_image).toBeNull();
  });
});
