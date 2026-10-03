// @vitest-environment node
import sqlite3 from 'sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { runStatement } from './sqliteHelpers.js';
import { listOwnerGalleryRows } from './ownerGalleryRepository.js';

let database;
afterEach(async () => { if (database) await new Promise(resolve => database.close(resolve)); });

describe('owner gallery draft continuation', () => {
  it('offers only the owners unpublished quick drafts that the editor has not taken over', async () => {
    database = new sqlite3.Database(':memory:');
    await runStatement(database, 'CREATE TABLE galleries (id TEXT PRIMARY KEY, owner_id TEXT, is_box INTEGER DEFAULT 0, is_published INTEGER DEFAULT 0, created_at TEXT)');
    await runStatement(database, 'CREATE TABLE quick_exhibition_drafts (id TEXT, gallery_id TEXT, owner_id TEXT, status TEXT, editor_managed_at TEXT)');
    for (const [id, owner, published, box, status, managed] of [
      ['collecting', 'owner', 0, 0, 'collecting', null],
      ['preview', 'owner', 0, 0, 'ready', null],
      ['failed', 'owner', 0, 0, 'failed', null],
      ['published', 'owner', 1, 0, 'ready', null],
      ['withdrawn', 'owner', 0, 0, 'published', null],
      ['edited', 'owner', 0, 0, 'ready', '2026-09-26'],
      ['other', 'other', 0, 0, 'collecting', null],
      ['box', 'owner', 0, 1, 'collecting', null],
    ]) {
      await runStatement(database, 'INSERT INTO galleries VALUES (?, ?, ?, ?, ?)', [id, owner, box, published, '2026-09-26']);
      await runStatement(database, 'INSERT INTO quick_exhibition_drafts VALUES (?, ?, ?, ?, ?)', [`draft-${id}`, id, owner, status, managed]);
    }
    await runStatement(database, "INSERT INTO galleries VALUES ('manual', 'owner', 0, 0, '2026-09-26')");
    const rows = await listOwnerGalleryRows(database, 'owner');
    expect(rows.map(row => row.id).sort()).toEqual(['collecting', 'edited', 'failed', 'manual', 'preview', 'published', 'withdrawn']);
    expect(rows.filter(row => row.quick_draft_id).map(row => row.quick_draft_id).sort()).toEqual(['draft-collecting', 'draft-failed', 'draft-preview']);
    expect((await listOwnerGalleryRows(database, 'stranger'))).toEqual([]);
  });
});
