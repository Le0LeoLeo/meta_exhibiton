import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyQuickExhibition,
  buildQuickExhibition,
  createQuickExhibition,
  discardQuickExhibition,
  getQuickExhibition,
  patchQuickExhibition,
  QuickExhibitionError,
} from './quickExhibition';

const draftId = 'draft/with space?';
const requestIdentity = { requestId: 'stable-request-id', expectedRevision: 4 };
const patch = {
  expectedRevision: 4,
  title: 'My exhibition',
  assets: [{ assetId: 'asset-1', clientFileId: 'client-1', order: 0, title: 'Work', artist: '', description: '' }],
};
const savedDraft = {
  draftId, galleryId: 'gallery-1', revision: 5, status: 'collecting',
  input: { title: 'My exhibition', language: 'en', style: 'white-box', assets: [] },
  result: null, createdAt: '', updatedAt: '',
};

describe('quick exhibition API', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(savedDraft), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })));
  });

  afterEach(() => vi.unstubAllGlobals());

  it.each([
    {
      operation: 'create', method: 'PUT', suffix: '', body: { title: '', language: 'en' },
      send: () => createQuickExhibition('owner-token', draftId, { title: '', language: 'en' }),
    },
    {
      operation: 'load', method: 'GET', suffix: '', body: undefined,
      send: () => getQuickExhibition('owner-token', draftId),
    },
    {
      operation: 'save the asset list', method: 'PATCH', suffix: '', body: patch,
      send: () => patchQuickExhibition('owner-token', draftId, patch),
    },
    {
      operation: 'build', method: 'POST', suffix: '/build', body: requestIdentity,
      send: () => buildQuickExhibition('owner-token', draftId, requestIdentity),
    },
    {
      operation: 'apply', method: 'POST', suffix: '/apply', body: requestIdentity,
      send: () => applyQuickExhibition('owner-token', draftId, requestIdentity),
    },
    {
      operation: 'discard', method: 'POST', suffix: '/discard', body: requestIdentity,
      send: () => discardQuickExhibition('owner-token', draftId, requestIdentity),
    },
  ])('preserves authentication, draft identity, and payload when requesting $operation', async ({ send, method, suffix, body }) => {
    await expect(send()).resolves.toEqual(savedDraft);

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toEqual(expect.stringContaining(`/api/quick-exhibitions/${encodeURIComponent(draftId)}${suffix}`));
    expect(init?.method).toBe(method);
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer owner-token');
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json');
    expect(init?.body === undefined ? undefined : JSON.parse(String(init.body))).toEqual(body);
  });

  it.each([
    { code: 'DRAFT_CHANGED', status: 409 },
    { code: 'AUTH_REQUIRED', status: 401 },
  ])('retains the $code recovery signal from an unsuccessful response', async ({ code, status }) => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ code, message: 'Server diagnostics' }), { status }));
    const request = buildQuickExhibition('owner-token', draftId, requestIdentity);

    await expect(request).rejects.toBeInstanceOf(QuickExhibitionError);
    await expect(request).rejects.toMatchObject({ code, status });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it.each([
    { label: 'invalid JSON', body: '<html>Proxy response</html>' },
    { label: 'no revision', body: JSON.stringify({ draftId, input: { assets: [] } }) },
    { label: 'an invalid asset list', body: JSON.stringify({ draftId, revision: 1, input: { assets: null } }) },
  ])('rejects a successful HTTP response containing $label', async ({ body }) => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(body, { status: 200 }));

    await expect(getQuickExhibition('owner-token', draftId)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE', status: 502,
    });
  });

  it('returns a recovery error for non-JSON failures instead of exposing the response body', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Private proxy diagnostics', { status: 503 }));
    const request = getQuickExhibition('owner-token', draftId);

    await expect(request).rejects.toMatchObject({ code: 'QUICK_EXHIBITION_FAILED', status: 503 });
    await expect(request).rejects.not.toThrow('Private proxy diagnostics');
  });
});
