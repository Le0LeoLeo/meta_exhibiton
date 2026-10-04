import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import {
  clearCsrfCookie,
  clearSessionCookie,
  setCsrfCookie,
  setSessionCookie,
} from '../auth/sessionCookie.js';
import {
  avatarAppearanceSchema,
  parseStoredAvatarAppearance,
} from '../schemas/avatarAppearanceSchema.js';

const nameSchema = z.string().trim().min(1, 'name is required').max(100, 'name too long');

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'currentPassword is required'),
  newPassword: z.string().min(8, 'newPassword must be at least 8 characters'),
});

const noRateLimit = (_req, _res, next) => next();

function serializeAuthUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatarAppearance: parseStoredAvatarAppearance(row.avatar_appearance_json),
  };
}

export function registerAuthRoutes(app, deps) {
  const {
    requireAuth,
    signToken,
    createCsrfToken,
    verifyGoogleCredential,
    authLimiter = noRateLimit,
    verificationLimiter = noRateLimit,
    emailVerification = { enabled: false },
    passwordReset = { enabled: false },
    markEmailVerified = async () => {},
    getUserByEmail,
    getUserByGoogleSubject,
    insertUser,
    linkGoogleSubject,
    getUserById,
    updateUserName,
    updateUserAvatarAppearance,
    updateUserPasswordHash,
    revokeUserSessions = async () => {},
    deleteAccountWithCleanup,
    exportUserData,
    listMediaStorageFileNamesByOwnerId,
    deleteMediaFiles,
    listGrowthAssetContentUrlsByOwnerId,
    deleteGrowthAssetFiles,
  } = deps;

  app.get('/api/auth/config', (_req, res) => {
    res.set('Cache-Control', 'no-store').json({ emailVerificationEnabled: emailVerification.enabled, passwordResetEnabled: passwordReset.enabled });
  });

  app.post('/api/auth/password-reset/request', authLimiter, verificationLimiter, (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!passwordReset.enabled) return res.status(503).json({ code: 'RESET_UNAVAILABLE' });
    const parsed = z.object({ email: z.string().trim().email().max(254), locale: z.enum(['en', 'zh-TW', 'zh-CN']).optional() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ code: 'INVALID_RESET_REQUEST' });
    if (!passwordReset.request(parsed.data.email.toLowerCase(), parsed.data.locale)) return res.status(503).json({ code: 'RESET_UNAVAILABLE' });
    return res.status(202).json({ accepted: true });
  });

  app.post('/api/auth/password-reset/confirm', authLimiter, verificationLimiter, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!passwordReset.enabled) return res.status(503).json({ code: 'RESET_UNAVAILABLE' });
    const parsed = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/), password: z.string().min(8).refine((value) => Buffer.byteLength(value, 'utf8') <= 72), locale: z.enum(['en', 'zh-TW', 'zh-CN']).optional() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ code: 'INVALID_RESET_INPUT' });
    try {
      const user = await passwordReset.confirm(parsed.data.token, parsed.data.password, parsed.data.locale);
      if (!user) return res.status(400).json({ code: 'INVALID_RESET_TOKEN' });
      // Persisted session_version already protects HTTP and the periodic socket authorization sweep.
      await revokeUserSessions(user.id).catch(() => {});
      clearSessionCookie(res);
      clearCsrfCookie(res);
      return res.json({ ok: true });
    } catch { return res.status(503).json({ code: 'RESET_UNAVAILABLE' }); }
  });

  app.post('/api/auth/verification/send', authLimiter, verificationLimiter, async (req, res) => {
    if (!emailVerification.enabled) return res.status(503).json({ message: 'Email verification is unavailable' });
    const parsed = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(1024), locale: z.string().max(20).optional(), returnTo: z.string().max(2000).optional() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'A valid email and password are required' });
    const email = parsed.data.email.toLowerCase();
    try {
      const row = await getUserByEmail(email);
      let deliveryStatus = 'accepted';
      if (row && await bcrypt.compare(parsed.data.password, row.password_hash) && !row.email_verified_at && !row.google_subject) {
        const delivery = await emailVerification.send(row, parsed.data.locale, parsed.data.returnTo);
        deliveryStatus = delivery === 'cooldown' ? 'accepted' : delivery;
      }
      return res.status(deliveryStatus === 'unavailable' ? 503 : 202).json({ verificationRequired: true, email, deliveryStatus });
    } catch {
      return res.status(503).json({ message: 'Email verification is temporarily unavailable', deliveryStatus: 'unavailable' });
    }
  });

  app.post('/api/auth/verification/confirm', authLimiter, verificationLimiter, async (req, res) => {
    if (!emailVerification.enabled) return res.status(503).json({ message: 'Email verification is unavailable' });
    try {
      if (!await emailVerification.confirm(req.body?.token)) return res.status(400).json({ code: 'INVALID_VERIFICATION_TOKEN', message: 'Verification link is invalid or expired' });
      return res.json({ ok: true });
    } catch {
      return res.status(503).json({ message: 'Email verification is temporarily unavailable' });
    }
  });

  app.post('/api/auth/register', authLimiter, async (req, res) => {
    try {
      const { email, password, name } = req.body || {};

      if (!email || typeof email !== 'string' || !z.string().trim().email().max(254).safeParse(email).success) {
        return res.status(400).json({ message: 'email is required' });
      }
      if (!password || typeof password !== 'string' || password.length < 8 || password.length > 1024) {
        return res.status(400).json({ message: 'password must be at least 8 characters' });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const existing = await getUserByEmail(normalizedEmail);
      if (existing) {
        return res.status(409).json({ message: 'email already registered' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = {
        id: randomUUID(),
        email: normalizedEmail,
        name: typeof name === 'string' && name.trim() ? name.trim() : 'User',
        passwordHash,
        createdAt: new Date().toISOString(),
      };

      await insertUser(user);

      if (emailVerification.enabled) {
        const delivery = await emailVerification.send(user, req.body?.locale, req.body?.returnTo);
        return res.status(202).json({ verificationRequired: true, email: normalizedEmail, deliveryStatus: delivery === 'unavailable' ? 'unavailable' : 'sent' });
      }

      const authUser = serializeAuthUser(user);
      const token = signToken(authUser);
      setSessionCookie(res, token);
      setCsrfCookie(res, createCsrfToken());
      res.status(201).json({
        token,
        user: authUser,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.post('/api/auth/login', authLimiter, async (req, res) => {
    try {
      const { email, password } = req.body || {};

      if (!email || !password) {
        return res.status(400).json({ message: 'email and password are required' });
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const row = await getUserByEmail(normalizedEmail);
      if (!row) {
        return res.status(401).json({ message: 'invalid email or password' });
      }

      const ok = await bcrypt.compare(String(password), row.password_hash);
      if (!ok) {
        return res.status(401).json({ message: 'invalid email or password' });
      }

      if (emailVerification.enabled && !row.email_verified_at && !row.google_subject) {
        return res.status(403).json({ code: 'EMAIL_VERIFICATION_REQUIRED', email: row.email, message: 'Please verify your email before signing in' });
      }

      const user = serializeAuthUser(row);
      const token = signToken(user, row.session_version ?? 0);
      setSessionCookie(res, token);
      setCsrfCookie(res, createCsrfToken());
      res.json({ token, user });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.get('/api/auth/me', async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      const row = await getUserById(payload.sub);
      if (!row) {
        return res.status(401).json({ message: 'user not found' });
      }

      if (emailVerification.enabled && !row.email_verified_at && !row.google_subject) {
        return res.status(403).json({ code: 'EMAIL_VERIFICATION_REQUIRED', email: row.email, message: 'Please verify your email before signing in' });
      }

      const user = serializeAuthUser(row);
      const token = signToken(user, row.session_version ?? 0);
      setSessionCookie(res, token);
      setCsrfCookie(res, createCsrfToken());
      res.json({ token, user });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.post('/api/auth/logout', (_req, res) => {
    clearSessionCookie(res);
    clearCsrfCookie(res);
    res.json({ ok: true });
  });

  app.post('/api/auth/google', authLimiter, async (req, res) => {
    if (!verifyGoogleCredential) {
      return res.status(503).json({ message: 'Google login is not configured' });
    }

    const credential = req.body?.credential;
    if (typeof credential !== 'string' || !credential || credential.length > 10_000) {
      return res.status(400).json({ message: 'Google credential is required' });
    }

    let identity;
    try {
      identity = await verifyGoogleCredential(credential);
    } catch {
      return res.status(401).json({ message: 'Invalid Google credential' });
    }

    try {
      let row = await getUserByGoogleSubject(identity.subject);

      if (!row) {
        row = await getUserByEmail(identity.email);
        if (row) {
          if (row.google_subject && row.google_subject !== identity.subject) {
            return res.status(409).json({ message: 'Google account does not match this user' });
          }
          if (emailVerification.enabled && !row.email_verified_at && !row.google_subject) {
            // An unverified local password might have been registered by someone else.
            await updateUserPasswordHash(row.id, await bcrypt.hash(randomUUID(), 10));
            await revokeUserSessions(row.id);
            row = { ...row, session_version: (row.session_version ?? 0) + 1 };
          }
          const result = await linkGoogleSubject(row.id, identity.subject);
          if (result.changes !== 1) {
            return res.status(409).json({ message: 'Google account could not be linked' });
          }
          row = { ...row, google_subject: identity.subject };
        } else {
          row = {
            id: randomUUID(),
            email: identity.email,
            name: identity.name,
            passwordHash: await bcrypt.hash(randomUUID(), 10),
            googleSubject: identity.subject,
            createdAt: new Date().toISOString(),
          };
          await insertUser(row);
        }
      }

      await markEmailVerified(row.id);

      const user = serializeAuthUser(row);
      const token = signToken(user, row.session_version ?? 0);
      setSessionCookie(res, token);
      setCsrfCookie(res, createCsrfToken());
      return res.json({ token, user });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'internal error' });
    }
  });

  app.patch('/api/users/me', async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      const parsed = nameSchema.safeParse(req.body?.name);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: parsed.error.issues[0]?.message ?? 'invalid name' });
      }
      const name = parsed.data;

      await updateUserName(payload.sub, name);
      const row = await getUserById(payload.sub);
      if (!row) return res.status(404).json({ message: 'user not found' });

      const user = serializeAuthUser(row);
      const token = signToken(user, row.session_version ?? 0);
      setSessionCookie(res, token);
      setCsrfCookie(res, createCsrfToken());
      res.json({ token, user });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.put('/api/users/me/avatar', async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      const parsed = avatarAppearanceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: parsed.error.issues[0]?.message ?? 'invalid avatar appearance',
        });
      }

      const result = await updateUserAvatarAppearance(
        payload.sub,
        JSON.stringify(parsed.data),
      );
      if (result.changes !== 1) {
        return res.status(404).json({ message: 'user not found' });
      }

      return res.json({ avatarAppearance: parsed.data });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'internal error' });
    }
  });

  app.post('/api/auth/change-password', async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      const parsed = changePasswordSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: parsed.error.issues[0]?.message ?? 'invalid payload' });
      }

      const { currentPassword, newPassword } = parsed.data;

      const row = await getUserById(payload.sub);
      if (!row) return res.status(404).json({ message: 'user not found' });

      const ok = await bcrypt.compare(String(currentPassword), row.password_hash);
      if (!ok) return res.status(401).json({ message: 'current password is incorrect' });

      const newHash = await bcrypt.hash(String(newPassword), 10);
      await updateUserPasswordHash(payload.sub, newHash);
      await revokeUserSessions(payload.sub).catch((error) => {
        // Persistent version checks still reject old requests and the room
        // authorization sweep provides a fallback if the adapter is unavailable.
        console.warn('[auth] immediate session disconnect failed', error);
      });
      const updated = await getUserById(payload.sub);
      if (!updated) return res.status(401).json({ message: 'account is no longer active' });
      const user = serializeAuthUser(updated);
      const token = signToken(user, updated.session_version ?? 0);
      setSessionCookie(res, token);
      setCsrfCookie(res, createCsrfToken());
      res.json({ ok: true, token, user });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.get('/api/users/me/export', async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      const data = await exportUserData(payload.sub);
      if (!data) return res.status(404).json({ message: 'user not found' });

      res.set('Cache-Control', 'no-store');
      res.attachment('personal-data.json');
      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.delete('/api/users/me', async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      const growthAssetUrls = await listGrowthAssetContentUrlsByOwnerId(payload.sub);
      const mediaFileNames = await listMediaStorageFileNamesByOwnerId(payload.sub);
      const result = await deleteAccountWithCleanup({
        ownerId: payload.sub,
        growthAssetUrls,
        mediaFileNames,
        deleteGrowthAssetFiles,
        deleteMediaFiles,
      });
      clearSessionCookie(res);
      clearCsrfCookie(res);
      res.status(result.cleanupPending ? 202 : 200).json({ ok: true, ...result });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });
}
