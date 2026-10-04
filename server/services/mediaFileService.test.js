import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { deleteMediaFile, readMediaFile } from './mediaFileService.js';

const roots = [];

afterEach(async () => {
  const { rm } = await import('node:fs/promises');
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('media file access', () => {
  it('reads and deletes only canonical generated filenames inside the upload root', async () => {
    const root = path.resolve(`server/uploads-test-${Date.now()}`);
    roots.push(root);
    await mkdir(root, { recursive: true });
    const name = '11111111-1111-4111-8111-111111111111.jpg';
    await writeFile(path.join(root, name), Buffer.from('safe'));

    await expect(readMediaFile(name, { uploadRoot: root })).resolves.toEqual(Buffer.from('safe'));
    await expect(deleteMediaFile(name, { uploadRoot: root })).resolves.toBeUndefined();
    await expect(readMediaFile(name, { uploadRoot: root })).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it.each(['../secret.jpg', 'not-a-uuid.jpg', '11111111-1111-4111-8111-111111111111.svg'])('rejects unsafe storage name %s', async (name) => {
    expect(() => readMediaFile(name)).toThrow(expect.objectContaining({ code: 'INVALID_MEDIA_PATH' }));
  });
});
