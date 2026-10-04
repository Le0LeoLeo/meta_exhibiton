// @vitest-environment node
import { createServer as createHttpServer, type Agent } from 'node:http';
import { Agent as HttpsAgent } from 'node:https';
import { once } from 'node:events';
import { createServer } from 'vite';
import { describe, expect, it } from 'vitest';
import { createDevProxyOptions } from './devProxy';

describe('development API proxy', () => {
  it('uses a protocol-matched persistent upstream connection', () => {
    const options = createDevProxyOptions('https://localhost:5176');
    expect(options.agent).toBeInstanceOf(HttpsAgent);
    expect(options.agent).toMatchObject({ options: { keepAlive: true } });
    (options.agent as Agent).destroy();
  });

  it('receives complete large JSON bodies through the real Vite proxy', async () => {
    const body = JSON.stringify({ data: 'a'.repeat(1024 * 1024) });
    const backend = createHttpServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
      res.end(body);
    });
    backend.listen(0, '127.0.0.1'); await once(backend, 'listening');
    const address = backend.address();
    if (!address || typeof address === 'string') throw new Error('Missing listener');
    const options = createDevProxyOptions(`http://127.0.0.1:${address.port}`);
    const vite = await createServer({ configFile: false, envFile: false, cacheDir: '.tmp/dev-proxy-test/vite-cache', optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, proxy: { '/api': options } } });
    const frontend = createHttpServer(vite.middlewares);
    try {
      frontend.listen(0, '127.0.0.1'); await once(frontend, 'listening');
      const frontendAddress = frontend.address();
      if (!frontendAddress || typeof frontendAddress === 'string') throw new Error('Missing proxy listener');
      for (let index = 0; index < 3; index++) {
        const response = await fetch(`http://127.0.0.1:${frontendAddress.port}/api/large`, { signal: AbortSignal.timeout(3000) });
        expect(await response.text()).toBe(body);
      }
    } finally {
      (options.agent as Agent).destroy();
      frontend.closeAllConnections(); backend.closeAllConnections();
      await Promise.all([vite.close(), new Promise<void>(resolve => frontend.close(() => resolve())), new Promise<void>(resolve => backend.close(() => resolve()))]);
    }
  });
});
