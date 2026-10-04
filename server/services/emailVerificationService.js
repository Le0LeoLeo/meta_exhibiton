import { createHash, randomBytes } from 'node:crypto';
import nodemailer from 'nodemailer';
import { runStatement } from '../repositories/sqliteHelpers.js';

export const EMAIL_VERIFICATION_SCHEMA = `CREATE TABLE IF NOT EXISTS email_verification_tokens (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  issued_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);`;
const hashToken = (token) => createHash('sha256').update(token).digest('hex');

function safeReturnTo(value) {
  if (typeof value !== 'string' || value.length > 2000 || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(value)) return '/';
  try {
    const url = new URL(value, 'https://metaexb.com');
    const decoded = decodeURIComponent(url.pathname);
    if (url.origin !== 'https://metaexb.com' || decoded.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(decoded)) return '/';
    if (!/^\/(?:virtual-gallery(?:\/(?:quick-create|create|my-exhibitions|edit-artworks))?|profile|admin\/exhibitions|exhibitions(?:\/[^/]+)?|demo)?$/.test(url.pathname)) return '/';
    return url.pathname + url.search + url.hash;
  } catch { return '/'; }
}

export function createEmailVerificationService({ database, env = process.env, createTransport = nodemailer.createTransport, now = Date.now }) {
  const flag = String(env.EMAIL_VERIFICATION_ENABLED || 'false');
  if (!['true', 'false'].includes(flag)) throw new Error('EMAIL_VERIFICATION_ENABLED must be true or false');
  if (flag !== 'true') return { enabled: false };
  for (const key of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM', 'FRONTEND_ORIGIN']) {
    if (!env[key]) throw new Error(`Email verification requires ${key}`);
  }
  const origin = new URL(env.FRONTEND_ORIGIN);
  if (origin.protocol !== 'https:' || origin.origin !== env.FRONTEND_ORIGIN.replace(/\/$/, '')) throw new Error('Email verification requires a trusted HTTPS FRONTEND_ORIGIN');
  const port = Number(env.SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !['true', 'false'].includes(env.SMTP_SECURE)) throw new Error('Invalid SMTP port or TLS mode');
  if (/[\r\n]/.test(env.SMTP_FROM) || !env.SMTP_FROM.includes('@')) throw new Error('Invalid SMTP_FROM');
  const transport = createTransport({
    host: env.SMTP_HOST, port, secure: env.SMTP_SECURE === 'true', requireTLS: true,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,
    logger: false, debug: false,
  });
  return {
    enabled: true,
    async sendPasswordReset(user, token, locale) {
      const url = `${origin.origin}/reset-password#token=${token}`;
      const messages = locale === 'en'
        ? ['Reset your Paidea password', `Open this link to choose a new password:\n\n${url}\n\nThis link expires in 30 minutes and can be used once. If you did not request it, ignore this message. Your password has not changed.`]
        : locale === 'zh-CN'
          ? ['重设你的 Paidea 密码', `请打开以下链接设置新密码：\n\n${url}\n\n链接于 30 分钟后失效，仅可使用一次。若你没有提出此要求，请忽略此邮件。你的密码尚未更改。`]
          : ['重設你的 Paidea 密碼', `請開啟以下連結設定新密碼：\n\n${url}\n\n連結於 30 分鐘後失效，僅可使用一次。若你沒有提出此要求，請忽略此郵件。你的密碼尚未更改。`];
      const result = await transport.sendMail({ from: env.SMTP_FROM, to: user.email, subject: messages[0], text: messages[1], disableFileAccess: true, disableUrlAccess: true });
      if (!result.accepted?.length) throw new Error('Reset mail not accepted');
    },
    async sendPasswordChanged(user, locale) {
      const messages = locale === 'en'
        ? ['Your Paidea password was changed', 'Your password was reset and previous sessions were revoked. If this was not you, open the Paidea sign-in page and reset your password immediately.']
        : locale === 'zh-CN'
          ? ['你的 Paidea 密码已更改', '你的密码已重设，旧登录已撤销。若不是你操作，请立即前往 Paidea 登录页重新设置密码。']
          : ['你的 Paidea 密碼已更改', '你的密碼已重設，舊登入已撤銷。若不是你操作，請立即前往 Paidea 登入頁重新設定密碼。'];
      const result = await transport.sendMail({ from: env.SMTP_FROM, to: user.email, subject: messages[0], text: messages[1], disableFileAccess: true, disableUrlAccess: true });
      if (!result.accepted?.length) throw new Error('Password notification not accepted');
    },
    async send(user, locale, returnTo) {
      const token = randomBytes(32).toString('base64url');
      const hash = hashToken(token);
      const issuedAt = now();
      const reserved = await runStatement(database, `INSERT INTO email_verification_tokens(user_id, token_hash, issued_at, expires_at)
        VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET token_hash=excluded.token_hash, issued_at=excluded.issued_at, expires_at=excluded.expires_at
        WHERE email_verification_tokens.issued_at <= ?`, [user.id, hash, issuedAt, issuedAt + 30 * 60_000, issuedAt - 60_000]);
      if (!reserved.changes) return 'cooldown';
      const url = `${origin.origin}/verify-email?returnTo=${encodeURIComponent(safeReturnTo(returnTo))}#token=${token}`;
      const english = locale === 'en';
      try {
        const result = await transport.sendMail({ from: env.SMTP_FROM, to: user.email,
          subject: english ? 'Verify your Paidea email address' : '驗證你的 Paidea電子郵件',
          text: english
            ? `Confirm your email address to sign in to Paidea:\n\n${url}\n\nThis link expires in 30 minutes and can be used once. If you did not request this, ignore this message.`
            : `請開啟以下連結並確認電子郵件，完成後即可登入 Paidea：\n\n${url}\n\n連結於 30 分鐘後失效，僅可使用一次。若你沒有提出此要求，請忽略此郵件。`,
          disableFileAccess: true, disableUrlAccess: true,
        });
        if (!result.accepted?.length) throw new Error('Mail not accepted');
        return 'sent';
      } catch {
        await runStatement(database, 'DELETE FROM email_verification_tokens WHERE user_id = ? AND token_hash = ?', [user.id, hash]);
        return 'unavailable';
      }
    },
    async confirm(token) {
      if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
      const result = await runStatement(database, `UPDATE users SET email_verified_at = ?, session_version = session_version + 1
        WHERE email_verified_at IS NULL AND id IN (SELECT user_id FROM email_verification_tokens WHERE token_hash = ? AND expires_at > ?)`,
      [new Date(now()).toISOString(), hashToken(token), now()]);
      return result.changes === 1;
    },
  };
}
