import crypto from 'node:crypto';
import sharp from 'sharp';

// This is an evidence gate, not an aesthetic score. A textured wall can still
// pass; the visual reviewer must separately confirm that exhibits are visible.
export async function validateInspectionEvidence(screenshots) {
  const valid = [];
  const rejected = [];
  const hashes = new Set();
  for (const shot of screenshots) {
    try {
      const match = /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(shot.dataUrl);
      if (!match || match[1].length > 12_000_000) throw new Error('invalid image');
      const image = sharp(Buffer.from(match[1], 'base64'), { limitInputPixels: 16_777_216 });
      const metadata = await image.metadata();
      if (metadata.width < 128 || metadata.height < 128) throw new Error('image too small');
      const pixels = await image.resize(64, 64, { fit: 'fill' }).flatten({ background: '#ffffff' }).greyscale().raw().toBuffer();
      const mean = pixels.reduce((sum, value) => sum + value, 0) / pixels.length;
      const deviation = Math.sqrt(pixels.reduce((sum, value) => sum + (value - mean) ** 2, 0) / pixels.length);
      let edges = 0;
      for (let y = 1; y < 63; y += 1) {
        for (let x = 1; x < 63; x += 1) {
          const i = y * 64 + x;
          if (Math.abs(pixels[i] - pixels[i + 1]) > 10 || Math.abs(pixels[i] - pixels[i + 64]) > 10) edges += 1;
        }
      }
      const hash = crypto.createHash('sha256').update(pixels).digest('hex');
      if (deviation < 5 || edges < 25 || hashes.has(hash)) throw new Error('blank or repeated view');
      hashes.add(hash);
      const encoded = await sharp(Buffer.from(match[1], 'base64'), { limitInputPixels: 16_777_216 })
        .resize({ width: 1280, height: 960, fit: 'inside', withoutEnlargement: true })
        .flatten({ background: '#ffffff' }).jpeg({ quality: 85 }).toBuffer();
      valid.push({ ...shot, dataUrl: `data:image/jpeg;base64,${encoded.toString('base64')}` });
    } catch {
      rejected.push(shot.viewId);
    }
  }
  return { valid, rejected };
}
