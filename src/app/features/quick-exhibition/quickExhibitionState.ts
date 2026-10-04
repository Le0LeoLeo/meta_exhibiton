import type { QuickExhibitionAssetInput, QuickExhibitionDraft, QuickExhibitionStyle, QuickUploadItem } from './types';

export const QUICK_EXHIBITION_MAX_ASSETS = 30;
export const QUICK_EXHIBITION_MAX_FILE_BYTES = 15 * 1024 * 1024;
export const QUICK_EXHIBITION_MAX_ARTWORK_TEXT_LENGTH = 200;
export const QUICK_EXHIBITION_MAX_DESCRIPTION_LENGTH = 5000;

export function validateQuickFiles(files: File[], existingCount: number, maxAssets = QUICK_EXHIBITION_MAX_ASSETS, maxBytes = QUICK_EXHIBITION_MAX_FILE_BYTES) {
  if (existingCount + files.length > maxAssets) return 'TOO_MANY_ASSETS';
  if (files.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) return 'UNSUPPORTED_FILE';
  if (files.some((file) => file.size > maxBytes)) return 'FILE_TOO_LARGE';
  return null;
}

export function uploadedAssetInputs(items: QuickUploadItem[]): QuickExhibitionAssetInput[] {
  return items.flatMap((item, order) => item.asset && item.status === 'succeeded'
    ? [{ assetId: item.asset.assetId, clientFileId: item.id, order, title: item.asset.title, artist: item.asset.artist, description: item.asset.description }]
    : []);
}

export function canBuildAutomatically(items: QuickUploadItem[]) {
  return items.length > 0 && items.every((item) => item.status === 'succeeded' && item.asset);
}

export function restoreQuickItems(draft: QuickExhibitionDraft, pending: Pick<QuickUploadItem, 'id' | 'fileName'>[] = []): QuickUploadItem[] {
  const assets = [...draft.input.assets].sort((a, b) => a.order - b.order);
  const known = new Set(assets.map((asset) => asset.clientFileId));
  return [
    ...assets.map((asset): QuickUploadItem => ({
      id: asset.clientFileId, fileName: asset.fileName, status: 'succeeded', asset,
      previewUrl: asset.previewUrl || asset.url,
    })),
    ...pending.filter((item) => !known.has(item.id)).map((item): QuickUploadItem => ({ ...item, status: 'missing', error: 'FILE_RESELECT_REQUIRED' })),
  ];
}

export function quickInputKey(items: QuickUploadItem[], title: string, style: QuickExhibitionStyle = 'white-box') {
  return JSON.stringify({ assets: uploadedAssetInputs(items), title: title.trim(), style });
}
