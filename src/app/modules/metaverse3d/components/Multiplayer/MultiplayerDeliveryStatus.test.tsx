import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/app/components/I18nProvider';
import { registerRecoveryScene, downloadRecoveryScene } from '@/app/utils/releaseRecovery';
import { useSceneDeliveryStore } from '../../network/sceneDeliveryMonitor';
import { MultiplayerDeliveryStatus } from './MultiplayerDeliveryStatus';
import { clearReconnectDraft, useReconnectDraftStore } from '../../network/reconnectDraftStore';
import { useMultiplayerStore } from '../../network/multiplayerStore';
import { useStore } from '../../store/useStore';
vi.mock('@/app/utils/releaseRecovery', async importOriginal => ({
  ...await importOriginal<typeof import('@/app/utils/releaseRecovery')>(), downloadRecoveryScene: vi.fn(),
}));
beforeEach(() => { clearReconnectDraft(); localStorage.setItem('metaexpo-locale', 'en'); vi.clearAllMocks(); });
afterEach(() => { cleanup(); localStorage.clear(); useSceneDeliveryStore.setState({ pendingCount: 0, delayed: false }); });
const show = () => render(<I18nProvider><MultiplayerDeliveryStatus /></I18nProvider>);
it('stays quiet when settled and labels waiting without claiming a durable save', () => {
  useSceneDeliveryStore.setState({ pendingCount: 0, delayed: false });
  const view = show(); expect(view.container).toBeEmptyDOMElement();
  view.unmount(); useSceneDeliveryStore.setState({ pendingCount: 1, delayed: false }); show();
  expect(screen.getByRole('status')).toHaveTextContent('Waiting for collaboration confirmation');
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
it('downloads the current recovery scene without reloading or clearing pending edits', () => {
  useSceneDeliveryStore.setState({ pendingCount: 1, delayed: true });
  const unregister = registerRecoveryScene(() => ({ title: 'Current work' }));
  show(); expect(screen.getByRole('alert')).toHaveTextContent('New updates are paused');
  fireEvent.click(screen.getByRole('button', { name: 'Download scene copy' }));
  expect(downloadRecoveryScene).toHaveBeenCalledWith(JSON.stringify({ title: 'Current work' }, null, 2));
  expect(useSceneDeliveryStore.getState().delayed).toBe(true); unregister();
});
it('keeps the page open and reports a failed export', () => {
  useSceneDeliveryStore.setState({ pendingCount: 1, delayed: true });
  const unregister = registerRecoveryScene(() => { throw new Error('Unavailable'); }); show();
  fireEvent.click(screen.getByRole('button', { name: 'Download scene copy' }));
  expect(screen.getByText('Could not prepare the scene copy. Keep this page open and try again.')).toBeVisible();
  expect(downloadRecoveryScene).not.toHaveBeenCalled(); unregister();
});

it('offers a local copy while disconnected, then requires a deliberate choice after reconnect', () => {
  const base = useStore.getState().exportScene();
  useReconnectDraftStore.setState({ draft: { roomId: 'gallery-1', base, remote: null, uncertain: true } });
  useMultiplayerStore.setState({ connected: false, role: null });
  const view = show();
  expect(screen.getAllByRole('button')).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Download scene copy' })).toBeVisible();
  view.unmount();
  useReconnectDraftStore.setState({ draft: { roomId: 'gallery-1', base, remote: base, uncertain: true } });
  useMultiplayerStore.setState({ connected: true, role: 'viewer' });
  show();
  const buttons = screen.getAllByRole('button');
  expect(buttons).toHaveLength(3);
  expect(buttons[1]).toBeDisabled();
  expect(useReconnectDraftStore.getState().decision).toBeNull();
  fireEvent.click(buttons[2]);
  expect(useReconnectDraftStore.getState().decision).toBe('remote');
  cleanup(); clearReconnectDraft();
});
