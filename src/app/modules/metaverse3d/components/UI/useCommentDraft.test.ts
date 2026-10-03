import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { commentDraftKey, readCommentDraft, useCommentDraft } from './useCommentDraft';

describe('comment tab drafts', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('isolates accounts, exhibitions and artworks while restoring the original draft', () => {
    const { result, rerender } = renderHook(({ owner, gallery, artwork }) => useCommentDraft(owner, gallery, artwork), {
      initialProps: { owner: 'user-1' as string | null, gallery: 'gallery-1', artwork: 'art-1' },
    });
    act(() => result.current.setName('Visitor'));
    act(() => result.current.setContent('Private draft'));
    for (const scope of [
      { owner: 'user-2', gallery: 'gallery-1', artwork: 'art-1' },
      { owner: null, gallery: 'gallery-1', artwork: 'art-1' },
      { owner: 'user-1', gallery: 'gallery-2', artwork: 'art-1' },
      { owner: 'user-1', gallery: 'gallery-1', artwork: 'art-2' },
    ]) { rerender(scope); expect(result.current.content).toBe(''); }
    rerender({ owner: 'user-1', gallery: 'gallery-1', artwork: 'art-1' });
    expect(result.current.content).toBe('Private draft');
    expect(readCommentDraft(commentDraftKey('user-1', 'gallery-1', 'art-1'))).toEqual({ name: 'Visitor', content: 'Private draft' });
  });

  it('keeps input available and reports storage failure', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    const { result } = renderHook(() => useCommentDraft(null, 'gallery-1', 'art-1'));
    act(() => result.current.setContent('Still editable'));
    expect(result.current.content).toBe('Still editable');
    expect(result.current.saved).toBe(false);
  });

  it('rejects malformed, oversized and expired records without throwing', () => {
    const key = commentDraftKey('user-1', 'gallery-1', 'art-1');
    for (const raw of ['bad json', JSON.stringify({ name: 'Visitor', content: 'x'.repeat(2001), savedAt: Date.now() }), JSON.stringify({ name: 'Visitor', content: 'Expired', savedAt: Date.now() - 25 * 3600000 })]) {
      sessionStorage.setItem(key, raw);
      expect(readCommentDraft(key)).toEqual({ name: '', content: '' });
    }
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('disabled'); });
    expect(readCommentDraft(key)).toEqual({ name: '', content: '' });
  });

  it('does not erase newer text when an earlier submission finishes', () => {
    const { result } = renderHook(() => useCommentDraft(null, 'gallery-1', 'art-1'));
    act(() => result.current.setName('Visitor'));
    act(() => result.current.setContent('Old text'));
    const completeOld = result.current.clearSubmitted;
    act(() => result.current.setContent('New text'));
    act(() => completeOld('Visitor', 'Old text'));
    expect(result.current.content).toBe('New text');
    expect(readCommentDraft(commentDraftKey(null, 'gallery-1', 'art-1')).content).toBe('New text');
  });
});
