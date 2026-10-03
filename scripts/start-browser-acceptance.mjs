// Synthetic, loopback-only browser acceptance. Never loads the workspace .env or runtime data.
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { generate } from 'selfsigned';
import { SMTPServer } from 'smtp-server';
import { preview } from 'vite';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import net from 'node:net';
import express from 'express';
import { applyAppMiddleware } from '../server/config/middleware.js';
import { registerPublicExhibitionPageRoutes } from '../server/routes/publicExhibitionPageRoutes.js';
import { Agent as HttpAgent } from 'node:http';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (process.env.NODE_ENV === 'production') throw new Error('Acceptance runner is local-only');
if (!process.argv.includes('--child')) {
  await mkdir(path.join(root, '.tmp'), { recursive: true });
  const runtime = await mkdtemp(path.join(root, '.tmp', 'browser-acceptance-'));
  const cert = await generate([{ name: 'commonName', value: 'localhost' }], { algorithm: 'sha256', keySize: 2048,
    extensions: [{ name: 'basicConstraints', cA: true }, { name: 'subjectAltName', altNames: [{ type: 2, value: 'localhost' }, { type: 7, ip: '127.0.0.1' }] }] });
  await writeFile(path.join(runtime, 'cert.pem'), cert.cert);
  await writeFile(path.join(runtime, 'key.pem'), cert.private, { mode: 0o600 });
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--child', runtime], { stdio: 'inherit', windowsHide: true,
    env: { ...process.env, NODE_EXTRA_CA_CERTS: path.join(runtime, 'cert.pem') } });
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => child.kill(signal));
  child.once('exit', code => { process.exitCode = code ?? 1; });
} else {
  const runtime = path.resolve(process.argv.at(-1));
  if (!runtime.startsWith(path.join(root, '.tmp', 'browser-acceptance-'))) throw new Error('Invalid runtime');
  await mkdir(path.join(runtime, 'server'));
  process.chdir(runtime);
  dotenv.config = () => ({ parsed: {} });
  const createTransport = nodemailer.createTransport;
  const testCa = await readFile(path.join(runtime, 'cert.pem'));
  const mailSocket = process.platform === 'win32' ? `\\\\.\\pipe\\metaexb-mail-${randomUUID()}` : path.join(runtime, 'smtp.sock');
  nodemailer.createTransport = options => {
    const transport = createTransport({ ...options,
      getSocket: (_options, callback) => { const connection = net.connect(mailSocket, () => callback(null, { connection })); connection.once('error', callback); },
      tls: { ...options.tls, ca: testCa, servername: 'localhost' } });
    return { sendMail: message => transport.sendMail(message).catch(error => { console.error('Synthetic SMTP delivery failed:', error.code, error.message); throw error; }) };
  };
  const mailbox = [];
  const smtp = new SMTPServer({ secure: true, key: await readFile(path.join(runtime, 'key.pem')), cert: await readFile(path.join(runtime, 'cert.pem')),
    logger: false, disableReverseLookup: true,
    onAuth(auth, _session, callback) { callback(auth.username === 'test' && auth.password === 'synthetic-only' ? null : new Error('Invalid credentials'), { user: 'test' }); },
    onData(stream, session, callback) {
      let text = ''; stream.on('data', chunk => { text += chunk; });
      stream.on('end', () => { mailbox.push({ to: session.envelope.rcptTo.map(x => x.address), text: text.replace(/=\r?\n/g, '').replace(/=3D/g, '=') }); callback(); });
    },
  });
  smtp.on('error', error => console.error('Synthetic SMTP failure:', error.code));
  await new Promise(resolve => smtp.listen(mailSocket, resolve));
  Object.assign(process.env, { NODE_ENV: 'test', PORT: '5196', MULTIPLAYER_PORT: '3019', JWT_SECRET: randomBytes(32).toString('hex'),
    FRONTEND_ORIGIN: 'https://metaexb.com', MULTIPLAYER_CORS_ORIGIN: 'http://127.0.0.1:5193', ADMIN_SECRET: '', GOOGLE_CLIENT_ID: '',
    EMAIL_VERIFICATION_ENABLED: 'true', SMTP_HOST: '127.0.0.1', SMTP_PORT: '5199', SMTP_SECURE: 'true', SMTP_USER: 'test', SMTP_PASSWORD: 'synthetic-only', SMTP_FROM: 'sender@example.invalid',
    QWEN_API_KEY: '', DASHSCOPE_API_KEY: '', OPENAI_API_KEY: '', REDIS_URL: '', MULTIPLAYER_SHARED_STATE: 'memory', INSTANCE_COUNT: '1', RATE_LIMIT_AUTH_MAX: '1000',
  });
  // Opt-in deterministic provider for API/UI integration, never a real-model evaluation.
  // This runner always uses a new synthetic database and never reads workspace secrets.
  const skillAiRequests = [];
  let skillAiServer;
  if (process.env.METAEXB_SKILL_AI_ACCEPTANCE === '1') {
    const provider = express();
    provider.use(express.json({ limit: '100kb' }));
    provider.post('/v1/chat/completions', (req, res) => {
      const material = JSON.parse(req.body.messages.find((message) => message.role === 'user').content);
      skillAiRequests.push(material);
      res.json({ choices: [{ message: { content: JSON.stringify({ suggestions: [
        { title: 'Evidence-based planning', summary: 'I prepared the event schedule.', tags: ['planning'], evidenceIds: material.evidence.filter((source) => source.kind === 'text').map((source) => source.id) },
        { title: 'Unverified leadership', summary: 'I led the entire school.', tags: ['leadership'], evidenceIds: ['nonexistent-source'] },
      ], questions: [{ question: 'What changed after you prepared the schedule?', missingField: 'outcome' }] }) } }] });
    });
    skillAiServer = await new Promise(resolve => { const listener = provider.listen(0, '127.0.0.1', () => resolve(listener)); });
    process.env.QWEN_API_KEY = 'synthetic-provider-only';
    process.env.QWEN_BASE_URL = `http://127.0.0.1:${skillAiServer.address().port}/v1`;
    process.env.QWEN_MODEL = 'synthetic-integration-fixture';
  }
  const { startServer } = await import('../server/index.js');
  const { db, getGalleryById, getMediaAssetById } = await import('../server/db.js');
  const { runStatement } = await import('../server/repositories/sqliteHelpers.js');
  const handles = await startServer({ host: '127.0.0.1' });
  for (const email of ['creator@example.invalid', 'reset@example.invalid', 'collaborator@example.invalid']) {
    await runStatement(db, 'INSERT INTO users(id,email,name,password_hash,created_at,email_verified_at) VALUES(?,?,?,?,?,?)',
      [randomUUID(), email, 'Acceptance user', await bcrypt.hash('SyntheticPassword2026!', 10), new Date().toISOString(), new Date().toISOString()]);
  }
  // Exercise the real public-page route and CSP against this run's isolated build.
  const publicPages = express();
  applyAppMiddleware(publicPages, { frontendOrigin: 'http://127.0.0.1:5193', requestBodyLimit: '1mb', growthUploadBodyLimit: '1mb', aiReviewBodyLimit: '1mb', verifyToken: () => false });
  registerPublicExhibitionPageRoutes(publicPages, { getGalleryById, getMediaAssetById, origin: 'http://127.0.0.1:5193',
    readShell: () => readFile(path.join(root, '.tmp/browser-dist/index.html'), 'utf8') });
  // Windows/Node can truncate larger binary responses when the proxy closes each upstream socket.
  // A reusable upstream connection passes complete bytes through the normal streaming proxy.
  const mediaProxyAgent = new HttpAgent({ keepAlive: true });
  const web = await preview({ root, configFile: false, envDir: false, build: { outDir: '.tmp/browser-dist' },
    plugins: [{ name: 'synthetic-mailbox', configurePreviewServer(server) {
      server.middlewares.use('/__test/mail', (_req, res) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(mailbox)); });
      if (skillAiServer) server.middlewares.use('/__test/skill-ai', (_req, res) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(skillAiRequests)); });
      server.middlewares.use((req, res, next) => /^\/exhibitions\/[^/?]+(?:\?|$)/.test(req.url || '') ? publicPages(req, res, next) : next());
    } }],
    preview: { host: '127.0.0.1', port: 5193, strictPort: true, proxy: { '/api/media/': { target: 'http://127.0.0.1:5196', agent: mediaProxyAgent }, '/api': { target: 'http://127.0.0.1:5196', agent: mediaProxyAgent }, '/socket.io': { target: 'http://127.0.0.1:3019', ws: true } } },
  });
  const { createShutdownHandler } = await import('../server/shutdown.js');
  const shutdown = createShutdownHandler({ ...handles, database: db });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
    mediaProxyAgent.destroy();
    skillAiServer?.close();
    void Promise.all([shutdown(), new Promise(resolve => web.httpServer.close(resolve)), new Promise(resolve => smtp.close(resolve))]).finally(() => process.exit(0));
  });
  console.log('Browser acceptance ready at http://127.0.0.1:5193 (synthetic runtime and TLS mail sink only)');
}
