import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/app/components/I18nProvider';
import { useMetaverseStudioStore as store } from '@/app/modules/metaverse3d/store/useMetaverseStudioStore';
import DemoParticipation from './DemoParticipation';

vi.mock('@/app/features/metaverse-studio/app/MetaverseStudioApp', () => ({ default: ({ collaborationEnabled, exhibitionId }: { collaborationEnabled: boolean; exhibitionId: string | null }) => <div data-testid="native-studio" data-collaboration={String(collaborationEnabled)} data-gallery={String(exhibitionId)} /> }));
afterEach(cleanup);
beforeEach(() => { localStorage.setItem('metaexpo-locale', 'zh-TW'); });
describe('official native participation entry', () => {
  it.each(['classics', 'garden', 'landscape'])('prepares %s for the original mode selector', async id => {
    render(<MemoryRouter initialEntries={[`/demo/participate?exhibition=${id}&artwork=10`]}><I18nProvider><DemoParticipation /></I18nProvider></MemoryRouter>);
    expect(await screen.findByTestId('native-studio')).toHaveAttribute('data-collaboration', 'false');
    expect(screen.getByTestId('native-studio')).toHaveAttribute('data-gallery', 'null');
    expect(store.getState().mode).toBe('view');
    expect(store.getState().hasSelectedParticipationMode).toBe(false);
    expect(store.getState().allowPointerLock).toBe(false);
    expect(store.getState().items).toHaveLength(11);
    expect(screen.getByRole('link', { name: '退出參觀' })).toHaveAttribute('href', `/demo?exhibition=${id}&artwork=10`);
  });
});
