import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './request';

describe('apiFetch', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('aborts a request after the configured timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(
        new DOMException('aborted', 'AbortError'),
      ));
    })));

    const pending = apiFetch('/api/slow', {}, { timeoutMs: 100 });
    const expectation = expect(pending).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT' });
    await vi.advanceTimersByTimeAsync(100);
    await expectation;
  });

  it('preserves caller cancellation', async () => {
    vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(
        new DOMException('aborted', 'AbortError'),
      ));
    })));
    const controller = new AbortController();
    const pending = apiFetch('/api/cancelled', { signal: controller.signal });
    const expectation = expect(pending).rejects.toMatchObject({ code: 'REQUEST_ABORTED' });

    controller.abort();

    await expectation;
  });

  it('wraps fetch failures as network errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed to fetch')));

    await expect(apiFetch('/api/offline')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });

  it('keeps the deadline active when headers arrive but the body stalls', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new ReadableStream())));
    const pending = apiFetch('/api/large', {}, { timeoutMs: 100 });
    const expectation = expect(pending).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT' });
    await vi.advanceTimersByTimeAsync(100);
    await expectation;
  });

  it('allows cancellation while receiving the response body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new ReadableStream())));
    const controller = new AbortController();
    const pending = apiFetch('/api/large', { signal: controller.signal });
    const expectation = expect(pending).rejects.toMatchObject({ code: 'REQUEST_ABORTED' });
    await Promise.resolve();
    controller.abort();
    await expectation;
  });

  it('preserves status, headers and JSON after receiving a complete body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":"denied"}', {
      status: 403, headers: { 'Content-Type': 'application/json', 'X-Test': 'preserved' },
    })));
    const response = await apiFetch('/api/private');
    expect(response.status).toBe(403);
    expect(response.headers.get('X-Test')).toBe('preserved');
    expect(await response.json()).toEqual({ error: 'denied' });
  });

  it('keeps binary responses readable as blobs', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Uint8Array([0, 255, 20]), {
      headers: { 'Content-Type': 'audio/mpeg' },
    })));
    const response = await apiFetch('/api/audio');
    const blob = await response.blob();
    expect(blob.type).toBe('audio/mpeg');
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(new Uint8Array([0, 255, 20]));
  });

  it('includes credentials and the CSRF cookie on cookie-authenticated mutations', async () => {
    document.cookie = 'mrei_csrf=signed-token';
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/profile', { method: 'PATCH' });

    expect(fetchMock).toHaveBeenCalledWith('/api/profile', expect.objectContaining({
      credentials: 'include',
      headers: expect.any(Headers),
    }));
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get('X-CSRF-Token')).toBe('signed-token');
  });

  it('does not add a browser CSRF token to Bearer mutations', async () => {
    document.cookie = 'mrei_csrf=signed-token';
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/machine', {
      method: 'POST',
      headers: { Authorization: 'Bearer machine-token' },
    });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).has('X-CSRF-Token')).toBe(false);
  });
});
