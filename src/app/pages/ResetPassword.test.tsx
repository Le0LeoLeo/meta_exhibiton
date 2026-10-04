import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import ResetPassword from './ResetPassword';
import { confirmPasswordReset, requestPasswordReset } from '@/app/api/passwordReset';
vi.mock('@/app/api/passwordReset', () => ({ confirmPasswordReset: vi.fn(), requestPasswordReset: vi.fn() }));
vi.mock('@/app/api/auth', () => ({ clearAuth: vi.fn() }));
vi.mock('@/app/components/I18nProvider', () => ({ useI18n: () => ({ t: (key: string) => key, locale: 'en' }) }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function show(token = '') { render(<MemoryRouter initialEntries={[`/reset-password${token ? '#token=' + token : ''}`]}><ResetPassword /></MemoryRouter>); }
function passwords(a = 'new-password', b = a) {
  fireEvent.change(screen.getByLabelText('resetPassword'), { target: { value: a } });
  fireEvent.change(screen.getByLabelText('resetConfirm'), { target: { value: b } });
  fireEvent.click(screen.getByRole('button', { name: 'resetSubmit' }));
}
it('requests a link and shows a generic acknowledgment with a retry cooldown', async () => {
  show(); fireEvent.change(screen.getByLabelText('email'), { target: { value: 'user@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'resetSend' }));
  expect(await screen.findByRole('status')).toHaveTextContent('resetAccepted');
  expect(requestPasswordReset).toHaveBeenCalledWith('user@example.com', 'en');
  expect(screen.getByRole('button', { name: 'resetCooldown' })).toBeDisabled();
});
it('requires matching passwords and never automatically consumes a link', async () => {
  show('a'.repeat(43)); expect(confirmPasswordReset).not.toHaveBeenCalled();
  passwords('new-password', 'different-password');
  expect(screen.getByRole('alert')).toHaveTextContent('resetMismatch'); expect(confirmPasswordReset).not.toHaveBeenCalled();
  passwords(); expect(await screen.findByRole('status')).toHaveTextContent('resetDone');
  expect(confirmPasswordReset).toHaveBeenCalledWith('a'.repeat(43), 'new-password', 'en');
  expect(screen.queryByLabelText('resetPassword')).not.toBeInTheDocument();
});
it('distinguishes expired links from network failures and preserves retry inputs', async () => {
  vi.mocked(confirmPasswordReset).mockRejectedValueOnce(Object.assign(new Error(), { code: 'INVALID_RESET_TOKEN' })).mockRejectedValueOnce(new Error('offline'));
  show('a'.repeat(43)); passwords();
  expect(await screen.findByRole('alert')).toHaveTextContent('resetInvalid');
  expect(screen.getByRole('link', { name: 'resetNewLink' })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('button', { name: 'resetSubmit' })).toBeEnabled()); passwords();
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('resetRetry'));
  expect(screen.getByLabelText('resetPassword')).toHaveValue('new-password');
});
it('explains when email reset is not configured instead of blaming the connection', async () => {
  vi.mocked(requestPasswordReset).mockRejectedValue(Object.assign(new Error('unavailable'), { status: 503, code: 'RESET_UNAVAILABLE' }));
  show(); fireEvent.change(screen.getByLabelText('email'), { target: { value: 'user@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'resetSend' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('resetUnavailable'));
});
