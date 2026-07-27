// @vitest-environment node

import sqlite3 from 'sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { deleteGalleryById, insertCompetitionVoteAndRefreshCount } from './db.js';

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

  it('inserts a vote and refreshes its cached count atomically', async () => {
    const database = new sqlite3.Database(':memory:');
    databases.push(database);
    await exec(database, `
      CREATE TABLE competition_entries (id TEXT PRIMARY KEY, vote_count INTEGER NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE competition_votes (
        id TEXT PRIMARY KEY,
        competition_id TEXT NOT NULL,
        entry_id TEXT NOT NULL,
        voter_user_id TEXT NOT NULL,
        voter_name TEXT NOT NULL,
        voter_email TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(competition_id, entry_id, voter_user_id)
      );
      INSERT INTO competition_entries VALUES ('entry-1', 0, '2026-01-01T00:00:00.000Z');
    `);
    const vote = {
      id: 'vote-1', competitionId: 'competition-1', entryId: 'entry-1', voterUserId: 'user-1',
      voterName: 'User', voterEmail: 'user@example.com', createdAt: '2026-07-17T00:00:00.000Z',
    };

    await expect(insertCompetitionVoteAndRefreshCount(vote, database)).resolves.toMatchObject({ vote_count: 1 });
    await expect(insertCompetitionVoteAndRefreshCount({ ...vote, id: 'vote-2' }, database)).rejects.toMatchObject({ code: 'SQLITE_CONSTRAINT' });
    expect(await get(database, 'SELECT COUNT(*) AS count FROM competition_votes')).toMatchObject({ count: 1 });
    expect(await get(database, 'SELECT vote_count FROM competition_entries WHERE id = ?', ['entry-1'])).toMatchObject({ vote_count: 1 });
  });
});
