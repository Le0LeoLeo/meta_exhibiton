// @vitest-environment node

import sqlite3 from 'sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

import { initCompetitionEntrySchema } from './dbMigrations.js';

const databases = [];

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => new Promise((resolve) => {
    database.close(() => resolve());
  })));
});

function run(database, sql, params = []) {
  return new Promise((resolve, reject) => {
    database.run(sql, params, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function get(database, sql) {
  return new Promise((resolve, reject) => {
    database.get(sql, (error, row) => {
      if (error) reject(error);
      else resolve(row);
    });
  });
}

describe('competition entry schema migration', () => {
  it('rejects when a required schema statement fails', async () => {
    const database = new sqlite3.Database(':memory:');
    await new Promise((resolve) => database.close(resolve));

    await expect(initCompetitionEntrySchema(database))
      .rejects.toThrow('failed to create competition_entries table');
  });

  it('preserves existing entries when initialization runs again', async () => {
    const database = new sqlite3.Database(':memory:');
    databases.push(database);

    await initCompetitionEntrySchema(database);
    await run(
      database,
      `INSERT INTO competition_entries (
        id, competition_id, gallery_id, gallery_owner_id, statement,
        submission_json, assets_json, status, rank, vote_count,
        submitted_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'entry-1', 'competition-1', 'gallery-1', 'user-1', 'statement',
        '{}', '[]', 'pending', null, 0,
        '2026-07-15T00:00:00.000Z', '2026-07-15T00:00:00.000Z', '2026-07-15T00:00:00.000Z',
      ],
    );

    await initCompetitionEntrySchema(database);

    expect(await get(database, 'SELECT COUNT(*) AS count FROM competition_entries'))
      .toEqual({ count: 1 });
    expect(await get(
      database,
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'competition_entries_legacy'",
    )).toBeUndefined();
  });

  it('enforces one vote per user for each competition entry', async () => {
    const database = new sqlite3.Database(':memory:');
    databases.push(database);
    await initCompetitionEntrySchema(database);

    const insertVote = (id) => run(
      database,
      `INSERT INTO competition_votes (
        id, competition_id, entry_id, voter_user_id, voter_name, voter_email, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id, 'competition-1', 'entry-1', 'voter-1', 'Voter', 'voter@example.com',
        '2026-07-15T00:00:00.000Z',
      ],
    );

    await insertVote('vote-1');
    await expect(insertVote('vote-2')).rejects.toMatchObject({ code: 'SQLITE_CONSTRAINT' });
    expect(await get(database, 'SELECT COUNT(*) AS count FROM competition_votes'))
      .toEqual({ count: 1 });
  });
});
