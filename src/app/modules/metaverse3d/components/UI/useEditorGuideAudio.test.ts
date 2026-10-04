import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useEditorGuideAudio } from './useEditorGuideAudio';
import type { ExhibitItem } from '../../types';

const mocks = vi.hoisted(() => ({ synthesize: vi.fn(), pause: vi.fn(), play: vi.fn() }));
vi.mock('@/app/api/client', () => ({ loadAuth: () => ({ token: 'test-session' }), buildGuideTtsText: () => 'Artwork guide', requestQwenTts: mocks.synthesize }));
const item: ExhibitItem = { id: 'a', type: 'painting', title: 'A', content: '', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };
beforeEach(() => {
  vi.clearAllMocks(); mocks.play.mockResolvedValue(undefined);
  vi.stubGlobal('Audio', class { pause = mocks.pause; play = mocks.play; currentTime = 0; });
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-audio');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('does not play a late response after selection changes', async () => {
  let resolve!: (blob: Blob) => void;
  mocks.synthesize.mockReturnValue(new Promise<Blob>(done => { resolve = done; }));
  const { result, rerender, unmount } = renderHook(({ selected }) => useEditorGuideAudio(selected), { initialProps: { selected: item } });
  let pending!: Promise<void>;
  act(() => { pending = result.current.playGuideAudio(); });
  expect(result.current.isTtsGenerating).toBe(true);
  rerender({ selected: { ...item, id: 'b' } });
  await act(async () => { resolve(new Blob(['audio'])); await pending; });
  expect(mocks.play).not.toHaveBeenCalled();
  expect(result.current.isTtsGenerating).toBe(false);
  unmount();
});

it('stops audio and releases its object URL when unmounted', async () => {
  mocks.synthesize.mockResolvedValue(new Blob(['audio']));
  const { result, unmount } = renderHook(() => useEditorGuideAudio(item));
  await act(async () => { await result.current.playGuideAudio(); });
  await waitFor(() => expect(result.current.isTtsSpeaking).toBe(true));
  unmount();
  expect(mocks.pause).toHaveBeenCalled();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-audio');
});
