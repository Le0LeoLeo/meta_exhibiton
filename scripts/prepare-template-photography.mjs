import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const directory = new URL('../public/templates/', import.meta.url);
await mkdir(directory, { recursive: true });
// Curated sample photographs, not claims about user-owned works or real exhibitions.
const photos = [
  'photo-1519608487953-e999c86e7455',
  'photo-1470770841072-f978cf4d019e',
  'photo-1441974231531-c6227db76b6e',
  'photo-1518837695005-2083093ee35b',
  'photo-1449824913935-59a10b8d2000',
  'photo-1464822759023-fed622ff2c3b',
];
for (const [index, id] of photos.entries()) {
  const url = `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&h=900&q=85`;
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error(`Invalid photograph ${id}: ${response.status}`);
  const data = await sharp(Buffer.from(await response.arrayBuffer())).resize(1000, 750, { fit: 'cover' }).jpeg({ quality: 84 }).toBuffer();
  await writeFile(new URL(`photo-${index + 1}.jpg`, directory), data);
  console.log(`Saved photograph ${index + 1}: ${data.length} bytes`);
}
await writeFile(new URL('SOURCES.md', directory), `# Template assets\n\nThe art, circuit, fashion silhouette and car design SVG studies and all four GLB models are original MetaEXB template examples, reproducible with scripts/generate-template-assets.mjs. They are editable starting material, not third-party products or historical objects.\n\nThe history template reuses bundled Met Open Access public-domain images documented in docs/demo-artwork-sources.md.\n\nPhotography samples are from Unsplash and are bundled for dependable loading; see https://unsplash.com/license. Reproduce with scripts/prepare-template-photography.mjs.\n\n${photos.map((id, i) => `- photo-${i + 1}.jpg: https://images.unsplash.com/${id}`).join('\n')}\n`);
