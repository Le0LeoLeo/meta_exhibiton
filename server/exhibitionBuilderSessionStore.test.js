// @vitest-environment node

import sqlite3 from 'sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  appendExhibitionBuilderSessionVersion,
  createExhibitionBuilderSessionRecord,
  getExhibitionBuilderSessionRecord,
  initDb,
  saveExhibitionBuilderSessionReview,
} from './db.js';

let database;

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    database.run(sql, params, (error) => error ? reject(error) : resolve());
  });
}

function session(versionId = 'version-1') {
  return {
    sessionId: 'builder-1',
    versionId,
    exhibition: { title: 'Memory', curatorialStatement: 'A route.', sections: [] },
    scene: {
      roomSize: { width: 20, length: 16, height: 6, wallThickness: 0.1 },
      items: [],
      floorPlanElements: [],
      wallMaterialOverrides: {},
    },
    source: 'fallback',
    warnings: [],
    revisionCount: versionId === 'version-1' ? 0 : 1,
    status: versionId === 'version-1' ? 'generated' : 'revised',
  };
}

beforeEach(async () => {
  database = new sqlite3.Database(':memory:');
  await initDb(database);
  await run(
    `INSERT INTO users (id, email, name, password_hash, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    ['user-1', 'builder@example.com', 'Builder', 'hash', new Date().toISOString()],
  );
});

afterEach(async () => {
  await new Promise((resolve) => database.close(() => resolve()));
});

describe('exhibition builder session store', () => {
  it('creates and restores a user-owned session with its first version', async () => {
    await createExhibitionBuilderSessionRecord({
      userId: 'user-1',
      input: { prompt: 'Build a memory exhibition', style: 'warm-museum' },
      session: session(),
    }, database);

    const restored = await getExhibitionBuilderSessionRecord('builder-1', database);

    expect(restored).toMatchObject({
      id: 'builder-1',
      userId: 'user-1',
      currentVersionId: 'version-1',
      revisionCount: 0,
      status: 'generated',
      input: { prompt: 'Build a memory exhibition', style: 'warm-museum' },
    });
    expect(restored.versions).toHaveLength(1);
    expect(restored.currentSession).toMatchObject({
      sessionId: 'builder-1',
      versionId: 'version-1',
    });
  });

  it('persists a review on the expected current version', async () => {
    await createExhibitionBuilderSessionRecord({
      userId: 'user-1',
      input: { prompt: 'Build it' },
      session: session(),
    }, database);

    const saved = await saveExhibitionBuilderSessionReview({
      sessionId: 'builder-1',
      userId: 'user-1',
      expectedVersionId: 'version-1',
      reviewResponse: {
        sessionId: 'builder-1',
        versionId: 'version-1',
        status: 'reviewed',
        source: 'fallback',
        review: { technicalScore: 80, curatorialScore: 78, overallStatus: 'needs_revision', blockingIssues: [], viewReviews: [], revisionPrompt: 'Improve.' },
      },
    }, database);

    expect(saved).toBe(true);
    const restored = await getExhibitionBuilderSessionRecord('builder-1', database);
    expect(restored.currentSession.review).toMatchObject({ technicalScore: 80 });
    expect(restored.status).toBe('reviewed');
  });

  it('appends a revision only when the expected version is still current', async () => {
    await createExhibitionBuilderSessionRecord({
      userId: 'user-1',
      input: { prompt: 'Build it' },
      session: session(),
    }, database);

    await expect(appendExhibitionBuilderSessionVersion({
      sessionId: 'builder-1',
      userId: 'user-1',
      expectedVersionId: 'stale-version',
      session: session('version-2'),
    }, database)).resolves.toBe(false);

    await expect(appendExhibitionBuilderSessionVersion({
      sessionId: 'builder-1',
      userId: 'user-1',
      expectedVersionId: 'version-1',
      session: session('version-2'),
    }, database)).resolves.toBe(true);

    const restored = await getExhibitionBuilderSessionRecord('builder-1', database);
    expect(restored.currentVersionId).toBe('version-2');
    expect(restored.versions.map((version) => version.versionId)).toEqual(['version-1', 'version-2']);
  });
});
