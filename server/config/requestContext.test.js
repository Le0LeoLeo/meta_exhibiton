import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequestContextMiddleware } from './requestContext.js';

const servers = [];

afterEach(() => {
  while (servers.length) servers.pop().close();
});

async function startApp(logger) {
  const app = express();
  app.use(createRequestContextMiddleware({ logger }));
  app.get('/api/example', (req, res) => res.status(201).json({ requestId: req.requestId }));
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.get('/api/ready', (_req, res) => res.status(503).json({ ok: false }));

  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  servers.push(server);
  return `http://127.0.0.1:${server.address().port}`;
}

describe('createRequestContextMiddleware', () => {
  it('accepts a valid incoming request ID and logs request completion', async () => {
    const logger = { info: vi.fn(), warn: vi.fn() };
    const baseUrl = await startApp(logger);

    const response = await fetch(`${baseUrl}/api/example?source=test`, {
      headers: { 'x-request-id': 'client_request-1.test~value' },
    });
    await response.text();

    expect(response.headers.get('x-request-id')).toBe('client_request-1.test~value');
    expect(logger.info).toHaveBeenCalledWith('http_request_completed', expect.objectContaining({
      requestId: 'client_request-1.test~value',
      method: 'GET',
      route: '/api/example',
      status: 201,
      durationMs: expect.any(Number),
    }));
  });

  it('replaces an invalid incoming request ID', async () => {
    const logger = { info: vi.fn(), warn: vi.fn() };
    const baseUrl = await startApp(logger);

    const response = await fetch(`${baseUrl}/api/example`, {
      headers: { 'x-request-id': 'not valid' },
    });
    await response.text();

    expect(response.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers.get('x-request-id')).not.toBe('not valid');
  });

  it('suppresses successful health logs but logs failed health checks', async () => {
    const logger = { info: vi.fn(), warn: vi.fn() };
    const baseUrl = await startApp(logger);

    const healthy = await fetch(`${baseUrl}/api/health`);
    await healthy.text();
    const unhealthy = await fetch(`${baseUrl}/api/ready`);
    await unhealthy.text();

    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith('http_request_completed', expect.objectContaining({
      route: '/api/ready',
      status: 503,
    }));
  });
});
