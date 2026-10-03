import { JOURNEY_SCHEMA } from './services/journeyAnalytics.js';
import { EMAIL_VERIFICATION_SCHEMA } from './services/emailVerificationService.js';
import { PASSWORD_RESET_SCHEMA } from './services/passwordResetService.js';
import { listPublishedGalleryRows } from './repositories/publicGalleryRepository.js';
import { listOwnerGalleryRows } from './repositories/ownerGalleryRepository.js';
import sqlite3 from 'sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { checkDatabaseReadiness } from './readiness.js';
import { runStatement } from './repositories/sqliteHelpers.js';
import * as userRepository from './repositories/userRepository.js';
import * as mediaRepository from './repositories/mediaRepository.js';
import { QUICK_EXHIBITION_SCHEMA } from './repositories/quickExhibitionRepository.js';
import { GALLERY_ANALYTICS_SCHEMA } from './repositories/galleryAnalyticsRepository.js';
import { BOX_SCHEMA } from './repositories/legacyBoxData.js';
import { GALLERY_FOLDER_SCHEMA } from './repositories/galleryFolderRepository.js';

export const dbFile = path.join(process.cwd(), 'server', 'app.db');

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
    let migrationError;
    let validationStarted = false;

    const finish = () => {
      if (!queueFinished || validationStarted) return;
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

    db.run('ALTER TABLE users ADD COLUMN email_verified_at TEXT', (err) => {
      if (err && !String(err.message || '').includes('duplicate column name')) migrationError ??= err;
    });
    db.run(JOURNEY_SCHEMA, (err) => { if (err) migrationError ??= err; });
    db.run(EMAIL_VERIFICATION_SCHEMA, (err) => { if (err) migrationError ??= err; });
    db.run(PASSWORD_RESET_SCHEMA, (err) => { if (err) migrationError ??= err; });

    db.run('ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0', (err) => {
      if (err && !String(err.message || '').includes('duplicate column name')) {
        migrationError ??= new Error(`[db] failed to add session version: ${err.message}`, { cause: err });
      }
    });

    db.run('ALTER TABLE users ADD COLUMN avatar_appearance_json TEXT', (err) => {
      if (err && !String(err.message || '').includes('duplicate column name')) {
        migrationError ??= new Error(
          `[db] failed to add avatar appearance column: ${err.message}`,
          { cause: err },
        );
      }
    });

    db.run('ALTER TABLE users ADD COLUMN google_subject TEXT', (err) => {
      if (err && !String(err.message || '').includes('duplicate column name')) {
        migrationError ??= new Error(
          `[db] failed to add Google subject column: ${err.message}`,
          { cause: err },
        );
      }
    });
    db.run(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_subject
       ON users(google_subject)
       WHERE google_subject IS NOT NULL`,
    );

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
    db.run('ALTER TABLE galleries ADD COLUMN is_box INTEGER NOT NULL DEFAULT 0', (err) => {
      if (err && !String(err.message || '').includes('duplicate column name')) migrationError ??= err;
    });
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
        usage TEXT NOT NULL DEFAULT 'gallery',
        FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(gallery_id) REFERENCES galleries(id) ON DELETE SET NULL
      );
    `);

    db.run('ALTER TABLE media_assets ADD COLUMN library_retained INTEGER NOT NULL DEFAULT 0', (err) => {
      if (err && !String(err.message || '').includes('duplicate column name')) migrationError ??= err;
    });
    db.exec(BOX_SCHEMA, (err) => { if (err) migrationError ??= err; });
    db.exec(GALLERY_FOLDER_SCHEMA, (err) => { if (err) migrationError ??= err; });
    db.run('CREATE INDEX IF NOT EXISTS idx_media_assets_owner_id ON media_assets(owner_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_media_assets_gallery_id ON media_assets(gallery_id)');
    db.run("ALTER TABLE media_assets ADD COLUMN usage TEXT NOT NULL DEFAULT 'gallery'", (err) => {
      if (err && !String(err.message || '').includes('duplicate column name')) {
        migrationError ??= new Error(
          `[db] failed to add media usage column: ${err.message}`,
          { cause: err },
        );
      }
    });

    for (const column of ['width', 'height']) {
      db.run(`ALTER TABLE media_assets ADD COLUMN ${column} INTEGER`, (err) => {
        if (err && !String(err.message || '').includes('duplicate column name')) {
          migrationError ??= new Error(`[db] failed to add media ${column}: ${err.message}`, { cause: err });
        }
      });
    }
    db.exec(QUICK_EXHIBITION_SCHEMA, (err) => {
      if (err) migrationError ??= err;
    });
    db.exec(GALLERY_ANALYTICS_SCHEMA, (err) => {
      if (err) migrationError ??= err;
    });
    for (const column of ['applied_input_json', 'applied_result_json', 'editor_managed_at']) {
      db.run(`ALTER TABLE quick_exhibition_drafts ADD COLUMN ${column} TEXT`, (err) => {
        if (err && !String(err.message || '').includes('duplicate column name')) {
          migrationError ??= new Error(`[db] failed to add quick draft ${column}: ${err.message}`, { cause: err });
        }
      });
    }
    // Only ready/published rows still hold the exact applied input/result pair.
    // An older candidate cannot recover omitted client IDs or prior settings.
    db.run(`UPDATE quick_exhibition_drafts SET applied_input_json = input_json, applied_result_json = result_json
      WHERE status IN ('ready', 'published') AND result_json IS NOT NULL
        AND applied_input_json IS NULL AND applied_result_json IS NULL`, (err) => {
      if (err) migrationError ??= err;
    });

    db.run('ALTER TABLE galleries ADD COLUMN scene_json TEXT', (err) => {
      if (err && !String(err.message || '').includes('duplicate column name')) {
        console.error('[db] failed to add scene_json column:', err);
      }
    });

    db.run('ALTER TABLE galleries ADD COLUMN revision INTEGER NOT NULL DEFAULT 0', (err) => {
      if (err && !String(err.message || '').includes('duplicate column name')) {
        migrationError ??= new Error(`[db] failed to add gallery revision: ${err.message}`, { cause: err });
      }
    });
    // Cover every scene writer, including quick-exhibition transactions.
    db.run(`CREATE TRIGGER IF NOT EXISTS gallery_content_revision
      AFTER UPDATE OF scene_json, title, description, template_title, template_image, category ON galleries
      WHEN NEW.revision = OLD.revision
      BEGIN UPDATE galleries SET revision = OLD.revision + 1 WHERE id = NEW.id; END`, (err) => {
      if (err) migrationError ??= err;
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

    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_galleries_share_token ON galleries(share_token)');
    db.run('CREATE INDEX IF NOT EXISTS idx_galleries_is_published ON galleries(is_published, published_at)');
    db.run('CREATE INDEX IF NOT EXISTS idx_galleries_public_page ON galleries(is_published, COALESCE(published_at, updated_at) DESC, id DESC)', (err) => {
      if (err) migrationError ??= new Error(`[db] failed to index public gallery pages: ${err.message}`, { cause: err });
    });

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
        last_recommended_exhibit_id TEXT,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    db.run('ALTER TABLE visitor_memories ADD COLUMN last_recommended_exhibit_id TEXT', (err) => {
      if (err && !String(err.message || '').includes('duplicate column name')) {
        migrationError ??= new Error(
          `[db] failed to add visitor recommendation memory column: ${err.message}`,
          { cause: err },
        );
      }
    });

    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_visitor_memories_user_gallery ON visitor_memories(user_id, gallery_id)');

    db.run(`
      CREATE TABLE IF NOT EXISTS exhibition_builder_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        input_json TEXT NOT NULL,
        versions_json TEXT NOT NULL DEFAULT '[]',
        current_version_id TEXT NOT NULL,
        revision_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    db.run('CREATE INDEX IF NOT EXISTS idx_exhibition_builder_sessions_user_updated ON exhibition_builder_sessions(user_id, updated_at)');

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

export function getUserByGoogleSubject(subject) {
  return userRepository.getUserByGoogleSubject(subject, db);
}

export function insertUser(user) {
  return userRepository.insertUser(user, db);
}

export function linkGoogleSubject(id, subject) {
  return userRepository.linkGoogleSubject(id, subject, db);
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
  return listOwnerGalleryRows(db, ownerId);
}

export function listPublishedGalleries(options) {
  return listPublishedGalleryRows(db, options);
}

export function getPublishedGalleryById(id) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT galleries.*, users.name AS owner_name
       FROM galleries
       LEFT JOIN users ON users.id = galleries.owner_id
       WHERE galleries.id = ? AND galleries.is_published = 1 AND galleries.is_box = 0`,
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

export function updateGalleryById(id, ownerId, updates, database = db) {
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
    if (updates.sceneJson !== undefined) {
      fields.push('scene_json = ?');
      values.push(updates.sceneJson);
    }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());

    values.push(id, ownerId);

    const versioned = Number.isSafeInteger(updates.expectedRevision);
    if (versioned) values.push(updates.expectedRevision);
    database.run(
      `UPDATE galleries SET ${fields.join(', ')} WHERE id = ? AND owner_id = ?${versioned ? ' AND revision = ?' : ''}`,
      values,
      function (err) {
        if (err) return reject(err);
        if (!this.changes && versioned) {
          database.get('SELECT id FROM galleries WHERE id = ? AND owner_id = ?', [id, ownerId], (error, row) => {
            if (error) return reject(error);
            if (row) return reject(Object.assign(new Error('This exhibition has changed. Reload the latest version before saving.'), { code: 'GALLERY_CONFLICT', status: 409 }));
            resolve(0);
          });
          return;
        }
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
    db.get('SELECT * FROM galleries WHERE share_token = ? AND is_box = 0', [shareToken], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
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

export function listGrowthAssetContentUrlsByOwnerId(ownerId) {
  return new Promise((resolve, reject) => {
    db.get("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'growth_assets'", [], (schemaError, table) => {
      if (schemaError) return reject(schemaError);
      if (!table) return resolve([]);
      db.all(
        'SELECT content_url FROM growth_assets WHERE owner_id = ? AND content_url IS NOT NULL',
        [ownerId],
        (err, rows) => {
          if (err) return reject(err);
          resolve((rows || []).map((row) => row.content_url));
        },
      );
    });
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
          lastRecommendedExhibitId: row.last_recommended_exhibit_id || null,
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
        dwell_seconds_json, preferred_personality, preferred_language,
        last_recommended_exhibit_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, gallery_id) DO UPDATE SET
        visited_exhibit_ids_json = excluded.visited_exhibit_ids_json,
        engaged_exhibit_ids_json = excluded.engaged_exhibit_ids_json,
        dwell_seconds_json = excluded.dwell_seconds_json,
        preferred_personality = excluded.preferred_personality,
        preferred_language = excluded.preferred_language,
        last_recommended_exhibit_id = excluded.last_recommended_exhibit_id,
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
        memory.lastRecommendedExhibitId || null,
        now,
      ],
      (err) => {
        if (err) return reject(err);
        resolve();
      },
    );
  });
}

function parseBuilderSessionRow(row) {
  if (!row) return null;
  const versions = JSON.parse(row.versions_json || '[]');
  return {
    id: row.id,
    userId: row.user_id,
    input: JSON.parse(row.input_json || '{}'),
    versions,
    currentVersionId: row.current_version_id,
    currentSession: versions.find((version) => version.versionId === row.current_version_id) || null,
    revisionCount: row.revision_count,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createExhibitionBuilderSessionRecord({ userId, input, session }, database = db) {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    database.run(
      `INSERT INTO exhibition_builder_sessions
       (id, user_id, input_json, versions_json, current_version_id, revision_count, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        session.sessionId,
        userId,
        JSON.stringify(input || {}),
        JSON.stringify([{ ...session, review: session.review || null }]),
        session.versionId,
        session.revisionCount || 0,
        session.status || 'generated',
        now,
        now,
      ],
      (error) => error ? reject(error) : resolve(),
    );
  });
}

export function getExhibitionBuilderSessionRecord(sessionId, database = db) {
  return new Promise((resolve, reject) => {
    database.get(
      'SELECT * FROM exhibition_builder_sessions WHERE id = ?',
      [sessionId],
      (error, row) => {
        if (error) reject(error);
        else resolve(parseBuilderSessionRow(row));
      },
    );
  });
}

export async function saveExhibitionBuilderSessionReview({
  sessionId,
  userId,
  expectedVersionId,
  reviewResponse,
}, database = db) {
  const record = await getExhibitionBuilderSessionRecord(sessionId, database);
  if (!record || record.userId !== userId || record.currentVersionId !== expectedVersionId) return false;

  const versions = record.versions.map((version) => (
    version.versionId === expectedVersionId
      ? {
          ...version,
          review: reviewResponse.review || null,
          reviewSource: reviewResponse.source || null,
          reviewStatus: reviewResponse.status,
          reviewMessage: reviewResponse.message || null,
          reviewErrorCode: reviewResponse.errorCode || null,
        }
      : version
  ));

  return new Promise((resolve, reject) => {
    database.run(
      `UPDATE exhibition_builder_sessions
       SET versions_json = ?, status = ?, updated_at = ?
       WHERE id = ? AND user_id = ? AND current_version_id = ?`,
      [
        JSON.stringify(versions),
        reviewResponse.status || 'reviewed',
        new Date().toISOString(),
        sessionId,
        userId,
        expectedVersionId,
      ],
      function onReviewSaved(error) {
        if (error) reject(error);
        else resolve(this.changes > 0);
      },
    );
  });
}

export async function appendExhibitionBuilderSessionVersion({
  sessionId,
  userId,
  expectedVersionId,
  session,
}, database = db) {
  const record = await getExhibitionBuilderSessionRecord(sessionId, database);
  if (!record || record.userId !== userId || record.currentVersionId !== expectedVersionId) return false;

  const versions = [...record.versions, { ...session, review: session.review || null }];
  return new Promise((resolve, reject) => {
    database.run(
      `UPDATE exhibition_builder_sessions
       SET versions_json = ?, current_version_id = ?, revision_count = ?, status = ?, updated_at = ?
       WHERE id = ? AND user_id = ? AND current_version_id = ?`,
      [
        JSON.stringify(versions),
        session.versionId,
        session.revisionCount || 0,
        session.status || 'revised',
        new Date().toISOString(),
        sessionId,
        userId,
        expectedVersionId,
      ],
      function onVersionAppended(error) {
        if (error) reject(error);
        else resolve(this.changes > 0);
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
