import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import { applyAppMiddleware } from './middleware.js';

const servers = [];

afterEach(() => {
  while (servers.length) servers.pop().close();
});

async function startApp() {
  const app = express();
  applyAppMiddleware(app, {
    requestBodyLimit: '1kb',
    growthUploadBodyLimit: '4kb',
    aiReviewBodyLimit: '5kb',
    verifyToken: (token) => token === 'valid-token' ? { sub: 'user-1' } : null,
  });
  app.post('/api/ordinary', (req, res) => res.json({ size: req.body.data.length }));
  app.post('/api/growth/assets/upload', (req, res) => res.json({ size: req.body.data.length }));
  app.post('/api/ai/exhibition-builder/review', (req, res) => res.json({ size: req.body.data.length }));

  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  servers.push(server);
  return `http://127.0.0.1:${server.address().port}`;
}

function jsonRequest(dataLength, token) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  return {
    method: 'POST',
    headers,
    body: JSON.stringify({ data: 'x'.repeat(dataLength) }),
  };
}

describe('applyAppMiddleware body limits', () => {
  it('rejects ordinary JSON above the default limit with JSON 413', async () => {
    const baseUrl = await startApp();
    const res = await fetch(`${baseUrl}/api/ordinary`, jsonRequest(1500));

    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ message: 'request body too large' });
  });

  it('allows an authenticated growth upload within its dedicated limit', async () => {
    const baseUrl = await startApp();
    const res = await fetch(
      `${baseUrl}/api/growth/assets/upload`,
      jsonRequest(2500, 'valid-token'),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ size: 2500 });
  });

  it('rejects an invalid token before parsing a large upload body', async () => {
    const baseUrl = await startApp();
    const res = await fetch(
      `${baseUrl}/api/growth/assets/upload`,
      jsonRequest(10_000, 'invalid-token'),
    );

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ message: 'invalid or expired token' });
  });

  it('allows authenticated AI review screenshots within their dedicated limit', async () => {
    const baseUrl = await startApp();
    const res = await fetch(
      `${baseUrl}/api/ai/exhibition-builder/review`,
      jsonRequest(4500, 'valid-token'),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ size: 4500 });
  });

  it('rejects a body above a dedicated route limit', async () => {
    const baseUrl = await startApp();
    const res = await fetch(
      `${baseUrl}/api/growth/assets/upload`,
      jsonRequest(5000, 'valid-token'),
    );

    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ message: 'request body too large' });
  });
});
