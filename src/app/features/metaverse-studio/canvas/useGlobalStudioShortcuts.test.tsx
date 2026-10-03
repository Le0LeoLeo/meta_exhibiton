import { cleanup, fireEvent, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useGlobalStudioShortcuts } from './useGlobalStudioShortcuts';

afterEach(cleanup);

describe('studio history shortcuts', () => {
  it.each([false, true])('does not undo or redo while viewing (shift=%s)', (shiftKey) => {
    const undo = vi.fn();
    const redo = vi.fn();
    renderHook(() => useGlobalStudioShortcuts({ mode: 'view', isAiParticipation: false, undo, redo }));
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey });
    fireEvent.keyDown(window, { key: 'z', metaKey: true, shiftKey });
    expect(undo).not.toHaveBeenCalled();
    expect(redo).not.toHaveBeenCalled();
  });

  it.each(['edit', 'floor-plan'] as const)('preserves history shortcuts in %s', (mode) => {
    const undo = vi.fn();
    const redo = vi.fn();
    renderHook(() => useGlobalStudioShortcuts({ mode, isAiParticipation: false, undo, redo }));
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'z', metaKey: true, shiftKey: true });
    expect(undo).toHaveBeenCalledOnce();
    expect(redo).toHaveBeenCalledOnce();
  });
});
