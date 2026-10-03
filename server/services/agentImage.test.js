import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { normalizeAgentImage } from './agentImage.js';
describe('guide image validation', () => {
  it('decodes and sanitizes actual pixels', async () => {
    const png = await sharp({create:{width:20,height:10,channels:3,background:'red'}}).png().toBuffer();
    const result = await normalizeAgentImage(`data:image/png;base64,${png.toString('base64')}`);
    expect(result).toMatch(/^data:image\/jpeg;base64,/);
    const metadata = await sharp(Buffer.from(result.split(',')[1], 'base64')).metadata();
    expect(metadata).toMatchObject({width:20,height:10,format:'jpeg'});
    expect(metadata.exif).toBeUndefined();
  });
  it.each(['http://127.0.0.1/private', 'data:image/png;base64,YQ==', 'data:image/svg+xml;base64,YQ==', 'a'.repeat(800001)])('rejects URLs, invalid pixels and excess input', async (input) => {
    await expect(normalizeAgentImage(input)).rejects.toThrow();
  });
});
