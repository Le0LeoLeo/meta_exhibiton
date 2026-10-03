import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const publicDirectory = new URL('../public/', import.meta.url);
const source = fileURLToPath(new URL('brand/metaexb-icon-v1.png', publicDirectory));
await mkdir(new URL('brand/', publicDirectory), { recursive: true });

// Export the approved artwork into browser icon sizes without changing the design.
const icons = new Map();
for (const size of [16, 32, 48, 180, 256]) {
  const png = await sharp(source)
    .flatten({ background: '#a82e23' })
    .resize(size, size)
    .png()
    .toBuffer();
  icons.set(size, png);
  if ([16, 32, 180].includes(size)) {
    await writeFile(new URL(`brand/metaexb-icon-${size}-v2.png`, publicDirectory), png);
  }
}

// ICO supports PNG entries; include multiple sizes for browser and OS consumers.
const sizes = [16, 32, 48, 256];
const directory = Buffer.alloc(6 + sizes.length * 16);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(sizes.length, 4);
let offset = directory.length;
sizes.forEach((size, index) => {
  const entry = 6 + index * 16;
  const png = icons.get(size);
  directory[entry] = size === 256 ? 0 : size;
  directory[entry + 1] = size === 256 ? 0 : size;
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(png.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += png.length;
});
await writeFile(new URL('favicon.ico', publicDirectory), Buffer.concat([directory, ...sizes.map(size => icons.get(size))]));

// Keep the historical SVG URL self-contained for clients that cached that URL.
await writeFile(new URL('favicon.svg', publicDirectory),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><image width="256" height="256" href="data:image/png;base64,${icons.get(256).toString('base64')}"/></svg>\n`);
console.log('Exported browser and Apple icons from the approved MetaEXB artwork.');
