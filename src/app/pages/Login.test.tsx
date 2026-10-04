const translateKey = vi.hoisted(() => (key: string) => key);
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Login from './Login';

const { loginUser } = vi.hoisted(() => ({ loginUser: vi.fn() }));
vi.mock('../api/client', () => ({ loginUser, loginWithGoogle: vi.fn(), saveAuth: vi.fn() }));
vi.mock('../components/I18nProvider', () => ({ useI18n: () => ({ t: translateKey, locale: 'en' }) }));
vi.mock('../components/GoogleSignInButton', () => ({ GoogleSignInButton: () => null }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('Login form feedback', () => {
  beforeEach(() => {
    class Observer { observe() {} unobserve() {} disconnect() {} }
    vi.stubGlobal('ResizeObserver', Observer);
    loginUser.mockReset();
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('shows a failed sign-in next to the form and clears it on edit', async () => {
    loginUser.mockRejectedValue(new Error('Invalid email or password'));
    render(<MemoryRouter initialEntries={['/login']}><Login /></MemoryRouter>);

    const email = screen.getByLabelText('email');
    const password = screen.getByLabelText('password');
    expect(email).toHaveAttribute('autocomplete', 'email');
    expect(password).toHaveAttribute('autocomplete', 'current-password');

    fireEvent.change(email, { target: { value: 'student@example.test' } });
    fireEvent.change(password, { target: { value: 'wrong-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'loginButton' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    fireEvent.change(password, { target: { value: 'another-try' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('links validation messages to their fields', () => {
    render(<MemoryRouter initialEntries={['/login']}><Login /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'loginButton' }));

    const email = screen.getByLabelText('email');
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAccessibleDescription('requiredEmail');
  });
});
