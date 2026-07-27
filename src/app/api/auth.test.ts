import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearAuth, loadAuth, saveAuth } from './auth';

describe('browser auth storage migration', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('keeps the compatibility token in memory and removes legacy persistent values', () => {
    localStorage.setItem('auth_token', 'legacy-token');
    localStorage.setItem('auth_user', '{}');
    sessionStorage.setItem('auth_token', 'legacy-session-token');

    saveAuth({
      token: 'current-token',
      user: { id: 'user-1', email: 'user@example.com', name: 'User' },
    });

    expect(loadAuth()).toMatchObject({ token: 'current-token', user: { id: 'user-1' } });
    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(localStorage.getItem('auth_user')).toBeNull();
    expect(sessionStorage.getItem('auth_token')).toBeNull();
  });

  it('clears memory and invokes the cookie logout endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    saveAuth({
      token: 'current-token',
      user: { id: 'user-1', email: 'user@example.com', name: 'User' },
    });

    clearAuth();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(loadAuth().token).toBeNull();
    expect(fetchMock.mock.calls[0][0]).toContain('/api/auth/logout');
  });
});
