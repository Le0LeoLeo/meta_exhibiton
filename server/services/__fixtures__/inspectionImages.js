import sharp from 'sharp';

export async function inspectionTestImage(seed = 0, blank = false) {
  const pixels = Buffer.alloc(128 * 128 * 3);
  for (let y = 0; y < 128; y += 1) {
    for (let x = 0; x < 128; x += 1) {
      const value = blank ? 210 + seed : ((Math.floor((x + seed * 3) / 12) + Math.floor(y / 16)) % 2 ? 30 : 220);
      pixels.fill(value, (y * 128 + x) * 3, (y * 128 + x + 1) * 3);
    }
  }
  const png = await sharp(pixels, { raw: { width: 128, height: 128, channels: 3 } }).png().toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}
