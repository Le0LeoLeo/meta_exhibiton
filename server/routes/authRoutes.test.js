import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AVATAR_APPEARANCE } from '../schemas/avatarAppearanceSchema.js';
import { registerAuthRoutes } from './authRoutes.js';

const servers = [];

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

describe('PUT /api/users/me/avatar', () => {
  it('persists a validated canonical avatar appearance', async () => {
    const appearance = {
      ...DEFAULT_AVATAR_APPEARANCE,
      hair: 'hair02',
      top: 'top03',
      accessory: 'glasses01',
    };
    const { baseUrl, deps } = await startApp();

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
