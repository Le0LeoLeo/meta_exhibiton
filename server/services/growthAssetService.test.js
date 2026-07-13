import { describe, expect, it } from 'vitest';
import { decodeGrowthUpload, isPrivateGrowthAssetUrl } from './growthAssetService.js';

function base64(bytes) {
  return Buffer.from(bytes).toString('base64');
}

const samples = [
  ['image/jpeg', [0xff, 0xd8, 0xff, 0xe0, 0x00], '.jpg', 'photo'],
  ['image/png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], '.png', 'photo'],
  ['image/webp', [...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBP')], '.webp', 'photo'],
  ['video/mp4', [0, 0, 0, 0x18, ...Buffer.from('ftyp'), ...Buffer.from('isom')], '.mp4', 'video'],
  ['video/webm', [0x1a, 0x45, 0xdf, 0xa3, 0x00], '.webm', 'video'],
  ['audio/mpeg', [...Buffer.from('ID3'), 0x04, 0x00], '.mp3', 'audio'],
  ['audio/wav', [...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WAVE')], '.wav', 'audio'],
  ['audio/ogg', [...Buffer.from('OggS'), 0x00], '.ogg', 'audio'],
];

describe('decodeGrowthUpload', () => {
  it.each(samples)('accepts %s from its byte signature', (mimeType, bytes, extension, type) => {
    const result = decodeGrowthUpload({
      dataBase64: base64(bytes),
      claimedMimeType: mimeType,
    });

    expect(result).toMatchObject({ mimeType, extension, type });
    expect(result.buffer).toEqual(Buffer.from(bytes));
  });

  it('rejects active HTML content even when the client claims it is an image', () => {
    expect(() => decodeGrowthUpload({
      dataBase64: Buffer.from('<html><script>alert(1)</script></html>').toString('base64'),
      claimedMimeType: 'image/png',
    })).toThrow('unsupported file content');
  });

  it('rejects a MIME type that does not match the decoded bytes', () => {
    expect(() => decodeGrowthUpload({
      dataBase64: base64(samples[1][1]),
      claimedMimeType: 'video/mp4',
    })).toThrow('file type does not match content');
  });

  it('rejects malformed Base64 instead of decoding partial data', () => {
    expect(() => decodeGrowthUpload({
      dataBase64: 'not-valid-@@@',
      claimedMimeType: 'image/png',
    })).toThrow('invalid Base64 file data');
  });

  it('limits the decoded byte size', () => {
    expect(() => decodeGrowthUpload({
      dataBase64: base64(samples[1][1]),
      claimedMimeType: 'image/png',
      maxBytes: 4,
    })).toThrow('file too large');
  });
});

describe('isPrivateGrowthAssetUrl', () => {
  it('recognizes current relative paths and legacy absolute URLs', () => {
    expect(isPrivateGrowthAssetUrl('/uploads/growth/file.png')).toBe(true);
    expect(isPrivateGrowthAssetUrl('https://old.example.com/uploads/growth/file.png')).toBe(true);
  });

  it('rejects traversal and unrelated URLs', () => {
    expect(isPrivateGrowthAssetUrl('/uploads/growth/../app.db')).toBe(false);
    expect(isPrivateGrowthAssetUrl('/uploads/growth/%2e%2e%2fapp.db')).toBe(false);
    expect(isPrivateGrowthAssetUrl('https://cdn.example.com/file.png')).toBe(false);
  });
});
