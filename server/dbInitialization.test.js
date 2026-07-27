// @vitest-environment node

import sqlite3 from 'sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { initDb } from './db.js';
import { checkDatabaseReadiness } from './readiness.js';

const databases = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(databases.splice(0).map((database) => new Promise((resolve) => {
    database.close(() => resolve());
  })));
});

describe('database initialization', () => {
  it('resolves only after the required schema is ready', async () => {
    const database = new sqlite3.Database(':memory:');
    databases.push(database);

    await initDb(database);

    await expect(checkDatabaseReadiness(database)).resolves.toBeUndefined();

    const columns = await new Promise((resolve, reject) => {
      database.all('PRAGMA table_info(media_assets)', (error, rows) => {
        if (error) reject(error);
        else resolve(rows);
      });
    });
    expect(columns.map(({ name }) => name)).toEqual([
      'id',
      'owner_id',
      'gallery_id',
      'storage_file_name',
      'original_file_name',
      'mime_type',
      'size_bytes',
      'created_at',
      'updated_at',
    ]);

    const userColumns = await new Promise((resolve, reject) => {
      database.all('PRAGMA table_info(users)', (error, rows) => {
        if (error) reject(error);
        else resolve(rows);
      });
    });
    expect(userColumns.map(({ name }) => name)).toContain('avatar_appearance_json');

    const indexes = await new Promise((resolve, reject) => {
      database.all(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'media_assets'",
        (error, rows) => {
          if (error) reject(error);
          else resolve(rows);
        },
      );
    });
    expect(indexes.map(({ name }) => name)).toEqual(expect.arrayContaining([
      'idx_media_assets_owner_id',
      'idx_media_assets_gallery_id',
    ]));

    const foreignKeys = await new Promise((resolve, reject) => {
      database.all('PRAGMA foreign_key_list(media_assets)', (error, rows) => {
        if (error) reject(error);
        else resolve(rows);
      });
    });
    expect(foreignKeys).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: 'owner_id', table: 'users' }),
      expect.objectContaining({ from: 'gallery_id', table: 'galleries' }),
    ]));

    const passportColumns = await new Promise((resolve, reject) => {
      database.all('PRAGMA table_info(exhibition_passports)', (error, rows) => {
        if (error) reject(error);
        else resolve(rows);
      });
    });
    expect(passportColumns.map(({ name }) => name)).toEqual([
      'id', 'user_id', 'gallery_id', 'tasks_json', 'status', 'souvenir_json',
      'souvenir_token', 'completed_at', 'created_at', 'updated_at',
    ]);

    const passportIndexes = await new Promise((resolve, reject) => {
      database.all(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'exhibition_passports'",
        (error, rows) => error ? reject(error) : resolve(rows),
      );
    });
    expect(passportIndexes.map(({ name }) => name)).toEqual(expect.arrayContaining([
      'idx_exhibition_passports_souvenir_token',
      'idx_exhibition_passports_public_recent',
    ]));
  });

  it('enforces one passport per visitor and cascades gallery deletion', async () => {
    const database = new sqlite3.Database(':memory:');
    databases.push(database);
    await initDb(database);
    const execute = (sql) => new Promise((resolve, reject) => {
      database.exec(sql, (error) => error ? reject(error) : resolve());
    });

    await execute(`
      INSERT INTO users (id, email, name, password_hash, created_at)
      VALUES ('u1', 'u1@example.com', 'User', 'hash', '2026-07-22T00:00:00.000Z');
      INSERT INTO galleries
        (id, owner_id, title, description, template_title, template_image, category, created_at, updated_at)
      VALUES
        ('g1', 'u1', 'Gallery', '', '', '', '', '2026-07-22T00:00:00.000Z', '2026-07-22T00:00:00.000Z');
      INSERT INTO exhibition_passports
        (id, user_id, gallery_id, tasks_json, created_at, updated_at)
      VALUES
        ('p1', 'u1', 'g1', '[]', '2026-07-22T00:00:00.000Z', '2026-07-22T00:00:00.000Z');
    `);
    await expect(execute(`
      INSERT INTO exhibition_passports
        (id, user_id, gallery_id, tasks_json, created_at, updated_at)
      VALUES
        ('p2', 'u1', 'g1', '[]', '2026-07-22T00:00:00.000Z', '2026-07-22T00:00:00.000Z');
    `)).rejects.toMatchObject({ code: 'SQLITE_CONSTRAINT' });

    await execute("DELETE FROM galleries WHERE id = 'g1'");
    const passport = await new Promise((resolve, reject) => {
      database.get("SELECT id FROM exhibition_passports WHERE id = 'p1'", (error, row) => (
        error ? reject(error) : resolve(row || null)
      ));
    });
    expect(passport).toBeNull();
  });

  it('propagates fatal initialization errors', async () => {
    const database = new sqlite3.Database(':memory:');
    await new Promise((resolve) => database.close(resolve));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(initDb(database)).rejects.toThrow();
  });
});
