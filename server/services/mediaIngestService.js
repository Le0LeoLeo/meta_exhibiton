import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { planImageMetadataSanitization } from './mediaMetadataService.js';
import { planSceneMedia } from './sceneMediaFormat.js';

export const DEFAULT_MEDIA_UPLOAD_MAX_BYTES = 15 * 1024 * 1024;
export const DEFAULT_MEDIA_UPLOAD_ROOT = path.resolve('server/uploads/media');

function uploadError(message, code, status) {
  return Object.assign(new Error(message), { code, status });
}

function decodeStrictBase64(value, maxBytes) {
  if (typeof value !== 'string'
    || value.length === 0
    || value.length % 4 !== 0
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw uploadError('dataBase64 must be canonical base64', 'INVALID_UPLOAD', 400);
  }

  const paddingBytes = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const decodedBytes = (value.length / 4) * 3 - paddingBytes;
  if (decodedBytes > maxBytes) {
    throw uploadError('media upload exceeds the size limit', 'UPLOAD_TOO_LARGE', 413);
  }

  const buffer = Buffer.from(value, 'base64');
  if (buffer.toString('base64') !== value) {
    throw uploadError('dataBase64 must be canonical base64', 'INVALID_UPLOAD', 400);
  }
  return buffer;
}

function safeOriginalFileName(value) {
  const baseName = path.posix.basename(String(value).replaceAll('\\', '/'));
  const cleaned = baseName.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return cleaned || 'upload.jpg';
}

export async function ingestMediaUpload(payload, options = {}) {
  const uploadRoot = path.resolve(options.uploadRoot ?? DEFAULT_MEDIA_UPLOAD_ROOT);
  const maxBytes = options.maxBytes ?? DEFAULT_MEDIA_UPLOAD_MAX_BYTES;
  const input = decodeStrictBase64(payload?.dataBase64, maxBytes);

  let plan;
  try {
    plan = options.allowSceneMedia && !String(payload?.mimeType).startsWith('image/')
      ? planSceneMedia(input, payload?.mimeType, payload?.fileName)
      : await planImageMetadataSanitization(input, payload?.mimeType, {
      maxPixels: options.maxPixels,
      maxDimension: options.maxDimension,
    });
  } catch {
    throw uploadError('unsupported media or MIME type mismatch; models must be self-contained GLB, glTF or STL', 'INVALID_UPLOAD', 400);
  }

  if (plan.buffer.length > maxBytes) {
    throw uploadError('sanitized media exceeds the size limit', 'UPLOAD_TOO_LARGE', 413);
  }

  const id = randomUUID();
  const fileName = `${id}${plan.extension}`;
  const finalPath = path.join(uploadRoot, fileName);
  const partialPath = path.join(uploadRoot, `.${id}.partial`);

  await mkdir(uploadRoot, { recursive: true });
  try {
    await writeFile(partialPath, plan.buffer, { flag: 'wx' });
    await rename(partialPath, finalPath);
  } catch (error) {
    await Promise.allSettled([
      rm(partialPath, { force: true }),
      rm(finalPath, { force: true }),
    ]);
    throw error;
  }

  return {
    id,
    fileName,
    originalFileName: safeOriginalFileName(payload?.fileName),
    mimeType: plan.mimeType,
    size: plan.buffer.length,
    width: plan.width,
    height: plan.height,
    metadataSanitized: plan.metadataSanitized ?? true,
    url: `/uploads/media/${fileName}`,
  };
}

// Call only after authorizing the stored asset. Dependencies use the same
// storage root and database as the caller; existing files are never rewritten.
export async function ensureMediaAssetDimensions(asset, { readMediaFile, updateMediaAssetDimensions }) {
  if (Number.isInteger(asset.width) && asset.width > 0
    && Number.isInteger(asset.height) && asset.height > 0) {
    return asset;
  }

  let plan;
  try {
    const bytes = await readMediaFile(asset.storage_file_name);
    plan = await planImageMetadataSanitization(bytes, asset.mime_type);
  } catch {
    throw uploadError('stored media dimensions could not be decoded', 'MEDIA_DIMENSIONS_UNAVAILABLE', 422);
  }
  const changed = await updateMediaAssetDimensions(asset.id, plan.width, plan.height);
  if (changed !== 1) {
    throw uploadError('media asset no longer exists', 'MEDIA_NOT_FOUND', 404);
  }
  return { ...asset, width: plan.width, height: plan.height };
}
