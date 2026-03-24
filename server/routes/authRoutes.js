import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';

const nameSchema = z.string().trim().min(1, 'name is required').max(100, 'name too long');

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'currentPassword is required'),
  newPassword: z.string().min(8, 'newPassword must be at least 8 characters'),
});

export function registerAuthRoutes(app, deps) {
  const {
    requireAuth,
    signToken,
    getUserByEmail,
    insertUser,
    getUserById,
    updateUserName,
    updateUserPasswordHash,
    deleteUserById,
  } = deps;

  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password, name } = req.body || {};

      if (!email || typeof email !== 'string') {
        return res.status(400).json({ message: 'email is required' });
      }
      if (!password || typeof password !== 'string' || password.length < 8) {
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

      const token = signToken(user);
      res.status(201).json({
        token,
        user: { id: user.id, email: user.email, name: user.name },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
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

      const user = { id: row.id, email: row.email, name: row.name };
      const token = signToken(user);
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

      res.json({ user: { id: row.id, email: row.email, name: row.name } });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
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

      const user = { id: row.id, email: row.email, name: row.name };
      const token = signToken(user);
      res.json({ token, user });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
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

      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.delete('/api/users/me', async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      await deleteUserById(payload.sub);
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });
}
