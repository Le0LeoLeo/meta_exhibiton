import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { ingestMediaUpload } from './mediaIngestService.js';

const tempDirs = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeUploadRoot() {
  const root = await mkdtemp(path.join(tmpdir(), 'media-ingest-'));
  tempDirs.push(root);
  return root;
}

function jpegSegment(marker, payload) {
  const length = payload.length + 2;
  return Buffer.from([0xff, marker, length >> 8, length & 0xff, ...payload]);
}

function jpegWithExif() {
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    jpegSegment(0xe1, Buffer.from('Exif\0\0private-gps')),
    Buffer.from([0xff, 0xd9]),
  ]);
}

describe('ingestMediaUpload', () => {
  it('strips JPEG APP1 metadata and stores only a random controlled filename', async () => {
    const uploadRoot = await makeUploadRoot();
    const asset = await ingestMediaUpload({
      dataBase64: jpegWithExif().toString('base64'),
      mimeType: 'image/jpeg',
      fileName: '../../student-photo.html',
    }, { uploadRoot });

    expect(asset).toMatchObject({
      mimeType: 'image/jpeg',
      originalFileName: 'student-photo.html',
      metadataSanitized: true,
    });
    expect(asset.fileName).toMatch(/^[0-9a-f-]{36}\.jpg$/);
    expect(asset.url).toBe(`/uploads/media/${asset.fileName}`);
    expect(asset.url.startsWith('blob:')).toBe(false);
    expect(asset.url.startsWith('data:')).toBe(false);

    const stored = await readFile(path.join(uploadRoot, asset.fileName));
    expect(stored).toEqual(Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
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

    expect(asset).toMatchObject({ mimeType, metadataSanitized: true });
    expect(asset.fileName.endsWith(extension)).toBe(true);
    const stored = await readFile(path.join(uploadRoot, asset.fileName));
    expect((await sharp(stored).metadata()).exif).toBeUndefined();
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
      dataBase64: jpegWithExif().toString('base64'),
      mimeType: 'image/jpeg',
      fileName: 'photo.jpg',
    }, { uploadRoot, maxBytes: 3 })).rejects.toMatchObject({ code: 'UPLOAD_TOO_LARGE', status: 413 });
    expect(await readdir(uploadRoot)).toEqual([]);
  });
});
