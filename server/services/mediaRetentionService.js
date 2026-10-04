import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_MEDIA_UPLOAD_ROOT } from './mediaIngestService.js';

export const DEFAULT_UNBOUND_RETENTION_DAYS = 30;
export const MIN_UNBOUND_RETENTION_DAYS = 1;
export const MAX_UNBOUND_RETENTION_DAYS = 3650;

const STORED_MEDIA_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpe?g|png|webp|mp4|webm|ogg|glb|gltf|stl)$/i;

export function parseMediaRetentionDays(value) {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_UNBOUND_RETENTION_DAYS;
  }
  const days = Number(value);
  if (!Number.isInteger(days)
    || days < MIN_UNBOUND_RETENTION_DAYS
    || days > MAX_UNBOUND_RETENTION_DAYS) {
    throw new RangeError(
      `MEDIA_UNBOUND_RETENTION_DAYS must be an integer from ${MIN_UNBOUND_RETENTION_DAYS} to ${MAX_UNBOUND_RETENTION_DAYS}`,
    );
  }
  return days;
}

function rowValue(row, snakeCase, camelCase) {
  return row?.[snakeCase] ?? row?.[camelCase];
}

function resolveContainedMediaFile(uploadRoot, fileName) {
  const root = path.resolve(uploadRoot);
  if (!STORED_MEDIA_FILE.test(fileName) || path.basename(fileName) !== fileName) {
    throw Object.assign(new Error('invalid stored media filename'), { code: 'INVALID_MEDIA_PATH' });
  }
  const resolved = path.resolve(root, fileName);
  if (path.dirname(resolved) !== root) {
    throw Object.assign(new Error('media path escapes upload root'), { code: 'INVALID_MEDIA_PATH' });
  }
  return resolved;
}

async function listStoredMediaFiles(uploadRoot) {
  try {
    const entries = await readdir(uploadRoot, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && STORED_MEDIA_FILE.test(entry.name))
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

export async function inspectMediaRetention(options = {}) {
  const uploadRoot = path.resolve(options.uploadRoot ?? DEFAULT_MEDIA_UPLOAD_ROOT);
  const mediaAssets = Array.isArray(options.mediaAssets) ? options.mediaAssets : [];
  const retentionDays = parseMediaRetentionDays(options.retentionDays);
  const now = options.now instanceof Date ? options.now : new Date(options.now ?? Date.now());
  if (Number.isNaN(now.getTime())) throw new TypeError('now must be a valid date');

  const diskFiles = await listStoredMediaFiles(uploadRoot);
  const storedNames = new Set(
    mediaAssets
      .map((row) => String(rowValue(row, 'storage_file_name', 'storageFileName') ?? ''))
      .filter((name) => STORED_MEDIA_FILE.test(name)),
  );
  const diskFileSet = new Set(diskFiles);
  const cutoffMs = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;

  const orphanFiles = diskFiles.filter((name) => !storedNames.has(name));
  const missingRows = mediaAssets
    .filter((row) => {
      const name = String(rowValue(row, 'storage_file_name', 'storageFileName') ?? '');
      return !diskFileSet.has(name);
    })
    .map((row) => ({
      id: row.id,
      storageFileName: String(rowValue(row, 'storage_file_name', 'storageFileName') ?? ''),
    }));
  const staleUnboundRows = mediaAssets
    .filter((row) => {
      if (rowValue(row, 'library_retained', 'libraryRetained')) return false;
      const galleryId = rowValue(row, 'gallery_id', 'galleryId');
      if (galleryId !== null && galleryId !== undefined && galleryId !== '') return false;
      const timestamp = new Date(
        rowValue(row, 'updated_at', 'updatedAt')
          ?? rowValue(row, 'created_at', 'createdAt'),
      ).getTime();
      return Number.isFinite(timestamp) && timestamp < cutoffMs;
    })
    .map((row) => ({
      id: row.id,
      storageFileName: String(rowValue(row, 'storage_file_name', 'storageFileName') ?? ''),
    }));

  return { uploadRoot, retentionDays, orphanFiles, missingRows, staleUnboundRows };
}

export async function cleanMediaRetention(options = {}) {
  const report = await inspectMediaRetention(options);
  const apply = options.apply === true;
  if (!apply) return {
    ...report, applied: false, deletedOrphanFiles: 0, deletedStaleRows: 0, deletedStaleFiles: 0,
  };

  if (report.staleUnboundRows.length > 0 && typeof options.deleteStaleRows !== 'function') {
    throw new TypeError('deleteStaleRows callback is required when applying stale-row cleanup');
  }

  for (const fileName of report.orphanFiles) {
    await rm(resolveContainedMediaFile(report.uploadRoot, fileName), { force: true });
  }

  let deletedStaleRows = 0;
  if (report.staleUnboundRows.length > 0) {
    deletedStaleRows = Number(await options.deleteStaleRows(report.staleUnboundRows)) || 0;
    if (deletedStaleRows !== report.staleUnboundRows.length) {
      throw new Error('stale media row cleanup was not atomic');
    }
    for (const row of report.staleUnboundRows) {
      await rm(resolveContainedMediaFile(report.uploadRoot, row.storageFileName), { force: true });
    }
  }

  return {
    ...report,
    applied: true,
    deletedOrphanFiles: report.orphanFiles.length,
    deletedStaleRows,
    deletedStaleFiles: report.staleUnboundRows.length,
  };
}
