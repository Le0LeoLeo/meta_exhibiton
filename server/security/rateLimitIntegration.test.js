import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { registerAgentRoutes } from '../routes/agentRoutes.js';
import { registerAuthRoutes } from '../routes/authRoutes.js';
import { registerCompetitionRoutes } from '../routes/competitionRoutes.js';
import { registerGrowthRoutes } from '../routes/growthRoutes.js';
import { registerTtsRoutes } from '../routes/ttsRoutes.js';
import { createJsonErrorMiddleware } from '../config/errorHandling.js';
import { createRequestContextMiddleware } from '../config/requestContext.js';
import { createFixedWindowLimiter } from './rateLimit.js';

const servers = [];

async function startApp(registerRoutes, { errorLogger } = {}) {
  const app = express();
  if (errorLogger) app.use(createRequestContextMiddleware({ logger: errorLogger }));
  app.use(express.json());
  registerRoutes(app);
  if (errorLogger) app.use(createJsonErrorMiddleware({ logger: errorLogger }));

  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  servers.push(server);

  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
}

async function postJson(baseUrl, path, body) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(
    (server) => new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }),
  ));
});

describe('route rate limiter integration', () => {
  it('returns stable JSON with a request ID when the shared store rejects', async () => {
    const storeError = new Error('Redis password=private connection failed');
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const authLimiter = createFixedWindowLimiter({
      limit: 2,
      windowMs: 60_000,
      store: { consume: async () => { throw storeError; } },
    });
    const baseUrl = await startApp(
      (app) => registerAuthRoutes(app, { authLimiter }),
      { errorLogger: logger },
    );

    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-id': 'redis-failure-1',
      },
      body: JSON.stringify({ email: 'person@example.com', password: 'password123' }),
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'internal error',
      requestId: 'redis-failure-1',
    });
    expect(logger.error).toHaveBeenCalledWith('internal_error', storeError, {
      code: 'INTERNAL_ERROR',
      requestId: 'redis-failure-1',
    });
  });

  it('enforces one combined limit across apps using the same async store', async () => {
    const counts = new Map();
    const sharedStore = {
      async consume({ namespace, key, limit, windowMs, now }) {
        const bucketKey = `${namespace}:${key}`;
        let bucket = counts.get(bucketKey);
        if (!bucket || bucket.startedAt + windowMs <= now) {
          bucket = { count: 0, startedAt: now };
          counts.set(bucketKey, bucket);
        }
        bucket.count += 1;
        return {
          allowed: bucket.count <= limit,
          retryAfterMs: bucket.count <= limit
            ? 0
            : bucket.startedAt + windowMs - now,
        };
      },
    };
    const limiterOptions = {
      namespace: 'auth',
      store: sharedStore,
      limit: 2,
      windowMs: 60_000,
      now: () => 0,
    };
    const register = (app) => registerAuthRoutes(app, {
      authLimiter: createFixedWindowLimiter(limiterOptions),
      getUserByEmail: async () => null,
    });
    const firstApp = await startApp(register);
    const secondApp = await startApp(register);
    const body = { email: 'person@example.com', password: 'password123' };

    expect((await postJson(firstApp, '/api/auth/login', body)).status).toBe(401);
    expect((await postJson(secondApp, '/api/auth/login', body)).status).toBe(401);
    expect((await postJson(firstApp, '/api/auth/login', body)).status).toBe(429);
  });

  it('returns 429 before a third registration reaches the handler', async () => {
    let lookups = 0;
    const authLimiter = createFixedWindowLimiter({
      limit: 2,
      windowMs: 60_000,
      now: () => 0,
    });
    const baseUrl = await startApp((app) => registerAuthRoutes(app, {
      authLimiter,
      requireAuth: () => null,
      signToken: () => 'token',
      getUserByEmail: async () => {
        lookups += 1;
        return { id: 'existing' };
      },
      insertUser: async () => {},
      getUserById: async () => null,
      updateUserName: async () => {},
      updateUserPasswordHash: async () => {},
      deleteUserById: async () => {},
    }));

    const body = { email: 'person@example.com', password: 'password123' };
    expect((await postJson(baseUrl, '/api/auth/register', body)).status).toBe(409);
    expect((await postJson(baseUrl, '/api/auth/register', body)).status).toBe(409);

    const denied = await postJson(baseUrl, '/api/auth/register', body);
    expect(denied.status).toBe(429);
    expect(denied.headers.get('retry-after')).toBe('60');
    expect(lookups).toBe(2);
  });

  it('limits shared growth comments and still registers without limiter dependencies', async () => {
    let inserts = 0;
    const commentLimiter = createFixedWindowLimiter({
      limit: 1,
      windowMs: 60_000,
      now: () => 0,
    });
    const deps = {
      requireAuth: () => null,
      getUserById: async () => null,
      insertGrowthChild: async () => {},
      listGrowthChildrenByOwnerId: async () => [],
      getGrowthChildById: async () => null,
      insertGrowthExhibit: async () => {},
      listGrowthExhibitsByOwnerId: async () => [],
      listAllGrowthExhibitsByOwnerId: async () => [],
      getGrowthExhibitById: async () => null,
      updateGrowthExhibitShareById: async () => {},
      getGrowthExhibitByShareToken: async () => ({
        id: 'exhibit-1',
        owner_id: 'owner-1',
        share_expires_at: null,
      }),
      insertGrowthAsset: async () => {},
      listGrowthAssetsByExhibitId: async () => [],
      insertGrowthComment: async () => {
        inserts += 1;
      },
      listGrowthCommentsByExhibitId: async () => [],
    };
    const baseUrl = await startApp((app) => registerGrowthRoutes(app, {
      ...deps,
      commentLimiter,
    }));
    const body = { userName: 'Visitor', content: 'Hello' };

    expect((
      await postJson(baseUrl, '/api/share/growth/exhibits/share-token/comments', body)
    ).status).toBe(201);
    expect((
      await postJson(baseUrl, '/api/share/growth/exhibits/share-token/comments', body)
    ).status).toBe(429);
    expect(inserts).toBe(1);

    const unboundedBaseUrl = await startApp(
      (app) => registerGrowthRoutes(app, deps),
    );
    expect((
      await postJson(unboundedBaseUrl, '/api/share/growth/exhibits/share-token/comments', body)
    ).status).toBe(201);
  });

  it('returns 429 before a third agent request reaches the service', async () => {
    const agentLimiter = createFixedWindowLimiter({
      limit: 2,
      windowMs: 60_000,
      now: () => 0,
    });
    const expectedReply = {
      answer: 'Injected agent reply',
      source: 'test-service',
      recommendedExhibit: null,
    };
    const baseUrl = await startApp((app) => registerAgentRoutes(app, {
      agentLimiter,
      requireAuth: () => ({ sub: 'user-1' }),
      generateAgentReply: async () => expectedReply,
    }));
    const body = { question: 'What should I view?' };

    const first = await postJson(baseUrl, '/api/agent/reply', body);
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual(expectedReply);

    const second = await postJson(baseUrl, '/api/agent/reply', body);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual(expectedReply);

    const denied = await postJson(baseUrl, '/api/agent/reply', body);
    expect(denied.status).toBe(429);
    expect(denied.headers.get('retry-after')).toBe('60');
  });

  it('uses the injected TTS service before applying the N+1 limit', async () => {
    const ttsLimiter = createFixedWindowLimiter({
      limit: 1,
      windowMs: 60_000,
      now: () => 0,
    });
    const expectedAudio = Buffer.from('injected audio');
    const baseUrl = await startApp((app) => registerTtsRoutes(app, {
      ttsLimiter,
      requireAuth: () => ({ sub: 'user-1' }),
      generateGuideTtsAudio: async () => expectedAudio,
    }));

    const first = await postJson(baseUrl, '/api/tts/qwen', { text: 'Hello' });
    expect(first.status).toBe(200);
    expect(first.headers.get('content-type')).toBe('audio/mpeg');
    expect(Buffer.from(await first.arrayBuffer())).toEqual(expectedAudio);

    const denied = await postJson(baseUrl, '/api/tts/qwen', { text: 'Hello again' });
    expect(denied.status).toBe(429);
  });

  it.each([
    ['login', '/api/auth/login', (app, limiter) => registerAuthRoutes(app, { authLimiter: limiter })],
    ['growth upload', '/api/growth/assets/upload', (app, limiter) => registerGrowthRoutes(app, { uploadLimiter: limiter })],
    ['growth comment', '/api/growth/comments', (app, limiter) => registerGrowthRoutes(app, { commentLimiter: limiter })],
    ['shared growth comment', '/api/share/growth/exhibits/token/comments', (app, limiter) => registerGrowthRoutes(app, { commentLimiter: limiter })],
    ['competition vote', '/api/competitions/c/entries/e/vote', (app, limiter) => registerCompetitionRoutes(app, { voteLimiter: limiter })],
    ['TTS', '/api/tts/qwen', (app, limiter) => registerTtsRoutes(app, { ttsLimiter: limiter })],
  ])('wires the %s limiter before its handler', async (_name, path, registerRoutes) => {
    const limiter = (_req, res) => res.status(429).json({ message: 'limited' });
    const baseUrl = await startApp((app) => registerRoutes(app, limiter));

    const response = await postJson(baseUrl, path, {});

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ message: 'limited' });
  });
});
