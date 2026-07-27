const imageSignatures = [
  {
    mimeType: 'image/jpeg',
    extension: '.jpg',
    matches: (buffer) => buffer.length >= 3
      && buffer[0] === 0xff
      && buffer[1] === 0xd8
      && buffer[2] === 0xff,
  },
  {
    mimeType: 'image/png',
    extension: '.png',
    matches: (buffer) => buffer.length >= 8
      && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mimeType: 'image/webp',
    extension: '.webp',
    matches: (buffer) => buffer.length >= 12
      && buffer.toString('ascii', 0, 4) === 'RIFF'
      && buffer.toString('ascii', 8, 12) === 'WEBP',
  },
];

const mimeAliases = new Map([
  ['image/jpg', 'image/jpeg'],
  ['image/pjpeg', 'image/jpeg'],
]);

function normalizeMimeType(value) {
  const mimeType = String(value || '').trim().toLowerCase().split(';', 1)[0];
  return mimeAliases.get(mimeType) || mimeType;
}

export function detectImageMedia(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  return imageSignatures.find((signature) => signature.matches(buffer)) || null;
}

export function validateImageMedia(buffer, claimedMimeType) {
  const detected = detectImageMedia(buffer);
  if (!detected) throw new Error('unsupported image content');
  if (normalizeMimeType(claimedMimeType) !== detected.mimeType) {
    throw new Error('image type does not match content');
  }
  return detected;
}

function malformedJpeg() {
  return new Error('malformed JPEG');
}

function hasPngChunk(buffer, expectedType) {
  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const dataLength = buffer.readUInt32BE(offset);
    const chunkEnd = offset + 12 + dataLength;
    if (chunkEnd > buffer.length) return false;
    if (buffer.toString('ascii', offset + 4, offset + 8) === expectedType) return true;
    offset = chunkEnd;
  }
  return false;
}

function hasWebpChunk(buffer, expectedTypes) {
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const dataLength = buffer.readUInt32LE(offset + 4);
    const chunkEnd = offset + 8 + dataLength + (dataLength % 2);
    if (chunkEnd > buffer.length) return false;
    if (expectedTypes.has(buffer.toString('ascii', offset, offset + 4))) return true;
    offset = chunkEnd;
  }
  return false;
}

function isAnimatedContainer(buffer, mimeType) {
  if (mimeType === 'image/png') return hasPngChunk(buffer, 'acTL');
  if (mimeType === 'image/webp') return hasWebpChunk(buffer, new Set(['ANIM', 'ANMF']));
  return false;
}

async function reencodeRasterImage(buffer, detected, options) {
  if (isAnimatedContainer(buffer, detected.mimeType)) {
    throw new Error('animated images are not supported');
  }

  const maxPixels = options.maxPixels ?? DEFAULT_MAX_IMAGE_PIXELS;
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_IMAGE_DIMENSION;
  const pipeline = sharp(buffer, {
    failOn: 'warning',
    limitInputPixels: maxPixels,
    sequentialRead: true,
  });
  const metadata = await pipeline.metadata();
  const expectedFormat = detected.mimeType === 'image/png' ? 'png' : 'webp';

  if (metadata.format !== expectedFormat || !metadata.width || !metadata.height) {
    throw new Error('image decoder rejected the content');
  }
  if ((metadata.pages ?? 1) > 1) throw new Error('animated images are not supported');
  if (metadata.width > maxDimension || metadata.height > maxDimension) {
    throw new Error('image dimensions exceed the limit');
  }
  if (metadata.width * metadata.height > maxPixels) {
    throw new Error('image pixel count exceeds the limit');
  }

  const encoder = detected.mimeType === 'image/png'
    ? pipeline.png({ compressionLevel: 9 })
    : pipeline.webp({ lossless: true, alphaQuality: 100, exact: true, effort: 4 });
  const { data, info } = await encoder.toBuffer({ resolveWithObject: true });

  return {
    action: 'reencoded',
    mimeType: detected.mimeType,
    extension: detected.extension,
    width: info.width,
    height: info.height,
    buffer: data,
  };
}

export function stripJpegApp1Segments(buffer) {
  if (!Buffer.isBuffer(buffer)
    || buffer.length < 4
    || buffer[0] !== 0xff
    || buffer[1] !== 0xd8) {
    throw malformedJpeg();
  }

  const chunks = [buffer.subarray(0, 2)];
  let offset = 2;

  while (offset < buffer.length) {
    const segmentStart = offset;
    if (buffer[offset] !== 0xff) throw malformedJpeg();
    while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
    if (offset >= buffer.length) throw malformedJpeg();

    const marker = buffer[offset];
    offset += 1;

    if (marker === 0xd9) {
      chunks.push(buffer.subarray(segmentStart));
      return Buffer.concat(chunks);
    }

    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      chunks.push(buffer.subarray(segmentStart, offset));
      continue;
    }

    if (marker === 0x00 || marker === 0xd8 || offset + 2 > buffer.length) {
      throw malformedJpeg();
    }

    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) {
      throw malformedJpeg();
    }
    const segmentEnd = offset + segmentLength;

    if (marker === 0xda) {
      chunks.push(buffer.subarray(segmentStart, segmentEnd));
      offset = segmentEnd;
      const scanStart = offset;

      while (offset < buffer.length) {
        const markerStart = buffer.indexOf(0xff, offset);
        if (markerStart === -1) throw malformedJpeg();

        let markerOffset = markerStart;
        while (markerOffset < buffer.length && buffer[markerOffset] === 0xff) markerOffset += 1;
        if (markerOffset >= buffer.length) throw malformedJpeg();

        const scanMarker = buffer[markerOffset];
        if (scanMarker === 0x00 || (scanMarker >= 0xd0 && scanMarker <= 0xd7)) {
          offset = markerOffset + 1;
          continue;
        }

        chunks.push(buffer.subarray(scanStart, markerStart));
        offset = markerStart;
        break;
      }
      continue;
    }

    if (marker !== 0xe1) {
      chunks.push(buffer.subarray(segmentStart, segmentEnd));
    }
    offset = segmentEnd;
  }

  throw malformedJpeg();
}

export async function planImageMetadataSanitization(buffer, claimedMimeType, options = {}) {
  const detected = validateImageMedia(buffer, claimedMimeType);

  if (detected.mimeType !== 'image/jpeg') {
    return reencodeRasterImage(buffer, detected, options);
  }

  const cleaned = stripJpegApp1Segments(buffer);
  return {
    action: 'app1-stripped',
    mimeType: detected.mimeType,
    extension: detected.extension,
    removedApp1: cleaned.length !== buffer.length,
    buffer: cleaned,
  };
}
import sharp from 'sharp';

export const DEFAULT_MAX_IMAGE_PIXELS = 40_000_000;
export const DEFAULT_MAX_IMAGE_DIMENSION = 8_192;
