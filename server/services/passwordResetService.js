import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { getStatement, runStatement } from '../repositories/sqliteHelpers.js';

export const PASSWORD_RESET_SCHEMA = `CREATE TABLE IF NOT EXISTS password_reset_tokens (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  session_version INTEGER NOT NULL,
  issued_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);`;
const hashToken = (token) => createHash('sha256').update(token).digest('hex');

export function createPasswordResetService({ database, mail, now = Date.now, onError = () => {} }) {
  if (!mail.enabled) return { enabled: false };
  const pending = new Set();
  function track(work) {
    const task = Promise.resolve().then(work).catch(() => onError()).finally(() => pending.delete(task));
    pending.add(task);
  }
  return {
    enabled: true,
    // Queue before looking up the account so response status and latency do not disclose existence or SMTP outcomes.
    request(email, locale) {
      if (pending.size >= 20) return false;
      track(async () => {
        const user = await getStatement(database, 'SELECT id, email, session_version FROM users WHERE email = ?', [email]);
        if (!user) return;
        const token = randomBytes(32).toString('base64url');
        const hash = hashToken(token);
        const issuedAt = now();
        const reserved = await runStatement(database, `INSERT INTO password_reset_tokens(user_id, token_hash, session_version, issued_at, expires_at)
          VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET token_hash=excluded.token_hash,
          session_version=excluded.session_version, issued_at=excluded.issued_at, expires_at=excluded.expires_at
          WHERE password_reset_tokens.issued_at <= ?`, [user.id, hash, user.session_version, issuedAt, issuedAt + 30 * 60_000, issuedAt - 60_000]);
        if (!reserved.changes) return;
        try { await mail.sendPasswordReset(user, token, locale); }
        catch {
          await runStatement(database, 'DELETE FROM password_reset_tokens WHERE user_id = ? AND token_hash = ?', [user.id, hash]);
          onError();
        }
      });
      return true;
    },
    async confirm(token, password, locale) {
      if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
      if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) return null;
      const passwordHash = await bcrypt.hash(password, 10);
      // One conditional write both changes the password and invalidates the link, including concurrent requests.
      const user = await getStatement(database, `UPDATE users SET password_hash = ?, session_version = session_version + 1,
        email_verified_at = COALESCE(email_verified_at, ?)
        WHERE id IN (SELECT user_id FROM password_reset_tokens WHERE token_hash = ? AND expires_at > ?
          AND password_reset_tokens.session_version = users.session_version)
        RETURNING id, email`, [passwordHash, new Date(now()).toISOString(), hashToken(token), now()]);
      if (user) track(() => mail.sendPasswordChanged(user, locale));
      return user;
    },
    async drain() { await Promise.all([...pending]); },
  };
}
