// @vitest-environment node
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { generateExhibitionQr } from './exhibitionQr';

describe('exhibition QR image', () => {
  it('decodes the downloadable PNG to the exact public exhibition URL', async () => {
    const url = 'https://metaexb.com/exhibitions/7e3c80bd-97f9-4022-b94c-e64883dd389f';
    const dataUrl = await generateExhibitionQr(url);
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    const { data, info } = await sharp(Buffer.from(dataUrl.split(',')[1], 'base64')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(info.width).toBe(768);
    expect(info.height).toBe(768);
    expect(jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data).toBe(url);
    expect([...data.subarray(0, 4)]).toEqual([255, 255, 255, 255]);
  });
});
