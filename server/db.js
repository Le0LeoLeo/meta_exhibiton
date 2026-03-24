import sqlite3 from 'sqlite3';
import path from 'node:path';
import fs from 'node:fs';

const dbFile = path.join(process.cwd(), 'server', 'app.db');

// 確保 server 資料夾存在（通常已存在）
const dir = path.dirname(dbFile);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

sqlite3.verbose();

export const db = new sqlite3.Database(dbFile);

// 初始化資料表
export function initDb() {
  db.serialize(() => {
    // SQLite 預設不啟用外鍵約束，需要手動打開
    db.run('PRAGMA foreign_keys = ON');

    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

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

    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_galleries_share_token ON galleries(share_token)');
  });
}

export function getUserByEmail(email) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

export function insertUser(user) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
      [user.id, user.email, user.name, user.passwordHash, user.createdAt],
      (err) => {
        if (err) return reject(err);
        resolve();
      }
    );
  });
}

export function getUserById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

export function updateUserName(id, name) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE users SET name = ? WHERE id = ?', [name, id], (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

export function updateUserPasswordHash(id, passwordHash) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id], (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

export function deleteUserById(id) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM users WHERE id = ?', [id], (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
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

export function getGalleryById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM galleries WHERE id = ?', [id], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

export function updateGalleryById(id, ownerId, updates) {
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

export function deleteGalleryById(id, ownerId) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM galleries WHERE id = ? AND owner_id = ?', [id, ownerId], function (err) {
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

export function getGalleryByShareToken(shareToken) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM galleries WHERE share_token = ?', [shareToken], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}
