import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';

const source = fileURLToPath(new URL('../../exports/paidea-brand/paidea-logo-v1.png', import.meta.url));
const destination = fileURLToPath(new URL('../public/brand/', import.meta.url));
const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
function bounds(predicate) {
  let left = info.width, top = info.height, right = 0, bottom = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * 4;
    if (data[i + 3] > 64 && predicate(data[i], data[i + 1], data[i + 2])) {
      left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
  }
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}
const logo = bounds(() => true);
const mark = bounds((r, g, b) => r > g * 1.8 && r > b * 1.8 && r > 70);
await sharp(source).extract(logo).resize({ width: 800 }).png().toFile(`${destination}paidea-logo-v1.png`);
const dark = Buffer.from(data);
for (let i = 0; i < dark.length; i += 4) {
  if (dark[i] < 90 && dark[i + 1] < 90 && dark[i + 2] < 90) {
    dark[i] = 240; dark[i + 1] = 236; dark[i + 2] = 226;
  }
}
await sharp(dark, { raw: info }).extract(logo).resize({ width: 800 }).png().toFile(`${destination}paidea-logo-dark-v1.png`);
for (const size of [16, 32, 180, 256]) {
  const inset = Math.max(1, Math.round(size * 0.12));
  const icon = await sharp(source).extract(mark).resize(size - inset * 2, size - inset * 2, { fit: 'contain', background: '#fcfaf5' }).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: '#fcfaf5' } })
    .composite([{ input: icon, gravity: 'centre' }]).png().toFile(`${destination}paidea-icon-${size}-v1.png`);
}
const favicon = await readFile(`${destination}paidea-icon-32-v1.png`);
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
header[6] = 32; header[7] = 32;
header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
header.writeUInt32LE(favicon.length, 14); header.writeUInt32LE(22, 18);
await writeFile(fileURLToPath(new URL('../public/favicon.ico', import.meta.url)), Buffer.concat([header, favicon]));
console.log('Prepared Paidea light/dark wordmarks, four icon sizes and favicon.');
