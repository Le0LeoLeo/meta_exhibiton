import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AVATAR_APPEARANCE } from '../modules/metaverse3d/avatar/avatarAppearance';
import {
  clearAuth,
  loadAuth,
  loginUser,
  saveAuth,
  updateMyAvatar,
} from './auth';

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
      user: {
        id: 'user-1',
        email: 'user@example.com',
        name: 'User',
        avatarAppearance: DEFAULT_AVATAR_APPEARANCE,
      },
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
      user: {
        id: 'user-1',
        email: 'user@example.com',
        name: 'User',
        avatarAppearance: DEFAULT_AVATAR_APPEARANCE,
      },
    });

    clearAuth();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(loadAuth().token).toBeNull();
    expect(fetchMock.mock.calls[0][0]).toContain('/api/auth/logout');
  });

  it('updates the authenticated avatar through the dedicated endpoint', async () => {
    const appearance = { ...DEFAULT_AVATAR_APPEARANCE, hair: 'hair02' as const };
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ avatarAppearance: appearance }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ));
    vi.stubGlobal('fetch', fetchMock);

    await expect(updateMyAvatar('current-token', appearance)).resolves.toEqual({
      avatarAppearance: appearance,
    });
    expect(fetchMock.mock.calls[0][0]).toContain('/api/users/me/avatar');
    expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify(appearance),
    }));
  });

  it('normalizes missing avatar data at the API boundary', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        token: 'server-token',
        user: { id: 'user-1', email: 'user@example.com', name: 'User' },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )));

    await expect(loginUser({
      email: 'user@example.com',
      password: 'password123',
    })).resolves.toMatchObject({
      user: { avatarAppearance: DEFAULT_AVATAR_APPEARANCE },
    });
  });
});
