import sqlite3 from 'sqlite3';
import { createHash, randomUUID } from 'node:crypto';
import { getStatement, runStatement } from './sqliteHelpers.js';

export const QUICK_EXHIBITION_SCHEMA = `
  CREATE TABLE IF NOT EXISTS quick_exhibition_drafts (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gallery_id TEXT NOT NULL UNIQUE REFERENCES galleries(id) ON DELETE CASCADE,
    revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0),
    input_json TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('collecting', 'ready', 'candidate_ready', 'failed', 'published')),
    base_scene_hash TEXT NOT NULL,
    result_json TEXT,
    last_request_id TEXT,
    last_request_fingerprint TEXT,
    error_code TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    applied_input_json TEXT,
    applied_result_json TEXT,
    editor_managed_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_quick_exhibition_drafts_owner_id ON quick_exhibition_drafts(owner_id);
`;

export function quickExhibitionError(code, status = 409) {
  return Object.assign(new Error(code), { code, status });
}

export function hashScene(sceneJson) {
  return createHash('sha256').update(sceneJson ?? 'null').digest('hex');
}

const selectDraft = `SELECT d.*, g.scene_json, g.is_published
  FROM quick_exhibition_drafts d JOIN galleries g ON g.id = d.gallery_id AND g.owner_id = d.owner_id`;

function hydrate(row) {
  return row ? { ...row, input: JSON.parse(row.input_json), result: row.result_json ? JSON.parse(row.result_json) : null } : null;
}

async function load(database, draftId, ownerId) {
  const row = hydrate(await getStatement(database, `${selectDraft} WHERE d.id = ?`, [draftId]));
  if (!row || row.owner_id !== ownerId) throw quickExhibitionError('DRAFT_NOT_FOUND', 404);
  if (row.editor_managed_at) {
    throw Object.assign(quickExhibitionError('DRAFT_EDITOR_MANAGED'), { galleryId: row.gallery_id });
  }
  return row;
}

export function assertQuickDraftWritable(row, expectedRevision) {
  if (row.is_published || row.status === 'published') throw quickExhibitionError('EXHIBITION_PUBLISHED');
  if (expectedRevision !== undefined && row.revision !== expectedRevision) throw quickExhibitionError('DRAFT_CHANGED');
  if (hashScene(row.scene_json) !== row.base_scene_hash) throw quickExhibitionError('SCENE_CHANGED');
}

export function isQuickRequestReplay(row, { requestId, fingerprint, expectedRevision }) {
  if (row.last_request_id !== requestId) return false;
  if (row.last_request_fingerprint !== fingerprint) throw quickExhibitionError('REQUEST_ID_REUSED');
  if (row.revision !== expectedRevision + 1) throw quickExhibitionError('DRAFT_CHANGED');
  return true;
}

// Every operation owns its connection, including every await between BEGIN and COMMIT.
// A shared application's connection must never be injected here.
export function createQuickExhibitionRepository({ filename, openDatabase = () => new sqlite3.Database(filename) }) {
  async function connection(operation, write = false) {
    const database = await openDatabase();
    let began = false;
    try {
      await runStatement(database, 'PRAGMA foreign_keys = ON');
      await runStatement(database, 'PRAGMA busy_timeout = 5000');
      if (write) {
        await runStatement(database, 'BEGIN IMMEDIATE');
        began = true;
      }
      const result = await operation(database);
      if (began) await runStatement(database, 'COMMIT');
      return result;
    } catch (error) {
      if (began) await runStatement(database, 'ROLLBACK').catch(() => {});
      throw error;
    } finally {
      await new Promise((resolve, reject) => database.close((error) => error ? reject(error) : resolve()));
    }
  }

  async function checkAssets(database, row, input, bind = false) {
    for (const asset of input.assets) {
      const media = await getStatement(database, 'SELECT * FROM media_assets WHERE id = ?', [asset.assetId]);
      if (!media || media.owner_id !== row.owner_id || media.usage !== 'gallery'
        || (bind ? media.gallery_id && media.gallery_id !== row.gallery_id : media.gallery_id !== row.gallery_id)) {
        throw quickExhibitionError('ASSET_NOT_FOUND', 404);
      }
      if (media.original_file_name !== asset.fileName || media.mime_type !== asset.mimeType
        || (media.width != null && media.width !== asset.width)
        || (media.height != null && media.height !== asset.height)) {
        throw quickExhibitionError('DRAFT_CHANGED');
      }
      if (bind) {
        await runStatement(database, `UPDATE media_assets SET gallery_id = ?, width = ?, height = ?, updated_at = ? WHERE id = ?`,
          [row.gallery_id, asset.width, asset.height, new Date().toISOString(), asset.assetId]);
      } else if (!media.width || !media.height) {
        throw quickExhibitionError('ASSET_DIMENSIONS_UNAVAILABLE', 422);
      }
    }
  }

  async function saveGalleryScene(database, row, result) {
    const sceneJson = JSON.stringify(result.scene);
    await runStatement(database, `UPDATE galleries SET scene_json = ?, title = ?, updated_at = ? WHERE id = ? AND owner_id = ?`,
      [sceneJson, result.title, new Date().toISOString(), row.gallery_id, row.owner_id]);
    return hashScene(sceneJson);
  }

  return {
    get: (draftId, ownerId) => connection((database) => load(database, draftId, ownerId)),
    getMediaAsset: (assetId) => connection((database) => getStatement(database, 'SELECT * FROM media_assets WHERE id = ?', [assetId])),

    create: ({ draftId, ownerId, input }) => connection(async (database) => {
      const existing = await getStatement(database, 'SELECT id FROM quick_exhibition_drafts WHERE id = ?', [draftId]);
      if (existing) return load(database, draftId, ownerId);
      const galleryId = randomUUID();
      const now = new Date().toISOString();
      await runStatement(database, `INSERT INTO galleries
        (id, owner_id, title, description, template_title, template_image, category, created_at, updated_at)
        VALUES (?, ?, ?, '', 'White box', '', 'art', ?, ?)`, [galleryId, ownerId, input.title, now, now]);
      await runStatement(database, `INSERT INTO quick_exhibition_drafts
        (id, owner_id, gallery_id, input_json, status, base_scene_hash, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'collecting', ?, ?, ?)`, [draftId, ownerId, galleryId, JSON.stringify(input), hashScene(null), now, now]);
      return load(database, draftId, ownerId);
    }, true),

    patch: ({ draftId, ownerId, expectedRevision, input }) => connection(async (database) => {
      const row = await load(database, draftId, ownerId);
      assertQuickDraftWritable(row, expectedRevision);
      await checkAssets(database, row, input, true);
      const inputJson = JSON.stringify(input);
      if (inputJson === row.input_json) return row;
      await runStatement(database, `UPDATE quick_exhibition_drafts SET input_json = ?, result_json = NULL,
        status = 'collecting', error_code = NULL, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?`,
      [inputJson, new Date().toISOString(), draftId, expectedRevision]);
      return load(database, draftId, ownerId);
    }, true),

    saveResult: ({ draftId, ownerId, expectedRevision, requestId, fingerprint, result, apply = false }) => connection(async (database) => {
      const row = await load(database, draftId, ownerId);
      assertQuickDraftWritable(row);
      if (isQuickRequestReplay(row, { expectedRevision, requestId, fingerprint })) return row;
      assertQuickDraftWritable(row, expectedRevision);
      if (apply && (row.status !== 'candidate_ready' || !row.result)) throw quickExhibitionError('DRAFT_NOT_READY');
      const savedResult = apply ? row.result : result;
      await checkAssets(database, row, row.input);
      const autoSave = row.scene_json == null;
      const baseHash = apply || autoSave ? await saveGalleryScene(database, row, savedResult) : row.base_scene_hash;
      await runStatement(database, `UPDATE quick_exhibition_drafts SET result_json = ?, status = ?, base_scene_hash = ?,
        applied_input_json = ?, applied_result_json = ?,
        last_request_id = ?, last_request_fingerprint = ?, error_code = NULL, revision = revision + 1, updated_at = ?
        WHERE id = ? AND revision = ?`, [JSON.stringify(savedResult), apply || autoSave ? 'ready' : 'candidate_ready',
        baseHash, apply || autoSave ? row.input_json : row.applied_input_json,
        apply || autoSave ? JSON.stringify(savedResult) : row.applied_result_json,
        requestId, fingerprint, new Date().toISOString(), draftId, expectedRevision]);
      return load(database, draftId, ownerId);
    }, true),

    discard: ({ draftId, ownerId, expectedRevision, requestId, fingerprint, validateResult }) => connection(async (database) => {
      const row = await load(database, draftId, ownerId);
      assertQuickDraftWritable(row);
      if (isQuickRequestReplay(row, { expectedRevision, requestId, fingerprint })) return row;
      assertQuickDraftWritable(row, expectedRevision);
      if (row.status !== 'candidate_ready' || !row.result) throw quickExhibitionError('DRAFT_NOT_READY');
      if (!row.applied_input_json || !row.applied_result_json) throw quickExhibitionError('APPLIED_SNAPSHOT_UNAVAILABLE');
      const appliedInput = JSON.parse(row.applied_input_json);
      const appliedResult = JSON.parse(row.applied_result_json);
      if (hashScene(JSON.stringify(appliedResult.scene)) !== row.base_scene_hash) {
        throw quickExhibitionError('APPLIED_SNAPSHOT_UNAVAILABLE');
      }
      validateResult(appliedInput, appliedResult);
      await checkAssets(database, row, appliedInput);
      // The gallery already contains this scene. Restore only the draft snapshots;
      // neither its scene, title, timestamp nor the last applied hash is rewritten.
      await runStatement(database, `UPDATE quick_exhibition_drafts SET input_json = applied_input_json,
        result_json = applied_result_json, status = 'ready', error_code = NULL,
        last_request_id = ?, last_request_fingerprint = ?, revision = revision + 1, updated_at = ?
        WHERE id = ? AND revision = ?`, [requestId, fingerprint, new Date().toISOString(), draftId, expectedRevision]);
      return load(database, draftId, ownerId);
    }, true),

    saveFromEditor: ({ galleryId, ownerId, saveGallery }) => connection(async (database) => {
      const row = await getStatement(database, `${selectDraft} WHERE d.gallery_id = ? AND d.owner_id = ?`, [galleryId, ownerId]);
      if (!row || row.editor_managed_at) return null;
      if (!await saveGallery(database)) throw quickExhibitionError('GALLERY_NOT_FOUND', 404);
      await runStatement(database, `UPDATE quick_exhibition_drafts SET editor_managed_at = ?,
        revision = revision + 1, updated_at = ? WHERE id = ?`, [new Date().toISOString(), new Date().toISOString(), row.id]);
      return getStatement(database, 'SELECT * FROM galleries WHERE id = ?', [galleryId]);
    }, true),

    fail: ({ draftId, ownerId, expectedRevision, code }) => connection(async (database) => {
      const row = await load(database, draftId, ownerId);
      assertQuickDraftWritable(row, expectedRevision);
      await runStatement(database, `UPDATE quick_exhibition_drafts SET status = 'failed', result_json = NULL,
        error_code = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?`,
      [code, new Date().toISOString(), draftId, expectedRevision]);
    }, true),

    publish: ({ galleryId, ownerId, validateResult }) => connection(async (database) => {
      const row = hydrate(await getStatement(database, `${selectDraft} WHERE d.gallery_id = ?`, [galleryId]));
      if (!row) return null; // Existing manual galleries retain their publication path.
      if (row.owner_id !== ownerId) throw quickExhibitionError('DRAFT_NOT_FOUND', 404);
      if (row.editor_managed_at) return null;
      if (!['ready', 'published'].includes(row.status) || !row.result) throw quickExhibitionError('DRAFT_NOT_READY');
      if (hashScene(row.scene_json) !== row.base_scene_hash) throw quickExhibitionError('SCENE_CHANGED');
      if (hashScene(JSON.stringify(row.result.scene)) !== row.base_scene_hash) throw quickExhibitionError('DRAFT_NOT_READY');
      validateResult(row.input, row.result);
      await checkAssets(database, row, row.input);
      const now = new Date().toISOString();
      await runStatement(database, `UPDATE galleries SET is_published = 1, published_at = COALESCE(published_at, ?),
        updated_at = ? WHERE id = ? AND owner_id = ?`, [now, now, galleryId, ownerId]);
      if (row.status !== 'published') {
        await runStatement(database, `UPDATE quick_exhibition_drafts SET status = 'published', revision = revision + 1,
          updated_at = ? WHERE id = ?`, [now, row.id]);
      }
      return getStatement(database, 'SELECT * FROM galleries WHERE id = ?', [galleryId]);
    }, true),
  };
}
