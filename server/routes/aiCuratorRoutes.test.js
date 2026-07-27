import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerAiCuratorRoutes } from './aiCuratorRoutes.js';

const servers = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(
    (server) => new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }),
  ));
});

function createDeps(overrides = {}) {
  return {
    requireAuth: () => true,
    aiWritingLimiter: (_req, _res, next) => next(),
    generateCuratorPlan: async () => ({
      exhibition: {
        title: 'Curator plan',
      },
    }),
    ...overrides,
  };
}

async function startApp(overrides = {}) {
  const app = express();
  app.use(express.json());
  registerAiCuratorRoutes(app, createDeps(overrides));

  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  servers.push(server);

  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
}

function postCuratorPlan(baseUrl, body) {
  return fetch(`${baseUrl}/api/ai/curator-plan`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('aiCuratorRoutes', () => {
  it('returns 400 for missing theme', async () => {
    const response = await postCuratorPlan(await startApp(), {});

    expect(response.status).toBe(400);
    expect((await response.json()).message).toBeTruthy();
  });

  it('stops before generation when auth fails', async () => {
    const generateCuratorPlan = vi.fn();
    const response = await postCuratorPlan(await startApp({
      requireAuth: (_req, res) => {
        res.status(401).json({ message: 'unauthorized' });
        return null;
      },
      generateCuratorPlan,
    }), {
      theme: 'Macau history',
    });

    expect(response.status).toBe(401);
    expect(generateCuratorPlan).not.toHaveBeenCalled();
  });

  it('applies the limiter before generation', async () => {
    const generateCuratorPlan = vi.fn();
    const limiter = vi.fn((_req, res) => {
      res.status(429).json({ message: 'too many AI curator requests' });
    });
    const response = await postCuratorPlan(await startApp({
      aiWritingLimiter: limiter,
      generateCuratorPlan,
    }), {
      theme: 'Macau history',
    });

    expect(response.status).toBe(429);
    expect(limiter).toHaveBeenCalledTimes(1);
    expect(generateCuratorPlan).not.toHaveBeenCalled();
  });

  it('uses a functional default limiter when none is injected', async () => {
    const generateCuratorPlan = vi.fn().mockResolvedValue({
      exhibition: { title: 'Default limiter plan' },
    });
    const response = await postCuratorPlan(await startApp({
      aiWritingLimiter: undefined,
      generateCuratorPlan,
    }), {
      theme: 'Macau history',
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ exhibition: { title: 'Default limiter plan' } });
    expect(generateCuratorPlan).toHaveBeenCalledTimes(1);
  });

  it('calls generateCuratorPlan with defaults for omitted optional fields', async () => {
    const plan = {
      exhibition: {
        title: '澳門非遺文化展 Curated Exhibition',
      },
    };
    const generateCuratorPlan = vi.fn().mockResolvedValue(plan);
    const response = await postCuratorPlan(await startApp({ generateCuratorPlan }), {
      theme: '澳門非遺文化展',
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(plan);
    expect(generateCuratorPlan).toHaveBeenCalledWith({
      theme: '澳門非遺文化展',
      language: 'zh-TW',
      exhibitCount: 6,
      intent: 'warm-memory',
    });
  });

  it('passes a valid curator intent to generation', async () => {
    const generateCuratorPlan = vi.fn().mockResolvedValue({
      exhibition: { title: 'Competition plan' },
    });
    const response = await postCuratorPlan(await startApp({ generateCuratorPlan }), {
      theme: 'Student design awards',
      intent: 'competition-showcase',
    });

    expect(response.status).toBe(200);
    expect(generateCuratorPlan).toHaveBeenCalledWith({
      theme: 'Student design awards',
      language: 'zh-TW',
      exhibitCount: 6,
      intent: 'competition-showcase',
    });
  });

  it('returns 400 for invalid curator intent', async () => {
    const generateCuratorPlan = vi.fn();
    const response = await postCuratorPlan(await startApp({ generateCuratorPlan }), {
      theme: 'Macau history',
      intent: 'cold-sales-pitch',
    });

    expect(response.status).toBe(400);
    expect((await response.json()).message).toBeTruthy();
    expect(generateCuratorPlan).not.toHaveBeenCalled();
  });

  it('returns 500 when curator generation fails', async () => {
    const generateCuratorPlan = vi.fn().mockRejectedValue(new Error('curator unavailable'));
    const response = await postCuratorPlan(await startApp({ generateCuratorPlan }), {
      theme: 'Macau history',
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      code: 'AI_CURATOR_FAILED',
      message: 'AI curator request failed',
    });
  });
});
