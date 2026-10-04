const translateKey = vi.hoisted(() => (key: string) => key);
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Login from './Login';
import Register from './Register';

const { loginUser, registerUser, loginWithGoogle, saveAuth } = vi.hoisted(() => ({
  loginUser: vi.fn(), registerUser: vi.fn(), loginWithGoogle: vi.fn(), saveAuth: vi.fn(),
}));
vi.mock('../api/client', () => ({ loginUser, registerUser, loginWithGoogle, saveAuth }));
vi.mock('../components/I18nProvider', () => ({ useI18n: () => ({ t: translateKey }) }));
vi.mock('../components/GoogleSignInButton', () => ({
  GoogleSignInButton: ({ onCredential }: { onCredential: (credential: string) => void }) => (
    <button type="button" onClick={() => onCredential('credential')}>Google</button>
  ),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function Destination() {
  const location = useLocation();
  return <p data-testid="destination">{location.pathname + location.search + location.hash}</p>;
}

function renderAuth(page: string, target: string) {
  render(<MemoryRouter initialEntries={[`/${page}?returnTo=${encodeURIComponent(target)}`]}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="*" element={<Destination />} />
    </Routes>
  </MemoryRouter>);
}

const target = '/virtual-gallery?template=%E7%8F%BE%E4%BB%A3%E8%97%9D%E8%A1%93%E7%95%AB%E5%BB%8A';

describe('authentication entry flow', () => {
  beforeEach(() => {
    class Observer { observe() {} unobserve() {} disconnect() {} }
    vi.stubGlobal('ResizeObserver', Observer);
    vi.clearAllMocks();
    const auth = { token: 'test-session', user: { name: 'Teacher' } };
    loginUser.mockResolvedValue(auth);
    registerUser.mockResolvedValue(auth);
    loginWithGoogle.mockResolvedValue(auth);
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it.each(['login', 'register'])('returns to the selected template after Google %s', async (page) => {
    renderAuth(page, target);
    expect(screen.getByText('authContinueExhibition')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'entryDemoAction' })).toHaveAttribute('href', '/demo');
    fireEvent.click(screen.getByRole('button', { name: 'Google' }));
    await waitFor(() => expect(screen.getByTestId('destination')).toHaveTextContent(target));
    expect(saveAuth).toHaveBeenCalled();
  });

  it('keeps the template across login → register and password registration', async () => {
    renderAuth('login', target);
    fireEvent.click(screen.getByRole('link', { name: 'registerNow' }));
    fireEvent.change(screen.getByLabelText('name'), { target: { value: 'Teacher' } });
    fireEvent.change(screen.getByLabelText('email'), { target: { value: 'teacher@example.com' } });
    fireEvent.change(screen.getByLabelText('password'), { target: { value: 'Password123!' } });
    fireEvent.change(screen.getByLabelText('confirmPassword'), { target: { value: 'Password123!' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'createAccount' }));
    await waitFor(() => expect(screen.getByTestId('destination')).toHaveTextContent(target));
    expect(registerUser).toHaveBeenCalledWith({ name: 'Teacher', email: 'teacher@example.com', password: 'Password123!', locale: undefined, returnTo: target });
  });

  it.each(['sent', 'unavailable'])('does not sign in a pending registration with %s delivery', async (deliveryStatus) => {
    registerUser.mockResolvedValue({ verificationRequired: true, email: 'teacher@example.com', deliveryStatus });
    renderAuth('register', target);
    fireEvent.change(screen.getByLabelText('name'), { target: { value: 'Teacher' } });
    fireEvent.change(screen.getByLabelText('email'), { target: { value: 'teacher@example.com' } });
    fireEvent.change(screen.getByLabelText('password'), { target: { value: 'Password123!' } });
    fireEvent.change(screen.getByLabelText('confirmPassword'), { target: { value: 'Password123!' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.submit(screen.getByLabelText('password').closest('form')!);
    await waitFor(() => expect(screen.getByTestId('destination')).toHaveTextContent(`/verify-email?returnTo=${encodeURIComponent(target)}`));
    expect(saveAuth).not.toHaveBeenCalled();
  });

  it('routes unverified login to verification without creating a session', async () => {
    loginUser.mockRejectedValue(Object.assign(new Error('Verify email'), { code: 'EMAIL_VERIFICATION_REQUIRED' }));
    renderAuth('login', target);
    fireEvent.change(screen.getByLabelText('email'), { target: { value: 'teacher@example.com' } });
    fireEvent.change(screen.getByLabelText('password'), { target: { value: 'Password123!' } });
    fireEvent.submit(screen.getByLabelText('password').closest('form')!);
    await waitFor(() => expect(screen.getByTestId('destination')).toHaveTextContent('/verify-email'));
    expect(saveAuth).not.toHaveBeenCalled();
  });

  it('keeps quick-create across register → login and password login', async () => {
    renderAuth('register', '/virtual-gallery/quick-create');
    fireEvent.click(screen.getByRole('link', { name: 'loginNow' }));
    fireEvent.change(screen.getByLabelText('email'), { target: { value: 'teacher@example.com' } });
    fireEvent.change(screen.getByLabelText('password'), { target: { value: 'Password123!' } });
    fireEvent.submit(screen.getByLabelText('password').closest('form')!);
    await waitFor(() => expect(screen.getByTestId('destination')).toHaveTextContent('/virtual-gallery/quick-create'));
    expect(loginUser).toHaveBeenCalled();
  });

  it.each(['login', 'register'])('does not redirect externally after %s', async (page) => {
    renderAuth(page, 'https://evil.example');
    fireEvent.click(screen.getByRole('button', { name: 'Google' }));
    await waitFor(() => expect(screen.getByTestId('destination').textContent).toBe('/'));
  });

  it('explains existing gallery access without promising creation or edit permission', () => {
    renderAuth('login', '/virtual-gallery/create?exhibitionId=c96a39b9-85d1-4207-a71e-636338c7ba1a&share=view');
    expect(screen.getByText('entryAuthOpenGallery')).toBeInTheDocument();
    expect(screen.queryByText('authContinueExhibition')).not.toBeInTheDocument();
    expect(screen.queryByText('authKeepSelection')).not.toBeInTheDocument();
  });
});
