import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { localDemoPlugin } from './graduation-local-demo.mjs';

if (process.env.NODE_ENV === 'production') throw new Error('Local review runner cannot run in production');
process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
Object.assign(process.env, {
  VITE_API_PROXY_TARGET: 'http://127.0.0.1:5186', VITE_WS_PROXY_TARGET: 'http://127.0.0.1:3011',
  VITE_API_BASE_URL: '', VITE_GOOGLE_CLIENT_ID: '',
  VITE_MULTIPLAYER_URL: 'http://127.0.0.1:5183',
});
const server = await createServer({ plugins: [localDemoPlugin()], server: { host: '127.0.0.1', port: 5183, strictPort: true } });
await server.listen(); server.printUrls();
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  void server.close().then(() => process.exit(0)).catch(() => process.exit(1));
});
