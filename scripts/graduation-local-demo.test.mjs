import { test, vi, afterEach } from 'vitest';
import assert from 'node:assert/strict';
import { localDemoPlugin } from './graduation-local-demo.mjs';
afterEach(() => vi.restoreAllMocks());

function setup() {
  let middleware;
  localDemoPlugin().configureServer({ middlewares: { use(fn) { middleware = fn; } } });
  const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; },
    writeHead(status, headers) { this.statusCode = status; Object.assign(this.headers, headers); },
    end(body) { this.body = body; } };
  return { middleware, res };
}

test('anonymous local session signs into a generic CV account and forwards cookies', async () => {
  const calls = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
    calls.push([url, options]);
    return calls.length === 1 ? new Response('{}', { status: 401 })
      : new Response('{"token":"demo"}', { headers: { 'Set-Cookie': 'demo=1' } });
  });
  const { middleware, res } = setup();
  await middleware({ method: 'GET', url: '/api/auth/me', headers: { host: '127.0.0.1:5183' } }, res, assert.fail);
  assert.equal(JSON.parse(calls[1][1].body).email, 'cv@graduation.local');
  assert.deepEqual(res.headers['Set-Cookie'], ['demo=1']);
  assert.equal(res.statusCode, 200);
});

test('existing session is retained without login', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{}'));
  const { middleware, res } = setup();
  await middleware({ method: 'GET', url: '/api/auth/me', headers: { host: '127.0.0.1:5183' } }, res, assert.fail);
  assert.equal(fetch.mock.calls.length, 1);
});

test('CV account switch signs in and redirects to the exhibition workspace', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => {
    assert.equal(JSON.parse(options.body).email, 'cv@graduation.local');
    return new Response('{}');
  });
  const { middleware, res } = setup();
  await middleware({ method: 'GET', url: '/__local-demo/role?role=cv', headers: { host: '127.0.0.1:5183' } }, res, assert.fail);
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.Location, '/virtual-gallery/my-exhibitions');
});

test('rejects foreign host and cross-site requests without backend access', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(assert.fail);
  for (const headers of [{ host: 'example.com' }, { host: '127.0.0.1:5183', 'sec-fetch-site': 'cross-site' }]) {
    const { middleware, res } = setup();
    await middleware({ method: 'GET', url: '/api/auth/me', headers }, res, assert.fail);
    assert.equal(res.statusCode, 403);
  }
});
