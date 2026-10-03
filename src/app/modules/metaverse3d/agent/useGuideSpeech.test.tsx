import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestQwenTts } from '@/app/api/client';
import { useStore } from '../store/useStore';
import { defaultAgentState } from '../store/metaverseStoreUtils';
import { useGuideSpeech } from './useGuideSpeech';

vi.mock('@/app/api/client', () => ({ loadAuth: () => ({ token: 'test' }), requestQwenTts: vi.fn() }));
const play = vi.fn().mockResolvedValue(undefined);
const pause = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requestQwenTts).mockResolvedValue(new Blob(['sound']));
  vi.stubGlobal('Audio', class { play = play; pause = pause; onended = null; onerror = null; });
  URL.createObjectURL = vi.fn(() => 'blob:test');
  URL.revokeObjectURL = vi.fn();
  useStore.setState({ agent: { ...structuredClone(defaultAgentState), enabled: true, participationMode: 'ai' }, agentChat: [] });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('shared guide speech', () => {
  it('speaks a tour answer, and stops playback immediately when muted', async () => {
    renderHook(() => useGuideSpeech());
    act(() => useStore.getState().setAgentDialogue('An automatic tour reply.'));
    await waitFor(() => expect(play).toHaveBeenCalledOnce());
    act(() => useStore.getState().setAgent({ companion: { ...useStore.getState().agent.companion, voiceEnabled: false } }));
    expect(pause).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
    act(() => useStore.getState().setAgent({ companion: { ...useStore.getState().agent.companion, voiceEnabled: true } }));
    expect(requestQwenTts).toHaveBeenCalledOnce();
  });

  it('never plays a delayed audio response after the gallery session changes', async () => {
    let resolve!: (blob: Blob) => void;
    vi.mocked(requestQwenTts).mockReturnValue(new Promise((r) => { resolve = r; }));
    renderHook(() => useGuideSpeech());
    act(() => useStore.getState().setAgentDialogue('Old reply.'));
    const signal = vi.mocked(requestQwenTts).mock.calls[0][2]?.signal;
    act(() => useStore.getState().setAgent({ memory: { ...useStore.getState().agent.memory, sessionId: 'new-session' } }));
    await act(async () => resolve(new Blob(['old audio'])));
    expect(signal?.aborted).toBe(true);
    expect(play).not.toHaveBeenCalled();
  });
});
