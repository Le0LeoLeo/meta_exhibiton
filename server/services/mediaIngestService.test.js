import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { ensureMediaAssetDimensions, ingestMediaUpload } from './mediaIngestService.js';

const tempDirs = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeUploadRoot() {
  const root = await mkdtemp(path.join(tmpdir(), 'media-ingest-'));
  tempDirs.push(root);
  return root;
}

function jpegWithExif() {
  return sharp({ create: { width: 48, height: 32, channels: 3, background: 'red' } })
    .jpeg().withMetadata({ orientation: 6 }).withExif({ IFD0: { Artist: 'private-gps' } }).toBuffer();
}

describe('ingestMediaUpload', () => {
  it('normalizes JPEG orientation, strips metadata, and stores only a random controlled filename', async () => {
    const uploadRoot = await makeUploadRoot();
    const asset = await ingestMediaUpload({
      dataBase64: (await jpegWithExif()).toString('base64'),
      mimeType: 'image/jpeg',
      fileName: '../../student-photo.html',
    }, { uploadRoot });

    expect(asset).toMatchObject({
      mimeType: 'image/jpeg',
      originalFileName: 'student-photo.html',
      metadataSanitized: true,
      width: 32,
      height: 48,
    });
    expect(asset.fileName).toMatch(/^[0-9a-f-]{36}\.jpg$/);
    expect(asset.url).toBe(`/uploads/media/${asset.fileName}`);
    expect(asset.url.startsWith('blob:')).toBe(false);
    expect(asset.url.startsWith('data:')).toBe(false);

    const stored = await readFile(path.join(uploadRoot, asset.fileName));
    const metadata = await sharp(stored).metadata();
    expect(metadata).toMatchObject({ format: 'jpeg', width: asset.width, height: asset.height });
    expect(metadata.orientation).toBeUndefined();
    expect(metadata.exif).toBeUndefined();
    expect(stored.includes(Buffer.from('private-gps'))).toBe(false);
    expect(asset.size).toBe(stored.length);
    expect(await readdir(uploadRoot)).toEqual([asset.fileName]);
  });

  it.each([
    ['invalid characters', 'aGVsbG8*'],
    ['data URL', 'data:image/jpeg;base64,/9j/2Q=='],
    ['non-canonical padding', '/9j/2Q='],
  ])('rejects %s in base64 without writing a file', async (_label, dataBase64) => {
    const uploadRoot = await makeUploadRoot();

    await expect(ingestMediaUpload({
      dataBase64,
      mimeType: 'image/jpeg',
      fileName: 'photo.jpg',
    }, { uploadRoot })).rejects.toMatchObject({ code: 'INVALID_UPLOAD', status: 400 });
    expect(await readdir(uploadRoot)).toEqual([]);
  });

  it('rejects MIME/content mismatches without writing a file', async () => {
    const uploadRoot = await makeUploadRoot();

    await expect(ingestMediaUpload({
      dataBase64: Buffer.from('<html>').toString('base64'),
      mimeType: 'image/jpeg',
      fileName: 'photo.jpg',
    }, { uploadRoot })).rejects.toMatchObject({ code: 'INVALID_UPLOAD', status: 400 });
    expect(await readdir(uploadRoot)).toEqual([]);
  });

  it.each([
    ['image/png', 'png', '.png'],
    ['image/webp', 'webp', '.webp'],
  ])('safely re-encodes and stores static %s', async (mimeType, format, extension) => {
    const uploadRoot = await makeUploadRoot();
    const buffer = await sharp(Buffer.from([25, 50, 75, 0]), {
      raw: { width: 1, height: 1, channels: 4 },
    })[format]().withExif({ IFD0: { Artist: 'private' } }).toBuffer();

    const asset = await ingestMediaUpload({
      dataBase64: buffer.toString('base64'),
      mimeType,
      fileName: 'photo',
    }, { uploadRoot });

    expect(asset).toMatchObject({ mimeType, metadataSanitized: true, width: 1, height: 1 });
    expect(asset.fileName.endsWith(extension)).toBe(true);
    const stored = await readFile(path.join(uploadRoot, asset.fileName));
    const metadata = await sharp(stored).metadata();
    expect(metadata).toMatchObject({ width: asset.width, height: asset.height });
    expect(metadata.exif).toBeUndefined();
    expect(asset.size).toBe(stored.length);
    const inputPixel = await sharp(buffer).ensureAlpha().raw().toBuffer();
    expect([...(await sharp(stored).ensureAlpha().raw().toBuffer())]).toEqual([...inputPixel]);
  });

  it('rejects malformed PNG without writing a file', async () => {
    const uploadRoot = await makeUploadRoot();
    const malformed = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from('malformed'),
    ]);

    await expect(ingestMediaUpload({
      dataBase64: malformed.toString('base64'),
      mimeType: 'image/png',
      fileName: 'photo.png',
    }, { uploadRoot })).rejects.toMatchObject({ code: 'INVALID_UPLOAD', status: 400 });
    expect(await readdir(uploadRoot)).toEqual([]);
  });

  it('enforces the configured decoded size limit', async () => {
    const uploadRoot = await makeUploadRoot();

    await expect(ingestMediaUpload({
      dataBase64: (await jpegWithExif()).toString('base64'),
      mimeType: 'image/jpeg',
      fileName: 'photo.jpg',
    }, { uploadRoot, maxBytes: 3 })).rejects.toMatchObject({ code: 'UPLOAD_TOO_LARGE', status: 413 });
    expect(await readdir(uploadRoot)).toEqual([]);
  });

  it('enforces the stored size limit when JPEG normalization increases the encoded size', async () => {
    const uploadRoot = await makeUploadRoot();
    const pixels = Buffer.from(Array.from({ length: 64 * 64 * 3 }, (_, index) => (index * 31) % 256));
    const input = await sharp(pixels, { raw: { width: 64, height: 64, channels: 3 } })
      .jpeg({ quality: 10 }).toBuffer();

    await expect(ingestMediaUpload({
      dataBase64: input.toString('base64'), mimeType: 'image/jpeg', fileName: 'compressed.jpg',
    }, { uploadRoot, maxBytes: input.length })).rejects.toMatchObject({ code: 'UPLOAD_TOO_LARGE', status: 413 });
    expect(await readdir(uploadRoot)).toEqual([]);
  });

  it.each(['jpeg', 'png', 'webp'])('does not write a %s image that exceeds pixel or side limits', async (format) => {
    const uploadRoot = await makeUploadRoot();
    const input = await sharp({
      create: { width: 4, height: 2, channels: 3, background: 'red' },
    })[format]().toBuffer();
    const payload = { dataBase64: input.toString('base64'), mimeType: `image/${format}`, fileName: 'photo' };

    for (const limits of [{ maxPixels: 7 }, { maxDimension: 3 }]) {
      await expect(ingestMediaUpload(payload, { uploadRoot, ...limits }))
        .rejects.toMatchObject({ code: 'INVALID_UPLOAD', status: 400 });
    }
    expect(await readdir(uploadRoot)).toEqual([]);
  });

  it('rejects a JPEG signature without decodable pixels instead of storing it', async () => {
    const uploadRoot = await makeUploadRoot();
    await expect(ingestMediaUpload({
      dataBase64: '/9j/2Q==', mimeType: 'image/jpeg', fileName: 'photo.jpg',
    }, { uploadRoot })).rejects.toMatchObject({ code: 'INVALID_UPLOAD', status: 400 });
    expect(await readdir(uploadRoot)).toEqual([]);
  });
});

describe('ensureMediaAssetDimensions', () => {
  const legacyAsset = {
    id: 'legacy-asset', storage_file_name: 'legacy.jpg', mime_type: 'image/jpeg',
    width: null, height: null,
  };

  it('decodes legacy stored pixels and persists both dimensions before returning them', async () => {
    const bytes = await jpegWithExif();
    const readMediaFile = vi.fn().mockResolvedValue(bytes);
    const updateMediaAssetDimensions = vi.fn().mockResolvedValue(1);
    const asset = await ensureMediaAssetDimensions(legacyAsset, { readMediaFile, updateMediaAssetDimensions });

    expect(readMediaFile).toHaveBeenCalledWith('legacy.jpg');
    expect(updateMediaAssetDimensions).toHaveBeenCalledWith('legacy-asset', 32, 48);
    expect(asset).toEqual({ ...legacyAsset, width: 32, height: 48 });
    expect(legacyAsset).toMatchObject({ width: null, height: null });
  });

  it('reuses persisted dimensions without reading or re-encoding the file again', async () => {
    const asset = { ...legacyAsset, width: 32, height: 48 };
    const readMediaFile = vi.fn();
    const updateMediaAssetDimensions = vi.fn();
    await expect(ensureMediaAssetDimensions(asset, { readMediaFile, updateMediaAssetDimensions })).resolves.toBe(asset);
    expect(readMediaFile).not.toHaveBeenCalled();
    expect(updateMediaAssetDimensions).not.toHaveBeenCalled();
  });

  it.each([null, 0, -1, 1.5])('replaces both dimensions when the stored height is %s', async (height) => {
    const asset = { ...legacyAsset, width: 999, height };
    const readMediaFile = vi.fn().mockResolvedValue(await jpegWithExif());
    const updateMediaAssetDimensions = vi.fn().mockResolvedValue(1);
    await expect(ensureMediaAssetDimensions(asset, { readMediaFile, updateMediaAssetDimensions }))
      .resolves.toMatchObject({ width: 32, height: 48 });
    expect(updateMediaAssetDimensions).toHaveBeenCalledWith('legacy-asset', 32, 48);
  });

  it.each([
    ['undecodable', () => Promise.resolve(Buffer.from([0xff, 0xd8, 0xff, 0xd9]))],
    ['missing', () => Promise.reject(Object.assign(new Error('missing file'), { code: 'ENOENT' }))],
  ])('returns an actionable error for an %s legacy file without saving dimensions', async (_label, readMediaFile) => {
    const updateMediaAssetDimensions = vi.fn();
    await expect(ensureMediaAssetDimensions(legacyAsset, { readMediaFile, updateMediaAssetDimensions }))
      .rejects.toMatchObject({ code: 'MEDIA_DIMENSIONS_UNAVAILABLE', status: 422 });
    expect(updateMediaAssetDimensions).not.toHaveBeenCalled();
  });

  it('does not claim dimensions were saved when persistence fails', async () => {
    const error = new Error('database unavailable');
    await expect(ensureMediaAssetDimensions(legacyAsset, {
      readMediaFile: vi.fn().mockResolvedValue(await jpegWithExif()),
      updateMediaAssetDimensions: vi.fn().mockRejectedValue(error),
    })).rejects.toBe(error);
  });

  it('does not return an asset deleted while its dimensions were being decoded', async () => {
    await expect(ensureMediaAssetDimensions(legacyAsset, {
      readMediaFile: vi.fn().mockResolvedValue(await jpegWithExif()),
      updateMediaAssetDimensions: vi.fn().mockResolvedValue(0),
    })).rejects.toMatchObject({ code: 'MEDIA_NOT_FOUND', status: 404 });
  });
});
