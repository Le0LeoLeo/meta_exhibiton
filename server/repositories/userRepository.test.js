// @vitest-environment node

import sqlite3 from 'sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getUserById,
  updateUserAvatarAppearance,
} from './userRepository.js';

function exec(database, sql) {
  return new Promise((resolve, reject) => {
    database.exec(sql, (error) => (error ? reject(error) : resolve()));
  });
}

describe('user avatar appearance repository', () => {
  let database;

  beforeEach(async () => {
    database = new sqlite3.Database(':memory:');
    await exec(database, `
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        avatar_appearance_json TEXT,
        created_at TEXT NOT NULL
      );
      INSERT INTO users VALUES
        ('user-1', 'one@example.com', 'One', 'hash', NULL, '2026-07-28'),
        ('user-2', 'two@example.com', 'Two', 'hash', NULL, '2026-07-28');
    `);
  });

  afterEach(async () => {
    await new Promise((resolve, reject) => {
      database.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('updates only the requested user and returns the affected row count', async () => {
    const appearanceJson = JSON.stringify({ version: 1, hair: 'hair02' });

    await expect(
      updateUserAvatarAppearance('user-1', appearanceJson, database),
    ).resolves.toMatchObject({ changes: 1 });

    await expect(getUserById('user-1', database)).resolves.toMatchObject({
      avatar_appearance_json: appearanceJson,
    });
    await expect(getUserById('user-2', database)).resolves.toMatchObject({
      avatar_appearance_json: null,
    });
  });

  it('reports zero changes when the user does not exist', async () => {
    await expect(
      updateUserAvatarAppearance('missing', '{}', database),
    ).resolves.toMatchObject({ changes: 0 });
  });
});
