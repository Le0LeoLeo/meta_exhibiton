import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Register from './Register';

const { loginWithGoogle, saveAuth } = vi.hoisted(() => ({
  loginWithGoogle: vi.fn(),
  saveAuth: vi.fn(),
}));

vi.mock('../api/client', () => ({
  loginWithGoogle,
  registerUser: vi.fn(),
  saveAuth,
}));
vi.mock('../components/I18nProvider', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('../components/GoogleSignInButton', () => ({
  GoogleSignInButton: ({ onCredential }: { onCredential: (credential: string) => void }) => (
    <button type="button" onClick={() => onCredential('google-credential')}>Google</button>
  ),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }));

describe('Google registration', () => {
  beforeEach(() => {
    class Observer { observe() {} unobserve() {} disconnect() {} }
    vi.stubGlobal('ResizeObserver', Observer);
    loginWithGoogle.mockReset();
    saveAuth.mockReset();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('creates a session through the real Google credential endpoint', async () => {
    loginWithGoogle.mockResolvedValue({ user: { name: 'Google User' }, token: 'session-token' });
    render(<MemoryRouter><Register /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: 'Google' }));

    await waitFor(() => expect(loginWithGoogle).toHaveBeenCalledWith('google-credential'));
    expect(saveAuth).toHaveBeenCalledWith(expect.objectContaining({ token: 'session-token' }), { remember: true });
  });
});
