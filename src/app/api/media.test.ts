import { afterEach, describe, expect, it, vi } from 'vitest';
import { uploadMediaAsset } from './media';

afterEach(() => vi.unstubAllGlobals());

describe('media upload recovery errors', () => {
  it.each([
    { status: 429, body: { message: 'too many uploads' }, code: 'RATE_LIMITED' },
    { status: 400, body: { message: 'invalid image', code: 'INVALID_UPLOAD' }, code: 'INVALID_UPLOAD' },
    { status: 401, body: { message: 'sign in' }, code: undefined },
  ])('retains status $status for the upload workflow', async ({ status, body, code }) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
    await expect(uploadMediaAsset('owner-token', new File(['pixels'], 'art.png', { type: 'image/png' })))
      .rejects.toMatchObject({ status, code });
    expect(fetch).toHaveBeenCalledOnce();
  });
});
