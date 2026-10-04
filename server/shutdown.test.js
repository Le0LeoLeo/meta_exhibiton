// @vitest-environment node

import http from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { createShutdownHandler } from './shutdown.js';

describe('graceful shutdown', () => {
  it('closes HTTP, multiplayer, shared rate limits, and SQLite once in order', async () => {
    const calls = [];
    const httpServer = {
      listening: true,
      close: (callback) => { calls.push('http'); callback(); },
    };
    const multiplayerServer = { close: vi.fn(async () => calls.push('multiplayer')) };
    const rateLimitStore = { close: vi.fn(async () => calls.push('rate-limit')) };
    const database = { close: (callback) => { calls.push('database'); callback(); } };
    const shutdown = createShutdownHandler({
      httpServer,
      multiplayerServer,
      rateLimitStore,
      database,
    });

    await Promise.all([shutdown(), shutdown()]);

    expect(calls).toEqual(['http', 'multiplayer', 'rate-limit', 'database']);
    expect(multiplayerServer.close).toHaveBeenCalledOnce();
    expect(rateLimitStore.close).toHaveBeenCalledOnce();
  });

  it('continues closing later resources after a failure', async () => {
    const calls = [];
    const logger = { error: vi.fn() };
    const shutdown = createShutdownHandler({
      httpServer: {
        listening: true,
        close: (callback) => { calls.push('http'); callback(new Error('http failed')); },
      },
      multiplayerServer: { close: async () => calls.push('multiplayer') },
      database: { close: (callback) => { calls.push('database'); callback(); } },
      logger,
    });

    await expect(shutdown()).rejects.toThrow('server shutdown failed');
    expect(calls).toEqual(['http', 'multiplayer', 'database']);
    expect(logger.error).toHaveBeenCalledOnce();
  });

  it('closes the rate-limit store before waiting for a pending HTTP request to drain', async () => {
    let markRequestStarted;
    let releaseRequest;
    const requestStarted = new Promise((resolve) => { markRequestStarted = resolve; });
    const requestReleased = new Promise((resolve) => { releaseRequest = resolve; });
    const server = http.createServer(async (_req, res) => {
      markRequestStarted();
      await requestReleased;
      res.end('released');
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const responsePromise = new Promise((resolve, reject) => {
      const request = http.get({
        hostname: '127.0.0.1',
        port: server.address().port,
        path: '/pending',
        headers: { connection: 'close' },
      }, (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => { body += chunk; });
        response.on('end', () => resolve(body));
      });
      request.on('error', reject);
    });
    await requestStarted;

    const rateLimitStore = { close: vi.fn(async () => releaseRequest()) };
    const shutdown = createShutdownHandler({
      httpServer: server,
      rateLimitStore,
      database: { close: (callback) => callback() },
      shutdownTimeoutMs: 1_000,
    });

    await shutdown();

    expect(await responsePromise).toBe('released');
    expect(rateLimitStore.close).toHaveBeenCalledOnce();
  });

  it('bounds a stalled drain, forces HTTP connections closed, and closes the database last', async () => {
    const calls = [];
    const logger = { error: vi.fn() };
    const httpServer = {
      listening: true,
      close: vi.fn(() => calls.push('http')),
      closeAllConnections: vi.fn(() => calls.push('force-http')),
    };
    const shutdown = createShutdownHandler({
      httpServer,
      rateLimitStore: { close: () => new Promise(() => {}) },
      database: { close: (callback) => { calls.push('database'); callback(); } },
      logger,
      shutdownTimeoutMs: 10,
    });

    await expect(shutdown()).rejects.toThrow('server shutdown failed');

    expect(calls).toEqual(['http', 'force-http', 'database']);
    expect(logger.error).toHaveBeenCalledWith(
      '[server] shutdown step failed',
      expect.objectContaining({ message: 'server shutdown timed out after 10ms' }),
    );
  });
});
