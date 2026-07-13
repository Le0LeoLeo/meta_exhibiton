import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';

const DEFAULT_MAX_BYTES = 15 * 1024 * 1024;
const PRIVATE_URL_PREFIX = '/uploads/growth/';
const allowedExtensions = new Set(['.jpg', '.png', '.webp', '.mp4', '.webm', '.mp3', '.wav', '.ogg']);

const signatures = [
  {
    mimeType: 'image/jpeg', extension: '.jpg', type: 'photo',
    matches: (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  },
  {
    mimeType: 'image/png', extension: '.png', type: 'photo',
    matches: (buffer) => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mimeType: 'image/webp', extension: '.webp', type: 'photo',
    matches: (buffer) => buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP',
  },
  {
    mimeType: 'video/mp4', extension: '.mp4', type: 'video',
    matches: (buffer) => buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp',
  },
  {
    mimeType: 'video/webm', extension: '.webm', type: 'video',
    matches: (buffer) => buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])),
  },
  {
    mimeType: 'audio/mpeg', extension: '.mp3', type: 'audio',
    matches: (buffer) => buffer.length >= 3 && (
      buffer.toString('ascii', 0, 3) === 'ID3'
      || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
    ),
  },
  {
    mimeType: 'audio/wav', extension: '.wav', type: 'audio',
    matches: (buffer) => buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE',
  },
  {
    mimeType: 'audio/ogg', extension: '.ogg', type: 'audio',
    matches: (buffer) => buffer.length >= 4 && buffer.toString('ascii', 0, 4) === 'OggS',
  },
];

const mimeAliases = new Map([
  ['audio/mp3', 'audio/mpeg'],
  ['audio/x-wav', 'audio/wav'],
  ['audio/wave', 'audio/wav'],
]);

function normalizeMimeType(value) {
  const mimeType = String(value || '').trim().toLowerCase().split(';', 1)[0];
  return mimeAliases.get(mimeType) || mimeType;
}

function isStrictBase64(value) {
  return value.length > 0
    && value.length % 4 === 0
    && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
}

function detectGrowthMedia(buffer) {
  return signatures.find((signature) => signature.matches(buffer)) || null;
}

function growthUploadsDir() {
  return path.resolve(process.cwd(), 'server', 'uploads', 'growth');
}

function privateAssetFileName(contentUrl) {
  const value = String(contentUrl || '').trim();
  if (!value) return null;

  let pathname = value;
  try {
    pathname = new URL(value).pathname;
  } catch {
    // Stored private paths are relative URLs, not absolute URLs.
  }

  if (!pathname.startsWith(PRIVATE_URL_PREFIX)) return null;
  const encodedName = pathname.slice(PRIVATE_URL_PREFIX.length);
  let fileName;
  try {
    fileName = decodeURIComponent(encodedName);
  } catch {
    return null;
  }

  if (!fileName || path.basename(fileName) !== fileName) return null;
  return fileName;
}

export function isPrivateGrowthAssetUrl(contentUrl) {
  return privateAssetFileName(contentUrl) !== null;
}

export async function saveGrowthAssetFile(buffer, extension) {
  if (!Buffer.isBuffer(buffer) || !allowedExtensions.has(extension)) {
    throw new Error('unsupported growth asset file');
  }

  const uploadsDir = growthUploadsDir();
  await fs.mkdir(uploadsDir, { recursive: true });
  const fileName = `${Date.now()}-${randomUUID()}${extension}`;
  await fs.writeFile(path.join(uploadsDir, fileName), buffer, { flag: 'wx' });
  return `${PRIVATE_URL_PREFIX}${fileName}`;
}

export async function readGrowthAssetFile(contentUrl) {
  const fileName = privateAssetFileName(contentUrl);
  if (!fileName) throw new Error('growth asset file not found');

  const buffer = await fs.readFile(path.join(growthUploadsDir(), fileName));
  const detected = detectGrowthMedia(buffer);
  if (!detected) throw new Error('unsupported stored growth asset');
  return { buffer, mimeType: detected.mimeType };
}

export async function deleteGrowthAssetFiles(contentUrls) {
  const uploadsDir = growthUploadsDir();
  await Promise.all((contentUrls || []).map(async (contentUrl) => {
    const fileName = privateAssetFileName(contentUrl);
    if (!fileName) return;
    await fs.rm(path.join(uploadsDir, fileName), { force: true });
  }));
}

export function decodeGrowthUpload({
  dataBase64,
  claimedMimeType,
  maxBytes = DEFAULT_MAX_BYTES,
}) {
  const encoded = String(dataBase64 || '').trim();
  if (!isStrictBase64(encoded)) {
    throw new Error('invalid Base64 file data');
  }

  if (encoded.length > Math.ceil(maxBytes / 3) * 4 + 4) {
    throw new Error('file too large');
  }

  const buffer = Buffer.from(encoded, 'base64');
  if (buffer.length > maxBytes) {
    throw new Error('file too large');
  }

  const detected = detectGrowthMedia(buffer);
  if (!detected) {
    throw new Error('unsupported file content');
  }

  if (normalizeMimeType(claimedMimeType) !== detected.mimeType) {
    throw new Error('file type does not match content');
  }

  return {
    buffer,
    mimeType: detected.mimeType,
    extension: detected.extension,
    type: detected.type,
  };
}
