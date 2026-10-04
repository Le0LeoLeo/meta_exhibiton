import sharp from 'sharp';

export async function normalizeAgentImage(dataUrl) {
  if (typeof dataUrl !== 'string' || dataUrl.length > 800000 || !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(dataUrl)) {
    throw new Error('Invalid artwork image');
  }
  const bytes = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
  const image = sharp(bytes, { limitInputPixels: 16000000, animated: false });
  const metadata = await image.metadata();
  if (!['jpeg', 'png', 'webp'].includes(metadata.format)) throw new Error('Invalid artwork image');
  const jpeg = await image.rotate().resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' }).jpeg({ quality: 85 }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}
