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
  it.each([
    ['jpeg', 48, 32], ['jpeg', 32, 48],
    ['png', 48, 32], ['png', 32, 48],
    ['webp', 48, 32], ['webp', 32, 48],
  ])('returns decoded %s dimensions for a %ix%i image and removes metadata', async (format, width, height) => {
    const input = await sharp({
      create: { width, height, channels: 3, background: 'red' },
    })[format]().withExif({ IFD0: { Artist: 'private-student-data' } })
      .withXmp('<x:xmpmeta xmlns:x="adobe:ns:meta/">private-xmp</x:xmpmeta>')
      .toBuffer();

    const plan = await planImageMetadataSanitization(input, `image/${format}`);
    const metadata = await sharp(plan.buffer).metadata();

    expect(plan).toMatchObject({ action: 'reencoded', mimeType: `image/${format}`, width, height });
    expect(metadata).toMatchObject({ format, width, height });
    expect(metadata.exif).toBeUndefined();
    expect(metadata.xmp).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
    expect(metadata.orientation).toBeUndefined();
    expect(plan.buffer.includes(Buffer.from('private'))).toBe(false);
  });

  it.each([
    [2, 48, 32, [1, 0, 3, 2]],
    [3, 48, 32, [3, 2, 1, 0]],
    [4, 48, 32, [2, 3, 0, 1]],
    [5, 32, 48, [0, 2, 1, 3]],
    [6, 32, 48, [2, 0, 3, 1]],
    [7, 32, 48, [3, 1, 2, 0]],
    [8, 32, 48, [1, 3, 0, 2]],
  ])('normalizes JPEG EXIF orientation %i in the stored pixels', async (orientation, width, height, corners) => {
    const colors = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0]];
    const pixels = Buffer.alloc(48 * 32 * 3);
    for (let y = 0; y < 32; y += 1) {
      for (let x = 0; x < 48; x += 1) {
        pixels.set(colors[(y < 16 ? 0 : 2) + (x < 24 ? 0 : 1)], (y * 48 + x) * 3);
      }
    }
    const input = await sharp(pixels, { raw: { width: 48, height: 32, channels: 3 } })
      .jpeg({ quality: 100, chromaSubsampling: '4:4:4' })
      .withMetadata({ orientation }).toBuffer();

    const plan = await planImageMetadataSanitization(input, 'image/jpeg');
    const { data, info } = await sharp(plan.buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(plan).toMatchObject({ width, height });
    expect(info).toMatchObject({ width, height, channels: 3 });
    const points = [[4, 4], [width - 5, 4], [4, height - 5], [width - 5, height - 5]];
    points.forEach(([x, y], index) => {
      const offset = (y * width + x) * 3;
      colors[corners[index]].forEach((value, channel) => {
        expect(Math.abs(data[offset + channel] - value)).toBeLessThan(15);
      });
    });
    expect((await sharp(plan.buffer).metadata()).orientation).toBeUndefined();
  });

  it.each(['png', 'webp'])('normalizes %s EXIF orientation with lossless pixels and alpha', async (format) => {
    const input = await sharp(Buffer.from([255, 0, 0, 255, 0, 0, 255, 100]), {
      raw: { width: 2, height: 1, channels: 4 },
    })[format]({ lossless: true }).withMetadata({ orientation: 6 }).toBuffer();

    const plan = await planImageMetadataSanitization(input, `image/${format}`);
    const { data, info } = await sharp(plan.buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(plan).toMatchObject({ width: 1, height: 2 });
    expect(info).toMatchObject({ width: 1, height: 2 });
    expect(data).toEqual(await sharp(input).ensureAlpha().raw().toBuffer());
    expect((await sharp(plan.buffer).metadata()).orientation).toBeUndefined();
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
    ['image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xd9])],
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

  it.each(['jpeg', 'png', 'webp'])('rejects %s images that exceed configured pixel or dimension limits', async (format) => {
    const twoPixels = await sharp({
      create: { width: 2, height: 1, channels: 3, background: 'white' },
    })[format]().toBuffer();
    const tooWide = await sharp({
      create: { width: DEFAULT_MAX_IMAGE_DIMENSION + 1, height: 1, channels: 3, background: 'white' },
    })[format]().toBuffer();

    await expect(planImageMetadataSanitization(twoPixels, `image/${format}`, { maxPixels: 1 })).rejects.toThrow();
    await expect(planImageMetadataSanitization(tooWide, `image/${format}`)).rejects.toThrow('image dimensions exceed the limit');
    await expect(planImageMetadataSanitization(twoPixels, `image/${format}`, { maxDimension: 1 })).rejects.toThrow('image dimensions exceed the limit');
  });

  it('rejects a truncated JPEG with readable dimensions but missing image data', async () => {
    const input = await sharp({
      create: { width: 48, height: 32, channels: 3, background: 'blue' },
    }).jpeg().toBuffer();
    const truncated = input.subarray(0, input.length - 10);
    expect(await sharp(truncated).metadata()).toMatchObject({ width: 48, height: 32 });
    await expect(planImageMetadataSanitization(truncated, 'image/jpeg')).rejects.toThrow();
  });
});
