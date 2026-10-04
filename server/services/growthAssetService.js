import path from 'node:path';
import fs from 'node:fs/promises';

// Retain only account-deletion cleanup for files stored by the retired feature.
const PRIVATE_URL_PREFIX = '/uploads/growth/';

function privateAssetFileName(contentUrl) {
  const value = String(contentUrl || '').trim();
  if (!value) return null;

  let pathname = value;
  try {
    pathname = new URL(value).pathname;
  } catch {
    // Stored paths may be relative URLs.
  }

  if (!pathname.startsWith(PRIVATE_URL_PREFIX)) return null;
  let fileName;
  try {
    fileName = decodeURIComponent(pathname.slice(PRIVATE_URL_PREFIX.length));
  } catch {
    return null;
  }
  return fileName && path.basename(fileName) === fileName ? fileName : null;
}

export async function deleteGrowthAssetFiles(contentUrls) {
  const uploadsDir = path.resolve(process.cwd(), 'server', 'uploads', 'growth');
  await Promise.all((contentUrls || []).map(async (contentUrl) => {
    const fileName = privateAssetFileName(contentUrl);
    if (!fileName) return;
    await fs.rm(path.join(uploadsDir, fileName), { force: true });
  }));
}
