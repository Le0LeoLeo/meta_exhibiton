import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_MEDIA_UPLOAD_ROOT } from './mediaIngestService.js';

function resolveStoredMediaPath(storageFileName, uploadRoot = DEFAULT_MEDIA_UPLOAD_ROOT) {
  const name = String(storageFileName || '');
  if (!/^[a-f0-9-]{36}\.(?:jpe?g|png|webp|mp4|webm|ogg|glb|gltf|stl)$/i.test(name) || path.basename(name) !== name) {
    throw Object.assign(new Error('invalid stored media filename'), { code: 'INVALID_MEDIA_PATH' });
  }
  const root = path.resolve(uploadRoot);
  const resolved = path.resolve(root, name);
  if (path.dirname(resolved) !== root) {
    throw Object.assign(new Error('invalid stored media filename'), { code: 'INVALID_MEDIA_PATH' });
  }
  return resolved;
}

export function readMediaFile(storageFileName, options = {}) {
  return readFile(resolveStoredMediaPath(storageFileName, options.uploadRoot));
}

export function deleteMediaFile(storageFileName, options = {}) {
  return rm(resolveStoredMediaPath(storageFileName, options.uploadRoot), { force: true });
}

export function deleteMediaFiles(storageFileNames, options = {}) {
  return Promise.all((storageFileNames || []).map((name) => deleteMediaFile(name, options)));
}
