// @vitest-environment node

import sqlite3 from 'sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  checkDatabaseReadiness,
  checkDependenciesReadiness,
  checkMultiplayerReadiness,
  registerHealthRoutes,
} from './readiness.js';

const databases = [];

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => new Promise((resolve) => {
    database.close(() => resolve());
  })));
});

function exec(database, sql) {
  return new Promise((resolve, reject) => {
    database.exec(sql, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function createResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

describe('health endpoints', () => {
  it('keeps liveness independent of database state', () => {
    const routes = new Map();
    const app = { get: (path, handler) => routes.set(path, handler) };
    registerHealthRoutes(app, { checkReadiness: vi.fn() });
    const response = createResponse();

    routes.get('/api/health')({}, response);

    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it('returns a sanitized 503 when the schema readiness check fails', async () => {
    const routes = new Map();
    const app = { get: (path, handler) => routes.set(path, handler) };
    registerHealthRoutes(app, {
      checkReadiness: () => Promise.reject(new Error('SQLITE_ERROR: no such table users')),
      onReadinessError: vi.fn(),
    });
    const response = createResponse();

    await routes.get('/api/ready')({}, response);

    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith({ ok: false, status: 'not_ready' });
    expect(JSON.stringify(response.json.mock.calls)).not.toContain('SQLITE_ERROR');
    expect(JSON.stringify(response.json.mock.calls)).not.toContain('users');
  });
});

describe('database readiness', () => {
  it('rejects when required schema is missing', async () => {
    const database = new sqlite3.Database(':memory:');
    databases.push(database);

    await expect(checkDatabaseReadiness(database)).rejects.toThrow();
  });

  it('resolves when required tables and columns are queryable', async () => {
    const database = new sqlite3.Database(':memory:');
    databases.push(database);
    await exec(database, `
      CREATE TABLE users (id TEXT);
      CREATE TABLE galleries (scene_json TEXT);
      CREATE TABLE competitions (submission_fields_json TEXT);
      CREATE TABLE competition_entries (submission_json TEXT);
      CREATE TABLE competition_votes (voter_email TEXT, voter_user_id TEXT);
      CREATE TABLE file_cleanup_jobs (id TEXT);
      CREATE UNIQUE INDEX idx_competition_votes_unique_voter_user
        ON competition_votes(voter_user_id);
      CREATE TRIGGER trg_competition_votes_require_voter_user
        BEFORE INSERT ON competition_votes
        WHEN NEW.voter_user_id IS NULL
        BEGIN
          SELECT RAISE(ABORT, 'voter_user_id is required');
        END;
    `);

    await expect(checkDatabaseReadiness(database)).resolves.toBeUndefined();
  });
});

describe('dependency readiness', () => {
  it('checks database, shared rate-limit storage, and multiplayer collaboration', async () => {
    const databaseCheck = vi.fn().mockResolvedValue(undefined);
    const rateLimitCheck = vi.fn().mockRejectedValue(new Error('Redis unavailable'));
    const multiplayerCheck = vi.fn().mockResolvedValue(undefined);

    await expect(checkDependenciesReadiness(
      databaseCheck,
      rateLimitCheck,
      multiplayerCheck,
    ))
      .rejects.toThrow('Redis unavailable');
    expect(databaseCheck).toHaveBeenCalledOnce();
    expect(rateLimitCheck).toHaveBeenCalledOnce();
    expect(multiplayerCheck).toHaveBeenCalledOnce();
  });

  it('delegates multiplayer readiness and rejects before initialization', async () => {
    const checkReadiness = vi.fn().mockResolvedValue(undefined);

    await expect(checkMultiplayerReadiness({ checkReadiness }))
      .resolves.toBeUndefined();
    expect(checkReadiness).toHaveBeenCalledOnce();
    await expect(checkMultiplayerReadiness(null))
      .rejects.toThrow('multiplayer collaboration is not initialized');
  });
});
