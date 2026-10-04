import sqlite3 from 'sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmailVerificationService, EMAIL_VERIFICATION_SCHEMA } from './emailVerificationService.js';
import { getStatement, runStatement } from '../repositories/sqliteHelpers.js';

const databases = [];
afterEach(async () => { await Promise.all(databases.splice(0).map((db) => new Promise((resolve) => db.close(resolve)))); });
const env = { EMAIL_VERIFICATION_ENABLED: 'true', SMTP_HOST: 'mail.example.com', SMTP_PORT: '587', SMTP_SECURE: 'false', SMTP_USER: 'user', SMTP_PASSWORD: 'secret', SMTP_FROM: 'MREI <mail@example.com>', FRONTEND_ORIGIN: 'https://metaexb.com' };
async function setup() {
  const database = new sqlite3.Database(':memory:'); databases.push(database);
  await runStatement(database, 'PRAGMA foreign_keys=ON');
  await runStatement(database, 'CREATE TABLE users(id TEXT PRIMARY KEY,email_verified_at TEXT,session_version INTEGER DEFAULT 0)');
  await runStatement(database, EMAIL_VERIFICATION_SCHEMA);
  await runStatement(database, "INSERT INTO users(id) VALUES ('u')");
  let clock = 1_000_000;
  const sendMail = vi.fn().mockResolvedValue({ accepted: ['user@example.com'] });
  const createTransport = vi.fn(() => ({ sendMail }));
  const service = createEmailVerificationService({ database, env, createTransport, now: () => clock });
  const token = () => sendMail.mock.calls.at(-1)[0].text.match(/#token=([A-Za-z0-9_-]+)/)[1];
  return { database, service, sendMail, createTransport, token, advance: (ms) => { clock += ms; }, user: { id: 'u', email: 'user@example.com' } };
}

describe('email verification delivery and token lifecycle', () => {
  it('is disabled by default and rejects incomplete or insecure configuration', () => {
    expect(createEmailVerificationService({ env: {} })).toEqual({ enabled: false });
    expect(() => createEmailVerificationService({ env: { EMAIL_VERIFICATION_ENABLED: 'true' } })).toThrow('SMTP_HOST');
    expect(() => createEmailVerificationService({ env: { ...env, FRONTEND_ORIGIN: 'http://metaexb.com' } })).toThrow('HTTPS');
    expect(() => createEmailVerificationService({ env: { ...env, SMTP_SECURE: 'maybe' } })).toThrow('TLS');
  });
  it('uses verified TLS, stores a hash, and confirms exactly once under simultaneous requests', async () => {
    const x = await setup();
    expect(await x.service.send(x.user, 'en')).toBe('sent');
    expect(x.createTransport).toHaveBeenCalledWith(expect.objectContaining({ requireTLS: true, tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' }, debug: false }));
    const raw = x.token();
    expect(raw).toHaveLength(43);
    const stored = await getStatement(x.database, 'SELECT * FROM email_verification_tokens');
    expect(stored.token_hash).not.toContain(raw);
    expect(stored.token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect((await Promise.all([x.service.confirm(raw), x.service.confirm(raw)])).sort()).toEqual([false, true]);
    expect((await getStatement(x.database, 'SELECT * FROM users')).session_version).toBe(1);
  });
  it('allows one send per minute and invalidates old links on resend', async () => {
    const x = await setup();
    expect(await x.service.send(x.user)).toBe('sent');
    const old = x.token();
    expect(await x.service.send(x.user)).toBe('cooldown');
    x.advance(60_000);
    expect(await x.service.send(x.user)).toBe('sent');
    expect(await x.service.confirm(old)).toBe(false);
    x.advance(30 * 60_000);
    expect(await x.service.confirm(x.token())).toBe(false);
    expect(await x.service.confirm('malformed')).toBe(false);
  });
  it('allows immediate retry after delivery failure and cascades account deletion', async () => {
    const x = await setup();
    x.sendMail.mockRejectedValueOnce(new Error('secret SMTP detail'));
    expect(await x.service.send(x.user)).toBe('unavailable');
    expect(await getStatement(x.database, 'SELECT * FROM email_verification_tokens')).toBe(null);
    expect(await x.service.send(x.user)).toBe('sent');
    await runStatement(x.database, "DELETE FROM users WHERE id='u'");
    expect(await x.service.confirm(x.token())).toBe(false);
    expect(await getStatement(x.database, 'SELECT * FROM email_verification_tokens')).toBe(null);
  });
});
