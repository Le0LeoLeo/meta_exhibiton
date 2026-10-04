// @vitest-environment node
import sqlite3 from 'sqlite3';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initDb } from '../db.js';
import { createQuickExhibitionRepository } from '../repositories/quickExhibitionRepository.js';
import { getStatement, runStatement } from '../repositories/sqliteHelpers.js';
import { buildAutomaticExhibition } from './automaticExhibitionLayout.js';
import { createQuickExhibitionService, quickPatchSchema } from './quickExhibitionService.js';

let directory;
let database;
let repository;
let service;
let draft;
const draftId = randomUUID();
const assetId = randomUUID();
const otherAssetId = randomUUID();
const asset = (id = assetId, order = 0) => ({ assetId: id, clientFileId: `client-${id}`, order });
const request = (expectedRevision) => ({ expectedRevision, requestId: randomUUID() });
const patch = (payload = {}, target = service) => target.patch(draftId, 'owner', { expectedRevision: 0, assets: [asset()], ...payload });
const build = (payload = request(1), target = service) => target.build(draftId, 'owner', payload);

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'quick-exhibition-service-'));
  const filename = path.join(directory, 'app.db');
  database = new sqlite3.Database(filename);
  await initDb(database);
  for (const id of ['owner', 'other']) {
    await runStatement(database, 'INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)', [id, `${id}@test.test`, id, 'hash', 'now']);
  }
  for (const id of [assetId, otherAssetId]) {
    await runStatement(database, `INSERT INTO media_assets
      (id, owner_id, storage_file_name, original_file_name, mime_type, size_bytes, width, height, created_at, updated_at)
      VALUES (?, 'owner', ?, 'Landscape.png', 'image/png', 100, 800, 400, 'now', 'now')`, [id, `${id}.png`]);
  }
  repository = createQuickExhibitionRepository({ filename });
  service = createQuickExhibitionService({ repository, signMediaPreviewToken: () => randomUUID() });
  draft = await service.create(draftId, 'owner', { language: 'en' });
});

afterEach(async () => {
  await new Promise((resolve, reject) => database.close((error) => error ? reject(error) : resolve()));
  await rm(directory, { recursive: true, force: true });
});

describe('quick exhibition service', () => {
  it('persists, restores with fresh previews, saves, applies and publishes the real automatic layout', async () => {
    expect(draft).toMatchObject({ draftId, revision: 0, status: 'collecting', result: null, limits: { maxAssets: 30, maxFileBytes: 15 * 1024 * 1024 } });
    const patched = await patch();
    expect(patched.input.assets[0]).toMatchObject({ assetId, width: 800, height: 400, fileName: 'Landscape.png', title: 'Landscape', artist: '', description: '', url: `/api/media/${assetId}` });
    const restored = await service.get(draftId, 'owner');
    expect(restored.input.assets[0].previewUrl).not.toBe(patched.input.assets[0].previewUrl);
    const first = await build();
    expect(first.status).toBe('ready');
    expect(first.result).toMatchObject({ layoutVersion: 2, includedAssetIds: [assetId], uploadedCount: 1, placedCount: 1 });
    expect(first.result.scene.items[0]).toMatchObject({ content: `/api/media/${assetId}`, assetUrl: `/api/media/${assetId}`, imageAspectRatio: 2 });
    const galleryBefore = await getStatement(database, 'SELECT scene_json FROM galleries WHERE id = ?', [draft.galleryId]);
    await patch({ expectedRevision: first.revision, title: 'Renamed', assets: [asset(), asset(otherAssetId, 1)] });
    await expect(service.publish(draft.galleryId, 'owner')).rejects.toMatchObject({ code: 'DRAFT_NOT_READY' });
    const candidate = await build(request(3));
    expect(candidate.status).toBe('candidate_ready');
    expect((await getStatement(database, 'SELECT scene_json FROM galleries WHERE id = ?', [draft.galleryId])).scene_json).toBe(galleryBefore.scene_json);
    await expect(service.publish(draft.galleryId, 'owner')).rejects.toMatchObject({ code: 'DRAFT_NOT_READY' });
    const applyRequest = request(candidate.revision);
    const applied = await service.apply(draftId, 'owner', applyRequest);
    expect(applied.status).toBe('ready');
    expect((await service.apply(draftId, 'owner', applyRequest)).revision).toBe(applied.revision);
    expect((await service.publish(draft.galleryId, 'owner')).is_published).toBe(1);
    const published = await service.get(draftId, 'owner');
    expect(published.status).toBe('published');
    expect(published.result.placedCount).toBe(2);
    await service.publish(draft.galleryId, 'owner');
    expect((await service.get(draftId, 'owner')).revision).toBe(published.revision);
    for (const call of [
      () => patch({ expectedRevision: published.revision }),
      () => build(request(published.revision)),
      () => service.apply(draftId, 'owner', request(published.revision)),
      () => service.discard(draftId, 'owner', request(published.revision)),
    ]) await expect(call()).rejects.toMatchObject({ code: 'EXHIBITION_PUBLISHED' });
    const persisted = await getStatement(database, 'SELECT input_json, result_json FROM quick_exhibition_drafts WHERE id = ?', [draftId]);
    expect(JSON.stringify(persisted)).not.toMatch(/accessToken|previewUrl|blob:/);
  }, 15_000);

  it('idempotent create keeps the original settings and saved result', async () => {
    await patch();
    const saved = await build();
    const again = await service.create(draftId, 'owner', { title: 'Overwrite attempt' });
    expect(again.galleryId).toBe(saved.galleryId);
    expect(again.input.title).toBe(saved.input.title);
    expect(again.revision).toBe(saved.revision);
  });

  it('rebuilds a legacy floating layout as a flush candidate and preserves the saved scene until apply', async () => {
    const legacyService = createQuickExhibitionService({ repository, build: (input) => {
      const result = buildAutomaticExhibition(input);
      result.layoutVersion = 1;
      result.scene.items[0].position[2] = -result.scene.roomSize.length / 2 + 0.35;
      return result;
    } });
    await patch({ assets: [{ ...asset(), title: 'Keep title', artist: 'Keep artist', description: 'Keep description' }] }, legacyService);
    const legacy = await build(request(1), legacyService);
    const originalScene = (await repository.get(draftId, 'owner')).scene_json;
    const candidate = await build(request(legacy.revision));
    expect(candidate).toMatchObject({ status: 'candidate_ready', result: { layoutVersion: 2 } });
    expect(candidate.input).toMatchObject(legacy.input);
    expect(candidate.result.scene.items[0].position[2]).toBeCloseTo(-candidate.result.scene.roomSize.length / 2 + 0.162);
    expect((await repository.get(draftId, 'owner')).scene_json).toBe(originalScene);
    const kept = await service.discard(draftId, 'owner', request(candidate.revision));
    expect(kept.result).toEqual(legacy.result);
    const rebuilt = await build(request(kept.revision));
    await service.apply(draftId, 'owner', request(rebuilt.revision));
    const restored = await service.get(draftId, 'owner');
    expect(restored).toMatchObject({ status: 'ready', input: legacy.input, result: { layoutVersion: 2 } });
    expect((await repository.get(draftId, 'owner')).scene_json).toBe(JSON.stringify(rebuilt.result.scene));
  });

  it('discards changed input to the last applied ready snapshot, retries safely, and publishes it', async () => {
    const builder = vi.fn((input) => ({ ...buildAutomaticExhibition(input), warnings: ['Saved layout warning'] }));
    const target = createQuickExhibitionService({ repository, build: builder });
    await patch({ assets: [{ ...asset(), title: 'Original artwork', artist: 'Known artist', description: 'Original description' }] }, target);
    await build(request(1), target);
    await patch({ expectedRevision: 2, title: 'Applied exhibition', assets: [{ ...asset(), title: 'Applied artwork', artist: 'Known artist' }] }, target);
    const toApply = await build(request(3), target);
    const applied = await target.apply(draftId, 'owner', request(toApply.revision));
    const appliedRow = await repository.get(draftId, 'owner');
    const gallery = await getStatement(database, 'SELECT * FROM galleries WHERE id = ?', [draft.galleryId]);
    await patch({ expectedRevision: applied.revision, title: 'Unwanted candidate', language: 'zh-TW',
      assets: [{ ...asset(otherAssetId, 7), clientFileId: 'different-client-file', title: 'New artwork' }] }, target);
    const candidate = await build(request(applied.revision + 1), target);
    const discardRequest = request(candidate.revision);
    const restored = await target.discard(draftId, 'owner', discardRequest);
    expect(restored).toEqual({ ...applied, revision: candidate.revision + 1, updatedAt: restored.updatedAt });
    expect(await target.discard(draftId, 'owner', discardRequest)).toEqual(restored);
    expect(builder).toHaveBeenCalledTimes(3);
    expect(await getStatement(database, 'SELECT * FROM galleries WHERE id = ?', [draft.galleryId])).toEqual(gallery);
    expect((await repository.get(draftId, 'owner')).base_scene_hash).toBe(appliedRow.base_scene_hash);
    await expect(target.discard(draftId, 'owner', { ...discardRequest, expectedRevision: restored.revision }))
      .rejects.toMatchObject({ code: 'REQUEST_ID_REUSED' });
    await expect(target.discard(draftId, 'owner', request(candidate.revision))).rejects.toMatchObject({ code: 'DRAFT_CHANGED' });
    expect((await target.publish(draft.galleryId, 'owner')).scene_json).toBe(JSON.stringify(applied.result.scene));
    expect((await target.get(draftId, 'owner')).status).toBe('published');
    const persisted = await repository.get(draftId, 'owner');
    expect(persisted.applied_input_json).toBe(appliedRow.input_json);
    expect(persisted.applied_result_json).toBe(appliedRow.result_json);
    expect(`${persisted.applied_input_json}${persisted.applied_result_json}`).not.toMatch(/accessToken|previewUrl|blob:/);
  }, 15_000);

  it('rejects stale discard retries after a newer input update', async () => {
    await patch();
    await build();
    await patch({ expectedRevision: 2, title: 'Candidate' });
    const candidate = await build(request(3));
    const payload = request(candidate.revision);
    const ready = await service.discard(draftId, 'owner', payload);
    await patch({ expectedRevision: ready.revision, title: 'Newer work' });
    await expect(service.discard(draftId, 'owner', payload)).rejects.toMatchObject({ code: 'DRAFT_CHANGED' });
    expect((await service.get(draftId, 'owner')).input.title).toBe('Newer work');
  }, 15_000);

  it('rejects discard without a candidate or a recoverable applied snapshot', async () => {
    await expect(service.discard(draftId, 'owner', request(0))).rejects.toMatchObject({ code: 'DRAFT_NOT_READY' });
    await patch();
    await build();
    await expect(service.discard(draftId, 'owner', request(2))).rejects.toMatchObject({ code: 'DRAFT_NOT_READY' });
    const candidate = await build(request(2));
    await runStatement(database, 'UPDATE quick_exhibition_drafts SET applied_input_json = NULL, applied_result_json = NULL WHERE id = ?', [draftId]);
    await expect(service.discard(draftId, 'owner', request(candidate.revision)))
      .rejects.toMatchObject({ code: 'APPLIED_SNAPSHOT_UNAVAILABLE', status: 409 });
    expect((await service.get(draftId, 'owner')).result).toEqual(candidate.result);
    expect((await service.get(draftId, 'owner')).revision).toBe(candidate.revision);
  }, 15_000);

  it('preserves the candidate when applied media is no longer authorized', async () => {
    await patch();
    await build();
    await patch({ expectedRevision: 2, assets: [asset(otherAssetId)] });
    const candidate = await build(request(3));
    await runStatement(database, "UPDATE media_assets SET owner_id = 'other' WHERE id = ?", [assetId]);
    await expect(service.discard(draftId, 'owner', request(candidate.revision))).rejects.toMatchObject({ code: 'ASSET_NOT_FOUND' });
    expect((await service.get(draftId, 'owner')).revision).toBe(candidate.revision);
    expect((await service.get(draftId, 'owner')).status).toBe('candidate_ready');
  }, 15_000);

  it('keeps user metadata when updating the asset order and permits explicitly clearing it', async () => {
    await patch({ assets: [{ ...asset(), title: 'Chosen title', artist: 'Known artist', description: 'User description' }] });
    const reordered = await patch({ expectedRevision: 1, assets: [asset(assetId, 3)] });
    expect(reordered.input.assets[0]).toMatchObject({ order: 3, title: 'Chosen title', artist: 'Known artist', description: 'User description' });
    const cleared = await patch({ expectedRevision: 2, assets: [{ ...asset(), title: '', artist: '', description: '' }] });
    expect(cleared.input.assets[0]).toMatchObject({ title: 'Landscape', artist: '', description: '' });
  });

  it('saves a filename fallback within the title limit when clearing artwork names and artists', async () => {
    await runStatement(database, 'UPDATE media_assets SET original_file_name = ? WHERE id = ?', [`${'a'.repeat(220)}.png`, assetId]);
    await patch({ assets: [{ ...asset(), title: 'Chosen title', artist: 'Known artist', description: 'Keep this introduction' }] });
    const original = await build();
    const cleared = await patch(quickPatchSchema.parse({ expectedRevision: original.revision, assets: [{ ...asset(), title: '  ', artist: '  ' }] }));
    expect(cleared.input.assets[0]).toMatchObject({ title: 'a'.repeat(200), artist: '', description: 'Keep this introduction' });
    const candidate = await build(request(cleared.revision));
    expect(candidate.result.scene.items.find((item) => item.assetId === assetId)).toMatchObject({ title: 'a'.repeat(200), artist: '', description: 'Keep this introduction' });
    await service.apply(draftId, 'owner', request(candidate.revision));
    const restored = await service.get(draftId, 'owner');
    expect(restored.status).toBe('ready');
    expect(restored.input.assets[0]).toMatchObject({ title: 'a'.repeat(200), artist: '', description: 'Keep this introduction' });
  });

  it('safe retries do not rebuild and changed request fingerprints cannot replay', async () => {
    await patch();
    const builder = vi.fn(buildAutomaticExhibition);
    const target = createQuickExhibitionService({ repository, build: builder });
    const payload = request(1);
    const saved = await build(payload, target);
    expect(await build(payload, target)).toEqual(saved);
    expect(builder).toHaveBeenCalledTimes(1);
    await expect(build({ ...payload, expectedRevision: 2 }, target)).rejects.toMatchObject({ code: 'REQUEST_ID_REUSED' });
    await expect(target.apply(draftId, 'owner', payload)).rejects.toMatchObject({ code: 'REQUEST_ID_REUSED' });
    await patch({ expectedRevision: 2, title: 'New input' });
    await expect(build(payload, target)).rejects.toMatchObject({ code: 'REQUEST_ID_REUSED' });
    await expect(build(request(1), target)).rejects.toMatchObject({ code: 'DRAFT_CHANGED' });
  });

  it.each(['get', 'build', 'apply', 'discard', 'patch', 'create'])('hides draft ownership for %s', async (method) => {
    await expect(service[method](draftId, 'other', { ...request(0), assets: [asset()] })).rejects.toMatchObject({ status: 404 });
  });

  it.each([
    ['missing', "DELETE FROM media_assets WHERE id = ?"],
    ['foreign owner', "UPDATE media_assets SET owner_id = 'other' WHERE id = ?"],
    ['avatar usage', "UPDATE media_assets SET usage = 'avatar' WHERE id = ?"],
  ])('rejects %s media without binding earlier valid entries', async (_label, sql) => {
    await runStatement(database, sql, [otherAssetId]);
    await expect(patch({ assets: [asset(), asset(otherAssetId, 1)] })).rejects.toMatchObject({ code: 'ASSET_NOT_FOUND', status: 404 });
    expect((await getStatement(database, 'SELECT gallery_id FROM media_assets WHERE id = ?', [assetId])).gallery_id).toBeNull();
    expect((await service.get(draftId, 'owner')).revision).toBe(0);
  });

  it('rejects assets bound to another gallery, including another gallery of the same owner', async () => {
    const other = await service.create(randomUUID(), 'owner', {});
    await runStatement(database, 'UPDATE media_assets SET gallery_id = ? WHERE id = ?', [other.galleryId, assetId]);
    await expect(patch()).rejects.toMatchObject({ status: 404 });
  });

  it('rejects duplicates, empty builds, and invalid dimensions without creating scenes', async () => {
    await expect(patch({ assets: [asset(), { ...asset(), clientFileId: 'duplicate' }] })).rejects.toMatchObject({ code: 'ASSET_COVERAGE_MISMATCH' });
    await expect(build(request(0))).rejects.toMatchObject({ code: 'EMPTY_EXHIBITION', status: 422 });
    expect((await service.get(draftId, 'owner')).status).toBe('failed');
    await runStatement(database, 'UPDATE media_assets SET width = 0 WHERE id = ?', [assetId]);
    await expect(patch({ expectedRevision: 1 })).rejects.toMatchObject({ code: 'ASSET_DIMENSIONS_UNAVAILABLE' });
    expect((await getStatement(database, 'SELECT scene_json FROM galleries WHERE id = ?', [draft.galleryId])).scene_json).toBeNull();
  });

  it('reads legacy dimensions only from the trusted stored file, persists them, and reports decode failures', async () => {
    await runStatement(database, 'UPDATE media_assets SET width = NULL, height = NULL');
    const bytes = await sharp({ create: { width: 64, height: 32, channels: 3, background: '#ffffff' } }).png().toBuffer();
    const readFile = vi.fn().mockResolvedValue(bytes);
    const target = createQuickExhibitionService({ repository, readFile });
    const saved = await patch({}, target);
    expect(readFile).toHaveBeenCalledWith(`${assetId}.png`);
    expect(saved.input.assets[0]).toMatchObject({ width: 64, height: 32 });
    expect(await getStatement(database, 'SELECT width, height FROM media_assets WHERE id = ?', [assetId])).toEqual({ width: 64, height: 32 });
    await build(request(1), target);
    expect(readFile).toHaveBeenCalledTimes(1);
    readFile.mockRejectedValue(new Error('missing file'));
    await expect(patch({ expectedRevision: 2, assets: [asset(otherAssetId)] }, target)).rejects.toMatchObject({ code: 'ASSET_DIMENSIONS_UNAVAILABLE', status: 422 });
    readFile.mockResolvedValue(Buffer.from('not an image'));
    await expect(patch({ expectedRevision: 2, assets: [asset(otherAssetId)] }, target)).rejects.toMatchObject({ code: 'ASSET_DIMENSIONS_UNAVAILABLE' });
  });

  it.each(['substitute', 'duplicate', 'wrong source', 'wrong artist', 'count', 'ratio', 'schema', 'overlap', 'token'])(
    'rejects a %s result and preserves the formal gallery', async (mutation) => {
      await patch({ assets: [asset(), asset(otherAssetId, 1)] });
      const target = createQuickExhibitionService({ repository, build: (input) => {
        const result = buildAutomaticExhibition(input);
        if (mutation === 'substitute') result.scene.items[0].assetId = randomUUID();
        if (mutation === 'duplicate') result.scene.items[1] = result.scene.items[0];
        if (mutation === 'wrong source') result.scene.items[0].content = 'https://example.com/substitute.png';
        if (mutation === 'wrong artist') result.scene.items[0].artist = 'Invented artist';
        if (mutation === 'count') result.placedCount = 1;
        if (mutation === 'ratio') result.scene.items[0].imageAspectRatio = 99;
        if (mutation === 'schema') result.scene.items[0].position = [0];
        if (mutation === 'overlap') result.scene.items[1].position = [...result.scene.items[0].position];
        if (mutation === 'token') result.scene.items[0].thumbnailUrl = `/api/media/${assetId}?accessToken=secret`;
        return result;
      } });
      await expect(build(request(1), target)).rejects.toMatchObject({ status: 422 });
      expect((await service.get(draftId, 'owner')).status).toBe('failed');
      expect((await getStatement(database, 'SELECT scene_json FROM galleries WHERE id = ?', [draft.galleryId])).scene_json).toBeNull();
    },
  );

  it('rejects a build whose input changed while layout was running', async () => {
    await patch();
    const target = createQuickExhibitionService({ repository, build: async (input) => {
      await patch({ expectedRevision: 1, title: 'Newer selection' });
      return buildAutomaticExhibition(input);
    } });
    await expect(build(request(1), target)).rejects.toMatchObject({ code: 'DRAFT_CHANGED' });
    expect((await service.get(draftId, 'owner')).input.title).toBe('Newer selection');
  });

  it('rechecks asset permissions inside the save transaction', async () => {
    await patch();
    const target = createQuickExhibitionService({ repository, build: async (input) => {
      await runStatement(database, "UPDATE media_assets SET usage = 'avatar' WHERE id = ?", [assetId]);
      return buildAutomaticExhibition(input);
    } });
    await expect(build(request(1), target)).rejects.toMatchObject({ code: 'ASSET_NOT_FOUND' });
    expect((await repository.get(draftId, 'owner')).revision).toBe(1);
  });

  it('blocks apply and publication after a manual edit without overwriting the candidate', async () => {
    await patch();
    await build();
    const candidate = await build(request(2));
    await runStatement(database, 'UPDATE galleries SET scene_json = ? WHERE id = ?', ['{"items":[]}', draft.galleryId]);
    await expect(service.apply(draftId, 'owner', request(3))).rejects.toMatchObject({ code: 'SCENE_CHANGED' });
    await expect(service.discard(draftId, 'owner', request(3))).rejects.toMatchObject({ code: 'SCENE_CHANGED' });
    expect((await service.get(draftId, 'owner')).result).toEqual(candidate.result);
    await expect(service.publish(draft.galleryId, 'owner')).rejects.toMatchObject({ code: 'DRAFT_NOT_READY' });
  });

  it('revalidates the saved scene and assets at publish time', async () => {
    await patch();
    await build();
    await runStatement(database, 'UPDATE galleries SET scene_json = ? WHERE id = ?', ['{"items":[]}', draft.galleryId]);
    await expect(service.publish(draft.galleryId, 'owner')).rejects.toMatchObject({ code: 'SCENE_CHANGED' });
    const row = await repository.get(draftId, 'owner');
    await runStatement(database, 'UPDATE galleries SET scene_json = ? WHERE id = ?', [JSON.stringify(row.result.scene), draft.galleryId]);
    await runStatement(database, 'DELETE FROM media_assets WHERE id = ?', [assetId]);
    await expect(service.publish(draft.galleryId, 'owner')).rejects.toMatchObject({ code: 'ASSET_NOT_FOUND' });
    expect((await repository.get(draftId, 'owner')).is_published).toBe(0);
  });
});

it.each(['warm-gallery','dark-gallery'])('persists and builds the selected %s template without changing asset coverage', async style => {
 const updated=await patch({style}); expect(updated.input.style).toBe(style);
 const result=await build(); expect(result.input.style).toBe(style); expect(result.result.placedCount).toBe(1);
 expect(result.result.scene.roomSize.wallColor).toBe(style === 'warm-gallery' ? '#e9dccb' : '#253039');
 expect((await service.get(draftId,'owner')).input.style).toBe(style);
});
