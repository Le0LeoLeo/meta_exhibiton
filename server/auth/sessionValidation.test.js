// @vitest-environment node
import express from 'express';
import bcrypt from 'bcryptjs';
import { afterEach, describe, expect, it } from 'vitest';
import { createJwtHelpers } from './jwt.js';
import { createSessionValidator, createSessionMiddleware } from './sessionValidation.js';
import { registerAuthRoutes } from '../routes/authRoutes.js';

const servers = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); })));
});

describe('persisted session versions', () => {
  it('rejects unverified sessions when enabled, while verified Google sessions remain valid', async () => {
    const jwt = createJwtHelpers({ secret: 'verification-session-secret' });
    const user = { id: 'owner', session_version: 0 };
    const token = jwt.signToken(user, 0);
    const validate = createSessionValidator({ verifyToken: jwt.verifyToken, getUserById: async () => user, emailVerificationEnabled: true });
    expect(await validate(token)).toBeNull();
    user.email_verified_at = new Date().toISOString();
    expect(await validate(token)).toMatchObject({ sub: 'owner' });
    user.email_verified_at = null;
    user.google_subject = 'verified-google-subject';
    expect(await validate(token)).toMatchObject({ sub: 'owner' });
  });
  it('revokes old HTTP sessions after a password change and issues usable new credentials', async () => {
    const jwt = createJwtHelpers({ secret: 'test-password-revocation-secret' });
    const user = { id: 'owner', email: 'owner@example.invalid', name: 'Owner', session_version: 0, password_hash: await bcrypt.hash('old-password', 4) };
    const oldToken = jwt.signToken(user, 0);
    const app = express();
    app.use(createSessionMiddleware({ verifySessionToken: createSessionValidator({ verifyToken: jwt.verifyToken, getUserById: async () => user }) }));
    app.use(express.json());
    registerAuthRoutes(app, {
      ...jwt, createCsrfToken: () => 'csrf', getUserById: async () => user, getUserByEmail: async () => user,
      updateUserPasswordHash: async (_id, hash) => { user.password_hash = hash; user.session_version += 1; },
    });
    const server = await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
    servers.push(server);
    const base = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(`${base}/api/auth/change-password`, {
      method: 'POST', headers: { authorization: `Bearer ${oldToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ currentPassword: 'old-password', newPassword: 'new-password' }),
    });
    expect(response.status).toBe(200);
    const changed = await response.json();
    expect(jwt.verifyToken(changed.token)).toMatchObject({ sessionVersion: 1 });
    expect(response.headers.get('set-cookie')).toContain('mrei_session=');
    for (const headers of [{ authorization: `Bearer ${oldToken}` }, { cookie: `mrei_session=${oldToken}` }]) {
      expect((await fetch(`${base}/api/auth/me`, { headers })).status).toBe(401);
    }
    const fresh = await fetch(`${base}/api/auth/me`, { headers: { authorization: `Bearer ${changed.token}` } });
    expect(fresh.status).toBe(200);
    expect(jwt.verifyToken((await fresh.json()).token)).toMatchObject({ sessionVersion: 1 });
    const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: user.email, password: 'new-password' }) });
    expect(login.status).toBe(200);
    expect(jwt.verifyToken((await login.json()).token)).toMatchObject({ sessionVersion: 1 });
  });
  it('invalidates a previous token across validators when the password version changes', async () => {
    const jwt = createJwtHelpers({ secret: 'test-session-version-secret' });
    const user = { id: 'owner', session_version: 0 };
    const validate = createSessionValidator({ verifyToken: jwt.verifyToken, getUserById: async () => user });
    const old = jwt.signToken(user, 0);
    expect(await validate(old)).toMatchObject({ sub: 'owner' });
    user.session_version = 1;
    expect(await validate(old)).toBeNull();
    expect(await validate(jwt.signToken(user, 1))).toMatchObject({ sub: 'owner' });
    expect(await validate(jwt.signMediaPreviewToken('asset'))).toBeNull();
    expect(await createSessionValidator({ verifyToken: jwt.verifyToken, getUserById: async () => null })(old)).toBeNull();
  });

  it('rejects revoked Bearer and Cookie sessions before routes run while allowing a fresh login', async () => {
    const app = express();
    app.use(createSessionMiddleware({ verifySessionToken: async token => token === 'fresh' ? { sub: 'owner' } : null }));
    app.get('/api/private', (_req, res) => res.json({ ok: true }));
    app.post('/api/auth/login', (_req, res) => res.json({ ok: true }));
    const server = await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
    servers.push(server);
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const headers of [{ authorization: 'Bearer revoked' }, { cookie: 'mrei_session=revoked' }]) {
      expect((await fetch(`${base}/api/private`, { headers })).status).toBe(401);
      expect((await fetch(`${base}/api/auth/login`, { method: 'POST', headers })).status).toBe(200);
    }
    expect((await fetch(`${base}/api/private`, { headers: { authorization: 'Bearer fresh' } })).status).toBe(200);
  });
});

describe('password change errors', () => {
  it('reports a wrong current password with a stable code the client can map to a field', async () => {
    const jwt = createJwtHelpers({ secret: 'test-password-error-secret' });
    const user = { id: 'owner', email: 'owner@example.invalid', name: 'Owner', session_version: 0, password_hash: await bcrypt.hash('old-password', 4) };
    const token = jwt.signToken(user, 0);
    const app = express();
    app.use(createSessionMiddleware({ verifySessionToken: createSessionValidator({ verifyToken: jwt.verifyToken, getUserById: async () => user }) }));
    app.use(express.json());
    registerAuthRoutes(app, { ...jwt, createCsrfToken: () => 'csrf', getUserById: async () => user, getUserByEmail: async () => user, updateUserPasswordHash: async () => {} });
    const server = await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
    servers.push(server);

    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/change-password`, {
      method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ currentPassword: 'not-the-password', newPassword: 'new-password' }),
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'CURRENT_PASSWORD_INCORRECT' });
  });
});
