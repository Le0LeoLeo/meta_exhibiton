// @vitest-environment node
import sqlite3 from 'sqlite3';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initDb, updateGalleryById } from './db.js';
import { createQuickExhibitionRepository, hashScene } from './repositories/quickExhibitionRepository.js';
import { getStatement, runStatement } from './repositories/sqliteHelpers.js';

let directory;
let database;
let repository;
const input = { title: 'My Art Exhibition', language: 'en', style: 'white-box', assets: [] };
const create = () => repository.create({ draftId: 'draft', ownerId: 'owner', input });
const operation = (expectedRevision = 0, overrides = {}) => ({
  draftId: 'draft', ownerId: 'owner', expectedRevision, requestId: `request-${expectedRevision}`,
  fingerprint: `fingerprint-${expectedRevision}`, result: { scene: { items: [] }, title: input.title }, ...overrides,
});

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'quick-exhibition-db-'));
  const filename = path.join(directory, 'app.db');
  database = new sqlite3.Database(filename);
  await initDb(database);
  await runStatement(database, `INSERT INTO users (id, email, name, password_hash, created_at) VALUES ('owner', 'owner@test.test', 'Owner', 'hash', 'now')`);
  repository = createQuickExhibitionRepository({ filename });
});

afterEach(async () => {
  await new Promise((resolve, reject) => database.close((error) => error ? reject(error) : resolve()));
  await rm(directory, { recursive: true, force: true });
});

describe('quick draft persistence', () => {
  it('creates gallery and draft once under simultaneous PUT retries and hides other owners', async () => {
    const [a, b] = await Promise.all([create(), create()]);
    expect(a.gallery_id).toBe(b.gallery_id);
    expect(a.revision).toBe(0);
    expect(await getStatement(database, 'SELECT COUNT(*) AS count FROM galleries')).toEqual({ count: 1 });
    await expect(repository.create({ draftId: 'draft', ownerId: 'other', input })).rejects.toMatchObject({ status: 404 });
    await expect(repository.get('draft', 'other')).rejects.toMatchObject({ status: 404 });
    await expect(repository.patch({ draftId: 'draft', ownerId: 'other', expectedRevision: 0, input })).rejects.toMatchObject({ status: 404 });
  });

  it('rolls gallery creation back if the draft insert fails', async () => {
    await runStatement(database, `CREATE TRIGGER reject_draft BEFORE INSERT ON quick_exhibition_drafts BEGIN SELECT RAISE(ABORT, 'test failure'); END`);
    await expect(create()).rejects.toThrow('test failure');
    expect(await getStatement(database, 'SELECT COUNT(*) AS count FROM galleries')).toEqual({ count: 0 });
  });

  it('allows only one concurrent revision writer on isolated connections', async () => {
    await create();
    const outcomes = await Promise.allSettled(['First', 'Second'].map((title) => repository.patch({
      draftId: 'draft', ownerId: 'owner', expectedRevision: 0, input: { ...input, title },
    })));
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.find((outcome) => outcome.status === 'rejected').reason.code).toBe('DRAFT_CHANGED');
    expect((await repository.get('draft', 'owner')).revision).toBe(1);
  });

  it('saves first results, keeps later candidates separate, and advances the base only on apply', async () => {
    const draft = await create();
    const first = await repository.saveResult(operation());
    expect(first.status).toBe('ready');
    expect(first.scene_json).toBe(JSON.stringify(first.result.scene));
    const candidateResult = { scene: { items: [{ id: 'candidate' }] }, title: 'Candidate' };
    const candidate = await repository.saveResult(operation(1, { result: candidateResult }));
    expect(candidate.status).toBe('candidate_ready');
    expect(candidate.scene_json).toBe(first.scene_json);
    expect(candidate.base_scene_hash).toBe(first.base_scene_hash);
    const applied = await repository.saveResult(operation(2, { apply: true }));
    expect(applied.status).toBe('ready');
    expect(applied.base_scene_hash).toBe(hashScene(JSON.stringify(candidateResult.scene)));
    expect((await getStatement(database, 'SELECT title FROM galleries WHERE id = ?', [draft.gallery_id])).title).toBe('Candidate');
  });

  it('returns the saved root on concurrent identical retries and rejects changed fingerprints and stale revisions', async () => {
    await create();
    const [a, b] = await Promise.all([repository.saveResult(operation()), repository.saveResult(operation())]);
    expect(a).toEqual(b);
    await expect(repository.saveResult(operation(0, { fingerprint: 'different' }))).rejects.toMatchObject({ code: 'REQUEST_ID_REUSED' });
    await expect(repository.saveResult(operation(0, { requestId: 'new' }))).rejects.toMatchObject({ code: 'DRAFT_CHANGED' });
    await repository.patch({ draftId: 'draft', ownerId: 'owner', expectedRevision: 1, input: { ...input, title: 'Changed' } });
    await expect(repository.saveResult(operation())).rejects.toMatchObject({ code: 'DRAFT_CHANGED' });
  });

  it('discards concurrently to the exact applied snapshots and keeps the gallery unchanged', async () => {
    const draft = await create();
    const applied = await repository.saveResult(operation());
    const gallery = await getStatement(database, 'SELECT * FROM galleries WHERE id = ?', [draft.gallery_id]);
    await repository.patch({ draftId: 'draft', ownerId: 'owner', expectedRevision: 1,
      input: { ...input, title: 'Candidate', language: 'zh-TW' } });
    const candidate = await repository.saveResult(operation(2, { result: { scene: { items: [{ id: 'candidate' }] }, title: 'Candidate' } }));
    expect(candidate.applied_input_json).toBe(applied.input_json);
    expect(candidate.applied_result_json).toBe(applied.result_json);
    const discard = { ...operation(3, { requestId: 'discard', fingerprint: 'discard-fingerprint' }), validateResult: () => {} };
    const [first, retry] = await Promise.all([repository.discard(discard), repository.discard(discard)]);
    expect(first).toEqual(retry);
    expect(first).toMatchObject({ revision: 4, status: 'ready', input: applied.input, result: applied.result,
      base_scene_hash: applied.base_scene_hash, scene_json: applied.scene_json });
    expect(await getStatement(database, 'SELECT * FROM galleries WHERE id = ?', [draft.gallery_id])).toEqual(gallery);
    await expect(repository.discard({ ...discard, fingerprint: 'changed' })).rejects.toMatchObject({ code: 'REQUEST_ID_REUSED' });
    await expect(repository.discard({ ...discard, requestId: 'stale' })).rejects.toMatchObject({ code: 'DRAFT_CHANGED' });
  });

  it('rolls back a failed discard and lets only one competing discard/apply commit', async () => {
    await create();
    await repository.saveResult(operation());
    const candidate = await repository.saveResult(operation(1, { result: { scene: { items: [{ id: 'candidate' }] }, title: 'Candidate' } }));
    const discard = { ...operation(2, { requestId: 'discard', fingerprint: 'discard' }), validateResult: () => {} };
    await runStatement(database, `CREATE TRIGGER reject_discard BEFORE UPDATE ON quick_exhibition_drafts
      WHEN NEW.status = 'ready' BEGIN SELECT RAISE(ABORT, 'discard failure'); END`);
    await expect(repository.discard(discard)).rejects.toThrow('discard failure');
    expect(await repository.get('draft', 'owner')).toEqual(candidate);
    await runStatement(database, 'DROP TRIGGER reject_discard');
    const outcomes = await Promise.allSettled([
      repository.discard(discard),
      repository.saveResult(operation(2, { apply: true })),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.find((outcome) => outcome.status === 'rejected').reason.code).toBe('DRAFT_CHANGED');
    expect((await repository.get('draft', 'owner')).revision).toBe(3);
  });

  it('hands off only with a successful authorized scene save and rolls both writes back on failure', async () => {
    const draft = await create();
    const applied = await repository.saveResult(operation());
    const sceneJson = '{"items":[{"id":"manual"}]}';
    let saves = 0;
    const editorSave = (ownerId = 'owner') => repository.saveFromEditor({ galleryId: draft.gallery_id, ownerId,
      saveGallery: (connection) => {
        saves++;
        return updateGalleryById(draft.gallery_id, ownerId, { sceneJson }, connection);
      },
    });
    expect(await editorSave('other')).toBeNull();
    expect(saves).toBe(0);
    await runStatement(database, `CREATE TRIGGER reject_handoff BEFORE UPDATE ON quick_exhibition_drafts
      WHEN NEW.editor_managed_at IS NOT NULL BEGIN SELECT RAISE(ABORT, 'handoff failure'); END`);
    await expect(editorSave()).rejects.toThrow('handoff failure');
    expect(await repository.get('draft', 'owner')).toEqual(applied);
    await runStatement(database, 'DROP TRIGGER reject_handoff');
    expect((await editorSave()).scene_json).toBe(sceneJson);
    const expected = { code: 'DRAFT_EDITOR_MANAGED', status: 409, galleryId: draft.gallery_id };
    await expect(repository.get('draft', 'owner')).rejects.toMatchObject(expected);
    await expect(create()).rejects.toMatchObject(expected);
    await expect(repository.saveResult(operation(1))).rejects.toMatchObject(expected);
    await expect(repository.saveResult(operation(1, { apply: true }))).rejects.toMatchObject(expected);
    await expect(repository.discard({ ...operation(1), validateResult: () => {} })).rejects.toMatchObject(expected);
    await expect(repository.get('draft', 'other')).rejects.toMatchObject({ status: 404 });
    expect(await repository.publish({ galleryId: draft.gallery_id, ownerId: 'owner', validateResult: () => { throw new Error('manual gallery'); } })).toBeNull();
    expect((await getStatement(database, 'SELECT scene_json FROM galleries WHERE id = ?', [draft.gallery_id])).scene_json).toBe(sceneJson);
    expect(await getStatement(database, 'SELECT revision, result_json FROM quick_exhibition_drafts WHERE id = ?', ['draft']))
      .toEqual({ revision: applied.revision + 1, result_json: applied.result_json });
  }, 15_000);

  it('prevents an in-flight quick apply from overwriting an editor handoff', async () => {
    const draft = await create();
    await repository.saveResult(operation());
    await repository.saveResult(operation(1, { result: { scene: { items: [{ id: 'candidate' }] }, title: 'Candidate' } }));
    const sceneJson = '{"items":[{"id":"manual"}]}';
    const [manual, quick] = await Promise.allSettled([
      repository.saveFromEditor({ galleryId: draft.gallery_id, ownerId: 'owner',
        saveGallery: (connection) => updateGalleryById(draft.gallery_id, 'owner', { sceneJson }, connection),
      }),
      repository.saveResult(operation(2, { apply: true })),
    ]);
    expect(manual.status).toBe('fulfilled');
    if (quick.status === 'rejected') expect(quick.reason.code).toBe('DRAFT_EDITOR_MANAGED');
    expect((await getStatement(database, 'SELECT scene_json FROM galleries WHERE id = ?', [draft.gallery_id])).scene_json).toBe(sceneJson);
    await expect(repository.get('draft', 'owner')).rejects.toMatchObject({ code: 'DRAFT_EDITOR_MANAGED' });
  });

  it('rejects manual scene changes at commit without adopting their hash', async () => {
    const draft = await create();
    await repository.saveResult(operation());
    const candidate = await repository.saveResult(operation(1));
    await runStatement(database, 'UPDATE galleries SET scene_json = ? WHERE id = ?', ['{"items":[{"id":"manual"}]}', draft.gallery_id]);
    await expect(repository.saveResult(operation(2, { apply: true }))).rejects.toMatchObject({ code: 'SCENE_CHANGED' });
    await expect(repository.patch({ draftId: 'draft', ownerId: 'owner', expectedRevision: 2, input })).rejects.toMatchObject({ code: 'SCENE_CHANGED' });
    const current = await repository.get('draft', 'owner');
    expect(current.result).toEqual(candidate.result);
    expect(current.base_scene_hash).toBe(candidate.base_scene_hash);
  });

  it('rolls back a scene write when saving the draft fails', async () => {
    const draft = await create();
    await runStatement(database, `CREATE TRIGGER reject_result BEFORE UPDATE ON quick_exhibition_drafts BEGIN SELECT RAISE(ABORT, 'test failure'); END`);
    await expect(repository.saveResult(operation())).rejects.toThrow('test failure');
    expect((await getStatement(database, 'SELECT scene_json FROM galleries WHERE id = ?', [draft.gallery_id])).scene_json).toBeNull();
    expect((await repository.get('draft', 'owner')).revision).toBe(0);
  });

  it('rolls back media binding and legacy dimensions together with a failed patch', async () => {
    await create();
    await runStatement(database, `INSERT INTO media_assets
      (id, owner_id, storage_file_name, original_file_name, mime_type, size_bytes, created_at, updated_at)
      VALUES ('asset', 'owner', 'asset.png', 'Art.png', 'image/png', 100, 'now', 'now')`);
    await runStatement(database, `CREATE TRIGGER reject_patch BEFORE UPDATE ON quick_exhibition_drafts BEGIN SELECT RAISE(ABORT, 'test failure'); END`);
    await expect(repository.patch({ draftId: 'draft', ownerId: 'owner', expectedRevision: 0,
      input: { ...input, assets: [{ assetId: 'asset', fileName: 'Art.png', mimeType: 'image/png', width: 800, height: 400 }] },
    })).rejects.toThrow('test failure');
    expect(await getStatement(database, 'SELECT gallery_id, width, height FROM media_assets WHERE id = ?', ['asset']))
      .toEqual({ gallery_id: null, width: null, height: null });
    expect((await repository.get('draft', 'owner')).input.assets).toEqual([]);
  });

  it('cannot absorb an unrelated common-connection write into its rollback', async () => {
    await create();
    // While the isolated connection holds its write lock, the common connection
    // queues a real app write. It must run after rollback and remain committed.
    let announce;
    let release;
    const locked = new Promise((resolve) => { announce = resolve; });
    const proceed = new Promise((resolve) => { release = resolve; });
    const filename = path.join(directory, 'app.db');
    const isolated = createQuickExhibitionRepository({ filename, openDatabase: () => {
      const own = new sqlite3.Database(filename);
      const run = own.run.bind(own);
      own.run = (sql, params, callback) => {
        if (sql === 'BEGIN IMMEDIATE') {
          return run(sql, params, function (error) {
            announce();
            proceed.then(() => callback.call(this, error));
          });
        }
        return run(sql, params, callback);
      };
      return own;
    } });
    const writing = isolated.patch({ draftId: 'draft', ownerId: 'owner', expectedRevision: 99, input });
    const rejected = expect(writing).rejects.toMatchObject({ code: 'DRAFT_CHANGED' });
    await locked;
    const unrelated = runStatement(database, "UPDATE users SET name = 'Unrelated' WHERE id = 'owner'");
    release();
    await Promise.all([rejected, unrelated]);
    expect((await getStatement(database, "SELECT name FROM users WHERE id = 'owner'")).name).toBe('Unrelated');
  });

  it('publication is atomic, blocks stale input and public writes, and leaves manual galleries alone', async () => {
    const draft = await create();
    const publish = () => repository.publish({ galleryId: draft.gallery_id, ownerId: 'owner', validateResult: () => {} });
    await expect(publish()).rejects.toMatchObject({ code: 'DRAFT_NOT_READY' });
    await repository.saveResult(operation());
    await runStatement(database, `CREATE TRIGGER reject_publish BEFORE UPDATE ON quick_exhibition_drafts WHEN NEW.status = 'published' BEGIN SELECT RAISE(ABORT, 'test failure'); END`);
    await expect(publish()).rejects.toThrow('test failure');
    expect((await repository.get('draft', 'owner')).is_published).toBe(0);
    await runStatement(database, 'DROP TRIGGER reject_publish');
    expect((await publish()).is_published).toBe(1);
    expect((await repository.get('draft', 'owner')).status).toBe('published');
    await expect(repository.saveResult(operation(2))).rejects.toMatchObject({ code: 'EXHIBITION_PUBLISHED' });
    await expect(repository.patch({ draftId: 'draft', ownerId: 'owner', expectedRevision: 2, input })).rejects.toMatchObject({ code: 'EXHIBITION_PUBLISHED' });
    expect(await repository.publish({ galleryId: 'manual', ownerId: 'owner', validateResult: () => {} })).toBeNull();
    await runStatement(database, 'DELETE FROM galleries WHERE id = ?', [draft.gallery_id]);
    await expect(repository.get('draft', 'owner')).rejects.toMatchObject({ status: 404 });
  });
});
