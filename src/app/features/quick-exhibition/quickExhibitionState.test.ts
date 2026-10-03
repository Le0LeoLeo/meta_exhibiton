import { describe, expect, it } from 'vitest';
import { canBuildAutomatically, restoreQuickItems, uploadedAssetInputs, validateQuickFiles } from './quickExhibitionState';
import type { QuickExhibitionDraft, QuickUploadItem } from './types';

describe('quick exhibition inputs', () => {
  it('rejects the whole over-capacity batch instead of dropping files', () => {
    const files = Array.from({ length: 2 }, (_, index) => new File(['a'], `${index}.png`, { type: 'image/png' }));
    expect(validateQuickFiles(files, 29)).toBe('TOO_MANY_ASSETS');
    expect(validateQuickFiles(files, 28)).toBeNull();
  });
  it('rejects unsupported and oversized files before uploading', () => {
    expect(validateQuickFiles([new File(['a'], 'a.svg', { type: 'image/svg+xml' })], 0)).toBe('UNSUPPORTED_FILE');
    expect(validateQuickFiles([new File(['123'], 'a.png', { type: 'image/png' })], 0, 30, 2)).toBe('FILE_TOO_LARGE');
  });
  it('keeps equal filenames as separate artwork identities and excludes failed uploads', () => {
    const items = [
      { id: 'one', status: 'succeeded', fileName: 'same.png', asset: { assetId: 'a', title: 'one', artist: '', description: '' } },
      { id: 'bad', status: 'failed', fileName: 'bad.png' },
      { id: 'two', status: 'succeeded', fileName: 'same.png', asset: { assetId: 'b', title: 'two', artist: '', description: '' } },
    ] as QuickUploadItem[];
    expect(uploadedAssetInputs(items).map((item) => [item.assetId, item.order])).toEqual([['a', 0], ['b', 2]]);
    expect(canBuildAutomatically(items)).toBe(false);
    expect(canBuildAutomatically(items.filter((item) => item.id !== 'bad'))).toBe(true);
    expect(canBuildAutomatically([])).toBe(false);
  });
  it('recovers server assets and explicitly keeps missing local files', () => {
    const draft = { input: { assets: [{ assetId: 'saved', clientFileId: 'one', order: 0, fileName: 'saved.png', url: '/api/media/saved' }] } } as QuickExhibitionDraft;
    const items = restoreQuickItems(draft, [{ id: 'one', fileName: 'saved.png' }, { id: 'two', fileName: 'pending.png' }]);
    expect(items.map((item) => [item.id, item.status])).toEqual([['one', 'succeeded'], ['two', 'missing']]);
    expect(canBuildAutomatically(items)).toBe(false);
  });
});
