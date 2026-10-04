// Run via stdin in a disposable accepted-image container with --network none and a NEW /data tmpfs.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
assert.equal(process.env.METAEXB_RESET_ACCEPTANCE_ONLY, '1');
assert.equal(process.cwd(), '/data');
assert.equal(existsSync('/data/server/app.db'), false, 'Refuse any existing database');
const require = createRequire('/app/package.json');
require('dotenv').config = () => ({ parsed: {} });
const mail = [];
// Match the application's ESM entry; Nodemailer has separate import/require implementations.
const mailPackage = require('/app/node_modules/nodemailer/package.json');
const { default: nodemailer } = await import('/app/node_modules/nodemailer/' + mailPackage.exports['.'].import);
nodemailer.createTransport = () => ({ sendMail: async message => { mail.push(message); return { accepted: [message.to] }; } });
Object.assign(process.env, { NODE_ENV: 'production', PORT: '5176', MULTIPLAYER_PORT: '3001', JWT_SECRET: randomBytes(32).toString('hex'),
  FRONTEND_ORIGIN: 'https://metaexb.com', MULTIPLAYER_CORS_ORIGIN: 'https://metaexb.com', ADMIN_SECRET: '', GOOGLE_CLIENT_ID: '',
  EMAIL_VERIFICATION_ENABLED: 'true', SMTP_HOST: 'sink.example.invalid', SMTP_PORT: '465', SMTP_SECURE: 'true', SMTP_USER: 'synthetic', SMTP_PASSWORD: 'synthetic', SMTP_FROM: 'test@example.invalid',
  REDIS_URL: '', MULTIPLAYER_SHARED_STATE: 'memory', INSTANCE_COUNT: '1', RATE_LIMIT_AUTH_MAX: '1000' });
const { startServer } = await import('/app/server/index.js');
const { db } = await import('/app/server/db.js');
const { createShutdownHandler } = await import('/app/server/shutdown.js');
const handles = await startServer({ host: '127.0.0.1' });
const shutdown = createShutdownHandler({ ...handles, database: db });
const url = 'http://127.0.0.1:5176';
async function post(path, data) { return fetch(url + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) }); }
async function waitForMail(fragment) {
  for (let i = 0; i < 100; i++) {
    const message = mail.find(x => x.text.includes(fragment));
    if (message) return message.text.match(/#token=([A-Za-z0-9_-]{43})/)[1];
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Synthetic mail was not delivered');
}
let socket;
try {
  assert.equal((await (await fetch(url + '/api/auth/config')).json()).passwordResetEnabled, true);
  const identity = { email: 'reset-acceptance@example.invalid', password: 'SyntheticPassword2026!', name: 'Synthetic reset acceptance', locale: 'en' };
  assert.equal((await post('/api/auth/register', identity)).status, 202);
  const verification = await waitForMail('/verify-email');
  assert.equal((await post('/api/auth/verification/confirm', { token: verification })).status, 200);
  const oldToken = (await (await post('/api/auth/login', identity)).json()).token;
  assert.ok(oldToken);
  socket = require('socket.io-client').io('http://127.0.0.1:3001', { transports: ['websocket'], reconnection: false, auth: { token: oldToken }, extraHeaders: { Origin: 'https://metaexb.com' } });
  await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); setTimeout(() => reject(new Error('socket connect timeout')), 5000).unref(); });
  assert.equal((await post('/api/auth/password-reset/request', { email: identity.email, locale: 'en' })).status, 202);
  const token = await waitForMail('/reset-password');
  const disconnected = new Promise((resolve, reject) => { socket.once('disconnect', resolve); setTimeout(() => reject(new Error('socket revocation timeout')), 5000).unref(); });
  const reset = await post('/api/auth/password-reset/confirm', { token, password: 'RecoveredPassword2026!', locale: 'en' });
  assert.equal(reset.status, 200); assert.deepEqual(await reset.json(), { ok: true });
  await disconnected;
  assert.equal((await fetch(url + '/api/auth/me', { headers: { Authorization: `Bearer ${oldToken}` } })).status, 401);
  assert.equal((await post('/api/auth/password-reset/confirm', { token, password: 'RecoveredPassword2026!' })).status, 400);
  assert.equal((await post('/api/auth/login', identity)).status, 401);
  assert.equal((await post('/api/auth/login', { ...identity, password: 'RecoveredPassword2026!' })).status, 200);
  assert.equal((await fetch(url + '/api/ready')).status, 200);
  console.log('PASS accepted image: schema, reset delivery to memory sink, one-time link, old HTTP/socket revocation, old-password denial and new login; no external mail/data');
} finally { socket?.disconnect(); await shutdown(); }
