import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ReleaseRecovery, RecoveryActions } from './ReleaseRecovery';
import { captureRecoveryScene, registerRecoveryScene } from '@/app/utils/releaseRecovery';
vi.mock('./I18nProvider', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
afterEach(() => { cleanup(); const clear = registerRecoveryScene(() => null); clear(); vi.restoreAllMocks(); });
it('shows preload failure without forcing a reload and allows dismissal', () => {
  render(<ReleaseRecovery />); fireEvent(window, new Event('vite:preloadError'));
  expect(screen.getByRole('region', { name: 'updateTitle' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'updateLater' })); expect(screen.queryByRole('region')).not.toBeInTheDocument();
});
it('retains a scene after the editor unmounts and requires a copy before reloading', () => {
  const release = registerRecoveryScene(() => ({ items: [{ id: 'unsaved' }] })); captureRecoveryScene(); release();
  const create = vi.fn(() => 'blob:copy'); vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() }));
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  const reload = vi.fn(); render(<RecoveryActions reload={reload} />);
  fireEvent.click(screen.getByRole('button', { name: 'updateReload' })); expect(create).toHaveBeenCalledOnce(); expect(reload).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'updateReload' })); expect(reload).toHaveBeenCalledOnce();
});
it('blocks reload when the scene cannot be exported', () => {
  registerRecoveryScene(() => { throw new Error('storage failure'); });
  const reload = vi.fn(); render(<RecoveryActions reload={reload} />);
  fireEvent.click(screen.getByRole('button', { name: 'updateReload' })); expect(screen.getByRole('alert')).toHaveTextContent('updateDownloadFailed'); expect(reload).not.toHaveBeenCalled();
});
