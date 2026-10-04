import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanMediaRetention, inspectMediaRetention, parseMediaRetentionDays } from './mediaRetentionService.js';

const roots = [];
const present = '11111111-1111-4111-8111-111111111111.jpg';
const orphan = '22222222-2222-4222-8222-222222222222.png';
const missing = '33333333-3333-4333-8333-333333333333.webp';

async function tempRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'media-retention-'));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('parseMediaRetentionDays', () => {
  it('defaults to 30 days and accepts the documented bounds', () => {
    expect(parseMediaRetentionDays()).toBe(30);
    expect(parseMediaRetentionDays('1')).toBe(1);
    expect(parseMediaRetentionDays('3650')).toBe(3650);
  });

  it.each(['0', '3651', '1.5', 'invalid'])('rejects an invalid retention value: %s', (value) => {
    expect(() => parseMediaRetentionDays(value)).toThrow(RangeError);
  });
});

describe('media retention inspection', () => {
  it('recognizes saved video and model files as present media', async () => {
    const root = await tempRoot();
    const names = ['glb', 'gltf', 'stl', 'mp4', 'webm', 'ogg'].map(extension => `11111111-1111-4111-8111-111111111111.${extension}`);
    await Promise.all(names.map(name => writeFile(path.join(root, name), 'synthetic')));
    const result = await inspectMediaRetention({ uploadRoot: root, mediaAssets: names.map((name, index) => ({ id: String(index), storage_file_name: name, gallery_id: 'gallery-1' })) });
    expect(result.missingRows).toEqual([]); expect(result.orphanFiles).toEqual([]);
  });
  it('reports orphans, missing rows, and old unbound rows without touching files', async () => {
    const root = await tempRoot();
    await writeFile(path.join(root, present), 'present');
    await writeFile(path.join(root, orphan), 'orphan');
    await writeFile(path.join(root, 'notes.txt'), 'leave me');
    const rows = [
      { id: 'present', storage_file_name: present, gallery_id: 'gallery-1', updated_at: '2026-06-01T00:00:00Z' },
      { id: 'missing', storage_file_name: missing, gallery_id: null, updated_at: '2026-05-01T00:00:00Z' },
    ];

    const result = await inspectMediaRetention({
      uploadRoot: root,
      mediaAssets: rows,
      retentionDays: 30,
      now: new Date('2026-07-15T00:00:00Z'),
    });

    expect(result.orphanFiles).toEqual([orphan]);
    expect(result.missingRows).toEqual([{ id: 'missing', storageFileName: missing }]);
    expect(result.staleUnboundRows).toEqual([{ id: 'missing', storageFileName: missing }]);
    expect(await readFile(path.join(root, orphan), 'utf8')).toBe('orphan');
  });

  it('ignores unrelated and non-canonical filenames on disk', async () => {
    const root = await tempRoot();
    await writeFile(path.join(root, 'not-a-uuid.jpg'), 'untouched');
    await writeFile(path.join(root, '.partial'), 'untouched');

    const result = await inspectMediaRetention({ uploadRoot: root, mediaAssets: [] });

    expect(result.orphanFiles).toEqual([]);
  });
});

describe('media retention cleanup', () => {
  it('is a dry run unless apply is exactly true', async () => {
    const root = await tempRoot();
    await writeFile(path.join(root, orphan), 'orphan');
    const deleteStaleRows = vi.fn();

    const result = await cleanMediaRetention({ uploadRoot: root, mediaAssets: [], deleteStaleRows });

    expect(result).toMatchObject({ applied: false, deletedOrphanFiles: 0, deletedStaleRows: 0, deletedStaleFiles: 0 });
    expect(deleteStaleRows).not.toHaveBeenCalled();
    expect(await readFile(path.join(root, orphan), 'utf8')).toBe('orphan');
  });

  it('deletes only reported orphan files and delegates stale row deletion', async () => {
    const root = await tempRoot();
    await writeFile(path.join(root, present), 'present');
    await writeFile(path.join(root, orphan), 'orphan');
    await writeFile(path.join(root, 'keep.txt'), 'keep');
    const rows = [
      { id: 'stale', storageFileName: present, galleryId: null, updatedAt: '2026-01-01T00:00:00Z' },
    ];
    const deleteStaleRows = vi.fn().mockResolvedValue(1);

    const result = await cleanMediaRetention({
      uploadRoot: root,
      mediaAssets: rows,
      retentionDays: 30,
      now: '2026-07-15T00:00:00Z',
      apply: true,
      deleteStaleRows,
    });

    expect(result).toMatchObject({ applied: true, deletedOrphanFiles: 1, deletedStaleRows: 1, deletedStaleFiles: 1 });
    expect(deleteStaleRows).toHaveBeenCalledWith([{ id: 'stale', storageFileName: present }]);
    await expect(readFile(path.join(root, orphan))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readFile(path.join(root, present))).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await readFile(path.join(root, 'keep.txt'), 'utf8')).toBe('keep');
  });

  it('requires a deletion callback before applying stale row cleanup', async () => {
    const root = await tempRoot();
    const rows = [{ id: 'stale', storage_file_name: missing, gallery_id: null, updated_at: '2026-01-01T00:00:00Z' }];

    await expect(cleanMediaRetention({
      uploadRoot: root,
      mediaAssets: rows,
      retentionDays: 30,
      now: '2026-07-15T00:00:00Z',
      apply: true,
    })).rejects.toThrow('deleteStaleRows callback is required');
  });
});
