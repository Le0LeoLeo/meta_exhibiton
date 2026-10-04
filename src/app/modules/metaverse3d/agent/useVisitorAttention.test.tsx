import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStore } from '../store/useStore';
import { defaultAgentState } from '../store/metaverseStoreUtils';
import { useLocalPlayerStore } from '../network/localPlayerStore';
import { useVisitorAttention } from './useVisitorAttention';

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  useLocalPlayerStore.setState({ position: { x: 0, y: 1.6, z: 0 } });
  useStore.setState({ mode: 'view', hasSelectedParticipationMode: true, viewingItem: null,
    items: [{ id: 'a', title: 'A', type: 'painting', content: '', position: [1, 1, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }],
    agent: { ...structuredClone(defaultAgentState), enabled: true, participationMode: 'ai' },
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('live attention sampling', () => {
  it('records real dwell and offers a silent invitation without opening chat', async () => {
    const view = renderHook(() => useVisitorAttention(true));
    await act(async () => { await vi.advanceTimersByTimeAsync(8000); });
    expect(useStore.getState().agent.memory.dwellSecondsByExhibit.a).toBe(8);
    expect(useStore.getState().agent.companion.invitation?.exhibitId).toBe('a');
    expect(useStore.getState().agent.isChatOpen).toBe(false);
    view.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(useStore.getState().agent.memory.dwellSecondsByExhibit.a).toBe(8);
  });

  it('does not collect attention in background tabs, solo mode, or while chatting', async () => {
    renderHook(() => useVisitorAttention(true));
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    act(() => useStore.getState().setAgent({ isChatOpen: true }));
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    act(() => useStore.getState().setAgent({ isChatOpen: false, participationMode: 'solo' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(useStore.getState().agent.memory.dwellSecondsByExhibit).toEqual({});
  });
});
