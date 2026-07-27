import { randomUUID } from 'node:crypto';
import { allStatement, runStatement } from './sqliteHelpers.js';

export function getUserByEmail(email, database) {
  return new Promise((resolve, reject) => {
    database.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

export function insertUser(user, database) {
  return new Promise((resolve, reject) => {
    database.run(
      'INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
      [user.id, user.email, user.name, user.passwordHash, user.createdAt],
      (err) => {
        if (err) return reject(err);
        resolve();
      },
    );
  });
}

export function getUserById(id, database) {
  return new Promise((resolve, reject) => {
    database.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

export function updateUserName(id, name, database) {
  return new Promise((resolve, reject) => {
    database.run('UPDATE users SET name = ? WHERE id = ?', [name, id], (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

export function updateUserAvatarAppearance(id, appearanceJson, database) {
  return runStatement(
    database,
    'UPDATE users SET avatar_appearance_json = ? WHERE id = ?',
    [appearanceJson, id],
  );
}

export function updateUserPasswordHash(id, passwordHash, database) {
  return new Promise((resolve, reject) => {
    database.run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id], (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

export function deleteUserById(id, database) {
  return new Promise((resolve, reject) => {
    database.run('DELETE FROM users WHERE id = ?', [id], (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

export async function deleteUserAndCreateFileCleanupJobs(ownerId, requestedJobs, database) {
  const now = new Date().toISOString();
  const jobs = (requestedJobs || []).map((job) => ({
    id: randomUUID(),
    ownerId,
    kind: job.kind,
    target: job.target,
    status: 'pending',
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  }));

  await runStatement(database, 'BEGIN IMMEDIATE');
  try {
    for (const job of jobs) {
      await runStatement(
        database,
        `INSERT INTO file_cleanup_jobs
         (id, owner_id, kind, target, status, attempts, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [job.id, job.ownerId, job.kind, job.target, job.status, job.attempts, job.createdAt, job.updatedAt],
      );
    }
    const deleted = await runStatement(database, 'DELETE FROM users WHERE id = ?', [ownerId]);
    if (deleted.changes !== 1) throw new Error('user not found');
    await runStatement(database, 'COMMIT');
    return jobs;
  } catch (error) {
    await runStatement(database, 'ROLLBACK').catch(() => {});
    throw error;
  }
}

export function markFileCleanupJobCompleted(id, database) {
  return runStatement(
    database,
    `UPDATE file_cleanup_jobs
     SET status = 'completed', attempts = attempts + 1, last_error = NULL, updated_at = ?
     WHERE id = ?`,
    [new Date().toISOString(), id],
  );
}

export function markFileCleanupJobFailed(id, errorMessage, database) {
  return runStatement(
    database,
    `UPDATE file_cleanup_jobs
     SET status = 'failed', attempts = attempts + 1, last_error = ?, updated_at = ?
     WHERE id = ?`,
    [String(errorMessage || 'cleanup failed').slice(0, 1000), new Date().toISOString(), id],
  );
}

export async function listRetryableFileCleanupJobs(database, limit = 100) {
  const rows = await allStatement(
    database,
    `SELECT id, kind, target
     FROM file_cleanup_jobs
     WHERE status IN ('pending', 'failed')
     ORDER BY updated_at ASC
     LIMIT ?`,
    [Math.max(1, Math.min(Number(limit) || 100, 1000))],
  );
  return rows.map((row) => ({ id: row.id, kind: row.kind, target: row.target }));
}
