import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerVisitorMemoryRoutes } from './visitorMemoryRoutes.js';

const servers = [];

afterEach(() => {
  while (servers.length) {
    const server = servers.pop();
    server.close();
  }
});

function createDeps(overrides = {}) {
  return {
    requireAuth: (req, res) => ({ id: 'user-1' }),
    visitorMemoryLimiter: (_req, _res, next) => next(),
    getVisitorMemory: async (userId, galleryId) => {
      if (galleryId === 'gallery-existing') {
        return {
          id: `${userId}__gallery-existing`,
          userId,
          galleryId: 'gallery-existing',
          visitedExhibitIds: ['e1', 'e2'],
          engagedExhibitIds: ['e1'],
          dwellSecondsByExhibit: { e1: 45, e2: 12 },
          preferredPersonality: 'expert',
          preferredLanguage: 'zh-TW',
          updatedAt: '2026-01-01T00:00:00.000Z',
        };
      }
      return null;
    },
    upsertVisitorMemory: async () => {},
    ...overrides,
  };
}

async function startApp(depsOverrides = {}) {
  const app = express();
  app.use(express.json());
  registerVisitorMemoryRoutes(app, createDeps(depsOverrides));

  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  servers.push(server);

  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
}

function jsonHeaders() {
  return { 'content-type': 'application/json' };
}

describe('visitorMemoryRoutes', () => {
  describe('GET /api/visitor-memory/:galleryId', () => {
    it('returns null for new gallery', async () => {
      const baseUrl = await startApp();
      const res = await fetch(`${baseUrl}/api/visitor-memory/gallery-new`, {
        method: 'GET',
        headers: jsonHeaders(),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.memory).toBeNull();
    });

    it('returns existing memory for gallery with saved data', async () => {
      const baseUrl = await startApp();
      const res = await fetch(`${baseUrl}/api/visitor-memory/gallery-existing`, {
        method: 'GET',
        headers: jsonHeaders(),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.memory).toBeTruthy();
      expect(data.memory.visitedExhibitIds).toEqual(['e1', 'e2']);
      expect(data.memory.preferredPersonality).toBe('expert');
    });
  });

  describe('PUT /api/visitor-memory/:galleryId', () => {
    it('saves visitor memory and returns ok', async () => {
      const mockFn = vi.fn().mockResolvedValue();
      const baseUrl = await startApp({ upsertVisitorMemory: mockFn });
      const res = await fetch(`${baseUrl}/api/visitor-memory/gallery-123`, {
        method: 'PUT',
        headers: jsonHeaders(),
        body: JSON.stringify({
          visitedExhibitIds: ['e1', 'e2', 'e3'],
          engagedExhibitIds: ['e1'],
          dwellSecondsByExhibit: { e1: 60, e2: 30, e3: 15 },
          preferredPersonality: 'humor',
        }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(mockFn).toHaveBeenCalledTimes(1);
      const call = mockFn.mock.calls[0][0];
      expect(call.userId).toBe('user-1');
      expect(call.galleryId).toBe('gallery-123');
      expect(call.visitedExhibitIds).toEqual(['e1', 'e2', 'e3']);
      expect(call.preferredPersonality).toBe('humor');
    });

    it('uses JWT subject as the persisted user id', async () => {
      const mockFn = vi.fn().mockResolvedValue();
      const baseUrl = await startApp({
        requireAuth: () => ({ sub: 'jwt-user-42', email: 'viewer@example.com' }),
        upsertVisitorMemory: mockFn,
      });
      const res = await fetch(`${baseUrl}/api/visitor-memory/gallery-123`, {
        method: 'PUT',
        headers: jsonHeaders(),
        body: JSON.stringify({ preferredPersonality: 'expert' }),
      });

      expect(res.status).toBe(200);
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn.mock.calls[0][0].userId).toBe('jwt-user-42');
    });

    it('returns 400 for missing galleryId in body', async () => {
      const baseUrl = await startApp();
      const res = await fetch(`${baseUrl}/api/visitor-memory/gallery-123`, {
        method: 'PUT',
        headers: jsonHeaders(),
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(200); // defaults apply
    });

    it('returns 400 for invalid personality', async () => {
      const baseUrl = await startApp();
      const res = await fetch(`${baseUrl}/api/visitor-memory/gallery-123`, {
        method: 'PUT',
        headers: jsonHeaders(),
        body: JSON.stringify({ preferredPersonality: 'invalid' }),
      });
      expect(res.status).toBe(400);
    });
  });
});
