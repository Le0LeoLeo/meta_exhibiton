// Isolated, loopback-only review server. Never reads/writes the main runtime DB.
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';

if (process.env.NODE_ENV === 'production') throw new Error('Local review runner cannot run in production');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtime = path.join(root, '.tmp', 'graduation-local');
await mkdir(path.join(runtime, 'server'), { recursive: true });
process.chdir(runtime);
Object.assign(process.env, {
  NODE_ENV: 'development', PORT: '5186', MULTIPLAYER_PORT: '3011',
  FRONTEND_ORIGIN: 'http://127.0.0.1:5183', MULTIPLAYER_CORS_ORIGIN: 'http://127.0.0.1:5183',
  JWT_SECRET: 'local-graduation-review-only-not-for-production', ADMIN_SECRET: '',
  EMAIL_VERIFICATION_ENABLED: 'false', GOOGLE_CLIENT_ID: '', VITE_GOOGLE_CLIENT_ID: '',
  QWEN_API_KEY: '', DASHSCOPE_API_KEY: '', OPENAI_API_KEY: '',
  REDIS_URL: '', MULTIPLAYER_SHARED_STATE: 'memory', INSTANCE_COUNT: '1',
});
const { startServer } = await import('../server/index.js');
const { db } = await import('../server/db.js');
const { runStatement } = await import('../server/repositories/sqliteHelpers.js');
const handles = await startServer({ host: '127.0.0.1' });
// These credentials belong exclusively to synthetic accounts in the isolated runtime.
for (const [email, name] of [['teacher@graduation.local', '示範教師'], ['student@graduation.local', '示範學生'], ['cv@graduation.local', '示範使用者']]) {
  await runStatement(db, 'INSERT OR IGNORE INTO users(id,email,name,password_hash,created_at) VALUES(?,?,?,?,?)',
    [randomUUID(), email, name, await bcrypt.hash('GraduationLocal2026!', 10), new Date().toISOString()]);
}
const { createShutdownHandler } = await import('../server/shutdown.js');
const shutdown = createShutdownHandler({ ...handles, database: db });
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  void shutdown().then(() => process.exit(0)).catch(() => process.exit(1));
});
console.log('Local review API: http://127.0.0.1:5186; isolated data: .tmp/graduation-local');
console.log('Local CV demo account: cv@graduation.local; password: GraduationLocal2026!');
