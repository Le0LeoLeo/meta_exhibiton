import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recordGalleryVisit } from '../../api/galleryVisits';
import { useGalleryVisit } from './useGalleryVisit';
import { getVisitSession, resetVisitSessionCacheForTests } from './visitSession';

vi.mock('../../api/galleryVisits', () => ({ recordGalleryVisit: vi.fn() }));
const record = vi.mocked(recordGalleryVisit);
const show = (visibility: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: visibility });
  document.dispatchEvent(new Event('visibilitychange'));
};
const advance = async (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

describe('useGalleryVisit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-05T00:00:00Z'));
    localStorage.clear(); sessionStorage.clear(); resetVisitSessionCacheForTests();
    show('visible');
    record.mockReset(); record.mockResolvedValue(undefined);
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('records foreground time and focused artwork without an AI session and resumes after hidden time', async () => {
    const hook = renderHook(() => useGalleryVisit({ galleryId: 'gallery', mode: '2d', enabled: true }));
    act(() => hook.result.current('painting'));
    await advance(15000);
    expect(record.mock.calls[0][1].activeSeconds).toBe(0);
    expect(record.mock.lastCall?.[1]).toMatchObject({ activeSeconds: 15, itemDwellSeconds: { painting: 15 } });
    act(() => show('hidden'));
    await advance(60000);
    expect(record.mock.lastCall?.[1].activeSeconds).toBe(15);
    act(() => show('visible'));
    await advance(15000);
    expect(record.mock.lastCall?.[1].activeSeconds).toBe(30);
    hook.unmount();
  });

  it('preserves cumulative counters and session across a 2D/3D switch and a remount', async () => {
    const hook = renderHook(({ mode }: { mode: '2d' | '3d' }) => useGalleryVisit({ galleryId: 'gallery', mode, enabled: true }), { initialProps: { mode: '2d' as '2d' | '3d' } });
    await advance(15000);
    const id = record.mock.lastCall?.[1].sessionId;
    hook.rerender({ mode: '3d' });
    await advance(15000);
    expect(record.mock.lastCall?.[1]).toMatchObject({ sessionId: id, mode: '3d', activeSeconds: 30 });
    hook.unmount();
    resetVisitSessionCacheForTests();
    const next = renderHook(() => useGalleryVisit({ galleryId: 'gallery', mode: '2d', enabled: true }));
    await advance(15000);
    expect(record.mock.lastCall?.[1]).toMatchObject({ sessionId: id, activeSeconds: 45 });
    next.unmount();
  });

  it('retries cumulative totals after network failure, flushes on pagehide and stops timers on teardown', async () => {
    record.mockRejectedValueOnce(new Error('offline'));
    const hook = renderHook(() => useGalleryVisit({ galleryId: 'gallery', mode: '3d', enabled: true, shareToken: 'share-token' }));
    await advance(15000);
    expect(record.mock.lastCall?.[1].activeSeconds).toBe(15);
    await advance(5000);
    act(() => window.dispatchEvent(new Event('pagehide')));
    expect(record.mock.lastCall).toEqual(['gallery', expect.objectContaining({ activeSeconds: 20 }), 'share-token', true]);
    hook.unmount();
    const count = record.mock.calls.length;
    await advance(60000);
    expect(record).toHaveBeenCalledTimes(count);
  });

  it('does not record disabled editors or a tab never viewed in foreground', async () => {
    show('hidden');
    const hidden = renderHook(() => useGalleryVisit({ galleryId: 'gallery', mode: '2d', enabled: true }));
    const disabled = renderHook(() => useGalleryVisit({ galleryId: 'editor', mode: '3d', enabled: false }));
    await advance(30000);
    hidden.unmount(); disabled.unmount();
    expect(record).not.toHaveBeenCalled();
  });

  it('starts a fresh zero-counter session after 30 minutes without foreground activity', async () => {
    const hook = renderHook(() => useGalleryVisit({ galleryId: 'gallery', mode: '2d', enabled: true }));
    await advance(15000);
    const firstId = record.mock.lastCall?.[1].sessionId;
    act(() => show('hidden'));
    await advance(30 * 60000);
    act(() => show('visible'));
    expect(record.mock.lastCall?.[1].sessionId).not.toBe(firstId);
    expect(record.mock.lastCall?.[1].activeSeconds).toBe(0);
    hook.unmount();
  });

  it('uses stable memory fallbacks when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const first = getVisitSession('gallery');
    expect(getVisitSession('gallery')).toBe(first);
    expect(getVisitSession('another').visitorId).toBe(first.visitorId);
  });
});
