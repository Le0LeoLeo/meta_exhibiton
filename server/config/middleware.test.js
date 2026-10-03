import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import { applyAppMiddleware } from './middleware.js';

const servers = [];

afterEach(() => {
  while (servers.length) servers.pop().close();
});

async function startApp(frontendOrigin = 'http://localhost:5173') {
  const app = express();
  applyAppMiddleware(app, {
    frontendOrigin,
    requestBodyLimit: '1kb',
    mediaUploadBodyLimit: '4kb',
    aiReviewBodyLimit: '5kb',
    verifyToken: (token) => token === 'valid-token' ? { sub: 'user-1' } : null,
    logger: { info: () => {}, warn: () => {} },
  });
  app.post('/api/ordinary', (req, res) => res.json({ size: req.body.data.length }));
  app.post('/api/media/upload', (req, res) => res.json({ size: req.body.data.length }));
  app.post('/api/ai/exhibition-builder/review', (req, res) => res.json({ size: req.body.data.length }));
  app.get('/api/cors-probe', (_req, res) => res.json({ ok: true }));
  app.get('/exhibitions/test', (_req, res) => res.type('html').send('<!doctype html><title>Exhibition</title>'));

  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  servers.push(server);
  return `http://127.0.0.1:${server.address().port}`;
}

describe('applyAppMiddleware CORS', () => {
  it('allows exhibition WebAssembly while preserving script execution restrictions', async () => {
    const baseUrl = await startApp();
    const response = await fetch(`${baseUrl}/exhibitions/test?mode=2d`);
    expect(response.status).toBe(200);
    const policy = response.headers.get('content-security-policy');
    const script = policy.split(';').map((part) => part.trim()).find((part) => part.startsWith('script-src '));
    expect(script.split(/\s+/)).toEqual(['script-src', "'self'", "'wasm-unsafe-eval'"]);
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
  });
  it('adds baseline browser security headers', async () => {
    const baseUrl = await startApp();
    const res = await fetch(`${baseUrl}/api/cors-probe`);

    expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('permissions-policy')).toContain('microphone=()');
  });

  it('allows the configured frontend origin', async () => {
    const frontendOrigin = 'https://app.example.com';
    const baseUrl = await startApp(frontendOrigin);
    const res = await fetch(`${baseUrl}/api/cors-probe`, {
      headers: { origin: frontendOrigin },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe(frontendOrigin);
  });

  it('does not allow a different frontend origin', async () => {
    const baseUrl = await startApp('https://app.example.com');
    const res = await fetch(`${baseUrl}/api/cors-probe`, {
      headers: { origin: 'https://attacker.example.com' },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});

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

  it('allows an authenticated media upload within its dedicated limit', async () => {
    const baseUrl = await startApp();
    const res = await fetch(
      `${baseUrl}/api/media/upload`,
      jsonRequest(2500, 'valid-token'),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ size: 2500 });
  });

  it('rejects an invalid token before parsing a large upload body', async () => {
    const baseUrl = await startApp();
    const res = await fetch(
      `${baseUrl}/api/media/upload`,
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
      `${baseUrl}/api/media/upload`,
      jsonRequest(5000, 'valid-token'),
    );

    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ message: 'request body too large' });
  });
});
