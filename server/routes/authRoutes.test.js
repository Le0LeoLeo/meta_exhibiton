import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerAuthRoutes } from './authRoutes.js';

const servers = [];

afterEach(() => {
  while (servers.length) servers.pop().close();
  vi.restoreAllMocks();
});

async function startApp(overrides = {}) {
  const deps = {
    requireAuth: () => ({ sub: 'user-1' }),
    deleteUserById: vi.fn().mockResolvedValue(undefined),
    listGrowthAssetContentUrlsByOwnerId: vi.fn().mockResolvedValue([
      '/uploads/growth/one.png',
      '/uploads/growth/two.mp4',
    ]),
    deleteGrowthAssetFiles: vi.fn().mockResolvedValue(undefined),
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

describe('DELETE /api/users/me', () => {
  it('removes private growth media after deleting the account data', async () => {
    const { baseUrl, deps } = await startApp();
    const res = await fetch(`${baseUrl}/api/users/me`, { method: 'DELETE' });

    expect(res.status).toBe(200);
    expect(deps.listGrowthAssetContentUrlsByOwnerId).toHaveBeenCalledWith('user-1');
    expect(deps.deleteUserById).toHaveBeenCalledWith('user-1');
    expect(deps.deleteGrowthAssetFiles).toHaveBeenCalledWith([
      '/uploads/growth/one.png',
      '/uploads/growth/two.mp4',
    ]);
    expect(deps.deleteUserById.mock.invocationCallOrder[0]).toBeLessThan(
      deps.deleteGrowthAssetFiles.mock.invocationCallOrder[0],
    );
  });

  it('still completes account deletion when an orphan file cannot be removed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { baseUrl, deps } = await startApp({
      deleteGrowthAssetFiles: vi.fn().mockRejectedValue(new Error('disk unavailable')),
    });
    const res = await fetch(`${baseUrl}/api/users/me`, { method: 'DELETE' });

    expect(res.status).toBe(200);
    expect(deps.deleteUserById).toHaveBeenCalledOnce();
  });
});
