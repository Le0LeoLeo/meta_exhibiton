// @vitest-environment node
import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';
import { afterEach, expect, it, vi } from 'vitest';
import { createPasswordResetService, PASSWORD_RESET_SCHEMA } from './passwordResetService.js';
import { getStatement, runStatement } from '../repositories/sqliteHelpers.js';

const databases = [];
afterEach(async () => { await Promise.all(databases.splice(0).map(db => new Promise(resolve => db.close(resolve)))); });
async function setup() {
  const database = new sqlite3.Database(':memory:'); databases.push(database);
  await runStatement(database, 'PRAGMA foreign_keys=ON');
  await runStatement(database, 'CREATE TABLE users(id TEXT PRIMARY KEY, email TEXT, password_hash TEXT, email_verified_at TEXT, session_version INTEGER DEFAULT 0)');
  await runStatement(database, PASSWORD_RESET_SCHEMA);
  await runStatement(database, "INSERT INTO users(id,email,password_hash) VALUES('u','user@example.com','old')");
  let clock = 1_000_000;
  const mail = { enabled: true, sendPasswordReset: vi.fn(), sendPasswordChanged: vi.fn() };
  const onError = vi.fn();
  const service = createPasswordResetService({ database, mail, now: () => clock, onError });
  const token = () => mail.sendPasswordReset.mock.calls.at(-1)[1];
  const request = async () => { expect(service.request('user@example.com', 'en')).toBe(true); await service.drain(); return token(); };
  return { database, mail, service, token, request, onError, advance: ms => { clock += ms; } };
}
it('stores only hashes and atomically consumes concurrent resets once with session revocation', async () => {
  const x = await setup(); const token = await x.request();
  const row = await getStatement(x.database, 'SELECT * FROM password_reset_tokens');
  expect(row.token_hash).toMatch(/^[a-f0-9]{64}$/); expect(row.token_hash).not.toBe(token);
  const results = await Promise.all([x.service.confirm(token, 'new-password', 'en'), x.service.confirm(token, 'other-password', 'en')]);
  expect(results.filter(Boolean)).toHaveLength(1);
  const user = await getStatement(x.database, 'SELECT * FROM users');
  expect(user.session_version).toBe(1); expect(user.email_verified_at).toBeTruthy();
  expect(await bcrypt.compare(results[0] ? 'new-password' : 'other-password', user.password_hash)).toBe(true);
  await x.service.drain(); expect(x.mail.sendPasswordChanged).toHaveBeenCalledOnce();
});
it('enforces cooldown, invalidates superseded and expired tokens, and rejects invalid passwords', async () => {
  const x = await setup(); const old = await x.request(); await x.request();
  expect(x.mail.sendPasswordReset).toHaveBeenCalledOnce(); x.advance(60_000); const next = await x.request();
  expect(await x.service.confirm(old, 'new-password')).toBeNull();
  expect(await x.service.confirm(next, 'short')).toBeNull();
  expect(await x.service.confirm(next, '密'.repeat(25))).toBeNull();
  x.advance(30 * 60_000); expect(await x.service.confirm(next, 'new-password')).toBeNull();
  expect((await getStatement(x.database, 'SELECT * FROM users')).password_hash).toBe('old');
});
it('invalidates outstanding links after any password/session change and account deletion', async () => {
  const x = await setup(); const old = await x.request();
  await runStatement(x.database, 'UPDATE users SET session_version=session_version+1');
  expect(await x.service.confirm(old, 'new-password')).toBeNull();
  x.advance(60_000); const next = await x.request();
  await runStatement(x.database, "DELETE FROM users WHERE id='u'");
  expect(await x.service.confirm(next, 'new-password')).toBeNull();
  expect(await getStatement(x.database, 'SELECT * FROM password_reset_tokens')).toBeNull();
});
it('accepts unknown emails without sending, contains SMTP failure, permits retry and contains notification failure', async () => {
  const x = await setup(); expect(x.service.request('unknown@example.com')).toBe(true); await x.service.drain();
  expect(x.mail.sendPasswordReset).not.toHaveBeenCalled();
  x.mail.sendPasswordReset.mockRejectedValueOnce(new Error('private SMTP detail'));
  await x.request(); expect(x.onError).toHaveBeenCalledWith();
  expect(await getStatement(x.database, 'SELECT * FROM password_reset_tokens')).toBeNull();
  const token = await x.request(); x.mail.sendPasswordChanged.mockRejectedValueOnce(new Error('mail failed'));
  expect(await x.service.confirm(token, 'new-password')).toMatchObject({ id: 'u' }); await x.service.drain();
  expect(x.onError).toHaveBeenCalledTimes(2);
});
it('is disabled without configured mail', () => {
  expect(createPasswordResetService({ mail: { enabled: false } })).toEqual({ enabled: false });
});
