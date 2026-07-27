import sqlite3 from 'sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { initCompetitionEntrySchema } from './dbMigrations.js';
import { checkDatabaseReadiness } from './readiness.js';
import { getStatement, runStatement } from './repositories/sqliteHelpers.js';
import * as userRepository from './repositories/userRepository.js';
import * as mediaRepository from './repositories/mediaRepository.js';

const dbFile = path.join(process.cwd(), 'server', 'app.db');

// 確保 server 資料夾存在（通常已存在）
const dir = path.dirname(dbFile);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

sqlite3.verbose();

export const db = new sqlite3.Database(dbFile);

// 初始化資料表
export function initDb(database = db) {
  const db = database;
  return new Promise((resolve, reject) => {
    let queueFinished = false;
    let migrationFinished = false;
    let migrationError;
    let validationStarted = false;

    const finish = () => {
      if (!queueFinished || !migrationFinished || validationStarted) return;
      if (migrationError) reject(migrationError);
      else {
        validationStarted = true;
        checkDatabaseReadiness(db).then(resolve, reject);
      }
    };

    db.serialize(() => {
    // SQLite 預設不啟用外鍵約束，需要手動打開
    db.run('PRAGMA foreign_keys = ON');
    db.run('PRAGMA busy_timeout = 5000');
    db.run('PRAGMA journal_mode = WAL');

    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    db.run('ALTER TABLE users ADD COLUMN avatar_appearance_json TEXT', (err) => {
      if (err && !String(err.message || '').includes('duplicate column name')) {
        migrationError ??= new Error(
          `[db] failed to add avatar appearance column: ${err.message}`,
          { cause: err },
        );
      }
    });

    db.run(`
      CREATE TABLE IF NOT EXISTS galleries (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        template_title TEXT NOT NULL,
        template_image TEXT NOT NULL,
        category TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    db.run('CREATE INDEX IF NOT EXISTS idx_galleries_owner_id ON galleries(owner_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_galleries_created_at ON galleries(created_at)');

    db.run(`
      CREATE TABLE IF NOT EXISTS media_assets (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        gallery_id TEXT,
        storage_file_name TEXT NOT NULL,
        original_file_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(gallery_id) REFERENCES galleries(id) ON DELETE SET NULL
      );
    `);

    db.run('CREATE INDEX IF NOT EXISTS idx_media_assets_owner_id ON media_assets(owner_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_media_assets_gallery_id ON media_assets(gallery_id)');

    db.run('ALTER TABLE galleries ADD COLUMN scene_json TEXT', (err) => {
      if (err && !String(err.message || '').includes('duplicate column name')) {
        console.error('[db] failed to add scene_json column:', err);
      }
    });

    db.run('ALTER TABLE galleries ADD COLUMN share_token TEXT', (err) => {
      if (err && !String(err.message || '').includes('duplicate column name')) {
        console.error('[db] failed to add share_token column:', err);
      }
    });

    db.run("ALTER TABLE galleries ADD COLUMN share_role TEXT NOT NULL DEFAULT 'viewer'", (err) => {
      if (err && !String(err.message || '').includes('duplicate column name')) {
        console.error('[db] failed to add share_role column:', err);
      }
    });

    db.run('ALTER TABLE galleries ADD COLUMN share_expires_at TEXT', (err) => {
      if (err && !String(err.message || '').includes('duplicate column name')) {
        console.error('[db] failed to add share_expires_at column:', err);
      }
    });

    db.run('ALTER TABLE galleries ADD COLUMN is_published INTEGER NOT NULL DEFAULT 0', (err) => {
      if (err && !String(err.message || '').includes('duplicate column name')) {
        console.error('[db] failed to add is_published column:', err);
      }
    });

    db.run('ALTER TABLE galleries ADD COLUMN published_at TEXT', (err) => {
      if (err && !String(err.message || '').includes('duplicate column name')) {
        console.error('[db] failed to add published_at column:', err);
      }
    });

    db.run('ALTER TABLE galleries ADD COLUMN growth_enabled INTEGER NOT NULL DEFAULT 0', (err) => {
      if (err && !String(err.message || '').includes('duplicate column name')) {
        console.error('[db] failed to add growth_enabled column:', err);
      }
    });

    db.run('ALTER TABLE galleries ADD COLUMN growth_public_share INTEGER NOT NULL DEFAULT 0', (err) => {
      if (err && !String(err.message || '').includes('duplicate column name')) {
        console.error('[db] failed to add growth_public_share column:', err);
      }
    });

    db.run('ALTER TABLE galleries ADD COLUMN growth_gallery_3d INTEGER NOT NULL DEFAULT 0', (err) => {
      if (err && !String(err.message || '').includes('duplicate column name')) {
        console.error('[db] failed to add growth_gallery_3d column:', err);
      }
    });

    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_galleries_share_token ON galleries(share_token)');
    db.run('CREATE INDEX IF NOT EXISTS idx_galleries_is_published ON galleries(is_published, published_at)');

    db.run(`
      CREATE TABLE IF NOT EXISTS gallery_upload_links (
        id TEXT PRIMARY KEY,
        gallery_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        upload_token TEXT NOT NULL UNIQUE,
        can_edit_metadata INTEGER NOT NULL DEFAULT 0,
        expires_at TEXT,
        revoked_at TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(gallery_id) REFERENCES galleries(id) ON DELETE CASCADE,
        FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    db.run('CREATE INDEX IF NOT EXISTS idx_gallery_upload_links_gallery_id ON gallery_upload_links(gallery_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_gallery_upload_links_token ON gallery_upload_links(upload_token)');

    db.run(`
      CREATE TABLE IF NOT EXISTS exhibit_comments (
        id TEXT PRIMARY KEY,
        gallery_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(gallery_id) REFERENCES galleries(id) ON DELETE CASCADE
      );
    `);

    db.run('CREATE INDEX IF NOT EXISTS idx_exhibit_comments_gallery_item_id ON exhibit_comments(gallery_id, item_id)');

    db.run(`
      CREATE TABLE IF NOT EXISTS growth_children (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        name TEXT NOT NULL,
        birthday TEXT NOT NULL,
        avatar_url TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS growth_exhibits (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        child_id TEXT NOT NULL,
        title TEXT NOT NULL,
        template_id TEXT NOT NULL,
        intro_story TEXT NOT NULL,
        is_private INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(child_id) REFERENCES growth_children(id) ON DELETE CASCADE
      );
    `);

    db.run('CREATE INDEX IF NOT EXISTS idx_growth_children_owner_id ON growth_children(owner_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_growth_exhibits_owner_id ON growth_exhibits(owner_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_growth_exhibits_child_id ON growth_exhibits(child_id)');

    db.run('ALTER TABLE growth_exhibits ADD COLUMN share_token TEXT', (err) => {
      if (err && !String(err.message || '').includes('duplicate column name')) {
        console.error('[db] failed to add growth share_token column:', err);
      }
    });

    db.run("ALTER TABLE growth_exhibits ADD COLUMN share_role TEXT NOT NULL DEFAULT 'viewer'", (err) => {
      if (err && !String(err.message || '').includes('duplicate column name')) {
        console.error('[db] failed to add growth share_role column:', err);
      }
    });

    db.run('ALTER TABLE growth_exhibits ADD COLUMN share_expires_at TEXT', (err) => {
      if (err && !String(err.message || '').includes('duplicate column name')) {
        console.error('[db] failed to add growth share_expires_at column:', err);
      }
    });

    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_growth_exhibits_share_token ON growth_exhibits(share_token)');

    db.run(`
      CREATE TABLE IF NOT EXISTS growth_assets (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        exhibit_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        content_url TEXT,
        note TEXT,
        captured_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(exhibit_id) REFERENCES growth_exhibits(id) ON DELETE CASCADE
      );
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS growth_comments (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        exhibit_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(exhibit_id) REFERENCES growth_exhibits(id) ON DELETE CASCADE
      );
    `);

    db.run('CREATE INDEX IF NOT EXISTS idx_growth_assets_exhibit_id ON growth_assets(exhibit_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_growth_comments_exhibit_id ON growth_comments(exhibit_id)');

    db.run(`
      CREATE TABLE IF NOT EXISTS competitions (
        id TEXT PRIMARY KEY,
        host_gallery_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        rules TEXT NOT NULL,
        cover_image TEXT,
        is_public INTEGER NOT NULL DEFAULT 1,
        registration_deadline TEXT NOT NULL,
        voting_deadline TEXT,
        submission_fields_json TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(host_gallery_id) REFERENCES galleries(id) ON DELETE CASCADE,
        FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    db.run('ALTER TABLE competitions ADD COLUMN host_gallery_id TEXT', (err) => {
      if (err && !String(err.message || '').includes('duplicate column name')) {
        console.error('[db] failed to add host_gallery_id column:', err);
      }
    });
    db.run('ALTER TABLE competitions ADD COLUMN submission_fields_json TEXT', (err) => {
      if (err && !String(err.message || '').includes('duplicate column name')) {
        console.error('[db] failed to add submission_fields_json column:', err);
      }
    });
    initCompetitionEntrySchema(db).then(
      () => {
        migrationFinished = true;
        finish();
      },
      (error) => {
        migrationError = error;
        migrationFinished = true;
        finish();
      },
    );

    db.run('CREATE INDEX IF NOT EXISTS idx_competitions_created_by ON competitions(created_by)');
    db.run('CREATE INDEX IF NOT EXISTS idx_competitions_host_gallery_id ON competitions(host_gallery_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_competitions_visibility ON competitions(is_public, status, registration_deadline)');

    db.run(`
      CREATE TABLE IF NOT EXISTS file_cleanup_jobs (
        id TEXT PRIMARY KEY,
        owner_id TEXT,
        kind TEXT NOT NULL CHECK(kind IN ('growth', 'media')),
        target TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    db.run('CREATE INDEX IF NOT EXISTS idx_file_cleanup_jobs_status ON file_cleanup_jobs(status, updated_at)');

    // Visitor memories table for persisting user preferences and visit state
    db.run(`
      CREATE TABLE IF NOT EXISTS visitor_memories (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        gallery_id TEXT NOT NULL,
        visited_exhibit_ids_json TEXT NOT NULL DEFAULT '[]',
        engaged_exhibit_ids_json TEXT NOT NULL DEFAULT '[]',
        dwell_seconds_json TEXT NOT NULL DEFAULT '{}',
        preferred_personality TEXT DEFAULT 'xiaobai',
        preferred_language TEXT DEFAULT 'zh-TW',
        updated_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_visitor_memories_user_gallery ON visitor_memories(user_id, gallery_id)');

    db.run(`
      CREATE TABLE IF NOT EXISTS exhibition_passports (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        gallery_id TEXT NOT NULL,
        tasks_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        souvenir_json TEXT,
        souvenir_token TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(gallery_id) REFERENCES galleries(id) ON DELETE CASCADE,
        UNIQUE(user_id, gallery_id)
      );
    `);

    db.run(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_exhibition_passports_souvenir_token
      ON exhibition_passports(souvenir_token)
      WHERE souvenir_token IS NOT NULL
    `);

    db.run(
      `CREATE INDEX IF NOT EXISTS idx_exhibition_passports_public_recent
       ON exhibition_passports(completed_at DESC)
       WHERE souvenir_token IS NOT NULL`,
      (error) => {
        if (error) {
          reject(new Error(`[db] failed to finalize schema initialization: ${error.message}`, {
            cause: error,
          }));
          return;
        }
        queueFinished = true;
        finish();
      },
    );
    });
  });
}

export function getUserByEmail(email) {
  return userRepository.getUserByEmail(email, db);
}

export function insertUser(user) {
  return userRepository.insertUser(user, db);
}

export function getUserById(id) {
  return userRepository.getUserById(id, db);
}

export function updateUserName(id, name) {
  return userRepository.updateUserName(id, name, db);
}

export function updateUserAvatarAppearance(id, appearanceJson) {
  return userRepository.updateUserAvatarAppearance(id, appearanceJson, db);
}

export function updateUserPasswordHash(id, passwordHash) {
  return userRepository.updateUserPasswordHash(id, passwordHash, db);
}

export function deleteUserById(id) {
  return userRepository.deleteUserById(id, db);
}

export async function deleteUserAndCreateFileCleanupJobs(ownerId, requestedJobs, database = db) {
  return userRepository.deleteUserAndCreateFileCleanupJobs(ownerId, requestedJobs, database);
}

export function markFileCleanupJobCompleted(id, database = db) {
  return userRepository.markFileCleanupJobCompleted(id, database);
}

export function markFileCleanupJobFailed(id, errorMessage, database = db) {
  return userRepository.markFileCleanupJobFailed(id, errorMessage, database);
}

export async function listRetryableFileCleanupJobs(database = db, limit = 100) {
  return userRepository.listRetryableFileCleanupJobs(database, limit);
}

export function insertGallery(gallery) {
  return new Promise((resolve, reject) => {
    const withSceneSql =
      'INSERT INTO galleries (id, owner_id, title, description, template_title, template_image, category, scene_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    const withSceneParams = [
      gallery.id,
      gallery.ownerId,
      gallery.title,
      gallery.description,
      gallery.templateTitle,
      gallery.templateImage,
      gallery.category,
      gallery.sceneJson ?? null,
      gallery.createdAt,
      gallery.updatedAt,
    ];

    db.run(withSceneSql, withSceneParams, (err) => {
      if (!err) {
        resolve();
        return;
      }

      const noSceneColumn = String(err.message || '').includes('no column named scene_json');
      if (!noSceneColumn) {
        reject(err);
        return;
      }

      const fallbackSql =
        'INSERT INTO galleries (id, owner_id, title, description, template_title, template_image, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
      const fallbackParams = [
        gallery.id,
        gallery.ownerId,
        gallery.title,
        gallery.description,
        gallery.templateTitle,
        gallery.templateImage,
        gallery.category,
        gallery.createdAt,
        gallery.updatedAt,
      ];

      db.run(fallbackSql, fallbackParams, (fallbackErr) => {
        if (fallbackErr) return reject(fallbackErr);
        resolve();
      });
    });
  });
}

export function listGalleriesByOwnerId(ownerId) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM galleries WHERE owner_id = ? ORDER BY created_at DESC',
      [ownerId],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      },
    );
  });
}

export function listPublishedGalleries() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT galleries.*, users.name AS owner_name
       FROM galleries
       LEFT JOIN users ON users.id = galleries.owner_id
       LEFT JOIN competitions ON competitions.host_gallery_id = galleries.id
       WHERE galleries.is_published = 1 AND competitions.id IS NULL
       ORDER BY COALESCE(galleries.published_at, galleries.updated_at) DESC`,
      [],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      },
    );
  });
}

export function getPublishedGalleryById(id) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT galleries.*, users.name AS owner_name
       FROM galleries
       LEFT JOIN users ON users.id = galleries.owner_id
       WHERE galleries.id = ? AND galleries.is_published = 1`,
      [id],
      (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      },
    );
  });
}

export function getGalleryById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM galleries WHERE id = ?', [id], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

export function insertMediaAsset(asset, database = db) {
  return mediaRepository.insertMediaAsset(asset, database);
}

export function getMediaAssetById(id, database = db) {
  return mediaRepository.getMediaAssetById(id, database);
}

export function deleteMediaAssetById(id, ownerId, database = db) {
  return mediaRepository.deleteMediaAssetById(id, ownerId, database);
}

export function listMediaStorageFileNamesByOwnerId(ownerId, database = db) {
  return mediaRepository.listMediaStorageFileNamesByOwnerId(ownerId, database);
}

export function listMediaStorageFileNamesByGalleryId(galleryId, database = db) {
  return mediaRepository.listMediaStorageFileNamesByGalleryId(galleryId, database);
}

export function listAllMediaStorageFileNames(database = db) {
  return mediaRepository.listAllMediaStorageFileNames(database);
}

export function listStaleUnboundMediaAssets(cutoffIso, database = db) {
  return mediaRepository.listStaleUnboundMediaAssets(cutoffIso, database);
}

export function deleteUnboundMediaAssetsByIds(ids, database = db) {
  return mediaRepository.deleteUnboundMediaAssetsByIds(ids, database);
}

export function bindMediaAssetsToGallery(assetIds, galleryId, ownerId, database = db) {
  return mediaRepository.bindMediaAssetsToGallery(assetIds, galleryId, ownerId, database);
}

export function updateGalleryById(id, ownerId, updates) {
  return new Promise((resolve, reject) => {
    const fields = [];
    const values = [];

    if (Object.prototype.hasOwnProperty.call(updates, 'hostGalleryId')) {
      fields.push('host_gallery_id = ?');
      values.push(updates.hostGalleryId);
    }
    if (typeof updates.title === 'string') {
      fields.push('title = ?');
      values.push(updates.title);
    }
    if (typeof updates.description === 'string') {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (typeof updates.templateTitle === 'string') {
      fields.push('template_title = ?');
      values.push(updates.templateTitle);
    }
    if (typeof updates.templateImage === 'string') {
      fields.push('template_image = ?');
      values.push(updates.templateImage);
    }
    if (typeof updates.category === 'string') {
      fields.push('category = ?');
      values.push(updates.category);
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'sceneJson')) {
      fields.push('scene_json = ?');
      values.push(updates.sceneJson);
    }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());

    values.push(id, ownerId);

    db.run(
      `UPDATE galleries SET ${fields.join(', ')} WHERE id = ? AND owner_id = ?`,
      values,
      function (err) {
        if (err) return reject(err);
        resolve(this.changes || 0);
      },
    );
  });
}

export async function deleteGalleryById(id, ownerId, database = db) {
  await runStatement(database, 'BEGIN IMMEDIATE');
  try {
    await runStatement(
      database,
      `DELETE FROM visitor_memories
       WHERE gallery_id = ?
         AND EXISTS (SELECT 1 FROM galleries WHERE id = ? AND owner_id = ?)`,
      [id, id, ownerId],
    );
    const deleted = await runStatement(
      database,
      'DELETE FROM galleries WHERE id = ? AND owner_id = ?',
      [id, ownerId],
    );
    await runStatement(database, 'COMMIT');
    return deleted.changes;
  } catch (error) {
    await runStatement(database, 'ROLLBACK').catch(() => {});
    throw error;
  }
}

export function deleteCompetitionsByHostGalleryId(hostGalleryId) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM competitions WHERE host_gallery_id = ?', [hostGalleryId], function (err) {
      if (err) return reject(err);
      resolve(this.changes || 0);
    });
  });
}

export function updateGalleryShareById(id, ownerId, updates) {
  return new Promise((resolve, reject) => {
    const fields = [];
    const values = [];

    if (Object.prototype.hasOwnProperty.call(updates, 'shareToken')) {
      fields.push('share_token = ?');
      values.push(updates.shareToken);
    }

    if (typeof updates.shareRole === 'string') {
      fields.push('share_role = ?');
      values.push(updates.shareRole);
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'shareExpiresAt')) {
      fields.push('share_expires_at = ?');
      values.push(updates.shareExpiresAt);
    }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());

    values.push(id, ownerId);

    db.run(
      `UPDATE galleries SET ${fields.join(', ')} WHERE id = ? AND owner_id = ?`,
      values,
      function (err) {
        if (err) return reject(err);
        resolve(this.changes || 0);
      },
    );
  });
}

export function updateGalleryPublishById(id, ownerId, updates) {
  return new Promise((resolve, reject) => {
    const fields = [];
    const values = [];

    if (Object.prototype.hasOwnProperty.call(updates, 'isPublished')) {
      fields.push('is_published = ?');
      values.push(updates.isPublished ? 1 : 0);
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'publishedAt')) {
      fields.push('published_at = ?');
      values.push(updates.publishedAt);
    }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());

    values.push(id, ownerId);

    db.run(
      `UPDATE galleries SET ${fields.join(', ')} WHERE id = ? AND owner_id = ?`,
      values,
      function (err) {
        if (err) return reject(err);
        resolve(this.changes || 0);
      },
    );
  });
}

export function getGalleryByShareToken(shareToken) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM galleries WHERE share_token = ?', [shareToken], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

export function insertGalleryUploadLink(link) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO gallery_upload_links (id, gallery_id, item_id, upload_token, can_edit_metadata, expires_at, revoked_at, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [link.id, link.galleryId, link.itemId, link.uploadToken, link.canEditMetadata ? 1 : 0, link.expiresAt ?? null, link.revokedAt ?? null, link.createdBy, link.createdAt, link.updatedAt],
      (err) => {
        if (err) return reject(err);
        resolve();
      },
    );
  });
}

export function listGalleryUploadLinksByGalleryId(galleryId) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM gallery_upload_links WHERE gallery_id = ? ORDER BY created_at DESC', [galleryId], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

export function getGalleryUploadLinkByToken(uploadToken) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM gallery_upload_links WHERE upload_token = ?', [uploadToken], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

export function revokeGalleryUploadLink(uploadToken, ownerId) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE gallery_upload_links
       SET revoked_at = ?, updated_at = ?
       WHERE upload_token = ? AND gallery_id IN (SELECT id FROM galleries WHERE owner_id = ?)`,
      [new Date().toISOString(), new Date().toISOString(), uploadToken, ownerId],
      function (err) {
        if (err) return reject(err);
        resolve(this.changes || 0);
      },
    );
  });
}


export function insertExhibitComment(comment) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO exhibit_comments (id, gallery_id, item_id, user_name, content, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [comment.id, comment.galleryId, comment.itemId, comment.userName, comment.content, comment.createdAt],
      (err) => {
        if (err) return reject(err);
        resolve();
      },
    );
  });
}

export function getExhibitCommentById(commentId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM exhibit_comments WHERE id = ?', [commentId], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

export function deleteExhibitCommentById(commentId) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM exhibit_comments WHERE id = ?', [commentId], function (err) {
      if (err) return reject(err);
      resolve(this.changes || 0);
    });
  });
}

export function listExhibitCommentsByGalleryAndItem(galleryId, itemId) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM exhibit_comments WHERE gallery_id = ? AND item_id = ? ORDER BY created_at DESC',
      [galleryId, itemId],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      },
    );
  });
}

export function listExhibitCommentsByGalleryOwnerId(ownerId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT exhibit_comments.*, galleries.title AS gallery_title
       FROM exhibit_comments
       JOIN galleries ON galleries.id = exhibit_comments.gallery_id
       WHERE galleries.owner_id = ?
       ORDER BY exhibit_comments.created_at DESC`,
      [ownerId],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      },
    );
  });
}

export function deleteExhibitCommentByGalleryAndItem(galleryId, itemId, commentId) {
  return new Promise((resolve, reject) => {
    db.run(
      'DELETE FROM exhibit_comments WHERE gallery_id = ? AND item_id = ? AND id = ?',
      [galleryId, itemId, commentId],
      function (err) {
        if (err) return reject(err);
        resolve(this.changes || 0);
      },
    );
  });
}

export function insertGrowthChild(child) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO growth_children (id, owner_id, name, birthday, avatar_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [child.id, child.ownerId, child.name, child.birthday, child.avatarUrl ?? null, child.createdAt, child.updatedAt],
      (err) => {
        if (err) return reject(err);
        resolve();
      },
    );
  });
}

export function listGrowthChildrenByOwnerId(ownerId) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM growth_children WHERE owner_id = ? ORDER BY created_at DESC',
      [ownerId],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      },
    );
  });
}

export function getGrowthChildById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM growth_children WHERE id = ?', [id], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

export function insertGrowthExhibit(exhibit) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO growth_exhibits (id, owner_id, child_id, title, template_id, intro_story, is_private, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        exhibit.id,
        exhibit.ownerId,
        exhibit.childId,
        exhibit.title,
        exhibit.templateId,
        exhibit.introStory,
        exhibit.isPrivate ? 1 : 0,
        exhibit.createdAt,
        exhibit.updatedAt,
      ],
      (err) => {
        if (err) return reject(err);
        resolve();
      },
    );
  });
}

export function listGrowthExhibitsByOwnerId(ownerId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT e.*, c.name as child_name, c.birthday as child_birthday
       FROM growth_exhibits e
       JOIN growth_children c ON c.id = e.child_id
       WHERE e.owner_id = ?
       ORDER BY e.created_at DESC`,
      [ownerId],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      },
    );
  });
}

export function listAllGrowthExhibitsByOwnerId(ownerId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT e.*, c.name as child_name, c.birthday as child_birthday,
              (SELECT COUNT(*) FROM growth_assets a WHERE a.exhibit_id = e.id) AS asset_count,
              (SELECT COUNT(*) FROM growth_comments m WHERE m.exhibit_id = e.id) AS comment_count,
              (SELECT MAX(COALESCE(a.captured_at, a.created_at)) FROM growth_assets a WHERE a.exhibit_id = e.id) AS latest_activity_at
       FROM growth_exhibits e
       JOIN growth_children c ON c.id = e.child_id
       WHERE e.owner_id = ?
       ORDER BY COALESCE(latest_activity_at, e.updated_at, e.created_at) DESC`,
      [ownerId],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      },
    );
  });
}

export function getGrowthExhibitById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM growth_exhibits WHERE id = ?', [id], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

export function updateGrowthExhibitShareById(id, ownerId, updates) {
  return new Promise((resolve, reject) => {
    const fields = [];
    const values = [];

    if (Object.prototype.hasOwnProperty.call(updates, 'shareToken')) {
      fields.push('share_token = ?');
      values.push(updates.shareToken);
    }

    if (typeof updates.shareRole === 'string') {
      fields.push('share_role = ?');
      values.push(updates.shareRole);
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'shareExpiresAt')) {
      fields.push('share_expires_at = ?');
      values.push(updates.shareExpiresAt);
    }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());

    values.push(id, ownerId);

    db.run(
      `UPDATE growth_exhibits SET ${fields.join(', ')} WHERE id = ? AND owner_id = ?`,
      values,
      function (err) {
        if (err) return reject(err);
        resolve(this.changes || 0);
      },
    );
  });
}

export function getGrowthExhibitByShareToken(shareToken) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM growth_exhibits WHERE share_token = ?', [shareToken], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

export function insertGrowthAsset(asset) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO growth_assets (id, owner_id, exhibit_id, type, title, content_url, note, captured_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        asset.id,
        asset.ownerId,
        asset.exhibitId,
        asset.type,
        asset.title,
        asset.contentUrl ?? null,
        asset.note ?? null,
        asset.capturedAt ?? null,
        asset.createdAt,
      ],
      (err) => {
        if (err) return reject(err);
        resolve();
      },
    );
  });
}

export function listGrowthAssetsByExhibitId(exhibitId) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM growth_assets WHERE exhibit_id = ? ORDER BY COALESCE(captured_at, created_at) ASC, created_at ASC',
      [exhibitId],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      },
    );
  });
}

export function getGrowthAssetById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM growth_assets WHERE id = ?', [id], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

export function listGrowthAssetContentUrlsByOwnerId(ownerId) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT content_url FROM growth_assets WHERE owner_id = ? AND content_url IS NOT NULL',
      [ownerId],
      (err, rows) => {
        if (err) return reject(err);
        resolve((rows || []).map((row) => row.content_url));
      },
    );
  });
}

export function insertGrowthComment(comment) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO growth_comments (id, owner_id, exhibit_id, user_name, content, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [comment.id, comment.ownerId, comment.exhibitId, comment.userName, comment.content, comment.createdAt],
      (err) => {
        if (err) return reject(err);
        resolve();
      },
    );
  });
}

export function listGrowthCommentsByExhibitId(exhibitId) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM growth_comments WHERE exhibit_id = ? ORDER BY created_at DESC',
      [exhibitId],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      },
    );
  });
}

export function insertCompetition(competition) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO competitions (id, host_gallery_id, title, description, rules, cover_image, is_public, registration_deadline, voting_deadline, submission_fields_json, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        competition.id,
        competition.hostGalleryId,
        competition.title,
        competition.description,
        competition.rules,
        competition.coverImage ?? null,
        competition.isPublic ? 1 : 0,
        competition.registrationDeadline,
        competition.votingDeadline ?? null,
        competition.submissionFieldsJson ?? null,
        competition.status,
        competition.createdBy,
        competition.createdAt,
        competition.updatedAt,
      ],
      (err) => {
        if (err) return reject(err);
        resolve();
      },
    );
  });
}

export function listCompetitions({ includePrivate = false } = {}) {
  return new Promise((resolve, reject) => {
    const where = includePrivate ? '' : 'WHERE competitions.is_public = 1';
    db.all(
      `SELECT competitions.*, users.name AS created_by_name,
              host.title AS host_gallery_title,
              host.template_image AS host_gallery_image,
              host.category AS host_gallery_category,
              host.is_published AS host_gallery_is_published
       FROM competitions
       LEFT JOIN users ON users.id = competitions.created_by
       LEFT JOIN galleries AS host ON host.id = competitions.host_gallery_id
       ${where}
       ORDER BY competitions.created_at DESC`,
      [],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      },
    );
  });
}

export function getCompetitionById(id) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT competitions.*, users.name AS created_by_name,
              host.title AS host_gallery_title,
              host.template_image AS host_gallery_image,
              host.category AS host_gallery_category,
              host.is_published AS host_gallery_is_published
       FROM competitions
       LEFT JOIN users ON users.id = competitions.created_by
       LEFT JOIN galleries AS host ON host.id = competitions.host_gallery_id
       WHERE competitions.id = ?`,
      [id],
      (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      },
    );
  });
}

export function listCompetitionsByCreatorId(createdBy) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT competitions.*, users.name AS created_by_name,
              host.title AS host_gallery_title,
              host.template_image AS host_gallery_image,
              host.category AS host_gallery_category,
              host.is_published AS host_gallery_is_published
       FROM competitions
       LEFT JOIN users ON users.id = competitions.created_by
       LEFT JOIN galleries AS host ON host.id = competitions.host_gallery_id
       WHERE competitions.created_by = ?
       ORDER BY competitions.created_at DESC`,
      [createdBy],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      },
    );
  });
}

export function updateCompetitionById(id, updates) {
  return new Promise((resolve, reject) => {
    const fields = [];
    const values = [];

    if (typeof updates.title === 'string') {
      fields.push('title = ?');
      values.push(updates.title);
    }
    if (typeof updates.description === 'string') {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (typeof updates.rules === 'string') {
      fields.push('rules = ?');
      values.push(updates.rules);
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'coverImage')) {
      fields.push('cover_image = ?');
      values.push(updates.coverImage);
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'isPublic')) {
      fields.push('is_public = ?');
      values.push(updates.isPublic ? 1 : 0);
    }
    if (typeof updates.registrationDeadline === 'string') {
      fields.push('registration_deadline = ?');
      values.push(updates.registrationDeadline);
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'votingDeadline')) {
      fields.push('voting_deadline = ?');
      values.push(updates.votingDeadline);
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'submissionFieldsJson')) {
      fields.push('submission_fields_json = ?');
      values.push(updates.submissionFieldsJson);
    }
    if (typeof updates.status === 'string') {
      fields.push('status = ?');
      values.push(updates.status);
    }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    db.run(`UPDATE competitions SET ${fields.join(', ')} WHERE id = ?`, values, function (err) {
      if (err) return reject(err);
      resolve(this.changes || 0);
    });
  });
}

export function insertCompetitionEntry(entry) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO competition_entries (id, competition_id, gallery_id, gallery_owner_id, statement, submission_json, assets_json, status, rank, vote_count, submitted_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        entry.id,
        entry.competitionId,
        entry.galleryId,
        entry.galleryOwnerId,
        entry.statement,
        entry.submissionJson ?? null,
        entry.assetsJson ?? null,
        entry.status,
        entry.rank ?? null,
        entry.voteCount ?? 0,
        entry.submittedAt,
        entry.createdAt,
        entry.updatedAt,
      ],
      (err) => {
        if (err) return reject(err);
        resolve();
      },
    );
  });
}

export function listCompetitionEntriesByCompetitionId(competitionId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT competition_entries.*, galleries.title AS gallery_title, galleries.description AS gallery_description,
              galleries.template_image AS gallery_template_image, galleries.category AS gallery_category,
              users.name AS owner_name
       FROM competition_entries
       JOIN galleries ON galleries.id = competition_entries.gallery_id
       LEFT JOIN users ON users.id = competition_entries.gallery_owner_id
       WHERE competition_entries.competition_id = ?
       ORDER BY CASE competition_entries.rank IS NULL WHEN 1 THEN 1 ELSE 0 END, competition_entries.rank ASC, competition_entries.vote_count DESC, competition_entries.created_at ASC`,
      [competitionId],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      },
    );
  });
}

export function listCompetitionEntriesByOwnerId(ownerId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT competition_entries.*, competitions.title AS competition_title, competitions.status AS competition_status,
              competitions.registration_deadline AS competition_registration_deadline,
              galleries.title AS gallery_title, galleries.template_image AS gallery_template_image
       FROM competition_entries
       JOIN competitions ON competitions.id = competition_entries.competition_id
       JOIN galleries ON galleries.id = competition_entries.gallery_id
       WHERE competition_entries.gallery_owner_id = ?
       ORDER BY competition_entries.created_at DESC`,
      [ownerId],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      },
    );
  });
}

export function getCompetitionEntryByCompetitionAndGallery(competitionId, galleryId) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM competition_entries WHERE competition_id = ? AND gallery_id = ?',
      [competitionId, galleryId],
      (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      },
    );
  });
}

export function getCompetitionEntryById(id) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT competition_entries.*, galleries.title AS gallery_title, galleries.description AS gallery_description,
              galleries.template_image AS gallery_template_image, galleries.category AS gallery_category,
              users.name AS owner_name
       FROM competition_entries
       JOIN galleries ON galleries.id = competition_entries.gallery_id
       LEFT JOIN users ON users.id = competition_entries.gallery_owner_id
       WHERE competition_entries.id = ?`,
      [id],
      (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      },
    );
  });
}

export function updateCompetitionEntryById(id, updates) {
  return new Promise((resolve, reject) => {
    const fields = [];
    const values = [];

    if (typeof updates.statement === 'string') {
      fields.push('statement = ?');
      values.push(updates.statement);
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'submissionJson')) {
      fields.push('submission_json = ?');
      values.push(updates.submissionJson);
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'assetsJson')) {
      fields.push('assets_json = ?');
      values.push(updates.assetsJson);
    }
    if (typeof updates.status === 'string') {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'rank')) {
      fields.push('rank = ?');
      values.push(updates.rank);
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'voteCount')) {
      fields.push('vote_count = ?');
      values.push(updates.voteCount);
    }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    db.run(`UPDATE competition_entries SET ${fields.join(', ')} WHERE id = ?`, values, function (err) {
      if (err) return reject(err);
      resolve(this.changes || 0);
    });
  });
}

export function deleteCompetitionEntryById(id) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM competition_entries WHERE id = ?', [id], function (err) {
      if (err) return reject(err);
      resolve(this.changes || 0);
    });
  });
}

export function insertCompetitionVote(vote) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO competition_votes (id, competition_id, entry_id, voter_user_id, voter_name, voter_email, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [vote.id, vote.competitionId, vote.entryId, vote.voterUserId, vote.voterName, vote.voterEmail, vote.createdAt],
      (err) => {
        if (err) return reject(err);
        resolve();
      },
    );
  });
}

export async function insertCompetitionVoteAndRefreshCount(vote, database = db) {
  await runStatement(database, 'BEGIN IMMEDIATE');
  try {
    await runStatement(
      database,
      'INSERT INTO competition_votes (id, competition_id, entry_id, voter_user_id, voter_name, voter_email, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [vote.id, vote.competitionId, vote.entryId, vote.voterUserId, vote.voterName, vote.voterEmail, vote.createdAt],
    );
    await runStatement(
      database,
      `UPDATE competition_entries
       SET vote_count = (SELECT COUNT(*) FROM competition_votes WHERE entry_id = ?),
           updated_at = ?
       WHERE id = ?`,
      [vote.entryId, new Date().toISOString(), vote.entryId],
    );
    const entry = await getStatement(database, 'SELECT * FROM competition_entries WHERE id = ?', [vote.entryId]);
    await runStatement(database, 'COMMIT');
    return entry;
  } catch (error) {
    await runStatement(database, 'ROLLBACK').catch(() => {});
    throw error;
  }
}

export function countCompetitionVotesByEntryId(entryId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) AS count FROM competition_votes WHERE entry_id = ?', [entryId], (err, row) => {
      if (err) return reject(err);
      resolve(Number(row?.count || 0));
    });
  });
}

export function hasCompetitionVote(competitionId, entryId, voterUserId) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT id FROM competition_votes WHERE competition_id = ? AND entry_id = ? AND voter_user_id = ?',
      [competitionId, entryId, voterUserId],
      (err, row) => {
        if (err) return reject(err);
        resolve(Boolean(row));
      },
    );
  });
}

// ---- Visitor Memories ----

export function getVisitorMemory(userId, galleryId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM visitor_memories WHERE user_id = ? AND gallery_id = ?`,
      [userId, galleryId],
      (err, row) => {
        if (err) return reject(err);
        if (!row) return resolve(null);
        return resolve({
          id: row.id,
          userId: row.user_id,
          galleryId: row.gallery_id,
          visitedExhibitIds: JSON.parse(row.visited_exhibit_ids_json || '[]'),
          engagedExhibitIds: JSON.parse(row.engaged_exhibit_ids_json || '[]'),
          dwellSecondsByExhibit: JSON.parse(row.dwell_seconds_json || '{}'),
          preferredPersonality: row.preferred_personality || 'xiaobai',
          preferredLanguage: row.preferred_language || 'zh-TW',
          updatedAt: row.updated_at,
        });
      },
    );
  });
}

export function listVisitorMemoriesByGalleryOwnerId(ownerId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT visitor_memories.*
       FROM visitor_memories
       JOIN galleries ON galleries.id = visitor_memories.gallery_id
       WHERE galleries.owner_id = ?`,
      [ownerId],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      },
    );
  });
}

export function upsertVisitorMemory(memory) {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO visitor_memories
       (id, user_id, gallery_id, visited_exhibit_ids_json, engaged_exhibit_ids_json,
        dwell_seconds_json, preferred_personality, preferred_language, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, gallery_id) DO UPDATE SET
        visited_exhibit_ids_json = excluded.visited_exhibit_ids_json,
        engaged_exhibit_ids_json = excluded.engaged_exhibit_ids_json,
        dwell_seconds_json = excluded.dwell_seconds_json,
        preferred_personality = excluded.preferred_personality,
        preferred_language = excluded.preferred_language,
        updated_at = excluded.updated_at`,
      [
        memory.id,
        memory.userId,
        memory.galleryId,
        JSON.stringify(memory.visitedExhibitIds || []),
        JSON.stringify(memory.engagedExhibitIds || []),
        JSON.stringify(memory.dwellSecondsByExhibit || {}),
        memory.preferredPersonality || 'xiaobai',
        memory.preferredLanguage || 'zh-TW',
        now,
      ],
      (err) => {
        if (err) return reject(err);
        resolve();
      },
    );
  });
}

// ---- Exhibition Passports ----

function parsePassportRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    galleryId: row.gallery_id,
    tasks: JSON.parse(row.tasks_json || '[]'),
    status: row.status,
    souvenir: row.souvenir_json ? JSON.parse(row.souvenir_json) : null,
    souvenirToken: row.souvenir_token || null,
    completedAt: row.completed_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getExhibitionPassport(userId, galleryId, database = db) {
  return new Promise((resolve, reject) => {
    database.get(
      'SELECT * FROM exhibition_passports WHERE user_id = ? AND gallery_id = ?',
      [userId, galleryId],
      (error, row) => error ? reject(error) : resolve(parsePassportRow(row)),
    );
  });
}

export function insertExhibitionPassport(passport, database = db) {
  return new Promise((resolve, reject) => {
    database.run(
      `INSERT INTO exhibition_passports
       (id, user_id, gallery_id, tasks_json, status, souvenir_json, souvenir_token,
        completed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        passport.id,
        passport.userId,
        passport.galleryId,
        JSON.stringify(passport.tasks || []),
        passport.status || 'active',
        passport.souvenir ? JSON.stringify(passport.souvenir) : null,
        passport.souvenirToken || null,
        passport.completedAt || null,
        passport.createdAt,
        passport.updatedAt,
      ],
      (error) => error ? reject(error) : resolve(),
    );
  });
}

export function completeExhibitionPassport({ id, souvenir, completedAt }, database = db) {
  return new Promise((resolve, reject) => {
    database.run(
      `UPDATE exhibition_passports
       SET status = 'completed', souvenir_json = ?, completed_at = ?, updated_at = ?
       WHERE id = ? AND status = 'active'`,
      [JSON.stringify(souvenir), completedAt, completedAt, id],
      function onComplete(error) {
        if (error) reject(error);
        else resolve(this.changes > 0);
      },
    );
  });
}

export function publishExhibitionPassport({ id, souvenirToken }, database = db) {
  return new Promise((resolve, reject) => {
    database.run(
      `UPDATE exhibition_passports
       SET souvenir_token = ?, updated_at = ?
       WHERE id = ? AND status = 'completed' AND souvenir_token IS NULL`,
      [souvenirToken, new Date().toISOString(), id],
      function onPublish(error) {
        if (error) reject(error);
        else resolve(this.changes > 0);
      },
    );
  });
}

export function getPublishedSouvenirByToken(token, database = db) {
  return new Promise((resolve, reject) => {
    database.get(
      `SELECT souvenir_json FROM exhibition_passports
       WHERE souvenir_token = ? AND souvenir_json IS NOT NULL`,
      [token],
      (error, row) => {
        if (error) reject(error);
        else resolve(row ? JSON.parse(row.souvenir_json) : null);
      },
    );
  });
}

export function listRecentPublishedSouvenirs(limit, database = db) {
  const safeLimit = Math.min(12, Math.max(1, Number.isInteger(limit) ? limit : 6));
  return new Promise((resolve, reject) => {
    database.all(
      `SELECT souvenir_json, souvenir_token FROM exhibition_passports
       WHERE souvenir_token IS NOT NULL AND souvenir_json IS NOT NULL
       ORDER BY completed_at DESC LIMIT ?`,
      [safeLimit],
      (error, rows) => {
        if (error) reject(error);
        else resolve((rows || []).map((row) => ({
          ...JSON.parse(row.souvenir_json),
          token: row.souvenir_token,
        })));
      },
    );
  });
}
