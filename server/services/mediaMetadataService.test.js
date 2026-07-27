import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import {
  DEFAULT_MAX_IMAGE_DIMENSION,
  detectImageMedia,
  planImageMetadataSanitization,
  stripJpegApp1Segments,
  validateImageMedia,
} from './mediaMetadataService.js';

function jpegSegment(marker, payload) {
  const length = payload.length + 2;
  return Buffer.from([0xff, marker, length >> 8, length & 0xff, ...payload]);
}

describe('image signature validation', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]);

  it('detects the supported image signatures', () => {
    expect(detectImageMedia(Buffer.from([0xff, 0xd8, 0xff, 0xd9]))).toMatchObject({ mimeType: 'image/jpeg', extension: '.jpg' });
    expect(detectImageMedia(png)).toMatchObject({ mimeType: 'image/png', extension: '.png' });
    expect(detectImageMedia(webp)).toMatchObject({ mimeType: 'image/webp', extension: '.webp' });
  });

  it('rejects unknown content and a claimed MIME mismatch', () => {
    expect(() => validateImageMedia(Buffer.from('<html>'), 'image/jpeg')).toThrow('unsupported image content');
    expect(() => validateImageMedia(png, 'image/jpeg')).toThrow('image type does not match content');
  });
});

describe('stripJpegApp1Segments', () => {
  it('removes EXIF and other APP1 segments while preserving image data', () => {
    const app0 = jpegSegment(0xe0, Buffer.from('JFIF\0'));
    const exif = jpegSegment(0xe1, Buffer.from('Exif\0\0private-gps'));
    const xmp = jpegSegment(0xe1, Buffer.from('http://ns.adobe.com/xap/1.0/\0private-xmp'));
    const sos = jpegSegment(0xda, Buffer.from([1, 1, 0, 0, 0x3f, 0]));
    const scanAndEnd = Buffer.from([0x11, 0xff, 0x00, 0x22, 0xff, 0xd9]);
    const input = Buffer.concat([Buffer.from([0xff, 0xd8]), app0, exif, xmp, sos, scanAndEnd]);

    const output = stripJpegApp1Segments(input);

    expect(output).toEqual(Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sos, scanAndEnd]));
    expect(output.includes(Buffer.from('private'))).toBe(false);
  });

  it('rejects truncated JPEG segments instead of returning a possibly unsafe file', () => {
    const truncated = Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x10, 0x45]);
    expect(() => stripJpegApp1Segments(truncated)).toThrow('malformed JPEG');
  });

  it('removes APP1 segments between progressive image scans', () => {
    const sos = jpegSegment(0xda, Buffer.from([1, 1, 0, 0, 0x3f, 0]));
    const exif = jpegSegment(0xe1, Buffer.from('Exif\0\0between-scans'));
    const input = Buffer.concat([
      Buffer.from([0xff, 0xd8]),
      sos,
      Buffer.from([0x11, 0xff, 0x00, 0x22]),
      exif,
      sos,
      Buffer.from([0x33, 0xff, 0xd9]),
    ]);

    expect(stripJpegApp1Segments(input)).toEqual(Buffer.concat([
      Buffer.from([0xff, 0xd8]),
      sos,
      Buffer.from([0x11, 0xff, 0x00, 0x22]),
      sos,
      Buffer.from([0x33, 0xff, 0xd9]),
    ]));
  });
});

describe('planImageMetadataSanitization', () => {
  it('returns a cleaned JPEG buffer and reports whether APP1 was removed', async () => {
    const exif = jpegSegment(0xe1, Buffer.from('Exif\0\0private'));
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8]), exif, Buffer.from([0xff, 0xd9])]);

    await expect(planImageMetadataSanitization(jpeg, 'image/jpeg')).resolves.toEqual({
      action: 'app1-stripped',
      mimeType: 'image/jpeg',
      extension: '.jpg',
      removedApp1: true,
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    });
  });

  it.each([
    ['image/png', 'png'],
    ['image/webp', 'webp'],
  ])('fully decodes and re-encodes static %s while preserving alpha', async (mimeType, format) => {
    const input = await sharp(Buffer.from([10, 20, 30, 0]), {
      raw: { width: 1, height: 1, channels: 4 },
    })[format]().withExif({ IFD0: { Artist: 'private-student-data' } }).toBuffer();

    const plan = await planImageMetadataSanitization(input, mimeType);
    const outputMetadata = await sharp(plan.buffer).metadata();
    const inputPixel = await sharp(input).ensureAlpha().raw().toBuffer();
    const outputPixel = await sharp(plan.buffer).ensureAlpha().raw().toBuffer();

    expect(plan).toMatchObject({
      action: 'reencoded',
      mimeType,
      width: 1,
      height: 1,
    });
    expect(outputMetadata.exif).toBeUndefined();
    expect(outputMetadata.xmp).toBeUndefined();
    expect([...outputPixel]).toEqual([...inputPixel]);
  });

  it.each([
    ['image/png', Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from('malformed'),
    ])],
    ['image/webp', Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPmalformed')])],
  ])('rejects malformed %s content after signature validation', async (mimeType, buffer) => {
    await expect(planImageMetadataSanitization(buffer, mimeType)).rejects.toThrow();
  });

  it('rejects animated PNG and WebP containers before re-encoding', async () => {
    const animatedPng = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from([0, 0, 0, 8]), Buffer.from('acTL'), Buffer.alloc(12),
    ]);
    const animatedWebp = Buffer.concat([
      Buffer.from('RIFF'), Buffer.from([12, 0, 0, 0]), Buffer.from('WEBP'),
      Buffer.from('ANIM'), Buffer.alloc(8),
    ]);

    await expect(planImageMetadataSanitization(animatedPng, 'image/png')).rejects.toThrow('animated images are not supported');
    await expect(planImageMetadataSanitization(animatedWebp, 'image/webp')).rejects.toThrow('animated images are not supported');
  });

  it('rejects images that exceed configured pixel or dimension limits', async () => {
    const twoPixels = await sharp({
      create: { width: 2, height: 1, channels: 4, background: 'transparent' },
    }).png().toBuffer();
    const tooWide = await sharp({
      create: { width: DEFAULT_MAX_IMAGE_DIMENSION + 1, height: 1, channels: 4, background: 'transparent' },
    }).png().toBuffer();

    await expect(planImageMetadataSanitization(twoPixels, 'image/png', { maxPixels: 1 })).rejects.toThrow();
    await expect(planImageMetadataSanitization(tooWide, 'image/png')).rejects.toThrow('image dimensions exceed the limit');
  });
});
