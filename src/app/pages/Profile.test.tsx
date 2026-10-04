const translateKey = vi.hoisted(() => (key: string) => key);
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Profile from './Profile';

const user = { id: 'user-1', name: 'Student', email: 'student@example.test', avatarAppearance: { hair: 'hair01', top: 'top01', accessory: 'none' } };
const api = vi.hoisted(() => ({ getMe: vi.fn(), changePassword: vi.fn(), updateMyName: vi.fn() }));
vi.mock('../api/client', () => ({
  loadAuth: () => ({ token: 'token', user, source: 'session' }),
  clearAuth: vi.fn(), saveAuth: vi.fn(), deleteMyAccount: vi.fn(), exportMyData: vi.fn(),
  getMe: api.getMe, changePassword: api.changePassword, updateMyName: api.updateMyName,
}));
vi.mock('../components/I18nProvider', () => ({ useI18n: () => ({ t: translateKey, locale: 'en' }) }));
vi.mock('../components/UnsavedChangesProvider', () => ({ useConfirmDiscard: () => () => true }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderProfile() {
  render(<MemoryRouter><Profile /></MemoryRouter>);
}

beforeEach(() => {
  for (const mock of Object.values(api)) mock.mockReset();
  api.getMe.mockResolvedValue({ user });
});
afterEach(cleanup);

describe('Profile form feedback', () => {
  it('marks a mismatched confirmation inline and clears it on edit', async () => {
    renderProfile();
    const current = await screen.findByLabelText('profileCurrentPassword');
    const next = screen.getByLabelText('profileNewPassword');
    const confirm = screen.getByLabelText('profileConfirmNewPassword');
    expect(current).toHaveAttribute('autocomplete', 'current-password');
    expect(next).toHaveAttribute('autocomplete', 'new-password');

    fireEvent.change(current, { target: { value: 'old-password' } });
    fireEvent.change(next, { target: { value: 'new-password-1' } });
    fireEvent.change(confirm, { target: { value: 'new-password-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'updatePassword' }));

    expect(screen.getByRole('alert')).toHaveTextContent('passwordMismatch');
    expect(confirm).toHaveAttribute('aria-invalid', 'true');
    expect(confirm).toHaveFocus();
    expect(api.changePassword).not.toHaveBeenCalled();

    fireEvent.change(confirm, { target: { value: 'new-password-1' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('points a rejected current password at its field', async () => {
    api.changePassword.mockRejectedValue(Object.assign(new Error('current password is incorrect'), { code: 'CURRENT_PASSWORD_INCORRECT' }));
    renderProfile();
    const current = await screen.findByLabelText('profileCurrentPassword');
    fireEvent.change(current, { target: { value: 'wrong-password' } });
    fireEvent.change(screen.getByLabelText('profileNewPassword'), { target: { value: 'new-password-1' } });
    fireEvent.change(screen.getByLabelText('profileConfirmNewPassword'), { target: { value: 'new-password-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'updatePassword' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('currentPasswordIncorrect'));
    expect(current).toHaveAttribute('aria-invalid', 'true');
    expect(current).toHaveFocus();
  });
});
