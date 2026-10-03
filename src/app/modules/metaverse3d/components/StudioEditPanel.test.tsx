import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { StudioEditPanel } from './StudioEditPanel';
import { useMetaverseStudioStore } from '../store/useMetaverseStudioStore';

afterEach(cleanup);
it('can leave and re-enter editing without changing the Hooks call order', () => {
  const original = useMetaverseStudioStore.getState();
  try {
    useMetaverseStudioStore.setState({ mode: 'edit', items: [], selectedItemId: null });
    const { container } = render(<StudioEditPanel />);
    expect(container.childElementCount).toBeGreaterThan(0);
    act(() => useMetaverseStudioStore.setState({ mode: 'view' }));
    expect(container.childElementCount).toBe(0);
    act(() => useMetaverseStudioStore.setState({ mode: 'edit' }));
    expect(container.childElementCount).toBeGreaterThan(0);
  } finally { useMetaverseStudioStore.setState(original, true); }
});
