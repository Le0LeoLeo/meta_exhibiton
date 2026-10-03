import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareAgentImage } from './agentImage';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function setup() {
  const bitmap = { width: 4000, height: 2000, close: vi.fn() };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('pixels', { headers: { 'Content-Type': 'image/png' } })));
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap));
  const drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillRect: vi.fn(), drawImage } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,YQ==');
  return { bitmap, drawImage };
}
describe('guide image transport', () => {
  it('authenticates same-origin media, scales the original and releases decoded pixels', async () => {
    const { bitmap, drawImage } = setup();
    await expect(prepareAgentImage('/api/media/work', 'private-token')).resolves.toMatch(/^data:image\/jpeg/);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/media/work'), expect.objectContaining({ headers: { Authorization: 'Bearer private-token' }, credentials: 'same-origin' }));
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 2048, 1024);
    expect(bitmap.close).toHaveBeenCalled();
  });
  it('never sends the login token or cookies to external images', async () => {
    setup();
    await prepareAgentImage('https://images.example.org/work.jpg', 'private-token');
    expect(fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ headers: undefined, credentials: 'omit' }));
  });
  it('does not fetch cancelled or unsupported inputs', async () => {
    setup();
    await expect(prepareAgentImage('file:///private/image.jpg', 't')).rejects.toThrow();
    const controller = new AbortController(); controller.abort();
    await expect(prepareAgentImage('/api/media/work', 't', controller.signal)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
});
