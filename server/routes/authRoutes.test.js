import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AVATAR_APPEARANCE } from '../schemas/avatarAppearanceSchema.js';
import { registerAuthRoutes } from './authRoutes.js';

const servers = [];

describe('password reset routes', () => {
  it('accepts normalized addresses identically without disclosing account or delivery state', async () => {
    const passwordReset = { enabled: true, request: vi.fn(() => true) };
    const { baseUrl } = await startApp({ passwordReset });
    for (const email of ['Known@example.com', 'unknown@example.com']) {
      const result = await fetch(`${baseUrl}/api/auth/password-reset/request`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) });
      expect(result.status).toBe(202); expect(await result.json()).toEqual({ accepted: true }); expect(result.headers.get('cache-control')).toBe('no-store');
    }
    expect(passwordReset.request).toHaveBeenCalledWith('known@example.com', undefined);
  });
  it('validates inputs, reports unavailable delivery configuration and consumes only POST', async () => {
    const passwordReset = { enabled: true, request: vi.fn(() => true), confirm: vi.fn() };
    const { baseUrl } = await startApp({ passwordReset });
    expect((await fetch(`${baseUrl}/api/auth/password-reset/confirm`)).status).toBe(404);
    const post = (body) => fetch(`${baseUrl}/api/auth/password-reset/confirm`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    expect((await post({ token: 'a'.repeat(43), password: '密'.repeat(25) })).status).toBe(400);
    expect(passwordReset.confirm).not.toHaveBeenCalled();
    passwordReset.enabled = false; expect((await post({})).status).toBe(503);
  });
  it('revokes sockets after successful reset, issues no login token and handles invalid/rejected resets', async () => {
    const passwordReset = { enabled: true, confirm: vi.fn().mockResolvedValueOnce({ id: 'u' }).mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('private database detail')) };
    const revokeUserSessions = vi.fn().mockResolvedValue(undefined);
    const { baseUrl, deps } = await startApp({ passwordReset, revokeUserSessions });
    const post = () => fetch(`${baseUrl}/api/auth/password-reset/confirm`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: 'a'.repeat(43), password: 'new-password' }) });
    expect((await post()).status).toBe(200); expect(revokeUserSessions).toHaveBeenCalledWith('u'); expect(deps.signToken).not.toHaveBeenCalled();
    expect((await post()).status).toBe(400); expect((await post()).status).toBe(503);
  });
});

afterEach(() => {
  while (servers.length) servers.pop().close();
  vi.restoreAllMocks();
});

async function startApp(overrides = {}) {
  const deps = {
    requireAuth: () => ({ sub: 'user-1' }),
    signToken: vi.fn(() => 'signed-session-token'),
    createCsrfToken: vi.fn(() => 'nonce.signature'),
    exportUserData: vi.fn().mockResolvedValue({
      schemaVersion: 1,
      profile: { id: 'user-1', email: 'user@example.com', name: 'User' },
    }),
    deleteAccountWithCleanup: vi.fn().mockResolvedValue({ cleanupPending: false, cleanupJobs: 3 }),
    listMediaStorageFileNamesByOwnerId: vi.fn().mockResolvedValue([
      '00000000-0000-4000-8000-000000000001.jpg',
    ]),
    deleteMediaFiles: vi.fn().mockResolvedValue(undefined),
    listGrowthAssetContentUrlsByOwnerId: vi.fn().mockResolvedValue([
      '/uploads/growth/one.png',
      '/uploads/growth/two.mp4',
    ]),
    deleteGrowthAssetFiles: vi.fn().mockResolvedValue(undefined),
    updateUserAvatarAppearance: vi.fn().mockResolvedValue({ changes: 1 }),
    ...overrides,
  };
  const app = express();
  app.use(express.json());
  registerAuthRoutes(app, deps);
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  servers.push(server);
  return { baseUrl: `http://127.0.0.1:${server.address().port}`, deps };
}

describe('browser session cookies', () => {
  it('registers pending verification without issuing a session, including mail outages', async () => {
    const { baseUrl, deps } = await startApp({
      getUserByEmail: vi.fn().mockResolvedValue(null), insertUser: vi.fn(),
      emailVerification: { enabled: true, send: vi.fn().mockResolvedValue('unavailable') },
    });
    const response = await fetch(`${baseUrl}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'User@example.com', password: 'password123' }) });
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ verificationRequired: true, email: 'user@example.com', deliveryStatus: 'unavailable' });
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(deps.signToken).not.toHaveBeenCalled();
    expect(deps.insertUser).toHaveBeenCalled();
  });

  it('requires email confirmation after a correct password and allows a verified account', async () => {
    const row = { id: 'u', email: 'user@example.com', name: 'User', password_hash: await import('bcryptjs').then(({ default: bcrypt }) => bcrypt.hash('password123', 4)) };
    const { baseUrl } = await startApp({ getUserByEmail: async () => row, emailVerification: { enabled: true } });
    const login = () => fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: row.email, password: 'password123' }) });
    const blocked = await login();
    expect(blocked.status).toBe(403);
    expect(await blocked.json()).toMatchObject({ code: 'EMAIL_VERIFICATION_REQUIRED', email: row.email });
    expect(blocked.headers.get('set-cookie')).toBeNull();
    row.email_verified_at = '2026-09-05T00:00:00.000Z';
    expect((await login()).status).toBe(200);
  });

  it('authenticates resend, reports actual delivery accurately, and never consumes links with GET', async () => {
    const row = { id: 'u', email: 'user@example.com', password_hash: await import('bcryptjs').then(({ default: bcrypt }) => bcrypt.hash('password123', 4)) };
    const service = { enabled: true, send: vi.fn().mockResolvedValue('sent'), confirm: vi.fn().mockResolvedValue(true) };
    const { baseUrl } = await startApp({ getUserByEmail: async () => row, emailVerification: service });
    const send = (password) => fetch(`${baseUrl}/api/auth/verification/send`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: row.email, password }) });
    expect(await (await send('wrong')).json()).toMatchObject({ deliveryStatus: 'accepted' });
    expect(service.send).not.toHaveBeenCalled();
    expect(await (await send('password123')).json()).toMatchObject({ deliveryStatus: 'sent' });
    service.send.mockResolvedValueOnce('cooldown');
    expect(await (await send('password123')).json()).toMatchObject({ deliveryStatus: 'accepted' });
    service.send.mockResolvedValueOnce('unavailable');
    expect((await send('password123')).status).toBe(503);
    expect((await fetch(`${baseUrl}/api/auth/verification/confirm?token=raw`)).status).toBe(404);
    expect(service.confirm).not.toHaveBeenCalled();
    const confirmed = await fetch(`${baseUrl}/api/auth/verification/confirm`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: 'raw' }) });
    expect(await confirmed.json()).toEqual({ ok: true });
    expect(confirmed.headers.get('set-cookie')).toBeNull();
  });

  it('removes a preclaimed password when a verified Google account links while verification is enforced', async () => {
    const row = { id: 'u', email: 'user@example.com', name: 'User', password_hash: 'preclaimed', session_version: 2 };
    const { baseUrl, deps } = await startApp({
      emailVerification: { enabled: true }, verifyGoogleCredential: async () => ({ subject: 'google-u', email: row.email }),
      getUserByGoogleSubject: async () => null, getUserByEmail: async () => row,
      updateUserPasswordHash: vi.fn(), revokeUserSessions: vi.fn().mockResolvedValue(),
      linkGoogleSubject: async () => ({ changes: 1 }), markEmailVerified: vi.fn(),
    });
    const response = await fetch(`${baseUrl}/api/auth/google`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ credential: 'google-credential' }) });
    expect(response.status).toBe(200);
    expect(deps.updateUserPasswordHash).toHaveBeenCalledWith('u', expect.not.stringContaining('preclaimed'));
    expect(deps.revokeUserSessions).toHaveBeenCalledWith('u');
    expect(deps.markEmailVerified).toHaveBeenCalledWith('u');
    expect(deps.signToken).toHaveBeenCalledWith(expect.objectContaining({ id: 'u' }), 3);
  });

  it('sets session and CSRF cookies after login', async () => {
    const { baseUrl } = await startApp({
      getUserByEmail: vi.fn().mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        name: 'User',
        password_hash: await import('bcryptjs').then(({ default: bcrypt }) => bcrypt.hash('password123', 4)),
      }),
    });

    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'password123' }),
    });
    const cookies = res.headers.get('set-cookie');

    expect(res.status).toBe(200);
    expect(cookies).toContain('mrei_session=signed-session-token');
    expect(cookies).toContain('HttpOnly');
    expect(cookies).toContain('mrei_csrf=nonce.signature');
  });

  it('clears both browser cookies on logout', async () => {
    const { baseUrl } = await startApp();
    const res = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST' });
    const cookies = res.headers.get('set-cookie');

    expect(res.status).toBe(200);
    expect(cookies).toContain('mrei_session=');
    expect(cookies).toContain('mrei_csrf=');
    expect(cookies).toContain('Max-Age=0');
  });

  it('refreshes browser and compatibility tokens from the session-backed me route', async () => {
    const { baseUrl } = await startApp({
      getUserById: vi.fn().mockResolvedValue({
        id: 'user-1', email: 'user@example.com', name: 'User',
      }),
    });
    const res = await fetch(`${baseUrl}/api/auth/me`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      token: 'signed-session-token',
      user: {
        id: 'user-1',
        email: 'user@example.com',
        name: 'User',
        avatarAppearance: DEFAULT_AVATAR_APPEARANCE,
      },
    });
    expect(res.headers.get('set-cookie')).toContain('mrei_session=signed-session-token');
  });
});

describe('POST /api/auth/google', () => {
  it('reports that Google login is disabled when no verifier is configured', async () => {
    const { baseUrl } = await startApp();

    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ credential: 'google-id-token' }),
    });

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ message: 'Google login is not configured' });
  });

  it.each(['', 'x'.repeat(10_001)])('rejects an invalid credential payload', async (credential) => {
    const verifyGoogleCredential = vi.fn();
    const { baseUrl } = await startApp({ verifyGoogleCredential });

    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ credential }),
    });

    expect(res.status).toBe(400);
    expect(verifyGoogleCredential).not.toHaveBeenCalled();
  });

  it('signs in an account that is already linked to the Google subject', async () => {
    const linkedUser = {
      id: 'user-1',
      email: 'user@example.com',
      name: 'Existing User',
      google_subject: 'google-subject-1',
      session_version: 2,
    };
    const getUserByEmail = vi.fn();
    const linkGoogleSubject = vi.fn();
    const { baseUrl, deps } = await startApp({
      verifyGoogleCredential: vi.fn().mockResolvedValue({
        subject: 'google-subject-1', email: 'user@example.com', name: 'Google User',
      }),
      getUserByGoogleSubject: vi.fn().mockResolvedValue(linkedUser),
      getUserByEmail,
      linkGoogleSubject,
    });

    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ credential: 'google-id-token' }),
    });

    expect(res.status).toBe(200);
    expect(deps.signToken).toHaveBeenCalledWith(expect.objectContaining({ id: 'user-1' }), 2);
    expect(getUserByEmail).not.toHaveBeenCalled();
    expect(linkGoogleSubject).not.toHaveBeenCalled();
    const cookies = res.headers.get('set-cookie');
    expect(cookies).toContain('mrei_session=signed-session-token');
    expect(cookies).toContain('mrei_csrf=nonce.signature');
  });

  it('links a verified Google identity to an existing email account', async () => {
    const existingUser = {
      id: 'user-1',
      email: 'user@example.com',
      name: 'Existing User',
      google_subject: null,
    };
    const { baseUrl, deps } = await startApp({
      verifyGoogleCredential: vi.fn().mockResolvedValue({
        subject: 'google-subject-1',
        email: 'user@example.com',
        name: 'Google User',
      }),
      getUserByGoogleSubject: vi.fn().mockResolvedValue(null),
      getUserByEmail: vi.fn().mockResolvedValue(existingUser),
      linkGoogleSubject: vi.fn().mockResolvedValue({ changes: 1 }),
    });

    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ credential: 'google-id-token' }),
    });

    expect(res.status).toBe(200);
    expect(deps.linkGoogleSubject).toHaveBeenCalledWith('user-1', 'google-subject-1');
    expect((await res.json()).user).toMatchObject({
      id: 'user-1',
      email: 'user@example.com',
      name: 'Existing User',
    });
  });

  it('creates an account for a new verified Google identity', async () => {
    const { baseUrl, deps } = await startApp({
      verifyGoogleCredential: vi.fn().mockResolvedValue({
        subject: 'google-subject-2',
        email: 'new@example.com',
        name: 'New User',
      }),
      getUserByGoogleSubject: vi.fn().mockResolvedValue(null),
      getUserByEmail: vi.fn().mockResolvedValue(null),
      insertUser: vi.fn().mockResolvedValue(undefined),
    });

    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ credential: 'google-id-token' }),
    });

    expect(res.status).toBe(200);
    expect(deps.insertUser).toHaveBeenCalledWith(expect.objectContaining({
      email: 'new@example.com',
      name: 'New User',
      googleSubject: 'google-subject-2',
      passwordHash: expect.any(String),
    }));
    expect(res.headers.get('set-cookie')).toContain('mrei_session=signed-session-token');
  });

  it('rejects an invalid Google credential', async () => {
    const { baseUrl } = await startApp({
      verifyGoogleCredential: vi.fn().mockRejectedValue(new Error('invalid audience')),
    });

    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ credential: 'wrong-token' }),
    });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ message: 'Invalid Google credential' });
  });

  it('does not relink an email account already bound to another Google subject', async () => {
    const linkGoogleSubject = vi.fn();
    const { baseUrl } = await startApp({
      verifyGoogleCredential: vi.fn().mockResolvedValue({
        subject: 'new-google-subject', email: 'user@example.com', name: 'Google User',
      }),
      getUserByGoogleSubject: vi.fn().mockResolvedValue(null),
      getUserByEmail: vi.fn().mockResolvedValue({
        id: 'user-1', email: 'user@example.com', name: 'Existing User',
        google_subject: 'existing-google-subject',
      }),
      linkGoogleSubject,
    });

    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ credential: 'google-id-token' }),
    });

    expect(res.status).toBe(409);
    expect(linkGoogleSubject).not.toHaveBeenCalled();
  });
});

describe('PUT /api/users/me/avatar', () => {
  it('persists a validated canonical avatar appearance', async () => {
    const appearance = {
      ...DEFAULT_AVATAR_APPEARANCE,
      hair: 'hair02',
      top: 'top03',
      accessory: 'glasses01',
      facialPlacement: {
        eyes: { offsetY: 0.04, spacing: 0.03, scale: 1.2 },
        eyebrows: { offsetY: -0.02, spacing: 0.01, rotation: 0.18 },
        mouth: { offsetX: -0.03, offsetY: 0.02, scaleX: 1.25, scaleY: 0.85 },
      },
    };
    let storedAppearance = JSON.stringify(DEFAULT_AVATAR_APPEARANCE);
    const { baseUrl, deps } = await startApp({
      updateUserAvatarAppearance: vi.fn().mockImplementation(async (_userId, json) => {
        storedAppearance = json;
        return { changes: 1 };
      }),
      getUserById: vi.fn().mockImplementation(async () => ({
        id: 'user-1',
        email: 'user@example.com',
        name: 'User',
        avatar_appearance_json: storedAppearance,
      })),
    });

    const res = await fetch(`${baseUrl}/api/users/me/avatar`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(appearance),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ avatarAppearance: appearance });
    expect(deps.updateUserAvatarAppearance).toHaveBeenCalledWith(
      'user-1',
      JSON.stringify(appearance),
    );

    const meRes = await fetch(`${baseUrl}/api/auth/me`);
    expect(meRes.status).toBe(200);
    expect((await meRes.json()).user.avatarAppearance).toEqual(appearance);
  });

  it('canonicalizes a custom shirt color before persisting and returning it', async () => {
    const submittedAppearance = {
      ...DEFAULT_AVATAR_APPEARANCE,
      colors: {
        ...DEFAULT_AVATAR_APPEARANCE.colors,
        topCustom: '#3a7bd5',
      },
    };
    const canonicalAppearance = {
      ...submittedAppearance,
      colors: {
        ...submittedAppearance.colors,
        topCustom: '#3A7BD5',
      },
    };
    let storedAppearance = JSON.stringify(DEFAULT_AVATAR_APPEARANCE);
    const { baseUrl, deps } = await startApp({
      updateUserAvatarAppearance: vi.fn().mockImplementation(async (_userId, json) => {
        storedAppearance = json;
        return { changes: 1 };
      }),
      getUserById: vi.fn().mockImplementation(async () => ({
        id: 'user-1',
        email: 'user@example.com',
        name: 'User',
        avatar_appearance_json: storedAppearance,
      })),
    });

    const res = await fetch(`${baseUrl}/api/users/me/avatar`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(submittedAppearance),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ avatarAppearance: canonicalAppearance });
    expect(deps.updateUserAvatarAppearance).toHaveBeenCalledWith('user-1', expect.any(String));
    expect(JSON.parse(storedAppearance)).toEqual(canonicalAppearance);

    const meRes = await fetch(`${baseUrl}/api/auth/me`);
    expect(meRes.status).toBe(200);
    expect((await meRes.json()).user.avatarAppearance).toEqual(canonicalAppearance);
  });

  it('rejects out-of-range facial placement without overwriting the saved appearance', async () => {
    const savedAppearance = {
      ...DEFAULT_AVATAR_APPEARANCE,
      facialPlacement: {
        ...DEFAULT_AVATAR_APPEARANCE.facialPlacement,
        eyes: { offsetY: 0.05, spacing: 0.02, scale: 1.1 },
      },
    };
    const updateUserAvatarAppearance = vi.fn().mockResolvedValue({ changes: 1 });
    const { baseUrl } = await startApp({
      updateUserAvatarAppearance,
      getUserById: vi.fn().mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        name: 'User',
        avatar_appearance_json: JSON.stringify(savedAppearance),
      }),
    });

    const res = await fetch(`${baseUrl}/api/users/me/avatar`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...savedAppearance,
        facialPlacement: {
          ...savedAppearance.facialPlacement,
          eyes: { ...savedAppearance.facialPlacement.eyes, offsetY: 0.101 },
        },
      }),
    });

    expect(res.status).toBe(400);
    expect(updateUserAvatarAppearance).not.toHaveBeenCalled();

    const meRes = await fetch(`${baseUrl}/api/auth/me`);
    expect((await meRes.json()).user.avatarAppearance).toEqual(savedAppearance);
  });

  it('returns neutral facial placement for legacy database JSON', async () => {
    const legacyAppearance = { ...DEFAULT_AVATAR_APPEARANCE };
    delete legacyAppearance.facialPlacement;
    const { baseUrl } = await startApp({
      getUserById: vi.fn().mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        name: 'User',
        avatar_appearance_json: JSON.stringify(legacyAppearance),
      }),
    });

    const res = await fetch(`${baseUrl}/api/auth/me`);

    expect(res.status).toBe(200);
    expect((await res.json()).user.avatarAppearance).toEqual(DEFAULT_AVATAR_APPEARANCE);
  });

  it('rejects unknown fields and arbitrary asset URLs', async () => {
    const { baseUrl, deps } = await startApp();
    const res = await fetch(`${baseUrl}/api/users/me/avatar`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...DEFAULT_AVATAR_APPEARANCE,
        modelUrl: 'https://example.com/untrusted.glb',
      }),
    });

    expect(res.status).toBe(400);
    expect(deps.updateUserAvatarAppearance).not.toHaveBeenCalled();
  });

  it('returns 404 when the authenticated account no longer exists', async () => {
    const { baseUrl } = await startApp({
      updateUserAvatarAppearance: vi.fn().mockResolvedValue({ changes: 0 }),
    });
    const res = await fetch(`${baseUrl}/api/users/me/avatar`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(DEFAULT_AVATAR_APPEARANCE),
    });

    expect(res.status).toBe(404);
  });

  it('requires an authenticated account', async () => {
    const { baseUrl, deps } = await startApp({
      requireAuth: (_req, res) => {
        res.status(401).json({ message: 'authentication required' });
        return null;
      },
    });
    const res = await fetch(`${baseUrl}/api/users/me/avatar`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(DEFAULT_AVATAR_APPEARANCE),
    });

    expect(res.status).toBe(401);
    expect(deps.updateUserAvatarAppearance).not.toHaveBeenCalled();
  });
});

describe('GET /api/users/me/export', () => {
  it('returns an authenticated JSON attachment that must not be cached', async () => {
    const { baseUrl, deps } = await startApp();
    const res = await fetch(`${baseUrl}/api/users/me/export`);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.headers.get('content-disposition')).toBe(
      'attachment; filename="personal-data.json"',
    );
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({
      schemaVersion: 1,
      profile: { id: 'user-1', email: 'user@example.com', name: 'User' },
    });
    expect(deps.exportUserData).toHaveBeenCalledWith('user-1');
  });

  it('returns 404 when the authenticated account no longer exists', async () => {
    const { baseUrl } = await startApp({ exportUserData: vi.fn().mockResolvedValue(null) });
    const res = await fetch(`${baseUrl}/api/users/me/export`);

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/users/me', () => {
  it('removes private growth and gallery media after deleting the account data', async () => {
    const { baseUrl, deps } = await startApp();
    const res = await fetch(`${baseUrl}/api/users/me`, { method: 'DELETE' });

    expect(res.status).toBe(200);
    expect(deps.listGrowthAssetContentUrlsByOwnerId).toHaveBeenCalledWith('user-1');
    expect(deps.listMediaStorageFileNamesByOwnerId).toHaveBeenCalledWith('user-1');
    expect(deps.deleteAccountWithCleanup).toHaveBeenCalledWith({
      ownerId: 'user-1',
      growthAssetUrls: ['/uploads/growth/one.png', '/uploads/growth/two.mp4'],
      mediaFileNames: ['00000000-0000-4000-8000-000000000001.jpg'],
      deleteGrowthAssetFiles: deps.deleteGrowthAssetFiles,
      deleteMediaFiles: deps.deleteMediaFiles,
    });
  });

  it('still completes account deletion when an orphan file cannot be removed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { baseUrl, deps } = await startApp({
      deleteAccountWithCleanup: vi.fn().mockResolvedValue({ cleanupPending: true, cleanupJobs: 3 }),
    });
    const res = await fetch(`${baseUrl}/api/users/me`, { method: 'DELETE' });

    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ ok: true, cleanupPending: true, cleanupJobs: 3 });
    expect(deps.deleteAccountWithCleanup).toHaveBeenCalledOnce();
  });

  it('still completes account deletion when gallery media cleanup fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { baseUrl, deps } = await startApp({
      deleteAccountWithCleanup: vi.fn().mockResolvedValue({ cleanupPending: true, cleanupJobs: 3 }),
    });
    const res = await fetch(`${baseUrl}/api/users/me`, { method: 'DELETE' });

    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ ok: true, cleanupPending: true, cleanupJobs: 3 });
    expect(deps.deleteAccountWithCleanup).toHaveBeenCalledOnce();
  });
});
