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
  it('does not create removed growth and competition tables for new databases', async () => {
    const database = new sqlite3.Database(':memory:');
    databases.push(database);
    await initDb(database);

    const tables = await new Promise((resolve, reject) => {
      database.all(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND (name LIKE 'growth_%' OR name LIKE 'competition%')",
        (error, rows) => error ? reject(error) : resolve(rows),
      );
    });
    expect(tables).toEqual([]);
  });

  it('does not create quick upload tables for new databases', async () => {
    const database = new sqlite3.Database(':memory:');
    databases.push(database);
    await initDb(database);

    const tables = await new Promise((resolve, reject) => {
      database.all(
        "SELECT name FROM sqlite_master WHERE name LIKE '%gallery_upload_links%'",
        (error, rows) => error ? reject(error) : resolve(rows),
      );
    });
    expect(tables).toEqual([]);
  });

  it('preserves legacy quick upload data without reactivating the feature', async () => {
    const database = new sqlite3.Database(':memory:');
    databases.push(database);
    await new Promise((resolve, reject) => {
      database.exec(`
        CREATE TABLE gallery_upload_links (id TEXT PRIMARY KEY, upload_token TEXT NOT NULL);
        INSERT INTO gallery_upload_links (id, upload_token) VALUES ('legacy-link', 'legacy-token');
      `, (error) => error ? reject(error) : resolve());
    });

    await initDb(database);

    const links = await new Promise((resolve, reject) => {
      database.all('SELECT * FROM gallery_upload_links', (error, rows) => (
        error ? reject(error) : resolve(rows)
      ));
    });
    expect(links).toEqual([{ id: 'legacy-link', upload_token: 'legacy-token' }]);
  });

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
      'usage',
      'library_retained',
      'width',
      'height',
    ]);

    const userColumns = await new Promise((resolve, reject) => {
      database.all('PRAGMA table_info(users)', (error, rows) => {
        if (error) reject(error);
        else resolve(rows);
      });
    });
    expect(userColumns.map(({ name }) => name)).toContain('avatar_appearance_json');
    expect(userColumns.map(({ name }) => name)).toContain('google_subject');

    const userIndexes = await new Promise((resolve, reject) => {
      database.all(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'users'",
        (error, rows) => {
          if (error) reject(error);
          else resolve(rows);
        },
      );
    });
    expect(userIndexes.map(({ name }) => name)).toContain('idx_users_google_subject');

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

    const visitorMemoryColumns = await new Promise((resolve, reject) => {
      database.all('PRAGMA table_info(visitor_memories)', (error, rows) => {
        if (error) reject(error);
        else resolve(rows);
      });
    });
    expect(visitorMemoryColumns.map(({ name }) => name)).toContain('last_recommended_exhibit_id');

    const builderSessionColumns = await new Promise((resolve, reject) => {
      database.all('PRAGMA table_info(exhibition_builder_sessions)', (error, rows) => {
        if (error) reject(error);
        else resolve(rows);
      });
    });
    expect(builderSessionColumns.map(({ name }) => name)).toEqual([
      'id',
      'user_id',
      'input_json',
      'versions_json',
      'current_version_id',
      'revision_count',
      'status',
      'created_at',
      'updated_at',
    ]);
  });

  it('migrates legacy media dimensions and quick drafts idempotently without losing data', async () => {
    const database = new sqlite3.Database(':memory:');
    databases.push(database);
    const execute = (sql) => new Promise((resolve, reject) => database.exec(sql, (error) => error ? reject(error) : resolve()));
    const query = (sql) => new Promise((resolve, reject) => database.all(sql, (error, rows) => error ? reject(error) : resolve(rows)));
    await initDb(database);
    await execute(`
      ALTER TABLE media_assets DROP COLUMN width;
      ALTER TABLE media_assets DROP COLUMN height;
      INSERT INTO users (id, email, name, password_hash, created_at) VALUES ('legacy', 'legacy@example.com', 'Legacy', 'hash', 'now');
      INSERT INTO media_assets (id, owner_id, storage_file_name, original_file_name, mime_type, size_bytes, created_at, updated_at)
      VALUES ('asset', 'legacy', 'image.jpg', 'Image.jpg', 'image/jpeg', 12, 'now', 'now');
    `);
    await initDb(database);
    await initDb(database);
    expect(await query('SELECT id, width, height FROM media_assets')).toEqual([{ id: 'asset', width: null, height: null }]);
    const columns = await query('PRAGMA table_info(quick_exhibition_drafts)');
    expect(columns.map(({ name }) => name)).toEqual([
      'id', 'owner_id', 'gallery_id', 'revision', 'input_json', 'status', 'base_scene_hash', 'result_json',
      'last_request_id', 'last_request_fingerprint', 'error_code', 'created_at', 'updated_at',
      'applied_input_json', 'applied_result_json', 'editor_managed_at',
    ]);
    expect(await query('PRAGMA foreign_key_list(quick_exhibition_drafts)')).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: 'owner_id', table: 'users', on_delete: 'CASCADE' }),
      expect.objectContaining({ from: 'gallery_id', table: 'galleries', on_delete: 'CASCADE' }),
    ]));
    expect(await query('PRAGMA index_list(quick_exhibition_drafts)')).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'idx_quick_exhibition_drafts_owner_id' }),
      expect.objectContaining({ unique: 1 }),
    ]));
  });

  it('migrates applied snapshots only from recoverable legacy drafts and does not overwrite them', async () => {
    const database = new sqlite3.Database(':memory:');
    databases.push(database);
    const execute = (sql) => new Promise((resolve, reject) => database.exec(sql, (error) => error ? reject(error) : resolve()));
    const query = (sql) => new Promise((resolve, reject) => database.all(sql, (error, rows) => error ? reject(error) : resolve(rows)));
    await initDb(database);
    await execute(`
      ALTER TABLE quick_exhibition_drafts DROP COLUMN applied_input_json;
      ALTER TABLE quick_exhibition_drafts DROP COLUMN applied_result_json;
      ALTER TABLE quick_exhibition_drafts DROP COLUMN editor_managed_at;
      INSERT INTO users (id, email, name, password_hash, created_at) VALUES ('owner', 'snapshot@example.com', 'Owner', 'hash', 'now');
    `);
    for (const status of ['ready', 'published', 'candidate_ready']) {
      await execute(`
        INSERT INTO galleries (id, owner_id, title, description, template_title, template_image, category, created_at, updated_at)
        VALUES ('${status}', 'owner', 'Gallery', '', '', '', '', 'now', 'now');
        INSERT INTO quick_exhibition_drafts (id, owner_id, gallery_id, input_json, result_json, status, base_scene_hash, created_at, updated_at)
        VALUES ('${status}', 'owner', '${status}', '{"title":"Original"}', '{"scene":{"items":[]}}', '${status}', 'hash', 'now', 'now');
      `);
    }
    await initDb(database);
    const snapshots = await query('SELECT id, applied_input_json, applied_result_json FROM quick_exhibition_drafts ORDER BY id');
    expect(snapshots).toEqual([
      { id: 'candidate_ready', applied_input_json: null, applied_result_json: null },
      ...['published', 'ready'].map((id) => ({ id, applied_input_json: '{"title":"Original"}', applied_result_json: '{"scene":{"items":[]}}' })),
    ]);
    await execute(`UPDATE quick_exhibition_drafts SET input_json = '{"title":"Candidate"}', status = 'candidate_ready' WHERE id = 'ready'`);
    await initDb(database);
    expect(await query('SELECT id, applied_input_json, applied_result_json FROM quick_exhibition_drafts ORDER BY id')).toEqual(snapshots);
  });

  it('adds recommendation memory to an existing visitor memory table', async () => {
    const database = new sqlite3.Database(':memory:');
    databases.push(database);
    await new Promise((resolve, reject) => {
      database.exec(`
        CREATE TABLE visitor_memories (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          gallery_id TEXT NOT NULL,
          visited_exhibit_ids_json TEXT NOT NULL DEFAULT '[]',
          engaged_exhibit_ids_json TEXT NOT NULL DEFAULT '[]',
          dwell_seconds_json TEXT NOT NULL DEFAULT '{}',
          preferred_personality TEXT DEFAULT 'xiaobai',
          preferred_language TEXT DEFAULT 'zh-TW',
          updated_at TEXT NOT NULL
        );
      `, (error) => error ? reject(error) : resolve());
    });

    await initDb(database);

    const columns = await new Promise((resolve, reject) => {
      database.all('PRAGMA table_info(visitor_memories)', (error, rows) => {
        if (error) reject(error);
        else resolve(rows);
      });
    });
    expect(columns.map(({ name }) => name)).toContain('last_recommended_exhibit_id');
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
