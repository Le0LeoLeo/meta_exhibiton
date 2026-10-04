import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function createPrivatePreviewEnv() {
  return [
    '# Private SSH-only preview; never commit or print this file.',
    'NODE_ENV=production',
    'PORT=5176',
    'MULTIPLAYER_PORT=3001',
    `JWT_SECRET=${randomBytes(32).toString('hex')}`,
    'FRONTEND_ORIGIN=https://localhost:8443',
    'MULTIPLAYER_CORS_ORIGIN=https://localhost:8443',
    'TRUST_PROXY_HOPS=1',
    'INSTANCE_COUNT=1',
    'MULTIPLAYER_SHARED_STATE=memory',
    'REDIS_URL=',
    'ADMIN_SECRET=',
    'GOOGLE_CLIENT_ID=',
    'QWEN_API_KEY=',
    'DASHSCOPE_API_KEY=',
    '',
  ].join('\n');
}

export function preparePrivatePreview(destination) {
  writeFileSync(destination, createPrivatePreviewEnv(), { flag: 'wx', mode: 0o600 });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const destination = fileURLToPath(new URL('../.env.private', import.meta.url));
  try {
    preparePrivatePreview(destination);
    console.log('Created .env.private with a new secret. No AI keys or user data were copied.');
  } catch (error) {
    console.error(error.code === 'EEXIST'
      ? '.env.private already exists; left unchanged. Reuse it for subsequent starts.'
      : `Could not prepare private preview (${error.code || error.name}).`);
    process.exitCode = 1;
  }
}
