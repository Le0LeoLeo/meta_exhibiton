import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestAgentReply } from './agent';
import { prepareAgentImage } from './agentImage';
vi.mock('./agentImage', () => ({ prepareAgentImage: vi.fn() }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe('guide multimodal payload', () => {
  it.each([false, true])('sends image bytes or explicit unavailable status, never source access URLs (%s)', async (failed) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ answer:'ok',source:'qwen' }))));
    if(failed) vi.mocked(prepareAgentImage).mockRejectedValue(new Error('image unavailable'));
    else vi.mocked(prepareAgentImage).mockResolvedValue('data:image/jpeg;base64,YQ==');
    await requestAgentReply('token', { question:'What is shown?',personality:'xiaobai',exhibit:{id:'a',imageUrl:'/api/media/a?accessToken=private'},nearbyExhibits:[{id:'b',imageUrl:'/api/media/b?accessToken=private'}] });
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(JSON.stringify(body)).not.toContain('private');
    expect(body.exhibitImage).toBe(failed ? undefined : 'data:image/jpeg;base64,YQ==');
    expect(body.imageUnavailable).toBe(failed ? true : undefined);
  });
});
