// @vitest-environment node
import { it, expect } from 'vitest';
import sqlite3 from 'sqlite3';
import nodemailer from 'nodemailer';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { SMTPServer } from 'smtp-server';
import { generate } from 'selfsigned';
import { initDb } from '../db.js';
import { runStatement, getStatement } from '../repositories/sqliteHelpers.js';
import { createEmailVerificationService } from './emailVerificationService.js';

it('delivers through authenticated TLS SMTP and verifies the received single-use link', async () => {
  const cert = await generate([{ name: 'commonName', value: 'localhost' }], {
    algorithm: 'sha256', keySize: 2048,
    extensions: [{ name: 'basicConstraints', cA: true }, { name: 'subjectAltName', altNames: [{ type: 2, value: 'localhost' }] }],
  });
  let received = '';
  let envelope;
  let transportFailure;
  const smtp = new SMTPServer({
    secure: true, key: cert.private, cert: cert.cert, logger: false, disableReverseLookup: true,
    onAuth(auth, session, callback) {
      expect(session.secure).toBe(true);
      callback(auth.username === 'test' && auth.password === 'only-local-test' ? null : new Error('Authentication failed'), { user: 'test' });
    },
    onData(stream, session, callback) {
      envelope = session.envelope;
      stream.on('data', chunk => { received += chunk.toString(); });
      stream.on('end', () => callback(null));
    },
  });
  smtp.on('error', error => { transportFailure ||= error.message; });
  // A local OS socket keeps TLS end-to-end on Windows hosts whose antivirus
  // substitutes loopback TCP certificates. Certificate checks stay enabled.
  const socketPath = process.platform === 'win32' ? `\\\\.\\pipe\\mrei-smtp-${randomUUID()}` : path.join(tmpdir(), `mrei-smtp-${randomUUID()}.sock`);
  await new Promise(resolve => smtp.listen(socketPath, resolve));
  const db = new sqlite3.Database(':memory:');
  try {
    await initDb(db);
    await runStatement(db, "INSERT INTO users(id,email,name,password_hash,created_at) VALUES ('mail-user','recipient@example.invalid','Mail test','hash','2026-09-05')");
    const service = createEmailVerificationService({ database: db,
      env: { EMAIL_VERIFICATION_ENABLED: 'true', SMTP_HOST: '127.0.0.1', SMTP_PORT: '465', SMTP_SECURE: 'true', SMTP_USER: 'test', SMTP_PASSWORD: 'only-local-test', SMTP_FROM: 'sender@example.invalid', FRONTEND_ORIGIN: 'https://metaexb.com' },
      createTransport: options => {
        const transport = nodemailer.createTransport({ ...options, getSocket: (_options, callback) => { const connection = net.connect(socketPath, () => callback(null, { connection })); connection.once('error', callback); }, tls: { ...options.tls, ca: cert.cert, servername: 'localhost' } });
        return { sendMail: message => transport.sendMail(message).catch(error => { transportFailure = error.message; throw error; }) };
      },
    });
    const delivery = await service.send({ id: 'mail-user', email: 'recipient@example.invalid' }, 'en');
    expect(delivery, transportFailure).toBe('sent');
    expect(envelope.rcptTo[0].address).toBe('recipient@example.invalid');
    const text = received.replace(/=\r?\n/g, '').replace(/=3D/g, '=');
    const token = text.match(/https:\/\/metaexb\.com\/verify-email\?returnTo=%2F#token=([A-Za-z0-9_-]{43})/)?.[1];
    expect(token).toHaveLength(43);
    const stored = await getStatement(db, 'SELECT token_hash FROM email_verification_tokens WHERE user_id=?', ['mail-user']);
    expect(stored.token_hash).not.toBe(token);
    expect(await service.confirm(token)).toBe(true);
    expect(await service.confirm(token)).toBe(false);
    expect((await getStatement(db, 'SELECT email_verified_at FROM users WHERE id=?', ['mail-user'])).email_verified_at).toBeTruthy();
    await service.sendPasswordReset({ id: 'mail-user', email: 'recipient@example.invalid' }, 'a'.repeat(43), 'en');
    expect(received.replace(/=\r?\n/g, '').replace(/=3D/g, '=')).toContain('/reset-password#token=' + 'a'.repeat(43));
    await service.sendPasswordChanged({ id: 'mail-user', email: 'recipient@example.invalid' }, 'en');
    expect(received).toContain('Your Paidea password was changed');
  } finally {
    await new Promise(resolve => smtp.close(resolve));
    await new Promise(resolve => db.close(resolve));
  }
}, 15000);
